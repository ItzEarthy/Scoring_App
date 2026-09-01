"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateMemberRoleAction,
  removeMemberAction,
  type RosterActionState,
} from "@/lib/organizations/manage-roster";

const initialRoleState: RosterActionState = { status: "idle" };
const initialRemoveState: RosterActionState = { status: "idle" };

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Removing..." : "Remove Member"}
    </Button>
  );
}

export function MemberRowControls({
  organizationId,
  targetUserId,
  targetName,
  currentRole,
}: {
  organizationId: string;
  targetUserId: string;
  targetName: string;
  currentRole: "MEMBER" | "ADMIN";
}) {
  const [roleState, roleFormAction] = useActionState(updateMemberRoleAction, initialRoleState);
  const [removeState, removeFormAction] = useActionState(removeMemberAction, initialRemoveState);

  return (
    <div className="flex items-center gap-2">
      <form action={roleFormAction} className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <select
            name="newRole"
            defaultValue={currentRole}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        {roleState.status === "error" && (
          <p className="flex items-center gap-1 text-xs text-rose-600">
            <ShieldAlert className="h-3 w-3" />
            {roleState.message}
          </p>
        )}
      </form>

      <Dialog>
        <DialogTrigger render={<Button variant="outline" className="border-rose-300 text-rose-600" />}>
          Remove
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {targetName}?</DialogTitle>
            <DialogDescription>
              They&apos;ll lose their membership in this organization and drop off its
              leaderboards. Their match history is kept. They can rejoin later.
            </DialogDescription>
          </DialogHeader>
          <form action={removeFormAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="targetUserId" value={targetUserId} />
            {removeState.status === "error" && (
              <p className="mb-2 flex items-center gap-1 text-sm text-rose-600">
                <ShieldAlert className="h-4 w-4" />
                {removeState.message}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <RemoveButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
