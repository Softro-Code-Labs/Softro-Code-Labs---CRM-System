import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SoftroCrmLogo } from "@/components/brand/logo";
import { getPendingTwoFactor } from "@/lib/security/two-factor";
import { VerifyForm } from "./verify-form";
import { cancelSecondFactor } from "../actions";

export const metadata: Metadata = { title: "Enter your code" };

export default async function VerifyPage() {
  if (!(await getPendingTwoFactor())) redirect("/login?expired=1");
  return (
    <main className="theme-fixed relative flex min-h-full items-center justify-center overflow-hidden bg-ink-950 px-4 py-12">
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <SoftroCrmLogo tone="dark" size="lg" />
          <p className="mt-3 text-sm text-ink-400">Two-step sign-in</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
          <VerifyForm />
        </div>
        <form action={cancelSecondFactor} className="mt-6 text-center">
          <button type="submit" className="text-xs text-ink-400 hover:text-ink-200">
            Use a different account
          </button>
        </form>
      </div>
    </main>
  );
}
