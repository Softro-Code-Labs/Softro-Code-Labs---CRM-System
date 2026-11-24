"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Password box with an eye button to show or hide what was typed. Hides again when its form is reset. */
export function PasswordInput({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener("reset", hide);
    form.addEventListener("submit", hide);
    return () => {
      form.removeEventListener("reset", hide);
      form.removeEventListener("submit", hide);
    };
  }, []);

  return (
    <div className="relative">
      <input ref={ref} type={shown ? "text" : "password"} className={cn(className, "pr-10")} {...props} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        title={shown ? "Hide password" : "Show password"}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-400 hover:text-ink-700 focus-visible:text-ink-700 focus-visible:ring-2 focus-visible:ring-ink-900/10 focus-visible:outline-none disabled:opacity-50"
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
