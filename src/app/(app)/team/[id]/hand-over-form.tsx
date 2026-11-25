"use client";

import { useActionState, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-action";
import { handOverWork, type HandOverResult } from "../actions";

/** "Hand over open work to…": moves a member's open leads, deals and tasks to someone else in the team. */
export function HandOverForm({ memberId, memberName, people }: { memberId: string; memberName: string; people: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(handOverWork.bind(null, memberId), {} as HandOverResult);
  const [toId, setToId] = useState("");
  const [asking, setAsking] = useState(false);
  const to = people.find((p) => p.id === toId);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="space-y-3">
      <SelectField
        label="Give all their open leads, deals and tasks to"
        name="toId"
        placeholder="Choose someone…"
        options={people.map((p) => ({ value: p.id, label: p.name }))}
        value={toId}
        onChange={(e) => setToId(e.target.value)}
        hint="For leave or someone moving on. Won deals, quotes and history stay with them."
      />
      <Button type="button" variant="secondary" disabled={!toId || pending} onClick={() => setAsking(true)}>
        <ArrowRightLeft className="size-4" aria-hidden /> {pending ? "Handing over…" : "Hand over work"}
      </Button>
      <ConfirmDialog
        open={asking}
        title={`Hand ${memberName}'s open work to ${to?.name ?? "…"}?`}
        body="Their open leads, open deals and unfinished tasks move to the new owner. You can change any of them back one by one."
        yes="Yes, hand over"
        pending={pending}
        onClose={() => setAsking(false)}
        onYes={() => {
          setAsking(false);
          form.current?.requestSubmit();
        }}
      />
      {state.message && (
        <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-600"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
