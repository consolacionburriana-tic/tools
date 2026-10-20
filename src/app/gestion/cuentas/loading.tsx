export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="h-10 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
    </div>
  );
}
