import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { conservativeRating } from "@/lib/matchmaking/rating-engines/conservative-rating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RatingHistoryChart } from "@/components/rating-history-chart";
import { Trophy, Swords, Calendar, Users } from "lucide-react";

const MATCH_LOG_LIMIT = 20;

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarBase64: true, createdAt: true },
  });
  if (!player) notFound();

  const [ratings, participations] = await Promise.all([
    prisma.playerRating.findMany({
      where: { userId, isActive: true },
      include: { sport: { select: { id: true, name: true, ratingAlgorithm: true } } },
      orderBy: { sport: { name: "asc" } },
    }),
    prisma.matchParticipant.findMany({
      where: { userId },
      include: {
        match: {
          include: {
            sport: { select: { id: true, name: true } },
            organization: { select: { id: true, name: true } },
            participants: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { match: { createdAt: "asc" } },
    }),
  ]);

  const displayName = player.name ?? player.email;

  // Rating history: the immutable muAfter ledger on each completed
  // participation, grouped by sport (see MatchParticipant model comment).
  const historyBySport = new Map<string, number[]>();
  for (const p of participations) {
    if (p.muAfter === null || p.sigmaAfter === null) continue;
    const sportId = p.match.sport.id;
    const engineId = ratings.find((r) => r.sport.id === sportId)?.sport.ratingAlgorithm ?? "openskill";
    const value = conservativeRating(engineId === "glicko2" ? "glicko2" : "openskill", p.muAfter, p.sigmaAfter);
    if (!historyBySport.has(sportId)) historyBySport.set(sportId, []);
    historyBySport.get(sportId)!.push(value);
  }

  // Head-to-head: tally this player's outcome against every distinct
  // opponent they've shared a match with (a different team in the same
  // match), across all sports.
  const headToHead = new Map<
    string,
    { name: string; wins: number; losses: number; draws: number; matches: number }
  >();
  for (const p of participations) {
    const opponents = p.match.participants.filter(
      (other) => other.userId !== userId && other.teamIdentifier !== p.teamIdentifier
    );
    for (const opponent of opponents) {
      const key = opponent.userId;
      if (!headToHead.has(key)) {
        headToHead.set(key, {
          name: opponent.user.name ?? opponent.user.email,
          wins: 0,
          losses: 0,
          draws: 0,
          matches: 0,
        });
      }
      const record = headToHead.get(key)!;
      record.matches += 1;
      if (p.outcome === "WIN") record.wins += 1;
      else if (p.outcome === "LOSS") record.losses += 1;
      else if (p.outcome === "DRAW") record.draws += 1;
    }
  }
  const headToHeadRows = [...headToHead.entries()]
    .map(([opponentId, record]) => ({ opponentId, ...record }))
    .sort((a, b) => b.matches - a.matches);

  const matchLog = [...participations].reverse().slice(0, MATCH_LOG_LIMIT);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="lg" className="h-16 w-16">
          <AvatarImage src={player.avatarBase64 ?? undefined} alt={displayName} />
          <AvatarFallback className="text-lg">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-primary uppercase sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Member since{" "}
            {new Date(player.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Ratings + history */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Ratings</h2>
        </div>

        {ratings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ratings recorded yet.</p>
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
                    <RatingHistoryChart points={historyBySport.get(rating.sport.id) ?? []} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Separator />

      {/* Head-to-head */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">
            Head-to-Head
          </h2>
        </div>

        {headToHeadRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No opponents faced yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {headToHeadRows.map((row) => (
              <Link
                key={row.opponentId}
                href={`/players/${row.opponentId}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition hover:border-brand-primary"
              >
                <span className="font-medium text-foreground">{row.name}</span>
                <span className="scoreboard text-sm text-muted-foreground">
                  <span className="text-emerald-600">{row.wins}W</span>
                  {" – "}
                  <span className="text-rose-600">{row.losses}L</span>
                  {row.draws > 0 && (
                    <>
                      {" – "}
                      <span className="text-amber-600">{row.draws}D</span>
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Match log */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Match Log</h2>
        </div>

        {matchLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches played yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {matchLog.map((p) => {
              const opponents = p.match.participants.filter((other) => other.userId !== userId);
              return (
                <Link
                  key={p.match.id}
                  href={`/matches/${p.match.id}`}
                  className="rounded-lg border border-border bg-card p-4 transition hover:border-brand-primary sm:flex sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {p.match.sport.name} · vs{" "}
                      {opponents.length > 0
                        ? opponents.map((o) => o.user.name ?? o.user.email).join(", ")
                        : "TBD"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.match.organization.name} ·{" "}
                      {new Date(p.match.finishedAt ?? p.match.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 sm:mt-0">
                    {p.outcome ? (
                      <Badge
                        className={
                          p.outcome === "WIN"
                            ? "bg-emerald-500 hover:bg-emerald-500"
                            : p.outcome === "LOSS"
                            ? "bg-rose-500 hover:bg-rose-500"
                            : "bg-amber-500 hover:bg-amber-500"
                        }
                      >
                        {p.outcome}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {p.match.status.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {p.score !== null && <span className="scoreboard text-lg text-brand-primary">{p.score}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
