"use client";

import { useEffect, useRef, useState } from "react";

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

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

/**
 * Subscribes to the realtime relay for one match. Writes (score changes)
 * always go through Server Actions -- this socket is read-only fan-out, so a
 * dropped connection never risks losing a write, only delays seeing someone
 * else's. Score updates are pushed to `onScoreUpdate` (called from the
 * socket's message handler, not the effect body) so the caller owns how they
 * get merged into its own state.
 */
export function useLiveMatchSocket(
  matchId: string,
  token: string,
  onScoreUpdate: (update: LiveScoreUpdate) => void
) {
  const wsBase = process.env.NEXT_PUBLIC_WS_URL;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    wsBase ? "connecting" : "closed"
  );
  const [viewers, setViewers] = useState(1);
  const attemptRef = useRef(0);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
  });

  useEffect(() => {
    if (!wsBase) return;
    const base = wsBase;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setConnectionState((prev) => (prev === "open" ? prev : "connecting"));

      const url = new URL(base.replace(/^http/, "ws") + "/ws");
      url.searchParams.set("matchId", matchId);
      url.searchParams.set("token", token);
      socket = new WebSocket(url);

      socket.onopen = () => {
        attemptRef.current = 0;
        setConnectionState("open");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as LiveMatchMessage;
          if (message.type === "presence") setViewers(message.viewers);
          if (message.type === "score_update") onScoreUpdateRef.current(message);
        } catch {
          // Ignore malformed frames rather than tearing down the socket.
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        setConnectionState("reconnecting");
        const delay =
          RECONNECT_DELAYS_MS[Math.min(attemptRef.current, RECONNECT_DELAYS_MS.length - 1)];
        attemptRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [matchId, token, wsBase]);

  return { connectionState, viewers };
}
