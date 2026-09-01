"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";

type Sport = {
  id: string;
  name: string;
  ratingAlgorithm: string;
  isActive: boolean;
};

export function SportsCatalogGrid({ sports }: { sports: Sport[] }) {
  const [search, setSearch] = useState("");

  const filtered = sports.filter((sport) =>
    sport.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={search} onChange={setSearch} placeholder="Search sports..." className="max-w-xs" />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sports match &quot;{search}&quot;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sport) => (
            <Link key={sport.id} href={`/admin/sports/${sport.id}`}>
              <Card className="h-full transition hover:border-brand-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{sport.name}</span>
                    <Badge
                      className={
                        sport.isActive
                          ? "bg-brand-secondary text-foreground hover:bg-brand-secondary"
                          : "bg-muted text-muted-foreground hover:bg-muted"
                      }
                    >
                      {sport.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{sport.ratingAlgorithm}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
