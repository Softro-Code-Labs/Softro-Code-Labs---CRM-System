import { cn } from "@/lib/utils";

const tones = {
  gray: "bg-ink-100 text-ink-700 ring-ink-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}
      {...props}
    />
  );
}
