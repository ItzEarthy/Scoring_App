"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedSiteAdminUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export type SportFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

// Matches the two engines actually implemented in lib/matchmaking/rating-engines --
// getRatingEngine() silently falls back to OpenSkill on anything else, so this form
// must not allow a typo/unsupported value through as if it were valid.
const RATING_ALGORITHMS = new Set(["openskill", "glicko2"]);

type ParsedSportFields = {
  name: string;
  ratingAlgorithm: string;
  defaultRules: object;
  minTeamSize: number;
  maxTeamSize: number | null;
};

function parseSportFields(formData: FormData): ParsedSportFields | { error: string } {
  const name = formData.get("name");
  const ratingAlgorithm = formData.get("ratingAlgorithm");
  const defaultRulesRaw = formData.get("defaultRules");
  const minTeamSizeRaw = formData.get("minTeamSize");
  const maxTeamSizeRaw = formData.get("maxTeamSize");

  if (typeof name !== "string" || !name.trim()) {
    return { error: "Enter a sport name." };
  }
  if (typeof ratingAlgorithm !== "string" || !RATING_ALGORITHMS.has(ratingAlgorithm)) {
    return { error: "Choose a valid rating algorithm." };
  }
  if (typeof defaultRulesRaw !== "string") {
    return { error: "Missing default rules." };
  }

  let defaultRules: object;
  try {
    const parsed = JSON.parse(defaultRulesRaw.trim() || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "Default rules must be a JSON object, e.g. {\"bestOf\": 5}." };
    }
    defaultRules = parsed;
  } catch {
    return { error: "Default rules must be valid JSON." };
  }

  const minTeamSize = typeof minTeamSizeRaw === "string" && minTeamSizeRaw.trim() !== "" ? Number(minTeamSizeRaw) : 1;
  if (!Number.isInteger(minTeamSize) || minTeamSize < 1) {
    return { error: "Minimum team size must be a whole number of at least 1." };
  }

  let maxTeamSize: number | null = null;
  if (typeof maxTeamSizeRaw === "string" && maxTeamSizeRaw.trim() !== "") {
    const parsedMax = Number(maxTeamSizeRaw);
    if (!Number.isInteger(parsedMax) || parsedMax < minTeamSize) {
      return { error: "Maximum team size must be a whole number at least as large as the minimum (or left blank for no maximum)." };
    }
    maxTeamSize = parsedMax;
  }

  if (ratingAlgorithm === "glicko2" && (maxTeamSize == null || maxTeamSize > 2)) {
    return { error: "Glicko-2 only supports singles or doubles -- set a maximum team size of 1 or 2." };
  }

  return { name: name.trim(), ratingAlgorithm, defaultRules, minTeamSize, maxTeamSize };
}

export async function createSportAction(
  _prevState: SportFormState,
  formData: FormData
): Promise<SportFormState> {
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) {
    return { status: "error", message: "Only site admins can manage the sports catalog." };
  }

  const parsed = parseSportFields(formData);
  if ("error" in parsed) {
    return { status: "error", message: parsed.error };
  }

  try {
    await prisma.sport.create({
      data: {
        name: parsed.name,
        ratingAlgorithm: parsed.ratingAlgorithm,
        defaultRules: parsed.defaultRules,
        minTeamSize: parsed.minTeamSize,
        maxTeamSize: parsed.maxTeamSize,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "error", message: "A sport with this name already exists." };
    }
    throw err;
  }

  revalidatePath("/admin/sports");
  return { status: "success", message: "Sport created." };
}

export async function updateSportAction(
  _prevState: SportFormState,
  formData: FormData
): Promise<SportFormState> {
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) {
    return { status: "error", message: "Only site admins can manage the sports catalog." };
  }

  const sportId = formData.get("sportId");
  if (typeof sportId !== "string" || !sportId.trim()) {
    return { status: "error", message: "Missing sport reference." };
  }

  const parsed = parseSportFields(formData);
  if ("error" in parsed) {
    return { status: "error", message: parsed.error };
  }

  try {
    await prisma.sport.update({
      where: { id: sportId },
      data: {
        name: parsed.name,
        ratingAlgorithm: parsed.ratingAlgorithm,
        defaultRules: parsed.defaultRules,
        minTeamSize: parsed.minTeamSize,
        maxTeamSize: parsed.maxTeamSize,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "error", message: "A sport with this name already exists." };
    }
    throw err;
  }

  revalidatePath("/admin/sports");
  revalidatePath(`/admin/sports/${sportId}`);
  return { status: "success", message: "Sport updated." };
}

export async function toggleSportActiveAction(
  _prevState: SportFormState,
  formData: FormData
): Promise<SportFormState> {
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) {
    return { status: "error", message: "Only site admins can manage the sports catalog." };
  }

  const sportId = formData.get("sportId");
  if (typeof sportId !== "string" || !sportId.trim()) {
    return { status: "error", message: "Missing sport reference." };
  }

  const sport = await prisma.sport.findUnique({ where: { id: sportId }, select: { isActive: true } });
  if (!sport) {
    return { status: "error", message: "Sport not found." };
  }

  await prisma.sport.update({
    where: { id: sportId },
    data: { isActive: !sport.isActive },
  });

  revalidatePath("/admin/sports");
  revalidatePath(`/admin/sports/${sportId}`);
  return {
    status: "success",
    message: sport.isActive ? "Sport deactivated." : "Sport reactivated.",
  };
}
