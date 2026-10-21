import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Las pantallas que abren las familias y el alumnado (Licencias, Salidas): su propio estilo,
 * sin la cabecera del claustro. El logo arriba, el título centrado, una sola columna estrecha
 * y lo que haya que hacer debajo, con el botón grande al final. Sin manchas de fondo: esas
 * solo van en la portada y en las encuestas de Evaluaciones.
 */
export function PaginaFamilias({
  titulo,
  subtitulo,
  className,
  children,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className={cn('anim-stagger mx-auto w-full max-w-xl px-4 pt-8 pb-16', className)}>
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70 dark:ring-zinc-800">
            <Image
              src="/logobur.png"
              alt="Colegio Consolación · Burriana"
              width={250}
              height={125}
              priority
              className="h-auto w-[210px] sm:w-[250px]"
            />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitulo}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
