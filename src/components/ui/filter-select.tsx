"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A dropdown that writes its value to a URL search param (e.g. ?source=WHATSAPP). */
export function FilterSelect({ param, label, options }: { param: string; label: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? "";

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set(param, e.target.value);
        else params.delete(param);
        params.delete("page");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      }}
      className="h-9 rounded-lg border border-ink-300 bg-white px-2.5 text-sm text-ink-700 shadow-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
