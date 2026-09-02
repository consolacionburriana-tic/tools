export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="container mx-auto max-w-2xl space-y-4 px-4 py-8">
        <div className="h-14 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}
