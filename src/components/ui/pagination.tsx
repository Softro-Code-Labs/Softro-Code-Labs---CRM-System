import Link from "next/link";
import { buttonClass } from "./button";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
      <span>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}>
            Previous
          </Link>
        ) : (
          <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")}>Previous</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonClass("secondary", "sm")}>
            Next
          </Link>
        ) : (
          <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-50")}>Next</span>
        )}
      </div>
    </div>
  );
}
