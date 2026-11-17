import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-lg font-semibold text-slate-900">Record not found</h1>
      <p className="mt-2 text-sm text-slate-500">It may have been deleted, or the link is wrong.</p>
      <LinkButton href="/dashboard" className="mt-6">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
