"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, ShieldAlert, LogOut } from "lucide-react";
import {
  joinQueueAction,
  leaveQueueAction,
  type QueueActionState,
} from "@/lib/matchmaking/queue-actions";
import { useQueueSocket } from "./use-queue-socket";

const initialState: QueueActionState = { status: "idle" };

type WaitingPlayer = {
  entryId: string;
  userId: string;
  name: string;
  avatarBase64: string | null;
  joinedAt: string;
};

function JoinButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Joining..." : "Join Queue"}
    </Button>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function QueuePanel({
  organizationId,
  sport,
  userId,
  waiting,
  myMatchId,
  joinToken,
}: {
  organizationId: string;
  sport: { id: string; name: string };
  userId: string;
  waiting: WaitingPlayer[];
  myMatchId: string | null;
  joinToken: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(joinQueueAction, initialState);
  const isQueued = waiting.some((p) => p.userId === userId);

  // Live-updating queue: refresh the server-rendered list whenever the
  // realtime relay tells us someone joined/left or a match formed for this
  // org+sport, instead of polling on a timer.
  useQueueSocket(organizationId, sport.id, joinToken, () => router.refresh());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{sport.name}</CardTitle>
        <Badge variant="outline" className="gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {waiting.length} waiting
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {myMatchId && (
          <Link
            href={`/matches/${myMatchId}`}
            className="rounded-lg border border-emerald-500 bg-emerald-50 p-3 text-sm font-medium text-emerald-700 hover:underline"
          >
            Match found — view your {sport.name} match
          </Link>
        )}

        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one is waiting.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {waiting.map((player) => (
              <div key={player.entryId} className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarImage src={player.avatarBase64 ?? undefined} alt={player.name} />
                  <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <Link
                  href={`/players/${player.userId}`}
                  className="flex-1 text-sm font-medium text-foreground hover:text-brand-primary hover:underline"
                >
                  {player.name}
                  {player.userId === userId && (
                    <span className="ml-1.5 text-xs font-normal text-brand-primary">(you)</span>
                  )}
                </Link>
                <span className="text-xs text-muted-foreground">waiting {timeAgo(player.joinedAt)}</span>
              </div>
            ))}
          </div>
        )}

        {state.status === "error" && (
          <p className="flex items-center gap-2 text-sm text-rose-600">
            <ShieldAlert className="h-4 w-4" />
            {state.message}
          </p>
        )}

        <div>
          {isQueued ? (
            <form action={leaveQueueAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="sportId" value={sport.id} />
              <Button
                type="submit"
                variant="destructive"
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Leave Queue
              </Button>
            </form>
          ) : (
            <form action={formAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="sportId" value={sport.id} />
              <JoinButton />
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
