import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-white text-lg font-bold text-brand-700 shadow-lg">
            S
          </div>
          <h1 className="text-2xl font-semibold text-white">Softro CRM</h1>
          <p className="mt-1 text-sm text-brand-200">Softro Code Labs · Sign in to continue</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-brand-200">
          Forgot your password? Ask a Softro CRM admin to reset it.
        </p>
      </div>
    </main>
  );
}
