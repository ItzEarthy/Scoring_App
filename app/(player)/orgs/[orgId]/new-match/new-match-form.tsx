"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import {
  createAdminMatchAction,
  type AdminCreateMatchState,
} from "@/lib/matchmaking/admin-create-match";

const initialState: AdminCreateMatchState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-brand-primary text-white hover:opacity-90">
      {pending ? "Scheduling..." : "Schedule Match"}
    </Button>
  );
}

export function NewMatchForm({
  organizationId,
  sports,
  members,
}: {
  organizationId: string;
  sports: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createAdminMatchAction, initialState);

  return (
    <Card className="rounded-xl border-gray-200 bg-white">
      <CardContent className="py-6">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organizationId" value={organizationId} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="sportId" className="text-sm font-medium text-gray-900">
                Sport
              </label>
              <select
                id="sportId"
                name="sportId"
                className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900"
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

            <div className="flex flex-col gap-2">
              <label htmlFor="playerAId" className="text-sm font-medium text-gray-900">
                Player A
              </label>
              <select
                id="playerAId"
                name="playerAId"
                className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900"
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="playerBId" className="text-sm font-medium text-gray-900">
                Player B
              </label>
              <select
                id="playerBId"
                name="playerBId"
                className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900"
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
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
