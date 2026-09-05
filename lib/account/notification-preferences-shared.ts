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
