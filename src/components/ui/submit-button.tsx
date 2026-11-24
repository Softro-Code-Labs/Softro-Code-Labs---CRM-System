"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";
import { Spinner } from "./spinner";

export function SubmitButton({ children, pendingText = "Saving…", ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
