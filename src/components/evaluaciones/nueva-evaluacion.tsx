'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso } from '@/lib/cursos';
import { AUDIENCIAS, CATEGORIAS, claseLabel, type Audiencia, type Categoria } from '@/lib/evaluaciones';

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
 * toques posibles: quién responde (1 toque) → actividades (escribir y Enter, o tocar una
 * que ya existe) → clases (solo alumnado) → crear. El título se escribe solo.
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
  const [audiencia, setAudiencia] = useState<Audiencia | null>(null);
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

  const tituloAuto = useMemo(() => {
    if (!audiencia) return '';
    const etiqueta = AUDIENCIAS.find((a) => a.value === audiencia)?.label ?? '';
    if (nombresElegidos.length === 0) return `Evaluación · ${etiqueta}`;
    if (nombresElegidos.length === 1) return `${nombresElegidos[0]} · ${etiqueta}`;
    return `Evaluación de ${nombresElegidos.length} actividades · ${etiqueta}`;
  }, [audiencia, nombresElegidos]);

  const titulo = tituloManual.trim() || tituloAuto;

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
    if (!audiencia) return void toast.error('Elige quién responde');
    if (nombresElegidos.length === 0) return void toast.error('Añade al menos una actividad');
    setGuardando(true);
    try {
      const res = await fetch('/api/evaluaciones/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          audiencia,
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
      toast.success('Evaluación creada con las preguntas de siempre');
      router.push(`/gestion/evaluaciones/${data.form.id}`);
      router.refresh();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setGuardando(false);
    }
  }

  async function duplicarDelAnterior(formId: string) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/evaluaciones/admin/forms/${formId}/duplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo duplicar');
      haptic.success();
      toast.success(`Copiada a ${academicYear} con todas sus preguntas`);
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
      {formsAnterior.length > 0 && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
            ¿Repetir una evaluación de {academicYearAnterior}? <span className="text-xs font-normal text-zinc-500">({formsAnterior.length})</span>
          </summary>
          <p className="mt-1 text-xs text-zinc-500">
            Se copia entera —actividades y preguntas— al curso {academicYear}, lista para retocar.
          </p>
          <div className="mt-3 space-y-2">
            {formsAnterior.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{f.titulo}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {AUDIENCIAS.find((a) => a.value === f.audiencia)?.label} · {f.actividades.join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void duplicarDelAnterior(f.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-500/10 dark:text-blue-300"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar a {academicYear}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">1 · ¿Quién responde?</label>
        <div className="grid grid-cols-3 gap-2">
          {AUDIENCIAS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => {
                setAudiencia(a.value);
                haptic.tap();
              }}
              className={`rounded-xl border p-3 text-center transition-colors ${
                audiencia === a.value
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <span className="block text-2xl">{a.emoji}</span>
              <span
                className={`mt-1 block text-sm font-semibold ${
                  audiencia === a.value ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                {a.label}
              </span>
            </button>
          ))}
        </div>
        {audiencia && (
          <p className="mt-2 text-xs text-zinc-500">
            {audiencia === 'profesores'
              ? 'Preset de profesorado: objetivos, organización (duración, dinámica, materiales, ambiente) y observaciones. 100 % anónima.'
              : audiencia === 'alumnos'
                ? 'Preset de alumnado: valoración de la actividad y observaciones, con el tono de siempre. Anónima.'
                : 'Preset de familias: valoración general y observaciones.'}
          </p>
        )}
      </div>

      {audiencia && (
        <div className="anim-up rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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

      {audiencia === 'alumnos' && (
        <div className="anim-up rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">3 · ¿Qué clases la responden?</label>
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
        <div className="anim-up sticky bottom-0 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Título</label>
            <input
              value={tituloManual}
              onChange={(e) => setTituloManual(e.target.value)}
              placeholder={tituloAuto}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => void crear()}
            disabled={guardando || nombresElegidos.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Crear con las preguntas de siempre
          </button>
          <p className="text-center text-xs text-zinc-500">
            Se crean {nombresElegidos.length || '—'} bloque(s) con el preset de{' '}
            {AUDIENCIAS.find((a) => a.value === audiencia)?.label.toLowerCase()}; luego solo hay que retocar las frases
            marcadas.
          </p>
        </div>
      )}
    </div>
  );
}
