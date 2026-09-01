"use client";

import { useCallback, useState, useTransition } from "react";
import { Minus, Plus, Radio, Users, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { adjustLiveScore } from "@/lib/matchmaking/live-score-actions";
import { useLiveMatchSocket, type LiveScoreUpdate } from "./use-live-match-socket";

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

export function LiveScoreboard({
  matchId,
  joinToken,
  currentUserId,
  teams,
  initialScores,
  canControl,
}: {
  matchId: string;
  joinToken: string;
  currentUserId: string;
  teams: Team[];
  initialScores: Record<string, number>;
  canControl: boolean;
}) {
  const [scores, setScores] = useState(initialScores);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleScoreUpdate = useCallback((update: LiveScoreUpdate) => {
    setScores((prev) => ({ ...prev, ...update.scores }));
  }, []);
  const { connectionState, viewers } = useLiveMatchSocket(matchId, joinToken, handleScoreUpdate);

  function bump(participantId: string, delta: 1 | -1) {
    if (!canControl) return;
    setScores((prev) => ({
      ...prev,
      [participantId]: Math.max(0, (prev[participantId] ?? 0) + delta),
    }));
    setFlashId(participantId);
    setTimeout(() => setFlashId((current) => (current === participantId ? null : current)), 300);

    setPendingId(participantId);
    startTransition(async () => {
      await adjustLiveScore(matchId, participantId, delta);
      setPendingId((current) => (current === participantId ? null : current));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <ConnectionBadge state={connectionState} />
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {viewers} watching
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.teamIdentifier}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{team.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {team.players.map((player) => {
                const score = scores[player.participantId] ?? 0;
                const isSelf = player.userId === currentUserId;
                return (
                  <div
                    key={player.participantId}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2 transition-colors",
                      isSelf && "bg-brand-secondary/40"
                    )}
                  >
                    <Avatar size="sm">
                      <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
                      <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {player.name}
                    </span>

                    {canControl ? (
                      <div className="flex items-center gap-2">
                        <ScoreButton
                          label={`Subtract point from ${player.name}`}
                          onClick={() => bump(player.participantId, -1)}
                          disabled={score === 0}
                        >
                          <Minus className="h-5 w-5" />
                        </ScoreButton>
                        <span
                          className={cn(
                            "scoreboard w-12 text-center text-3xl text-brand-primary transition-transform duration-150",
                            flashId === player.participantId && "scale-125"
                          )}
                        >
                          {score}
                        </span>
                        <ScoreButton
                          label={`Add point to ${player.name}`}
                          onClick={() => bump(player.participantId, 1)}
                        >
                          <Plus className="h-5 w-5" />
                        </ScoreButton>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "scoreboard w-12 text-center text-3xl text-brand-primary transition-transform duration-150",
                          flashId === player.participantId && "scale-125"
                        )}
                      >
                        {score}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingId && <p className="text-right text-xs text-muted-foreground">Syncing...</p>}
    </div>
  );
}

function ScoreButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition active:scale-90",
        "hover:bg-brand-secondary/60 disabled:pointer-events-none disabled:opacity-30"
      )}
    >
      {children}
    </button>
  );
}

function ConnectionBadge({ state }: { state: "connecting" | "open" | "reconnecting" | "closed" }) {
  if (state === "open") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-emerald-600">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        Live
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
        Offline
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-amber-600">
      <Radio className="h-3.5 w-3.5 animate-pulse" />
      {state === "connecting" ? "Connecting..." : "Reconnecting..."}
    </span>
  );
}
