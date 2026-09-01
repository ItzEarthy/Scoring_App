"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitMatchScore } from "@/lib/matchmaking/submit-match-score";
import { getScoreConfig, parseScoreFormData, validateAndDeriveScore } from "@/lib/matchmaking/scoring";
import { MatchStatus, Role } from "@/app/generated/prisma/enums";

export type ReportMatchScoreState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const TERMINAL_STATUSES: MatchStatus[] = [
  MatchStatus.COMPLETED,
  MatchStatus.CANCELED,
  MatchStatus.DISPUTED,
];

type PlatformConfig = {
  approval_mode?: "admin_forced" | "player_mutual";
  auto_approve_hours?: number;
};

/**
 * Reports a match score: scores are validated and the winner (or draw) is
 * derived server-side from the sport's `defaultRules` (see
 * lib/matchmaking/scoring) -- an invalid or incomplete score blocks
 * submission with an error rather than being accepted. Then either
 * finalizes ratings immediately (admin_forced orgs, submitted by an org
 * admin/owner) or records the report and waits for a matching report from
 * another participant (player_mutual orgs, the default) -- resolving to
 * COMPLETED on agreement or DISPUTED on conflicting results.
 */
export async function reportMatchScoreAction(
  _prevState: ReportMatchScoreState,
  formData: FormData
): Promise<ReportMatchScoreState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in to report a score." };
  }

  const matchId = formData.get("matchId");
  const orgId = formData.get("orgId");

  if (typeof matchId !== "string" || !matchId.trim()) {
    return { status: "error", message: "Missing match reference." };
  }
  if (typeof orgId !== "string" || !orgId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      organization: { select: { id: true, platformConfig: true } },
      sport: { select: { name: true, defaultRules: true, ratingAlgorithm: true } },
      participants: { select: { id: true, userId: true, teamIdentifier: true } },
    },
  });

  if (!match) {
    return { status: "error", message: "Match not found." };
  }
  if (match.organizationId !== orgId) {
    return { status: "error", message: "Match does not belong to the specified organization." };
  }

  const isParticipant = match.participants.some((p) => p.userId === userId);
  if (!isParticipant) {
    return { status: "error", message: "Only match participants can report a score." };
  }

  if (TERMINAL_STATUSES.includes(match.status)) {
    return {
      status: "error",
      message: `Match is already ${match.status.replace(/_/g, " ").toLowerCase()} and cannot be scored.`,
    };
  }

  const teamIds = [...new Set(match.participants.map((p) => p.teamIdentifier))];

  // --- Parse + validate the submitted score against the sport's rules ---
  const shape = getScoreConfig(match.sport).shape;
  const parsed = parseScoreFormData(shape, formData, teamIds);
  if ("error" in parsed) {
    return { status: "error", message: parsed.error };
  }
  const result = validateAndDeriveScore(match.sport, teamIds, parsed.input);
  if (!result.valid) {
    return { status: "error", message: result.error };
  }

  // --- Persist per-participant scores (kept regardless of approval outcome).
  //     A team's score is replicated across every teammate on that team,
  //     since the form collects one score per team, not per player. ---
  await prisma.$transaction(
    match.participants.map((p) =>
      prisma.matchParticipant.update({
        where: { id: p.id },
        data: { score: result.teamScores[p.teamIdentifier] ?? null },
      })
    )
  );

  const derivedWinnerId = result.draw ? null : result.winnerTeamId;
  const derivedIsDraw = result.draw;

  const config = (match.organization.platformConfig ?? {}) as PlatformConfig;
  const approvalMode = config.approval_mode === "admin_forced" ? "admin_forced" : "player_mutual";

  if (approvalMode === "admin_forced") {
    const membership = await prisma.organizationUser.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      select: { role: true },
    });

    if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
      return {
        status: "error",
        message: "This organization requires an admin to finalize match scores.",
      };
    }

    const submitResult = await submitMatchScore(
      matchId,
      orgId,
      derivedIsDraw ? { draw: true } : { winnerTeamIdentifier: derivedWinnerId! },
      { teamScores: result.teamScores }
    );
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/dashboard");

    return submitResult.success
      ? { status: "success", message: "Score finalized and ratings updated." }
      : { status: "error", message: submitResult.error };
  }

  // --- player_mutual: require a matching report from a second participant ---
  if (!match.reportedByUserId) {
    const autoApproveHours =
      typeof config.auto_approve_hours === "number" ? config.auto_approve_hours : 24;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.PENDING_CONFIRMATION,
        reportedWinnerTeam: derivedWinnerId,
        reportedIsDraw: derivedIsDraw,
        reportedByUserId: userId,
        approvalDeadline:
          match.approvalDeadline ?? new Date(Date.now() + autoApproveHours * 60 * 60 * 1000),
      },
    });

    revalidatePath(`/matches/${matchId}`);
    return {
      status: "success",
      message: "Score reported. Waiting for another participant to confirm the result.",
    };
  }

  if (match.reportedByUserId === userId) {
    // Same reporter updating their own submission before anyone else confirms.
    await prisma.match.update({
      where: { id: matchId },
      data: { reportedWinnerTeam: derivedWinnerId, reportedIsDraw: derivedIsDraw },
    });
    revalidatePath(`/matches/${matchId}`);
    return { status: "success", message: "Your report was updated. Still awaiting confirmation." };
  }

  const reportsMatch = match.reportedIsDraw === derivedIsDraw && match.reportedWinnerTeam === derivedWinnerId;

  if (reportsMatch) {
    const submitResult = await submitMatchScore(
      matchId,
      orgId,
      derivedIsDraw ? { draw: true } : { winnerTeamIdentifier: derivedWinnerId! },
      { teamScores: result.teamScores }
    );
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/dashboard");

    return submitResult.success
      ? { status: "success", message: "Both sides agree -- ratings updated." }
      : { status: "error", message: submitResult.error };
  }

  // Conflicting results.
  await prisma.match.update({
    where: { id: matchId },
    data: { status: MatchStatus.DISPUTED },
  });
  revalidatePath(`/matches/${matchId}`);

  return {
    status: "error",
    message: "Your report conflicts with the other participant's. Match marked as disputed.",
  };
}
