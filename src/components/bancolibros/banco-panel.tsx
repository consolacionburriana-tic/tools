'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, ChevronLeft, Loader2, NotebookPen, Users, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

interface ClaseOpt {
  curso: string;
  letra: string | null;
  label: string;
}
interface AlumnoRow {
  eduStudentId: string;
  nombre: string;
  banco: boolean;
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
interface FilaLista {
  asignacionId: string;
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

export function BancoPanel({ clases }: { clases: ClaseOpt[] }) {
  const [clase, setClase] = useState<ClaseOpt | null>(null);
  const [tab, setTab] = useState<'alumnado' | 'libros'>('alumnado');
  const [alumnado, setAlumnado] = useState<AlumnoRow[] | null>(null);
  const [libros, setLibros] = useState<LibroCard[] | null>(null);
  const [libro, setLibro] = useState<LibroCard | null>(null);
  const [filas, setFilas] = useState<FilaLista[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [notasAbiertas, setNotasAbiertas] = useState<string | null>(null);

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
    if (!(await post('/api/bancolibros/admin/banco', { eduStudentId: a.eduStudentId, banco: !a.banco }))) {
      setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, banco: a.banco } : x)));
    }
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

  const enBanco = useMemo(() => alumnado?.filter((a) => a.banco).length ?? 0, [alumnado]);

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* Selector de clase */}
      <div className="anim-up flex flex-wrap gap-1.5">
        {clases.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setClase(c)}
            className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              clase?.label === c.label
                ? 'bg-blue-600 text-white'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            {c.label}
          </button>
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
          <div className="flex gap-1.5">
            {(
              [
                { k: 'alumnado', label: `Alumnado${alumnado ? ` · ${enBanco}/${alumnado.length} en banco` : ''}`, icon: Users },
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

          {/* ── Pestaña Libros ── */}
          {tab === 'libros' && (
            <div className="anim-stagger grid gap-2.5 sm:grid-cols-2">
              {libros === null ? (
                <p className="flex items-center gap-2 p-6 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : libros.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2">
                  No hay libros del banco para {clase.curso} en el catálogo de Licencias.
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
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
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
                        {f.lote}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.alumno}</span>
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
