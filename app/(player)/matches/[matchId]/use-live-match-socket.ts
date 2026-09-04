"use client";

import { useState } from "react";
import { useRelaySocket } from "@/lib/realtime/use-relay-socket";

export type LiveScoreUpdate = {
  type: "score_update";
  status: string;
  scores: Record<string, number>;
};

type PresenceUpdate = {
  type: "presence";
  viewers: number;
};

type LiveMatchMessage = LiveScoreUpdate | PresenceUpdate;

export type { ConnectionState } from "@/lib/realtime/use-relay-socket";

/**
 * Subscribes to the realtime relay for one match's score updates and
 * viewer presence. Score updates are pushed to `onScoreUpdate` so the caller
 * owns how they get merged into its own state.
 */
export function useLiveMatchSocket(
  matchId: string,
  token: string,
  onScoreUpdate: (update: LiveScoreUpdate) => void
) {
  const [viewers, setViewers] = useState(1);

  const { connectionState } = useRelaySocket<LiveMatchMessage>(
    "match",
    matchId,
    token,
    (message) => {
      if (message.type === "presence") setViewers(message.viewers);
      if (message.type === "score_update") onScoreUpdate(message);
    }
  );

  return { connectionState, viewers };
}
