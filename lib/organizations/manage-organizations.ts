"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/app/generated/prisma/enums";

export type CreateOrganizationState = {
  status: "idle" | "error";
  message?: string;
};

const DEFAULT_PLATFORM_CONFIG = {
  match_mode: "queue",
  approval_mode: "player_mutual",
  auto_approve_hours: 24,
};

export async function createOrganizationAction(
  _prevState: CreateOrganizationState,
  formData: FormData
): Promise<CreateOrganizationState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "You must be signed in to create an organization." };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Enter an organization name." };
  }

  const organization = await prisma.organization.create({
    data: {
      name: name.trim(),
      platformConfig: DEFAULT_PLATFORM_CONFIG,
      organizationUsers: {
        create: { userId: session.user.id, role: Role.OWNER },
      },
    },
  });

  revalidatePath("/orgs");
  redirect(`/orgs/${organization.id}`);
}

export async function joinOrganizationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    return;
  }

  const existing = await prisma.organizationUser.findUnique({
    where: {
      userId_organizationId: { userId: session.user.id, organizationId },
    },
  });

  if (!existing) {
    await prisma.organizationUser.create({
      data: { userId: session.user.id, organizationId, role: Role.MEMBER },
    });
  }

  revalidatePath("/orgs");
  redirect(`/orgs/${organizationId}`);
}
