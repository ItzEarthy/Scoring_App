import { prisma } from "@/lib/prisma";
import { QueueStatus, MatchStatus, CourtStatus } from "@/app/generated/prisma/enums";
import { getRatingEngine } from "@/lib/matchmaking/rating-engines";
import { pickAvailableCourt } from "@/lib/matchmaking/assign-court";

type PlatformConfig = { skill_gap_threshold?: number | null };

/**
 * Pairs waiting players into 1v1 matches. Entries are sorted by conservative
 * skill estimate (mu - 3*sigma); each unpaired entry takes the closest
 * unpaired opponent within the org's optional skill_gap_threshold (unset =
 * no cap), so opponents are as evenly matched as the current queue allows.
 * Entries with no eligible partner this pass stay WAITING for the next one.
 * Each pair is promoted into a SCHEDULED Match + two MatchParticipant rows
 * carrying the ledger's muBefore/sigmaBefore snapshot, plus an auto-assigned
 * Court when one is available for the sport. Runs after every join so
 * matches form as soon as two compatible players are waiting.
 *
 * Ratings are read as plain {mu, sigma} regardless of which algorithm the
 * sport uses (OpenSkill or Glicko-2) -- the conservative-estimate formula
 * ranks players the same way in either scale, and a player with no rating
 * row yet starts from that sport's algorithm-specific default rather than
 * a hardcoded one.
 */
export async function formMatchesFromQueue(organizationId: string, sportId: string) {
  const [sport, organization] = await Promise.all([
    prisma.sport.findUniqueOrThrow({
      where: { id: sportId },
      select: { ratingAlgorithm: true },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { platformConfig: true },
    }),
  ]);
  const engine = getRatingEngine(sport.ratingAlgorithm);
  const skillGapThreshold = (organization.platformConfig as PlatformConfig | null)?.skill_gap_threshold ?? null;

  const waiting = await prisma.queueEntry.findMany({
    where: { organizationId, sportId, status: QueueStatus.WAITING },
    orderBy: { joinedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          playerRatings: {
            where: { sportId },
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

  // Ranked is sorted by descending conservative estimate, so gaps only grow as
  // the inner scan moves further from `i` -- the first out-of-threshold
  // candidate means every later one is too, so we can stop scanning for `i`.
  const pairs: [(typeof ranked)[number], (typeof ranked)[number]][] = [];
  const used = new Set<number>();
  for (let i = 0; i < ranked.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < ranked.length; j++) {
      if (used.has(j)) continue;
      const gap = Math.abs(ranked[i].conservative - ranked[j].conservative);
      if (skillGapThreshold != null && gap > skillGapThreshold) break;
      used.add(i);
      used.add(j);
      pairs.push([ranked[i], ranked[j]]);
      break;
    }
  }
  if (pairs.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const claimedCourtIds: string[] = [];
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

      const court = await pickAvailableCourt(tx, organizationId, sportId, claimedCourtIds);
      if (court) {
        claimedCourtIds.push(court.id);
        await tx.court.update({ where: { id: court.id }, data: { status: CourtStatus.IN_USE } });
        await tx.match.update({ where: { id: match.id }, data: { courtId: court.id } });
      }

      await tx.queueEntry.updateMany({
        where: { id: { in: [a.entryId, b.entryId] } },
        data: { status: QueueStatus.MATCHED, matchId: match.id },
      });
    }
  });
}
