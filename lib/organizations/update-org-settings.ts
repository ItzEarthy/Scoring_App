"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

export type UpdateOrgSettingsState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const MATCH_MODES = new Set(["queue", "admin", "pool", "free"]);
const APPROVAL_MODES = new Set(["admin_forced", "player_mutual"]);

export async function updateOrgSettingsAction(
  _prevState: UpdateOrgSettingsState,
  formData: FormData
): Promise<UpdateOrgSettingsState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You must be signed in." };
  }

  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }

  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
    select: { role: true },
  });

  if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
    return { status: "error", message: "Only organization admins can change these settings." };
  }

  const matchMode = formData.get("match_mode");
  const approvalMode = formData.get("approval_mode");
  const autoApproveHoursRaw = formData.get("auto_approve_hours");

  if (typeof matchMode !== "string" || !MATCH_MODES.has(matchMode)) {
    return { status: "error", message: "Invalid match mode." };
  }
  if (typeof approvalMode !== "string" || !APPROVAL_MODES.has(approvalMode)) {
    return { status: "error", message: "Invalid approval mode." };
  }
  const autoApproveHours = Number(autoApproveHoursRaw);
  if (!Number.isFinite(autoApproveHours) || autoApproveHours <= 0 || autoApproveHours > 720) {
    return { status: "error", message: "Auto-approve hours must be between 1 and 720." };
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      platformConfig: {
        match_mode: matchMode,
        approval_mode: approvalMode,
        auto_approve_hours: autoApproveHours,
      },
    },
  });

  revalidatePath(`/orgs/${organizationId}`);
  return { status: "success", message: "Organization settings saved." };
}
