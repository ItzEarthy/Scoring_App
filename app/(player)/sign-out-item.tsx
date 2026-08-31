"use client";

import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth-actions";

// A Server Component can't pass an inline event handler like onSelect to a
// Client Component prop -- that's a plain closure with no serialization
// story across the boundary. Isolating the interactive menu item here (with
// the server action imported rather than defined inline) keeps the handler
// entirely on the client side.
export function SignOutMenuItem() {
  return (
    <DropdownMenuItem
      onSelect={(e) => e.preventDefault()}
      render={<form action={signOutAction} className="w-full" />}
    >
      <button type="submit" className="flex w-full items-center text-rose-600">
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </button>
    </DropdownMenuItem>
  );
}
