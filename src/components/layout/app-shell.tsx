"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { SoftroMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/permissions";
import { logout } from "@/app/login/actions";
import type { CurrentUser } from "@/lib/auth";
import { ThemeMenu } from "@/components/theme/theme-switcher";
import type { ThemePreference } from "@/lib/theme";

export function AppShell({ user, theme, children }: { user: CurrentUser; theme: ThemePreference; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-full">
      <Sidebar role={user.role} open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <SoftroMark size={26} className="lg:hidden" />
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeMenu initial={theme} />
            <Link href="/settings/profile" className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-ink-100" title="My profile">
              <Avatar name={user.name} />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-ink-900">{user.name}</p>
                <p className="text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
              </div>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="ml-2 rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
