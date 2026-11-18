import { cn, initials } from "@/lib/utils";

/** A person's photo, or their initials when they haven't added one. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small, already-sized private images; no optimisation needed
      <img src={src} alt="" width={64} height={64} className={cn("inline-block size-8 shrink-0 rounded-full bg-ink-800 object-cover", className)} />
    );
  }
  return (
    <span
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-ink-50", className)}
      aria-hidden
    >
      {initials(name) || "?"}
    </span>
  );
}
