import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { avatarUrl } from "@/lib/avatar";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Team members" };

export default async function UsersPage() {
  const me = await requirePermission("user:manage");
  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, jobTitle: true, isActive: true, lastLoginAt: true, mustChangePassword: true, lockedUntil: true, avatarUpdatedAt: true },
  });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Team members"
        description={`${users.filter((u) => u.isActive).length} active of ${users.length}`}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Team members" }]}
        actions={
          <LinkButton href="/settings/users/new">
            <Plus className="size-4" aria-hidden /> Add team member
          </LinkButton>
        }
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last sign-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "hover:bg-ink-50" : "bg-ink-50/50 text-ink-400"}>
                  <td className="px-5 py-3">
                    <Link href={`/settings/users/${u.id}`} className="flex items-center gap-3">
                      <Avatar name={u.name} src={avatarUrl(u)} />
                      <span>
                        <span className="block font-medium text-ink-900 hover:text-brand-700">
                          {u.name} {u.id === me.id && <span className="font-normal text-ink-500">(you)</span>}
                        </span>
                        <span className="block text-xs text-ink-500">{[u.jobTitle, u.email].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={u.role === "ADMIN" ? "brand" : u.role === "MANAGER" ? "purple" : "gray"}>{ROLE_LABELS[u.role]}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {!u.isActive ? (
                        <Badge tone="gray">Deactivated</Badge>
                      ) : u.lockedUntil && u.lockedUntil > now ? (
                        <Badge tone="red" className="gap-1">
                          <Lock className="size-3" aria-hidden /> Locked
                        </Badge>
                      ) : u.mustChangePassword ? (
                        <Badge tone="amber">Temporary password</Badge>
                      ) : (
                        <Badge tone="green">Active</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-ink-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
