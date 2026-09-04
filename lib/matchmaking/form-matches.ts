import { prisma } from "@/lib/prisma";
import { QueueStatus, MatchStatus, CourtStatus, NotificationType } from "@/app/generated/prisma/enums";
import { getRatingEngine } from "@/lib/matchmaking/rating-engines";
import { pickAvailableCourt } from "@/lib/matchmaking/assign-court";
import { notifyUsers } from "@/lib/notifications/notify";
import { publishQueueEvent } from "@/lib/realtime/publish";

type PlatformConfig = {
  skill_gap_threshold?: number | null;
  matchmaking_delay_seconds?: number | null;
};
type RankedEntry = {
  entryId: string;
  userId: string;
  mu: number;
  sigma: number;
  conservative: number;
  joinedAt: Date;
};

// How long a viable group sits in the "lobby" before it locks into a match,
// mirroring video-game matchmaking (a match doesn't start the instant the
// player count is met -- it waits briefly so late arrivals can still improve
// the pairing). Orgs can override via matchmaking_delay_seconds; 0 means
// instant/no wait.
const DEFAULT_MATCHMAKING_DELAY_SECONDS = 20;

/**
 * Pairs waiting players into matches sized to the sport's team constraint.
 * Entries are sorted by conservative skill estimate (mu - 3*sigma); groups
 * are formed from the closest unpaired candidates within the org's optional
 * skill_gap_threshold (unset = no cap), so opponents are as evenly matched
 * as the current queue allows. A group only locks into a match once its
 * most-recently-joined member has been waiting at least
 * matchmaking_delay_seconds -- this is what keeps matches from starting the
 * instant the minimum headcount is reached, letting the queue fill a bit
 * (and letting a better-matched grouping form) before committing, like a
 * game's matchmaking lobby. Entries with no eligible group this pass stay
 * WAITING for the next one. Each match gets an auto-assigned Court when one
 * is available for the sport. Runs after every join, and is also re-run
 * lazily from the queue page's read path (see expireStaleQueueEntries for
 * the same pattern) so delayed groups still lock in once time passes even
 * without a fresh join.
 *
 * - Singles sports (minTeamSize === maxTeamSize === 1): 1v1.
 * - Every other sport (doubles and open-ended team sports): grouped into
 *   teams of size `sport.minTeamSize` per side (the sport's minimum viable
 *   team), balanced via a snake draft -- ranks are dealt to alternating
 *   sides per round (round 0: best/2nd-best split; round 1: reversed; ...)
 *   so both sides end up with a comparable total skill rather than
 *   strongest-vs-weakest. For fixed-size sports (minTeamSize === maxTeamSize,
 *   e.g. doubles) this is the whole team; open-ended team sports (no fixed
 *   max) auto-match at their minimum size via the queue, while admins can
 *   still hand-build larger custom rosters via admin-create-match.ts.
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
      select: { name: true, ratingAlgorithm: true, minTeamSize: true, maxTeamSize: true },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { platformConfig: true },
    }),
  ]);

  const engine = getRatingEngine(sport.ratingAlgorithm);
  const config = organization.platformConfig as PlatformConfig | null;
  const skillGapThreshold = config?.skill_gap_threshold ?? null;
  const delayMs = (config?.matchmaking_delay_seconds ?? DEFAULT_MATCHMAKING_DELAY_SECONDS) * 1000;

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

  const teamSize = Math.max(1, sport.minTeamSize);
  if (waiting.length < teamSize * 2) return;

  const ranked: RankedEntry[] = waiting
    .map((entry) => {
      const rating = entry.user.playerRatings[0];
      const mu = rating?.mu ?? engine.defaultRating.mu;
      const sigma = rating?.sigma ?? engine.defaultRating.sigma;
      return {
        entryId: entry.id,
        userId: entry.userId,
        mu,
        sigma,
        conservative: mu - 3 * sigma,
        joinedAt: entry.joinedAt,
      };
    })
    .sort((a, b) => b.conservative - a.conservative);

  if (teamSize === 1) {
    await formSinglesMatches(organizationId, sportId, sport.name, ranked, skillGapThreshold, delayMs);
  } else {
    await formTeamMatches(
      organizationId,
      sportId,
      sport.name,
      ranked,
      teamSize,
      skillGapThreshold,
      delayMs
    );
  }
}

async function notifyMatchStarted(organizationId: string, sportName: string, matchId: string, userIds: string[]) {
  await notifyUsers(userIds, {
    type: NotificationType.MATCH_STARTED,
    title: "Match found",
    body: `Your ${sportName} match is ready.`,
    organizationId,
    matchId,
  });
}

async function formSinglesMatches(
  organizationId: string,
  sportId: string,
  sportName: string,
  ranked: RankedEntry[],
  skillGapThreshold: number | null,
  delayMs: number
) {
  const now = Date.now();
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
      const newestJoin = Math.max(ranked[i].joinedAt.getTime(), ranked[j].joinedAt.getTime());
      if (now - newestJoin < delayMs) continue;
      used.add(i);
      used.add(j);
      pairs.push([ranked[i], ranked[j]]);
      break;
    }
  }
  if (pairs.length === 0) return;

  const formed: { matchId: string; userIds: string[] }[] = [];

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

      formed.push({ matchId: match.id, userIds: [a.userId, b.userId] });
    }
  });

  await publishQueueEvent(organizationId, sportId, { type: "queue_changed" });
  await Promise.all(
    formed.map(({ matchId, userIds }) => notifyMatchStarted(organizationId, sportName, matchId, userIds))
  );
}

/**
 * Groups the queue into teamSize-a-side matches. Generalizes the old
 * fixed-4 doubles grouping to any team size: takes the next `teamSize * 2`
 * closest-ranked unused candidates, and if the whole group fits within the
 * skill gap threshold and has waited out the matchmaking delay, seeds it
 * into two balanced sides via a snake draft.
 */
async function formTeamMatches(
  organizationId: string,
  sportId: string,
  sportName: string,
  ranked: RankedEntry[],
  teamSize: number,
  skillGapThreshold: number | null,
  delayMs: number
) {
  const now = Date.now();
  const groupSize = teamSize * 2;
  const groups: RankedEntry[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < ranked.length; i++) {
    if (used.has(i)) continue;
    const idxs = [i];
    for (let j = i + 1; j < ranked.length && idxs.length < groupSize; j++) {
      if (used.has(j)) continue;
      idxs.push(j);
    }
    if (idxs.length < groupSize) continue;

    const gap = ranked[idxs[0]].conservative - ranked[idxs[idxs.length - 1]].conservative;
    if (skillGapThreshold != null && gap > skillGapThreshold) continue;

    const newestJoin = Math.max(...idxs.map((idx) => ranked[idx].joinedAt.getTime()));
    if (now - newestJoin < delayMs) continue;

    for (const idx of idxs) used.add(idx);
    groups.push(idxs.map((idx) => ranked[idx]));
  }
  if (groups.length === 0) return;

  const formed: { matchId: string; userIds: string[] }[] = [];

  await prisma.$transaction(async (tx) => {
    const claimedCourtIds: string[] = [];
    for (const group of groups) {
      const [teamA, teamB] = snakeSeedTeams(group, teamSize);

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
        where: { id: { in: group.map((p) => p.entryId) } },
        data: { status: QueueStatus.MATCHED, matchId: match.id },
      });

      formed.push({ matchId: match.id, userIds: group.map((p) => p.userId) });
    }
  });

  await publishQueueEvent(organizationId, sportId, { type: "queue_changed" });
  await Promise.all(
    formed.map(({ matchId, userIds }) => notifyMatchStarted(organizationId, sportName, matchId, userIds))
  );
}

/**
 * Deals a rank-sorted-descending group into two even sides via snake draft:
 * round 0 gives the top pick to team A and the next to team B, round 1
 * reverses, and so on -- so both teams end up with a comparable skill total
 * instead of one side getting all the strongest players. For teamSize=2
 * this reduces to the classic [rank1,rank4] vs [rank2,rank3] doubles split.
 */
function snakeSeedTeams(sortedDesc: RankedEntry[], teamSize: number): [RankedEntry[], RankedEntry[]] {
  const teamA: RankedEntry[] = [];
  const teamB: RankedEntry[] = [];
  for (let round = 0; round < teamSize; round++) {
    const first = sortedDesc[round * 2];
    const second = sortedDesc[round * 2 + 1];
    if (round % 2 === 0) {
      teamA.push(first);
      teamB.push(second);
    } else {
      teamA.push(second);
      teamB.push(first);
    }
  }
  return [teamA, teamB];
}
