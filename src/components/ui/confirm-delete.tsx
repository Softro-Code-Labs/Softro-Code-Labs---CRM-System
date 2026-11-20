"use client";

import { Trash2 } from "lucide-react";
import { ConfirmAction } from "./confirm-action";

/** Delete button that asks in a pop-up, then calls a bound server action. */
export function ConfirmDelete({
  action,
  label = "Delete",
  title = "Delete this for good?",
  body = "This can't be undone.",
}: {
  action: () => Promise<{ message?: string } | void>;
  label?: string;
  title?: string;
  body?: string;
}) {
  return (
    <ConfirmAction title={title} body={body} yes={`Yes, ${label.toLowerCase()}`} onConfirm={action}>
      <Trash2 className="size-4" aria-hidden /> {label}
    </ConfirmAction>
  );
}
