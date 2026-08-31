"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { toggleSportActiveAction, type SportFormState } from "@/lib/sports/manage-sports";

const initialState: SportFormState = { status: "idle" };

function ToggleButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      className={isActive ? "border-rose-300 text-rose-600" : "border-brand-primary text-brand-primary"}
    >
      {pending ? "Saving..." : isActive ? "Deactivate Sport" : "Reactivate Sport"}
    </Button>
  );
}

export function ToggleActiveForm({ sportId, isActive }: { sportId: string; isActive: boolean }) {
  const [state, formAction] = useActionState(toggleSportActiveAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="sportId" value={sportId} />
      <ToggleButton isActive={isActive} />
      {state.status === "error" && (
        <p className="flex items-center gap-2 text-sm text-rose-600">
          <ShieldAlert className="h-4 w-4" />
          {state.message}
        </p>
      )}
    </form>
  );
}
