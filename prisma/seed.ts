import "dotenv/config";
import { PrismaClient, Role, MatchStatus, MatchOutcome } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";
import { getRatingEngine } from "../lib/matchmaking/rating-engines";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // ---------------------------------------------------------------------
  // Sports -- each rating algorithm gets more than one sport so the
  // matchmaking queue and score-reporting flow exercise both engines.
  // ---------------------------------------------------------------------
  const tableTennis = await prisma.sport.upsert({
    where: { name: "Table Tennis" },
    update: {},
    create: {
      name: "Table Tennis",
      ratingAlgorithm: "openskill",
      defaultRules: { bestOf: 5, pointsToWin: 11, winBy: 2 },
    },
  });

  const foosball = await prisma.sport.upsert({
    where: { name: "Foosball" },
    update: {},
    create: {
      name: "Foosball",
      ratingAlgorithm: "openskill",
      defaultRules: { pointsToWin: 10, winBy: 2, doublesAllowed: true },
    },
  });

  const oneOnOneBasketball = await prisma.sport.upsert({
    where: { name: "1-on-1 Basketball" },
    update: {},
    create: {
      name: "1-on-1 Basketball",
      ratingAlgorithm: "openskill",
      defaultRules: { pointsToWin: 21, winBy: 2, shotClockSeconds: 24 },
    },
  });

  const chess = await prisma.sport.upsert({
    where: { name: "Chess" },
    update: {},
    create: {
      name: "Chess",
      ratingAlgorithm: "glicko2",
      defaultRules: { timeControl: "10+5", ratingPeriodDays: 7 },
    },
  });

  const billiards = await prisma.sport.upsert({
    where: { name: "Billiards" },
    update: {},
    create: {
      name: "Billiards",
      ratingAlgorithm: "glicko2",
      defaultRules: { gameType: "8-ball", raceTo: 5, ratingPeriodDays: 7 },
    },
  });

  const sports = { tableTennis, foosball, oneOnOneBasketball, chess, billiards };

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
  // Values are scaled to whichever algorithm the sport uses -- OpenSkill
  // sports sit around mu 25 / sigma 8.3, Glicko-2 sports around rating
  // 1500 / RD 350 -- rather than one fixed scale for every sport.
  // ---------------------------------------------------------------------
  const ratingSeeds: {
    userId: string;
    organizationId: string;
    sportId: string;
    mu: number;
    sigma: number;
  }[] = [
    // OpenSkill: Table Tennis
    { userId: alice.id, organizationId: orgA.id, sportId: tableTennis.id, mu: 27.4, sigma: 6.1 },
    { userId: ben.id, organizationId: orgA.id, sportId: tableTennis.id, mu: 24.8, sigma: 6.9 },
    { userId: chloe.id, organizationId: orgA.id, sportId: tableTennis.id, mu: 22.1, sigma: 7.5 },
    { userId: emma.id, organizationId: orgB.id, sportId: tableTennis.id, mu: 28.1, sigma: 5.2 },

    // OpenSkill: Foosball
    { userId: alice.id, organizationId: orgA.id, sportId: foosball.id, mu: 25.9, sigma: 7.2 },
    { userId: chloe.id, organizationId: orgA.id, sportId: foosball.id, mu: 23.6, sigma: 7.8 },

    // OpenSkill: 1-on-1 Basketball
    { userId: ben.id, organizationId: orgB.id, sportId: oneOnOneBasketball.id, mu: 26.3, sigma: 6.5 },
    { userId: derek.id, organizationId: orgB.id, sportId: oneOnOneBasketball.id, mu: 24.0, sigma: 7.1 },

    // Glicko-2: Chess (rating/RD scale, not OpenSkill's mu/sigma scale)
    { userId: derek.id, organizationId: orgA.id, sportId: chess.id, mu: 1612, sigma: 145 },
    { userId: emma.id, organizationId: orgA.id, sportId: chess.id, mu: 1487, sigma: 190 },
    { userId: ben.id, organizationId: orgB.id, sportId: chess.id, mu: 1598, sigma: 168 },
    { userId: derek.id, organizationId: orgB.id, sportId: chess.id, mu: 1523, sigma: 176 },

    // Glicko-2: Billiards
    { userId: alice.id, organizationId: orgA.id, sportId: billiards.id, mu: 1550, sigma: 210 },
    { userId: ben.id, organizationId: orgA.id, sportId: billiards.id, mu: 1470, sigma: 225 },
  ];

  const ratingMap = new Map<string, { id: string; mu: number; sigma: number }>();
  for (const seed of ratingSeeds) {
    const rating = await prisma.playerRating.create({ data: seed });
    ratingMap.set(`${seed.userId}:${seed.organizationId}:${seed.sportId}`, rating);
  }

  function getRating(userId: string, organizationId: string, sportId: string) {
    const key = `${userId}:${organizationId}:${sportId}`;
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
        { user: alice, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 0.6 },
        { user: ben, team: "team_b", score: 7, outcome: MatchOutcome.LOSS, ratingDelta: -0.5 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 27,
      participants: [
        { user: ben, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 0.7 },
        { user: chloe, team: "team_b", score: 9, outcome: MatchOutcome.LOSS, ratingDelta: -0.6 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 22,
      participants: [
        { user: alice, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 0.5 },
        { user: chloe, team: "team_b", score: 4, outcome: MatchOutcome.LOSS, ratingDelta: -0.7 },
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
      sportId: chess.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 20,
      participants: [
        { user: derek, team: "team_a", score: 1, outcome: MatchOutcome.WIN, ratingDelta: 22 },
        { user: emma, team: "team_b", score: 0, outcome: MatchOutcome.LOSS, ratingDelta: -18 },
      ],
    },
    {
      organizationId: orgA.id,
      sportId: chess.id,
      status: MatchStatus.DISPUTED,
      daysAgo: 15,
      participants: [
        { user: emma, team: "team_a", score: 0, outcome: MatchOutcome.DRAW, ratingDelta: 0 },
        { user: derek, team: "team_b", score: 0, outcome: MatchOutcome.DRAW, ratingDelta: 0 },
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
      sportId: chess.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 18,
      participants: [
        { user: ben, team: "team_a", score: 1, outcome: MatchOutcome.WIN, ratingDelta: 20 },
        { user: derek, team: "team_b", score: 0, outcome: MatchOutcome.LOSS, ratingDelta: -19 },
      ],
    },
    {
      organizationId: orgB.id,
      sportId: chess.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 10,
      participants: [
        { user: derek, team: "team_a", score: 1, outcome: MatchOutcome.WIN, ratingDelta: 24 },
        { user: ben, team: "team_b", score: 0, outcome: MatchOutcome.LOSS, ratingDelta: -23 },
      ],
    },
    {
      organizationId: orgB.id,
      sportId: oneOnOneBasketball.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 9,
      participants: [
        { user: ben, team: "team_a", score: 21, outcome: MatchOutcome.WIN, ratingDelta: 0.5 },
        { user: derek, team: "team_b", score: 17, outcome: MatchOutcome.LOSS, ratingDelta: -0.5 },
      ],
    },
    {
      organizationId: orgB.id,
      sportId: tableTennis.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 8,
      participants: [
        { user: emma, team: "team_a", score: 11, outcome: MatchOutcome.WIN, ratingDelta: 0.3 },
        { user: ben, team: "team_b", score: 6, outcome: MatchOutcome.LOSS, ratingDelta: -0.3 },
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
    {
      organizationId: orgB.id,
      sportId: chess.id,
      status: MatchStatus.SCHEDULED,
      daysAgo: 0,
      participants: [
        { user: ben, team: "team_a", score: 0, outcome: null as unknown as MatchOutcome, ratingDelta: 0 },
        { user: derek, team: "team_b", score: 0, outcome: null as unknown as MatchOutcome, ratingDelta: 0 },
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
      const current = getRating(p.user.id, seed.organizationId, seed.sportId);
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
