/**
 * Fans a match event out to every socket subscribed to it via the realtime
 * relay (realtime/server.js). Best-effort: if the relay is briefly
 * unreachable, connected clients simply miss one live tick and pick up the
 * correct state on their next server-rendered load or reconnect -- so this
 * never throws back into the Server Action that just wrote to Postgres.
 */
export async function publishMatchEvent(matchId: string, event: Record<string, unknown>) {
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
      body: JSON.stringify({ matchId, event }),
    });
  } catch (error) {
    console.error("Failed to publish match event to realtime relay", error);
  }
}
