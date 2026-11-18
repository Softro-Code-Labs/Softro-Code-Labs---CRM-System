import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { TWO_FACTOR_ROLES } from "@/lib/security/two-factor";
import { LIMITS } from "@/lib/security/rate-limit";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequireTwoFactorToggle } from "./require-toggle";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  await requirePermission("security:manage");
  const [org, users] = await Promise.all([
    db.orgSettings.findUnique({ where: { id: "default" }, select: { requireTwoFactor: true } }),
    db.user.findMany({ where: { isActive: true }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, role: true, totpEnabledAt: true, recoveryCodeHashes: true, lastLoginAt: true } }),
  ]);
  const withTwoFactor = users.filter((u) => u.totpEnabledAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Security" description="How people sign in to Softro CRM." breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Security" }]} />

      <Card>
        <CardHeader title="Two-step sign-in" description={`${withTwoFactor} of ${users.length} active people have it on.`} />
        <CardBody className="space-y-4">
          <RequireTwoFactorToggle initial={org?.requireTwoFactor ?? false} />
        </CardBody>
        <table className="min-w-full divide-y divide-ink-100 border-t border-ink-100 text-sm">
          <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
            <tr>
              <th className="px-5 py-2.5">Person</th>
              <th className="px-5 py-2.5">Two-step sign-in</th>
              <th className="px-5 py-2.5">Recovery codes</th>
              <th className="px-5 py-2.5">Last sign-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-2.5">
                  <Link href={`/settings/users/${u.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                    {u.name}
                  </Link>
                  <span className="block text-xs text-ink-500">{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-5 py-2.5">
                  {u.totpEnabledAt ? (
                    <Badge tone="green">On since {formatDate(u.totpEnabledAt)}</Badge>
                  ) : (
                    <Badge tone={org?.requireTwoFactor && TWO_FACTOR_ROLES.includes(u.role) ? "red" : "gray"}>{org?.requireTwoFactor && TWO_FACTOR_ROLES.includes(u.role) ? "Required, not set up" : "Off"}</Badge>
                  )}
                </td>
                <td className="px-5 py-2.5 text-ink-600">{u.totpEnabledAt ? `${u.recoveryCodeHashes.length} left` : "—"}</td>
                <td className="px-5 py-2.5 text-ink-600">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="Built-in protections" />
        <CardBody>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-600">
            <li>5 wrong passwords lock an account for 15 minutes. Unlock it early from Team members.</li>
            <li>{LIMITS.loginPerIp.limit} sign-in attempts per {LIMITS.loginPerIp.windowSeconds / 60} minutes from one network, across all accounts.</li>
            <li>{LIMITS.twoFactorPerUser.limit} wrong two-step codes per {LIMITS.twoFactorPerUser.windowSeconds / 60} minutes per person. A code can only be used once.</li>
            <li>{LIMITS.websiteLeadPerIp.limit} website enquiries per {LIMITS.websiteLeadPerIp.windowSeconds / 60} minutes from one visitor.</li>
            <li>Changing a password, role or two-step setting signs that person out everywhere. Sessions last 7 days.</li>
            <li>Every sign-in, change and export is in the <Link href="/settings/audit" className="font-medium text-brand-700 hover:underline">audit log</Link>.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
