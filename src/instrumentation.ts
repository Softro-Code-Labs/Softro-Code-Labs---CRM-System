import type { Instrumentation } from "next";

/** Runs once when a server instance starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}

/** Every uncaught server error (pages, server actions, route handlers) goes to the built-in error log. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("./lib/monitoring/errors");
  await recordError({
    error,
    path: request.path,
    method: request.method,
    digest: (error as { digest?: string }).digest ?? null,
  });
  void context;
};
