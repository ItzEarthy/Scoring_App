"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";
import {
  createOrganizationAction,
  type CreateOrganizationState,
} from "@/lib/organizations/manage-organizations";

const initialState: CreateOrganizationState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create Organization"}
    </Button>
  );
}

export function CreateOrgForm() {
  const [state, formAction] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label htmlFor="org-name" className="text-sm font-medium text-foreground">
          Organization name
        </label>
        <Input id="org-name" name="name" placeholder="Downtown Sports Club" required />
      </div>
      <SubmitButton />
      {state.status === "error" && (
        <p className="flex items-center gap-2 text-sm text-rose-600 sm:ml-2">
          <ShieldAlert className="h-4 w-4" />
          {state.message}
        </p>
      )}
    </form>
  );
}
