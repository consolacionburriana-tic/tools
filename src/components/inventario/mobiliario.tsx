'use client';

// Mesas y sillas: cuántas hay en cada aula contra cuántos alumnos tiene la clase este curso. Lo
// que falta sale en ámbar arriba si se ordena por «Faltan». En Infantil las mesas son de grupo y
// no se comparan. Tocar una fila abre la hoja con los − y + para contar de pie en el aula.
import { useState } from 'react';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { cuadreMobiliario, textoCuadre } from '@/lib/inventario';
import type { Inventario } from '@/lib/inventario-server';
import { buttonVariants } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Estado } from '@/components/ui/estado';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ColumnaOrden, useIndice, type FilaAula } from './comun';
import { FormMobiliario } from './formularios';

export type OrdenMob = 'aula' | 'faltan';

export function cuadreDe(f: FilaAula) {
  return cuadreMobiliario(f.mob, f.alumnos, f.ocupacion?.curso ?? null);
}

export function ordenarMob(filas: readonly FilaAula[], orden: OrdenMob): FilaAula[] {
  if (orden === 'aula') return [...filas].sort((a, b) => a.aula.orden - b.aula.orden);
  const peor = (f: FilaAula) => {
    const c = cuadreDe(f);
    return Math.min(c.sillas ?? 99, c.mesas ?? 99);
  };
  return [...filas].sort((a, b) => peor(a) - peor(b) || a.aula.orden - b.aula.orden);
}

function Cuadre({ d }: { d: number | null }) {
  if (d === null) return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  return <Estado tono={d < 0 ? 'aviso' : d === 0 ? 'ok' : 'neutro'}>{textoCuadre(d)}</Estado>;
}

type FiltroMob = 'clases' | 'faltan' | 'sin_contar';

export function Mobiliario({ inv }: { inv: Inventario }) {
  const filas = useIndice(inv);
  const [orden, setOrden] = useState<OrdenMob>('aula');
  const [filtro, setFiltro] = useState<FiltroMob>('clases');
  const [abierta, setAbierta] = useState<string | null>(null);

  const clases = filas.filter((f) => f.ocupacion?.curso || f.mob);
  const faltan = (f: FilaAula) => {
    const c = cuadreDe(f);
    return (c.sillas ?? 0) < 0 || (c.mesas ?? 0) < 0;
  };
  const sinContar = (f: FilaAula) => !f.mob || (f.mob.sillas === null && f.mob.mesas === null);
  const visibles = ordenarMob(
    clases.filter((f) => (filtro === 'faltan' ? faltan(f) : filtro === 'sin_contar' ? sinContar(f) : true)),
    orden,
  );
  const abiertaFila = abierta ? filas.find((f) => f.aula.id === abierta) : null;
  const suma = (k: 'sillas' | 'mesas') => inv.mobiliario.reduce((t, m) => t + (m[k] ?? 0), 0);
  const faltanSillas = clases.reduce((t, f) => t + Math.max(0, -(cuadreDe(f).sillas ?? 0)), 0);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Mesas y sillas</h1>
      <Cifras>
        <Cifra etiqueta="Sillas contadas" valor={suma('sillas')} />
        <Cifra etiqueta="Mesas contadas" valor={suma('mesas')} />
        <Cifra etiqueta="Sillas que faltan" valor={faltanSillas} tono={faltanSillas ? 'aviso' : 'ok'} nota={`en ${clases.filter((f) => (cuadreDe(f).sillas ?? 0) < 0).length} aulas`} />
        <Cifra etiqueta="Aulas sin contar" valor={clases.filter(sinContar).length} tono={clases.some(sinContar) ? 'aviso' : 'ok'} />
      </Cifras>

      <div className="flex flex-wrap items-center gap-2">
        <Filtros etiqueta="Mostrar">
          <Filtro activo={filtro === 'clases'} onClick={() => setFiltro('clases')} cuenta={clases.length}>
            Todas
          </Filtro>
          <Filtro activo={filtro === 'faltan'} onClick={() => setFiltro('faltan')} cuenta={clases.filter(faltan).length} tono="aviso">
            Faltan
          </Filtro>
          <Filtro activo={filtro === 'sin_contar'} onClick={() => setFiltro('sin_contar')} cuenta={clases.filter(sinContar).length}>
            Sin contar
          </Filtro>
        </Filtros>
        <Link href={`/gestion/inventario/imprimir?informe=mobiliario&orden=${orden}`} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'ml-auto' })}>
          <Printer aria-hidden /> Imprimir para contar
        </Link>
      </div>

      {visibles.length === 0 ? (
        <Vacio titulo="Nada con ese filtro" />
      ) : (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <ColumnaOrden campo="aula" orden={orden} setOrden={setOrden}>
                  Aula
                </ColumnaOrden>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Clase
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Alumnos
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Sillas
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Mesas
                </th>
                <ColumnaOrden campo="faltan" orden={orden} setOrden={setOrden}>
                  Cuadre
                </ColumnaOrden>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Notas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibles.map((f) => {
                const c = cuadreDe(f);
                return (
                  <tr
                    key={f.aula.id}
                    onClick={() => {
                      haptic.tap();
                      setAbierta(f.aula.id);
                    }}
                    className="cursor-pointer align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-3 py-2.5">
                      <button type="button" aria-label={`Contar ${f.nombre}`} className="rounded-md font-bold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {f.aula.numero ?? '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{f.aula.nombre ?? f.cartel}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{f.alumnos ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{f.mob?.sillas ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{f.mob?.mesas ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex flex-wrap gap-1.5">
                        {c.sillas !== null && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            Sillas <Cuadre d={c.sillas} />
                          </span>
                        )}
                        {c.mesas !== null && (
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                            Mesas <Cuadre d={c.mesas} />
                          </span>
                        )}
                        {c.sillas === null && c.mesas === null && <Cuadre d={null} />}
                      </span>
                    </td>
                    <td className="max-w-72 px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{f.mob?.notas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Tarjeta>
      )}

      {abiertaFila && (
        <Dialog open onOpenChange={(o) => !o && setAbierta(null)}>
          <DialogContent variante="hoja" className="sm:max-w-lg">
            <DialogTitle>
              {abiertaFila.nombre}
              {abiertaFila.cartel && !abiertaFila.aula.nombre ? ` · ${abiertaFila.cartel}` : ''}
            </DialogTitle>
            <DialogDescription>Cuenta de pie en el aula: − y + o escribe el número.</DialogDescription>
            <FormMobiliario
              aulaId={abiertaFila.aula.id}
              mob={abiertaFila.mob}
              alumnos={abiertaFila.alumnos}
              curso={abiertaFila.ocupacion?.curso ?? null}
              onHecho={() => setAbierta(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
