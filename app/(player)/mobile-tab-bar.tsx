"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, ShieldCheck, type LucideIcon } from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function MobileTabBar({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orgs", label: "Orgs", icon: Users },
    ...(showAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-brand-primary sm:hidden">
      <div className="stripe-bar h-1 w-full" />
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 font-heading text-[11px] font-semibold tracking-wide uppercase transition-colors",
                isActive ? "text-brand-secondary" : "text-brand-base/70"
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
