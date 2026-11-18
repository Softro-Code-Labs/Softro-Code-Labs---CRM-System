import { cn, initials } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-ink-50", className)}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}
