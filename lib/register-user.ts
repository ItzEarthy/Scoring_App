"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";

export async function registerUser(formData: FormData) {
  "use server";

  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof name !== "string" || !name.trim()) {
    redirect("/register?error=name");
  }
  if (typeof email !== "string" || !email.trim()) {
    redirect("/register?error=email");
  }
  if (typeof password !== "string" || password.length < 8) {
    redirect("/register?error=password");
  }
  if (password !== confirmPassword) {
    redirect("/register?error=mismatch");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    redirect("/register?error=exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name: name.trim(), email: normalizedEmail, passwordHash },
  });

  try {
    await signIn("credentials", {
      email: normalizedEmail,
      password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }
}
