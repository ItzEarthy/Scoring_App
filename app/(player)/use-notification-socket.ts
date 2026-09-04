"use client";

import { useRelaySocket } from "@/lib/realtime/use-relay-socket";

export type NotificationDTO = {
  id: string;
  type: "MATCH_STARTED" | "SCORE_NEEDS_CONFIRMATION" | "DISPUTE_RESOLVED";
  title: string;
  body: string;
  matchId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationMessage =
  | { type: "notification"; notification: NotificationDTO }
  | { type: "presence"; viewers: number };

/** Subscribes to the realtime relay for this user's personal notification feed. */
export function useNotificationSocket(
  userId: string,
  token: string,
  onNotification: (notification: NotificationDTO) => void
) {
  return useRelaySocket<NotificationMessage>("user", userId, token, (message) => {
    if (message.type === "notification") onNotification(message.notification);
  });
}
