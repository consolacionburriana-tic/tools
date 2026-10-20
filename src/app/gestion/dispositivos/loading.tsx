export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="h-10 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
    </div>
  );
}
