"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";
import { updateSportAction, type SportFormState } from "@/lib/sports/manage-sports";

const initialState: SportFormState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-brand-primary text-white hover:opacity-90">
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  );
}

export function EditSportForm({
  sportId,
  name,
  ratingAlgorithm,
  defaultRules,
}: {
  sportId: string;
  name: string;
  ratingAlgorithm: string;
  defaultRules: string;
}) {
  const [state, formAction] = useActionState(updateSportAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="sportId" value={sportId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-gray-900">
            Sport name
          </label>
          <Input id="name" name="name" defaultValue={name} className="bg-white" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="ratingAlgorithm" className="text-sm font-medium text-gray-900">
            Rating algorithm
          </label>
          <select
            id="ratingAlgorithm"
            name="ratingAlgorithm"
            defaultValue={ratingAlgorithm}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900"
          >
            <option value="openskill">OpenSkill</option>
            <option value="glicko2">Glicko-2</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="defaultRules" className="text-sm font-medium text-gray-900">
            Default rules (JSON)
          </label>
          <textarea
            id="defaultRules"
            name="defaultRules"
            defaultValue={defaultRules}
            rows={1}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-mono text-sm text-gray-900"
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
