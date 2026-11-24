import { cn } from "@/lib/utils";

/** A small spinning ring for buttons and inline "working…" states. Inherits the text colour. */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-4 shrink-0 rounded-full border-2 border-current border-r-transparent opacity-80 motion-safe:animate-spin", className)} />;
}
