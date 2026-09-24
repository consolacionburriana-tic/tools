'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso } from '@/lib/cursos';
import {
  AUDIENCIAS,
  CATEGORIAS,
  COLOR_AUDIENCIA,
  RASGOS_AUDIENCIA,
  claseLabel,
  tituloConAudiencia,
  type Audiencia,
  type Categoria,
} from '@/lib/evaluaciones';

interface ActividadOpt {
  id: string;
  nombre: string;
  categoria: string;
  fecha: string | null;
}

interface FormAnterior {
  id: string;
  titulo: string;
  audiencia: string;
  actividades: string[];
  grupoId: string | null;
}

/** Una fila de "repetir del curso anterior": un formulario suelto o una conjunta entera. */
interface RepeticionAnterior {
  id: string;
  titulo: string;
  audiencias: string[];
  actividades: string[];
  conjunta: boolean;
}

function agruparAnteriores(forms: FormAnterior[]): RepeticionAnterior[] {
  const out: RepeticionAnterior[] = [];
  const vistos = new Map<string, RepeticionAnterior>();
  const orden = AUDIENCIAS.map((a) => a.value as string);
  for (const f of forms) {
    const previo = f.grupoId ? vistos.get(f.grupoId) : undefined;
    if (previo) {
      previo.audiencias.push(f.audiencia);
      previo.audiencias.sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
      previo.conjunta = true;
      continue;
    }
    const sufijo = ` · ${AUDIENCIAS.find((a) => a.value === f.audiencia)?.label}`;
    const fila: RepeticionAnterior = {
      id: f.id,
      titulo: f.grupoId && f.titulo.endsWith(sufijo) ? f.titulo.slice(0, -sufijo.length) : f.titulo,
      audiencias: [f.audiencia],
      actividades: f.actividades,
      conjunta: false,
    };
    if (f.grupoId) vistos.set(f.grupoId, fila);
    out.push(fila);
  }
  // Un grupo que se quedó con un solo sector se copia como formulario suelto, con su título.
  for (const fila of out) {
    if (!fila.conjunta) fila.titulo = forms.find((f) => f.id === fila.id)?.titulo ?? fila.titulo;
  }
  return out;
}

interface Props {
  academicYear: string;
  academicYearAnterior: string;
  clases: { curso: string; letra: string | null }[];
  actividades: ActividadOpt[];
  actividadesAnterior: ActividadOpt[];
  formsAnterior: FormAnterior[];
}

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

/**
 * Alta de una evaluación en una pantalla. El orden está pensado para los mínimos
 * toques posibles: quién responde (1 toque, o varios) → actividades (escribir y Enter, o
 * tocar una que ya existe) → clases (solo alumnado) → crear. El título se escribe solo.
 *
 * Marcar más de un colectivo crea una **evaluación conjunta**: un formulario por
 * colectivo, con las mismas actividades y cada uno con su preset y sus rasgos
 * (anonimato, enlace, qué texto de la actividad ve). Se editan por separado, en pestañas.
 */
export function NuevaEvaluacion({
  academicYear,
  academicYearAnterior,
  clases,
  actividades,
  actividadesAnterior,
  formsAnterior,
}: Props) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<Set<Audiencia>>(new Set());
  // Siempre en el orden fijo alumnado → profesorado → familias, se marquen como se marquen.
  const audiencias = useMemo(() => AUDIENCIAS.map((a) => a.value).filter((v) => marcadas.has(v)), [marcadas]);
  const audiencia = audiencias[0] ?? null;
  const conjunta = audiencias.length > 1;
  const conAlumnado = marcadas.has('alumnos');
  const [categoria, setCategoria] = useState<Categoria>('pastoral');
  const [nuevas, setNuevas] = useState<{ nombre: string; fecha: string | null }[]>([]);
  const [borrador, setBorrador] = useState('');
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [seleccionClases, setSeleccionClases] = useState<Set<string>>(new Set());
  const [tituloManual, setTituloManual] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nombresElegidos = useMemo(
    () => [...actividades.filter((a) => elegidas.has(a.id)).map((a) => a.nombre), ...nuevas.map((n) => n.nombre)],
    [actividades, elegidas, nuevas],
  );

  // En una evaluación conjunta el título es la BASE: el servidor le añade el colectivo a
  // cada formulario ("Convivencia · Alumnado", "Convivencia · Profesorado").
  const tituloBase = useMemo(() => {
    if (nombresElegidos.length === 0) return 'Evaluación';
    if (nombresElegidos.length === 1) return nombresElegidos[0];
    return `Evaluación de ${nombresElegidos.length} actividades`;
  }, [nombresElegidos]);
  const tituloAuto = !audiencia ? '' : conjunta ? tituloBase : tituloConAudiencia(tituloBase, audiencia);

  const titulo = tituloManual.trim() || tituloAuto;

  function toggleAudiencia(a: Audiencia) {
    setMarcadas((prev) => {
      const s = new Set(prev);
      if (s.has(a)) s.delete(a);
      else s.add(a);
      return s;
    });
    haptic.tap();
  }

  function anadirBorrador() {
    const nombre = borrador.trim();
    if (nombre.length < 2) return;
    // Si ya existe una actividad con ese nombre este curso, se reutiliza en vez de duplicarla.
    const existente = actividades.find((a) => a.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) {
      setElegidas((prev) => new Set(prev).add(existente.id));
    } else {
      setNuevas((prev) => [...prev, { nombre, fecha: null }]);
    }
    setBorrador('');
    haptic.tap();
  }

  function toggleClase(k: string) {
    setSeleccionClases((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  }

  function toggleEtapa(etapa: string) {
    const deEtapa = clases.filter((c) => etapaDeCurso(c.curso) === etapa).map(claseKey);
    const todas = deEtapa.every((k) => seleccionClases.has(k));
    setSeleccionClases((prev) => {
      const s = new Set(prev);
      for (const k of deEtapa) {
        if (todas) s.delete(k);
        else s.add(k);
      }
      return s;
    });
  }

  async function crear() {
    if (audiencias.length === 0) return void toast.error('Elige quién responde');
    if (nombresElegidos.length === 0) return void toast.error('Añade al menos una actividad');
    setGuardando(true);
    try {
      const res = await fetch('/api/evaluaciones/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          audiencias,
          academicYear,
          clases: clases.filter((c) => seleccionClases.has(claseKey(c))).map(({ curso, letra }) => ({ curso, letra })),
          activityIds: [...elegidas],
          actividadesNuevas: nuevas.map((n) => ({ nombre: n.nombre, fecha: n.fecha, categoria })),
          conPreset: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo crear');
      haptic.success();
      toast.success(
        conjunta
          ? `Creados ${audiencias.length} formularios, uno por colectivo, con sus preguntas de siempre`
          : 'Evaluación creada con las preguntas de siempre',
      );
      router.push(`/gestion/evaluaciones/${data.form.id}`);
      router.refresh();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  const repeticiones = useMemo(() => agruparAnteriores(formsAnterior), [formsAnterior]);

  async function duplicarDelAnterior(formId: string, grupo: boolean) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${formId}/duplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYear, grupo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo duplicar');
      haptic.success();
      toast.success(
        grupo
          ? `Copiada a ${academicYear} con sus ${data.forms?.length ?? ''} sectores y todas sus preguntas`
          : `Copiada a ${academicYear} con todas sus preguntas`,
      );
      router.push(`/gestion/evaluaciones/${data.form.id}`);
      router.refresh();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  function importarActividadAnterior(a: ActividadOpt) {
    // Se copia al curso actual manteniendo la serie: así la comparativa entre años cuadra.
    setGuardando(true);
    fetch('/api/evaluaciones/admin/actividades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'copiar', id: a.id, academicYear }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setNuevas((prev) => prev.filter((n) => n.nombre !== a.nombre));
        setElegidas((prev) => new Set(prev).add(d.actividad.id));
        actividades.push({ id: d.actividad.id, nombre: d.actividad.nombre, categoria: d.actividad.categoria, fecha: d.actividad.fecha });
        haptic.success();
        toast.success(`"${a.nombre}" traída de ${academicYearAnterior}`);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo copiar'))
      .finally(() => setGuardando(false));
  }

  const clasesPorEtapa = useMemo(() => {
    // Secundaria primero: es quien responde de verdad las evaluaciones. Infantil,
    // que casi nunca aplica, queda abajo en vez de comerse la primera pantalla.
    const grupos: { etapa: string; label: string; clases: typeof clases }[] = [
      { etapa: 'ESO', label: 'Secundaria', clases: [] },
      { etapa: 'EP', label: 'Primaria', clases: [] },
      { etapa: 'EI', label: 'Infantil', clases: [] },
    ];
    for (const c of clases) {
      const g = grupos.find((x) => x.etapa === etapaDeCurso(c.curso));
      if (g) g.clases.push(c);
    }
    return grupos.filter((g) => g.clases.length > 0);
  }, [clases]);

  return (
    <div className="anim-stagger space-y-4">
      {repeticiones.length > 0 && (
        <details className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
          <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
            ¿Repetir una evaluación de {academicYearAnterior}? <span className="text-xs font-normal text-zinc-500">({repeticiones.length})</span>
          </summary>
          <p className="mt-1 text-xs text-zinc-500">
            Se copia entera —actividades y preguntas, y en las conjuntas todos sus sectores— al curso {academicYear},
            lista para retocar.
          </p>
          <div className="mt-3 space-y-2">
            {repeticiones.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{f.titulo}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {f.audiencias.map((v) => AUDIENCIAS.find((a) => a.value === v)?.label).join(' + ')} ·{' '}
                    {f.actividades.join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void duplicarDelAnterior(f.id, f.conjunta)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-500/10 dark:text-blue-300"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar a {academicYear}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-5 dark:bg-zinc-900 dark:ring-zinc-800">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">1 · ¿Quién responde?</label>
        <p className="mb-2.5 mt-0.5 text-xs text-zinc-500">
          Puedes marcar varios: se crea un formulario para cada colectivo, con las mismas actividades y sus propias preguntas.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {AUDIENCIAS.map((a) => {
            const activa = marcadas.has(a.value);
            const color = COLOR_AUDIENCIA[a.value];
            return (
              <button
                key={a.value}
                type="button"
                aria-pressed={activa}
                onClick={() => toggleAudiencia(a.value)}
                style={
                  activa
                    ? { borderColor: color, background: `color-mix(in oklab, ${color} 8%, transparent)` }
                    : undefined
                }
                className={`relative rounded-xl border p-3 text-center transition-colors duration-150 ${
                  activa ? '' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                {activa && (
                  <span
                    aria-hidden
                    style={{ background: color }}
                    className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <span className="block text-2xl">{a.emoji}</span>
                <span className="mt-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* Qué se lleva cada colectivo. En una evaluación conjunta es lo que deja claro
           desde el principio que las preguntas NO se comparten: cada sector va aparte. */}
        {audiencias.length > 0 && (
          <div className={`mt-3 grid gap-2 ${audiencias.length > 1 ? 'sm:grid-cols-2' : ''} ${audiencias.length > 2 ? 'lg:grid-cols-3' : ''}`}>
            {audiencias.map((v) => {
              const a = AUDIENCIAS.find((x) => x.value === v)!;
              const r = RASGOS_AUDIENCIA[v];
              return (
                <div
                  key={v}
                  className="anim-up relative overflow-hidden rounded-xl bg-zinc-50 p-3 pl-4 dark:bg-zinc-800/40"
                >
                  <span aria-hidden style={{ background: COLOR_AUDIENCIA[v] }} className="absolute inset-y-0 left-0 w-[3px]" />
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {a.emoji} Sector {a.label.toLowerCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">{r.preset}.</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.rasgos.map((x) => (
                      <span
                        key={x}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-600 ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
                      >
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {audiencia && (
        <div className="anim-up rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-5 dark:bg-zinc-900 dark:ring-zinc-800">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">2 · ¿Qué actividades se evalúan?</label>
          <p className="mb-2.5 text-xs text-zinc-500">Escribe el nombre y pulsa Enter. Puedes poner varias en el mismo formulario.</p>

          <div className="flex gap-2">
            <input
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  anadirBorrador();
                }
              }}
              placeholder="Convivencia de inicio de curso"
              className={inputCls}
            />
            <button
              type="button"
              onClick={anadirBorrador}
              className="shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {(nuevas.length > 0 || elegidas.size > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {actividades
                .filter((a) => elegidas.has(a.id))
                .map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white">
                    {a.nombre}
                    <button
                      type="button"
                      onClick={() =>
                        setElegidas((prev) => {
                          const s = new Set(prev);
                          s.delete(a.id);
                          return s;
                        })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              {nuevas.map((n, i) => (
                <span key={`${n.nombre}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  {n.nombre}
                  <button type="button" onClick={() => setNuevas((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {actividades.filter((a) => !elegidas.has(a.id)).length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Ya creadas este curso</p>
              <div className="flex flex-wrap gap-1.5">
                {actividades
                  .filter((a) => !elegidas.has(a.id))
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setElegidas((prev) => new Set(prev).add(a.id))}
                      className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {a.nombre}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {actividadesAnterior.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                De {academicYearAnterior} · tócala para traerla
              </p>
              <div className="flex flex-wrap gap-1.5">
                {actividadesAnterior.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={guardando}
                    onClick={() => importarActividadAnterior(a)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 dark:border-zinc-600 dark:hover:border-blue-500"
                  >
                    <Copy className="h-3.5 w-3.5" /> {a.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Tipo de actividad</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategoria(c.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    categoria === c.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {conAlumnado && (
        <div className="anim-up rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-5 dark:bg-zinc-900 dark:ring-zinc-800">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">3 · {conjunta ? '¿Qué clases del alumnado la responden?' : '¿Qué clases la responden?'}</label>
          <p className="mb-2.5 text-xs text-zinc-500">
            Sirve para saber cuánta gente falta por contestar y para segmentar los resultados por clase.
          </p>
          <div className="space-y-3">
            {clasesPorEtapa.map((g) => (
              <div key={g.etapa}>
                <button
                  type="button"
                  onClick={() => toggleEtapa(g.etapa)}
                  className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-blue-600"
                >
                  {g.label} · todas
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {g.clases.map((c) => {
                    const k = claseKey(c);
                    const activa = seleccionClases.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleClase(k)}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          activa
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {claseLabel(c)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {audiencia && (
        <div className="anim-up sticky bottom-0 space-y-3 rounded-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Título</label>
            <input
              value={tituloManual}
              onChange={(e) => setTituloManual(e.target.value)}
              placeholder={tituloAuto}
              className={inputCls}
            />
            {conjunta && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {audiencias.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <span aria-hidden style={{ background: COLOR_AUDIENCIA[v] }} className="h-2 w-2 rounded-full" />
                    {tituloConAudiencia(titulo, v)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void crear()}
            disabled={guardando || nombresElegidos.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {conjunta ? `Crear ${audiencias.length} formularios con las preguntas de siempre` : 'Crear con las preguntas de siempre'}
          </button>
          <p className="text-center text-xs text-zinc-500">
            {conjunta ? (
              <>
                Un formulario por colectivo, cada uno con {nombresElegidos.length || '—'} bloque(s) y su propio preset. Se
                editan y se envían por separado, en pestañas; luego solo hay que retocar las frases marcadas.
              </>
            ) : (
              <>
                Se crean {nombresElegidos.length || '—'} bloque(s) con el preset de{' '}
                {AUDIENCIAS.find((a) => a.value === audiencia)?.label.toLowerCase()}; luego solo hay que retocar las
                frases marcadas.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
