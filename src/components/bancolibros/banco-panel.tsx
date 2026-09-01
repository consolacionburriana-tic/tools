'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, Check, ChevronLeft, HeartHandshake, Loader2, NotebookPen, Users, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

interface ClaseOpt {
  curso: string;
  letra: string | null;
  label: string;
  etapa: 'EI' | 'EP' | 'ESO' | null;
}
interface ResumenClase {
  curso: string;
  letra: string | null;
  total: number;
  banco: number;
  ampa: number;
}

function claseKey(curso: string, letra: string | null): string {
  return `${curso}|${letra ?? ''}`;
}

const ETAPA_LABEL: Record<'EI' | 'EP' | 'ESO', string> = {
  EI: 'Infantil',
  EP: 'Primaria',
  ESO: 'Secundaria',
};
const ETAPA_ORDEN: ('EI' | 'EP' | 'ESO')[] = ['EI', 'EP', 'ESO'];
interface AlumnoRow {
  eduStudentId: string;
  nombre: string;
  numeroLista: number;
  banco: boolean;
  ampa: boolean;
  asignacionId: string | null;
  lote: number | null;
  entregado: boolean;
  docInicio: boolean;
  docFin: boolean;
}
interface LibroCard {
  cod: string;
  nombre: string;
  asignatura: string | null;
  valorados: number;
  total: number;
}
interface LibroManual {
  id: string;
  asignatura: string | null;
  nombre: string;
  activo: boolean;
}
interface FilaLista {
  asignacionId: string;
  numeroLista: number;
  lote: number;
  alumno: string;
  estado: string | null;
  borrado: boolean;
  forrado: boolean;
  notas: string | null;
}

const ESTADOS: { valor: string; label: string; activo: string }[] = [
  { valor: 'nuevo', label: 'Nuevo', activo: 'bg-sky-600 text-white' },
  { valor: 'mb', label: 'MB', activo: 'bg-emerald-600 text-white' },
  { valor: 'b', label: 'B', activo: 'bg-lime-600 text-white' },
  { valor: 'r', label: 'R', activo: 'bg-amber-500 text-white' },
  { valor: 'm', label: 'M', activo: 'bg-red-600 text-white' },
  { valor: 'mojado', label: 'Moj', activo: 'bg-indigo-600 text-white' },
];

function Toggle({ activo, onTap, label }: { activo: boolean; onTap: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        activo
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500'
      }`}
    >
      {label}
    </button>
  );
}

export function BancoPanel({
  clases,
  resumenInicial,
  puedeGestionarParticipantes,
}: {
  clases: ClaseOpt[];
  resumenInicial: ResumenClase[];
  /** Marcar banco/AMPA sí-no es cosa de dirección/TIC (de momento, no tutores). El resto del
   *  módulo (lotes, checks, pasar lista) sigue abierto a cualquier rol con acceso. */
  puedeGestionarParticipantes: boolean;
}) {
  const [clase, setClase] = useState<ClaseOpt | null>(null);
  const [tab, setTab] = useState<'alumnado' | 'ampa' | 'libros'>('alumnado');
  const [alumnado, setAlumnado] = useState<AlumnoRow[] | null>(null);
  const [libros, setLibros] = useState<LibroCard[] | null>(null);
  const [libro, setLibro] = useState<LibroCard | null>(null);
  const [filas, setFilas] = useState<FilaLista[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [notasAbiertas, setNotasAbiertas] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenClase[]>(resumenInicial);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [librosManuales, setLibrosManuales] = useState<LibroManual[] | null>(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [nuevoManual, setNuevoManual] = useState({ asignatura: '', nombre: '' });
  const [guardandoManual, setGuardandoManual] = useState(false);

  const resumenMap = useMemo(() => new Map(resumen.map((r) => [claseKey(r.curso, r.letra), r])), [resumen]);

  /** Ajusta en local el contador agregado de la clase activa (sin esperar a refrescar). */
  const bumpResumen = useCallback(
    (campo: 'banco' | 'ampa', delta: 1 | -1) => {
      if (!clase) return;
      const key = claseKey(clase.curso, clase.letra);
      setResumen((prev) => prev.map((r) => (claseKey(r.curso, r.letra) === key ? { ...r, [campo]: Math.max(0, r[campo] + delta) } : r)));
    },
    [clase],
  );

  const qs = useCallback(
    (extra = '') => `curso=${encodeURIComponent(clase!.curso)}&letra=${encodeURIComponent(clase!.letra ?? '')}${extra}`,
    [clase],
  );

  // Cargas por pestaña
  useEffect(() => {
    if (!clase) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setAlumnado(null);
      setLibros(null);
      setLibro(null);
      setLibrosManuales(null);
      setManualAbierto(false);
      try {
        const [rc, rl] = await Promise.all([
          fetch(`/api/bancolibros/admin/clase?${qs()}`),
          fetch(`/api/bancolibros/admin/libros?${qs()}`),
        ]);
        const [dc, dl] = await Promise.all([rc.json(), rl.json()]);
        if (!vivo) return;
        setAlumnado(dc.alumnado ?? []);
        setLibros(dl.libros ?? []);
      } catch {
        if (!vivo) return;
        setAlumnado([]);
        setLibros([]);
      }
    }, 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [clase, qs]);

  useEffect(() => {
    if (!clase || !libro) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setFilas(null);
      try {
        const r = await fetch(`/api/bancolibros/admin/registros?${qs(`&cod=${encodeURIComponent(libro.cod)}`)}`);
        const d = await r.json();
        if (vivo) setFilas(d.filas ?? []);
      } catch {
        if (vivo) setFilas([]);
      }
    }, 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [clase, libro, qs]);

  useEffect(() => {
    if (!clase || !manualAbierto) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/bancolibros/admin/libros-manual?curso=${encodeURIComponent(clase.curso)}`);
        const d = await r.json();
        if (vivo) setLibrosManuales(d.libros ?? []);
      } catch {
        if (vivo) setLibrosManuales([]);
      }
    })();
    return () => { vivo = false; };
  }, [clase, manualAbierto]);

  async function post(url: string, body: unknown): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      haptic.tap();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
      return false;
    }
  }

  // ── Alumnado ──
  async function toggleBanco(a: AlumnoRow) {
    setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, banco: !a.banco } : x)));
    bumpResumen('banco', a.banco ? -1 : 1);
    if (!(await post('/api/bancolibros/admin/banco', { eduStudentId: a.eduStudentId, banco: !a.banco }))) {
      setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, banco: a.banco } : x)));
      bumpResumen('banco', a.banco ? 1 : -1);
    }
  }

  // ── AMPA ──
  async function toggleAmpa(a: AlumnoRow) {
    setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, ampa: !a.ampa } : x)));
    bumpResumen('ampa', a.ampa ? -1 : 1);
    if (!(await post('/api/bancolibros/admin/ampa', { eduStudentIds: [a.eduStudentId], ampa: !a.ampa }))) {
      setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, ampa: a.ampa } : x)));
      bumpResumen('ampa', a.ampa ? 1 : -1);
    }
  }

  async function bulkAmpa(ampa: boolean) {
    if (!alumnado?.length) return;
    const cambios = alumnado.filter((a) => a.ampa !== ampa).length;
    setAlumnado((prev) => prev!.map((x) => ({ ...x, ampa })));
    setResumen((prev) => {
      if (!clase) return prev;
      const key = claseKey(clase.curso, clase.letra);
      return prev.map((r) => (claseKey(r.curso, r.letra) === key ? { ...r, ampa: ampa ? r.total : 0 } : r));
    });
    await post('/api/bancolibros/admin/ampa', { eduStudentIds: alumnado.map((a) => a.eduStudentId), ampa });
    if (cambios) haptic.success();
  }

  async function ponerLote(a: AlumnoRow, numero: number | 'auto' | null) {
    setOcupado(a.eduStudentId);
    try {
      const res = await fetch('/api/bancolibros/admin/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: clase!.curso, letra: clase!.letra, eduStudentId: a.eduStudentId, numero }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // recargar para obtener asignacionId nuevo
      const r2 = await fetch(`/api/bancolibros/admin/clase?${qs()}`);
      setAlumnado((await r2.json()).alumnado ?? []);
      haptic.tap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function toggleCheck(a: AlumnoRow, campo: 'entregado' | 'docInicio' | 'docFin') {
    if (!a.asignacionId) return;
    const valor = !a[campo];
    setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, [campo]: valor } : x)));
    if (!(await post('/api/bancolibros/admin/checks', { asignacionIds: [a.asignacionId], campos: { [campo]: valor } }))) {
      setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, [campo]: !valor } : x)));
    }
  }

  async function bulkCheck(campo: 'entregado' | 'docInicio' | 'docFin') {
    const ids = alumnado!.filter((a) => a.asignacionId).map((a) => a.asignacionId!);
    if (!ids.length) return void toast.info('Nadie tiene lote asignado todavía');
    setAlumnado((prev) => prev!.map((x) => (x.asignacionId ? { ...x, [campo]: true } : x)));
    await post('/api/bancolibros/admin/checks', { asignacionIds: ids, campos: { [campo]: true } });
  }

  // ── Pasar lista de un libro ──
  async function setRegistro(f: FilaLista, campos: Partial<Pick<FilaLista, 'estado' | 'borrado' | 'forrado' | 'notas'>>) {
    setFilas((prev) => prev!.map((x) => (x.asignacionId === f.asignacionId ? { ...x, ...campos } : x)));
    await post('/api/bancolibros/admin/registro', { asignacionIds: [f.asignacionId], bookCod: libro!.cod, campos });
  }

  async function bulkRegistro(campos: { estado?: string; borrado?: boolean; forrado?: boolean }) {
    const ids = filas!.map((f) => f.asignacionId);
    if (!ids.length) return;
    setFilas((prev) => prev!.map((x) => ({ ...x, ...campos })));
    await post('/api/bancolibros/admin/registro', { asignacionIds: ids, bookCod: libro!.cod, campos });
    haptic.success();
  }

  // ── Libros manuales (dirección/TIC): catálogo a mano por curso, sin depender de Licencias ──
  async function refrescarLibros() {
    if (!clase) return;
    const r = await fetch(`/api/bancolibros/admin/libros?${qs()}`);
    setLibros((await r.json()).libros ?? []);
  }

  async function anadirLibroManual() {
    if (!clase || !nuevoManual.nombre.trim()) return;
    setGuardandoManual(true);
    try {
      const res = await fetch('/api/bancolibros/admin/libros-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: clase.curso, asignatura: nuevoManual.asignatura.trim() || null, nombre: nuevoManual.nombre.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNuevoManual({ asignatura: '', nombre: '' });
      const r2 = await fetch(`/api/bancolibros/admin/libros-manual?curso=${encodeURIComponent(clase.curso)}`);
      setLibrosManuales((await r2.json()).libros ?? []);
      await refrescarLibros();
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo añadir');
      haptic.warning();
    } finally {
      setGuardandoManual(false);
    }
  }

  async function toggleActivoManual(lm: LibroManual) {
    setLibrosManuales((prev) => prev!.map((x) => (x.id === lm.id ? { ...x, activo: !lm.activo } : x)));
    try {
      const res = await fetch('/api/bancolibros/admin/libros-manual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lm.id, campos: { activo: !lm.activo } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refrescarLibros();
      haptic.tap();
    } catch (e) {
      setLibrosManuales((prev) => prev!.map((x) => (x.id === lm.id ? { ...x, activo: lm.activo } : x)));
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
    }
  }

  const enBanco = useMemo(() => alumnado?.filter((a) => a.banco).length ?? 0, [alumnado]);
  const enAmpa = useMemo(() => alumnado?.filter((a) => a.ampa).length ?? 0, [alumnado]);

  // Cursos en el orden en que aparecen en `clases` (ya vienen por etapa → curso), para las
  // filas de subtotal del resumen agregado.
  const cursosOrden = useMemo(() => [...new Set(clases.map((c) => c.curso))], [clases]);
  const totalGeneral = useMemo(
    () => resumen.reduce((acc, r) => ({ total: acc.total + r.total, banco: acc.banco + r.banco, ampa: acc.ampa + r.ampa }), { total: 0, banco: 0, ampa: 0 }),
    [resumen],
  );

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* Resumen agregado: cerrado enseña los totales de un vistazo, abierto el detalle x clase/curso */}
      <details
        className="anim-up rounded-2xl border border-zinc-200 bg-white open:pb-1 dark:border-zinc-800 dark:bg-zinc-900"
        open={resumenAbierto}
        onToggle={(e) => setResumenAbierto((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
          <BarChart3 className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">Resumen</span>
          <span className="text-zinc-400">
            {totalGeneral.banco}/{totalGeneral.total} en banco · {totalGeneral.ampa} AMPA
          </span>
          <ChevronLeft className="ml-auto h-4 w-4 shrink-0 -rotate-90 text-zinc-400 transition-transform [details[open]_&]:rotate-90" />
        </summary>
        <div className="overflow-x-auto border-t border-zinc-100 px-1 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Clase</th>
                <th className="px-3 py-2 text-right font-medium">Alumnos</th>
                <th className="px-3 py-2 text-right font-medium">Banco</th>
                <th className="px-3 py-2 text-right font-medium">AMPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
              {cursosOrden.map((curso) => {
                const filas = clases.filter((c) => c.curso === curso);
                const sub = filas.reduce(
                  (acc, c) => {
                    const r = resumenMap.get(claseKey(c.curso, c.letra));
                    return { total: acc.total + (r?.total ?? 0), banco: acc.banco + (r?.banco ?? 0), ampa: acc.ampa + (r?.ampa ?? 0) };
                  },
                  { total: 0, banco: 0, ampa: 0 },
                );
                return (
                  <Fragment key={curso}>
                    <tr className="bg-zinc-50/60 font-semibold text-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-200">
                      <td className="px-3 py-1.5">{curso}</td>
                      <td className="px-3 py-1.5 text-right">{sub.total}</td>
                      <td className="px-3 py-1.5 text-right">{sub.banco}</td>
                      <td className="px-3 py-1.5 text-right">{sub.ampa}</td>
                    </tr>
                    {filas.map((c) => {
                      const r = resumenMap.get(claseKey(c.curso, c.letra));
                      return (
                        <tr key={c.label} className="text-zinc-500 dark:text-zinc-400">
                          <td className="py-1.5 pl-7 pr-3">↳ {c.label}</td>
                          <td className="px-3 py-1.5 text-right">{r?.total ?? 0}</td>
                          <td className="px-3 py-1.5 text-right">{r?.banco ?? 0}</td>
                          <td className="px-3 py-1.5 text-right">{r?.ampa ?? 0}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {/* Selector de clase, agrupado por etapa (primaria → secundaria) */}
      <div className="anim-up space-y-2.5">
        {ETAPA_ORDEN.filter((et) => clases.some((c) => c.etapa === et)).map((et) => (
          <div key={et}>
            <p className="mb-1 px-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {ETAPA_LABEL[et]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {clases
                .filter((c) => c.etapa === et)
                .map((c) => {
                  const r = resumenMap.get(claseKey(c.curso, c.letra));
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setClase(c)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                        clase?.label === c.label
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {c.label}
                      {r && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                            clase?.label === c.label ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {r.banco}/{r.total}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {!clase && (
        <p className="anim-up rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          Elige una clase para empezar.
        </p>
      )}

      {clase && !libro && (
        <>
          {/* Pestañas */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { k: 'alumnado', label: `Alumnado${alumnado ? ` · ${enBanco}/${alumnado.length} en banco` : ''}`, icon: Users },
                ...(puedeGestionarParticipantes
                  ? [{ k: 'ampa' as const, label: `AMPA${alumnado ? ` · ${enAmpa}/${alumnado.length}` : ''}`, icon: HeartHandshake }]
                  : []),
                { k: 'libros', label: `Libros${libros ? ` · ${libros.length}` : ''}`, icon: BookOpen },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
                  tab === t.k
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-white text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700'
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* ── Pestaña Alumnado ── */}
          {tab === 'alumnado' && (
            <div className="anim-up rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 p-3 text-xs dark:border-zinc-800">
                <span className="mr-1 text-zinc-400">Marcar a toda la clase:</span>
                <button type="button" onClick={() => void bulkCheck('entregado')} className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  ✓ Lote entregado
                </button>
                <button type="button" onClick={() => void bulkCheck('docInicio')} className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  ✓ Doc. inicio
                </button>
                <button type="button" onClick={() => void bulkCheck('docFin')} className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  ✓ Doc. fin
                </button>
              </div>
              {alumnado === null ? (
                <p className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {alumnado.map((a) => (
                    <li key={a.eduStudentId} className={`flex flex-wrap items-center gap-2 px-3.5 py-2 ${a.banco ? '' : 'opacity-55'}`}>
                      {puedeGestionarParticipantes ? (
                        <button
                          type="button"
                          onClick={() => void toggleBanco(a)}
                          aria-label={a.banco ? 'Quitar del banco' : 'Meter en el banco'}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                            a.banco ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${a.banco ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      ) : (
                        <span
                          title="Solo dirección/TIC pueden cambiar quién está en el banco"
                          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full ${a.banco ? 'bg-emerald-500/50' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                        >
                          <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${a.banco ? 'translate-x-6' : 'translate-x-1'}`} />
                        </span>
                      )}
                      <span className="w-6 shrink-0 text-right text-xs font-bold text-zinc-400">{a.numeroLista}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{a.nombre}</span>
                      {a.banco && (
                        <>
                          <span className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              value={a.lote ?? ''}
                              placeholder="lote"
                              onChange={(e) => {
                                const v = e.target.value;
                                setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, lote: v ? Number(v) : null } : x)));
                              }}
                              onBlur={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                if (v !== a.lote) void ponerLote(a, v);
                              }}
                              className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                            {!a.lote && (
                              <button
                                type="button"
                                onClick={() => void ponerLote(a, 'auto')}
                                title="Asignar el siguiente número libre"
                                className="rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
                              >
                                {ocupado === a.eduStudentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                              </button>
                            )}
                          </span>
                          {a.asignacionId && (
                            <span className="flex gap-1">
                              <Toggle activo={a.entregado} onTap={() => void toggleCheck(a, 'entregado')} label="Entregado" />
                              <Toggle activo={a.docInicio} onTap={() => void toggleCheck(a, 'docInicio')} label="Doc ini" />
                              <Toggle activo={a.docFin} onTap={() => void toggleCheck(a, 'docFin')} label="Doc fin" />
                            </span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Pestaña AMPA (dirección/TIC) ── */}
          {tab === 'ampa' && puedeGestionarParticipantes && (
            <div className="anim-up rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 p-3 text-xs dark:border-zinc-800">
                <span className="mr-1 text-zinc-400">Reconciliar contra el listado del AMPA:</span>
                <button type="button" onClick={() => void bulkAmpa(true)} className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Todos sí
                </button>
                <button type="button" onClick={() => void bulkAmpa(false)} className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  Todos no
                </button>
              </div>
              {alumnado === null ? (
                <p className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {alumnado.map((a) => (
                    <li key={a.eduStudentId} className={`flex items-center gap-2 px-3.5 py-2 ${a.ampa ? '' : 'opacity-55'}`}>
                      <button
                        type="button"
                        onClick={() => void toggleAmpa(a)}
                        aria-label={a.ampa ? 'Quitar del AMPA' : 'Meter en el AMPA'}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          a.ampa ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${a.ampa ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className="w-6 shrink-0 text-right text-xs font-bold text-zinc-400">{a.numeroLista}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{a.nombre}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Pestaña Libros ── */}
          {tab === 'libros' && (
            <div className="anim-stagger grid gap-2.5 sm:grid-cols-2">
              {puedeGestionarParticipantes && (
                <details
                  className="rounded-2xl border border-dashed border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
                  open={manualAbierto}
                  onToggle={(e) => setManualAbierto((e.target as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer list-none font-medium text-zinc-600 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
                    Configurar libros a mano de {clase.curso}
                  </summary>
                  <div className="mt-2.5 space-y-2">
                    <p className="text-xs text-zinc-400">
                      Para cuando el catálogo de Licencias no esté listo, o una asignatura tenga varios libros. Se
                      guardan solo en este módulo.
                    </p>
                    {librosManuales === null ? (
                      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {librosManuales.length === 0 && <li className="text-xs text-zinc-400">Ningún libro manual todavía.</li>}
                        {librosManuales.map((lm) => (
                          <li key={lm.id} className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => void toggleActivoManual(lm)}
                              className={`rounded-full px-2 py-0.5 font-medium ${
                                lm.activo
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500'
                              }`}
                            >
                              {lm.activo ? 'Activo' : 'Inactivo'}
                            </button>
                            <span className="text-zinc-600 dark:text-zinc-300">
                              {lm.asignatura ? `${lm.asignatura} · ` : ''}
                              {lm.nombre}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <input
                        value={nuevoManual.asignatura}
                        onChange={(e) => setNuevoManual((s) => ({ ...s, asignatura: e.target.value }))}
                        placeholder="Asignatura (opcional)"
                        className="w-36 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <input
                        value={nuevoManual.nombre}
                        onChange={(e) => setNuevoManual((s) => ({ ...s, nombre: e.target.value }))}
                        placeholder="Nombre del libro"
                        className="min-w-32 flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        type="button"
                        disabled={guardandoManual || !nuevoManual.nombre.trim()}
                        onClick={() => void anadirLibroManual()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {guardandoManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Añadir'}
                      </button>
                    </div>
                  </div>
                </details>
              )}
              {libros === null ? (
                <p className="flex items-center gap-2 p-6 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : libros.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2">
                  No hay libros del banco para {clase.curso} en el catálogo de Licencias
                  {puedeGestionarParticipantes ? ': añade uno a mano arriba.' : '.'}
                </p>
              ) : (
                libros.map((b) => {
                  const pct = b.total > 0 ? Math.round((b.valorados / b.total) * 100) : 0;
                  return (
                    <button
                      key={b.cod}
                      type="button"
                      onClick={() => setLibro(b)}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
                    >
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{b.asignatura ?? b.nombre}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{b.nombre} · {b.cod}</p>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className={`h-1.5 rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {b.valorados}/{b.total} valorados{pct === 100 && ' · ✓ completo'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* ── Pasar lista de un libro ── */}
      {clase && libro && (
        <div className="anim-up space-y-3">
          <button type="button" onClick={() => { setLibro(null); }} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            <ChevronLeft className="h-4 w-4" /> Libros de {clase.label}
          </button>
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 p-3.5 dark:border-zinc-800">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{libro.asignatura ?? libro.nombre}</p>
              <p className="text-xs text-zinc-400">{libro.nombre} · {clase.label} · registro de valoración</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <a
                  href={`/gestion/bancolibros/ficha?curso=${encodeURIComponent(clase.curso)}&letra=${encodeURIComponent(clase.letra ?? '')}&cod=${encodeURIComponent(libro.cod)}&modo=datos`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
                >
                  🖨 Ficha con datos
                </a>
                <a
                  href={`/gestion/bancolibros/ficha?curso=${encodeURIComponent(clase.curso)}&letra=${encodeURIComponent(clase.letra ?? '')}&cod=${encodeURIComponent(libro.cod)}&modo=blanco`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  🖨 Ficha en blanco
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-1 text-zinc-400">Toda la clase:</span>
                <button type="button" onClick={() => void bulkRegistro({ estado: 'mb' })} className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Todos MB
                </button>
                <button type="button" onClick={() => void bulkRegistro({ borrado: true })} className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  Todos borrados
                </button>
                <button type="button" onClick={() => void bulkRegistro({ forrado: true })} className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                  Todos forrados
                </button>
              </div>
            </div>
            {filas === null ? (
              <p className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            ) : filas.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">
                Nadie tiene lote asignado en {clase.label} este curso. Asigna lotes en la pestaña Alumnado.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filas.map((f) => (
                  <li key={f.asignacionId} className="px-3.5 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {f.numeroLista}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {f.alumno}
                        <span className="ml-1.5 text-xs font-normal text-zinc-400">lote {f.lote}</span>
                      </span>
                      <span className="flex gap-1">
                        {ESTADOS.map((e) => (
                          <button
                            key={e.valor}
                            type="button"
                            onClick={() => void setRegistro(f, { estado: f.estado === e.valor ? null : e.valor })}
                            className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                              f.estado === e.valor ? e.activo : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500'
                            }`}
                          >
                            {e.label}
                          </button>
                        ))}
                      </span>
                      <span className="flex gap-1">
                        <Toggle activo={f.borrado} onTap={() => void setRegistro(f, { borrado: !f.borrado })} label="Borrado" />
                        <Toggle activo={f.forrado} onTap={() => void setRegistro(f, { forrado: !f.forrado })} label="Forrado" />
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotasAbiertas(notasAbiertas === f.asignacionId ? null : f.asignacionId)}
                        className={`rounded-lg p-1.5 ${f.notas ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' : 'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600'}`}
                        aria-label="Notas"
                      >
                        <NotebookPen className="h-4 w-4" />
                      </button>
                    </div>
                    {notasAbiertas === f.asignacionId && (
                      <input
                        autoFocus
                        defaultValue={f.notas ?? ''}
                        placeholder="Nota (ej. 'le faltan páginas 12-14')"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== f.notas) void setRegistro(f, { notas: v });
                          setNotasAbiertas(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-zinc-100 px-3.5 py-2.5 text-xs text-zinc-400 dark:border-zinc-800">
              <Check className="mr-1 inline h-3.5 w-3.5" />
              Todo se guarda al toque. Borrado y forrado vienen marcados por defecto: toca solo las excepciones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
