import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SoftroCrmLogo } from "@/components/brand/logo";
import { PasswordForm } from "@/components/crm/password-form";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Set your password" };

/** Shown after signing in with a temporary password (new account or admin reset). */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/dashboard");

  return (
    <main className="theme-fixed flex min-h-full items-center justify-center bg-ink-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <SoftroCrmLogo tone="dark" size="lg" />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 sm:p-8">
          <h1 className="text-lg font-semibold text-ink-900">Set your own password</h1>
          <p className="mt-1 mb-5 text-sm text-ink-500">
            Hi {user.name.split(" ")[0]}, you signed in with a temporary password. Choose your own to continue.
          </p>
          <PasswordForm redirectTo="/dashboard" submitLabel="Save and continue" />
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
