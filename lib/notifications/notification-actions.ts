"use server";

import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RECENT_NOTIFICATIONS_LIMIT = 20;

export async function getRecentNotificationsAction() {
  const userId = await getVerifiedUserId();
  if (!userId) return [];

  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: RECENT_NOTIFICATIONS_LIMIT,
  });
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
