import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedSiteAdminUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trophy, Plus } from "lucide-react";
import { CreateSportForm } from "./create-sport-form";
import { SportsCatalogGrid } from "./sports-catalog-grid";

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
          <SportsCatalogGrid
            sports={sports.map((s) => ({
              id: s.id,
              name: s.name,
              ratingAlgorithm: s.ratingAlgorithm,
              isActive: s.isActive,
            }))}
          />
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
