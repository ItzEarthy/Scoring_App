"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UpdateAvatarState = {
  status: "idle" | "success" | "error";
  message?: string;
};

// The client crops/resizes to a small square JPEG before submitting, so this
// is a generous ceiling against a tampered request rather than the normal case.
const MAX_DATA_URL_LENGTH = 2_000_000;

export async function updateAvatarAction(
  _prevState: UpdateAvatarState,
  formData: FormData
): Promise<UpdateAvatarState> {
  const userId = await getVerifiedUserId();
  if (!userId) {
    return { status: "error", message: "You must be signed in to update your avatar." };
  }

  const dataUrl = formData.get("avatarDataUrl");
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return { status: "error", message: "Choose an image to upload." };
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    return { status: "error", message: "That image is too large. Try a smaller photo." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarBase64: dataUrl },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Avatar updated." };
}

export async function removeAvatarAction(): Promise<void> {
  const userId = await getVerifiedUserId();
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: { avatarBase64: null },
  });

  revalidatePath("/", "layout");
}
