"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmTwoFactorSetup, newRecoveryCodes, startTwoFactorSetup, turnOffTwoFactor } from "./two-factor-actions";

const input = "h-10 w-40 rounded-lg border border-ink-300 bg-white px-3 font-mono text-base tracking-[0.25em] text-ink-900 shadow-sm focus:border-ink-700 focus:ring-2 focus:ring-ink-900/10 focus:outline-none";

function RecoveryCodes({ codes, onDone, doneLabel = "I've saved them" }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Softro CRM recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Save these recovery codes now. They won&apos;t be shown again.</p>
      <p className="text-xs text-amber-800">If you lose your phone, each code lets you sign in once. Keep them in the company password manager, or print them and keep them safe.</p>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-ink-900 sm:grid-cols-5" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); }}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
        <a className="inline-flex h-8 items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 hover:bg-ink-50" download="softro-crm-recovery-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>
          <Download className="size-4" aria-hidden /> Download
        </a>
        <Button type="button" size="sm" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, recoveryLeft, required, onFinished }: { enabled: boolean; recoveryLeft: number; required: boolean; onFinished?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ qrSvg: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"idle" | "regen" | "off">("idle");
  const [error, setError] = useState<string | null>(null);

  const finish = () => {
    setCodes(null);
    setSetup(null);
    setMode("idle");
    setCode("");
    if (onFinished) router.push(onFinished);
    else router.refresh();
  };

  if (codes) return <RecoveryCodes codes={codes} onDone={finish} doneLabel={onFinished ? "I've saved them, continue" : "I've saved them"} />;

  if (!enabled && setup) {
    return (
      <div className="space-y-4 text-sm text-ink-600">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone.</li>
          <li>In the app, tap <strong>+</strong> and scan this QR code.</li>
          <li>Type the 6-digit code the app shows for <strong>Softro CRM</strong>.</li>
        </ol>
        <div className="flex flex-wrap items-start gap-5">
          <div className="theme-fixed size-44 rounded-lg border border-ink-200 bg-white p-2 [&_svg]:size-full" role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <div className="space-y-2">
            <p className="text-xs text-ink-500">Can&apos;t scan? Enter this key in the app instead:</p>
            <p className="font-mono text-sm font-medium break-all text-ink-900" data-testid="totp-secret">{setup.secret}</p>
          </div>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await confirmTwoFactorSetup(code);
              if ("error" in r) setError(r.error);
              else { setError(null); setCodes(r.recoveryCodes); }
            });
          }}
        >
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-ink-700">6-digit code</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={input} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </label>
          <Button type="submit" disabled={pending || code.replace(/\s/g, "").length !== 6}>
            {pending ? "Checking…" : "Turn on"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setSetup(null); setError(null); }}>
            Cancel
          </Button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="space-y-3 text-sm text-ink-600">
        <p>After your password, the CRM also asks for a 6-digit code from an app on your phone. Then a stolen or guessed password alone isn&apos;t enough to get in.</p>
        {required && <p className="font-medium text-amber-800">Required for your role. Set it up to continue.</p>}
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await startTwoFactorSetup();
              if ("error" in r) setError(r.error);
              else { setError(null); setSetup(r); }
            })
          }
        >
          <Smartphone className="size-4" aria-hidden /> Set up two-step sign-in
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-ink-600">
      <p className="flex items-center gap-2 font-medium text-emerald-700">
        <ShieldCheck className="size-4" aria-hidden /> On. You&apos;ll be asked for a code from your authenticator app when you sign in.
      </p>
      <p className={recoveryLeft <= 3 ? "text-amber-700" : undefined}>
        {recoveryLeft} of 10 recovery codes left.{recoveryLeft <= 3 && " Make new ones soon."}
      </p>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setMode("regen")}>
            New recovery codes
          </Button>
          {!required && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode("off")}>
              Turn off
            </Button>
          )}
        </div>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              if (mode === "regen") {
                const r = await newRecoveryCodes(code);
                if ("error" in r) setError(r.error);
                else { setError(null); setCodes(r.recoveryCodes); }
              } else {
                const r = await turnOffTwoFactor(code);
                if ("error" in r) setError(r.error);
                else finish();
              }
            });
          }}
        >
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-ink-700">{mode === "regen" ? "Current code from your app" : "Code from your app, to confirm"}</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={9} className={input} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </label>
          <Button type="submit" size="sm" variant={mode === "off" ? "danger" : "primary"} disabled={pending || !code.trim()}>
            {mode === "regen" ? "Make new codes" : "Turn off two-step sign-in"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setMode("idle"); setCode(""); setError(null); }}>
            Cancel
          </Button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
