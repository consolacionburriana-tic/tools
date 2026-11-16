'use client';

// Audiovisual: la tabla del Excel «Clases - Proyectores - TV», ordenable. Por defecto, por
// prioridad (lo primero que hay que arreglar arriba), para imprimirla y salir a hacer la ronda.
// Tocar una fila abre su hoja: el formulario y los arreglos de audiovisual de esa aula.
import { useState } from 'react';
import Link from 'next/link';
import { Apple, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  ACCIONES_AV,
  ACCION_AV_LABEL,
  ACCION_AV_TONO,
  AUDIO_LABEL,
  NIVEL_LABEL,
  NIVEL_TONO,
  PANTALLA_LABEL,
  pesoAtencion,
  type AccionAv,
  type Audio,
  type Pantalla,
} from '@/lib/inventario';
import type { Inventario } from '@/lib/inventario-server';
import { buttonVariants } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Estado } from '@/components/ui/estado';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ColumnaOrden, Estrellas, useIndice, type FilaAula } from './comun';
import { FormAv } from './formularios';
import { ListaArreglos } from './arreglos';

export type OrdenAv = 'prioridad' | 'aula' | 'valoracion' | 'marca';

export function ordenarAv(filas: readonly FilaAula[], orden: OrdenAv): FilaAula[] {
  return [...filas].sort((a, b) => {
    if (orden === 'prioridad') return pesoAtencion(a.atencionAv, a.av?.valoracion ?? null) - pesoAtencion(b.atencionAv, b.av?.valoracion ?? null) || a.aula.orden - b.aula.orden;
    if (orden === 'valoracion') return (a.av?.valoracion ?? 6) - (b.av?.valoracion ?? 6) || a.aula.orden - b.aula.orden;
    if (orden === 'marca') return (a.av?.marca ?? '~').localeCompare(b.av?.marca ?? '~', 'es') || a.aula.orden - b.aula.orden;
    return a.aula.orden - b.aula.orden;
  });
}

export function Audiovisual({ inv }: { inv: Inventario }) {
  const filas = useIndice(inv);
  const [orden, setOrden] = useState<OrdenAv>('prioridad');
  const [pantalla, setPantalla] = useState<Pantalla | 'todas'>('todas');
  const [accion, setAccion] = useState<AccionAv | 'todas'>('todas');
  const [abierta, setAbierta] = useState<string | null>(null);

  const conAv = filas.filter((f) => f.av || !f.aula.nombre);
  const visibles = ordenarAv(
    conAv.filter((f) => (pantalla === 'todas' || f.av?.pantalla === pantalla) && (accion === 'todas' || f.av?.accion === accion)),
    orden,
  );
  const abiertaFila = abierta ? filas.find((f) => f.aula.id === abierta) : null;
  const cuenta = (fn: (f: FilaAula) => boolean) => conAv.filter(fn).length;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Audiovisual</h1>
      <Cifras>
        <Cifra etiqueta="Proyectores" valor={cuenta((f) => f.av?.pantalla === 'proyector')} />
        <Cifra etiqueta="Televisiones" valor={cuenta((f) => f.av?.pantalla === 'tv')} />
        <Cifra
          etiqueta="Por cambiar o reparar"
          valor={cuenta((f) => f.av?.accion === 'cambiar' || f.av?.accion === 'reparar')}
          tono={cuenta((f) => f.av?.accion === 'cambiar' || f.av?.accion === 'reparar') ? 'error' : 'ok'}
        />
        <Cifra etiqueta="Sin Apple TV" valor={cuenta((f) => Boolean(f.av) && !f.av!.appleTv)} />
      </Cifras>

      <div className="flex flex-wrap items-center gap-2">
        <Filtros etiqueta="Pantalla">
          <Filtro activo={pantalla === 'todas'} onClick={() => setPantalla('todas')} cuenta={conAv.length}>
            Todas
          </Filtro>
          <Filtro activo={pantalla === 'proyector'} onClick={() => setPantalla('proyector')} cuenta={cuenta((f) => f.av?.pantalla === 'proyector')}>
            Proyector
          </Filtro>
          <Filtro activo={pantalla === 'tv'} onClick={() => setPantalla('tv')} cuenta={cuenta((f) => f.av?.pantalla === 'tv')}>
            TV
          </Filtro>
        </Filtros>
        <span aria-hidden className="mx-1 hidden h-6 w-px bg-zinc-200 sm:block dark:bg-zinc-700" />
        <Filtros etiqueta="Qué hay que hacer">
          {ACCIONES_AV.filter((a) => a !== 'correcto').map((a) => {
            const n = cuenta((f) => f.av?.accion === a);
            if (n === 0) return null;
            return (
              <Filtro
                key={a}
                activo={accion === a}
                onClick={() => setAccion(accion === a ? 'todas' : a)}
                cuenta={n}
                tono={ACCION_AV_TONO[a] === 'error' ? 'error' : ACCION_AV_TONO[a] === 'aviso' ? 'aviso' : undefined}
              >
                {ACCION_AV_LABEL[a]}
              </Filtro>
            );
          })}
        </Filtros>
        <Link
          href={`/gestion/inventario/imprimir?informe=av&orden=${orden}`}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'ml-auto' })}
        >
          <Printer aria-hidden /> Imprimir
        </Link>
      </div>

      {visibles.length === 0 ? (
        <Vacio titulo="Ningún aula con ese filtro" />
      ) : (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <ColumnaOrden campo="aula" orden={orden} setOrden={setOrden}>
                  Aula
                </ColumnaOrden>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Clase
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Pantalla
                </th>
                <ColumnaOrden campo="marca" orden={orden} setOrden={setOrden}>
                  Marca
                </ColumnaOrden>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Audio
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  <Apple aria-label="Apple TV" className="size-4" />
                </th>
                <ColumnaOrden campo="valoracion" orden={orden} setOrden={setOrden}>
                  Estado
                </ColumnaOrden>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Qué hacer
                </th>
                <ColumnaOrden campo="prioridad" orden={orden} setOrden={setOrden}>
                  Prioridad
                </ColumnaOrden>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibles.map((f) => {
                const av = f.av;
                const pendAv = f.pendientes.filter((a) => a.area === 'av' || a.area === 'red');
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
                      <button
                        type="button"
                        className="rounded-md text-left font-bold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        aria-label={`Abrir ${f.nombre}`}
                      >
                        {f.aula.numero ?? '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{f.aula.nombre ?? f.cartel}</span>
                      {pendAv.length > 0 && (
                        <span className="mt-1 block max-w-64 truncate text-xs text-zinc-500 dark:text-zinc-400" title={pendAv.map((a) => a.texto).join(' · ')}>
                          {pendAv.length === 1 ? pendAv[0].texto : `${pendAv.length} arreglos: ${pendAv[0].texto}…`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{av?.pantalla ? PANTALLA_LABEL[av.pantalla as Pantalla] : '—'}</td>
                    <td className="px-3 py-2.5">{av?.marca ?? '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{av?.audio ? AUDIO_LABEL[av.audio as Audio] : '—'}</td>
                    <td className="px-3 py-2.5">{av ? (av.appleTv ? 'Sí' : <span className="font-medium text-amber-700 dark:text-amber-400">No</span>) : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{av ? <Estrellas valor={av.valoracion} /> : '—'}</td>
                    <td className="px-3 py-2.5">
                      {av ? <Estado tono={ACCION_AV_TONO[av.accion as AccionAv]}>{ACCION_AV_LABEL[av.accion as AccionAv]}</Estado> : <Estado tono="neutro">Sin revisar</Estado>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Estado tono={NIVEL_TONO[f.atencionAv]} className={cn(f.atencionAv === 'urgente' && 'font-semibold')}>
                        {NIVEL_LABEL[f.atencionAv]}
                      </Estado>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Tarjeta>
      )}

      {abiertaFila && (
        <Dialog open onOpenChange={(o) => !o && setAbierta(null)}>
          <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
            <DialogTitle>
              {abiertaFila.nombre}
              {abiertaFila.cartel && !abiertaFila.aula.nombre ? ` · ${abiertaFila.cartel}` : ''}
            </DialogTitle>
            <DialogDescription>
              <Link href={`/gestion/inventario/aulas/${abiertaFila.aula.id}`}>Ver la ficha entera del aula</Link>
            </DialogDescription>
            <FormAv aulaId={abiertaFila.aula.id} av={abiertaFila.av} onHecho={() => setAbierta(null)} />
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Arreglos de audiovisual y red</p>
              <ListaArreglos
                arreglos={abiertaFila.arreglos.filter((a) => a.area === 'av' || a.area === 'red')}
                aulaId={abiertaFila.aula.id}
                areaPorDefecto="av"
                filas={filas}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
