"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  updateNotificationPreferencesAction,
  type UpdateNotificationPreferencesState,
} from "@/lib/account/notification-preferences";
import type { NotificationPreferences } from "@/lib/account/notification-preferences-shared";
import { NotificationType } from "@/app/generated/prisma/enums";

const initialState: UpdateNotificationPreferencesState = { status: "idle" };

const ROWS: { type: NotificationType; label: string; description: string }[] = [
  {
    type: NotificationType.MATCH_STARTED,
    label: "Match started",
    description: "A match you're in has begun.",
  },
  {
    type: NotificationType.SCORE_NEEDS_CONFIRMATION,
    label: "Score needs confirming",
    description: "An opponent reported a score that needs your approval.",
  },
  {
    type: NotificationType.DISPUTE_RESOLVED,
    label: "Dispute resolved",
    description: "An admin resolved a disputed match you were part of.",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Preferences"}
    </Button>
  );
}

export function NotificationPreferencesForm({ preferences }: { preferences: NotificationPreferences }) {
  const [state, formAction] = useActionState(updateNotificationPreferencesAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:max-w-md">
      {ROWS.map((row) => (
        <div key={row.type} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
          <div>
            <p className="font-medium text-foreground">{row.label}</p>
            <p className="text-sm text-muted-foreground">{row.description}</p>
          </div>
          <Switch name={row.type} defaultChecked={preferences[row.type]} />
        </div>
      ))}
      {state.status === "success" && <p className="text-sm text-emerald-600">{state.message}</p>}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
