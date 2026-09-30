'use client';

// Pestaña «Clases de Classroom» de /gestion/calendarios. Ficha: docs/25-calendarios.md
//
// Dos usos (David, 30-sep-2026):
//   A) «Colarse» en clases ajenas: meter a alguien como PROFE (p. ej. las tutorías, para
//      poder publicar ahí las evaluaciones). Se filtra por texto libre y fecha de creación.
//   B) Revisar las viejas y borrarlas (por defecto, las de 3 años o más).
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Search, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ANIOS_POR_DEFECTO,
  ESTADO_CLASE_LABELS,
  cursoAcademicoActualClassroom,
  cursoLimite,
  type ClaseFila,
} from '@/lib/calendarios';
import { COLEGIO } from '@/lib/colegio';

type FiltroEstado = 'todas' | 'ARCHIVED' | 'ACTIVE' | 'otras';
const FILTROS_ESTADO: [FiltroEstado, string][] = [
  ['todas', 'Cualquier estado'],
  ['ARCHIVED', 'Archivadas'],
  ['ACTIVE', 'Activas'],
  ['otras', 'Sin aceptar / otras'],
];

const API = '/api/calendarios/admin/clases';

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** 1 de julio del curso en vigor, en formato de <input type="date">. */
function inicioCursoActual(): string {
  return `${cursoAcademicoActualClassroom().slice(0, 4)}-07-01`;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

interface Resultado {
  id: string;
  ok: boolean;
  mensaje: string;
}

export function PanelClases({ iniciales }: { iniciales: ClaseFila[] }) {
  const [clases, setClases] = useState(iniciales);
  const [soloViejas, setSoloViejas] = useState(true);
  const [anios, setAnios] = useState(ANIOS_POR_DEFECTO);
  const [estado, setEstado] = useState<FiltroEstado>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [verBorradas, setVerBorradas] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<'profe' | 'borrar' | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Map<string, Resultado>>(new Map());

  async function recargar() {
    const r = await fetch(API);
    const j = (await r.json().catch(() => null)) as { clases?: ClaseFila[] } | null;
    if (j?.clases) setClases(j.clases);
  }

  // Al entrar en la pestaña, lo último (puede venir de un escaneo recién hecho).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
    recargar().catch(() => null);
  }, []);

  const vivas = clases.filter((c) => !c.borradoAt && c.estado !== 'DESAPARECIDA');
  const borradas = clases.filter((c) => c.borradoAt);
  const viejas = vivas.filter((c) => c.antiguedad !== null && c.antiguedad >= anios);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const d = desde ? new Date(`${desde}T00:00:00`) : null;
    const h = hasta ? new Date(`${hasta}T23:59:59`) : null;
    const base = verBorradas ? borradas : soloViejas ? viejas : vivas;
    return base
      .filter((c) => {
        if (estado === 'todas') return true;
        if (estado === 'otras') return c.estado !== 'ACTIVE' && c.estado !== 'ARCHIVED';
        return c.estado === estado;
      })
      .filter((c) => {
        if (!d && !h) return true;
        if (!c.creadaAt) return false;
        const creada = new Date(c.creadaAt);
        return (!d || creada >= d) && (!h || creada <= h);
      })
      .filter((c) => !q || `${c.nombre ?? ''} ${c.seccion ?? ''} ${c.ownerEmail ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.curso ?? '').localeCompare(b.curso ?? '') || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }, [vivas, viejas, borradas, verBorradas, soloViejas, estado, busqueda, desde, hasta]);

  const seleccionables = verBorradas ? [] : visibles;
  const elegidas = clases.filter((c) => seleccion.has(c.id));

  function alternar(id: string) {
    haptic.tap();
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodas() {
    haptic.tap();
    const todas = seleccionables.every((c) => seleccion.has(c.id));
    setSeleccion((s) => {
      const n = new Set(s);
      for (const c of seleccionables) {
        if (todas) n.delete(c.id);
        else n.add(c.id);
      }
      return n;
    });
  }

  /** Lanza una acción por tandas, apunta el resultado de cada clase y recarga. */
  async function porTandas(
    etiqueta: string,
    tamano: number,
    llamar: (ids: string[]) => Promise<{ resultados: Resultado[] }>,
  ): Promise<void> {
    const ids = [...seleccion];
    const nuevos = new Map(resultados);
    let ok = 0;
    let fallos = 0;
    try {
      for (let i = 0; i < ids.length; i += tamano) {
        setProgreso(`${etiqueta}… ${i} de ${ids.length}`);
        const { resultados: rs } = await llamar(ids.slice(i, i + tamano));
        for (const r of rs) {
          nuevos.set(r.id, r);
          if (r.ok) ok++;
          else fallos++;
        }
        setResultados(new Map(nuevos));
      }
      if (fallos) {
        haptic.warning();
        toast.warning(`${ok} hechas · ${fallos} con error (el motivo sale en cada clase)`);
      } else {
        haptic.success();
        toast.success(`${ok} hechas`);
      }
      setSeleccion(new Set());
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Se ha cortado');
    } finally {
      await recargar().catch(() => null);
      setProgreso(null);
    }
  }

  const ocupado = progreso !== null;

  return (
    <div className="space-y-5 pb-24">
      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-3 text-zinc-700 dark:text-zinc-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={soloViejas}
              disabled={verBorradas}
              onChange={(e) => setSoloViejas(e.target.checked)}
            />
            Solo las de
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={anios}
            onChange={(e) => setAnios(Math.max(1, Math.min(20, Number(e.target.value) || ANIOS_POR_DEFECTO)))}
            className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-center dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span>
            años o más <span className="text-xs text-zinc-500">(del {cursoLimite(anios)} hacia atrás)</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="text-xs text-zinc-500">Creadas</span>
          <label className="flex items-center gap-1 text-xs">
            desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          {/* Las clases del curso se crean a partir del 1 de julio, casi siempre antes de noviembre */}
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              setDesde(inicioCursoActual());
              setHasta('');
              setSoloViejas(false);
            }}
            className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
          >
            Las de este curso
          </button>
          {(desde || hasta) && (
            <button
              type="button"
              onClick={() => {
                setDesde('');
                setHasta('');
              }}
              className="text-xs text-zinc-500 underline"
            >
              quitar fechas
            </button>
          )}
        </div>

        <p className="text-xs text-zinc-500">
          {vivas.length === 0
            ? 'Todavía no hay clases: escanea el dominio en la pestaña de calendarios.'
            : `${visibles.length} clases con estos filtros · ${viejas.length} de ${vivas.length} tienen ${anios} años o más`}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {FILTROS_ESTADO.map(([v, l]) => (
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
            placeholder="Texto libre: «tutoría», «matemáticas», «3ESO», un profe…"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        {borradas.length > 0 && (
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              setVerBorradas((v) => !v);
              setSeleccion(new Set());
            }}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm',
              verBorradas
                ? 'border-zinc-400 bg-zinc-100 font-semibold dark:border-zinc-500 dark:bg-zinc-800'
                : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
            )}
          >
            Borradas {borradas.length}
          </button>
        )}
      </div>

      {progreso && (
        <p className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> {progreso}
        </p>
      )}

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {seleccionables.length > 0 && (
          <label className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={seleccionables.every((c) => seleccion.has(c.id))}
              onChange={alternarTodas}
            />
            Seleccionar las {seleccionables.length} que se ven
          </label>
        )}
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">No hay clases con estos filtros.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((c) => (
              <FilaClase
                key={c.id}
                c={c}
                marcada={seleccion.has(c.id)}
                resultado={resultados.get(c.id)}
                onAlternar={verBorradas ? undefined : () => alternar(c.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Barra de acciones ──────────────────────────────────────────── */}
      {seleccion.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="container mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {seleccion.size} clase(s)
              <button type="button" onClick={() => setSeleccion(new Set())} className="ml-3 text-xs text-zinc-500 underline">
                quitar selección
              </button>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  haptic.tap();
                  setDialogo('profe');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" /> Añadir profe
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  haptic.tap();
                  setDialogo('borrar');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogoProfe
        abierto={dialogo === 'profe'}
        n={elegidas.length}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(email) => {
          setDialogo(null);
          void porTandas(`Añadiendo a ${email}`, 30, (ids) => post(`${API}/profe`, { ids, email }));
        }}
      />
      <DialogoBorrar
        abierto={dialogo === 'borrar'}
        n={elegidas.length}
        activas={elegidas.filter((c) => c.estado === 'ACTIVE').length}
        deEsteCurso={elegidas.filter((c) => c.antiguedad === 0).length}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(conCalendario) => {
          setDialogo(null);
          void porTandas('Borrando clases', 15, (ids) =>
            post(`${API}/borrar`, { ids, conCalendario, confirmacion: 'BORRAR' }),
          );
        }}
      />
    </div>
  );
}

function FilaClase({
  c,
  marcada,
  resultado,
  onAlternar,
}: {
  c: ClaseFila;
  marcada: boolean;
  resultado: Resultado | undefined;
  onAlternar?: () => void;
}) {
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', marcada && 'bg-blue-50/60 dark:bg-blue-500/5')}>
      {onAlternar && <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={marcada} onChange={onAlternar} />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-zinc-900 dark:text-zinc-100">
          <span className="truncate">{c.nombre ?? '(sin nombre)'}</span>
          {c.seccion && <span className="text-xs font-normal text-zinc-500">{c.seccion}</span>}
          {c.curso && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {c.curso}
            </span>
          )}
          {c.estado && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                c.estado === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
              )}
            >
              {ESTADO_CLASE_LABELS[c.estado] ?? c.estado}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {c.ownerEmail ?? 'Propietario desconocido'} · creada el {fecha(c.creadaAt)} · último cambio {fecha(c.actualizadaAt)}
          {c.calendarioVivo && ' · su calendario sigue vivo'}
        </p>
        {c.borradoAt && (
          <p className="mt-0.5 text-xs text-zinc-500">
            Borrada el {fecha(c.borradoAt)} por {c.borradoPor}
          </p>
        )}
        {!c.borradoAt && c.borradoError && !resultado && (
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">No se pudo borrar: {c.borradoError}</p>
        )}
        {resultado && (
          <p className={cn('mt-0.5 text-xs', resultado.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {resultado.mensaje}
          </p>
        )}
      </div>
      {c.enlace && !c.borradoAt && (
        <a
          href={c.enlace}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Classroom
        </a>
      )}
    </li>
  );
}

function DialogoProfe({
  abierto,
  n,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  n: number;
  onCerrar: () => void;
  onConfirmar: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const valido = new RegExp(`^[^\\s@]+@${COLEGIO.dominio.replace(/\./g, '\\.')}$`, 'i').test(email.trim());
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir un profe a {n} clase(s)</DialogTitle>
          <DialogDescription>
            Entra directamente como profesor/a, sin invitación: la verá en su Classroom y podrá publicar en ella. Si ya era
            profe de alguna, se deja como está.
          </DialogDescription>
        </DialogHeader>
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          Cuenta del colegio
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`alguien@${COLEGIO.dominio}`}
            autoFocus
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <DialogFooter>
          <button type="button" onClick={onCerrar} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido}
            onClick={() => {
              onConfirmar(email.trim().toLowerCase());
              setEmail('');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <UserPlus className="h-4 w-4" /> Añadir
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoBorrar({
  abierto,
  n,
  activas,
  deEsteCurso,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  n: number;
  activas: number;
  deEsteCurso: number;
  onCerrar: () => void;
  onConfirmar: (conCalendario: boolean) => void;
}) {
  const [texto, setTexto] = useState('');
  const [conCalendario, setConCalendario] = useState(true);
  const cerrar = () => {
    setTexto('');
    onCerrar();
  };
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrar {n} clase(s) de Classroom</DialogTitle>
          <DialogDescription>
            Se eliminan para todo el mundo, con sus tareas, comentarios y notas. Esto no se deshace. Las que no estén
            archivadas se archivan antes (Classroom lo exige). Su carpeta de Drive no se toca.
          </DialogDescription>
        </DialogHeader>
        {(activas > 0 || deEsteCurso > 0) && (
          <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
            {activas > 0 && <li>· {activas} siguen activas</li>}
            {deEsteCurso > 0 && <li>· {deEsteCurso} son de este curso</li>}
          </ul>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="h-4 w-4" checked={conCalendario} onChange={(e) => setConCalendario(e.target.checked)} />
          Borrar también su calendario
        </label>
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
          <button type="button" onClick={cerrar} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            Cancelar
          </button>
          <button
            type="button"
            disabled={texto.trim() !== 'BORRAR'}
            onClick={() => {
              setTexto('');
              onConfirmar(conCalendario);
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
