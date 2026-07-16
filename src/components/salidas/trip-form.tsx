'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso } from '@/lib/cursos';
import { agruparProfes, claseTutorAKey, type ProfeItem } from '@/lib/profes';

export interface ClaseOption {
  curso: string;
  letra: string | null;
  label: string;
}
export type ProfeOption = ProfeItem;

interface TripFormProps {
  clases: ClaseOption[];
  profes: ProfeOption[];
  /** Si viene, es edición */
  inicial?: {
    id: string;
    nombre: string;
    descripcion: string | null;
    fecha: string | null;
    importe: string | null;
    clases: { curso: string; letra: string | null }[];
    responsables: string[];
    tipoPago: 'transferencia' | 'mano';
  };
}

const claseKey = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

/**
 * Selector de responsables agrupado por etapa. Los tutores salen primero con un
 * puntito de color; si su clase (o su etapa) está entre las seleccionadas de la
 * salida, la sección se marca como "sugerida" y el tutor exacto se resalta.
 */
function ProfeChips({
  profes,
  seleccion,
  onToggle,
  etapasSugeridas,
  clasesSugeridas,
}: {
  profes: ProfeOption[];
  seleccion: Set<string>;
  onToggle: (id: string) => void;
  etapasSugeridas: Set<string>;
  clasesSugeridas: Set<string>;
}) {
  const grupos = useMemo(() => agruparProfes(profes), [profes]);
  // Etapas sugeridas primero, para que lo relevante quede arriba.
  const ordenados = [...grupos].sort((a, b) => {
    const sa = etapasSugeridas.has(a.clave) ? 0 : 1;
    const sb = etapasSugeridas.has(b.clave) ? 0 : 1;
    return sa - sb;
  });

  return (
    <div className="space-y-3">
      {ordenados.map((g) => {
        const sugerida = etapasSugeridas.has(g.clave);
        return (
          <div key={g.clave}>
            <p className="mb-1 flex items-center gap-1.5 px-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {g.label}
              {sugerida && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold normal-case text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  sugeridos
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => {
                const activo = seleccion.has(p.id);
                const esTutorSeleccionado = p.esTutor && !!claseTutorAKey(p.claseTutor) && clasesSugeridas.has(claseTutorAKey(p.claseTutor)!);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle(p.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                      activo
                        ? 'bg-emerald-600 text-white'
                        : esTutorSeleccionado
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/40'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {p.esTutor && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-white/80' : 'bg-amber-500'}`}
                        title={p.claseTutor ? `Tutor/a de ${p.claseTutor}` : 'Tutor/a'}
                      />
                    )}
                    {p.nombre}
                    {esTutorSeleccionado && !activo && <Star className="h-3 w-3 fill-blue-500 text-blue-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TripForm({ clases, profes, inicial }: TripFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? '');
  const [importe, setImporte] = useState(inicial?.importe ?? '');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set((inicial?.clases ?? []).map(claseKey)));
  const [responsables, setResponsables] = useState<Set<string>>(new Set(inicial?.responsables ?? []));
  const [tipoPago, setTipoPago] = useState<'transferencia' | 'mano'>(inicial?.tipoPago ?? 'transferencia');
  // Modo bloque: una salida POR CLASE seleccionada (convivencias de inicio de curso:
  // cada tutor recibe solo lo de su clase). Solo al crear, no al editar.
  const [porClase, setPorClase] = useState(false);
  const [filasBulk, setFilasBulk] = useState<Record<string, { nombre: string; descripcion: string; responsables: Set<string> }>>({});
  const [guardando, setGuardando] = useState(false);

  function filaBulk(k: string, label: string) {
    return (
      filasBulk[k] ?? {
        nombre: nombre.trim() ? `${nombre.trim()} — ${label}` : label,
        descripcion: descripcion,
        responsables: new Set<string>(),
      }
    );
  }

  function toggle<T>(set: Set<T>, valor: T, setter: (s: Set<T>) => void) {
    const s = new Set(set);
    if (s.has(valor)) s.delete(valor);
    else s.add(valor);
    setter(s);
  }

  async function guardar() {
    if (nombre.trim().length < 3) return void toast.error('Ponle un nombre a la salida');
    if (seleccion.size === 0) return void toast.error('Selecciona al menos una clase');
    setGuardando(true);
    try {
      if (!inicial && porClase) {
        // Bloque: una salida por clase, cada una con su nombre/lugar y sus responsables
        const elegidas = clases.filter((c) => seleccion.has(claseKey(c)));
        let creadas = 0;
        for (const c of elegidas) {
          const f = filaBulk(claseKey(c), c.label);
          const res = await fetch('/api/salidas/admin/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: f.nombre.trim() || `${nombre.trim()} — ${c.label}`,
              descripcion: f.descripcion.trim() || null,
              fecha: fecha || null,
              importe: importe.trim() ? importe.trim().replace(',', '.') : null,
              clases: [{ curso: c.curso, letra: c.letra }],
              responsables: [...f.responsables],
              tipoPago,
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? `No se pudo crear la salida de ${c.label}`);
          creadas++;
        }
        haptic.success();
        toast.success(`${creadas} salidas creadas (una por clase)`);
        router.push('/gestion/salidas');
        router.refresh();
        return;
      }

      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        fecha: fecha || null,
        importe: importe.trim() ? importe.trim().replace(',', '.') : null,
        clases: clases.filter((c) => seleccion.has(claseKey(c))).map(({ curso, letra }) => ({ curso, letra })),
        responsables: [...responsables],
        tipoPago,
      };
      const res = await fetch(inicial ? `/api/salidas/admin/trips/${inicial.id}` : '/api/salidas/admin/trips', {
        method: inicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      haptic.success();
      toast.success(inicial ? 'Salida actualizada' : 'Salida creada');
      router.push(inicial ? `/gestion/salidas/${inicial.id}` : `/gestion/salidas/${data.trip.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setGuardando(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

  // Sugerencias: etapas y clases de la selección actual, para priorizar a sus profes/tutores.
  const clasesSugeridas = seleccion;
  const etapasSugeridas = useMemo(() => {
    const set = new Set<string>();
    for (const c of clases) {
      if (seleccion.has(claseKey(c))) {
        const e = etapaDeCurso(c.curso);
        if (e) set.add(e);
      }
    }
    return set;
  }, [clases, seleccion]);

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nombre *</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Excursión al Oceanogràfic" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Descripción</label>
        <p className="mb-1.5 text-xs text-zinc-500">Pueden verla las familias al entregar justificante</p>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Salida de todo el día. Llevar almuerzo y gorra." className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Importe (€)</label>
          <input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="12,50" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">¿Cómo se paga?</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: 'transferencia', titulo: 'Por banco', desc: 'Las familias suben el justificante' },
              { v: 'mano', titulo: 'En mano', desc: 'Yo recojo el dinero y marco pagos aquí' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setTipoPago(o.v)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                tipoPago === o.v
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <p className={`text-sm font-semibold ${tipoPago === o.v ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200'}`}>
                {o.titulo}
              </p>
              <p className="text-xs text-zinc-500">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Clases a las que va dirigida *</label>
        <div className="flex flex-wrap gap-1.5">
          {clases.map((c) => {
            const k = claseKey(c);
            const activa = seleccion.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(seleccion, k, setSeleccion)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  activa
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {!inicial && seleccion.size > 1 && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <input type="checkbox" checked={porClase} onChange={(e) => setPorClase(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Crear una salida POR CLASE ({seleccion.size} salidas)
            </span>
            <span className="block text-xs text-zinc-500">
              Para convivencias de inicio de curso y similares: cada clase tiene su fichita con su lugar y sus
              responsables, y a cada tutor le llega solo lo suyo.
            </span>
          </span>
        </label>
      )}

      {!inicial && porClase && seleccion.size > 1 && (
        <div className="space-y-2.5">
          {clases
            .filter((c) => seleccion.has(claseKey(c)))
            .map((c) => {
              const k = claseKey(c);
              const f = filaBulk(k, c.label);
              const set = (cambios: Partial<typeof f>) => setFilasBulk((prev) => ({ ...prev, [k]: { ...f, ...cambios } }));
              return (
                <div key={k} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">{c.label}</p>
                  <input
                    value={f.nombre}
                    onChange={(e) => set({ nombre: e.target.value })}
                    placeholder={`${nombre || 'Salida'} — ${c.label}`}
                    className={inputCls}
                  />
                  <input
                    value={f.descripcion}
                    onChange={(e) => set({ descripcion: e.target.value })}
                    placeholder="Lugar / nota para las familias (opcional)"
                    className={`${inputCls} mt-2`}
                  />
                  <p className="mb-1 mt-2 text-xs text-zinc-500">Responsables de esta clase:</p>
                  <div className="max-h-52 overflow-y-auto">
                    <ProfeChips
                      profes={profes}
                      seleccion={f.responsables}
                      onToggle={(id) => {
                        const r = new Set(f.responsables);
                        if (r.has(id)) r.delete(id);
                        else r.add(id);
                        set({ responsables: r });
                      }}
                      etapasSugeridas={new Set([etapaDeCurso(c.curso)].filter(Boolean) as string[])}
                      clasesSugeridas={new Set([claseKey(c)])}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {(inicial || !porClase || seleccion.size <= 1) && (
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Responsables (reciben aviso por email con cada justificante)
        </label>
        <div className="max-h-72 overflow-y-auto">
          <ProfeChips
            profes={profes}
            seleccion={responsables}
            onToggle={(id) => toggle(responsables, id, setResponsables)}
            etapasSugeridas={etapasSugeridas}
            clasesSugeridas={clasesSugeridas}
          />
        </div>
      </div>
      )}

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        {inicial ? 'Guardar cambios' : porClase && seleccion.size > 1 ? `Crear ${seleccion.size} salidas` : 'Crear salida'}
      </button>
    </div>
  );
}
