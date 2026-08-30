import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoApproveExpiredMatches } from "@/lib/matchmaking/auto-approve-matches";
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
        sport: { select: { name: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: [{ sport: { name: "asc" } }, { organization: { name: "asc" } }],
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
      take: 10,
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
        <h1 className="text-2xl font-bold text-brand-primary sm:text-3xl">
          Welcome back, {session.user.name?.split(" ")[0] ?? "Champion"}
        </h1>
        <p className="mt-1 text-gray-900/70">
          Here&apos;s how you&apos;re stacking up across every sport and club.
        </p>
      </div>

      {/* Ratings */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Your Ratings</h2>
        </div>

        {ratings.length === 0 ? (
          <Card className="rounded-xl border-gray-200 bg-brand-surface">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Trophy className="h-8 w-8 text-brand-primary" />
              <p className="font-medium text-gray-900">No ratings on the board yet.</p>
              <p className="max-w-sm text-sm text-gray-900/70">
                Join an organization and play your first match to start climbing the leaderboard.
              </p>
              <Link
                href="/orgs"
                className="mt-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Find an Organization
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ratings.map((rating) => {
              const conservative = Math.round(rating.mu - 3 * rating.sigma);
              return (
                <Card key={rating.id} className="rounded-xl border-gray-200 bg-brand-surface">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{rating.sport.name}</span>
                      <Badge className="bg-brand-secondary text-gray-900 hover:bg-brand-secondary">
                        {conservative}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-900/70">{rating.organization.name}</p>
                    <p className="mt-2 text-xs text-gray-900/50">
                      μ {rating.mu.toFixed(1)} · σ {rating.sigma.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Separator className="bg-gray-200" />

      {/* Recent match history */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Matches</h2>
        </div>

        {recentMatches.length === 0 ? (
          <Card className="rounded-xl border-gray-200 bg-brand-surface">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Swords className="h-8 w-8 text-brand-primary" />
              <p className="font-medium text-gray-900">Your match history is empty.</p>
              <p className="max-w-sm text-sm text-gray-900/70">
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
                className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-brand-primary sm:flex sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {m.sport} · vs {m.opponents}
                  </p>
                  <p className="text-sm text-gray-900/60">
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
                    <Badge variant="outline" className="text-gray-500">
                      {m.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {m.score !== null && (
                    <span className="text-sm font-semibold text-gray-900">{m.score}</span>
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