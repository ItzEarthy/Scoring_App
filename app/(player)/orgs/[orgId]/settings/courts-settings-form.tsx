"use client";

import { useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { updateCourtAction, deleteCourtAction, moveCourtAction } from "@/lib/organizations/manage-courts";

// Select items can't carry an empty-string value, so this sentinel stands in
// for "no sport bound" -- must match the constant in manage-courts.ts, which
// can't export it directly since "use server" files may only export functions.
const ANY_SPORT = "__any__";

type CourtRow = {
  id: string;
  name: string;
  status: "AVAILABLE" | "IN_USE" | "DISABLED";
  sportId: string | null;
};

function CourtRowControls({
  organizationId,
  court,
  sports,
  isFirst,
  isLast,
}: {
  organizationId: string;
  court: CourtRow;
  sports: { id: string; name: string }[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const sportFormRef = useRef<HTMLFormElement>(null);
  const statusFormRef = useRef<HTMLFormElement>(null);

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{court.name}</TableCell>

      <TableCell>
        <form ref={sportFormRef} action={updateCourtAction} className="contents">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="courtId" value={court.id} />
          <Select
            name="sportId"
            defaultValue={court.sportId ?? ANY_SPORT}
            onValueChange={() => sportFormRef.current?.requestSubmit()}
            items={{ [ANY_SPORT]: "Any sport", ...Object.fromEntries(sports.map((s) => [s.id, s.name])) }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_SPORT}>Any sport</SelectItem>
              {sports.map((sport) => (
                <SelectItem key={sport.id} value={sport.id}>
                  {sport.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </form>
      </TableCell>

      <TableCell>
        <form ref={statusFormRef} action={updateCourtAction} className="contents">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="courtId" value={court.id} />
          <Select
            name="status"
            defaultValue={court.status}
            onValueChange={() => statusFormRef.current?.requestSubmit()}
            items={{ AVAILABLE: "Available", IN_USE: "In use", DISABLED: "Disabled" }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="IN_USE">In use</SelectItem>
              <SelectItem value="DISABLED">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </form>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1">
          <form action={moveCourtAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="courtId" value={court.id} />
            <input type="hidden" name="direction" value="up" />
            <Button type="submit" variant="ghost" size="icon-sm" disabled={isFirst} aria-label="Move up">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </form>
          <form action={moveCourtAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="courtId" value={court.id} />
            <input type="hidden" name="direction" value="down" />
            <Button type="submit" variant="ghost" size="icon-sm" disabled={isLast} aria-label="Move down">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </form>
          <form action={deleteCourtAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="courtId" value={court.id} />
            <Button type="submit" variant="ghost" size="icon-sm" className="text-rose-600" aria-label="Delete court">
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CourtsSettingsForm({
  organizationId,
  courts,
  sports,
}: {
  organizationId: string;
  courts: CourtRow[];
  sports: { id: string; name: string }[];
}) {
  if (courts.length === 0) {
    return <p className="text-sm text-muted-foreground">No courts or tables have been added yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Sport</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-28">Order</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {courts.map((court, i) => (
          <CourtRowControls
            key={court.id}
            organizationId={organizationId}
            court={court}
            sports={sports}
            isFirst={i === 0}
            isLast={i === courts.length - 1}
          />
        ))}
      </TableBody>
    </Table>
  );
}
