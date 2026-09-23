'use client';

// Venta de materiales: cada material (la agenda, la bata, el cuaderno de 3º…) es una columna
// para las clases a las que va, y cada celda dice si ese alumno lo ha pagado.
//
// Cinco estados, un toque por celda: — → pagado → no → becado → no aplica → —. El «—» no es
// un «no»: es que todavía no hay información, que es como empieza todo el mundo.
//
// Quién hace qué (David, 23-sep-2026):
//  - crear materiales y marcar: secretaría, dirección y TIC;
//  - ver «becado»: además orientación. Al resto le llega como «pagado» desde el servidor, y
//    por eso a ellos el ciclo tampoco les ofrece la beca.

import { useMemo, useState } from 'react';
import { Check, FileDown, Loader2, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ESTADO_MATERIAL_LABEL,
  aplicaMaterial,
  claseLarga,
  describirDestinos,
  siguienteEstadoMaterial,
  type DestinoMaterial,
  type EstadoMaterial,
} from '@/lib/alumnado';
import type { ClaveColumna } from '@/lib/alumnado-informe';
import type { AlumnoLista, ClaseListado, MaterialLista } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';
import { BarraTabla, Celda, CeldaAlumno, ColumnaBoton, useGuardado, type TonoTabla } from './piezas-tabla';

const TONO: Record<string, TonoTabla> = { pagado: 'si', no: 'no', becado: 'beca', no_aplica: 'gris', null: 'gris' };

function contenidoCelda(estado: EstadoMaterial | null): React.ReactNode {
  if (estado === 'pagado') return <Check className="h-4 w-4" />;
  if (estado === 'no') return <X className="h-4 w-4" />;
  if (estado === 'becado') return 'Beca';
  if (estado === 'no_aplica') return 'N/A';
  return <Minus className="h-4 w-4" />;
}

const euros = (n: number | null) =>
  n === null ? null : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 });

export function TablaMateriales({
  alumnos,
  clases,
  materiales,
  ambito,
  conClase,
  puedeGestionar,
  veBecas,
  onEstados,
  onMateriales,
  onInforme,
}: {
  alumnos: AlumnoLista[];
  /** Todas las clases que ve quien mira: con esto se elige a quién va un material. */
  clases: ClaseListado[];
  materiales: MaterialLista[];
  ambito: string;
  conClase: boolean;
  puedeGestionar: boolean;
  veBecas: boolean;
  onEstados: (materialId: string, ids: string[], estado: EstadoMaterial | null) => void;
  onMateriales: (materiales: MaterialLista[]) => void;
  onInforme: (columnas: ClaveColumna[]) => void;
}) {
  const { guardando, confirmando, enviar, confirmarY } = useGuardado();
  const [editando, setEditando] = useState<MaterialLista | 'nuevo' | null>(null);

  // Las columnas: los materiales que van a alguien de los que se ven ahora.
  const columnas = useMemo(
    () => materiales.filter((m) => alumnos.some((a) => aplicaMaterial(m.destinos, a))),
    [materiales, alumnos],
  );

  async function marcar(clave: string, materialId: string, ids: string[], estado: EstadoMaterial | null) {
    if (ids.length === 0) return;
    const datos = await enviar<{ ids: string[] }>(
      clave,
      `/api/alumnado/materiales/${materialId}/estados`,
      { eduStudentIds: ids, estado },
      ids.length > 1 ? `${ids.length} alumnos actualizados` : undefined,
    );
    if (datos) onEstados(materialId, datos.ids, estado);
  }

  async function quitar(m: MaterialLista) {
    haptic.tap();
    try {
      const res = await fetch(`/api/alumnado/materiales/${m.id}`, { method: 'DELETE' });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo quitar');
      onMateriales(materiales.filter((x) => x.id !== m.id));
      haptic.success();
      toast.success(datos.hecho === 'archivado' ? `«${m.nombre}» archivado: sus pagos se guardan` : `«${m.nombre}» borrado`);
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo quitar');
    }
  }

  return (
    <div className="space-y-2">
      <BarraTabla ambito={ambito} cuantos={alumnos.length} extra={<span className="text-zinc-400"> · {columnas.length} {columnas.length === 1 ? 'material' : 'materiales'}</span>}>
        {columnas.length > 0 && (
          <button
            type="button"
            onClick={() => onInforme(columnas.map((m) => `mat:${m.id}` as ClaveColumna))}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <FileDown className="h-3.5 w-3.5" /> Informe
          </button>
        )}
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              setEditando('nuevo');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Nuevo material
          </button>
        )}
      </BarraTabla>

      {editando && (
        <FormMaterial
          inicial={editando === 'nuevo' ? null : editando}
          clases={clases}
          onCancelar={() => setEditando(null)}
          onGuardado={(m) => {
            onMateriales(
              editando === 'nuevo' ? [...materiales, m] : materiales.map((x) => (x.id === m.id ? m : x)),
            );
            setEditando(null);
          }}
        />
      )}

      {columnas.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {materiales.length === 0
            ? puedeGestionar
              ? 'Todavía no hay materiales este curso. Crea el primero con «Nuevo material».'
              : 'Todavía no hay materiales a la venta este curso.'
            : 'Ninguno de los materiales va a esta clase.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
                {columnas.map((m) => {
                  const suyos = alumnos.filter((a) => aplicaMaterial(m.destinos, a));
                  const pagados = suyos.filter((a) => a.materiales[m.id] === 'pagado' || a.materiales[m.id] === 'becado').length;
                  const ids = suyos.map((a) => a.id);
                  return (
                    <th key={m.id} className="min-w-[6.5rem] p-2 align-bottom">
                      <span className="block text-center text-xs font-semibold text-zinc-700 dark:text-zinc-200" title={m.notas ?? undefined}>
                        {m.nombre}
                      </span>
                      <span className="block text-center text-[10px] font-normal text-zinc-400" title={describirDestinos(m.destinos)}>
                        {[euros(m.importe), `${pagados}/${suyos.length}`].filter(Boolean).join(' · ')}
                      </span>
                      {puedeGestionar && (
                        <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                          <ColumnaBoton
                            activa={confirmando === `${m.id}-pagado`}
                            ocupada={guardando === `${m.id}-pagado`}
                            tono="verde"
                            titulo={`${m.nombre}: todos pagado en ${ambito} (${ids.length})`}
                            onClick={() => confirmarY(`${m.id}-pagado`, () => void marcar(`${m.id}-pagado`, m.id, ids, 'pagado'))}
                          >
                            <Check className="h-3 w-3" />
                          </ColumnaBoton>
                          <ColumnaBoton
                            activa={confirmando === `${m.id}-no`}
                            ocupada={guardando === `${m.id}-no`}
                            tono="rojo"
                            titulo={`${m.nombre}: todos no pagado en ${ambito} (${ids.length})`}
                            onClick={() => confirmarY(`${m.id}-no`, () => void marcar(`${m.id}-no`, m.id, ids, 'no'))}
                          >
                            <X className="h-3 w-3" />
                          </ColumnaBoton>
                          <ColumnaBoton
                            activa={false}
                            ocupada={false}
                            tono="gris"
                            titulo={`Editar «${m.nombre}»`}
                            onClick={() => setEditando(m)}
                          >
                            <Pencil className="h-3 w-3" />
                          </ColumnaBoton>
                          <ColumnaBoton
                            activa={confirmando === `${m.id}-quitar`}
                            ocupada={false}
                            tono="rojo"
                            titulo={`Quitar «${m.nombre}» (si ya tiene pagos, se archiva)`}
                            onClick={() => confirmarY(`${m.id}-quitar`, () => void quitar(m))}
                          >
                            <Trash2 className="h-3 w-3" />
                          </ColumnaBoton>
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {alumnos.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <CeldaAlumno numero={a.numero} nombre={a.completo} clase={conClase ? a.clase : undefined} />
                  {columnas.map((m) => {
                    if (!aplicaMaterial(m.destinos, a)) {
                      return (
                        <td key={m.id} className="p-1 text-center text-zinc-300 dark:text-zinc-700" title="Este material no va a su clase">
                          ·
                        </td>
                      );
                    }
                    const estado = a.materiales[m.id] ?? null;
                    const etiqueta = ESTADO_MATERIAL_LABEL[estado ?? 'sin'].texto;
                    return (
                      <td key={m.id} className="p-1 text-center">
                        <Celda
                          tono={TONO[String(estado)]}
                          ancho="w-14"
                          editable={puedeGestionar}
                          ocupada={guardando === `${a.id}-${m.id}`}
                          etiqueta={`${m.nombre}: ${etiqueta} · ${a.completo}`}
                          onTocar={() =>
                            marcar(`${a.id}-${m.id}`, m.id, [a.id], siguienteEstadoMaterial(estado, veBecas))
                          }
                        >
                          {contenidoCelda(estado)}
                        </Celda>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-1 text-xs text-zinc-400">
        {puedeGestionar ? 'Cada casilla cicla ' : 'Leyenda: '}
        — sin información →{' '}
        <strong className="font-medium text-emerald-600 dark:text-emerald-400">pagado</strong> →{' '}
        <strong className="font-medium text-red-600 dark:text-red-400">no</strong>
        {veBecas && (
          <>
            {' '}→ <strong className="font-medium text-blue-600 dark:text-blue-400">becado</strong>
          </>
        )}{' '}
        → no aplica.
        {!veBecas && ' Los becados se ven como pagados.'}
        {!puedeGestionar && ' Esto lo marcan secretaría, dirección o TIC.'}
      </p>
    </div>
  );
}

// ─── Crear / editar un material ───────────────────────────────────────────────

const ETAPAS: { etapa: 'EI' | 'EP' | 'ESO'; texto: string }[] = [
  { etapa: 'EI', texto: 'Infantil' },
  { etapa: 'EP', texto: 'Primaria' },
  { etapa: 'ESO', texto: 'Secundaria' },
];

const claveDestino = (d: DestinoMaterial) =>
  d.tipo === 'etapa' ? `e:${d.etapa}` : d.tipo === 'curso' ? `c:${d.curso}` : `k:${d.curso}|${d.letra ?? ''}`;

function FormMaterial({
  inicial,
  clases,
  onCancelar,
  onGuardado,
}: {
  inicial: MaterialLista | null;
  clases: ClaseListado[];
  onCancelar: () => void;
  onGuardado: (m: MaterialLista) => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [importe, setImporte] = useState(inicial?.importe != null ? String(inicial.importe).replace('.', ',') : '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [destinos, setDestinos] = useState<DestinoMaterial[]>(inicial?.destinos ?? []);
  const [guardando, setGuardando] = useState(false);

  const puestos = new Set(destinos.map(claveDestino));
  const alternar = (d: DestinoMaterial) => {
    haptic.tap();
    const k = claveDestino(d);
    setDestinos((prev) => (puestos.has(k) ? prev.filter((x) => claveDestino(x) !== k) : [...prev, d]));
  };

  const etapas = ETAPAS.filter((e) => clases.some((c) => c.etapa === e.etapa));
  const cursos = [...new Map(clases.map((c) => [c.curso, c])).values()];
  const alcanzados = clases.filter((c) => aplicaMaterial(destinos, c));
  const alumnosAlcanzados = alcanzados.reduce((n, c) => n + c.alumnos, 0);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const numero = importe.trim() ? Number(importe.replace(',', '.')) : null;
    if (numero !== null && (Number.isNaN(numero) || numero < 0)) {
      toast.error('El importe no es un número');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = { nombre, importe: numero, notas: notas.trim() || null, destinos };
      const res = await fetch(inicial ? `/api/alumnado/materiales/${inicial.id}` : '/api/alumnado/materiales', {
        method: inicial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      haptic.success();
      toast.success(inicial ? 'Material guardado' : `«${nombre.trim()}» creado`);
      onGuardado(inicial ? { ...inicial, ...cuerpo, nombre: nombre.trim() } : (datos.material as MaterialLista));
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  const chip = (puesto: boolean) =>
    `rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
      puesto
        ? 'bg-blue-600 text-white'
        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
    }`;

  return (
    <form
      onSubmit={guardar}
      className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-blue-200 dark:bg-zinc-900 dark:ring-blue-900/60"
    >
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {inicial ? `Editar «${inicial.nombre}»` : 'Nuevo material'}
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (agenda, bata, cuaderno de caligrafía…)"
          maxLength={80}
          required
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          placeholder="Importe €"
          inputMode="decimal"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
      <input
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder="Notas (opcional)"
        maxLength={300}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">¿A quién va?</p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 w-16 text-[11px] text-zinc-400">Etapa</span>
          {etapas.map((e) => (
            <button key={e.etapa} type="button" className={chip(puestos.has(`e:${e.etapa}`))} onClick={() => alternar({ tipo: 'etapa', etapa: e.etapa })}>
              {e.texto}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 w-16 text-[11px] text-zinc-400">Curso</span>
          {cursos.map((c) => (
            <button key={c.curso} type="button" className={chip(puestos.has(`c:${c.curso}`))} onClick={() => alternar({ tipo: 'curso', curso: c.curso })}>
              {claseLarga(c.curso, null)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 w-16 text-[11px] text-zinc-400">Clase</span>
          {clases.map((c) => {
            const k = `k:${c.curso}|${c.letra ?? ''}`;
            return (
              <button key={k} type="button" className={chip(puestos.has(k))} onClick={() => alternar({ tipo: 'clase', curso: c.curso, letra: c.letra })}>
                {c.clase}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">
          {destinos.length === 0
            ? 'Elige una etapa, un curso o clases sueltas (se pueden mezclar).'
            : `Va a ${alcanzados.length} ${alcanzados.length === 1 ? 'clase' : 'clases'} · ${alumnosAlcanzados} alumnos`}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando || !nombre.trim() || destinos.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {inicial ? 'Guardar' : 'Crear material'}
        </button>
      </div>
    </form>
  );
}
