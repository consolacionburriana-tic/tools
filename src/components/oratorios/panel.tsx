'use client';

// /gestion/oratorios para quien lo lleva: cinco pestañas sobre el mismo estado. Todo el curso
// viaja de una vez y los candidatos se calculan aquí (`oratorios.ts`), así que pasar de
// semana o de pestaña no cuesta un viaje al servidor. Ficha: docs/25-oratorios.md
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { crearContexto, PESTANAS_ORA, type Disponibilidad, type SesionOra, type TipoMomento } from '@/lib/oratorios';
import type { AjustesOra, DatosPanel } from '@/lib/oratorios-server';
import { api } from './comun';
import { Planificar } from './planificar';
import { ListaSesiones } from './sesiones';
import { Numeros } from './numeros';
import { EditorDisponibilidad } from './disponibilidad';
import { Ajustes } from './ajustes';
import { DetalleSesion } from './detalle';

export type Pestana = (typeof PESTANAS_ORA)[number];
const PESTANAS: { clave: Pestana; emoji: string; texto: string }[] = [
  { clave: 'planificar', emoji: '🗓️', texto: 'Planificar' },
  { clave: 'sesiones', emoji: '📋', texto: 'Sesiones' },
  { clave: 'numeros', emoji: '📊', texto: 'Números' },
  { clave: 'huecos', emoji: '⏰', texto: 'Mis huecos' },
  { clave: 'ajustes', emoji: '⚙️', texto: 'Ajustes' },
];

/** Lo que comparten las pestañas: estado y las operaciones que lo cambian. */
export interface Estado {
  datos: DatosPanel;
  tipos: TipoMomento[];
  sesiones: SesionOra[];
  ajustes: AjustesOra;
  disponibilidad: Record<string, Disponibilidad[]>;
  ctx: ReturnType<typeof crearContexto>;
  tipoId: string;
  setTipoId: (id: string) => void;
  responsable: string;
  setResponsable: (email: string) => void;
  guardarSesiones: (nuevas: SesionOra[], borradas?: string[]) => void;
  setDisponibilidad: (email: string, huecos: Disponibilidad[]) => void;
  setTipos: (t: TipoMomento[]) => void;
  setAjustes: (a: AjustesOra) => void;
  abrir: (id: string) => void;
  moviendo: string | null;
  mover: (id: string | null) => void;
  lote: (accion: Parameters<typeof api.lote>[0], ids: string[], dias?: number) => Promise<void>;
  ocupado: boolean;
}

export function PanelOratorios({ datos, tabInicial }: { datos: DatosPanel; tabInicial: Pestana }) {
  const [pestana, setPestana] = useState<Pestana>(tabInicial);
  const [tipos, setTipos] = useState(datos.tipos);
  const [sesiones, setSesiones] = useState(datos.sesiones);
  const [ajustes, setAjustes] = useState(datos.ajustes);
  const [disponibilidad, setDisp] = useState(datos.disponibilidad);
  const activos = tipos.filter((t) => t.activo);
  const [tipoId, setTipoId] = useState(activos[0]?.id ?? tipos[0]?.id ?? '');
  const [responsable, setResponsable] = useState(datos.yo.email);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ctx = useMemo(
    () =>
      crearContexto({
        tipos,
        sesiones,
        horario: datos.horario,
        periodos: datos.periodos,
        trimestres: ajustes.trimestres,
        festivos: datos.festivos,
        salidas: datos.salidas,
        hoy: datos.hoy,
      }),
    [tipos, sesiones, datos.horario, datos.periodos, ajustes.trimestres, datos.festivos, datos.salidas, datos.hoy],
  );

  function guardarSesiones(nuevas: SesionOra[], borradas: string[] = []) {
    setSesiones((prev) => {
      const fuera = new Set(borradas);
      const por = new Map(prev.filter((s) => !fuera.has(s.id)).map((s) => [s.id, s]));
      for (const s of nuevas) por.set(s.id, s);
      return [...por.values()].sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`));
    });
  }

  async function lote(accion: Parameters<typeof api.lote>[0], ids: string[], dias?: number) {
    if (ids.length === 0) return;
    setOcupado(true);
    try {
      const r = await api.lote(accion, ids, dias);
      guardarSesiones(r.sesiones, r.borradas);
      haptic.success();
      const conError = r.sesiones.find((s) => s.calendarioError || s.avisoError);
      if (conError) toast.warning(r.mensaje, { description: conError.calendarioError ?? conError.avisoError ?? undefined });
      else toast.success(r.mensaje);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido');
    } finally {
      setOcupado(false);
    }
  }

  function cambiarPestana(p: Pestana) {
    setPestana(p);
    haptic.tap();
    const url = new URL(window.location.href);
    url.searchParams.set('tab', p);
    window.history.replaceState(null, '', url);
  }

  const estado: Estado = {
    datos,
    tipos,
    sesiones,
    ajustes,
    disponibilidad,
    ctx,
    tipoId,
    setTipoId,
    responsable,
    setResponsable,
    guardarSesiones,
    setDisponibilidad: (email, huecos) => setDisp((prev) => ({ ...prev, [email]: huecos })),
    setTipos,
    setAjustes,
    abrir: setAbierta,
    moviendo,
    mover: (id) => {
      setMoviendo(id);
      setAbierta(null);
      if (id) cambiarPestana('planificar');
    },
    lote,
    ocupado,
  };

  return (
    <div className="space-y-4">
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => cambiarPestana(p.clave)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
              pestana === p.clave
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
            )}
          >
            <span aria-hidden>{p.emoji}</span>
            <span className={cn(pestana === p.clave ? 'inline' : 'hidden sm:inline')}>{p.texto}</span>
          </button>
        ))}
      </nav>

      {pestana === 'planificar' && <Planificar e={estado} />}
      {pestana === 'sesiones' && <ListaSesiones e={estado} />}
      {pestana === 'numeros' && <Numeros e={estado} />}
      {pestana === 'huecos' && <EditorDisponibilidad key={responsable} e={estado} />}
      {pestana === 'ajustes' && <Ajustes e={estado} />}

      <DetalleSesion e={estado} id={abierta} onClose={() => setAbierta(null)} />
    </div>
  );
}
