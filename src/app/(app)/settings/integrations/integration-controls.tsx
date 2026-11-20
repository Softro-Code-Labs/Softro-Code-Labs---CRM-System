"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckboxField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState } from "@/lib/form";
import { removeChatWebhook, saveChatSettings } from "./actions";
import { ConfirmAction } from "@/components/ui/confirm-action";

type Result = { ok?: boolean; message: string };

/** A button that runs a server action and shows its result next to it. */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  confirm,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [asking, setAsking] = useState(false);
  const run = () => start(async () => setResult(await action()));
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {asking ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-600">{confirm}</span>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setAsking(false);
              run();
            }}
          >
            Yes
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAsking(false)}
          >
            No
          </Button>
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          variant={variant}
          disabled={pending}
          onClick={() => (confirm ? setAsking(true) : run())}
        >
          {pending ? "Working…" : children}
        </Button>
      )}
      {result && (
        <span
          role="status"
          className={
            result.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"
          }
        >
          {result.message}
        </span>
      )}
    </span>
  );
}

export function ChatForm({
  connected,
  masked,
  kindLabel,
  initial,
}: {
  connected: boolean;
  masked: string | null;
  kindLabel: string | null;
  initial: {
    chatNotifyLeads: boolean;
    chatNotifyWins: boolean;
    chatNotifyTickets: boolean;
  };
}) {
  const [state, action] = useActionState(saveChatSettings, initialFormState);
  const v = state.values;
  const checked = (name: keyof typeof initial) =>
    v ? v[name] === "on" : initial[name];
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage message={state.ok ? undefined : state.message} />
      {connected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm">
          <span>
            Connected to <strong>{kindLabel}</strong>{" "}
            <span className="font-mono text-xs text-ink-500">{masked}</span>
          </span>
          <ConfirmAction
            variant="ghost"
            question="Disconnect team chat? Messages stop until you add a webhook again."
            yes="Yes, disconnect"
            onConfirm={async () => void (await removeChatWebhook())}
          >
            Disconnect
          </ConfirmAction>
        </div>
      )}
      <TextField
        label={
          connected
            ? "New webhook address (leave blank to keep the current one)"
            : "Incoming webhook address"
        }
        name="chatWebhookUrl"
        type="url"
        autoComplete="off"
        placeholder="https://hooks.slack.com/services/…  or  https://chat.googleapis.com/v1/spaces/…"
        defaultValue={v?.chatWebhookUrl}
        error={state.errors?.chatWebhookUrl}
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink-700">
          Post a message when…
        </legend>
        <CheckboxField
          label="A new enquiry arrives from the website"
          name="chatNotifyLeads"
          defaultChecked={checked("chatNotifyLeads")}
          key={`l${String(checked("chatNotifyLeads"))}`}
        />
        <CheckboxField
          label="A deal is won"
          name="chatNotifyWins"
          defaultChecked={checked("chatNotifyWins")}
          key={`w${String(checked("chatNotifyWins"))}`}
        />
        <CheckboxField
          label="An urgent or high-priority support ticket is opened"
          name="chatNotifyTickets"
          defaultChecked={checked("chatNotifyTickets")}
          key={`t${String(checked("chatNotifyTickets"))}`}
        />
      </fieldset>
      <div className="flex items-center gap-3">
        <SubmitButton size="sm">Save</SubmitButton>
        {state.ok && (
          <span className="text-xs text-emerald-700">{state.message}</span>
        )}
      </div>
    </form>
  );
}
