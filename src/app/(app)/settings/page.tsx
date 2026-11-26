import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BadgePercent, Building, ScrollText, ChevronRight, History, KanbanSquare, Package, Plug, ShieldCheck, UserCircle, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS: { href: string; title: string; description: string; icon: typeof Users; permission?: Permission }[] = [
  { href: "/settings/users", title: "Team members", description: "Add staff, set roles, reset passwords and deactivate leavers.", icon: Users, permission: "user:manage" },
  { href: "/settings/pipeline", title: "Sales pipeline", description: "Rename, reorder, add or remove deal stages and their win %.", icon: KanbanSquare, permission: "pipeline:manage" },
  { href: "/settings/company", title: "Company details", description: "Softro's address, BR and VAT numbers, bank details and quote terms.", icon: Building, permission: "org:manage" },
  { href: "/settings/documents", title: "Warranty & NDA", description: "Bug-fix and warranty periods, and the wording of the warranty and non-disclosure agreement for Delivery Packs.", icon: ScrollText, permission: "org:manage" },
  { href: "/settings/finance", title: "Commission", description: "Sales commission percentages for sales people, their managers, and Managers or Admins who sell.", icon: BadgePercent, permission: "org:manage" },
  { href: "/settings/products", title: "Services & prices", description: "Your standard services and prices, ready to add to quotes.", icon: Package, permission: "product:manage" },
  { href: "/settings/integrations", title: "Integrations", description: "Email, team chat, website form, morning summaries and calendar links.", icon: Plug, permission: "integration:manage" },
  { href: "/settings/security", title: "Security", description: "Two-step sign-in rules and who has it switched on.", icon: ShieldCheck, permission: "security:manage" },
  { href: "/settings/system", title: "System health", description: "Errors, database status, configuration checks and backups.", icon: Activity, permission: "system:view" },
  { href: "/settings/audit", title: "Audit log", description: "Who did what and when: sign-ins, changes and deletions.", icon: History, permission: "audit:view" },
  { href: "/settings/profile", title: "My profile", description: "Your details, password, two-step sign-in, email notifications and calendar link.", icon: UserCircle },
];

export default async function SettingsPage() {
  const user = await requirePermission("settings:view");
  const sections = SECTIONS.filter((s) => !s.permission || can(user.role, s.permission));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Manage your team and how Softro CRM works." />
      <Card>
        <ul className="divide-y divide-ink-100">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.href}>
                <Link href={s.href} className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink-900">{s.title}</span>
                    <span className="block text-sm text-ink-500">{s.description}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
