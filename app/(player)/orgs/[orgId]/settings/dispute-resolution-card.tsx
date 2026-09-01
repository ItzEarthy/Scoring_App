"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

function ForceWinnerSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="gap-2">
      <Trophy className="h-4 w-4" />
      {pending ? "Resolving..." : "Force This Winner"}
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
  const [winner, setWinner] = useState<string | null>(null);

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
            const isWinner = winner === team.teamIdentifier;
            return (
              <button
                key={team.teamIdentifier}
                type="button"
                onClick={() => setWinner(team.teamIdentifier)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 text-left transition",
                  isWinner ? "border-emerald-500 bg-emerald-50" : "border-border bg-card"
                )}
              >
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {team.label}
                </span>
                {team.players.map((player) => (
                  <div key={player.participantId} className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
                      <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{player.name}</span>
                    {player.score !== null && (
                      <span className="ml-auto scoreboard text-brand-primary">{player.score}</span>
                    )}
                  </div>
                ))}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <form action={voidActionFn}>
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="orgId" value={orgId} />
            <VoidSubmit />
          </form>

          <form action={forceAction}>
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="winningTeamIdentifier" value={winner ?? ""} />
            <ForceWinnerSubmit disabled={!winner} />
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
