"use client";

import { useRelaySocket } from "@/lib/realtime/use-relay-socket";

type QueueMessage = { type: "queue_changed" } | { type: "presence"; viewers: number };

/** Subscribes to the realtime relay for one org+sport's queue. */
export function useQueueSocket(
  organizationId: string,
  sportId: string,
  token: string,
  onQueueChanged: () => void
) {
  return useRelaySocket<QueueMessage>(
    "queue",
    `${organizationId}:${sportId}`,
    token,
    (message) => {
      if (message.type === "queue_changed") onQueueChanged();
    }
  );
}
