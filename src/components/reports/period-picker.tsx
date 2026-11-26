"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PERIOD_OPTIONS } from "./period-options";

const control = "h-9 rounded-lg border border-ink-300 bg-white px-2.5 text-sm text-ink-700 shadow-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none";

/**
 * Period presets plus a custom date range, written to ?period= or ?from=&to=.
 * Reports use the calendar presets; the finance pages pass tax-year ones.
 */
export function PeriodPicker({
  from,
  to,
  options = PERIOD_OPTIONS,
  defaultValue = "last-12",
}: {
  from: string;
  to: string;
  options?: readonly { value: string; label: string }[];
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const custom = sp.has("from") && sp.has("to");
  const [showCustom, setShowCustom] = useState(custom);
  const [range, setRange] = useState({ from, to });

  const go = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Period"
        className={control}
        value={showCustom ? "custom" : sp.get("period") ?? defaultValue}
        onChange={(e) => {
          if (e.target.value === "custom") return setShowCustom(true);
          setShowCustom(false);
          go((p) => {
            p.delete("from");
            p.delete("to");
            if (e.target.value === defaultValue) p.delete("period");
            else p.set("period", e.target.value);
          });
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="custom">Custom dates…</option>
      </select>
      {showCustom && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!range.from || !range.to) return;
            go((p) => {
              p.delete("period");
              p.set("from", range.from);
              p.set("to", range.to);
            });
          }}
        >
          <input type="date" aria-label="From" className={control} value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} required />
          <span className="text-sm text-ink-500">to</span>
          <input type="date" aria-label="To" className={control} value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} required />
          <button type="submit" className="h-9 rounded-lg bg-ink-900 px-3 text-sm font-medium text-white hover:bg-ink-800">
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
