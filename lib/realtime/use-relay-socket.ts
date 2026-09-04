"use client";

import { useEffect, useRef, useState } from "react";
import type { RelayChannel } from "./token";

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

/**
 * Subscribes to one room on the realtime relay (channel + resourceId).
 * Writes always go through Server Actions -- this socket is read-only
 * fan-out, so a dropped connection never risks losing a write, only delays
 * seeing someone else's. Every message the relay sends (including its own
 * `{type: "presence", viewers}` frames) is passed to `onMessage`, called from
 * the socket's message handler, not the effect body, so the caller owns how
 * messages get merged into its own state.
 */
export function useRelaySocket<TMessage>(
  channel: RelayChannel,
  resourceId: string,
  token: string,
  onMessage: (message: TMessage) => void
) {
  const wsBase = process.env.NEXT_PUBLIC_WS_URL;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    wsBase ? "connecting" : "closed"
  );
  const attemptRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
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
      url.searchParams.set("channel", channel);
      url.searchParams.set("resourceId", resourceId);
      url.searchParams.set("token", token);
      socket = new WebSocket(url);

      socket.onopen = () => {
        attemptRef.current = 0;
        setConnectionState("open");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TMessage;
          onMessageRef.current(message);
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
  }, [channel, resourceId, token, wsBase]);

  return { connectionState };
}
