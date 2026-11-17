import { cn } from "@/lib/utils";

/** The Softro Code Labs mark (same artwork as softrocodelabs.com). Do not redraw or recolour it. */
const MARK_PATH =
  "M111.5 24 L47 54.5 L47 102 L98.5 121.5 L98.5 154 L83 146 L83 121.4 L69 116.3 L69 154.6 L112.6 177 L112.6 78 L98.3 83.2 L98.3 105.9 L83 100.4 L83 83.4 L129 66.4 L129 117 L117 113 L117 127.5 L143.3 137 L143.3 46.8 L112.6 57 L112.6 24 Z M98.3 45.4 L98.3 62.4 L69 73.2 L69 95.2 L61.2 92.8 L61.2 63.5 Z";

export function SoftroMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="10 15.5 170 170" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="softro-mark-gradient" x1="0" y1="40" x2="0" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A70B21" />
          <stop offset="1" stopColor="#EF4C5B" />
        </linearGradient>
      </defs>
      <path fill="url(#softro-mark-gradient)" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

/**
 * "Softro CRM" lockup: the mark, "Softro" in the heavier weight and "CRM" lighter,
 * following the "Softro Code Labs" lockup on the website.
 * `tone="dark"` is for dark backgrounds (sidebar, login), `tone="light"` for light ones.
 */
export function SoftroCrmLogo({ tone = "light", size = "md", className }: { tone?: "light" | "dark"; size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", size === "lg" ? "gap-3" : "gap-2.5", className)}>
      <SoftroMark size={size === "lg" ? 48 : 32} />
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "lg" ? "text-3xl" : "text-xl",
          tone === "dark" ? "text-ink-50" : "text-ink-900",
        )}
      >
        Softro{" "}
        <span className={cn("font-normal", tone === "dark" ? "text-ink-300" : "text-ink-500")}>CRM</span>
      </span>
      <span className="sr-only">Softro CRM</span>
    </span>
  );
}
