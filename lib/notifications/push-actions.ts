"use server";

import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribeToPushAction(subscription: PushSubscriptionJSON): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) return;

  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint: subscription.endpoint } },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}
