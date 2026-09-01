import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Role } from "@/app/generated/prisma/enums";
import { Trophy, Sliders, LayoutGrid, Settings } from "lucide-react";
import { SportsSettingsForm } from "./sports-settings-form";
import { MatchmakingSettingsForm } from "./matchmaking-settings-form";
import { CourtsSettingsForm } from "./courts-settings-form";
import { CreateCourtForm } from "./create-court-form";

type PlatformConfig = {
  match_mode?: string;
  approval_mode?: string;
  auto_approve_hours?: number;
  skill_gap_threshold?: number | null;
  queue_timeout_minutes?: number | null;
};

export default async function OrgSettingsPage({
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
    select: { role: true },
  });
  const isAdmin = membership?.role === Role.ADMIN || membership?.role === Role.OWNER;
  if (!isAdmin) redirect(`/orgs/${orgId}`);

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, platformConfig: true },
  });
  if (!organization) notFound();

  const [allSports, orgSports, courts] = await Promise.all([
    prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, ratingAlgorithm: true },
    }),
    prisma.organizationSport.findMany({
      where: { organizationId: orgId },
      select: { sportId: true },
    }),
    prisma.court.findMany({
      where: { organizationId: orgId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, status: true, sportId: true },
    }),
  ]);

  const enabledSportIds = new Set(orgSports.map((os) => os.sportId));
  const enabledSports = allSports.filter((s) => enabledSportIds.has(s.id));
  const config = (organization.platformConfig ?? {}) as PlatformConfig;

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
          <Settings className="h-6 w-6 text-brand-primary" />
          Organization Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Customize the sports, matchmaking behavior, and courts for {organization.name}.
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Sports</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose which sports from the platform catalog members of this organization can play.
        </p>
        <SportsSettingsForm
          organizationId={organization.id}
          sports={allSports.map((s) => ({
            id: s.id,
            name: s.name,
            ratingAlgorithm: s.ratingAlgorithm,
            enabled: enabledSportIds.has(s.id),
          }))}
        />
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Matchmaking</h2>
        </div>
        <Card className="bg-brand-surface">
          <CardContent className="py-6">
            <MatchmakingSettingsForm
              organizationId={organization.id}
              matchMode={config.match_mode ?? "queue"}
              approvalMode={config.approval_mode ?? "player_mutual"}
              autoApproveHours={config.auto_approve_hours ?? 24}
              skillGapThreshold={config.skill_gap_threshold ?? null}
              queueTimeoutMinutes={config.queue_timeout_minutes ?? null}
            />
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">
            Courts &amp; Tables
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Courts bound to a sport are only used for that sport&apos;s matches; leave a court unbound to make it
          usable for any sport. Matches auto-assign the next available court when one is free.
        </p>
        <div className="flex flex-col gap-4">
          <CourtsSettingsForm
            organizationId={organization.id}
            courts={courts.map((c) => ({ id: c.id, name: c.name, status: c.status, sportId: c.sportId }))}
            sports={enabledSports.map((s) => ({ id: s.id, name: s.name }))}
          />
          <Card>
            <CardContent className="py-6">
              <CreateCourtForm
                organizationId={organization.id}
                sports={enabledSports.map((s) => ({ id: s.id, name: s.name }))}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
