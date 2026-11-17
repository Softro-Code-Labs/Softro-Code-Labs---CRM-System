import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { SoftroCrmLogo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="relative flex min-h-full items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      {/* Soft crimson glow, echoing the website hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full opacity-25"
        style={{ background: "radial-gradient(closest-side, #a70b21, transparent)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <SoftroCrmLogo tone="dark" size="lg" />
          <p className="mt-3 text-sm text-ink-400">Sign in to continue</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-ink-500">
          Forgot your password? Ask a Softro CRM admin to reset it.
          <br />
          <span className="text-ink-600">© Softro Code Labs</span>
        </p>
      </div>
    </main>
  );
}
