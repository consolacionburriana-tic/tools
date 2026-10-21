'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, GraduationCap, Star } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Estado } from '@/components/ui/estado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { Segmentado } from '@/components/ui/segmentado';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
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
 * Selector de responsables agrupado por etapa. Los tutores llevan el birrete; si su clase (o
 * su etapa) está entre las seleccionadas de la salida, la etapa sale arriba como «sugerida»
 * y el tutor exacto lleva una estrella y el borde azul.
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
            <div className="mb-1.5 flex items-center gap-2 px-0.5">
              <Rotulo as="h3">{g.label}</Rotulo>
              {sugerida && <Estado tono="info">Sugeridos</Estado>}
            </div>
            <Filtros etiqueta={`Responsables de ${g.label}`}>
              {g.items.map((p) => {
                const activo = seleccion.has(p.id);
                const esTutorSeleccionado =
                  p.esTutor && !!claseTutorAKey(p.claseTutor) && clasesSugeridas.has(claseTutorAKey(p.claseTutor)!);
                return (
                  <Filtro
                    key={p.id}
                    activo={activo}
                    onClick={() => onToggle(p.id)}
                    icono={p.esTutor ? <GraduationCap aria-label={p.claseTutor ? `Tutor/a de ${p.claseTutor}` : 'Tutor/a'} /> : undefined}
                    className={cn(
                      esTutorSeleccionado &&
                        !activo &&
                        'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200',
                    )}
                  >
                    {p.nombre}
                    {esTutorSeleccionado && !activo && <Star aria-label="tutor/a de la clase" className="fill-blue-500 text-blue-500" />}
                  </Filtro>
                );
              })}
            </Filtros>
          </div>
        );
      })}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <GraduationCap aria-hidden className="h-3.5 w-3.5" /> tutor/a
        </span>
        <span className="inline-flex items-center gap-1">
          <Star aria-hidden className="h-3.5 w-3.5 fill-blue-500 text-blue-500" /> tutor/a de una clase elegida
        </span>
      </p>
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

  const etiquetaClases = 'Clases a las que va dirigida';
  return (
    <Tarjeta className="max-w-2xl space-y-5 p-4 sm:p-5">
      <Campo etiqueta="Nombre" id="salida-nombre">
        <Input id="salida-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Excursión al Oceanogràfic" />
      </Campo>
      <Campo etiqueta="Descripción" id="salida-descripcion" opcional ayuda="La ven las familias al entregar el justificante.">
        <Textarea
          id="salida-descripcion"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          placeholder="Salida de todo el día. Llevar almuerzo y gorra."
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha" id="salida-fecha">
          <Input id="salida-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Importe (€)" id="salida-importe">
          <Input
            id="salida-importe"
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="12,50"
            className="tabular-nums"
          />
        </Campo>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">¿Cómo se paga?</p>
        <Segmentado
          etiqueta="Cómo se paga"
          lleno
          valor={tipoPago}
          onChange={setTipoPago}
          opciones={[
            { valor: 'transferencia', etiqueta: 'Por banco' },
            { valor: 'mano', etiqueta: 'En mano' },
          ]}
        />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {tipoPago === 'mano' ? 'Recoges tú el dinero y marcas aquí quién ha pagado.' : 'Las familias suben el justificante.'}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{etiquetaClases}</p>
        <Filtros etiqueta={etiquetaClases}>
          {clases.map((c) => {
            const k = claseKey(c);
            return (
              <Filtro key={k} activo={seleccion.has(k)} onClick={() => toggle(seleccion, k, setSeleccion)}>
                {c.label}
              </Filtro>
            );
          })}
        </Filtros>
      </div>

      {!inicial && seleccion.size > 1 && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <input
            type="checkbox"
            checked={porClase}
            onChange={(e) => setPorClase(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-blue-600"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Crear una salida por clase ({seleccion.size} salidas)
            </span>
            <span className="block text-sm text-zinc-500 dark:text-zinc-400">
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
                <div key={k} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                  <Rotulo as="h3">{c.label}</Rotulo>
                  <Input
                    aria-label={`Nombre de la salida de ${c.label}`}
                    value={f.nombre}
                    onChange={(e) => set({ nombre: e.target.value })}
                    placeholder={`${nombre || 'Salida'} — ${c.label}`}
                  />
                  <Input
                    aria-label={`Lugar o nota de ${c.label}`}
                    value={f.descripcion}
                    onChange={(e) => set({ descripcion: e.target.value })}
                    placeholder="Lugar / nota para las familias (opcional)"
                  />
                  <p className="pt-1 text-sm text-zinc-500 dark:text-zinc-400">Responsables de esta clase:</p>
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
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Responsables <span className="font-normal text-zinc-500 dark:text-zinc-400">(reciben aviso por correo con cada justificante)</span>
          </p>
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

      <Button type="button" size="lg" className="w-full" cargando={guardando} onClick={() => void guardar()}>
        {!guardando && <Check aria-hidden />}
        {inicial ? 'Guardar cambios' : porClase && seleccion.size > 1 ? `Crear ${seleccion.size} salidas` : 'Crear salida'}
      </Button>
    </Tarjeta>
  );
}
