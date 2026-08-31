"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";
import { createSportAction, type SportFormState } from "@/lib/sports/manage-sports";

const initialState: SportFormState = { status: "idle" };

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-brand-primary text-white hover:opacity-90">
      {pending ? "Creating..." : "Create Sport"}
    </Button>
  );
}

export function CreateSportForm() {
  const [state, formAction] = useActionState(createSportAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-gray-900">
            Sport name
          </label>
          <Input id="name" name="name" placeholder="e.g. Table Tennis" className="bg-white" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="ratingAlgorithm" className="text-sm font-medium text-gray-900">
            Rating algorithm
          </label>
          <select
            id="ratingAlgorithm"
            name="ratingAlgorithm"
            defaultValue="openskill"
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
            defaultValue="{}"
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
        <CreateButton />
      </div>
    </form>
  );
}
