import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, Plus } from "lucide-react";
import { CreateOrgForm } from "./create-org-form";
import { joinOrganizationAction } from "@/lib/organizations/manage-organizations";

export default async function OrgsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [memberships, allOrgs] = await Promise.all([
    prisma.organizationUser.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true, createdAt: true } } },
      orderBy: { organization: { name: "asc" } },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const joinedIds = new Set(memberships.map((m) => m.organizationId));
  const joinableOrgs = allOrgs.filter((o) => !joinedIds.has(o.id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary sm:text-3xl">Organizations</h1>
        <p className="mt-1 text-gray-900/70">
          Manage the clubs and leagues you belong to, or start a new one.
        </p>
      </div>

      {/* My organizations */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">My Organizations</h2>
        </div>

        {memberships.length === 0 ? (
          <Card className="rounded-xl border-gray-200 bg-brand-surface">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="font-medium text-gray-900">You haven&apos;t joined any organizations yet.</p>
              <p className="max-w-sm text-sm text-gray-900/70">
                Create one below or join an existing organization.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.map((m) => (
              <Link key={m.organizationId} href={`/orgs/${m.organizationId}`}>
                <Card className="h-full rounded-xl border-gray-200 bg-white transition hover:border-brand-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{m.organization.name}</span>
                      <Badge className="bg-brand-secondary text-gray-900 hover:bg-brand-secondary">
                        {m.role}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator className="bg-gray-200" />

      {/* Create organization */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Create an Organization</h2>
        </div>
        <Card className="rounded-xl border-gray-200 bg-brand-surface">
          <CardContent className="py-6">
            <CreateOrgForm />
          </CardContent>
        </Card>
      </section>

      <Separator className="bg-gray-200" />

      {/* Join an organization */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Join an Organization</h2>
        </div>

        {joinableOrgs.length === 0 ? (
          <p className="text-sm text-gray-900/60">You&apos;ve already joined every organization on the platform.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {joinableOrgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
              >
                <span className="font-medium text-gray-900">{org.name}</span>
                <form action={joinOrganizationAction}>
                  <input type="hidden" name="organizationId" value={org.id} />
                  <Button type="submit" variant="outline" className="border-brand-primary text-brand-primary">
                    Join
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
