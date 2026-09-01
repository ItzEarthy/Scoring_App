import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedSiteAdminUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, Plus } from "lucide-react";
import { CreateSportForm } from "./create-sport-form";

export default async function SportsCatalogPage() {
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) redirect("/dashboard");

  const sports = await prisma.sport.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm font-medium text-brand-primary hover:underline">
          Site Admin
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold tracking-tight text-foreground uppercase sm:text-3xl">
          <Trophy className="h-6 w-6 text-brand-primary" />
          Sports Catalog
        </h1>
        <p className="mt-1 text-muted-foreground">
          Sports offered platform-wide. Deactivating a sport hides it from matchmaking queues
          without deleting its rating history.
        </p>
      </div>

      <section>
        {sports.length === 0 ? (
          <Card className="bg-brand-surface">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No sports yet -- create one below.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sports.map((sport) => (
              <Link key={sport.id} href={`/admin/sports/${sport.id}`}>
                <Card className="h-full transition hover:border-brand-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{sport.name}</span>
                      <Badge
                        className={
                          sport.isActive
                            ? "bg-brand-secondary text-foreground hover:bg-brand-secondary"
                            : "bg-muted text-muted-foreground hover:bg-muted"
                        }
                      >
                        {sport.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{sport.ratingAlgorithm}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Create a Sport</h2>
        </div>
        <Card className="bg-brand-surface">
          <CardContent className="py-6">
            <CreateSportForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
