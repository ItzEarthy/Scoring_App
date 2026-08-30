"use server";

import { prisma } from "@/lib/prisma";
import { submitMatchScore } from "@/lib/matchmaking/submit-match-score";
import { MatchStatus, Prisma } from "@/app/generated/prisma/client";

/**
 * Lazy-evaluation timeout approval: finds matches still PENDING_CONFIRMATION
 * whose approval_deadline has passed and that have a recorded report, then
 * finalizes them the same way a matching second report would. Called from
 * read paths (dashboard, org hub, match detail) before their own queries so
 * expired matches are already resolved by the time the page renders.
 */
export async function autoApproveExpiredMatches(
  filter: { organizationId?: string; userId?: string; matchId?: string } = {}
) {
  const where: Prisma.MatchWhereInput = {
    status: MatchStatus.PENDING_CONFIRMATION,
    approvalDeadline: { lt: new Date() },
    reportedWinnerTeam: { not: null },
    ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
    ...(filter.matchId ? { id: filter.matchId } : {}),
    ...(filter.userId ? { participants: { some: { userId: filter.userId } } } : {}),
  };

  const expired = await prisma.match.findMany({
    where,
    select: { id: true, organizationId: true, reportedWinnerTeam: true },
  });

  for (const match of expired) {
    if (!match.reportedWinnerTeam) continue;
    await submitMatchScore(match.id, match.reportedWinnerTeam, match.organizationId);
  }
}
