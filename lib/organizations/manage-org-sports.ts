"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

export type ToggleOrgSportState = {
  status: "idle" | "error";
  message?: string;
};

export async function toggleOrgSportAction(
  _prevState: ToggleOrgSportState,
  formData: FormData
): Promise<ToggleOrgSportState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in." };
  }

  const organizationId = formData.get("organizationId");
  const sportId = formData.get("sportId");
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }
  if (typeof sportId !== "string" || !sportId.trim()) {
    return { status: "error", message: "Missing sport reference." };
  }

  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
    return { status: "error", message: "Only organization admins can change enabled sports." };
  }

  const existing = await prisma.organizationSport.findUnique({
    where: { organizationId_sportId: { organizationId, sportId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.organizationSport.delete({ where: { id: existing.id } });
  } else {
    await prisma.organizationSport.create({ data: { organizationId, sportId } });
  }

  revalidatePath(`/orgs/${organizationId}/settings`);
  return { status: "idle" };
}
