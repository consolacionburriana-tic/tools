export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <div className="h-64 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
    </div>
  );
}
