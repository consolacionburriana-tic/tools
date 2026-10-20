'use client';

// Dispositivos 1:1 (docs/29-dispositivos.md): las cuatro pestañas y el estado compartido.
//
// Todo el panel viaja en el HTML (282 alumnos, el inventario y los modelos caben de sobra), así
// que cambiar de pestaña, de clase o de filtro no cuesta ni una petición. Cada guardado devuelve
// lo que ha cambiado (el estado del alumno y los iPads que han cambiado de manos) y se mezcla aquí.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Receipt, Tablet, Users } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { VISTAS, type EstadoAlumnoInput, type Vista } from '@/lib/dispositivos';
import type { AlumnoDis, AparatoDis, EstadoDis, ModeloDis, PanelDispositivos as Panel } from '@/lib/dispositivos-server';
import { pedir } from './comun';
import { TablaAlumnado, type FiltroAlumnado } from './tabla-alumnado';
import { FichaEstado } from './ficha-estado';
import { Cuotas } from './cuotas';
import { IpadsDelCole } from './ipads-cole';
import { Modelos } from './modelos';

export interface Acciones {
  /** Guarda el estado de un alumno y mezcla lo que vuelve. Devuelve si fue bien. */
  guardar: (input: EstadoAlumnoInput) => Promise<boolean>;
  guardando: string | null;
  abrirFicha: (id: string) => void;
  /** Mezcla iPads del cole que han cambiado (alta, edición, devolución). */
  mezclarAparatos: (lista: AparatoDis[], quitar?: string[]) => void;
  mezclarEstados: (estados: Record<string, EstadoDis | null>) => void;
  setModelos: (m: ModeloDis[]) => void;
  irA: (vista: Vista, filtro?: FiltroAlumnado) => void;
}

export function PanelDispositivos({ inicial, vistaInicial, alumnoInicial = null }: { inicial: Panel; vistaInicial: Vista; alumnoInicial?: string | null }) {
  const [panel, setPanel] = useState(inicial);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [filtro, setFiltro] = useState<FiltroAlumnado>('todos');
  const [fichaId, setFichaId] = useState<string | null>(alumnoInicial);
  const [guardando, setGuardando] = useState<string | null>(null);

  // El botón «atrás» del navegador mueve de pestaña (la pestaña va en `?vista=`).
  useEffect(() => {
    const alVolver = () => {
      const v = new URL(window.location.href).searchParams.get('vista');
      setVista((VISTAS as readonly string[]).includes(v ?? '') ? (v as Vista) : 'alumnado');
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const irA = useCallback((v: Vista, f?: FiltroAlumnado) => {
    haptic.tap();
    setVista(v);
    if (f) setFiltro(f);
    const url = new URL(window.location.href);
    url.searchParams.set('vista', v);
    window.history.pushState(null, '', url);
  }, []);

  const mezclarAparatos = useCallback((lista: AparatoDis[], quitar: string[] = []) => {
    if (lista.length === 0 && quitar.length === 0) return;
    setPanel((p) => {
      const porId = new Map(p.aparatos.map((a) => [a.id, a]));
      for (const id of quitar) porId.delete(id);
      for (const a of lista) porId.set(a.id, a);
      return { ...p, aparatos: [...porId.values()].sort((x, y) => x.codigo.localeCompare(y.codigo, 'es', { numeric: true })) };
    });
  }, []);

  const mezclarEstados = useCallback((estados: Record<string, EstadoDis | null>) => {
    setPanel((p) => ({ ...p, alumnos: p.alumnos.map((a) => (a.id in estados ? { ...a, estado: estados[a.id] } : a)) }));
  }, []);

  const guardar = useCallback(
    async (input: EstadoAlumnoInput) => {
      setGuardando(input.eduStudentId);
      try {
        const r = await pedir<{ estado: EstadoDis | null; aparatos: AparatoDis[] }>('/api/dispositivos/alumnos', 'POST', input);
        mezclarEstados({ [input.eduStudentId]: r.estado });
        mezclarAparatos(r.aparatos);
        haptic.success();
        return true;
      } catch (error) {
        haptic.warning();
        toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
        return false;
      } finally {
        setGuardando(null);
      }
    },
    [mezclarAparatos, mezclarEstados],
  );

  const acciones: Acciones = {
    guardar,
    guardando,
    abrirFicha: (id) => {
      haptic.tap();
      setFichaId(id);
    },
    mezclarAparatos,
    mezclarEstados,
    setModelos: (modelos) => setPanel((p) => ({ ...p, modelos })),
    irA,
  };

  const sinInformar = useMemo(() => panel.alumnos.filter((a) => !a.estado).length, [panel.alumnos]);
  const ficha: AlumnoDis | undefined = fichaId ? panel.alumnos.find((a) => a.id === fichaId) : undefined;

  const pestanas: { v: Vista; label: string; icono: React.ReactNode; badge?: string; aviso?: boolean }[] = [
    { v: 'alumnado', label: 'Alumnado', icono: <Users className="h-4 w-4" />, badge: sinInformar ? `${sinInformar} sin informar` : undefined, aviso: true },
    { v: 'cuotas', label: 'Cuotas', icono: <Receipt className="h-4 w-4" /> },
    { v: 'cole', label: 'iPads del cole', icono: <Tablet className="h-4 w-4" />, badge: panel.aparatos.length ? String(panel.aparatos.filter((a) => a.estado !== 'baja').length) : undefined },
    { v: 'modelos', label: 'Modelos', icono: <Boxes className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dispositivos 1:1</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Curso {panel.cursoActual} · {panel.alumnos.length} alumnos · {panel.alcance.etiqueta}, como AUTOASM ({panel.alcance.origen})
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60" aria-label="Pestañas">
        {pestanas.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => irA(p.v)}
            aria-current={vista === p.v ? 'page' : undefined}
            className={cn(
              'flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors',
              vista === p.v
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            {p.icono}
            {p.label}
            {p.badge && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  p.aviso ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
                )}
              >
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {vista === 'alumnado' && <TablaAlumnado panel={panel} acciones={acciones} filtro={filtro} setFiltro={setFiltro} />}
      {vista === 'cuotas' && <Cuotas panel={panel} acciones={acciones} />}
      {vista === 'cole' && <IpadsDelCole panel={panel} acciones={acciones} />}
      {vista === 'modelos' && <Modelos modelos={panel.modelos} acciones={acciones} />}

      {ficha && <FichaEstado alumno={ficha} panel={panel} acciones={acciones} onCerrar={() => setFichaId(null)} />}
    </div>
  );
}
