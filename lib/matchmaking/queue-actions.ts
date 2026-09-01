"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QueueStatus } from "@/app/generated/prisma/enums";
import { formMatchesFromQueue } from "./form-matches";

export type QueueActionState = {
  status: "idle" | "error";
  message?: string;
};

export async function joinQueueAction(
  _prevState: QueueActionState,
  formData: FormData
): Promise<QueueActionState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in to join the queue." };
  }

  const organizationId = formData.get("organizationId");
  const sportId = formData.get("sportId");
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization." };
  }
  if (typeof sportId !== "string" || !sportId.trim()) {
    return { status: "error", message: "Choose a sport to queue for." };
  }

  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership) {
    return { status: "error", message: "You must be a member of this organization to queue." };
  }

  const [sport, orgSport] = await Promise.all([
    prisma.sport.findUnique({ where: { id: sportId }, select: { isActive: true, minTeamSize: true } }),
    prisma.organizationSport.findUnique({
      where: { organizationId_sportId: { organizationId, sportId } },
      select: { id: true },
    }),
  ]);
  if (!sport || !sport.isActive || !orgSport) {
    return { status: "error", message: "That sport isn't available for this organization." };
  }
  if (sport.minTeamSize > 2) {
    return {
      status: "error",
      message: "This sport requires admin-scheduled matches -- ask an org admin to create one.",
    };
  }

  try {
    await prisma.queueEntry.create({
      data: { userId, organizationId, sportId, status: QueueStatus.WAITING },
    });
  } catch {
    return { status: "error", message: "You're already in the queue for this sport." };
  }

  await formMatchesFromQueue(organizationId, sportId);

  revalidatePath(`/orgs/${organizationId}/queue`);
  return { status: "idle" };
}

export async function leaveQueueAction(formData: FormData) {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  const organizationId = formData.get("organizationId");
  const sportId = formData.get("sportId");
  if (typeof organizationId !== "string" || typeof sportId !== "string") return;

  await prisma.queueEntry.updateMany({
    where: {
      userId,
      organizationId,
      sportId,
      status: QueueStatus.WAITING,
    },
    data: { status: QueueStatus.CANCELED },
  });

  revalidatePath(`/orgs/${organizationId}/queue`);
}
