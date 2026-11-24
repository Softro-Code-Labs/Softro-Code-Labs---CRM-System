export default function Loading() {
  return (
    <div role="status" aria-label="Loading" data-page-loading className="space-y-6">
      <div className="h-8 w-64 rounded skeleton" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl skeleton" />
        ))}
      </div>
    </div>
  );
}
