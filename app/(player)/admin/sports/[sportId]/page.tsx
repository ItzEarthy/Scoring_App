import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getVerifiedSiteAdminUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy } from "lucide-react";
import { EditSportForm } from "./edit-sport-form";
import { ToggleActiveForm } from "./toggle-active-form";

export default async function SportDetailPage({
  params,
}: {
  params: Promise<{ sportId: string }>;
}) {
  const { sportId } = await params;

  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) redirect("/dashboard");

  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/sports" className="text-sm font-medium text-brand-primary hover:underline">
          Sports Catalog
        </Link>
        <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold tracking-tight text-foreground uppercase sm:text-3xl">
          <Trophy className="h-6 w-6 text-brand-primary" />
          {sport.name}
          <Badge
            className={
              sport.isActive
                ? "bg-brand-secondary text-foreground hover:bg-brand-secondary"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }
          >
            {sport.isActive ? "Active" : "Inactive"}
          </Badge>
        </h1>
      </div>

      <Card className="bg-brand-surface">
        <CardContent className="py-6">
          <EditSportForm
            sportId={sport.id}
            name={sport.name}
            ratingAlgorithm={sport.ratingAlgorithm}
            defaultRules={JSON.stringify(sport.defaultRules)}
          />
        </CardContent>
      </Card>

      <Separator />

      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          {sport.isActive
            ? "Deactivating hides this sport from matchmaking queues. Existing ratings and match history are kept."
            : "Reactivating makes this sport queueable again."}
        </p>
        <ToggleActiveForm sportId={sport.id} isActive={sport.isActive} />
      </div>
    </div>
  );
}
