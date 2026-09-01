"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Ban, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  forceMatchWinnerAction,
  voidMatchAction,
  type ResolveDisputeState,
} from "@/lib/matchmaking/resolve-dispute";

const initialState: ResolveDisputeState = { status: "idle" };

type TeamPlayer = {
  participantId: string;
  name: string;
  avatarBase64: string | null;
  score: number | null;
};

type Team = {
  teamIdentifier: string;
  label: string;
  players: TeamPlayer[];
};

// A team's score is per-team, not per-player -- report-match-score.ts
// replicates the same value across every teammate, so any one of them is
// representative (summing them would double-count a doubles team). A
// team's total is only "known" once every player on it has a reported
// score -- a missing score means we can't trust a comparison either way.
function teamTotal(team: Team): number | null {
  if (team.players.length === 0 || team.players.some((p) => p.score === null)) return null;
  return team.players[0].score;
}

function ResolveSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="gap-2">
      <Trophy className="h-4 w-4" />
      {pending ? "Resolving..." : "Confirm Winner & Resolve"}
    </Button>
  );
}

function VoidSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      disabled={pending}
      className="gap-2 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
    >
      <Ban className="h-4 w-4" />
      {pending ? "Voiding..." : "Void Match"}
    </Button>
  );
}

export function DisputeResolutionCard({
  matchId,
  orgId,
  sportName,
  createdAt,
  teams,
}: {
  matchId: string;
  orgId: string;
  sportName: string;
  createdAt: Date;
  teams: Team[];
}) {
  const [forceState, forceAction] = useActionState(forceMatchWinnerAction, initialState);
  const [voidState, voidActionFn] = useActionState(voidMatchAction, initialState);

  const totals = teams.map((team) => ({ team, total: teamTotal(team) }));
  const allScored = totals.every((t) => t.total !== null);
  const maxTotal = allScored ? Math.max(...totals.map((t) => t.total as number)) : null;
  const leaders = maxTotal !== null ? totals.filter((t) => t.total === maxTotal) : [];
  // Only auto-resolve when every team has a score and exactly one team leads.
  const autoWinner = allScored && leaders.length === 1 ? leaders[0].team.teamIdentifier : null;

  const message = forceState.status !== "idle" ? forceState : voidState;

  return (
    <Card className="border-rose-500/40 bg-brand-surface">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{sportName} Match</span>
          <span className="text-xs font-normal text-muted-foreground">
            Reported {createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teams.map((team) => {
            const isAutoWinner = autoWinner === team.teamIdentifier;
            return (
              <div
                key={team.teamIdentifier}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3",
                  isAutoWinner ? "border-emerald-500 bg-emerald-50" : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {team.label}
                  </span>
                  {isAutoWinner && (
                    <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500">
                      <Trophy className="h-3 w-3" />
                      Leading
                    </Badge>
                  )}
                </div>
                {team.players.map((player) => (
                  <div key={player.participantId} className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
                      <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{player.name}</span>
                    <span className="ml-auto scoreboard text-brand-primary">
                      {player.score ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {!autoWinner && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
            {allScored
              ? "Scores are tied -- void this match instead."
              : "A score is missing, so a winner can't be determined -- void this match instead."}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <form action={voidActionFn}>
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="orgId" value={orgId} />
            <VoidSubmit />
          </form>

          <form action={forceAction}>
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="winningTeamIdentifier" value={autoWinner ?? ""} />
            <ResolveSubmit disabled={!autoWinner} />
          </form>
        </div>

        {message.status === "error" && (
          <p className="flex items-center gap-2 text-sm text-rose-600">
            <ShieldAlert className="h-4 w-4" />
            {message.message}
          </p>
        )}
        {message.status === "success" && (
          <p className="text-sm text-brand-primary">{message.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
