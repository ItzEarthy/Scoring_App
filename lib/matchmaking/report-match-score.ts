"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitMatchScore } from "@/lib/matchmaking/submit-match-score";
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
 * Reports a match score, then either finalizes ratings immediately
 * (admin_forced orgs, submitted by an org admin/owner) or records the
 * report and waits for a matching report from another participant
 * (player_mutual orgs, the default) — resolving to COMPLETED on
 * agreement or DISPUTED on conflicting winner declarations.
 */
export async function reportMatchScoreAction(
  _prevState: ReportMatchScoreState,
  formData: FormData
): Promise<ReportMatchScoreState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You must be signed in to report a score." };
  }
  const userId = session.user.id;

  const matchId = formData.get("matchId");
  const orgId = formData.get("orgId");
  const winningTeamIdentifier = formData.get("winningTeamIdentifier");

  if (typeof matchId !== "string" || !matchId.trim()) {
    return { status: "error", message: "Missing match reference." };
  }
  if (typeof orgId !== "string" || !orgId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }
  if (typeof winningTeamIdentifier !== "string" || !winningTeamIdentifier.trim()) {
    return { status: "error", message: "Select a winner before reporting the score." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      organization: { select: { id: true, platformConfig: true } },
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
  if (!teamIds.includes(winningTeamIdentifier)) {
    return { status: "error", message: "Selected winner is not part of this match." };
  }

  // --- Persist per-participant scores (kept regardless of approval outcome) ---
  const scoreUpdates = match.participants.map((p) => {
    const raw = formData.get(`score:${p.id}`);
    const parsed = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : null;
    return { participantId: p.id, score: Number.isFinite(parsed as number) ? parsed : null };
  });

  await prisma.$transaction(
    scoreUpdates.map((u) =>
      prisma.matchParticipant.update({
        where: { id: u.participantId },
        data: { score: u.score },
      })
    )
  );

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

    const result = await submitMatchScore(matchId, winningTeamIdentifier, orgId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/dashboard");

    return result.success
      ? { status: "success", message: "Score finalized and ratings updated." }
      : { status: "error", message: result.error };
  }

  // --- player_mutual: require a matching report from a second participant ---
  if (!match.reportedWinnerTeam) {
    const autoApproveHours =
      typeof config.auto_approve_hours === "number" ? config.auto_approve_hours : 24;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.PENDING_CONFIRMATION,
        reportedWinnerTeam: winningTeamIdentifier,
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
      data: { reportedWinnerTeam: winningTeamIdentifier },
    });
    revalidatePath(`/matches/${matchId}`);
    return { status: "success", message: "Your report was updated. Still awaiting confirmation." };
  }

  if (match.reportedWinnerTeam === winningTeamIdentifier) {
    const result = await submitMatchScore(matchId, winningTeamIdentifier, orgId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath("/dashboard");

    return result.success
      ? { status: "success", message: "Both sides agree — ratings updated." }
      : { status: "error", message: result.error };
  }

  // Conflicting winner declarations.
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
