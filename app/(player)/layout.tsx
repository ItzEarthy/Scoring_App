import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getVerifiedSiteAdminUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mintJoinToken } from "@/lib/realtime/token";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trophy, LayoutDashboard, Users, ShieldCheck, UserCircle, Settings } from "lucide-react";
import { SignOutMenuItem } from "./sign-out-item";
import { MobileTabBar } from "./mobile-tab-bar";
import { NotificationBell } from "./notification-bell";

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = session.user;
  const userId = session.user.id;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarBase64: true, onboardingCompletedAt: true },
  });

  if (dbUser && !dbUser.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  const notificationJoinToken = mintJoinToken("user", userId, userId);
  const initialUnreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  const initials = (user.name ?? user.email ?? "?")
    .trim()
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-brand-base">
      <header className="sticky top-0 z-40 bg-brand-primary">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-base">
            <Trophy className="h-6 w-6 text-brand-secondary" />
            <span className="font-heading text-xl font-bold tracking-wider uppercase">
              MatchPlay
            </span>
          </Link>

          {/* Primary nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            <Button
              render={<Link href="/dashboard" />}
              variant="ghost"
              className="gap-2 text-brand-base hover:bg-brand-base/10 hover:text-brand-secondary"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              render={<Link href="/orgs" />}
              variant="ghost"
              className="gap-2 text-brand-base hover:bg-brand-base/10 hover:text-brand-secondary"
            >
              <Users className="h-4 w-4" />
              Organizations
            </Button>
            {siteAdminUserId && (
              <Button
                render={<Link href="/admin" />}
                variant="ghost"
                className="gap-2 text-brand-base hover:bg-brand-base/10 hover:text-brand-secondary"
              >
                <ShieldCheck className="h-4 w-4" />
                Site Admin
              </Button>
            )}
          </nav>

          <div className="flex items-center gap-1">
            <NotificationBell
              userId={userId}
              joinToken={notificationJoinToken}
              initialUnreadCount={initialUnreadCount}
            />

            {/* Account menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full p-0 hover:bg-brand-base/10"
                  />
                }
              >
                <Avatar className="h-9 w-9 ring-2 ring-brand-secondary">
                  <AvatarImage src={dbUser?.avatarBase64 ?? undefined} alt={user.name ?? "User"} />
                  <AvatarFallback className="bg-brand-secondary text-brand-primary-dark">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="font-medium">{user.name ?? "Player"}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href={`/players/${userId}`} />}>
                  <UserCircle className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/settings" />}>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/orgs" />}>
                  <Users className="mr-2 h-4 w-4" />
                  My Organizations
                </DropdownMenuItem>
                {siteAdminUserId && (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Site Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <SignOutMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="stripe-bar h-1.5 w-full" />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 sm:pb-8">{children}</main>

      <MobileTabBar showAdmin={Boolean(siteAdminUserId)} />
    </div>
  );
}
