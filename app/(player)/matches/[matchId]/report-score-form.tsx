"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  reportMatchScoreAction,
  type ReportMatchScoreState,
} from "@/lib/matchmaking/report-match-score";

const initialReportMatchScoreState: ReportMatchScoreState = { status: "idle" };

type TeamPlayer = {
  participantId: string;
  userId: string;
  name: string;
  avatarBase64: string | null;
  score?: number | null;
};

type Team = {
  teamIdentifier: string;
  label: string;
  players: TeamPlayer[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Reporting..." : "Report Score"}
    </Button>
  );
}

export function ReportScoreForm({
  matchId,
  orgId,
  teams,
}: {
  matchId: string;
  orgId: string;
  teams: Team[];
}) {
  const [state, formAction] = useActionState(
    reportMatchScoreAction,
    initialReportMatchScoreState
  );
  const [winner, setWinner] = useState<string | null>(null);

  return (
    <Card className="bg-brand-surface">
      <CardHeader>
        <CardTitle className="text-lg">Report Score</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="winningTeamIdentifier" value={winner ?? ""} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {teams.map((team) => {
              const isWinner = winner === team.teamIdentifier;
              return (
                <div
                  key={team.teamIdentifier}
                  className={cn(
                    "flex flex-col gap-4 rounded-lg border p-4 transition",
                    isWinner ? "border-emerald-500 bg-emerald-50" : "border-border bg-card"
                  )}
                >
                  <div className="flex flex-col gap-3">
                    {team.players.map((player) => (
                      <div key={player.participantId} className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
                          <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium text-foreground">
                          {player.name}
                        </span>
                        <Input
                          type="number"
                          name={`score:${player.participantId}`}
                          placeholder="Score"
                          defaultValue={player.score ?? undefined}
                          min={0}
                          className="w-20 bg-card"
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    onClick={() => setWinner(team.teamIdentifier)}
                    className={cn(
                      "gap-2",
                      isWinner
                        ? "bg-emerald-500 text-white hover:bg-emerald-500/90"
                        : "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                    )}
                  >
                    <Trophy className="h-4 w-4" />
                    {isWinner ? "Winner Selected" : `Declare ${team.label} the Winner`}
                  </Button>
                </div>
              );
            })}
          </div>

          {state.status === "error" && (
            <p className="flex items-center gap-2 text-sm text-rose-600">
              <ShieldAlert className="h-4 w-4" />
              {state.message}
            </p>
          )}
          {state.status === "success" && (
            <p className="text-sm text-brand-primary">{state.message}</p>
          )}

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
