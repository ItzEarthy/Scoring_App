import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QueueStatus } from "@/app/generated/prisma/enums";
import { QueuePanel } from "./queue-panel";
import { Swords } from "lucide-react";

export default async function QueuePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  if (!membership) redirect(`/orgs/${orgId}`);

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, platformConfig: true },
  });
  if (!organization) notFound();

  const matchMode = (organization.platformConfig as { match_mode?: string } | null)?.match_mode ?? "queue";
  if (matchMode !== "queue") redirect(`/orgs/${orgId}`);

  const sports = await prisma.sport.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  const waitingEntries = await prisma.queueEntry.findMany({
    where: { organizationId: orgId, status: QueueStatus.WAITING },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, avatarBase64: true } } },
  });

  const myRecentMatched = await prisma.queueEntry.findFirst({
    where: { organizationId: orgId, userId, status: QueueStatus.MATCHED },
    orderBy: { joinedAt: "desc" },
    select: { sportId: true, matchId: true },
  });

  const bySport = sports.map((sport) => ({
    sport,
    waiting: waitingEntries.filter((e) => e.sportId === sport.id),
    myMatch:
      myRecentMatched?.sportId === sport.id && myRecentMatched.matchId
        ? myRecentMatched.matchId
        : null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/orgs/${organization.id}`}
          className="text-sm font-medium text-brand-primary hover:underline"
        >
          {organization.name}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <Swords className="h-6 w-6 text-brand-primary" />
          Matchmaking Queue
        </h1>
        <p className="mt-1 text-gray-900/70">
          Join the queue for a sport and you&apos;ll be matched automatically once another
          player is waiting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {bySport.map(({ sport, waiting, myMatch }) => (
          <QueuePanel
            key={sport.id}
            organizationId={organization.id}
            sport={{ id: sport.id, name: sport.name }}
            userId={userId}
            waiting={waiting.map((e) => ({
              entryId: e.id,
              userId: e.userId,
              name: e.user.name ?? e.user.email,
              avatarBase64: e.user.avatarBase64,
              joinedAt: e.joinedAt.toISOString(),
            }))}
            myMatchId={myMatch}
          />
        ))}
      </div>
    </div>
  );
}
