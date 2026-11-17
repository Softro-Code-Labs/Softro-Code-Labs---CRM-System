import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { mustSetUpTwoFactor } from "@/lib/security/two-factor";
import { SoftroCrmLogo } from "@/components/brand/logo";
import { logout } from "@/app/login/actions";
import { TwoFactorCard } from "@/app/(app)/settings/profile/two-factor-card";

export const metadata: Metadata = { title: "Set up two-step sign-in" };

/** Admins and managers land here when the company requires two-step sign-in and they haven't set it up. */
export default async function SetupTwoFactorPage() {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (!(await mustSetUpTwoFactor(user))) redirect("/dashboard");

  return (
    <main className="flex min-h-full items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <SoftroCrmLogo tone="dark" size="lg" />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
          <h1 className="text-lg font-semibold text-ink-900">Set up two-step sign-in</h1>
          <p className="mt-1 mb-5 text-sm text-ink-500">
            Hi {user.name.split(" ")[0]}, Softro requires two-step sign-in for admins and managers. It takes about a minute.
          </p>
          <TwoFactorCard enabled={false} recoveryLeft={0} required onFinished="/dashboard" />
        </div>
        <form action={logout} className="mt-6 text-center">
          <button type="submit" className="text-xs text-ink-400 hover:text-ink-200">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
