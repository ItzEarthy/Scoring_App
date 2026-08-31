import { prisma } from "@/lib/prisma";
import { QueueStatus, MatchStatus } from "@/app/generated/prisma/enums";
import { getRatingEngine } from "@/lib/matchmaking/rating-engines";

/**
 * Pairs waiting players into 1v1 matches. Entries are sorted by conservative
 * skill estimate (mu - 3*sigma) and paired consecutively so opponents are as
 * evenly matched as the current queue allows, then each pair is promoted
 * into a SCHEDULED Match + two MatchParticipant rows carrying the ledger's
 * muBefore/sigmaBefore snapshot. Runs after every join so matches form as
 * soon as two players are waiting.
 *
 * Ratings are read as plain {mu, sigma} regardless of which algorithm the
 * sport uses (OpenSkill or Glicko-2) -- the conservative-estimate formula
 * ranks players the same way in either scale, and a player with no rating
 * row yet starts from that sport's algorithm-specific default rather than
 * a hardcoded one.
 */
export async function formMatchesFromQueue(organizationId: string, sportId: string) {
  const sport = await prisma.sport.findUniqueOrThrow({
    where: { id: sportId },
    select: { ratingAlgorithm: true },
  });
  const engine = getRatingEngine(sport.ratingAlgorithm);

  const waiting = await prisma.queueEntry.findMany({
    where: { organizationId, sportId, status: QueueStatus.WAITING },
    orderBy: { joinedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          playerRatings: {
            where: { organizationId, sportId },
            select: { mu: true, sigma: true },
          },
        },
      },
    },
  });

  if (waiting.length < 2) return;

  const ranked = waiting
    .map((entry) => {
      const rating = entry.user.playerRatings[0];
      const mu = rating?.mu ?? engine.defaultRating.mu;
      const sigma = rating?.sigma ?? engine.defaultRating.sigma;
      return { entryId: entry.id, userId: entry.userId, mu, sigma, conservative: mu - 3 * sigma };
    })
    .sort((a, b) => b.conservative - a.conservative);

  const pairs: [(typeof ranked)[number], (typeof ranked)[number]][] = [];
  for (let i = 0; i + 1 < ranked.length; i += 2) {
    pairs.push([ranked[i], ranked[i + 1]]);
  }
  if (pairs.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const [a, b] of pairs) {
      const match = await tx.match.create({
        data: {
          organizationId,
          sportId,
          status: MatchStatus.SCHEDULED,
          participants: {
            create: [
              { userId: a.userId, teamIdentifier: "team_a", muBefore: a.mu, sigmaBefore: a.sigma },
              { userId: b.userId, teamIdentifier: "team_b", muBefore: b.mu, sigmaBefore: b.sigma },
            ],
          },
        },
      });

      await tx.queueEntry.updateMany({
        where: { id: { in: [a.entryId, b.entryId] } },
        data: { status: QueueStatus.MATCHED, matchId: match.id },
      });
    }
  });
}
