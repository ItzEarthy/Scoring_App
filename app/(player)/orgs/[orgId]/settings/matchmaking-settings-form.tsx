"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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
      {pending ? "Saving..." : "Save Matchmaking Settings"}
    </Button>
  );
}

export function MatchmakingSettingsForm({
  organizationId,
  matchMode,
  approvalMode,
  autoApproveHours,
  skillGapThreshold,
  queueTimeoutMinutes,
}: {
  organizationId: string;
  matchMode: string;
  approvalMode: string;
  autoApproveHours: number;
  skillGapThreshold: number | null;
  queueTimeoutMinutes: number | null;
}) {
  const [state, formAction] = useActionState(updateOrgSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="match_mode" className="text-sm font-medium text-foreground">
            Match mode
          </label>
          <Select
            name="match_mode"
            defaultValue={matchMode}
            items={{ queue: "Queue", admin: "Admin-assigned", pool: "Pool", free: "Free-for-all" }}
          >
            <SelectTrigger id="match_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="queue">Queue</SelectItem>
              <SelectItem value="admin">Admin-assigned</SelectItem>
              <SelectItem value="pool">Pool</SelectItem>
              <SelectItem value="free">Free-for-all</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="approval_mode" className="text-sm font-medium text-foreground">
            Approval mode
          </label>
          <Select
            name="approval_mode"
            defaultValue={approvalMode}
            items={{ player_mutual: "Player mutual confirmation", admin_forced: "Admin forced" }}
          >
            <SelectTrigger id="approval_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="player_mutual">Player mutual confirmation</SelectItem>
              <SelectItem value="admin_forced">Admin forced</SelectItem>
            </SelectContent>
          </Select>
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

        <div className="flex flex-col gap-2">
          <label htmlFor="skill_gap_threshold" className="text-sm font-medium text-foreground">
            Skill gap threshold
          </label>
          <Input
            id="skill_gap_threshold"
            name="skill_gap_threshold"
            type="number"
            min={0}
            step="any"
            placeholder="No limit"
            defaultValue={skillGapThreshold ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Caps how mismatched an auto-paired queue match can be. Leave blank for no limit.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="queue_timeout_minutes" className="text-sm font-medium text-foreground">
            Queue timeout (minutes)
          </label>
          <Input
            id="queue_timeout_minutes"
            name="queue_timeout_minutes"
            type="number"
            min={0}
            placeholder="Never"
            defaultValue={queueTimeoutMinutes ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Removes a player from the queue after this long without a match. Leave blank to never expire.
          </p>
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
