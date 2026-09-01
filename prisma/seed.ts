import "dotenv/config";
import { PrismaClient, Role, MatchStatus, MatchOutcome } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";
import { getRatingEngine } from "../lib/matchmaking/rating-engines";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // ---------------------------------------------------------------------
  // Sports catalog. Demo matches/ratings below only exercise a subset
  // (Table Tennis, Foosball, Billiards); the rest exist as selectable
  // sports without seeded activity.
  // ---------------------------------------------------------------------
  const sportCatalog = [
    { name: "Tennis", ratingAlgorithm: "glicko2", defaultRules: { setsToWin: 2, gamesPerSet: 6, tiebreakerAt: 6 } },
    { name: "Table Tennis", ratingAlgorithm: "glicko2", defaultRules: { pointsToWin: 11, bestOf: 5, winBy: 2 } },
    { name: "Pickleball", ratingAlgorithm: "openskill", defaultRules: { pointsToWin: 11, winBy: 2, serveScoringOnly: true } },
    { name: "Badminton", ratingAlgorithm: "openskill", defaultRules: { pointsToWin: 21, bestOf: 3, capAt: 30 } },
    { name: "Squash", ratingAlgorithm: "glicko2", defaultRules: { pointsToWin: 11, bestOf: 5, scoringSystem: "PARS" } },
    { name: "Racquetball", ratingAlgorithm: "glicko2", defaultRules: { pointsToWin: 15, tiebreakerPoints: 11 } },
    { name: "Billiards", ratingAlgorithm: "glicko2", defaultRules: { format: "8-Ball", racesTo: 5, callPocket: true } },
    { name: "Snooker", ratingAlgorithm: "glicko2", defaultRules: { framesToWin: 3, reds: 15 } },
    { name: "Darts", ratingAlgorithm: "glicko2", defaultRules: { format: "501", finish: "double", legsToWin: 3 } },
    { name: "Foosball", ratingAlgorithm: "openskill", defaultRules: { pointsToWin: 5, noSpinning: true } },
    { name: "Air Hockey", ratingAlgorithm: "glicko2", defaultRules: { pointsToWin: 7, timeLimitMinutes: 10 } },
    { name: "Shuffleboard", ratingAlgorithm: "openskill", defaultRules: { pointsToWin: 15, frameLimit: 10 } },
    { name: "Golf", ratingAlgorithm: "glicko2", defaultRules: { format: "Stroke Play", holes: 18 } },
    { name: "Bowling", ratingAlgorithm: "glicko2", defaultRules: { frames: 10, scoringMethod: "traditional" } },
    { name: "Cornhole", ratingAlgorithm: "openskill", defaultRules: { pointsToWin: 21, cancellationScoring: true } },
    { name: "Spikeball", ratingAlgorithm: "openskill", defaultRules: { pointsToWin: 21, winBy: 2, rallyScoring: true } },
    { name: "Volleyball", ratingAlgorithm: "openskill", defaultRules: { setsToWin: 3, pointsPerSet: 25, tiebreakerPoints: 15 } },
    { name: "Basketball", ratingAlgorithm: "openskill", defaultRules: { format: "5v5", quarters: 4, quarterLengthMinutes: 10 } },
    { name: "Soccer", ratingAlgorithm: "openskill", defaultRules: { format: "11v11", halves: 2, halfLengthMinutes: 45 } },
    { name: "Softball", ratingAlgorithm: "openskill", defaultRules: { format: "Slow Pitch", innings: 7 } },
  ] as const;

  const sportByName = new Map<string, Awaited<ReturnType<typeof prisma.sport.upsert>>>();
  for (const s of sportCatalog) {
    const sport = await prisma.sport.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, ratingAlgorithm: s.ratingAlgorithm, defaultRules: s.defaultRules },
    });
    sportByName.set(s.name, sport);
  }

  const tableTennis = sportByName.get("Table Tennis")!;
  const foosball = sportByName.get("Foosball")!;
  const billiards = sportByName.get("Billiards")!;

  const sports = Object.fromEntries(sportByName);

  // ---------------------------------------------------------------------
  // Organizations
  // ---------------------------------------------------------------------
  const orgA = await prisma.organization.create({
    data: {
      name: "Downtown Sports Club",
      platformConfig: {
        match_mode: "queue",
        approval_mode: "player_mutual",
        auto_approve_hours: 24,
      },
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: "Riverside Recreation League",
      platformConfig: {
        match_mode: "admin",
        approval_mode: "admin_forced",
        auto_approve_hours: 12,
      },
    },
  });

  // ---------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------
  const userData = [
    { name: "Alice Nguyen", email: "alice@example.com" },
    { name: "Ben Carter", email: "ben@example.com" },
    { name: "Chloe Ramirez", email: "chloe@example.com", isSiteAdmin: true },
    { name: "Derek Kim", email: "derek@example.com" },
    { name: "Emma Walsh", email: "emma@example.com" },
  ];

  const users = [];
  for (const u of userData) {
    const user = await prisma.user.create({
      data: { ...u, passwordHash },
    });
    users.push(user);
  }
  const [alice, ben, chloe, derek, emma] = users;

  // ---------------------------------------------------------------------
  // Organization membership
  // ---------------------------------------------------------------------
  await prisma.organizationUser.createMany({
    data: [
      { userId: alice.id, organizationId: orgA.id, role: Role.OWNER },
      { userId: ben.id, organizationId: orgA.id, role: Role.ADMIN },
      { userId: chloe.id, organizationId: orgA.id, role: Role.MEMBER },
      { userId: derek.id, organizationId: orgA.id, role: Role.MEMBER },
      { userId: emma.id, organizationId: orgA.id, role: Role.MEMBER },
      { userId: ben.id, organizationId: orgB.id, role: Role.OWNER },
      { userId: derek.id, organizationId: orgB.id, role: Role.ADMIN },
      { userId: emma.id, organizationId: orgB.id, role: Role.MEMBER },
    ],
  });

  // ---------------------------------------------------------------------
  // Player ratings (seed starting points; some pre-advanced for history).
  // Ratings are global per user+sport -- they carry over between orgs --
  // so each (user, sport) pair appears at most once here. Values are
  // scaled to whichever algorithm the sport uses -- OpenSkill sports sit
  // around mu 25 / sigma 8.3, Glicko-2 sports around rating 1500 / RD 350
  // -- rather than one fixed scale for every sport.
  // ---------------------------------------------------------------------
  const ratingSeeds: {
    userId: string;
    sportId: string;
    mu: number;
    sigma: number;
  }[] = [
    // Glicko-2: Table Tennis
    { userId: alice.id, sportId: tableTennis.id, mu: 1574, sigma: 155 },
    { userId: ben.id, sportId: tableTennis.id, mu: 1498, sigma: 172 },
    { userId: chloe.id, sportId: tableTennis.id, mu: 1421, sigma: 188 },
    { userId: emma.id, sportId: tableTennis.id, mu: 1591, sigma: 140 },

    // OpenSkill: Foosball
    { userId: alice.id, sportId: foosball.id, mu: 25.9, sigma: 7.2 },
    { userId: chloe.id, sportId: foosball.id, mu: 23.6, sigma: 7.8 },

    // Glicko-2: Billiards
    { userId: alice.id, sportId: billiards.id, mu: 1550, sigma: 210 },
    { userId: ben.id, sportId: billiards.id, mu: 1470, sigma: 225 },
  ];

  const ratingMap = new Map<string, { id: string; mu: number; sigma: number }>();
  for (const seed of ratingSeeds) {
    const rating = await prisma.playerRating.create({ data: seed });
    ratingMap.set(`${seed.userId}:${seed.sportId}`, rating);
  }

  function getRating(userId: string, sportId: string) {
    const key = `${userId}:${sportId}`;
    const existing = ratingMap.get(key);
    if (existing) return existing;

    const sport = Object.values(sports).find((s) => s.id === sportId)!;
    const defaultRating = getRatingEngine(sport.ratingAlgorithm).defaultRating;
    return { id: "", mu: defaultRating.mu, sigma: defaultRating.sigma };
  }

  // ---------------------------------------------------------------------
  // Matches with immutable ledger history. ratingDelta is expressed in
  // whatever scale the sport's algorithm uses (~0.3-0.7 for OpenSkill's
  // mu, ~15-30 for Glicko-2's rating points).
  // ---------------------------------------------------------------------
  type MatchSeed = {
    organizationId: string;
    sportId: string;
    status: MatchStatus;
    daysAgo: number;
    participants: {
      user: (typeof users)[number];
      team: string;
      score: number;
      outcome: MatchOutcome;
      ratingDelta: number;
    }[];
  };

  const matchSeeds: MatchSeed[] = [
    {
      organizationId: orgA.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 30,
      participants: [
        { user: alice, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 21 },
        { user: ben, team: "team_b", score: 7, outcome: MatchOutcome.LOSS, ratingDelta: -19 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 27,
      participants: [
        { user: ben, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 23 },
        { user: chloe, team: "team_b", score: 9, outcome: MatchOutcome.LOSS, ratingDelta: -20 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 22,
      participants: [
        { user: alice, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 18 },
        { user: chloe, team: "team_b", score: 4, outcome: MatchOutcome.LOSS, ratingDelta: -24 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: foosball.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 19,
      participants: [
        { user: alice, team: "team_a", score: 10, outcome: MatchOutcome.WIN, ratingDelta: 0.4 },
        { user: chloe, team: "team_b", score: 6, outcome: MatchOutcome.LOSS, ratingDelta: -0.4 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: billiards.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 12,
      participants: [
        { user: alice, team: "team_a", score: 5, outcome: MatchOutcome.WIN, ratingDelta: 19 },
        { user: ben, team: "team_b", score: 2, outcome: MatchOutcome.LOSS, ratingDelta: -21 },
      ],
    },
    {
      organizationId: orgB.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 8,
      participants: [
        { user: emma, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 12 },
        { user: ben, team: "team_b", score: 6, outcome: MatchOutcome.LOSS, ratingDelta: -13 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: tableTennis.id,
      status: MatchStatus.PENDING_CONFIRMATION,
      daysAgo: 1,
      participants: [
        { user: alice, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 0 },
        { user: ben, team: "team_b", score: 8, outcome: MatchOutcome.LOSS, ratingDelta: 0 },
      ],
    },
  ];

  for (const seed of matchSeeds) {
    const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000);
    const isFinished = seed.status === MatchStatus.COMPLETED;

    const match = await prisma.match.create({
      data: {
        organizationId: seed.organizationId,
        sportId: seed.sportId,
        status: seed.status,
        createdAt,
        approvalDeadline: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        finishedAt: isFinished ? new Date(createdAt.getTime() + 60 * 60 * 1000) : null,
      },
    });

    for (const p of seed.participants) {
      const current = getRating(p.user.id, seed.sportId);
      const muBefore = current.mu - p.ratingDelta;
      const sigmaBefore = current.sigma;

      await prisma.matchParticipant.create({
        data: {
          matchId: match.id,
          userId: p.user.id,
          teamIdentifier: p.team,
          score: p.score,
          outcome: p.outcome ?? null,
          muBefore,
          sigmaBefore,
          muAfter: isFinished ? current.mu : null,
          sigmaAfter: isFinished ? current.sigma : null,
        },
      });
    }
  }

  console.log("Seed complete:");
  console.log(`  Organizations: 2`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Sports: ${Object.keys(sports).length}`);
  console.log(`  Matches: ${matchSeeds.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
