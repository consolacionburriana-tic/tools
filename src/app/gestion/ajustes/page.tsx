export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft, Code2, Cloud, MousePointerClick, Sparkles } from 'lucide-react';
import { getAjustesIA, hayClaveIA } from '@/lib/ajustes-server';
import { inventarioCentro, inventarioEntorno, type OrigenAjuste } from '@/lib/ajustes-inventario';
import { AjustesIAForm } from '@/components/ajustes/ia-form';
import { huellaClaveIA } from '@/lib/evaluaciones-ia-server';
import { Rotulo } from '@/components/evaluaciones/ui';

// Copia de `PANEL` (ui.tsx es 'use client': sus constantes no se pueden leer desde el servidor).
const PANEL =
  'rounded-2xl bg-white ring-1 ring-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-zinc-900 dark:ring-zinc-800';

export const metadata = { title: 'Ajustes del colegio · Tools Consolación' };

const ORIGEN: Record<OrigenAjuste, { label: string; clase: string; icono: React.ReactNode }> = {
  app: {
    label: 'Se cambia aquí',
    clase: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    icono: <MousePointerClick className="h-3 w-3" />,
  },
  entorno: {
    label: 'Variable de entorno',
    clase: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    icono: <Cloud className="h-3 w-3" />,
  },
  codigo: {
    label: 'En el código',
    clase: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    icono: <Code2 className="h-3 w-3" />,
  },
};

function Origen({ origen }: { origen: OrigenAjuste }) {
  const o = ORIGEN[origen];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.clase}`}>
      {o.icono} {o.label}
    </span>
  );
}

export default async function AjustesPage() {
  const ia = await getAjustesIA();
  const secciones = inventarioCentro();
  const entorno = inventarioEntorno();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Ajustes del colegio</h1>
            <p className="text-xs text-zinc-500">Qué se puede ajustar y dónde vive cada cosa</p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Origen origen="app" /> se guarda al momento
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Origen origen="entorno" /> Vercel → Settings → Environment Variables, y redesplegar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Origen origen="codigo" /> con un cambio en el repo (por ahora)
          </span>
        </div>

        <section className="space-y-2">
          <Rotulo className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Inteligencia artificial (Claude)
          </Rotulo>
          <div className={`${PANEL} p-4`}>
            <AjustesIAForm inicial={{ activado: ia.activado, modelo: ia.modelo, contexto: ia.contexto }} hayClave={hayClaveIA()} huella={huellaClaveIA()} />
            {ia.updatedAt && (
              <p className="mt-3 text-[11px] text-zinc-400">
                Último cambio: {ia.updatedAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
                {ia.updatedByEmail && ` · ${ia.updatedByEmail}`}
              </p>
            )}
          </div>
          <p className="px-1 text-xs text-zinc-500">
            Se usa en Evaluaciones → Resultados («Lo que ve la IA»). Se mandan las cifras y los comentarios escritos, sin nombres ni
            correos (en profesorado la base de datos ni siquiera los tiene). Cada análisis se guarda y no se repite solo.
          </p>
        </section>

        {secciones.map((s) => (
          <section key={s.titulo} className="space-y-2">
            <Rotulo>{s.titulo}</Rotulo>
            <div className={`${PANEL} divide-y divide-zinc-100 dark:divide-zinc-800`}>
              {s.ajustes.map((a) => (
                <div key={a.nombre} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{a.nombre}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{a.valor}</p>
                    {a.nota && <p className="mt-0.5 text-xs text-zinc-400">{a.nota}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <Origen origen={a.origen} />
                    <code className="text-[10px] text-zinc-400">{a.donde}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="space-y-2">
          <Rotulo>Variables de entorno</Rotulo>
          <div className={`${PANEL} divide-y divide-zinc-100 dark:divide-zinc-800`}>
            {entorno.map((v) => (
              <div key={v.nombre} className="flex items-start justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <code className="break-all text-xs font-semibold text-zinc-800 dark:text-zinc-200">{v.nombre}</code>
                  <p className="text-xs text-zinc-500">{v.para}</p>
                  {v.valor && <p className="mt-0.5 break-all text-xs text-zinc-400">{v.valor}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    v.puesta
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : v.obligatoria
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                  }`}
                >
                  {v.puesta ? 'Puesta' : v.obligatoria ? 'Falta' : 'Sin fijar'}
                </span>
              </div>
            ))}
          </div>
          <p className="px-1 text-xs text-zinc-500">
            De las secretas solo se dice si están puestas. Qué es cada una y cómo se consigue: <code>docs/04-convenciones-tecnicas.md</code> y{' '}
            <code>docs/08-despliegue-y-fork.md</code>. Lo que todavía vive en el código y podría pasar aquí está en{' '}
            <code>docs/09-parametros-del-centro.md</code>.
          </p>
        </section>
      </main>
    </div>
  );
}
