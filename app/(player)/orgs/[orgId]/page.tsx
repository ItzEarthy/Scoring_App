import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trophy, Settings, Swords } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
import { OrgSettingsForm } from "./org-settings-form";
import { joinOrganizationAction } from "@/lib/organizations/manage-organizations";
import { autoApproveExpiredMatches } from "@/lib/matchmaking/auto-approve-matches";
import { Button } from "@/components/ui/button";

type PlatformConfig = {
  match_mode?: string;
  approval_mode?: string;
  auto_approve_hours?: number;
};

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  await autoApproveExpiredMatches({ organizationId: orgId });

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      organizationUsers: {
        include: { user: { select: { id: true, name: true, email: true, avatarBase64: true } } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      playerRatings: {
        where: { isActive: true },
        include: {
          user: { select: { id: true, name: true, email: true } },
          sport: { select: { id: true, name: true } },
        },
      },
      matches: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { sport: { select: { name: true } } },
      },
    },
  });

  if (!organization) notFound();

  const membership = organization.organizationUsers.find((m) => m.userId === userId);
  const isMember = Boolean(membership);
  const isAdmin = membership?.role === Role.ADMIN || membership?.role === Role.OWNER;

  const config = (organization.platformConfig ?? {}) as PlatformConfig;

  const sportGroups = new Map<string, { sportName: string; rows: typeof organization.playerRatings }>();
  for (const rating of organization.playerRatings) {
    const key = rating.sport.id;
    if (!sportGroups.has(key)) {
      sportGroups.set(key, { sportName: rating.sport.name, rows: [] });
    }
    sportGroups.get(key)!.rows.push(rating);
  }
  for (const group of sportGroups.values()) {
    group.rows.sort((a, b) => b.mu - 3 * b.sigma - (a.mu - 3 * a.sigma));
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <Users className="h-6 w-6 text-brand-primary" />
            {organization.name}
          </h1>
          <p className="mt-1 text-gray-900/70">
            {organization.organizationUsers.length} member
            {organization.organizationUsers.length === 1 ? "" : "s"}
          </p>
        </div>

        {isMember ? (
          <Button render={<Link href={`/orgs/${organization.id}/queue`} />} className="gap-2 bg-brand-primary text-white hover:opacity-90">
            <Swords className="h-4 w-4" />
            Matchmaking Queue
          </Button>
        ) : (
          <form action={joinOrganizationAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <Button type="submit" className="bg-brand-primary text-white hover:opacity-90">
              Join Organization
            </Button>
          </form>
        )}
      </div>

      {/* Leaderboards */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Leaderboards</h2>
        </div>

        {sportGroups.size === 0 ? (
          <p className="text-sm text-gray-900/60">No ratings recorded yet for this organization.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...sportGroups.values()].map((group) => (
              <Card key={group.sportName} className="rounded-xl border-gray-200 bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{group.sportName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-gray-900">
                            {r.user.name ?? r.user.email}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(r.mu - 3 * r.sigma)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator className="bg-gray-200" />

      {/* Recent matches */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Matches</h2>
        </div>

        {organization.matches.length === 0 ? (
          <p className="text-sm text-gray-900/60">No matches have been played yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {organization.matches.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition hover:border-brand-primary"
              >
                <span className="font-medium text-gray-900">{m.sport.name}</span>
                <Badge variant="outline" className="text-gray-500">
                  {m.status.replace(/_/g, " ")}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator className="bg-gray-200" />

      {/* Members */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Members</h2>
        </div>
        <div className="flex flex-col gap-2">
          {organization.organizationUsers.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <Avatar size="sm">
                <AvatarImage src={m.user.avatarBase64 ?? undefined} alt={m.user.name ?? m.user.email} />
                <AvatarFallback>{(m.user.name ?? m.user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="flex-1 font-medium text-gray-900">{m.user.name ?? m.user.email}</span>
              <Badge className="bg-brand-secondary text-gray-900 hover:bg-brand-secondary">{m.role}</Badge>
            </div>
          ))}
        </div>
      </section>

      {/* Admin settings */}
      {isAdmin && (
        <>
          <Separator className="bg-gray-200" />
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Organization Settings</h2>
            </div>
            <Card className="rounded-xl border-gray-200 bg-brand-surface">
              <CardContent className="py-6">
                <OrgSettingsForm
                  organizationId={organization.id}
                  matchMode={config.match_mode ?? "queue"}
                  approvalMode={config.approval_mode ?? "player_mutual"}
                  autoApproveHours={config.auto_approve_hours ?? 24}
                />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
