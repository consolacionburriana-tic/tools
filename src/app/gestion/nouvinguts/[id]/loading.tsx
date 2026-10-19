export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
    </div>
  );
}
