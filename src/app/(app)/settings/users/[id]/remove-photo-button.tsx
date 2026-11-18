"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeUserPhoto } from "../actions";

export function RemovePhotoButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!confirm)
    return (
      <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
        Remove photo
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-600">Remove their photo?</span>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => setError((await removeUserPhoto(id)).message ?? null))}>
        Yes, remove
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Cancel
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
