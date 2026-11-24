"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PenLine, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { removeSignature, uploadSignature } from "./signature-actions";

/** Drawing pad: sign with a mouse, finger or pen. */
function SignaturePad({ onDone, onCancel, pending }: { onDone: (blob: Blob) => void; onCancel: () => void; pending: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    ctx.lineTo(...point(e));
    ctx.stroke();
    setEmpty(false);
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        className="h-40 w-full touch-none rounded-lg border border-dashed border-ink-300 bg-white"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
        aria-label="Signature drawing pad"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={empty || pending} onClick={() => canvas.current!.toBlob((b) => b && onDone(b), "image/png")}>
          {pending ? "Saving…" : "Save signature"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={empty || pending} onClick={clear}>
          Clear
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function SignatureCard({ initialUrl, signer }: { initialUrl: string | null; signer: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [drawing, setDrawing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const save = (blob: Blob) =>
    start(async () => {
      setMessage(null);
      const form = new FormData();
      form.set("signature", blob, "signature.png");
      const r = await uploadSignature(form);
      if (r.ok) {
        setUrl(r.url);
        setDrawing(false);
        setMessage({ ok: true, text: "Signature saved. It's used for documents you seal from now on." });
      } else setMessage({ ok: false, text: r.message });
      if (input.current) input.current.value = "";
    });

  return (
    <div className="space-y-4">
      {drawing ? (
        <SignaturePad onDone={save} onCancel={() => setDrawing(false)} pending={pending} />
      ) : (
        <>
          <div className="flex h-28 items-center justify-center rounded-lg border border-ink-200 bg-white px-4">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- small inline data URL
              <img src={url} alt="Your signature" className="max-h-20 w-auto object-contain" />
            ) : (
              <span className="text-sm text-ink-400">No signature yet</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setDrawing(true)}>
              <PenLine className="size-4" aria-hidden /> Draw it
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
              <Upload className="size-4" aria-hidden /> {pending ? "Saving…" : "Upload a photo"}
            </Button>
            {url && (
              <ConfirmAction
                variant="ghost"
                size="sm"
                title="Remove your signature?"
                body="You won't be able to seal documents until you add one again. Documents you've already sealed keep their signature."
                yes="Yes, remove"
                onConfirm={async () => {
                  const r = await removeSignature();
                  if (r.ok) {
                    setUrl(null);
                    setMessage({ ok: true, text: "Signature removed." });
                  }
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Remove
              </ConfirmAction>
            )}
          </div>
        </>
      )}
      <p className="text-xs text-ink-500">
        Printed with the company seal on quotes, invoices and receipts you seal, above your name and job title ({signer}). For a photo, sign in dark ink on plain white
        paper; the background is removed automatically.
      </p>
      {message && (
        <p role="status" className={message.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
          {message.text}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        className="sr-only"
        aria-label="Signature image"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) save(f);
        }}
      />
    </div>
  );
}
