"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShieldAlert } from "lucide-react";
import {
  createAdminMatchAction,
  type AdminCreateMatchState,
} from "@/lib/matchmaking/admin-create-match";

const initialState: AdminCreateMatchState = { status: "idle" };

type Sport = { id: string; name: string; minTeamSize: number; maxTeamSize: number | null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Scheduling..." : "Schedule Match"}
    </Button>
  );
}

function TeamPicker({
  label,
  name,
  members,
  players,
  onChange,
  minSize,
  maxSize,
}: {
  label: string;
  name: string;
  members: { id: string; name: string }[];
  players: string[];
  onChange: (players: string[]) => void;
  minSize: number;
  maxSize: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {players.map((playerId, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            name={`${name}[]`}
            value={playerId}
            onChange={(e) => onChange(players.map((p, idx) => (idx === i ? e.target.value : p)))}
            className="h-9 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground"
            required
          >
            <option value="">Select player</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {players.length > minSize && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(players.filter((_, idx) => idx !== i))}
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {(maxSize == null || players.length < maxSize) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => onChange([...players, ""])}
        >
          <Plus className="h-4 w-4" />
          Add Player
        </Button>
      )}
    </div>
  );
}

export function NewMatchForm({
  organizationId,
  sports,
  members,
}: {
  organizationId: string;
  sports: Sport[];
  members: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createAdminMatchAction, initialState);
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const sport = useMemo(() => sports.find((s) => s.id === sportId), [sports, sportId]);

  const emptyRoster = (size: number) => Array.from({ length: size }, () => "");
  const [teamA, setTeamA] = useState<string[]>(emptyRoster(sport?.minTeamSize ?? 1));
  const [teamB, setTeamB] = useState<string[]>(emptyRoster(sport?.minTeamSize ?? 1));

  function handleSportChange(id: string) {
    setSportId(id);
    const next = sports.find((s) => s.id === id);
    setTeamA(emptyRoster(next?.minTeamSize ?? 1));
    setTeamB(emptyRoster(next?.minTeamSize ?? 1));
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="organizationId" value={organizationId} />

          <div className="flex flex-col gap-2">
            <label htmlFor="sportId" className="text-sm font-medium text-foreground">
              Sport
            </label>
            <select
              id="sportId"
              name="sportId"
              value={sportId}
              onChange={(e) => handleSportChange(e.target.value)}
              className="h-9 w-full max-w-sm rounded-lg border border-border bg-card px-2.5 text-sm text-foreground"
              required
            >
              {sports.length === 0 && <option value="">No sports available</option>}
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TeamPicker
              label="Team A"
              name="teamA"
              members={members}
              players={teamA}
              onChange={setTeamA}
              minSize={sport?.minTeamSize ?? 1}
              maxSize={sport?.maxTeamSize ?? null}
            />
            <TeamPicker
              label="Team B"
              name="teamB"
              members={members}
              players={teamB}
              onChange={setTeamB}
              minSize={sport?.minTeamSize ?? 1}
              maxSize={sport?.maxTeamSize ?? null}
            />
          </div>

          {state.status === "error" && (
            <p className="flex items-center gap-1 text-sm text-rose-600">
              <ShieldAlert className="h-4 w-4" />
              {state.message}
            </p>
          )}

          <div>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
