"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  ExternalLink,
  FileDown,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState } from "@/lib/form";
import { ConfirmAction } from "@/components/ui/confirm-action";
import {
  ACCESS_CHECKLIST,
  ACCOUNT_OWNER_LABELS,
  ACCOUNT_OWNER_OPTIONS,
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_OPTIONS,
  SIGN_IN_LABELS,
  SIGN_IN_OPTIONS,
  TWO_STEP_OPTIONS,
  type AccessChecklistKey,
} from "@/lib/crm-meta";
import {
  createHandover,
  deleteService,
  markChecked,
  saveAccess,
  saveService,
  setArchived,
  setChecklistItem,
} from "./actions";

const SECRET_HINT =
  "Never type passwords, keys or codes here. Write where they're kept.";

/* ── Project Google account ─────────────────────────────────────────── */

export type AccountValues = {
  googleEmail: string;
  recoveryEmail: string;
  recoveryPhone: string;
  twoStep: string;
  secretsLocation: string;
  envLocation: string;
  notes: string;
};

export function AccountForm({
  dealId,
  initial,
  canEdit,
}: {
  dealId: string;
  initial: AccountValues;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    saveAccess.bind(null, dealId),
    initialFormState,
  );
  const v = { ...initial, ...state.values };
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.ok ? undefined : state.message} />
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Project Gmail"
          name="googleEmail"
          type="email"
          placeholder="galle.hardware.softro@gmail.com"
          hint="Every service for this project is signed up with this account."
          defaultValue={v.googleEmail}
          error={state.errors?.googleEmail}
        />
        <SelectField
          label="2-step verification"
          name="twoStep"
          options={TWO_STEP_OPTIONS}
          defaultValue={v.twoStep}
          error={state.errors?.twoStep}
        />
        <TextField
          label="Recovery email"
          name="recoveryEmail"
          type="email"
          placeholder="admin@softrocodelabs.com"
          hint="A company address, never a personal one."
          defaultValue={v.recoveryEmail}
          error={state.errors?.recoveryEmail}
        />
        <TextField
          label="Recovery phone"
          name="recoveryPhone"
          placeholder="Company phone, e.g. 077 278 0771"
          hint="A company number, never a personal one."
          defaultValue={v.recoveryPhone}
          error={state.errors?.recoveryPhone}
        />
        <TextField
          label="Password and backup codes are kept in"
          name="secretsLocation"
          placeholder="Gmail password in Google Password Manager (Softro admin) · backup codes in company Drive → Security"
          hint={SECRET_HINT}
          className="sm:col-span-2"
          defaultValue={v.secretsLocation}
          error={state.errors?.secretsLocation}
        />
        <TextField
          label="Settings (.env) are kept in"
          name="envLocation"
          placeholder="Vercel project settings (vercel env pull) · copy in the project's Google Drive /env"
          hint="Shown to the client in the Project Delivery Pack, so keep it plain."
          className="sm:col-span-2"
          defaultValue={v.envLocation}
          error={state.errors?.envLocation}
        />
        <TextAreaField
          label="Notes"
          name="notes"
          rows={3}
          placeholder="Anything the next developer should know."
          hint={SECRET_HINT}
          className="sm:col-span-2"
          defaultValue={v.notes}
          error={state.errors?.notes}
        />
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          {state.ok && (
            <span className="text-sm text-emerald-700">{state.message}</span>
          )}
        </div>
      )}
    </form>
  );
}

/* ── Services ───────────────────────────────────────────────────────── */

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  url: string;
  loginEmail: string;
  signIn: string;
  owner: string;
  renewsAt: string;
  renewsAtLabel: string | null;
  notes: string;
};

function ServiceForm({
  accessId,
  service,
  defaultEmail,
  onDone,
}: {
  accessId: string;
  service: ServiceRow | null;
  defaultEmail: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(
    async (prev: typeof initialFormState, fd: FormData) => {
      const r = await saveService(accessId, service?.id ?? null, prev, fd);
      if (r.ok) onDone();
      return r;
    },
    initialFormState,
  );
  const v = {
    ...(service ?? {
      name: "",
      category: "HOSTING",
      url: "",
      loginEmail: defaultEmail,
      signIn: "GOOGLE",
      owner: "SOFTRO",
      renewsAt: "",
      notes: "",
    }),
    ...state.values,
  };
  return (
    <form
      action={action}
      className="space-y-4 rounded-lg border border-ink-200 bg-ink-50 p-4"
      noValidate
    >
      <FormMessage message={state.ok ? undefined : state.message} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Service"
          name="name"
          required
          placeholder="Vercel"
          defaultValue={v.name}
          error={state.errors?.name}
        />
        <SelectField
          label="Type"
          name="category"
          options={SERVICE_CATEGORY_OPTIONS}
          defaultValue={v.category}
        />
        <TextField
          label="Address"
          name="url"
          placeholder="vercel.com/softro/galle-hardware"
          defaultValue={v.url}
          error={state.errors?.url}
        />
        <TextField
          label="Login email or username"
          name="loginEmail"
          defaultValue={v.loginEmail}
          error={state.errors?.loginEmail}
        />
        <SelectField
          label="How we sign in"
          name="signIn"
          options={SIGN_IN_OPTIONS}
          defaultValue={v.signIn}
        />
        <SelectField
          label="Account owner"
          name="owner"
          options={ACCOUNT_OWNER_OPTIONS}
          defaultValue={v.owner}
        />
        <TextField
          label="Renews on"
          name="renewsAt"
          type="date"
          hint="Domains, paid plans… We'll remind you 30 days before."
          defaultValue={v.renewsAt}
          error={state.errors?.renewsAt}
        />
        <TextField
          label="Notes"
          name="notes"
          className="sm:col-span-2"
          placeholder="e.g. Client added us as a team member"
          hint={SECRET_HINT}
          defaultValue={v.notes}
          error={state.errors?.notes}
        />
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm">
          {service ? "Save service" : "Add service"}
        </SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ServicesManager({
  accessId,
  services,
  defaultEmail,
  canEdit,
}: {
  accessId: string | null;
  services: ServiceRow[];
  defaultEmail: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <div>
      {services.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-left text-xs font-medium tracking-wide text-ink-500 uppercase">
              <tr>
                <th className="px-5 py-2.5">Service</th>
                <th className="px-5 py-2.5">Login</th>
                <th className="px-5 py-2.5">Owner</th>
                <th className="px-5 py-2.5">Renews</th>
                {canEdit && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {services.map((s) =>
                editing === s.id && accessId ? (
                  <tr key={s.id}>
                    <td colSpan={5} className="px-5 py-3">
                      <ServiceForm
                        accessId={accessId}
                        service={s}
                        defaultEmail={defaultEmail}
                        onDone={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="align-top">
                    <td className="px-5 py-3">
                      <span className="font-medium text-ink-900">{s.name}</span>
                      <span className="block text-xs text-ink-500">
                        {
                          SERVICE_CATEGORY_LABELS[
                            s.category as keyof typeof SERVICE_CATEGORY_LABELS
                          ]
                        }
                      </span>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-0.5 inline-flex max-w-56 items-center gap-1 truncate text-xs text-brand-700 hover:underline"
                        >
                          {s.url.replace(/^https?:\/\//, "")}{" "}
                          <ExternalLink
                            className="size-3 shrink-0"
                            aria-hidden
                          />
                        </a>
                      )}
                      {s.notes && (
                        <span className="mt-1 block max-w-72 text-xs whitespace-pre-line text-ink-500">
                          {s.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      {s.loginEmail || "—"}
                      <span className="block text-xs text-ink-500">
                        {
                          SIGN_IN_LABELS[
                            s.signIn as keyof typeof SIGN_IN_LABELS
                          ]
                        }
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-700">
                      {
                        ACCOUNT_OWNER_LABELS[
                          s.owner as keyof typeof ACCOUNT_OWNER_LABELS
                        ]
                      }
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-ink-700">
                      {s.renewsAtLabel ?? "—"}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditing(s.id)}
                          className="rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <ConfirmAction
                          iconOnly
                          className="rounded p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                          ariaLabel={`Remove ${s.name}`}
                          title={`Remove ${s.name}?`}
                          body="It comes off this project's list and the Delivery Pack. The account itself isn't touched."
                          yes="Yes, remove"
                          onConfirm={async () =>
                            void (await deleteService(s.id))
                          }
                        >
                          <Trash2 className="size-4" />
                        </ConfirmAction>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-ink-500">
          No services yet. Add each account made for this project: domain,
          hosting, Vercel, GitHub, database, email, payments…
        </p>
      )}
      {canEdit && (
        <div className="border-t border-ink-100 px-5 py-4">
          {!accessId ? (
            <p className="text-sm text-ink-500">
              Save the project account above first.
            </p>
          ) : editing === "new" ? (
            <ServiceForm
              accessId={accessId}
              service={null}
              defaultEmail={defaultEmail}
              onDone={() => setEditing(null)}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing("new")}
            >
              <Plus className="size-4" aria-hidden /> Add a service
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 6-monthly check ────────────────────────────────────────────────── */

export function CheckButton({ accessId }: { accessId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; message?: string } | null>(
    null,
  );
  return (
    <span className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => setMsg(await markChecked(accessId)))}
      >
        <ShieldCheck className="size-4" aria-hidden /> I signed in and checked
        it
      </Button>
      {msg?.message && (
        <span
          className={
            msg.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"
          }
        >
          {msg.message}
        </span>
      )}
    </span>
  );
}

/* ── Close-out checklist ────────────────────────────────────────────── */

export function Checklist({
  accessId,
  values,
  archived,
  canEdit,
}: {
  accessId: string;
  values: Record<AccessChecklistKey, boolean>;
  archived: boolean;
  canEdit: boolean;
}) {
  const [state, setState] = useState(values);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = ACCESS_CHECKLIST.filter((c) => state[c.key]).length;
  const all = done === ACCESS_CHECKLIST.length;
  return (
    <div className="space-y-4">
      <ul className="space-y-2.5">
        {ACCESS_CHECKLIST.map((c) => (
          <li key={c.key}>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-ink-300 text-brand-600"
                checked={state[c.key]}
                disabled={!canEdit || pending || archived}
                onChange={(e) => {
                  const next = e.target.checked;
                  setState((s) => ({ ...s, [c.key]: next }));
                  start(async () => {
                    const r = await setChecklistItem(accessId, c.key, next);
                    if (r.message) setError(r.message);
                  });
                }}
              />
              <span
                className={
                  state[c.key] ? "text-ink-500 line-through" : "text-ink-800"
                }
              >
                {c.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
          {archived ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () =>
                  setError(
                    (await setArchived(accessId, false)).message ?? null,
                  ),
                )
              }
            >
              <RotateCcw className="size-4" aria-hidden /> Reopen for
              maintenance
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={pending || !all}
              onClick={() =>
                start(async () =>
                  setError((await setArchived(accessId, true)).message ?? null),
                )
              }
            >
              <Archive className="size-4" aria-hidden /> Archive project access
            </Button>
          )}
          {!archived && (
            <span className="text-xs text-ink-500">
              {all
                ? "Everything's safe. You can archive it."
                : `${done} of ${ACCESS_CHECKLIST.length} done`}
            </span>
          )}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Project Delivery Pack ─────────────────────────────────────────────── */

export function HandoverButton({
  accessId,
  exists,
  had,
}: {
  accessId: string;
  exists: boolean;
  /** Whether the current pack already includes them, so an update keeps the same choice by default. */
  had?: { warranty: boolean; nda: boolean };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warranty, setWarranty] = useState(had?.warranty ?? false);
  const [nda, setNda] = useState(had?.nda ?? false);
  return (
    <span className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-1.5 text-sm text-ink-700">
        <input type="checkbox" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} className="size-4 accent-brand-600" />
        Add warranty
      </label>
      <label className="flex items-center gap-1.5 text-sm text-ink-700">
        <input type="checkbox" checked={nda} onChange={(e) => setNda(e.target.checked)} className="size-4 accent-brand-600" />
        Add NDA
      </label>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createHandover(accessId, { warranty, nda });
            if (r.id) {
              window.open(`/handovers/${r.id}/pdf`, "_blank", "noopener");
              router.refresh();
            } else setError(r.message ?? "Couldn't make it.");
          })
        }
      >
        <FileDown className="size-4" aria-hidden />{" "}
        {pending
          ? exists
            ? "Updating…"
            : "Creating…"
          : exists
            ? "Update Project Delivery Pack"
            : "Create Project Delivery Pack"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

/* ── Login sheet ────────────────────────────────────────────────────── */

type SheetService = {
  id: string;
  name: string;
  signIn: keyof typeof SIGN_IN_LABELS;
  loginEmail: string | null;
};

/**
 * Passwords are typed here only to make the PDF. They're sent once, put in the PDF, and never saved.
 * The form clears itself afterwards.
 */
export function LoginSheetForm({
  dealId,
  gmail,
  services,
}: {
  dealId: string;
  gmail: string | null;
  services: SheetService[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const withPassword = services.filter(
    (x) => x.signIn === "PASSWORD_IN_GOOGLE" || x.signIn === "OTHER",
  );
  const viaAccount = services.filter(
    (x) => x.signIn === "GOOGLE" || x.signIn === "GITHUB",
  );
  const off = {
    autoComplete: "new-password",
    spellCheck: false,
    "data-1p-ignore": true,
    "data-lpignore": "true",
  } as const;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    setPending(true);
    try {
      const res = await fetch(`/deals/${dealId}/access/login-sheet`, {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      if (!res.ok) {
        setError(
          ((await res.json().catch(() => null)) as { message?: string } | null)
            ?.message ?? "Couldn't make the sheet.",
        );
        return;
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(
          res.headers.get("content-disposition") ?? "",
        )?.[1] ?? "Login sheet.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      formRef.current?.reset();
      setDone(true);
    } catch {
      setError("Couldn't make the sheet. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="space-y-4"
      autoComplete="off"
      noValidate
    >
      <p className="flex gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Type the passwords only to make the PDF. They are never saved in the
        CRM, and this form clears itself afterwards. Leave a box empty to give
        that password another way.
      </p>

      {gmail && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={`Gmail password (${gmail})`}
            name="gmailPassword"
            type="password"
            {...off}
          />
          <TextAreaField
            label="Gmail backup codes"
            name="backupCodes"
            rows={2}
            placeholder="Optional. Paste the unused codes."
            {...off}
          />
        </div>
      )}

      {withPassword.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {withPassword.map((x) => (
            <TextField
              key={x.id}
              label={`${x.name} password`}
              name={`pw_${x.id}`}
              type="password"
              hint={x.loginEmail ?? gmail ?? undefined}
              {...off}
            />
          ))}
        </div>
      )}

      {viaAccount.length > 0 && (
        <p className="text-xs text-ink-500">
          No password needed (the sheet says how to sign in):{" "}
          {viaAccount
            .map((x) => `${x.name} (${SIGN_IN_LABELS[x.signIn]})`)
            .join(", ")}
          .
        </p>
      )}

      <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
        <TextField
          label="PDF password"
          name="pdfPassword"
          type="password"
          required
          hint="Needed to open the PDF. Tell the client by phone or WhatsApp, never in the same email as the file."
          {...off}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            <KeyRound className="size-4" aria-hidden />{" "}
            {pending ? "Making…" : "Download login sheet"}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-emerald-700">
          Downloaded. The passwords weren&apos;t saved, and the form has been
          cleared.
        </p>
      )}
    </form>
  );
}

export function ArchivedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700 ring-1 ring-ink-200 ring-inset">
      <CheckCircle2 className="size-3.5" aria-hidden /> Archived
    </span>
  );
}
