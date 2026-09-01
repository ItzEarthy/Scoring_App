import { Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  info: "border-brand-primary/20 bg-brand-primary/5 text-muted-foreground",
  warning: "border-rose-500/30 bg-rose-500/5 text-muted-foreground",
} as const;

const TONE_ICON_CLASSES = {
  info: "text-brand-primary",
  warning: "text-rose-500",
} as const;

export function InfoNote({
  children,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
  className?: string;
}) {
  const Icon = tone === "warning" ? ShieldAlert : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        TONE_CLASSES[tone],
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", TONE_ICON_CLASSES[tone])} />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
