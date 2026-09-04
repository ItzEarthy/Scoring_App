import webPush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Sends a real OS-level push notification to every device the user has
 * subscribed from. Best-effort, same contract as publishUserEvent: a failed
 * send never throws back into the caller (the Notification row already
 * written to Postgres is the source of truth). A subscription the browser
 * has revoked (404/410 from the push service) is deleted so future sends
 * don't keep retrying it.
 */
export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; matchId?: string; notificationId: string }
): Promise<void> {
  if (!ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    matchId: payload.matchId,
    notificationId: payload.notificationId,
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
        } else {
          console.error("Failed to send push notification", error);
        }
      }
    })
  );
}
