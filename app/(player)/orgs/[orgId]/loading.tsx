import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Trophy, Swords, Users } from "lucide-react";

export default function OrgPageLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-primary/40" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-muted-foreground/60 uppercase">Leaderboards</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand-primary/40" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-muted-foreground/60 uppercase">Recent Matches</h2>
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary/40" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-muted-foreground/60 uppercase">Members</h2>
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  );
}
