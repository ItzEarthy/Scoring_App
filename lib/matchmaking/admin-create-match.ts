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
  const teamA = formData.getAll("teamA[]").filter((v): v is string => typeof v === "string" && v.trim() !== "");
  const teamB = formData.getAll("teamB[]").filter((v): v is string => typeof v === "string" && v.trim() !== "");

  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization." };
  }
  if (typeof sportId !== "string" || !sportId.trim()) {
    return { status: "error", message: "Choose a sport." };
  }
  if (teamA.length === 0 || teamB.length === 0) {
    return { status: "error", message: "Both teams need at least one player." };
  }

  const allPlayerIds = [...teamA, ...teamB];
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    return { status: "error", message: "A player can't be on both teams (or listed twice)." };
  }

  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
    return { status: "error", message: "Only organization admins can schedule matches." };
  }

  const [sport, orgSport, participantMembers] = await Promise.all([
    prisma.sport.findUnique({
      where: { id: sportId },
      select: { id: true, isActive: true, ratingAlgorithm: true, minTeamSize: true, maxTeamSize: true },
    }),
    prisma.organizationSport.findUnique({
      where: { organizationId_sportId: { organizationId, sportId } },
      select: { id: true },
    }),
    prisma.organizationUser.findMany({
      where: { organizationId, userId: { in: allPlayerIds } },
      select: { userId: true },
    }),
  ]);

  if (!sport || !sport.isActive || !orgSport) {
    return { status: "error", message: "That sport isn't available." };
  }
  if (participantMembers.length !== allPlayerIds.length) {
    return { status: "error", message: "All players must be members of this organization." };
  }

  const maxTeamSize = sport.maxTeamSize ?? Infinity;
  if (teamA.length < sport.minTeamSize || teamA.length > maxTeamSize) {
    return {
      status: "error",
      message: `Team A needs ${
        sport.minTeamSize === maxTeamSize ? `exactly ${sport.minTeamSize}` : `at least ${sport.minTeamSize}`
      } player(s) for this sport.`,
    };
  }
  if (teamB.length < sport.minTeamSize || teamB.length > maxTeamSize) {
    return {
      status: "error",
      message: `Team B needs ${
        sport.minTeamSize === maxTeamSize ? `exactly ${sport.minTeamSize}` : `at least ${sport.minTeamSize}`
      } player(s) for this sport.`,
    };
  }

  const engine = getRatingEngine(sport.ratingAlgorithm);
  const ratings = await prisma.playerRating.findMany({
    where: { sportId, userId: { in: allPlayerIds }, isActive: true },
    select: { userId: true, mu: true, sigma: true },
  });

  const ratingFor = (id: string) => {
    const r = ratings.find((row: { userId: string; mu: number; sigma: number }) => row.userId === id);
    return { mu: r?.mu ?? engine.defaultRating.mu, sigma: r?.sigma ?? engine.defaultRating.sigma };
  };

  const match = await prisma.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        organizationId,
        sportId,
        status: MatchStatus.SCHEDULED,
        participants: {
          create: [
            ...teamA.map((id) => {
              const r = ratingFor(id);
              return { userId: id, teamIdentifier: "team_a", muBefore: r.mu, sigmaBefore: r.sigma };
            }),
            ...teamB.map((id) => {
              const r = ratingFor(id);
              return { userId: id, teamIdentifier: "team_b", muBefore: r.mu, sigmaBefore: r.sigma };
            }),
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
