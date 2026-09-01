import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";
import { Swords } from "lucide-react";
import { NewMatchForm } from "./new-match-form";

type PlatformConfig = { match_mode?: string };

export default async function NewMatchPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      platformConfig: true,
      organizationUsers: {
        select: { role: true, userId: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!organization) notFound();

  const membership = organization.organizationUsers.find((m) => m.userId === userId);
  const isAdmin = membership?.role === Role.ADMIN || membership?.role === Role.OWNER;
  if (!isAdmin) redirect(`/orgs/${orgId}`);

  const config = (organization.platformConfig ?? {}) as PlatformConfig;
  if ((config.match_mode ?? "queue") !== "admin") redirect(`/orgs/${orgId}`);

  const sports = await prisma.sport.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/orgs/${organization.id}`}
          className="text-sm font-medium text-brand-primary hover:underline"
        >
          {organization.name}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold tracking-tight text-foreground uppercase sm:text-3xl">
          <Swords className="h-6 w-6 text-brand-primary" />
          Schedule a Match
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick a sport and two members to schedule a match directly.
        </p>
      </div>

      <NewMatchForm
        organizationId={organization.id}
        sports={sports.map((s) => ({ id: s.id, name: s.name }))}
        members={organization.organizationUsers.map((m) => ({
          id: m.userId,
          name: m.user.name ?? m.user.email,
        }))}
      />
    </div>
  );
}
