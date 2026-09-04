import type { RelayChannel } from "./token";

/**
 * Fans an event out to every socket subscribed to a channel via the realtime
 * relay (realtime/server.js). Best-effort: if the relay is briefly
 * unreachable, connected clients simply miss one live tick and pick up the
 * correct state on their next server-rendered load or reconnect -- so this
 * never throws back into the Server Action that just wrote to Postgres.
 */
async function publishToChannel(
  channel: RelayChannel,
  resourceId: string,
  event: Record<string, unknown>
) {
  const baseUrl = process.env.REALTIME_INTERNAL_URL;
  const secret = process.env.REALTIME_SHARED_SECRET;
  if (!baseUrl || !secret) return;

  try {
    await fetch(`${baseUrl}/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ channel, resourceId, event }),
    });
  } catch (error) {
    console.error(`Failed to publish ${channel} event to realtime relay`, error);
  }
}

export async function publishMatchEvent(matchId: string, event: Record<string, unknown>) {
  return publishToChannel("match", matchId, event);
}

export async function publishUserEvent(userId: string, event: Record<string, unknown>) {
  return publishToChannel("user", userId, event);
}

export async function publishQueueEvent(
  organizationId: string,
  sportId: string,
  event: Record<string, unknown>
) {
  return publishToChannel("queue", `${organizationId}:${sportId}`, event);
}
