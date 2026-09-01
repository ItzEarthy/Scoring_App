import { prisma } from "@/lib/prisma";
import { QueueStatus } from "@/app/generated/prisma/enums";

type PlatformConfig = { queue_timeout_minutes?: number | null };

/**
 * Lazy-evaluation queue timeout, mirroring autoApproveExpiredMatches: cancels
 * WAITING entries older than the org's queue_timeout_minutes (unset = no
 * timeout). Called from read paths (the queue page) before its own queries
 * so stale entries are already cleared by the time the page renders.
 */
export async function expireStaleQueueEntries(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { platformConfig: true },
  });

  const timeoutMinutes = (organization?.platformConfig as PlatformConfig | null)?.queue_timeout_minutes ?? null;
  if (!timeoutMinutes) return;

  await prisma.queueEntry.updateMany({
    where: {
      organizationId,
      status: QueueStatus.WAITING,
      joinedAt: { lt: new Date(Date.now() - timeoutMinutes * 60_000) },
    },
    data: { status: QueueStatus.CANCELED },
  });
}
