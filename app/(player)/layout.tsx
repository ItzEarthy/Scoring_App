import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getVerifiedSiteAdminUserId } from "@/lib/auth";
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
import { Trophy, LayoutDashboard, Users, ShieldCheck } from "lucide-react";
import { SignOutMenuItem } from "./sign-out-item";

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  const initials = (user.name ?? user.email ?? "?")
    .trim()
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-brand-base">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-brand-base/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 text-brand-primary">
            <Trophy className="h-5 w-5" />
            <span className="text-lg font-bold tracking-tight">MatchPlay</span>
          </Link>

          {/* Primary nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            <Button render={<Link href="/dashboard" />} variant="ghost" className="gap-2 text-gray-900 hover:bg-brand-secondary/20">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button render={<Link href="/orgs" />} variant="ghost" className="gap-2 text-gray-900 hover:bg-brand-secondary/20">
              <Users className="h-4 w-4" />
              Organizations
            </Button>
            {siteAdminUserId && (
              <Button render={<Link href="/admin" />} variant="ghost" className="gap-2 text-gray-900 hover:bg-brand-secondary/20">
                <ShieldCheck className="h-4 w-4" />
                Site Admin
              </Button>
            )}
          </nav>

          {/* Account menu */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" />}>
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback className="bg-brand-secondary text-gray-900">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-medium">{user.name ?? "Player"}</span>
                  <span className="text-xs font-normal text-gray-500">{user.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
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
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}