'use client';

// /gestion/calendarios: el inventario de calendarios secundarios del dominio, para ver qué
// dejó cada clase de Classroom y borrarlo en bloque. Ficha: docs/25-calendarios.md
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarX2,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ESTADO_CLASE_LABELS,
  GRUPO_LABELS,
  motivoNoBorrable,
  type CalendarioFila,
  type GrupoCalendario,
} from '@/lib/calendarios';

type Pestana = GrupoCalendario | 'borrados';
const PESTANAS: Pestana[] = ['anteriores', 'huerfano', 'este', 'otro', 'limbo', 'borrados'];
const PESTANA_LABELS: Record<Pestana, string> = {
  anteriores: 'Cursos anteriores',
  huerfano: 'Clase ya borrada',
  este: 'Este curso',
  otro: 'Otros',
  limbo: 'Sin dueño activo',
  borrados: 'Borrados',
};

type FiltroEventos = 'todos' | 'sin' | 'con' | 'futuros';
const FILTROS_EVENTOS: [FiltroEventos, string][] = [
  ['todos', 'Todos'],
  ['sin', 'Sin eventos'],
  ['con', 'Con eventos'],
  ['futuros', 'Con eventos futuros'],
];

interface Comprobacion {
  clave: string;
  nombre: string;
  scope: string;
  api: string;
  ok: boolean;
  detalle: string;
}

const API = '/api/calendarios/admin';

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}
const post = <T,>(url: string, body: unknown) =>
  pedir<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function PanelCalendarios({ iniciales, errorInicial }: { iniciales: CalendarioFila[]; errorInicial: string | null }) {
  const [calendarios, setCalendarios] = useState(iniciales);
  const [pestana, setPestana] = useState<Pestana>('anteriores');
  const [filtroEventos, setFiltroEventos] = useState<FiltroEventos>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [permisos, setPermisos] = useState<{ admin: string; comprobaciones: Comprobacion[] } | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [barridoCompleto, setBarridoCompleto] = useState(true);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const vivos = calendarios.filter((c) => !c.borradoAt);
  const cuenta = (p: Pestana) => (p === 'borrados' ? calendarios.length - vivos.length : vivos.filter((c) => c.grupo === p).length);
  const ultimoEscaneo = calendarios.reduce<string | null>((m, c) => (!m || c.vistoAt > m ? c.vistoAt : m), null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return calendarios
      .filter((c) => (pestana === 'borrados' ? c.borradoAt : !c.borradoAt && c.grupo === pestana))
      .filter((c) => {
        if (filtroEventos === 'sin') return c.eventos === 0;
        if (filtroEventos === 'con') return (c.eventos ?? 0) > 0;
        if (filtroEventos === 'futuros') return (c.eventosFuturos ?? 0) > 0;
        return true;
      })
      .filter(
        (c) =>
          !q ||
          `${c.nombre ?? ''} ${c.courseNombre ?? ''} ${c.courseSeccion ?? ''} ${c.courseOwnerEmail ?? ''} ${c.propietarios.join(' ')}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => (a.curso ?? '').localeCompare(b.curso ?? '') || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }, [calendarios, pestana, filtroEventos, busqueda]);

  const borrables = visibles.filter((c) => motivoNoBorrable(c) === null);
  const elegidos = calendarios.filter((c) => seleccion.has(c.id));

  function alternar(id: string) {
    haptic.tap();
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodos() {
    haptic.tap();
    const todos = borrables.every((c) => seleccion.has(c.id));
    setSeleccion((s) => {
      const n = new Set(s);
      for (const c of borrables) {
        if (todos) n.delete(c.id);
        else n.add(c.id);
      }
      return n;
    });
  }

  async function comprobarPermisos() {
    setComprobando(true);
    try {
      setPermisos(await pedir(`${API}/permisos`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido comprobar');
    } finally {
      setComprobando(false);
    }
  }

  async function recargar() {
    const { calendarios: nuevos } = await pedir<{ calendarios: CalendarioFila[] }>(`${API}/lista`);
    setCalendarios(nuevos);
  }

  async function escanear() {
    const inicio = new Date().toISOString();
    try {
      // 1. Classroom
      let cursor: string | null = null;
      let clases = 0;
      do {
        setProgreso(`Leyendo las clases de Classroom… (${clases})`);
        const r: { siguiente: string | null; clases: number } = await post(`${API}/escanear`, { paso: 'classroom', cursor, inicio });
        clases += r.clases;
        cursor = r.siguiente;
      } while (cursor);

      // 2. Usuarios (opcional)
      if (barridoCompleto) {
        let usuarios = 0;
        let errores = 0;
        cursor = null;
        do {
          setProgreso(`Mirando los calendarios de cada usuario… (${usuarios} usuarios${errores ? `, ${errores} sin poder leer` : ''})`);
          const r: { siguiente: string | null; usuarios: number; errores: number } = await post(`${API}/escanear`, {
            paso: 'usuarios',
            cursor,
            inicio,
          });
          usuarios += r.usuarios;
          errores += r.errores;
          cursor = r.siguiente;
        } while (cursor);
      }

      // 3. Eventos
      let hechos = 0;
      for (;;) {
        const r: { hechos: number; quedan: number } = await post(`${API}/escanear`, { paso: 'eventos', inicio });
        hechos += r.hechos;
        setProgreso(`Contando eventos… (${hechos} hechos, quedan ${r.quedan})`);
        if (r.quedan === 0 || r.hechos === 0) break;
      }

      await recargar();
      haptic.success();
      toast.success(`Escaneo terminado: ${clases} clases de Classroom`);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'El escaneo se ha cortado');
      await recargar().catch(() => null);
    } finally {
      setProgreso(null);
    }
  }

  async function borrar() {
    const ids = [...seleccion];
    setConfirmar(false);
    let ok = 0;
    let fallos = 0;
    try {
      for (let i = 0; i < ids.length; i += 10) {
        setProgreso(`Borrando… ${Math.min(i, ids.length)} de ${ids.length}`);
        const { resultados } = await post<{ resultados: { id: string; ok: boolean }[] }>(`${API}/borrar`, {
          ids: ids.slice(i, i + 10),
          confirmacion: 'BORRAR',
        });
        ok += resultados.filter((r) => r.ok).length;
        fallos += resultados.filter((r) => !r.ok).length;
      }
      if (fallos) {
        haptic.warning();
        toast.warning(`${ok} borrados · ${fallos} no se han podido (mira el motivo en cada uno)`);
      } else {
        haptic.success();
        toast.success(`${ok} calendarios borrados`);
      }
      setSeleccion(new Set());
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error borrando');
    } finally {
      await recargar().catch(() => null);
      setProgreso(null);
    }
  }

  const ocupado = progreso !== null;
  const elegidosConFuturos = elegidos.filter((c) => (c.eventosFuturos ?? 0) > 0).length;
  const elegidosActivos = elegidos.filter((c) => c.clasePresente && c.courseEstado === 'ACTIVE').length;

  return (
    <div className="space-y-5 pb-24">
      {errorInicial && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {errorInicial}
        </p>
      )}

      {/* ── Escanear ───────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Inventario</p>
            <p className="text-xs text-zinc-500">
              {ultimoEscaneo
                ? `${vivos.length} calendarios vivos · último escaneo ${fecha(ultimoEscaneo)}`
                : 'Todavía no se ha escaneado el dominio'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={comprobarPermisos}
              disabled={comprobando || ocupado}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {comprobando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Comprobar permisos
            </button>
            <button
              type="button"
              onClick={escanear}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {ultimoEscaneo ? 'Volver a escanear' : 'Escanear el dominio'}
            </button>
          </div>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={barridoCompleto}
            onChange={(e) => setBarridoCompleto(e.target.checked)}
            className="mt-0.5 h-4 w-4"
            disabled={ocupado}
          />
          <span>
            Barrido completo por usuarios{' '}
            <span className="text-xs text-zinc-500">
              (mira la lista de calendarios de cada cuenta: es lo único que encuentra los de clases ya borradas y dice a
              cuánta gente le sale cada uno; tarda más)
            </span>
          </span>
        </label>
        {progreso && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> {progreso}
          </p>
        )}
        {permisos && <Permisos admin={permisos.admin} comprobaciones={permisos.comprobaciones} />}
      </section>

      {/* ── Pestañas y filtros ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
          {PESTANAS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                haptic.tap();
                setPestana(p);
              }}
              title={p === 'borrados' ? 'Lo que ya se ha borrado desde aquí' : GRUPO_LABELS[p]}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                pestana === p
                  ? 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
              )}
            >
              {PESTANA_LABELS[p]} <span className="text-xs text-zinc-400">{cuenta(p)}</span>
            </button>
          ))}
        </div>
        <select
          value={filtroEventos}
          onChange={(e) => setFiltroEventos(e.target.value as FiltroEventos)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {FILTROS_EVENTOS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, sección o profe"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      {pestana === 'limbo' && (
        <p className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-100/70 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Se intentaron borrar y no se pudo: ninguna cuenta activa del dominio es su dueña. Casi siempre son calendarios de
          clases viejas cuyo creador ya no está en el centro (cuenta suspendida o borrada), y Google solo deja borrarlos a
          su dueño. Aquí se quedan apartados para que no estorben. Si alguno molesta de verdad, se puede reactivar esa
          cuenta un momento, o transferir la clase, y volver a escanear.
        </p>
      )}

      {pestana === 'este' && vivos.some((c) => c.grupo === 'este') && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Son de clases de este curso. Si se borra el calendario de una clase activa, Classroom deja de enseñar ahí las
          fechas de entrega (las tareas no se tocan).
        </p>
      )}

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {pestana !== 'borrados' && borrables.length > 0 && (
          <label className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={borrables.every((c) => seleccion.has(c.id))}
              onChange={alternarTodos}
            />
            Seleccionar los {borrables.length} que se ven
          </label>
        )}
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            {calendarios.length === 0 ? 'Escanea el dominio para empezar.' : 'No hay calendarios con estos filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((c) => (
              <Fila key={c.id} c={c} marcado={seleccion.has(c.id)} onAlternar={() => alternar(c.id)} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Barra de borrado ───────────────────────────────────────────── */}
      {seleccion.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {seleccion.size} seleccionado(s)
              <button type="button" onClick={() => setSeleccion(new Set())} className="ml-3 text-xs text-zinc-500 underline">
                quitar selección
              </button>
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                haptic.tap();
                setConfirmar(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Borrar {seleccion.size}
            </button>
          </div>
        </div>
      )}

      <ConfirmarBorrado
        abierto={confirmar}
        n={elegidos.length}
        conFuturos={elegidosConFuturos}
        activos={elegidosActivos}
        conEventos={elegidos.filter((c) => (c.eventos ?? 0) > 0).length}
        onCerrar={() => setConfirmar(false)}
        onConfirmar={borrar}
      />
    </div>
  );
}

function Fila({ c, marcado, onAlternar }: { c: CalendarioFila; marcado: boolean; onAlternar: () => void }) {
  const noBorrable = motivoNoBorrable(c);
  const propietario = c.propietarios[0] ?? c.courseOwnerEmail;
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', marcado && 'bg-red-50/60 dark:bg-red-500/5')}>
      {c.borradoAt ? (
        <CalendarX2 className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
      ) : (
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={marcado}
          disabled={noBorrable !== null}
          title={noBorrable ?? undefined}
          onChange={onAlternar}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-zinc-900 dark:text-zinc-100">
          <span className="truncate">{c.nombre ?? c.courseNombre ?? '(sin nombre)'}</span>
          {c.courseSeccion && <span className="text-xs font-normal text-zinc-500">{c.courseSeccion}</span>}
          {c.curso && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {c.curso}
            </span>
          )}
          {c.esClassroom && c.courseEstado && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                c.courseEstado === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
              )}
            >
              {c.clasePresente ? (ESTADO_CLASE_LABELS[c.courseEstado] ?? c.courseEstado) : 'Clase borrada'}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {propietario ?? 'Propietario desconocido'}
          {c.suscriptores > 0 && ` · le sale a ${c.suscriptores} persona(s)`}
          {c.courseCreadoAt && ` · clase creada el ${fecha(c.courseCreadoAt)}`}
        </p>
        {c.borradoAt && (
          <p className="mt-0.5 text-xs text-zinc-500">
            Borrado el {fecha(c.borradoAt)} por {c.borradoPor}
          </p>
        )}
        {!c.borradoAt && c.borradoError && (
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">No se pudo borrar: {c.borradoError}</p>
        )}
        {noBorrable && !c.borradoAt && <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{noBorrable}</p>}
      </div>
      <Eventos c={c} />
    </li>
  );
}

function Eventos({ c }: { c: CalendarioFila }) {
  if (c.eventos === null) {
    return (
      <span className="shrink-0 text-right text-xs text-zinc-400" title={c.eventosError ?? undefined}>
        {c.eventosError ? 'No se pudo leer' : 'Sin contar'}
      </span>
    );
  }
  if (c.eventos === 0) return <span className="shrink-0 text-right text-xs text-zinc-400">Vacío</span>;
  return (
    <span className="shrink-0 text-right text-xs">
      <span className="block font-semibold text-zinc-800 dark:text-zinc-200">{c.eventos} evento(s)</span>
      {(c.eventosFuturos ?? 0) > 0 ? (
        <span className="block text-amber-600 dark:text-amber-400">{c.eventosFuturos} por venir</span>
      ) : (
        <span className="block text-zinc-400">último {fecha(c.ultimoEventoAt)}</span>
      )}
    </span>
  );
}

function Permisos({ admin, comprobaciones }: { admin: string; comprobaciones: Comprobacion[] }) {
  const faltan = comprobaciones.filter((c) => !c.ok);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
      <p className="text-xs text-zinc-500">
        Suplantando a <b>{admin}</b> (tiene que ser administrador del dominio; se cambia con <code>GOOGLE_ADMIN_BUZON</code>)
      </p>
      <ul className="space-y-1.5">
        {comprobaciones.map((c) => (
          <li key={c.clave} className="flex items-start gap-2">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>
              <b>{c.nombre}</b> — {c.detalle}
            </span>
          </li>
        ))}
      </ul>
      {faltan.length > 0 && (
        <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          <p className="font-semibold">Qué hacer (una vez):</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              Consola de admin → Seguridad → Control de API → Delegación de todo el dominio → el Client ID de la cuenta de
              servicio (el mismo de <code>gmail.send</code>) → Editar, y añadir:
              <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[11px] dark:bg-zinc-900">
                {faltan.map((c) => c.scope).join(',\n')}
              </pre>
            </li>
            <li>
              En Google Cloud (proyecto de la cuenta de servicio) → APIs y servicios → habilitar:{' '}
              {faltan.map((c) => c.api).join(', ')}.
            </li>
          </ol>
        </div>
      )}
      {faltan.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Todo listo para escanear
        </p>
      )}
    </div>
  );
}

function ConfirmarBorrado({
  abierto,
  n,
  conEventos,
  conFuturos,
  activos,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  n: number;
  conEventos: number;
  conFuturos: number;
  activos: number;
  onCerrar: () => void;
  onConfirmar: () => void;
}) {
  const [texto, setTexto] = useState('');
  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o) {
          setTexto('');
          onCerrar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrar {n} calendario(s)</DialogTitle>
          <DialogDescription>
            Se borran de Google Calendar para todo el mundo, con sus eventos. Esto no se deshace desde aquí.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          <li>· {conEventos} tienen eventos</li>
          {conFuturos > 0 && <li className="text-amber-700 dark:text-amber-400">· {conFuturos} tienen eventos por venir</li>}
          {activos > 0 && (
            <li className="text-amber-700 dark:text-amber-400">
              · {activos} son de clases que siguen activas en Classroom
            </li>
          )}
        </ul>
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          Escribe <b>BORRAR</b> para confirmar
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              setTexto('');
              onCerrar();
            }}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={texto.trim() !== 'BORRAR'}
            onClick={() => {
              setTexto('');
              onConfirmar();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Borrar de verdad
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
