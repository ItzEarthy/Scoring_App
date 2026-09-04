"use server";

import bcrypt from "bcryptjs";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ChangePasswordState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in to change your password." };
  }

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof currentPassword !== "string" || !currentPassword) {
    return { status: "error", message: "Enter your current password." };
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { status: "error", message: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { status: "error", message: "New passwords don't match." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) {
    return { status: "error", message: "Your account could not be found." };
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return { status: "error", message: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { status: "success", message: "Password updated." };
}
