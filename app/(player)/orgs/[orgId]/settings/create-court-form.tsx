"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ShieldAlert } from "lucide-react";
import { createCourtAction, type CourtFormState } from "@/lib/organizations/manage-courts";

// Must match the sentinel in courts-settings-form.tsx / manage-courts.ts.
const ANY_SPORT = "__any__";

const initialState: CourtFormState = { status: "idle" };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding..." : "Add Court"}
    </Button>
  );
}

export function CreateCourtForm({
  organizationId,
  sports,
}: {
  organizationId: string;
  sports: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createCourtAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="court-name" className="text-sm font-medium text-foreground">
            Court / table name
          </label>
          <Input id="court-name" name="name" placeholder="e.g. Court 1" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="court-sport" className="text-sm font-medium text-foreground">
            Sport
          </label>
          <Select
            name="sportId"
            defaultValue={ANY_SPORT}
            items={{ [ANY_SPORT]: "Any sport", ...Object.fromEntries(sports.map((s) => [s.id, s.name])) }}
          >
            <SelectTrigger id="court-sport">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_SPORT}>Any sport</SelectItem>
              {sports.map((sport) => (
                <SelectItem key={sport.id} value={sport.id}>
                  {sport.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="court-status" className="text-sm font-medium text-foreground">
            Initial status
          </label>
          <Select name="status" defaultValue="AVAILABLE" items={{ AVAILABLE: "Available", DISABLED: "Disabled" }}>
            <SelectTrigger id="court-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="DISABLED">Disabled</SelectItem>
            </SelectContent>
          </Select>
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
        <AddButton />
      </div>
    </form>
  );
}
