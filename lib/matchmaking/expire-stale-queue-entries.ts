import { prisma } from "@/lib/prisma";
import { QueueStatus } from "@/app/generated/prisma/enums";
import { publishQueueEvent } from "@/lib/realtime/publish";

type PlatformConfig = { queue_timeout_minutes?: number | null };

/**
 * Lazy-evaluation queue timeout, mirroring autoApproveExpiredMatches: cancels
 * WAITING entries older than the org's queue_timeout_minutes (unset = no
 * timeout). Called from read paths (the queue page) before its own queries
 * so stale entries are already cleared by the time the page renders, and
 * from the periodic matchmaking sweep (see instrumentation.ts) so already
 * -connected queue viewers see expirations live too.
 */
export async function expireStaleQueueEntries(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { platformConfig: true },
  });

  const timeoutMinutes = (organization?.platformConfig as PlatformConfig | null)?.queue_timeout_minutes ?? null;
  if (!timeoutMinutes) return;

  const expired = await prisma.queueEntry.findMany({
    where: {
      organizationId,
      status: QueueStatus.WAITING,
      joinedAt: { lt: new Date(Date.now() - timeoutMinutes * 60_000) },
    },
    select: { id: true, sportId: true },
  });
  if (expired.length === 0) return;

  await prisma.queueEntry.updateMany({
    where: { id: { in: expired.map((e) => e.id) } },
    data: { status: QueueStatus.CANCELED },
  });

  const sportIds = [...new Set(expired.map((e) => e.sportId))];
  await Promise.all(
    sportIds.map((sportId) => publishQueueEvent(organizationId, sportId, { type: "queue_changed" }))
  );
}
