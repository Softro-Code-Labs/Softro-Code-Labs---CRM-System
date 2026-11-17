"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

/** "Export CSV" dropdown. Closes after a choice, on Escape, or on a click outside. */
export function ExportMenu({ items }: { items: { href: string; label: string; hint: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 shadow-sm hover:bg-ink-50"
      >
        <Download className="size-4" aria-hidden /> Export CSV
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-ink-200 bg-white p-1 shadow-lg">
          {items.map((i) => (
            <a key={i.href} role="menuitem" href={i.href} download onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 hover:bg-ink-50">
              <span className="block text-sm font-medium text-ink-900">{i.label}</span>
              <span className="block text-xs text-ink-500">{i.hint}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
