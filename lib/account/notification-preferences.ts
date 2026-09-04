"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/app/generated/prisma/enums";

export type NotificationPreferences = Record<NotificationType, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  [NotificationType.MATCH_STARTED]: true,
  [NotificationType.SCORE_NEEDS_CONFIRMATION]: true,
  [NotificationType.DISPUTE_RESOLVED]: true,
};

export function resolveNotificationPreferences(stored: unknown): NotificationPreferences {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const record = stored as Record<string, unknown>;
  return {
    [NotificationType.MATCH_STARTED]:
      record[NotificationType.MATCH_STARTED] !== false,
    [NotificationType.SCORE_NEEDS_CONFIRMATION]:
      record[NotificationType.SCORE_NEEDS_CONFIRMATION] !== false,
    [NotificationType.DISPUTE_RESOLVED]:
      record[NotificationType.DISPUTE_RESOLVED] !== false,
  };
}

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
