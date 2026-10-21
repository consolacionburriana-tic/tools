'use client';

// Elegir QUÉ horario se mira, con los mínimos toques posibles: la vista en tres pestañas,
// el filtro de curso solo cuando aporta, y la lista de abajo siempre visible (nada de un
// desplegable que hay que abrir para ver qué hay).

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, DoorOpen, Loader2, MapPin, Search, Users } from 'lucide-react';

import { haptic } from '@/lib/haptics';
import { ETAPAS_HORARIO } from '@/lib/horarios';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Segmentado } from '@/components/ui/segmentado';
import type { OpcionesNavegador, VistaHorario } from '@/lib/horarios-server';

const NOMBRE_ETAPA = new Map(ETAPAS_HORARIO.map((e) => [e.codigo as string, e.nombre]));

const ETIQUETA_LISTA: Record<VistaHorario, string> = {
  clase: 'Clase',
  profe: 'Profesor/a',
  aula: 'Aula',
};

const VISTAS: { id: VistaHorario; label: string; icono: typeof Users }[] = [
  { id: 'clase', label: 'Clase', icono: Users },
  { id: 'profe', label: 'Profesor', icono: DoorOpen },
  { id: 'aula', label: 'Aula', icono: MapPin },
];

export function Selector({
  opciones,
  vista,
  clave,
  puedeVerProfes,
}: {
  opciones: OpcionesNavegador;
  vista: VistaHorario;
  clave: string;
  puedeVerProfes: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [etapa, setEtapa] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [desplegado, setDesplegado] = useState(false);
  const [yendo, setYendo] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const vistas = puedeVerProfes ? VISTAS : VISTAS.filter((v) => v.id !== 'profe');

  // El toque ya vibra en el segmentado y en los filtros.
  const ir = (v: VistaHorario, k: string) => {
    setYendo(`${v}:${k}`);
    const p = new URLSearchParams(params.toString());
    p.set('vista', v);
    p.set('clave', k);
    // En transición: mientras Neon responde, el chip que se ha tocado enseña su spinner en
    // vez de quedarse la pantalla igual y parecer que el toque no ha entrado.
    empezar(() => router.push(`/gestion/horarios?${p.toString()}`));
  };

  // `yendo` se queda escrito tras navegar, y da igual: SIEMPRE se lee junto a `pendiente`, y
  // `ir()` lo reescribe antes de arrancar cada transición. No hace falta limpiarlo.

  // Filtro por ETAPA, no por curso: con infantil, primaria y la ESO importadas hay casi
  // treinta clases, y lo que se quiere acotar primero es "enséñame las de secundaria".
  const etapas = useMemo(() => {
    const orden = ETAPAS_HORARIO.map((e) => e.codigo as string);
    return [...new Set(opciones.clases.map((c) => c.etapa).filter((e): e is string => !!e))].sort(
      (a, b) => orden.indexOf(a) - orden.indexOf(b),
    );
  }, [opciones.clases]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (vista === 'clase') {
      return opciones.clases
        .filter((c) => !etapa || c.etapa === etapa)
        .filter((c) => !q || c.etiqueta.toLowerCase().includes(q))
        .map((c) => ({ clave: `${c.curso}|${c.letra ?? ''}`, etiqueta: c.etiqueta, pista: etapa ? null : c.etapa }));
    }
    if (vista === 'profe') {
      return opciones.profes
        .filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.alias ?? '').toLowerCase().includes(q))
        .map((p) => ({ clave: p.id, etiqueta: p.nombre, pista: p.alias }));
    }
    return opciones.espacios
      .filter((e) => !q || e.nombre.toLowerCase().includes(q))
      .map((e) => ({ clave: e.id, etiqueta: e.nombre, pista: e.codigo }));
  }, [vista, etapa, busca, opciones]);

  // Cambiar de vista es la navegación MÁS lenta (se rehace el selector entero): la opción
  // tocada enseña la ruedecita para que no parezca que el toque no ha entrado.
  const vistaYendo = pendiente && yendo?.endsWith(':') ? (yendo.slice(0, -1) as VistaHorario) : null;

  return (
    <div className="space-y-3">
      <Segmentado
        etiqueta="Ver el horario de"
        lleno
        className="sm:w-auto sm:min-w-96"
        valor={vistaYendo ?? vista}
        onChange={(v) => v !== vista && ir(v, '')}
        opciones={vistas.map((v) => ({
          valor: v.id,
          etiqueta: v.label,
          icono: vistaYendo === v.id ? <Loader2 aria-hidden className="animate-spin" /> : <v.icono aria-hidden />,
        }))}
      />

      {/* Estas dos filas hacen cosas distintas y antes se confundían (parecían dos listas de
          clases). Van etiquetadas: arriba se ACOTA la etapa, abajo se ELIGE la clase. */}
      {vista === 'clase' && etapas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Etapa</span>
          <Filtros etiqueta="Etapa">
            <Filtro activo={!etapa} onClick={() => setEtapa('')}>Todas</Filtro>
            {etapas.map((e) => (
              <Filtro key={e} activo={etapa === e} onClick={() => setEtapa(e)}>
                {NOMBRE_ETAPA.get(e) ?? e}
              </Filtro>
            ))}
          </Filtros>
        </div>
      )}

      {lista.length > 12 && (
        <div className="relative max-w-md">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={vista === 'profe' ? 'Buscar profesor/a…' : 'Buscar…'}
            aria-label={vista === 'profe' ? 'Buscar profesor/a' : 'Buscar'}
            className="pl-9"
          />
        </div>
      )}

      {/* Plegado, la lista es UNA fila que se desliza; desplegado, todo a la vista. Con 25
          profes la rejilla completa se comía la pantalla antes de llegar al horario, que es
          lo que se ha venido a ver. */}
      <div className="space-y-1.5">
        <div className="flex min-h-10 items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{ETIQUETA_LISTA[vista]}</span>
          {lista.length > 6 && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={desplegado}
              onClick={() => { haptic.tap(); setDesplegado((d) => !d); }}
            >
              {desplegado ? 'Plegar' : `Ver los ${lista.length}`}
              <ChevronDown aria-hidden className={cn('transition-transform', desplegado && 'rotate-180')} />
            </Button>
          )}
        </div>
        <Filtros
          etiqueta={ETIQUETA_LISTA[vista]}
          className={cn('-mx-4 px-4 pb-1 sm:mx-0 sm:px-0', desplegado ? 'flex-wrap' : 'flex-nowrap overflow-x-auto')}
        >
          {lista.map((o) => {
            const cargando = pendiente && yendo === `${vista}:${o.clave}`;
            const activo = clave === o.clave;
            return (
              <Filtro
                key={o.clave}
                activo={activo || cargando}
                onClick={() => ir(vista, o.clave)}
                icono={cargando ? <Loader2 aria-hidden className="animate-spin" /> : undefined}
              >
                {o.etiqueta}
                {o.pista && !activo && !cargando && (
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{o.pista}</span>
                )}
              </Filtro>
            );
          })}
          {lista.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nada que mostrar.</p>}
        </Filtros>
      </div>
    </div>
  );
}
