import { redirect } from "next/navigation";
import { getVerifiedUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveNotificationPreferences } from "@/lib/account/notification-preferences-shared";
import { AvatarPicker } from "@/components/avatar-picker";
import { Separator } from "@/components/ui/separator";
import { ImageIcon, KeyRound, Bell } from "lucide-react";
import { ChangePasswordForm } from "./change-password-form";
import { NotificationPreferencesForm } from "./notification-preferences-form";

export default async function SettingsPage() {
  const userId = await getVerifiedUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, avatarBase64: true, notificationPreferences: true },
  });
  if (!user) redirect("/login");

  const preferences = resolveNotificationPreferences(user.notificationPreferences);
  const fallbackText = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-primary uppercase sm:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your profile photo, password, and notification preferences.
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Avatar</h2>
        </div>
        <AvatarPicker initialAvatar={user.avatarBase64} fallbackText={fallbackText} />
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Password</h2>
        </div>
        <ChangePasswordForm />
      </section>

      <Separator />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-brand-primary" />
          <h2 className="font-heading text-lg font-semibold tracking-wide text-foreground uppercase">Notifications</h2>
        </div>
        <NotificationPreferencesForm preferences={preferences} />
      </section>
    </div>
  );
}
