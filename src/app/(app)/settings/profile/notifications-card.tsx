"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCalendarLink, removeCalendarLink, sendMyDigestNow, updateNotificationPrefs } from "./actions";

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        <span className="block text-xs text-ink-500">{hint}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-ink-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}

export function NotificationsCard({ initial, emailReady }: { initial: { emailNotifications: boolean; dailyDigest: boolean }; emailReady: boolean }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();
  const [digestMsg, setDigestMsg] = useState<{ ok?: boolean; message: string } | null>(null);

  const save = (next: typeof prefs) => {
    setPrefs(next);
    start(async () => {
      await updateNotificationPrefs(next);
    });
  };

  return (
    <div className="divide-y divide-ink-100">
      {!emailReady && <p className="pb-3 text-xs text-amber-700">Email isn&apos;t connected yet, so nothing will be sent until an admin sets it up.</p>}
      <Toggle
        label="Email me when something is given to me"
        hint="A lead, task, call, meeting or support ticket someone else assigns to you, and new website enquiries you own."
        checked={prefs.emailNotifications}
        disabled={pending}
        onChange={(v) => save({ ...prefs, emailNotifications: v })}
      />
      <Toggle
        label="Morning summary"
        hint="8 am on working days: overdue and today's tasks, leads and tickets waiting for a reply. Only sent if there's something to do."
        checked={prefs.dailyDigest}
        disabled={pending}
        onChange={(v) => save({ ...prefs, dailyDigest: v })}
      />
      <div className="flex flex-wrap items-center gap-3 pt-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setDigestMsg(await sendMyDigestNow());
            })
          }
        >
          <Mail className="size-4" aria-hidden /> Email me today&apos;s summary now
        </Button>
        {digestMsg && <span className={digestMsg.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{digestMsg.message}</span>}
      </div>
    </div>
  );
}

export function CalendarCard({ hasLink }: { hasLink: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await createCalendarLink();
      setUrl(r.url);
      setCopied(false);
    });

  return (
    <div className="space-y-3 text-sm text-ink-600">
      <p>See your open tasks, calls and meetings in Google Calendar, Outlook or your phone&apos;s calendar. It updates about every hour, and it&apos;s read-only: tick tasks off here in the CRM.</p>
      {url ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-800">Your private calendar link. Copy it now: for your security it won&apos;t be shown again.</p>
          <div className="flex gap-2">
            <input readOnly value={url} aria-label="Calendar link" onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-2.5 font-mono text-xs text-ink-800" />
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-ink-600">
            <strong>Google Calendar:</strong> Other calendars → + → From URL → paste. <strong>Outlook:</strong> Add calendar → Subscribe from web. Don&apos;t share this link: anyone with it can see your tasks.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={hasLink || url ? "secondary" : "primary"} disabled={pending} onClick={create}>
          <CalendarPlus className="size-4" aria-hidden /> {hasLink || url ? "Make a new link" : "Create my calendar link"}
        </Button>
        {(hasLink || url) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await removeCalendarLink();
                setUrl(null);
              })
            }
          >
            Turn off
          </Button>
        )}
      </div>
      {hasLink && !url && <p className="text-xs text-ink-500">A link is active. Making a new link stops the old one working. Do this if it was shared by mistake.</p>}
    </div>
  );
}
