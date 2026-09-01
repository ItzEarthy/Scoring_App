"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitMatchScore } from "@/lib/matchmaking/submit-match-score";
import { MatchStatus, CourtStatus, Role } from "@/app/generated/prisma/enums";

export type ResolveDisputeState = {
  status: "idle" | "success" | "error";
  message?: string;
};

async function requireOrgAdmin(userId: string, organizationId: string) {
  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  return membership?.role === Role.ADMIN || membership?.role === Role.OWNER;
}

/**
 * Admin-forced resolution for a DISPUTED match: picks a winner and runs the
 * normal rating engine, same as any other completed match. This is the only
 * way a disputed match's ratings ever get computed -- disputes have no
 * other exit.
 */
export async function forceMatchWinnerAction(
  _prevState: ResolveDisputeState,
  formData: FormData
): Promise<ResolveDisputeState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in." };
  }

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
    return { status: "error", message: "Select a winner before resolving the dispute." };
  }

  if (!(await requireOrgAdmin(userId, orgId))) {
    return { status: "error", message: "Only organization admins can resolve disputes." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { organizationId: true, status: true },
  });
  if (!match || match.organizationId !== orgId) {
    return { status: "error", message: "Match not found." };
  }
  if (match.status !== MatchStatus.DISPUTED) {
    return { status: "error", message: "Only disputed matches can be resolved this way." };
  }

  const result = await submitMatchScore(matchId, winningTeamIdentifier, orgId, {
    allowFromDisputed: true,
  });

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/orgs/${orgId}/settings`);
  revalidatePath("/dashboard");

  return result.success
    ? { status: "success", message: "Dispute resolved -- ratings updated." }
    : { status: "error", message: result.error };
}

/**
 * Admin voids a disputed match entirely: no winner, no rating impact. Use
 * this when the dispute means "this match shouldn't count," not "which
 * side actually won."
 */
export async function voidMatchAction(
  _prevState: ResolveDisputeState,
  formData: FormData
): Promise<ResolveDisputeState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in." };
  }

  const matchId = formData.get("matchId");
  const orgId = formData.get("orgId");

  if (typeof matchId !== "string" || !matchId.trim()) {
    return { status: "error", message: "Missing match reference." };
  }
  if (typeof orgId !== "string" || !orgId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }

  if (!(await requireOrgAdmin(userId, orgId))) {
    return { status: "error", message: "Only organization admins can resolve disputes." };
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { organizationId: true, status: true, courtId: true },
  });
  if (!match || match.organizationId !== orgId) {
    return { status: "error", message: "Match not found." };
  }
  if (match.status !== MatchStatus.DISPUTED) {
    return { status: "error", message: "Only disputed matches can be voided." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELED, finishedAt: new Date() },
    });
    if (match.courtId) {
      await tx.court.update({
        where: { id: match.courtId },
        data: { status: CourtStatus.AVAILABLE },
      });
    }
  });

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/orgs/${orgId}/settings`);
  revalidatePath("/dashboard");

  return { status: "success", message: "Match voided. No ratings were affected." };
}
