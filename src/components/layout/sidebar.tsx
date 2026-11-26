"use client";

import Link, { useLinkStatus } from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";
import { SoftroCrmLogo } from "@/components/brand/logo";
import { NAV_SECTIONS } from "./nav-items";
import { usePageLoading } from "./navigation-progress";

/** A small spinner on the item you just clicked, until its page (not just its placeholders) has arrived. */
function PendingDot({ active, pageLoading }: { active: boolean; pageLoading: boolean }) {
  const { pending: linkPending } = useLinkStatus();
  const pending = linkPending || (active && pageLoading);
  return (
    <span
      aria-hidden
      className={cn(
        "size-3 shrink-0 rounded-full border-[1.5px] border-white/25 border-t-white transition-opacity duration-150 motion-safe:animate-spin",
        pending ? "opacity-100 delay-100" : "opacity-0",
      )}
    />
  );
}

export function Sidebar({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  // Highlight the clicked item straight away, before its page has loaded.
  // Forgotten as soon as the address changes (including Back and Forward), so it can't stick.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setClicked(null);
  }
  const pendingHref = clicked && clicked.from === pathname ? clicked.href : null;
  const pageLoading = usePageLoading();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink-950/50 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          "theme-fixed fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/5 bg-ink-950 text-ink-300 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" onClick={onClose} aria-label="Softro CRM home">
            <SoftroCrmLogo tone="dark" />
          </Link>
          <button onClick={onClose} className="rounded p-1 text-ink-400 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="scrollbar-on-dark flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV_SECTIONS.map((section, i) => {
            const items = section.items.filter((item) => !item.permission || can(role, item.permission));
            if (!items.length) return null;
            return (
              <div key={section.title ?? i}>
                {section.title && (
                  <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">{section.title}</p>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = pendingHref ? pendingHref === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    const content = (
                      <>
                        <Icon className={cn("size-4 shrink-0", active && "text-brand-400")} aria-hidden />
                        <span className="flex-1">{role === "ADMIN" && item.adminLabel ? item.adminLabel : item.label}</span>
                        {item.soon && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">Soon</span>
                        )}
                      </>
                    );
                    return (
                      <li key={item.href}>
                        {item.soon ? (
                          <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600">
                            {content}
                          </span>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => {
                              setClicked({ href: item.href, from: pathname });
                              onClose();
                            }}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              active ? "bg-white/[0.07] text-white" : "text-ink-300 hover:bg-white/[0.04] hover:text-white",
                            )}
                          >
                            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-500" aria-hidden />}
                            {content}
                            <PendingDot active={active} pageLoading={pageLoading} />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <p className="px-5 py-4 text-[11px] text-ink-600">by Softro Code Labs</p>
      </aside>
    </>
  );
}
