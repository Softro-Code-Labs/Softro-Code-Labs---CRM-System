import { cn } from "@/lib/utils";

/** "LKR 1.25M", "LKR 480K". Short labels for chart axes and bars; full values are in tooltips and tables. */
export function compactMoney(value: number, currency: string) {
  const n = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: value >= 1_000_000 ? 2 : 0 }).format(value);
  return `${currency} ${n}`;
}
export function fullMoney(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-md bg-ink-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block group-focus-visible:block">
      {children}
    </span>
  );
}

/** Single-series column chart (e.g. won revenue per month). */
export function ColumnChart({ data, currency, caption }: { data: { label: string; value: number }[]; currency: string; caption: string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0);
  const ticks = [max, max / 2, 0];
  return (
    <figure>
      <div className="flex gap-2">
        <div className="flex h-48 flex-col justify-between pb-5 text-right text-[11px] text-ink-400" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">{compactMoney(t, currency).replace(`${currency} `, "")}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={cn("border-t", t === 0 ? "border-ink-300" : "border-dashed border-ink-100")} />
            ))}
          </div>
          <div className="relative flex h-48 items-end gap-[2px]">
            {data.map((d, i) => (
              <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="flex w-full flex-1 items-end justify-center pb-0">
                  <button type="button" tabIndex={0} aria-label={`${d.label}: ${fullMoney(d.value, currency)}`} className="group relative flex h-full w-full max-w-10 items-end justify-center focus:outline-none">
                    {i === peak && d.value > 0 && (
                      <span className="absolute text-[11px] font-medium text-ink-700" style={{ bottom: `calc(${(d.value / max) * 100}% + 4px)` }}>
                        {compactMoney(d.value, currency).replace(`${currency} `, "")}
                      </span>
                    )}
                    <span className={cn("w-full max-w-7 rounded-t-[4px] transition-colors", d.value > 0 ? "bg-brand-600 group-hover:bg-brand-700" : "")} style={{ height: `${(d.value / max) * 100}%` }} />
                    <Tooltip>
                      <span className="block text-ink-300">{d.label}</span>
                      {fullMoney(d.value, currency)}
                    </Tooltip>
                  </button>
                </div>
                <span className="mt-1.5 h-3.5 text-[11px] leading-none whitespace-nowrap text-ink-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fullMoney(d.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Open pipeline per month: the light column is the full value, the dark part is the probability-weighted value. */
export function ForecastChart({ data, currency }: { data: { label: string; total: number; weighted: number; count: number }[]; currency: string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.total)));
  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-600">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-600" /> Weighted by stage probability</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-200" /> Full value if every deal is won</span>
      </div>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden>
          <span className="border-t border-dashed border-ink-100" />
          <span className="border-t border-dashed border-ink-100" />
          <span className="border-t border-ink-300" />
        </div>
        <div className="relative flex h-40 items-end gap-[2px]">
          {data.map((d) => (
            <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
              <button type="button" aria-label={`${d.label}: ${d.count} deals, ${fullMoney(d.total, currency)} total, ${fullMoney(d.weighted, currency)} weighted`} className="group relative flex w-full max-w-10 flex-1 items-end justify-center focus:outline-none">
                <span className="relative flex w-full max-w-7 flex-col justify-end overflow-hidden rounded-t-[4px] bg-brand-200 group-hover:bg-brand-300" style={{ height: `${(d.total / max) * 100}%` }}>
                  <span className="w-full border-t-2 border-white bg-brand-600 first:border-t-0" style={{ height: `${d.total ? (d.weighted / d.total) * 100 : 0}%` }} />
                </span>
                {d.total > 0 && (
                  <Tooltip>
                    <span className="block text-ink-300">{d.label} · {d.count} {d.count === 1 ? "deal" : "deals"}</span>
                    Weighted {fullMoney(d.weighted, currency)}
                    <span className="block">Total {fullMoney(d.total, currency)}</span>
                  </Tooltip>
                )}
              </button>
              <span className="mt-1.5 h-3.5 text-[11px] leading-none text-ink-500">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-right text-[11px] text-ink-400">Scale: 0 – {compactMoney(max, currency)}</p>
    </figure>
  );
}

/** Ranked horizontal bars with the value written beside each bar. */
export function BarList({ rows, empty }: { rows: { label: React.ReactNode; value: number; display: string; key: string }[]; empty: string }) {
  if (!rows.length) return <p className="px-5 py-6 text-sm text-ink-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <ul className="space-y-3 px-5 py-4">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink-700">{r.label}</span>
            <span className="shrink-0 font-medium text-ink-900 tabular-nums">{r.display}</span>
          </div>
          <div className="h-2 rounded-full bg-ink-100">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums", tone === "bad" && "text-red-600")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
