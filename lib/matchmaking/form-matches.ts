import { prisma } from "@/lib/prisma";
import { QueueStatus, MatchStatus, CourtStatus } from "@/app/generated/prisma/enums";
import { getRatingEngine } from "@/lib/matchmaking/rating-engines";
import { pickAvailableCourt } from "@/lib/matchmaking/assign-court";

type PlatformConfig = { skill_gap_threshold?: number | null };
type RankedEntry = { entryId: string; userId: string; mu: number; sigma: number; conservative: number };

/**
 * Pairs waiting players into matches sized to the sport's team constraint.
 * Entries are sorted by conservative skill estimate (mu - 3*sigma); groups
 * are formed from the closest unpaired candidates within the org's optional
 * skill_gap_threshold (unset = no cap), so opponents are as evenly matched
 * as the current queue allows. Entries with no eligible group this pass
 * stay WAITING for the next one. Each match gets an auto-assigned Court
 * when one is available for the sport. Runs after every join so matches
 * form as soon as enough compatible players are waiting.
 *
 * - Singles sports (minTeamSize === maxTeamSize === 1): 1v1, as before.
 * - Doubles sports (minTeamSize === maxTeamSize === 2): groups of 4,
 *   balanced-seeded as [rank1,rank4] vs [rank2,rank3] (highest+lowest vs.
 *   the two middles) so both sides are roughly even.
 * - Open-ended team sports (minTeamSize > 2, no fixed max): queue-based
 *   auto-matching is out of scope for now -- fair N-a-side skill-balanced
 *   drafting is a materially bigger problem. These sports are formed only
 *   via admin-created matches (see admin-create-match.ts); queueing for
 *   them is blocked at the source in queue-actions.ts.
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
      select: { ratingAlgorithm: true, minTeamSize: true, maxTeamSize: true },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { platformConfig: true },
    }),
  ]);

  if (sport.minTeamSize > 2) return;

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

  const groupSize = sport.minTeamSize === 2 && sport.maxTeamSize === 2 ? 2 : 1;
  if (waiting.length < groupSize * 2) return;

  const ranked: RankedEntry[] = waiting
    .map((entry) => {
      const rating = entry.user.playerRatings[0];
      const mu = rating?.mu ?? engine.defaultRating.mu;
      const sigma = rating?.sigma ?? engine.defaultRating.sigma;
      return { entryId: entry.id, userId: entry.userId, mu, sigma, conservative: mu - 3 * sigma };
    })
    .sort((a, b) => b.conservative - a.conservative);

  if (groupSize === 2) {
    await formDoublesMatches(organizationId, sportId, ranked, skillGapThreshold);
  } else {
    await formSinglesMatches(organizationId, sportId, ranked, skillGapThreshold);
  }
}

async function formSinglesMatches(
  organizationId: string,
  sportId: string,
  ranked: RankedEntry[],
  skillGapThreshold: number | null
) {
  // Ranked is sorted by descending conservative estimate, so gaps only grow as
  // the inner scan moves further from `i` -- the first out-of-threshold
  // candidate means every later one is too, so we can stop scanning for `i`.
  const pairs: [RankedEntry, RankedEntry][] = [];
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

async function formDoublesMatches(
  organizationId: string,
  sportId: string,
  ranked: RankedEntry[],
  skillGapThreshold: number | null
) {
  const groups: [RankedEntry, RankedEntry, RankedEntry, RankedEntry][] = [];
  const used = new Set<number>();

  for (let i = 0; i < ranked.length; i++) {
    if (used.has(i)) continue;
    const idxs = [i];
    for (let j = i + 1; j < ranked.length && idxs.length < 4; j++) {
      if (used.has(j)) continue;
      idxs.push(j);
    }
    if (idxs.length < 4) continue;

    const gap = ranked[idxs[0]].conservative - ranked[idxs[3]].conservative;
    if (skillGapThreshold != null && gap > skillGapThreshold) continue;

    for (const idx of idxs) used.add(idx);
    groups.push(idxs.map((idx) => ranked[idx]) as [RankedEntry, RankedEntry, RankedEntry, RankedEntry]);
  }
  if (groups.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const claimedCourtIds: string[] = [];
    for (const [r1, r2, r3, r4] of groups) {
      // Balanced seeding: highest + lowest vs. the two middles, so both
      // sides start roughly even rather than strongest-vs-weakest.
      const teamA = [r1, r4];
      const teamB = [r2, r3];

      const match = await tx.match.create({
        data: {
          organizationId,
          sportId,
          status: MatchStatus.SCHEDULED,
          participants: {
            create: [
              ...teamA.map((p) => ({
                userId: p.userId,
                teamIdentifier: "team_a",
                muBefore: p.mu,
                sigmaBefore: p.sigma,
              })),
              ...teamB.map((p) => ({
                userId: p.userId,
                teamIdentifier: "team_b",
                muBefore: p.mu,
                sigmaBefore: p.sigma,
              })),
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
        where: { id: { in: [r1.entryId, r2.entryId, r3.entryId, r4.entryId] } },
        data: { status: QueueStatus.MATCHED, matchId: match.id },
      });
    }
  });
}
