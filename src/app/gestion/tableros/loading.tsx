export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="h-40 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
    </main>
  );
}
