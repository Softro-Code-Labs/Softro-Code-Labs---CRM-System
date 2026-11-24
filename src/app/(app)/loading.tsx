/**
 * Shown the moment someone opens a page, while its data loads: the page header and a list,
 * as soft placeholders. Next.js prefetches this, so the switch feels instant.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" data-page-loading className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton rounded-md h-3 w-32" />
        <div className="skeleton rounded-md h-7 w-64" />
        <div className="skeleton rounded-md h-4 w-96 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <div className="flex gap-3 border-b border-ink-100 px-5 py-4">
          <div className="skeleton rounded-md h-8 w-40" />
          <div className="skeleton rounded-md ml-auto h-8 w-56 max-w-[40%]" />
        </div>
        <ul className="divide-y divide-ink-100">
          {Array.from({ length: 7 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton rounded-md h-4" style={{ width: `${55 - (i % 3) * 12}%` }} />
                <div className="skeleton rounded-md h-3 w-1/3" />
              </div>
              <div className="skeleton hidden h-5 w-20 rounded-full sm:block" />
              <div className="skeleton rounded-md h-4 w-24" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
