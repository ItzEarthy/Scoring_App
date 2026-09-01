import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Trophy, Settings, Swords } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
import { MembersList } from "./members-list";
import { joinOrganizationAction } from "@/lib/organizations/manage-organizations";
import { autoApproveExpiredMatches } from "@/lib/matchmaking/auto-approve-matches";
import { conservativeRating } from "@/lib/matchmaking/rating-engines/conservative-rating";
import { Button } from "@/components/ui/button";

type PlatformConfig = {
  match_mode?: string;
  approval_mode?: string;
  auto_approve_hours?: number;
};

function MatchModeEntryPoint({
  organizationId,
  matchMode,
  isAdmin,
}: {
  organizationId: string;
  matchMode: string;
  isAdmin: boolean;
}) {
  if (matchMode === "admin") {
    if (isAdmin) {
      return (
        <Button render={<Link href={`/orgs/${organizationId}/new-match`} />} className="gap-2">
          <Swords className="h-4 w-4" />
          Schedule Match
        </Button>
      );
    }
    return (
      <p className="max-w-xs text-right text-sm text-muted-foreground">
        Matches here are scheduled directly by an organization admin.
      </p>
    );
  }

  if (matchMode === "pool" || matchMode === "free") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {matchMode === "pool" ? "Pool" : "Free-for-all"} matchmaking is not available yet
      </Badge>
    );
  }

  return (
    <Button render={<Link href={`/orgs/${organizationId}/queue`} />} className="gap-2">
      <Swords className="h-4 w-4" />
      Matchmaking Queue
    </Button>
  );
}

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
      organizationSports: { select: { sportId: true } },
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

  // Ratings are global per user+sport, but an org should only ever surface
  // the scores of its own members -- scope the lookup to this org's roster
  // and enabled sports, and only run it at all for members.
  const enabledSportIds = new Set(organization.organizationSports.map((os) => os.sportId));
  const memberUserIds = organization.organizationUsers.map((m) => m.userId);

  const orgRatings = isMember && memberUserIds.length > 0 && enabledSportIds.size > 0
    ? await prisma.playerRating.findMany({
        where: {
          isActive: true,
          userId: { in: memberUserIds },
          sportId: { in: [...enabledSportIds] },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          sport: { select: { id: true, name: true, ratingAlgorithm: true } },
        },
        orderBy: { mu: "desc" },
      })
    : [];

  const sportGroups = new Map<string, { sportName: string; rows: typeof orgRatings }>();
  for (const rating of orgRatings) {
    const key = rating.sport.id;
    if (!sportGroups.has(key)) {
      sportGroups.set(key, { sportName: rating.sport.name, rows: [] });
    }
    sportGroups.get(key)!.rows.push(rating);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-tight text-foreground uppercase sm:text-3xl">
            <Users className="h-6 w-6 text-brand-primary" />
            {organization.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {organization.organizationUsers.length} member
            {organization.organizationUsers.length === 1 ? "" : "s"}
          </p>
        </div>

        {isMember ? (
          <MatchModeEntryPoint organizationId={organization.id} matchMode={config.match_mode ?? "queue"} isAdmin={isAdmin} />
        ) : (
          <form action={joinOrganizationAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <Button type="submit">Join Organization</Button>
          </form>
        )}
      </div>

      {/* Leaderboards */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Leaderboards</h2>
        </div>

        {!isMember ? (
          <p className="text-sm text-muted-foreground">Join this organization to see member leaderboards.</p>
        ) : sportGroups.size === 0 ? (
          <p className="text-sm text-muted-foreground">No ratings recorded yet for this organization.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...sportGroups.values()].map((group) => (
              <Card key={group.sportName}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{group.sportName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium text-foreground">
                            {r.user.name ?? r.user.email}
                          </TableCell>
                          <TableCell className="scoreboard text-right text-lg text-brand-primary">
                            {conservativeRating(
                              r.sport.ratingAlgorithm === "glicko2" ? "glicko2" : "openskill",
                              r.mu,
                              r.sigma
                            )}
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

      <Separator />

      {/* Recent matches */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Recent Matches</h2>
        </div>

        {organization.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches have been played yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {organization.matches.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition hover:border-brand-primary"
              >
                <span className="font-medium text-foreground">{m.sport.name}</span>
                <Badge variant="outline" className="text-muted-foreground">
                  {m.status.replace(/_/g, " ")}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Members */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Members</h2>
        </div>
        <MembersList
          organizationId={organization.id}
          members={organization.organizationUsers}
          isAdmin={isAdmin}
          currentUserId={userId}
        />
      </section>

      {/* Admin settings */}
      {isAdmin && (
        <>
          <Separator />
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-primary" />
              <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Organization Settings</h2>
            </div>
            <Button render={<Link href={`/orgs/${organization.id}/settings`} />} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Manage Sports, Matchmaking &amp; Courts
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
