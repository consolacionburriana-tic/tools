import { Skeleton, SkeletonPage } from '@/components/ui/skeleton';

// El formulario que más se abre a diario (profesorado, iPad) y hace 3 consultas
// antes de pintar. Sin esto caía en el esqueleto de la portada, que no se le
// parece en nada: aquí se imita su estructura real (cabecera fija + secciones
// "título + chips") para que el cambio al contenido no dé un salto.
export default function Loading() {
  const secciones = [4, 3, 6, 5, 4, 7]; // nº de chips por sección, como el form real
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="container mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-32" />
        </div>
      </header>

      <SkeletonPage label="Cargando el registro ABC…">
        <main className="container mx-auto max-w-2xl space-y-6 px-4 py-6">
          {secciones.map((chips, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: chips }).map((_, j) => (
                  <Skeleton key={j} className="h-9 w-24 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </main>
      </SkeletonPage>
    </div>
  );
}
