export default function Cargando() {
  return (
    <div className="space-y-5">
      <div className="h-12 w-72 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-[28rem] animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
