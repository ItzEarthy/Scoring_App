"use server";

import { prisma } from "@/lib/prisma";
import { MatchOutcome, MatchStatus, CourtStatus } from "@/app/generated/prisma/enums";
import { getRatingEngine, type RatingEngine } from "@/lib/matchmaking/rating-engines";

export type SubmitMatchScoreResult =
  | { success: true }
  | { success: false; error: string };

// Statuses that cannot be overwritten by a score submission.
const TERMINAL_STATUSES: MatchStatus[] = [
  MatchStatus.COMPLETED,
  MatchStatus.CANCELED,
  MatchStatus.DISPUTED,
];

export async function submitMatchScore(
  matchId: string,
  winningTeamIdentifier: string,
  orgId: string,
  options?: { allowFromDisputed?: boolean }
): Promise<SubmitMatchScoreResult> {
  // --- Input validation ---
  if (!matchId?.trim() || !winningTeamIdentifier?.trim() || !orgId?.trim()) {
    return {
      success: false,
      error: "matchId, winningTeamIdentifier, and orgId are required.",
    };
  }

  // --- Load match with participant ledger snapshot ---
  let found: Awaited<ReturnType<typeof fetchMatch>>;
  try {
    found = await fetchMatch(matchId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Database error loading match: ${msg}` };
  }

  if (!found) {
    return { success: false, error: `Match "${matchId}" not found.` };
  }

  const match = found;

  // --- Domain validation ---
  if (match.organizationId !== orgId) {
    return { success: false, error: "Match does not belong to the specified organization." };
  }

  const disputeOverride = options?.allowFromDisputed && match.status === MatchStatus.DISPUTED;
  if (TERMINAL_STATUSES.includes(match.status) && !disputeOverride) {
    return {
      success: false,
      error: `Match is already ${match.status.replace(/_/g, " ").toLowerCase()} and cannot be scored.`,
    };
  }

  if (match.participants.length === 0) {
    return { success: false, error: "Match has no participants." };
  }

  const allTeamIds = [...new Set(match.participants.map((p) => p.teamIdentifier))];

  if (!allTeamIds.includes(winningTeamIdentifier)) {
    return {
      success: false,
      error: `Team "${winningTeamIdentifier}" is not in this match. Valid teams: ${allTeamIds.join(", ")}.`,
    };
  }

  // --- Order teams: winner first so rank[0] === 1 ---
  const orderedTeamIds = [
    winningTeamIdentifier,
    ...allTeamIds.filter((t) => t !== winningTeamIdentifier),
  ];

  type ParticipantSlot = {
    participantId: string;
    userId: string;
    muBefore: number;
    sigmaBefore: number;
  };

  const teamGroups: ParticipantSlot[][] = orderedTeamIds.map((teamId) =>
    match.participants
      .filter((p) => p.teamIdentifier === teamId)
      .map((p) => ({
        participantId: p.id,
        userId: p.userId,
        teamIdentifier: p.teamIdentifier,
        muBefore: p.muBefore,
        sigmaBefore: p.sigmaBefore,
      }))
  );

  // --- Rating calculation (engine selected by the sport's ratingAlgorithm) ---
  const engine = getRatingEngine(match.sport.ratingAlgorithm);
  const engineTeams = teamGroups.map((team) =>
    team.map((p) => ({ mu: p.muBefore, sigma: p.sigmaBefore }))
  );

  // rank[i] = finishing position for teams[i]; 1 = winner.
  const ranks = orderedTeamIds.map((_, i) => i + 1);

  let updatedRatings: ReturnType<RatingEngine["rate"]>;
  try {
    updatedRatings = engine.rate(engineTeams, ranks);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Rating engine error: ${msg}` };
  }

  // --- Build per-participant update payloads ---
  type UpdatePayload = {
    participantId: string;
    userId: string;
    muAfter: number;
    sigmaAfter: number;
    outcome: MatchOutcome;
  };

  const updates: UpdatePayload[] = teamGroups.flatMap((team, teamIdx) => {
    const outcome: MatchOutcome = teamIdx === 0 ? MatchOutcome.WIN : MatchOutcome.LOSS;
    return team.map((player, playerIdx) => ({
      participantId: player.participantId,
      userId: player.userId,
      muAfter: updatedRatings[teamIdx][playerIdx].mu,
      sigmaAfter: updatedRatings[teamIdx][playerIdx].sigma,
      outcome,
    }));
  });

  // --- Persist atomically ---
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Write muAfter, sigmaAfter, and outcome to the immutable ledger.
      for (const u of updates) {
        await tx.matchParticipant.update({
          where: { id: u.participantId },
          data: {
            muAfter: u.muAfter,
            sigmaAfter: u.sigmaAfter,
            outcome: u.outcome,
          },
        });
      }

      // 2. Upsert the live PlayerRating for each participant.
      //    upsert guards against the edge case where no rating row exists yet.
      for (const u of updates) {
        await tx.playerRating.upsert({
          where: {
            userId_sportId: {
              userId: u.userId,
              sportId: match.sportId,
            },
          },
          update: {
            mu: u.muAfter,
            sigma: u.sigmaAfter,
          },
          create: {
            userId: u.userId,
            sportId: match.sportId,
            mu: u.muAfter,
            sigma: u.sigmaAfter,
            isActive: true,
          },
        });
      }

      // 3. Mark match as completed.
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.COMPLETED,
          finishedAt: new Date(),
        },
      });

      // 4. Free up the court, if one was assigned.
      if (match.courtId) {
        await tx.court.update({
          where: { id: match.courtId },
          data: { status: CourtStatus.AVAILABLE },
        });
      }
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to persist match results: ${msg}` };
  }
}

function fetchMatch(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      sport: { select: { ratingAlgorithm: true } },
      participants: {
        select: {
          id: true,
          userId: true,
          teamIdentifier: true,
          muBefore: true,
          sigmaBefore: true,
        },
      },
    },
  });
}
