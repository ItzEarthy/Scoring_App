"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";
import { getRatingEngine } from "@/lib/matchmaking/rating-engines";

export type OnboardingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const DEFAULT_PLATFORM_CONFIG = {
  match_mode: "queue",
  approval_mode: "player_mutual",
  auto_approve_hours: 24,
};

/**
 * Registers the player's initial sport picks by seeding a PlayerRating row
 * at each sport's engine-native default (mirrors prisma/seed.ts), so their
 * chosen sports show up on the dashboard immediately instead of waiting for
 * a first match to lazily create the row.
 */
export async function onboardingSelectSportsAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const userId = await getVerifiedUserId();
  if (!userId) return { status: "error", message: "You must be signed in." };

  const sportIds = formData.getAll("sportIds").filter((v): v is string => typeof v === "string");
  if (sportIds.length === 0) {
    return { status: "success" };
  }

  const sports = await prisma.sport.findMany({
    where: { id: { in: sportIds }, isActive: true },
    select: { id: true, ratingAlgorithm: true },
  });

  await Promise.all(
    sports.map((sport) => {
      const defaultRating = getRatingEngine(sport.ratingAlgorithm).defaultRating;
      return prisma.playerRating.upsert({
        where: { userId_sportId: { userId, sportId: sport.id } },
        update: {},
        create: {
          userId,
          sportId: sport.id,
          mu: defaultRating.mu,
          sigma: defaultRating.sigma,
        },
      });
    })
  );

  revalidatePath("/dashboard");
  return { status: "success" };
}

export async function onboardingCreateOrgAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const userId = await getVerifiedUserId();
  if (!userId) return { status: "error", message: "You must be signed in." };

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Enter an organization name." };
  }

  const activeSports = await prisma.sport.findMany({ where: { isActive: true }, select: { id: true } });

  await prisma.organization.create({
    data: {
      name: name.trim(),
      platformConfig: DEFAULT_PLATFORM_CONFIG,
      organizationUsers: { create: { userId, role: Role.OWNER } },
      organizationSports: { create: activeSports.map((sport) => ({ sportId: sport.id })) },
    },
  });

  revalidatePath("/orgs");
  return { status: "success", message: "Organization created." };
}

export async function onboardingJoinOrgAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const userId = await getVerifiedUserId();
  if (!userId) return { status: "error", message: "You must be signed in." };

  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Choose an organization to join." };
  }

  const existing = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!existing) {
    await prisma.organizationUser.create({
      data: { userId, organizationId, role: Role.MEMBER },
    });
  }

  revalidatePath("/orgs");
  return { status: "success", message: "Joined organization." };
}

export async function completeOnboardingAction(): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  });

  redirect("/dashboard");
}
