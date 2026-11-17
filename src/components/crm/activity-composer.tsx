"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, MessageSquareText, PhoneCall } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";
import { initialFormState } from "@/lib/form";
import { ACTIVITY_TYPE_OPTIONS, PRIORITY_OPTIONS } from "@/lib/crm-meta";
import { addNote, logActivity, scheduleActivity } from "@/app/(app)/activities/actions";
import type { Target } from "@/lib/validation/activity";

type Mode = "note" | "log" | "schedule";

const MODES: { value: Mode; label: string; icon: typeof PhoneCall }[] = [
  { value: "note", label: "Note", icon: MessageSquareText },
  { value: "log", label: "Log a call, chat or meeting", icon: PhoneCall },
  { value: "schedule", label: "Schedule a task", icon: CalendarPlus },
];

export function ActivityComposer({
  target,
  users,
  currentUserId,
  defaultDueAt,
}: {
  target: Target;
  users: { id: string; name: string }[];
  currentUserId: string;
  /** yyyy-mm-ddThh:mm, tomorrow 10:00 Sri Lanka time (worked out on the server). */
  defaultDueAt: string;
}) {
  const [mode, setMode] = useState<Mode>("note");
  const [noteState, noteAction] = useActionState(addNote.bind(null, target), initialFormState);
  const [logState, logAction] = useActionState(logActivity.bind(null, target), initialFormState);
  const [scheduleState, scheduleAction] = useActionState(scheduleActivity.bind(null, target), initialFormState);
  // React clears each form after it's submitted. On a validation error we put
  // the typed values back through defaultValue; on success the form starts blank.
  const nv = (key: string, fallback = "") => noteState.values?.[key] ?? fallback;
  const lv = (key: string, fallback = "") => logState.values?.[key] ?? fallback;
  const sv = (key: string, fallback = "") => scheduleState.values?.[key] ?? fallback;

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-ink-100 px-5 pt-3" role="tablist" aria-label="Add to timeline">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium",
                mode === m.value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800",
              )}
            >
              <Icon className="size-4" aria-hidden /> {m.label}
            </button>
          );
        })}
      </div>

      <div className="px-5 py-4">
        {mode === "note" && (
          <form action={noteAction} className="space-y-3" noValidate>
            <FormMessage message={noteState.message} />
            <TextAreaField
              label="Note"
              name="body"
              rows={3}
              placeholder="Background, decisions, anything the team should know…"
              defaultValue={nv("body")}
              error={noteState.errors?.body}
            />
            <div className="flex justify-end">
              <SubmitButton size="sm">Add note</SubmitButton>
            </div>
          </form>
        )}

        {mode === "log" && (
          <form action={logAction} className="space-y-3" noValidate>
            <FormMessage message={logState.message} />
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <SelectField
                label="What happened?"
                name="type"
                options={ACTIVITY_TYPE_OPTIONS.filter((o) => o.value !== "TASK")}
                defaultValue={lv("type", "WHATSAPP")}
                error={logState.errors?.type}
              />
              <TextField label="Summary" name="subject" placeholder="Discussed budget and timeline" defaultValue={lv("subject")} error={logState.errors?.subject} />
            </div>
            <TextAreaField label="Details (optional)" name="description" rows={2} defaultValue={lv("description")} error={logState.errors?.description} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-500">Logged as done now. On a lead, this also counts as our reply.</p>
              <SubmitButton size="sm">Log it</SubmitButton>
            </div>
          </form>
        )}

        {mode === "schedule" && (
          <form action={scheduleAction} className="space-y-3" noValidate>
            <FormMessage message={scheduleState.message} />
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <SelectField label="Type" name="type" options={ACTIVITY_TYPE_OPTIONS} defaultValue={sv("type", "TASK")} error={scheduleState.errors?.type} />
              <TextField label="What needs doing" name="subject" placeholder="Send revised quote" defaultValue={sv("subject")} error={scheduleState.errors?.subject} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="Due" name="dueAt" type="datetime-local" defaultValue={sv("dueAt", defaultDueAt)} error={scheduleState.errors?.dueAt} />
              <SelectField
                label="Assigned to"
                name="assignedToId"
                options={users.map((u) => ({ value: u.id, label: u.id === currentUserId ? `${u.name} (you)` : u.name }))}
                defaultValue={sv("assignedToId", currentUserId)}
                error={scheduleState.errors?.assignedToId}
              />
              <SelectField label="Priority" name="priority" options={PRIORITY_OPTIONS} defaultValue={sv("priority", "MEDIUM")} error={scheduleState.errors?.priority} />
            </div>
            <TextAreaField label="Details (optional)" name="description" rows={2} defaultValue={sv("description")} error={scheduleState.errors?.description} />
            <div className="flex justify-end">
              <SubmitButton size="sm">Schedule</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
