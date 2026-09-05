"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/app/generated/prisma/enums";
import type { NotificationPreferences } from "@/lib/account/notification-preferences-shared";

export type UpdateNotificationPreferencesState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function updateNotificationPreferencesAction(
  _prevState: UpdateNotificationPreferencesState,
  formData: FormData
): Promise<UpdateNotificationPreferencesState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in to update notification preferences." };
  }

  const preferences: NotificationPreferences = {
    [NotificationType.MATCH_STARTED]: formData.get("MATCH_STARTED") === "on",
    [NotificationType.SCORE_NEEDS_CONFIRMATION]: formData.get("SCORE_NEEDS_CONFIRMATION") === "on",
    [NotificationType.DISPUTE_RESOLVED]: formData.get("DISPUTE_RESOLVED") === "on",
  };

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: preferences },
  });

  revalidatePath("/settings");
  return { status: "success", message: "Notification preferences saved." };
}
