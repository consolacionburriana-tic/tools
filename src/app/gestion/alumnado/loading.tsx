export default function Cargando() {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-5">
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-24 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-3 hidden h-72 animate-pulse rounded-2xl bg-zinc-200 lg:mt-0 lg:block dark:bg-zinc-800" />
    </div>
  );
}
