import { prisma } from "@/lib/prisma";
import { publishUserEvent } from "@/lib/realtime/publish";
import { sendPushNotification } from "@/lib/notifications/push";
import { resolveNotificationPreferences } from "@/lib/account/notification-preferences";
import type { NotificationType } from "@/app/generated/prisma/enums";

export type NotifyPayload = {
  type: NotificationType;
  title: string;
  body: string;
  organizationId: string;
  matchId?: string;
};

/**
 * Writes a Notification row per recipient (source of truth), then
 * fans it out for live delivery: an in-app event over the realtime relay,
 * and a real OS push notification to any subscribed devices. The realtime
 * and push legs are best-effort -- a client that misses the live event still
 * sees the notification on its next load from the DB, so neither is allowed
 * to throw back into the caller (a Server Action that just committed a
 * Postgres write).
 */
export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  const uniqueUserIds = [...new Set(userIds)];

  const recipients = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, notificationPreferences: true },
  });
  const optedIn = recipients
    .filter((r) => resolveNotificationPreferences(r.notificationPreferences)[payload.type])
    .map((r) => r.id);

  await Promise.all(
    optedIn.map(async (userId) => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          organizationId: payload.organizationId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          matchId: payload.matchId,
        },
      });

      await publishUserEvent(userId, { type: "notification", notification });
      await sendPushNotification(userId, {
        title: payload.title,
        body: payload.body,
        matchId: payload.matchId,
        notificationId: notification.id,
      });
    })
  );
}
