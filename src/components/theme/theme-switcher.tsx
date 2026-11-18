"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; hint: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", hint: "Easy on the eyes. The default.", icon: Moon },
  { value: "light", label: "Light", hint: "Best in bright rooms and for printing.", icon: Sun },
  { value: "system", label: "Match my device", hint: "Follows your computer or phone setting.", icon: Monitor },
];

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePref = pref;
  root.dataset.theme = pref === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : pref;
  document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", root.dataset.theme === "light" ? "#f8f6f2" : "#111013");
}

function useThemePreference(initial: ThemePreference) {
  const [pref, setPref] = useState<ThemePreference>(initial);
  // Keep every switcher on the page in step (the header button and the profile card).
  useEffect(() => {
    const onChange = (e: Event) => setPref((e as CustomEvent<ThemePreference>).detail);
    window.addEventListener("softro-theme", onChange);
    return () => window.removeEventListener("softro-theme", onChange);
  }, []);
  const choose = (next: ThemePreference) => {
    apply(next);
    setPref(next);
    window.dispatchEvent(new CustomEvent("softro-theme", { detail: next }));
  };
  return [pref, choose] as const;
}

/** Small button in the top bar: opens Dark / Light / Match my device. */
export function ThemeMenu({ initial }: { initial: ThemePreference }) {
  const [pref, choose] = useThemePreference(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const Current = OPTIONS.find((o) => o.value === pref)!.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Appearance"
        title="Appearance"
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
      >
        <Current className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-ink-200 bg-white p-1 shadow-lg">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={pref === o.value}
              onClick={() => {
                choose(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-100"
            >
              <o.icon className="size-4 text-ink-500" aria-hidden />
              <span className="flex-1">{o.label}</span>
              {pref === o.value && <Check className="size-4 text-brand-600" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Three cards on My profile → Appearance. */
export function ThemeChooser({ initial }: { initial: ThemePreference }) {
  const [pref, choose] = useThemePreference(initial);
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => choose(o.value)}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
            pref === o.value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400",
          )}
        >
          <o.icon className={cn("mt-0.5 size-4 shrink-0", pref === o.value ? "text-brand-700" : "text-ink-500")} aria-hidden />
          <span>
            <span className="block text-sm font-medium text-ink-900">{o.label}</span>
            <span className="block text-xs text-ink-500">{o.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
