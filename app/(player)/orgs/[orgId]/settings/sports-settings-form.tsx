"use client";

import { useActionState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ShieldAlert } from "lucide-react";
import { toggleOrgSportAction, type ToggleOrgSportState } from "@/lib/organizations/manage-org-sports";

const initialState: ToggleOrgSportState = { status: "idle" };

function SportToggleRow({
  organizationId,
  sportId,
  name,
  ratingAlgorithm,
  enabled,
}: {
  organizationId: string;
  sportId: string;
  name: string;
  ratingAlgorithm: string;
  enabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(toggleOrgSportAction, initialState);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="sportId" value={sportId} />

      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">{name}</span>
        <Badge variant="outline" className="text-muted-foreground">
          {ratingAlgorithm}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {state.status === "error" && (
          <span className="flex items-center gap-1 text-xs text-rose-600">
            <ShieldAlert className="h-3.5 w-3.5" />
            {state.message}
          </span>
        )}
        <Switch
          defaultChecked={enabled}
          onCheckedChange={() => formRef.current?.requestSubmit()}
          aria-label={`Enable ${name} for this organization`}
        />
      </div>
    </form>
  );
}

export function SportsSettingsForm({
  organizationId,
  sports,
}: {
  organizationId: string;
  sports: { id: string; name: string; ratingAlgorithm: string; enabled: boolean }[];
}) {
  if (sports.length === 0) {
    return <p className="text-sm text-muted-foreground">No sports are configured on this platform yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {sports.map((sport) => (
        <SportToggleRow
          key={sport.id}
          organizationId={organizationId}
          sportId={sport.id}
          name={sport.name}
          ratingAlgorithm={sport.ratingAlgorithm}
          enabled={sport.enabled}
        />
      ))}
    </div>
  );
}
