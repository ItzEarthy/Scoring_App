"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

export type RosterActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

// OWNER is never assignable through this control -- ownership transfer is a
// separate, more sensitive operation this slice doesn't implement.
const ASSIGNABLE_ROLES = new Set<Role>([Role.MEMBER, Role.ADMIN]);

async function requireOrgAdmin(userId: string, organizationId: string) {
  const membership = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });

  if (!membership || (membership.role !== Role.ADMIN && membership.role !== Role.OWNER)) {
    return null;
  }
  return membership;
}

export async function updateMemberRoleAction(
  _prevState: RosterActionState,
  formData: FormData
): Promise<RosterActionState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in." };
  }

  const organizationId = formData.get("organizationId");
  const targetUserId = formData.get("targetUserId");
  const newRole = formData.get("newRole");

  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }
  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    return { status: "error", message: "Missing member reference." };
  }
  if (typeof newRole !== "string" || !ASSIGNABLE_ROLES.has(newRole as Role)) {
    return { status: "error", message: "Invalid role." };
  }

  if (!(await requireOrgAdmin(userId, organizationId))) {
    return { status: "error", message: "Only organization admins can change member roles." };
  }

  const target = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
    select: { role: true },
  });
  if (!target) {
    return { status: "error", message: "That member is not part of this organization." };
  }
  if (target.role === Role.OWNER) {
    return { status: "error", message: "The organization owner's role can't be changed here." };
  }

  await prisma.organizationUser.update({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
    data: { role: newRole as Role },
  });

  revalidatePath(`/orgs/${organizationId}`);
  return { status: "success", message: "Member role updated." };
}

export async function removeMemberAction(
  _prevState: RosterActionState,
  formData: FormData
): Promise<RosterActionState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in." };
  }

  const organizationId = formData.get("organizationId");
  const targetUserId = formData.get("targetUserId");

  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return { status: "error", message: "Missing organization reference." };
  }
  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    return { status: "error", message: "Missing member reference." };
  }
  if (targetUserId === userId) {
    return { status: "error", message: "You can't remove yourself from the organization." };
  }

  if (!(await requireOrgAdmin(userId, organizationId))) {
    return { status: "error", message: "Only organization admins can remove members." };
  }

  const target = await prisma.organizationUser.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
    select: { role: true },
  });
  if (!target) {
    return { status: "error", message: "That member is not part of this organization." };
  }
  if (target.role === Role.OWNER) {
    return { status: "error", message: "The organization owner can't be removed." };
  }

  await prisma.organizationUser.delete({
    where: { userId_organizationId: { userId: targetUserId, organizationId } },
  });

  revalidatePath(`/orgs/${organizationId}`);
  return { status: "success", message: "Member removed." };
}
