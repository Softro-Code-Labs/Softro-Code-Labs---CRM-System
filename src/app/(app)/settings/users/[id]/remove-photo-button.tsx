"use client";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { removeUserPhoto } from "../actions";

export function RemovePhotoButton({ id }: { id: string }) {
  return (
    <ConfirmAction
      title="Remove their photo?"
      body="Their initials will show instead. They can add a new photo themselves."
      yes="Yes, remove"
      onConfirm={() => removeUserPhoto(id)}
    >
      Remove photo
    </ConfirmAction>
  );
}
