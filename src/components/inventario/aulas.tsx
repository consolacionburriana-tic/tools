'use client';

// La portada de Inventario y aulas: cada aula por su número, con la clase que tiene este curso y
// todo lo que hay dentro de un vistazo (audiovisual, mesas y sillas, antena, arreglos, robótica).
// Buscar mira en todo: número, clase, tutor, marca, notas, antena y kits.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Armchair, ArrowRightLeft, Bot, DoorOpen, FileSpreadsheet, Plus, Printer, Projector, Search, Tv, Wifi, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  ACCION_AV_LABEL,
  ACCION_AV_TONO,
  PANTALLA_LABEL,
  antenaPorRenombrar,
  cuadreMobiliario,
  etiquetaPiso,
  normalizar,
  textoCuadre,
  type AccionAv,
  type Pantalla,
} from '@/lib/inventario';
import type { Inventario } from '@/lib/inventario-server';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Estado } from '@/components/ui/estado';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Rotulo } from '@/components/ui/rotulo';
import { Vacio } from '@/components/ui/vacio';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Estrellas, useIndice, type FilaAula } from './comun';
import { NuevaAula } from './formularios';

type FiltroAulas = 'todas' | 'urgente' | 'arreglos' | 'sillas';

function textoBusqueda(f: FilaAula): string {
  return normalizar(
    [
      f.aula.numero && `aula ${f.aula.numero}`,
      f.aula.nombre,
      f.cartel,
      f.ocupacion?.curso,
      ...f.tutores,
      f.av?.marca,
      f.av?.notas,
      f.mob?.notas,
      f.aula.notas,
      ...f.antenas.flatMap((a) => [a.nombreActual, a.nombreNuevo]),
      ...f.kits.map((k) => k.codigo),
      ...f.pendientes.map((a) => a.texto),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function Aulas({ inv }: { inv: Inventario }) {
  const filas = useIndice(inv);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<FiltroAulas>('todas');
  const [nueva, setNueva] = useState(false);

  const faltanSillas = (f: FilaAula) => (cuadreMobiliario(f.mob, f.alumnos, f.ocupacion?.curso ?? null).sillas ?? 0) < 0;
  const cuentas = {
    todas: filas.length,
    urgente: filas.filter((f) => f.urgentes > 0).length,
    arreglos: filas.filter((f) => f.pendientes.length > 0).length,
    sillas: filas.filter(faltanSillas).length,
  };
  const busqueda = useMemo(() => new Map(filas.map((f) => [f.aula.id, textoBusqueda(f)])), [filas]);
  const visibles = filas.filter((f) => {
    if (filtro === 'urgente' && f.urgentes === 0) return false;
    if (filtro === 'arreglos' && f.pendientes.length === 0) return false;
    if (filtro === 'sillas' && !faltanSillas(f)) return false;
    const t = normalizar(q.trim());
    return !t || t.split(/\s+/).every((p) => busqueda.get(f.aula.id)!.includes(p));
  });
  const pisos = new Map<string, FilaAula[]>();
  for (const f of visibles) {
    const k = f.aula.piso ?? '';
    pisos.set(k, [...(pisos.get(k) ?? []), f]);
  }

  const pendientes = inv.arreglos.filter((a) => !a.hechoAt);
  const porRenombrar = inv.antenas.filter(antenaPorRenombrar).length;
  const recibidos = inv.kits.filter((k) => k.estado !== 'baja').length;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Aulas</h1>
      <Cifras>
        <Cifra
          etiqueta="Arreglos pendientes"
          valor={pendientes.length}
          nota={`${pendientes.filter((a) => a.prioridad === 'urgente').length} urgentes`}
          tono={pendientes.some((a) => a.prioridad === 'urgente') ? 'error' : undefined}
          icono={<Wrench />}
          href="/gestion/inventario/arreglos"
        />
        <Cifra
          etiqueta="Audiovisual por cambiar"
          valor={inv.av.filter((a) => a.accion === 'cambiar' || a.accion === 'reparar').length}
          nota={`de ${inv.av.length} aulas`}
          icono={<Projector />}
          href="/gestion/inventario/audiovisual"
        />
        <Cifra
          etiqueta="Antenas por renombrar"
          valor={porRenombrar}
          nota={`de ${inv.antenas.length}`}
          tono={porRenombrar ? 'aviso' : 'ok'}
          icono={<Wifi />}
          href="/gestion/inventario/antenas"
        />
        <Cifra etiqueta="Kits de robótica" valor={recibidos} nota="numerados y recibidos" icono={<Bot />} href="/gestion/inventario/robotica" />
      </Cifras>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Aula, clase, tutor, marca, nota…"
            aria-label="Buscar en las aulas"
            className="pl-9"
          />
        </div>
        <Filtros etiqueta="Mostrar">
          <Filtro activo={filtro === 'todas'} onClick={() => setFiltro('todas')} cuenta={cuentas.todas}>
            Todas
          </Filtro>
          <Filtro activo={filtro === 'urgente'} onClick={() => setFiltro('urgente')} cuenta={cuentas.urgente} tono="error">
            Algo urgente
          </Filtro>
          <Filtro activo={filtro === 'arreglos'} onClick={() => setFiltro('arreglos')} cuenta={cuentas.arreglos} tono="aviso">
            Con arreglos
          </Filtro>
          <Filtro activo={filtro === 'sillas'} onClick={() => setFiltro('sillas')} cuenta={cuentas.sillas} tono="aviso">
            Faltan sillas
          </Filtro>
        </Filtros>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/gestion/inventario/clases" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ArrowRightLeft aria-hidden /> Clases de cada aula
        </Link>
        <Link href="/gestion/inventario/imprimir?informe=aulas" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Printer aria-hidden /> Imprimir
        </Link>
        <a href="/api/inventario/excel" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <FileSpreadsheet aria-hidden /> Excel con todo
        </a>
        <button type="button" onClick={() => { haptic.tap(); setNueva(true); }} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <Plus aria-hidden /> Añadir aula o sala
        </button>
      </div>

      {visibles.length === 0 ? (
        <Vacio icono={<Search />} titulo="Ningún aula coincide">
          Prueba con el número de la puerta («12»), la clase («3 EP B») o una marca («Epson»).
        </Vacio>
      ) : (
        [...pisos.entries()].map(([piso, lista]) => (
          <section key={piso} aria-labelledby={`piso-${piso || 'otras'}`} className="space-y-2">
            <Rotulo id={`piso-${piso || 'otras'}`}>{piso ? etiquetaPiso(piso) : 'Otras salas'}</Rotulo>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((f) => (
                <TarjetaAula key={f.aula.id} f={f} />
              ))}
            </ul>
          </section>
        ))
      )}

      {nueva && <NuevaAula onCerrar={() => setNueva(false)} />}
    </div>
  );
}

function TarjetaAula({ f }: { f: FilaAula }) {
  const c = cuadreMobiliario(f.mob, f.alumnos, f.ocupacion?.curso ?? null);
  const pantalla = f.av?.pantalla as Pantalla | null | undefined;
  return (
    <li>
      <Link
        href={`/gestion/inventario/aulas/${f.aula.id}`}
        className={cn(
          claseTarjeta,
          'flex h-full gap-3 p-3.5 outline-none transition-colors hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:border-zinc-700',
        )}
      >
        <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 px-2 text-lg font-bold whitespace-nowrap tabular-nums text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          {f.aula.numero ?? <DoorIcon />}
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block">
            <span className="block truncate font-semibold text-zinc-900 dark:text-zinc-100">
              {f.aula.nombre ?? (f.cartel || 'Sin clase este curso')}
            </span>
            <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
              {[f.tutores.join(' y '), f.alumnos !== null ? `${f.alumnos} alumnos` : null].filter(Boolean).join(' · ') || ' '}
            </span>
          </span>
          {f.av && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {pantalla === 'tv' ? <Tv aria-hidden className="size-4 text-zinc-500" /> : <Projector aria-hidden className="size-4 text-zinc-500" />}
              <span className="truncate">{[pantalla ? PANTALLA_LABEL[pantalla] : null, f.av.marca].filter(Boolean).join(' ')}</span>
              <Estrellas valor={f.av.valoracion} />
              {f.av.accion !== 'correcto' && <Estado tono={ACCION_AV_TONO[f.av.accion as AccionAv]}>{ACCION_AV_LABEL[f.av.accion as AccionAv]}</Estado>}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {f.mob && (f.mob.sillas !== null || f.mob.mesas !== null) && (
              <span className="inline-flex items-center gap-1">
                <Armchair aria-hidden className="size-4 text-zinc-500" />
                <span className="tabular-nums">
                  {f.mob.sillas ?? '—'} sillas · {f.mob.mesas ?? '—'} mesas
                </span>
                {c.sillas !== null && c.sillas < 0 && <Estado tono="aviso">{textoCuadre(c.sillas, 'silla')}</Estado>}
              </span>
            )}
            {f.antenas.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1">
                <Wifi aria-hidden className={cn('size-4', antenaPorRenombrar(a) ? 'text-amber-500' : 'text-zinc-500')} />
                <span className="font-mono text-xs">{a.nombreActual}</span>
              </span>
            ))}
            {f.kits.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Bot aria-hidden className="size-4 text-zinc-500" />
                {f.kits.length} kits
              </span>
            )}
          </span>
          {f.pendientes.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {f.urgentes > 0 && <Estado tono="error">{f.urgentes === 1 ? '1 urgente' : `${f.urgentes} urgentes`}</Estado>}
              <Estado tono="aviso" icono={<Wrench />}>
                {f.pendientes.length === 1 ? '1 arreglo' : `${f.pendientes.length} arreglos`}
              </Estado>
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function DoorIcon() {
  return <DoorOpen aria-hidden className="size-5 text-zinc-500" />;
}
