import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Swords, Calendar, Clock } from "lucide-react";
import { MatchStatus } from "@/app/generated/prisma/enums";
import { ReportScoreForm } from "./report-score-form";
import { autoApproveExpiredMatches } from "@/lib/matchmaking/auto-approve-matches";

const TERMINAL_STATUSES: MatchStatus[] = [
  MatchStatus.COMPLETED,
  MatchStatus.CANCELED,
  MatchStatus.DISPUTED,
];

const STATUS_LABEL: Record<MatchStatus, string> = {
  [MatchStatus.SCHEDULED]: "Scheduled",
  [MatchStatus.IN_PROGRESS]: "In Progress",
  [MatchStatus.PENDING_CONFIRMATION]: "Pending Confirmation",
  [MatchStatus.COMPLETED]: "Completed",
  [MatchStatus.CANCELED]: "Canceled",
  [MatchStatus.DISPUTED]: "Disputed",
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  await autoApproveExpiredMatches({ matchId });

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      sport: { select: { name: true } },
      organization: { select: { id: true, name: true, platformConfig: true } },
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarBase64: true } },
        },
      },
    },
  });

  if (!match) notFound();

  const isParticipant = match.participants.some((p) => p.userId === userId);
  const canReportScore = isParticipant && !TERMINAL_STATUSES.includes(match.status);

  const teamOrder = [...new Set(match.participants.map((p) => p.teamIdentifier))];
  const teams = teamOrder.map((teamIdentifier, i) => ({
    teamIdentifier,
    label: `Team ${String.fromCharCode(65 + i)}`,
    players: match.participants
      .filter((p) => p.teamIdentifier === teamIdentifier)
      .map((p) => ({
        participantId: p.id,
        userId: p.userId,
        name: p.user.name ?? p.user.email,
        avatarBase64: p.user.avatarBase64,
        score: p.score,
        outcome: p.outcome,
      })),
  }));

  const statusBadgeClass =
    match.status === MatchStatus.COMPLETED
      ? "bg-emerald-500 hover:bg-emerald-500"
      : match.status === MatchStatus.DISPUTED
      ? "bg-rose-500 hover:bg-rose-500"
      : match.status === MatchStatus.CANCELED
      ? "bg-gray-400 hover:bg-gray-400"
      : "bg-amber-500 hover:bg-amber-500";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/orgs/${match.organization.id}`}
          className="text-sm font-medium text-brand-primary hover:underline"
        >
          {match.organization.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <Swords className="h-6 w-6 text-brand-primary" />
            {match.sport.name} Match
          </h1>
          <Badge className={statusBadgeClass}>{STATUS_LABEL[match.status]}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-900/60">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(match.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {match.approvalDeadline && match.status === MatchStatus.PENDING_CONFIRMATION && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Auto-approves{" "}
              {new Date(match.approvalDeadline).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.teamIdentifier} className="rounded-xl border-gray-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{team.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {team.players.map((player) => (
                <div key={player.participantId} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
                    <AvatarFallback className="bg-brand-secondary text-gray-900">
                      {player.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium text-gray-900">{player.name}</span>
                  {player.outcome && (
                    <Badge
                      className={
                        player.outcome === "WIN"
                          ? "bg-emerald-500 hover:bg-emerald-500"
                          : player.outcome === "LOSS"
                          ? "bg-rose-500 hover:bg-rose-500"
                          : "bg-amber-500 hover:bg-amber-500"
                      }
                    >
                      {player.outcome}
                    </Badge>
                  )}
                  {player.score !== null && (
                    <span className="text-sm font-semibold text-gray-900">{player.score}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="bg-gray-200" />

      {/* Score reporting */}
      {canReportScore ? (
        <ReportScoreForm
          matchId={match.id}
          orgId={match.organization.id}
          teams={teams.map((t) => ({
            teamIdentifier: t.teamIdentifier,
            label: t.label,
            players: t.players.map((p) => ({
              participantId: p.participantId,
              userId: p.userId,
              name: p.name,
              avatarBase64: p.avatarBase64,
            })),
          }))}
        />
      ) : (
        <Card className="rounded-xl border-gray-200 bg-brand-surface">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="font-medium text-gray-900">
              {isParticipant
                ? "This match is closed for score reporting."
                : "You're viewing this match as a spectator."}
            </p>
            <p className="max-w-sm text-sm text-gray-900/70">
              {isParticipant
                ? `Status: ${STATUS_LABEL[match.status]}.`
                : "Only participants can report a score."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
