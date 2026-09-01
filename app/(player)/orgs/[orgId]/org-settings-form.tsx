"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";
import {
  updateOrgSettingsAction,
  type UpdateOrgSettingsState,
} from "@/lib/organizations/update-org-settings";

const initialState: UpdateOrgSettingsState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Settings"}
    </Button>
  );
}

export function OrgSettingsForm({
  organizationId,
  matchMode,
  approvalMode,
  autoApproveHours,
}: {
  organizationId: string;
  matchMode: string;
  approvalMode: string;
  autoApproveHours: number;
}) {
  const [state, formAction] = useActionState(updateOrgSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="match_mode" className="text-sm font-medium text-foreground">
            Match mode
          </label>
          <select
            id="match_mode"
            name="match_mode"
            defaultValue={matchMode}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground"
          >
            <option value="queue">Queue</option>
            <option value="admin">Admin-assigned</option>
            <option value="pool">Pool</option>
            <option value="free">Free-for-all</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="approval_mode" className="text-sm font-medium text-foreground">
            Approval mode
          </label>
          <select
            id="approval_mode"
            name="approval_mode"
            defaultValue={approvalMode}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground"
          >
            <option value="player_mutual">Player mutual confirmation</option>
            <option value="admin_forced">Admin forced</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="auto_approve_hours" className="text-sm font-medium text-foreground">
            Auto-approve after (hours)
          </label>
          <Input
            id="auto_approve_hours"
            name="auto_approve_hours"
            type="number"
            min={1}
            max={720}
            defaultValue={autoApproveHours}
          />
        </div>
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

      <div>
        <SaveButton />
      </div>
    </form>
  );
}
