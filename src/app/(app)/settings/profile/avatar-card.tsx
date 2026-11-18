"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeAvatar, uploadAvatar } from "./avatar-actions";

const SIDE = 512;

/** Crop the middle square and shrink it in the browser, so even a 12 MB phone photo uploads as ~150 KB. */
async function squareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(SIDE, side);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarCard({ name, initialUrl }: { name: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage({ ok: false, text: "Choose a photo (JPG, PNG or WebP)." });
    setMessage(null);
    start(async () => {
      let blob: Blob = file;
      try {
        blob = await squareJpeg(file);
      } catch {
        // The browser couldn't read it (e.g. HEIC on Windows): send the original and let the server decide.
      }
      const local = URL.createObjectURL(blob);
      setPreview(local);
      const form = new FormData();
      form.set("photo", blob, "photo.jpg");
      const r = await uploadAvatar(form);
      URL.revokeObjectURL(local);
      setPreview(null);
      if (r.ok) {
        setUrl(r.url);
        setMessage({ ok: true, text: "Photo updated." });
      } else setMessage({ ok: false, text: r.message });
      if (input.current) input.current.value = "";
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div
        className="relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files[0]);
        }}
      >
        <Avatar name={name} src={preview ?? url} className={pending ? "size-20 text-xl opacity-60" : "size-20 text-xl"} />
        {pending && <span className="absolute inset-0 m-auto size-6 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
            <Camera className="size-4" aria-hidden /> {url ? "Change photo" : "Add a photo"}
          </Button>
          {url && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeAvatar();
                  if (r.ok) {
                    setUrl(null);
                    setMessage({ ok: true, text: "Photo removed." });
                  }
                })
              }
            >
              <Trash2 className="size-4" aria-hidden /> Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-500">A clear photo of your face helps the team. JPG, PNG or WebP. It&apos;s cropped to a square.</p>
        {message && (
          <p role="status" className={message.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
            {message.text}
          </p>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif" className="sr-only" aria-label="Profile photo" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
