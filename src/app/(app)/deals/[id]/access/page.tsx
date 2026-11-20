import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDate, toDateInput } from "@/lib/utils";
import { checkState, getAccessForDeal, type HandoverSnapshot } from "@/lib/project-access";
import {
  ACCESS_CHECKLIST,
  TWO_STEP_LABELS,
  type AccessChecklistKey,
} from "@/lib/crm-meta";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import {
  AccountForm,
  ArchivedBadge,
  Checklist,
  CheckButton,
  HandoverButton,
  LoginSheetForm,
  ServicesManager,
} from "./access-controls";
import { deleteAccess, deleteHandover } from "./actions";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const deal = await db.deal.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: deal ? `Access · ${deal.title}` : "Project access" };
}

export default async function ProjectAccessPage({ params }: Props) {
  const user = await requirePermission("access:view");
  const { id } = await params;
  const [deal, access] = await Promise.all([
    db.deal.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        company: { select: { id: true, name: true } },
      },
    }),
    getAccessForDeal(id),
  ]);
  if (!deal) notFound();
  const canEdit = can(user.role, "access:manage");
  const check = access ? checkState(access) : null;
  const archived = access?.status === "ARCHIVED";
  const [current, ...older] = access?.handovers ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Project access · ${deal.title}`}
        description="Where this project's accounts live and how they're protected. Passwords, keys and codes stay in the password manager, never here."
        breadcrumbs={[
          { label: "Deals", href: "/deals" },
          { label: deal.title, href: `/deals/${deal.id}` },
          { label: "Access" },
        ]}
        actions={
          access &&
          can(user.role, "access:delete") && (
            <ConfirmDelete
              action={deleteAccess.bind(null, access.id)}
              label="Remove register"
            />
          )
        }
      />

      {archived && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
          <ArchivedBadge /> Archived{" "}
          {access?.archivedAt && formatDate(access.archivedAt)}. Everything is
          kept. Reopen it when the client asks for maintenance.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Project Google account"
              description="Sign up for every service with this account, and save passwords and bookmarks in it. Signing in to Chrome with it brings them all back, so no separate browser profile needs to be kept."
            />
            <CardBody>
              <AccountForm
                dealId={deal.id}
                canEdit={canEdit}
                initial={{
                  googleEmail: access?.googleEmail ?? "",
                  recoveryEmail:
                    access?.recoveryEmail ?? "admin@softrocodelabs.com",
                  recoveryPhone: access?.recoveryPhone ?? "",
                  twoStep: access?.twoStep ?? "AUTHENTICATOR",
                  secretsLocation: access?.secretsLocation ?? "",
                  envLocation: access?.envLocation ?? "",
                  notes: access?.notes ?? "",
                }}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Sign-in check" />
            <CardBody className="space-y-3 text-sm text-ink-600">
              {!access?.googleEmail ? (
                <p>Add the project Gmail to start the 6-monthly reminder.</p>
              ) : (
                <>
                  {check?.state === "overdue" || check?.state === "never" ? (
                    <p className="flex items-start gap-2 font-medium text-red-600">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      {check.state === "never"
                        ? "Never checked."
                        : "Check overdue."}{" "}
                      Sign in to the Gmail and confirm the 2-step codes work.
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-emerald-700">
                      <ShieldCheck
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />{" "}
                      Checked {formatDate(access.lastCheckedAt)}
                      {access.lastCheckedBy &&
                        ` by ${access.lastCheckedBy.name}`}
                      .
                    </p>
                  )}
                  {check?.dueAt && (
                    <p className="flex items-center gap-2 text-xs text-ink-500">
                      <CalendarClock className="size-3.5" aria-hidden /> Next
                      check by {formatDate(check.dueAt)}. A task reminds the
                      deal owner.
                    </p>
                  )}
                  <p className="text-xs text-ink-500">
                    2-step: {TWO_STEP_LABELS[access.twoStep]}
                    {access.twoStep === "NONE" && ". Turn it on!"}
                  </p>
                  {canEdit && <CheckButton accessId={access.id} />}
                </>
              )}
            </CardBody>
          </Card>

          {access && (
            <Card>
              <CardHeader
                title="Close-out checklist"
                description="When the project is finished. Then archive it: nothing is deleted."
              />
              <CardBody>
                <Checklist
                  accessId={access.id}
                  archived={archived}
                  canEdit={canEdit}
                  values={
                    Object.fromEntries(
                      ACCESS_CHECKLIST.map((c) => [c.key, access[c.key]]),
                    ) as Record<AccessChecklistKey, boolean>
                  }
                />
              </CardBody>
            </Card>
          )}

          {access && (
            <Card>
              <CardHeader
                title="Project Delivery Pack"
                description="For the client: services, owners, renewals and support. No passwords: those go in the login sheet."
              />
              {current && (
                <a
                  href={`/handovers/${current.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-start gap-3 border-b border-ink-100 px-5 py-3 text-sm hover:bg-ink-50"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-mono font-medium whitespace-nowrap text-ink-900">{current.number}</span>
                    <span className="block text-xs text-ink-500">
                      Version {(current.snapshot as unknown as HandoverSnapshot).version ?? 1} · updated {formatDate(current.issuedAt)}
                      {current.issuedBy && ` by ${current.issuedBy.name}`}
                    </span>
                  </span>
                </a>
              )}
              {older.length > 0 && (
                <div className="border-b border-ink-100 px-5 py-3">
                  <p className="mb-1.5 text-xs font-medium text-ink-600">Extra packs (made before packs were updated in place)</p>
                  <ul className="space-y-1.5">
                    {older.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <a href={`/handovers/${h.id}/pdf`} target="_blank" rel="noopener" className="font-mono whitespace-nowrap text-ink-600 hover:text-brand-700">
                          {h.number} · {formatDate(h.issuedAt)}
                        </a>
                        {can(user.role, "access:delete") && <ConfirmDelete action={deleteHandover.bind(null, h.id)} label="Delete" />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canEdit && (
                <CardBody className="space-y-2">
                  <HandoverButton accessId={access.id} exists={Boolean(current)} />
                  {current && <p className="text-xs text-ink-500">Updates the same pack with today&apos;s services. The number stays the same; the version goes up.</p>}
                </CardBody>
              )}
            </Card>
          )}

          {deal.company && (
            <p className="flex items-center gap-2 px-1 text-xs text-ink-500">
              <KeyRound className="size-3.5" aria-hidden /> All projects for{" "}
              <Link
                href={`/access?q=${encodeURIComponent(deal.company.name)}`}
                className="text-brand-700 hover:underline"
              >
                {deal.company.name}
              </Link>
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader
          title={`Services (${access?.services.length ?? 0})`}
          description="Every account made for this project. No passwords: just where it is and how to get in."
        />
        <ServicesManager
          accessId={access?.id ?? null}
          canEdit={canEdit}
          defaultEmail={access?.googleEmail ?? ""}
          services={(access?.services ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            url: s.url ?? "",
            loginEmail: s.loginEmail ?? "",
            signIn: s.signIn,
            owner: s.owner,
            renewsAt: s.renewsAt ? toDateInput(s.renewsAt) : "",
            renewsAtLabel: s.renewsAt ? formatDate(s.renewsAt) : null,
            notes: s.notes ?? "",
          }))}
        />
      </Card>

      {access &&
        canEdit &&
        (access.googleEmail || access.services.length > 0) && (
          <Card>
            <CardHeader
              title="Login sheet"
              description="The passwords, for the client: a separate PDF locked with its own password. Nothing you type here is saved."
            />
            <CardBody>
              <LoginSheetForm
                dealId={deal.id}
                gmail={access.googleEmail}
                services={access.services.map((x) => ({
                  id: x.id,
                  name: x.name,
                  signIn: x.signIn,
                  loginEmail: x.loginEmail,
                }))}
              />
            </CardBody>
          </Card>
        )}
    </div>
  );
}
