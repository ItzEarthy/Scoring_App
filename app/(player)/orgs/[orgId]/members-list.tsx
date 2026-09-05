"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { MemberRowControls } from "./member-row-controls";
import { Role } from "@/app/generated/prisma/enums";

type Member = {
  id: string;
  userId: string;
  role: Role;
  user: { name: string | null; email: string; avatarBase64: string | null };
};

export function MembersList({
  organizationId,
  members,
  isAdmin,
  currentUserId,
}: {
  organizationId: string;
  members: Member[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = members.filter((m) => {
    const label = m.user.name ?? m.user.email;
    return label.toLowerCase().includes(query) || m.user.email.toLowerCase().includes(query);
  });

  return (
    <div className="flex flex-col gap-3">
      {members.length > 5 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search members..."
          className="max-w-xs"
        />
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members match &quot;{search}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <Link href={`/players/${m.userId}`} className="flex flex-1 items-center gap-3 hover:text-brand-primary">
                <Avatar size="sm">
                  <AvatarImage src={m.user.avatarBase64 ?? undefined} alt={m.user.name ?? m.user.email} />
                  <AvatarFallback>{(m.user.name ?? m.user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground hover:underline">{m.user.name ?? m.user.email}</span>
              </Link>
              {isAdmin && m.role !== Role.OWNER && m.userId !== currentUserId ? (
                <MemberRowControls
                  organizationId={organizationId}
                  targetUserId={m.userId}
                  targetName={m.user.name ?? m.user.email}
                  currentRole={m.role === Role.ADMIN ? "ADMIN" : "MEMBER"}
                />
              ) : (
                <Badge className="bg-brand-secondary text-foreground hover:bg-brand-secondary">{m.role}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
