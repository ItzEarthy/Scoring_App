"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";
import { changePasswordAction, type ChangePasswordState } from "@/lib/account/change-password";

const initialState: ChangePasswordState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Updating..." : "Update Password"}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} key={state.status === "success" ? "reset" : "form"} className="flex flex-col gap-4 sm:max-w-sm">
      <div className="flex flex-col gap-2">
        <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
          Current password
        </label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
          New password
        </label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
          Confirm new password
        </label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {state.status === "error" && (
        <p className="flex items-center gap-2 text-sm text-rose-600">
          <ShieldAlert className="h-4 w-4" />
          {state.message}
        </p>
      )}
      {state.status === "success" && <p className="text-sm text-emerald-600">{state.message}</p>}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
