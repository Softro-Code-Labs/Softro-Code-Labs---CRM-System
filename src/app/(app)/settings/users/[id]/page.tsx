import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { avatarUrl } from "@/lib/avatar";
import { RemovePhotoButton } from "./remove-photo-button";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { UserForm } from "../user-form";
import { updateUser } from "../actions";
import { UserAdminActions } from "./user-admin-actions";

export const metadata: Metadata = { title: "Team member" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("user:manage");
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { ownedLeads: true, ownedDeals: true, assignedActivities: { where: { completedAt: null } } } } },
  });
  if (!user) notFound();
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={user.name}
        description={user.isActive ? undefined : "Deactivated: can't sign in."}
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Team members", href: "/settings/users" }, { label: user.name }]}
      />

      {user.avatarUpdatedAt && (
        <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <span className="flex items-center gap-3 text-sm text-ink-600">
            <Avatar name={user.name} src={avatarUrl(user)} className="size-12" />
            Profile photo
          </span>
          <RemovePhotoButton id={user.id} />
        </Card>
      )}

      <UserForm
        action={updateUser.bind(null, user.id)}
        isEdit
        initial={{ name: user.name, email: user.email, role: user.role, jobTitle: user.jobTitle ?? "", phone: user.phone ?? "" }}
      />

      <Card>
        <CardHeader title="Access" description="Changing someone's role signs them out so the new permissions apply straight away." />
        <CardBody>
          <UserAdminActions
            id={user.id}
            name={user.name}
            email={user.email}
            isActive={user.isActive}
            isLocked={Boolean(user.lockedUntil && user.lockedUntil > now)}
            isSelf={user.id === me.id}
            hasTwoFactor={Boolean(user.totpEnabledAt)}
          />
        </CardBody>
        <dl className="grid grid-cols-2 gap-px border-t border-ink-100 bg-ink-100 text-sm sm:grid-cols-5">
          {[
            ["Last sign-in", user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"],
            ["Password changed", user.passwordChangedAt ? formatDate(user.passwordChangedAt) : user.mustChangePassword ? "Temporary" : "—"],
            ["Two-step sign-in", user.totpEnabledAt ? "On" : "Off"],
            ["Owns", `${user._count.ownedLeads} leads · ${user._count.ownedDeals} deals`],
            ["Open tasks", String(user._count.assignedActivities)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-5 py-3">
              <dt className="text-xs text-ink-500">{label}</dt>
              <dd className="font-medium text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {!user.isActive && (user._count.ownedDeals > 0 || user._count.assignedActivities > 0) && (
        <p className="text-sm text-amber-700">
          Tip: reassign this person&apos;s open deals and tasks so nothing is forgotten.
        </p>
      )}
    </div>
  );
}
