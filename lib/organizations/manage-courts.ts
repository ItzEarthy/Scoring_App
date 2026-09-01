"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";
import { CourtStatus, Prisma } from "@/app/generated/prisma/client";

export type CourtFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const COURT_STATUSES = new Set(["AVAILABLE", "IN_USE", "DISABLED"]);

// Sentinel the "Any sport" option posts, mirrored from courts-settings-form.tsx
// -- Select items can't carry an empty-string value, so this stands in for null.
const ANY_SPORT = "__any__";

function normalizeSportId(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw.trim() || raw === ANY_SPORT) return null;
  return raw;
}

async function requireOrgAdmin(organizationId: string) {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { error: "You must be signed in." } as const;
  }
  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
    return { error: "Only organization admins can manage courts." } as const;
  }
  return { userId } as const;
}

export async function createCourtAction(
  _prevState: CourtFormState,
  formData: FormData
): Promise<CourtFormState> {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }

  const auth = await requireOrgAdmin(organizationId);
  if ("error" in auth) {
    return { status: "error", message: auth.error };
  }

  const name = formData.get("name");
  const sportId = formData.get("sportId");
  const statusRaw = formData.get("status");

  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Enter a court name." };
  }
  const status = typeof statusRaw === "string" && COURT_STATUSES.has(statusRaw) ? statusRaw : "AVAILABLE";

  try {
    const maxOrder = await prisma.court.aggregate({
      where: { organizationId },
      _max: { displayOrder: true },
    });

    await prisma.court.create({
      data: {
        organizationId,
        name: name.trim(),
        sportId: normalizeSportId(sportId),
        status: status as CourtStatus,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "error", message: "A court with this name already exists." };
    }
    throw err;
  }

  revalidatePath(`/orgs/${organizationId}/settings`);
  return { status: "success", message: "Court added." };
}

// Used by auto-submitting selects (sport/status) in courts-settings-form.tsx,
// which don't run through useActionState -- plain FormData-in, void-out, like
// deleteCourtAction/moveCourtAction below, so it can be passed directly as a
// <form action>.
export async function updateCourtAction(formData: FormData): Promise<void> {
  const organizationId = formData.get("organizationId");
  const courtId = formData.get("courtId");
  if (typeof organizationId !== "string" || typeof courtId !== "string" || !organizationId.trim() || !courtId.trim()) {
    return;
  }

  const auth = await requireOrgAdmin(organizationId);
  if ("error" in auth) return;

  const name = formData.get("name");
  const sportId = formData.get("sportId");
  const statusRaw = formData.get("status");

  const data: { name?: string; sportId?: string | null; status?: CourtStatus } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (sportId !== null) data.sportId = normalizeSportId(sportId);
  if (typeof statusRaw === "string" && COURT_STATUSES.has(statusRaw)) {
    data.status = statusRaw as CourtStatus;
  }

  try {
    await prisma.court.updateMany({
      where: { id: courtId, organizationId },
      data,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }

  revalidatePath(`/orgs/${organizationId}/settings`);
}

export async function deleteCourtAction(formData: FormData): Promise<void> {
  const organizationId = formData.get("organizationId");
  const courtId = formData.get("courtId");
  if (typeof organizationId !== "string" || typeof courtId !== "string") return;

  const auth = await requireOrgAdmin(organizationId);
  if ("error" in auth) return;

  await prisma.court.deleteMany({ where: { id: courtId, organizationId } });
  revalidatePath(`/orgs/${organizationId}/settings`);
}

export async function moveCourtAction(formData: FormData): Promise<void> {
  const organizationId = formData.get("organizationId");
  const courtId = formData.get("courtId");
  const direction = formData.get("direction");
  if (
    typeof organizationId !== "string" ||
    typeof courtId !== "string" ||
    (direction !== "up" && direction !== "down")
  ) {
    return;
  }

  const auth = await requireOrgAdmin(organizationId);
  if ("error" in auth) return;

  const courts = await prisma.court.findMany({
    where: { organizationId },
    orderBy: { displayOrder: "asc" },
    select: { id: true, displayOrder: true },
  });

  const index = courts.findIndex((c) => c.id === courtId);
  if (index === -1) return;

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= courts.length) return;

  const current = courts[index];
  const neighbor = courts[neighborIndex];

  await prisma.$transaction([
    prisma.court.update({ where: { id: current.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.court.update({ where: { id: neighbor.id }, data: { displayOrder: current.displayOrder } }),
  ]);

  revalidatePath(`/orgs/${organizationId}/settings`);
}
