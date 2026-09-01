"use server";

import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";
import { MatchStatus } from "@/app/generated/prisma/enums";
import { getRatingEngine } from "@/lib/matchmaking/rating-engines";
import { pickAvailableCourt } from "@/lib/matchmaking/assign-court";
import { CourtStatus } from "@/app/generated/prisma/enums";

export type AdminCreateMatchState = {
  status: "idle" | "error";
  message?: string;
};

export async function createAdminMatchAction(
  _prevState: AdminCreateMatchState,
  formData: FormData
): Promise<AdminCreateMatchState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in." };
  }

  const organizationId = formData.get("organizationId");
  const sportId = formData.get("sportId");
  const playerAId = formData.get("playerAId");
  const playerBId = formData.get("playerBId");

  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization." };
  }
  if (typeof sportId !== "string" || !sportId.trim()) {
    return { status: "error", message: "Choose a sport." };
  }
  if (typeof playerAId !== "string" || typeof playerBId !== "string" || !playerAId || !playerBId) {
    return { status: "error", message: "Choose two players." };
  }
  if (playerAId === playerBId) {
    return { status: "error", message: "Choose two different players." };
  }

  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
    return { status: "error", message: "Only organization admins can schedule matches." };
  }

  const [sport, orgSport, participantMembers] = await Promise.all([
    prisma.sport.findUnique({ where: { id: sportId }, select: { id: true, isActive: true, ratingAlgorithm: true } }),
    prisma.organizationSport.findUnique({
      where: { organizationId_sportId: { organizationId, sportId } },
      select: { id: true },
    }),
    prisma.organizationUser.findMany({
      where: { organizationId, userId: { in: [playerAId, playerBId] } },
      select: { userId: true },
    }),
  ]);

  if (!sport || !sport.isActive || !orgSport) {
    return { status: "error", message: "That sport isn't available." };
  }
  if (participantMembers.length !== 2) {
    return { status: "error", message: "Both players must be members of this organization." };
  }

  const engine = getRatingEngine(sport.ratingAlgorithm);
  const ratings = await prisma.playerRating.findMany({
    where: { organizationId, sportId, userId: { in: [playerAId, playerBId] }, isActive: true },
    select: { userId: true, mu: true, sigma: true },
  });

  const ratingFor = (id: string) => {
    const r = ratings.find((row: { userId: string; mu: number; sigma: number }) => row.userId === id);
    return { mu: r?.mu ?? engine.defaultRating.mu, sigma: r?.sigma ?? engine.defaultRating.sigma };
  };
  const a = ratingFor(playerAId);
  const b = ratingFor(playerBId);

  const match = await prisma.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        organizationId,
        sportId,
        status: MatchStatus.SCHEDULED,
        participants: {
          create: [
            { userId: playerAId, teamIdentifier: "team_a", muBefore: a.mu, sigmaBefore: a.sigma },
            { userId: playerBId, teamIdentifier: "team_b", muBefore: b.mu, sigmaBefore: b.sigma },
          ],
        },
      },
    });

    const court = await pickAvailableCourt(tx, organizationId, sportId);
    if (court) {
      await tx.court.update({ where: { id: court.id }, data: { status: CourtStatus.IN_USE } });
      await tx.match.update({ where: { id: created.id }, data: { courtId: court.id } });
    }

    return created;
  });

  redirect(`/matches/${match.id}`);
}
