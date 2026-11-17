"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/enums";
import { NAV_SECTIONS } from "./nav-items";

export function Sidebar({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-950 text-brand-100 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-brand-700">S</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-white">Softro CRM</span>
              <span className="block text-[11px] text-brand-300">Softro Code Labs</span>
            </span>
          </Link>
          <button onClick={onClose} className="rounded p-1 text-brand-300 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
          {NAV_SECTIONS.map((section, i) => {
            const items = section.items.filter((item) => !item.permission || can(role, item.permission));
            if (!items.length) return null;
            return (
              <div key={section.title ?? i}>
                {section.title && (
                  <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-brand-400 uppercase">{section.title}</p>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    const content = (
                      <>
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="flex-1">{item.label}</span>
                        {item.soon && (
                          <span className="rounded bg-brand-900 px-1.5 py-0.5 text-[10px] font-medium text-brand-300">Soon</span>
                        )}
                      </>
                    );
                    return (
                      <li key={item.href}>
                        {item.soon ? (
                          <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-brand-400/70">
                            {content}
                          </span>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={onClose}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              active ? "bg-brand-800 text-white" : "text-brand-200 hover:bg-brand-900 hover:text-white",
                            )}
                          >
                            {content}
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
      </aside>
    </>
  );
}
