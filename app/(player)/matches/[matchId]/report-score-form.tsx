"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Minus, ShieldAlert } from "lucide-react";
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

function TeamRoster({ team }: { team: Team }) {
  return (
    <div className="flex flex-col gap-2">
      {team.players.map((player) => (
        <div key={player.participantId} className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
            <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">{player.name}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The winner is derived server-side from the sport's scoring rules -- this
 * form's only job is collecting the score in the shape the sport needs
 * (one number per team, or a sequence of sets) and surfacing the server's
 * validation result.
 */
export function ReportScoreForm({
  matchId,
  orgId,
  teams,
  shape,
  maxSets,
}: {
  matchId: string;
  orgId: string;
  teams: Team[];
  shape: "single" | "sets";
  maxSets?: number;
}) {
  const [state, formAction] = useActionState(
    reportMatchScoreAction,
    initialReportMatchScoreState
  );

  const teamIds = teams.map((t) => t.teamIdentifier);
  const [sets, setSets] = useState<Record<string, string>[]>([
    Object.fromEntries(teamIds.map((id) => [id, ""])),
  ]);

  const setsJson = JSON.stringify(
    sets.map((row) => Object.fromEntries(teamIds.map((id) => [id, Number(row[id] || 0)])))
  );

  return (
    <Card className="bg-brand-surface">
      <CardHeader>
        <CardTitle className="text-lg">Report Score</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="orgId" value={orgId} />
          {shape === "sets" && <input type="hidden" name="sets" value={setsJson} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {teams.map((team) => (
              <div
                key={team.teamIdentifier}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {team.label}
                </span>
                <TeamRoster team={team} />
                {shape === "single" && (
                  <Input
                    type="number"
                    name={`score:${team.teamIdentifier}`}
                    placeholder="Score"
                    min={0}
                    className="w-24 bg-card"
                  />
                )}
              </div>
            ))}
          </div>

          {shape === "sets" && (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-foreground">Sets</span>
              {sets.map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-14 text-xs text-muted-foreground">Set {i + 1}</span>
                  {teams.map((team) => (
                    <Input
                      key={team.teamIdentifier}
                      type="number"
                      min={0}
                      value={row[team.teamIdentifier]}
                      onChange={(e) =>
                        setSets((prev) =>
                          prev.map((r, idx) =>
                            idx === i ? { ...r, [team.teamIdentifier]: e.target.value } : r
                          )
                        )
                      }
                      placeholder={team.label}
                      className="w-20 bg-card"
                    />
                  ))}
                  {sets.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {(!maxSets || sets.length < maxSets) && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit gap-2"
                  onClick={() =>
                    setSets((prev) => [
                      ...prev,
                      Object.fromEntries(teamIds.map((id) => [id, ""])),
                    ])
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Set
                </Button>
              )}
            </div>
          )}

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
