import "dotenv/config";
import { PrismaClient, Role, MatchStatus, MatchOutcome } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_MU = 25.0;
const DEFAULT_SIGMA = 8.333;

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // ---------------------------------------------------------------------
  // Sports
  // ---------------------------------------------------------------------
  const tableTennis = await prisma.sport.upsert({
    where: { name: "Table Tennis" },
    update: {},
    create: {
      name: "Table Tennis",
      ratingAlgorithm: "trueskill",
      defaultRules: { bestOf: 5, pointsToWin: 11 },
    },
  });

  const chess = await prisma.sport.upsert({
    where: { name: "Chess" },
    update: {},
    create: {
      name: "Chess",
      ratingAlgorithm: "glicko2",
      defaultRules: { timeControl: "10+5" },
    },
  });

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
    { name: "Chloe Ramirez", email: "chloe@example.com" },
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
  // Player ratings (seed starting points; some pre-advanced for history)
  // ---------------------------------------------------------------------
  const ratingSeeds: { userId: string; organizationId: string; sportId: string; mu: number; sigma: number }[] = [
    { userId: alice.id, organizationId: orgA.id, sportId: tableTennis.id, mu: 27.4, sigma: 6.1 },
    { userId: ben.id, organizationId: orgA.id, sportId: tableTennis.id, mu: 24.8, sigma: 6.9 },
    { userId: chloe.id, organizationId: orgA.id, sportId: tableTennis.id, mu: 22.1, sigma: 7.5 },
    { userId: derek.id, organizationId: orgA.id, sportId: chess.id, mu: 26.0, sigma: 5.8 },
    { userId: emma.id, organizationId: orgA.id, sportId: chess.id, mu: 23.5, sigma: 7.0 },
    { userId: ben.id, organizationId: orgB.id, sportId: chess.id, mu: 25.9, sigma: 6.4 },
    { userId: derek.id, organizationId: orgB.id, sportId: chess.id, mu: 24.2, sigma: 6.8 },
    { userId: emma.id, organizationId: orgB.id, sportId: tableTennis.id, mu: 28.1, sigma: 5.2 },
  ];

  const ratingMap = new Map<string, { id: string; mu: number; sigma: number }>();
  for (const seed of ratingSeeds) {
    const rating = await prisma.playerRating.create({ data: seed });
    ratingMap.set(`${seed.userId}:${seed.organizationId}:${seed.sportId}`, rating);
  }

  function getRating(userId: string, organizationId: string, sportId: string) {
    const key = `${userId}:${organizationId}:${sportId}`;
    return (
      ratingMap.get(key) ?? { id: "", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA }
    );
  }

  // ---------------------------------------------------------------------
  // Matches with immutable ledger history
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
      sportId: chess.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 20,
      participants: [
        { user: derek, team: "team_a", score: 1, outcome: MatchOutcome.WIN, ratingDelta: 0.4 },
        { user: emma, team: "team_b", score: 0, outcome: MatchOutcome.LOSS, ratingDelta: -0.4 },
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
      organizationId: orgB.id,
      sportId: chess.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 18,
      participants: [
        { user: ben, team: "team_a", score: 1, outcome: MatchOutcome.WIN, ratingDelta: 0.5 },
        { user: derek, team: "team_b", score: 0, outcome: MatchOutcome.LOSS, ratingDelta: -0.5 },
      ],
    },
    {
      organizationId: orgB.id,
      sportId: chess.id,
      status: MatchStatus.COMPLETED,
      daysAgo: 10,
      participants: [
        { user: derek, team: "team_a", score: 1, outcome: MatchOutcome.WIN, ratingDelta: 0.6 },
        { user: ben, team: "team_b", score: 0, outcome: MatchOutcome.LOSS, ratingDelta: -0.6 },
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
  console.log(`  Sports: 2`);
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
