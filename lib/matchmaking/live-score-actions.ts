"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishMatchEvent } from "@/lib/realtime/publish";
import { MatchEventType, MatchStatus } from "@/app/generated/prisma/enums";

const TERMINAL_STATUSES: MatchStatus[] = [
  MatchStatus.COMPLETED,
  MatchStatus.CANCELED,
  MatchStatus.DISPUTED,
];

export type LiveScoreState = {
  status: "idle" | "error";
  message?: string;
};

async function loadLiveMatch(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      participants: { select: { id: true, userId: true, score: true } },
    },
  });
}

function scoreboardEvent(
  match: NonNullable<Awaited<ReturnType<typeof loadLiveMatch>>>
) {
  return {
    type: "score_update" as const,
    status: match.status,
    scores: Object.fromEntries(match.participants.map((p) => [p.id, p.score ?? 0])),
  };
}

/**
 * Any participant can nudge any participant's score -- this is a shared
 * courtside scoreboard both sides are meant to control together, not a
 * per-user private log. Disputes over what happened are still resolved the
 * same way they always were: the final ReportScoreForm confirmation flow.
 */
export async function adjustLiveScore(
  matchId: string,
  participantId: string,
  delta: 1 | -1
): Promise<LiveScoreState> {
  const userId = await getVerifiedUserId();
  if (!userId) return { status: "error", message: "You must be signed in." };

  const match = await loadLiveMatch(matchId);
  if (!match) return { status: "error", message: "Match not found." };
  if (TERMINAL_STATUSES.includes(match.status)) {
    return { status: "error", message: "This match is closed." };
  }
  if (!match.participants.some((p) => p.userId === userId)) {
    return { status: "error", message: "Only match participants can update the score." };
  }
  const participant = match.participants.find((p) => p.id === participantId);
  if (!participant) return { status: "error", message: "Player is not part of this match." };
  if (delta < 0 && (participant.score ?? 0) <= 0) {
    return { status: "idle" };
  }

  // A plain read-then-write (or Prisma's atomic `increment`, which leaves a
  // NULL score NULL forever in Postgres since NULL + n = NULL) both risk
  // clobbering a concurrent tap from the other participant. GREATEST/COALESCE
  // keeps the clamp-to-zero and null-as-zero behavior atomic in one statement.
  await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE match_participants
      SET score = GREATEST(COALESCE(score, 0) + ${delta}, 0)
      WHERE id = ${participantId}
    `,
    prisma.match.update({
      where: { id: matchId },
      data: match.status === MatchStatus.SCHEDULED ? { status: MatchStatus.IN_PROGRESS } : {},
    }),
    prisma.matchEvent.create({
      data: {
        matchId,
        participantId,
        type: delta > 0 ? MatchEventType.POINT : MatchEventType.UNDO,
        delta,
        createdByUserId: userId,
      },
    }),
  ]);

  const fresh = await loadLiveMatch(matchId);
  if (fresh) await publishMatchEvent(matchId, scoreboardEvent(fresh));

  revalidatePath(`/matches/${matchId}`);
  return { status: "idle" };
}
