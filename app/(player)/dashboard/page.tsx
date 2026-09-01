import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoApproveExpiredMatches } from "@/lib/matchmaking/auto-approve-matches";
import { conservativeRating } from "@/lib/matchmaking/rating-engines/conservative-rating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, Swords, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  await autoApproveExpiredMatches({ userId });

  const [ratings, participations] = await Promise.all([
    prisma.playerRating.findMany({
      where: { userId, isActive: true },
      include: {
        sport: { select: { name: true, ratingAlgorithm: true } },
      },
      orderBy: { sport: { name: "asc" } },
    }),
    prisma.matchParticipant.findMany({
      where: { userId },
      include: {
        match: {
          include: {
            sport: { select: { name: true } },
            organization: { select: { id: true, name: true } },
            participants: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { match: { createdAt: "desc" } },
      take: 5,
    }),
  ]);

  const recentMatches = participations.map((p) => {
    const opponents = p.match.participants
      .filter((other) => other.userId !== userId)
      .map((other) => other.user.name ?? other.user.email);

    return {
      matchId: p.match.id,
      sport: p.match.sport.name,
      organization: p.match.organization.name,
      status: p.match.status,
      outcome: p.outcome,
      score: p.score,
      opponents: opponents.length > 0 ? opponents.join(", ") : "TBD",
      date: p.match.finishedAt ?? p.match.createdAt,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand-primary uppercase sm:text-4xl">
          Welcome back, {session.user.name?.split(" ")[0] ?? "Champion"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s how you&apos;re stacking up across every sport and club.
        </p>
      </div>

      {/* Ratings */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">
            Your Ratings
          </h2>
        </div>

        {ratings.length === 0 ? (
          <Card className="bg-brand-surface">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Trophy className="h-8 w-8 text-brand-primary" />
              <p className="font-medium text-foreground">No ratings on the board yet.</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Join an organization and play your first match to start climbing the leaderboard.
              </p>
              <Link
                href="/orgs"
                className="mt-1 rounded-md bg-brand-primary px-4 py-2 font-heading text-sm font-semibold tracking-wide text-brand-base uppercase hover:opacity-90"
              >
                Find an Organization
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ratings.map((rating) => {
              const conservative = conservativeRating(
                rating.sport.ratingAlgorithm === "glicko2" ? "glicko2" : "openskill",
                rating.mu,
                rating.sigma
              );
              return (
                <Card key={rating.id} className="bg-brand-surface">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">{rating.sport.name}</CardTitle>
                    <span className="scoreboard text-3xl text-brand-primary">{conservative}</span>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      μ {rating.mu.toFixed(1)} · σ {rating.sigma.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Separator />

      {/* Recent match history */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">
            Recent Matches
          </h2>
        </div>

        {recentMatches.length === 0 ? (
          <Card className="bg-brand-surface">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Swords className="h-8 w-8 text-brand-primary" />
              <p className="font-medium text-foreground">Your match history is empty.</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Queue up for a match or challenge someone in your organization to get your first result on the books.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {recentMatches.map((m) => (
              <Link
                key={m.matchId}
                href={`/matches/${m.matchId}`}
                className="rounded-lg border border-border bg-card p-4 transition hover:border-brand-primary sm:flex sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {m.sport} · vs {m.opponents}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m.organization} ·{" "}
                    {new Date(m.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 sm:mt-0">
                  {m.outcome ? (
                    <Badge
                      className={
                        m.outcome === "WIN"
                          ? "bg-emerald-500 hover:bg-emerald-500"
                          : m.outcome === "LOSS"
                          ? "bg-rose-500 hover:bg-rose-500"
                          : "bg-amber-500 hover:bg-amber-500"
                      }
                    >
                      {m.outcome}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {m.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {m.score !== null && (
                    <span className="scoreboard text-lg text-brand-primary">{m.score}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}