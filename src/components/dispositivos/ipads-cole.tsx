'use client';

// Pestaña «iPads del cole»: el inventario. Sustitución (S1…), que son los del alumnado —se
// prestan para el curso o se dejan mientras arreglan el de un alumno—, y profesorado (P1…), con
// su modelo, nº de serie, estado y quién lo tiene. Bárbara y Amparo lo vuelcan de una vez: por
// eso el alta es en serie («6 de este modelo») o pegando la columna de números de serie del Excel.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, History, Loader2, Plug, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  ESTADO_APARATO_LABEL,
  ESTADO_CARGADOR_LABEL,
  ESTADOS_APARATO,
  ESTADOS_CARGADOR,
  parsearSeries,
  siguientesCodigos,
  USO_EXPLICA,
  USO_LABEL,
  USOS,
  type EstadoAparato,
  type EstadoCargador,
  type Uso,
} from '@/lib/dispositivos';
import type { AparatoDis, LineaHistorial, PanelDispositivos } from '@/lib/dispositivos-server';
import type { Acciones } from './panel';
import { cuandoYQuien, normalizar, pedir } from './comun';
import { buttonVariants } from '@/components/ui/button';
import { claseCampo } from '@/components/ui/input';

type Filtro = 'todos' | 'almacen' | 'asignados' | 'prestados' | 'temporal' | 'reparacion' | 'sin_cargador' | 'baja';
const FILTRO_LABEL: Record<Filtro, string> = {
  todos: 'Todos',
  almacen: 'En el almacén',
  asignados: 'Dados',
  prestados: 'Prestados',
  temporal: 'Mientras arreglan el suyo',
  reparacion: 'En reparación',
  sin_cargador: 'Sin cargador',
  baja: 'De baja',
};
/** Los de sustitución se reparten en prestados y temporales; los de profesorado, solo «dados». */
const FILTROS: Record<Uso, Filtro[]> = {
  sustitucion: ['todos', 'almacen', 'prestados', 'temporal', 'reparacion', 'sin_cargador', 'baja'],
  profesorado: ['todos', 'almacen', 'asignados', 'reparacion', 'sin_cargador', 'baja'],
};

const COLOR_CARGADOR: Record<EstadoCargador, string> = {
  activo: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  perdido: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  baja: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

/** ¿Tiene un cargador que sirva? Sin cargador, perdido o de baja = no. */
const conCargadorQueSirve = (a: AparatoDis) => a.cargador?.estado === 'activo';

const COLOR_ESTADO: Record<EstadoAparato, string> = {
  activo: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  reparacion: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  baja: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export function IpadsDelCole({ panel, acciones }: { panel: PanelDispositivos; acciones: Acciones }) {
  const [uso, setUso] = useState<Uso>('sustitucion');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [alta, setAlta] = useState(false);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  const modelo = useMemo(() => new Map(panel.modelos.map((m) => [m.id, m.etiqueta])), [panel.modelos]);
  const prestado = useMemo(() => new Set(panel.alumnos.filter((a) => a.estado?.modalidad === 'prestado').map((a) => a.id)), [panel.alumnos]);
  const delUso = panel.aparatos.filter((a) => a.uso === uso);
  const pasa = (a: AparatoDis, f: Filtro) => {
    switch (f) {
      case 'todos':
        return a.estado !== 'baja';
      case 'almacen':
        return !a.titular && a.estado === 'activo';
      case 'asignados':
        return Boolean(a.titular);
      case 'sin_cargador':
        return a.estado !== 'baja' && !conCargadorQueSirve(a);
      case 'prestados':
        return a.titular?.tipo === 'alumno' && prestado.has(a.titular.id);
      case 'temporal':
        return a.titular?.tipo === 'alumno' && !prestado.has(a.titular.id);
      default:
        return a.estado === f;
    }
  };
  /** «1º ESO B · prestado» o «1º ESO B · mientras arreglan el suyo». */
  const detalleTitular = (a: AparatoDis) =>
    !a.titular
      ? ''
      : !a.titular.activo
        ? 'ya no está en el cole'
        : a.titular.tipo === 'alumno'
          ? `${a.titular.detalle} · ${prestado.has(a.titular.id) ? 'prestado' : 'mientras arreglan el suyo'}`
          : a.titular.detalle;
  const q = normalizar(busca.trim());
  const lista = delUso
    .filter((a) => pasa(a, filtro))
    .filter((a) => !q || normalizar([a.codigo, a.numeroSerie, a.titular?.nombre, a.notas].filter(Boolean).join(' ')).includes(q));

  // Gente que ya no está en el cole con un iPad del cole: hay que recogerlo.
  const sinDevolver = panel.aparatos.filter((a) => a.titular && !a.titular.activo);
  const abierto = abiertoId ? panel.aparatos.find((a) => a.id === abiertoId) : undefined;

  return (
    <div className="space-y-4">
      {sinDevolver.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Han dejado el cole con un iPad del cole sin devolver
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {sinDevolver.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setAbiertoId(a.id)} className="cursor-pointer underline">
                  {a.codigo} · {a.titular!.nombre}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {USOS.map((u) => {
          const n = panel.aparatos.filter((a) => a.uso === u && a.estado !== 'baja').length;
          return (
            <button
              key={u}
              type="button"
              onClick={() => {
                haptic.tap();
                setUso(u);
                setFiltro('todos');
              }}
              className={cn(
                'h-11 cursor-pointer rounded-xl border px-4 text-sm transition-colors',
                uso === u
                  ? 'border-zinc-900 bg-zinc-900 font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              {USO_LABEL[u]} <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{USO_EXPLICA[uso]}.</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar iPad</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código, nº de serie o persona…"
            className={cn(claseCampo, 'pl-9')}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS[uso].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cn(
                'h-10 cursor-pointer rounded-full border px-3.5 text-sm',
                filtro === f
                  ? 'border-zinc-900 bg-zinc-100 font-semibold dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              {FILTRO_LABEL[f]} <span className="ml-1 font-semibold">{delUso.filter((a) => pasa(a, f)).length}</span>
            </button>
          ))}
        </div>
        <button type="button" className={cn(buttonVariants(), 'ml-auto')} onClick={() => setAlta(true)}>
          <Plus className="h-4 w-4" /> Dar de alta
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {lista.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            {delUso.length === 0 ? `Todavía no hay iPads de ${USO_LABEL[uso].toLowerCase()}. «Dar de alta» para empezar.` : 'Ninguno con ese filtro.'}
          </p>
        ) : (
          lista.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                haptic.tap();
                setAbiertoId(a.id);
              }}
              className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-100 px-4 py-3 text-left last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <span className="w-14 text-lg font-bold text-zinc-900 dark:text-zinc-100">{a.codigo}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-700 dark:text-zinc-300">
                  {[a.modeloId ? modelo.get(a.modeloId) : null, a.numeroSerie].filter(Boolean).join(' · ') || 'Sin modelo ni nº de serie'}
                </span>
                {a.notas && <span className="block truncate text-xs text-zinc-500">{a.notas}</span>}
              </span>
              <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', COLOR_ESTADO[a.estado])}>{ESTADO_APARATO_LABEL[a.estado]}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                  a.cargador ? COLOR_CARGADOR[a.cargador.estado] : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
                )}
              >
                <Plug className="h-3 w-3" />
                {a.cargador ? (a.cargador.estado === 'activo' ? 'Cargador' : `Cargador ${ESTADO_CARGADOR_LABEL[a.cargador.estado].toLowerCase()}`) : 'Sin cargador'}
              </span>
              <span className="w-full text-sm sm:w-64 sm:text-right">
                {a.titular ? (
                  <span className={cn(!a.titular.activo && 'font-semibold text-red-700 dark:text-red-300')}>
                    {a.titular.nombre}
                    <span className="block text-xs font-normal text-zinc-500">{detalleTitular(a)}</span>
                  </span>
                ) : (
                  <span className="text-zinc-400">{a.estado === 'activo' ? 'En el almacén' : ''}</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>

      {uso === 'profesorado' && <ProfesSinIpad panel={panel} acciones={acciones} />}

      {alta && <AltaAparatos uso={uso} panel={panel} acciones={acciones} onCerrar={() => setAlta(false)} />}
      {abierto && (
        <FichaAparato aparato={abierto} detalle={detalleTitular(abierto)} panel={panel} acciones={acciones} onCerrar={() => setAbiertoId(null)} />
      )}
    </div>
  );
}

/** Profes a los que les toca iPad (desde 5º EP) y no tienen ninguno de profesorado. */
function ProfesSinIpad({ panel, acciones }: { panel: PanelDispositivos; acciones: Acciones }) {
  const [todos, setTodos] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const conIpad = new Set(panel.aparatos.filter((a) => a.titular?.tipo === 'profe').map((a) => a.titular!.id));
  const libres = panel.aparatos.filter((a) => a.uso === 'profesorado' && !a.titular && a.estado === 'activo');
  const lista = panel.profes.filter((p) => !conIpad.has(p.id) && (todos || p.leToca));

  async function dar(profeId: string, aparatoId: string) {
    setOcupado(profeId);
    try {
      const r = await pedir<{ aparato: AparatoDis }>(`/api/dispositivos/aparatos/${aparatoId}`, 'PATCH', { titular: { tipo: 'profe', id: profeId } });
      acciones.mezclarAparatos([r.aparato]);
      haptic.success();
      toast.success(`${r.aparato.codigo} a ${r.aparato.titular?.nombre}`);
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">
          {todos ? 'Profes sin iPad del cole' : 'Les toca (desde 5º EP) y no tienen iPad'} <span className="font-normal text-zinc-500">{lista.length}</span>
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="h-4 w-4" /> Ver todo el claustro
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        «Les toca»: clase o tutoría de 5º EP para arriba en Horarios, o la ESO marcada en su ficha de Profesorado.
      </p>
      {lista.length === 0 ? (
        <p className="py-3 text-sm text-emerald-700 dark:text-emerald-400">Todos tienen el suyo.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{p.nombre}</span>
                <span className="block truncate text-xs text-zinc-500">{p.email}</span>
              </span>
              {libres.length ? (
                <select
                  aria-label={`Darle un iPad a ${p.nombre}`}
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value=""
                  disabled={ocupado === p.id}
                  onChange={(e) => e.target.value && void dar(p.id, e.target.value)}
                >
                  <option value="">Darle…</option>
                  {libres.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-zinc-400">No hay iPads de profesorado libres</span>
              )}
              {ocupado === p.id && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AltaAparatos({ uso, panel, acciones, onCerrar }: { uso: Uso; panel: PanelDispositivos; acciones: Acciones; onCerrar: () => void }) {
  const [modo, setModo] = useState<'cantidad' | 'series'>('cantidad');
  const [cantidad, setCantidad] = useState(1);
  const [texto, setTexto] = useState('');
  const [modeloId, setModeloId] = useState(panel.modelos.find((m) => m.activo)?.id ?? '');
  const [notas, setNotas] = useState('');
  const [conCargador, setConCargador] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const series = parsearSeries(texto);
  const n = modo === 'cantidad' ? cantidad : series.length;
  const codigos = siguientesCodigos(uso, panel.aparatos.map((a) => a.codigo), Math.max(n, 0));

  async function crear() {
    setOcupado(true);
    try {
      const r = await pedir<{ aparatos: AparatoDis[] }>('/api/dispositivos/aparatos', 'POST', {
        uso,
        modeloId: modeloId || null,
        notas: notas.trim() || null,
        conCargador,
        ...(modo === 'cantidad' ? { cantidad } : { series }),
      });
      acciones.mezclarAparatos(r.aparatos);
      haptic.success();
      toast.success(`${r.aparatos.length} iPads dados de alta`);
      onCerrar();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <div className="space-y-4">
          <div className="space-y-1 pr-8">
            <DialogTitle className="text-lg font-semibold">Dar de alta iPads de {USO_LABEL[uso].toLowerCase()}</DialogTitle>
            <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
              Cada uno se lleva el siguiente código libre. El código se puede cambiar después, uno a uno.
            </DialogDescription>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['cantidad', 'Cuántos'],
                ['series', 'Pegar nº de serie'],
              ] as const
            ).map(([m, t]) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                className={cn(
                  'h-11 cursor-pointer rounded-xl border text-sm',
                  modo === m ? 'border-zinc-900 bg-zinc-100 font-semibold dark:border-zinc-100 dark:bg-zinc-800' : 'border-zinc-300 dark:border-zinc-700',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {modo === 'cantidad' ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cuántos</span>
              <input
                type="number"
                min={1}
                max={200}
                className={claseCampo}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              />
            </label>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Números de serie, uno por línea</span>
              <textarea
                className={cn(claseCampo, 'h-36 py-2 font-mono text-sm uppercase')}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={'Pega aquí la columna del Excel'}
              />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Modelo</span>
            <select className={claseCampo} value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
              <option value="">Sin modelo</option>
              {panel.modelos
                .filter((m) => m.activo)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.etiqueta}
                  </option>
                ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notas <span className="font-normal text-zinc-500">(opcional, para todos)</span>
            </span>
            <input className={claseCampo} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Comprados en 2026, con funda…" />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={conCargador} onChange={(e) => setConCargador(e.target.checked)} className="h-4 w-4" />
            Cada iPad con su cargador (mismo código)
          </label>
          {n > 0 && (
            <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
              Se crean {n === 1 ? `el ${codigos[0]}` : `del ${codigos[0]} al ${codigos[codigos.length - 1]}`}.
            </p>
          )}
          <button type="button" className={cn(buttonVariants(), 'w-full')} disabled={ocupado || n === 0} onClick={() => void crear()}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Dar de alta {n > 0 ? n : ''}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FichaAparato({
  aparato: a,
  detalle,
  panel,
  acciones,
  onCerrar,
}: {
  aparato: AparatoDis;
  /** Lo que se dice debajo del titular («1º ESO B · prestado»). */
  detalle: string;
  panel: PanelDispositivos;
  acciones: Acciones;
  onCerrar: () => void;
}) {
  const [codigo, setCodigo] = useState(a.codigo);
  const [modeloId, setModeloId] = useState(a.modeloId ?? '');
  const [numeroSerie, setNumeroSerie] = useState(a.numeroSerie ?? '');
  const [estado, setEstado] = useState<EstadoAparato>(a.estado);
  const [notas, setNotas] = useState(a.notas ?? '');
  const [tieneCargador, setTieneCargador] = useState(Boolean(a.cargador));
  const [cargadorCodigo, setCargadorCodigo] = useState(a.cargador?.codigo ?? a.codigo);
  const [cargadorEstado, setCargadorEstado] = useState<EstadoCargador>(a.cargador?.estado ?? 'activo');
  const [cargadorNotas, setCargadorNotas] = useState(a.cargador?.notas ?? '');
  const [busca, setBusca] = useState('');
  const [elegido, setElegido] = useState<{ id: string; nombre: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [historial, setHistorial] = useState<LineaHistorial[] | null>(null);

  useEffect(() => {
    let vivo = true;
    pedir<{ lineas: LineaHistorial[] }>(`/api/dispositivos/historial?aparato=${a.id}`)
      .then((r) => vivo && setHistorial(r.lineas))
      .catch(() => vivo && setHistorial([]));
    return () => {
      vivo = false;
    };
  }, [a.id, a.titular?.id, a.estado]);

  const q = normalizar(busca.trim());
  const candidatos =
    q.length < 2
      ? []
      : a.uso === 'profesorado'
        ? panel.profes.filter((p) => normalizar(p.nombre).includes(q)).slice(0, 8).map((p) => ({ id: p.id, nombre: p.nombre, detalle: p.email ?? '' }))
        : panel.alumnos.filter((x) => normalizar(x.nombre).includes(q)).slice(0, 8).map((x) => ({ id: x.id, nombre: x.nombre, detalle: x.clase }));

  async function hacer(cuerpo: Record<string, unknown>, ok?: string) {
    setOcupado(true);
    try {
      const r = await pedir<{ aparato: AparatoDis }>(`/api/dispositivos/aparatos/${a.id}`, 'PATCH', cuerpo);
      acciones.mezclarAparatos([r.aparato]);
      haptic.success();
      if (ok) toast.success(ok);
      return true;
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  /**
   * A un profe se le da sin más. A un alumno, de dos maneras: **prestado para el curso** (le pone
   * «Prestado» con este iPad: una sola verdad) o **mientras arreglan el suyo** (no le cambia nada).
   */
  async function darA(id: string, como: 'profe' | 'prestado' | 'temporal') {
    setBusca('');
    setElegido(null);
    if (como === 'prestado') {
      setOcupado(true);
      const ok = await acciones.guardar({ eduStudentId: id, modalidad: 'prestado', aparatoId: a.id });
      setOcupado(false);
      if (ok) toast.success(`${a.codigo} prestado`);
      return;
    }
    await hacer({ titular: { tipo: como === 'profe' ? 'profe' : 'alumno', id } }, `${a.codigo} dado`);
  }

  async function guardar() {
    const ok = await hacer({
      codigo,
      modeloId: modeloId || null,
      numeroSerie: numeroSerie.trim() || null,
      estado,
      notas: notas.trim() || null,
      cargador: tieneCargador ? { codigo: cargadorCodigo, estado: cargadorEstado, notas: cargadorNotas.trim() || null } : null,
    });
    if (ok) onCerrar();
  }

  async function borrar() {
    setOcupado(true);
    try {
      await pedir(`/api/dispositivos/aparatos/${a.id}`, 'DELETE');
      acciones.mezclarAparatos([], [a.id]);
      toast.success(`${a.codigo} borrado`);
      onCerrar();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido borrar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <div className="space-y-4">
          <div className="space-y-1 pr-8">
            <DialogTitle className="text-lg font-semibold">
              {a.codigo} · iPad de {USO_LABEL[a.uso].toLowerCase()}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
              {a.titular
                ? `Lo tiene ${a.titular.nombre}${a.asignadoAt ? ` desde el ${new Date(a.asignadoAt).toLocaleDateString('es-ES')}` : ''}`
                : a.estado === 'activo'
                  ? 'En el almacén'
                  : ESTADO_APARATO_LABEL[a.estado]}
            </DialogDescription>
          </div>

          {/* Quién lo tiene */}
          <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            {a.titular ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{a.titular.nombre}</span>
                  <span className={cn('block text-xs', a.titular.activo ? 'text-zinc-500' : 'font-semibold text-red-700 dark:text-red-300')}>
                    {a.titular.activo ? detalle : 'Ya no está en el cole: hay que recogerlo'}
                  </span>
                </span>
                <button type="button" className={buttonVariants({ variant: 'outline' })} disabled={ocupado} onClick={() => void hacer({ titular: null }, `${a.codigo} devuelto`)}>
                  <Undo2 className="h-4 w-4" /> Devolver
                </button>
              </div>
            ) : a.estado === 'baja' ? (
              <p className="text-sm text-zinc-500">De baja: no se le da a nadie.</p>
            ) : elegido ? (
              <div className="space-y-2">
                <p className="text-sm">
                  ¿Cómo se le da a <span className="font-semibold">{elegido.nombre}</span>?
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" className={cn(buttonVariants({ variant: 'outline' }), 'h-auto flex-col items-start py-2.5 text-left')} disabled={ocupado} onClick={() => void darA(elegido.id, 'prestado')}>
                    <span className="font-semibold">Prestado para el curso</span>
                    <span className="text-xs font-normal text-zinc-500">Pasa a «Prestado» con el {a.codigo}</span>
                  </button>
                  <button type="button" className={cn(buttonVariants({ variant: 'outline' }), 'h-auto flex-col items-start py-2.5 text-left')} disabled={ocupado} onClick={() => void darA(elegido.id, 'temporal')}>
                    <span className="font-semibold">Mientras arreglan el suyo</span>
                    <span className="text-xs font-normal text-zinc-500">Sigue como está; solo se apunta que lo tiene</span>
                  </button>
                </div>
                <button type="button" className="cursor-pointer text-xs text-zinc-500 underline" onClick={() => setElegido(null)}>
                  Elegir a otra persona
                </button>
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dárselo a…</span>
                <input
                  className={claseCampo}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={a.uso === 'profesorado' ? 'Nombre del profe' : 'Nombre del alumno'}
                  autoComplete="off"
                />
                {candidatos.length > 0 && (
                  <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                    {candidatos.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => (a.uso === 'profesorado' ? void darA(c.id, 'profe') : setElegido({ id: c.id, nombre: c.nombre }))}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <span className="font-medium">{c.nombre}</span>
                          <span className="text-xs text-zinc-500">{c.detalle}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Código</span>
              <input className={cn(claseCampo, 'uppercase')} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nº de serie</span>
              <input className={cn(claseCampo, 'uppercase')} value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value.toUpperCase())} autoComplete="off" />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Modelo</span>
            <select className={claseCampo} value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
              <option value="">Sin modelo</option>
              {panel.modelos
                .filter((m) => m.activo || m.id === modeloId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.etiqueta}
                  </option>
                ))}
            </select>
          </label>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Estado</legend>
            <div className="grid grid-cols-3 gap-2">
              {ESTADOS_APARATO.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={estado === s}
                  onClick={() => setEstado(s)}
                  className={cn(
                    'h-11 cursor-pointer rounded-xl border text-sm',
                    estado === s ? cn(COLOR_ESTADO[s], 'border-transparent font-semibold') : 'border-zinc-300 dark:border-zinc-700',
                  )}
                >
                  {ESTADO_APARATO_LABEL[s]}
                </button>
              ))}
            </div>
            {estado === 'baja' && a.titular && <span className="block text-xs text-amber-700 dark:text-amber-300">Al darlo de baja, se devuelve solo.</span>}
          </fieldset>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notas</span>
            <input className={claseCampo} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Pantalla rajada, en el SAT desde…" />
          </label>

          {/* Su cargador */}
          <fieldset className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <legend className="sr-only">Cargador</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={tieneCargador} onChange={(e) => setTieneCargador(e.target.checked)} className="h-4 w-4" />
              <Plug className="h-4 w-4" /> Tiene cargador
            </label>
            {tieneCargador && (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Lo que lleva escrito</span>
                    <input className={cn(claseCampo, 'uppercase')} value={cargadorCodigo} onChange={(e) => setCargadorCodigo(e.target.value.toUpperCase())} />
                  </label>
                  <div className="grid grid-cols-3 gap-2 self-end">
                    {ESTADOS_CARGADOR.map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={cargadorEstado === s}
                        onClick={() => setCargadorEstado(s)}
                        className={cn(
                          'h-11 cursor-pointer rounded-xl border text-xs',
                          cargadorEstado === s ? cn(COLOR_CARGADOR[s], 'border-transparent font-semibold') : 'border-zinc-300 dark:border-zinc-700',
                        )}
                      >
                        {ESTADO_CARGADOR_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <input className={claseCampo} value={cargadorNotas} onChange={(e) => setCargadorNotas(e.target.value)} placeholder="Notas del cargador (cable roto, sin bloque…)" />
              </div>
            )}
          </fieldset>

          {confirmarBorrar ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200">
              <span className="flex-1">¿Borrar el {a.codigo}? Solo para un alta por error: si ya tiene historia, se da de baja.</span>
              <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => setConfirmarBorrar(false)}>
                Cancelar
              </button>
              <button type="button" className={buttonVariants({ variant: 'destructive' })} disabled={ocupado} onClick={() => void borrar()}>
                Borrar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className={buttonVariants({ variant: 'outline' })} disabled={ocupado} onClick={() => setConfirmarBorrar(true)} aria-label="Borrar (alta por error)">
                <Trash2 className="h-4 w-4" />
              </button>
              <button type="button" className={cn(buttonVariants(), 'flex-1')} disabled={ocupado} onClick={() => void guardar()}>
                {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
              </button>
            </div>
          )}

          <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <History className="h-3.5 w-3.5" /> Historial
            </p>
            {historial === null ? (
              <p className="text-sm text-zinc-400">Cargando…</p>
            ) : (
              <ul className="space-y-1.5">
                {historial.map((h, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-zinc-900 dark:text-zinc-100">{h.texto}</span>
                    <span className="block text-xs text-zinc-500">{cuandoYQuien(h.at, h.porNombre)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
