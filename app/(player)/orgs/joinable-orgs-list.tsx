"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { joinOrganizationAction } from "@/lib/organizations/manage-organizations";

export function JoinableOrgsList({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [search, setSearch] = useState("");

  const filtered = orgs.filter((org) =>
    org.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      {orgs.length > 5 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search organizations..."
          className="max-w-xs"
        />
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No organizations match &quot;{search}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <span className="font-medium text-foreground">{org.name}</span>
              <form action={joinOrganizationAction}>
                <input type="hidden" name="organizationId" value={org.id} />
                <Button type="submit" variant="outline" className="border-brand-primary text-brand-primary">
                  Join
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
