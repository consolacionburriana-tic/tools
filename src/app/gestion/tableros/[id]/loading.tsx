export default function Loading() {
  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-96 w-72 shrink-0 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
        ))}
      </div>
    </div>
  );
}
