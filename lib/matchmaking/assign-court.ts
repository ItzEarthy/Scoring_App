import type { Prisma } from "@/app/generated/prisma/client";
import { CourtStatus } from "@/app/generated/prisma/enums";

type TxClient = Prisma.TransactionClient;

/**
 * Finds the next available court for a match: one bound to this sport, or one
 * usable for any sport (sportId: null), ordered by display position. Callers
 * are responsible for excluding courts already claimed earlier in the same
 * transaction (e.g. by other matches formed in the same queue-pairing pass).
 */
export async function pickAvailableCourt(
  tx: TxClient,
  organizationId: string,
  sportId: string,
  excludeCourtIds: string[] = []
) {
  return tx.court.findFirst({
    where: {
      organizationId,
      status: CourtStatus.AVAILABLE,
      OR: [{ sportId }, { sportId: null }],
      id: excludeCourtIds.length ? { notIn: excludeCourtIds } : undefined,
    },
    orderBy: [{ sportId: { sort: "desc", nulls: "last" } }, { displayOrder: "asc" }],
  });
}
