"use client";

import { useActionState, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SearchInput } from "@/components/ui/search-input";
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
      className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2"
      title={state.status === "error" ? state.message : undefined}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="sportId" value={sportId} />

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="h-4 text-[9px] text-muted-foreground">
            {ratingAlgorithm}
          </Badge>
          {state.status === "error" && <ShieldAlert className="h-3 w-3 text-rose-600" />}
        </div>
      </div>

      <Switch
        defaultChecked={enabled}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={`Enable ${name} for this organization`}
      />
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
  const [search, setSearch] = useState("");

  if (sports.length === 0) {
    return <p className="text-sm text-muted-foreground">No sports are configured on this platform yet.</p>;
  }

  const filtered = sports.filter((sport) =>
    sport.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      <SearchInput value={search} onChange={setSearch} placeholder="Search sports..." className="max-w-xs" />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sports match &quot;{search}&quot;.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((sport) => (
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
      )}
    </div>
  );
}
