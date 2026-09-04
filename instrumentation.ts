const SWEEP_INTERVAL_MS = 10_000;

/**
 * Periodic matchmaking sweep. Previously, matchmaking was re-run lazily
 * whenever someone loaded the queue page (see queue/page.tsx's git history)
 * -- that's what let a viable group lock in purely because
 * matchmaking_delay_seconds elapsed, with no new joiner. Now that the queue
 * page is realtime-driven instead of polled, nothing else re-triggers that
 * time-based case, so this sweep takes over: every SWEEP_INTERVAL_MS it
 * re-runs formMatchesFromQueue (and expireStaleQueueEntries) for every
 * org+sport with at least one WAITING entry, whether or not anyone is
 * looking at the queue page right now.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { prisma } = await import("@/lib/prisma");
    const { formMatchesFromQueue } = await import("@/lib/matchmaking/form-matches");
    const { expireStaleQueueEntries } = await import("@/lib/matchmaking/expire-stale-queue-entries");
    const { QueueStatus } = await import("@/app/generated/prisma/enums");

    async function sweep() {
      try {
        const pending = await prisma.queueEntry.findMany({
          where: { status: QueueStatus.WAITING },
          select: { organizationId: true, sportId: true },
          distinct: ["organizationId", "sportId"],
        });

        const organizationIds = [...new Set(pending.map((p) => p.organizationId))];
        await Promise.all(organizationIds.map((organizationId) => expireStaleQueueEntries(organizationId)));

        await Promise.all(
          pending.map((p) => formMatchesFromQueue(p.organizationId, p.sportId))
        );
      } catch (error) {
        console.error("Matchmaking sweep failed", error);
      }
    }

    console.log("Matchmaking sweep registered, interval", SWEEP_INTERVAL_MS);
    setInterval(sweep, SWEEP_INTERVAL_MS);
  } catch (error) {
    console.error("Failed to register matchmaking sweep", error);
  }
}
