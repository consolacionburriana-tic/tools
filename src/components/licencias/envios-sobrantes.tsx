'use client';

// El almacén: códigos que llegaron de más y no tienen dueño. «A veces nos pueden sobrar 10
// licencias porque se equivocan los comerciales y yo las guardo porque a lo mejor las puedo
// asignar a alguien en otro momento» (David). Por eso no se tiran: se guardan con su libro y
// su curso, y desde aquí se colocan en cualquier alumno que esté pendiente de ese mismo libro.
//
// Esta pantalla es la ÚNICA que ignora la pestaña de pago/banco, a propósito: «las sobrantes sí
// se pueden mezclar, sobre todo nos sobran gratuitas y se las asignamos a los de pago» (David).
// Un libro del banco es gratis para el alumnado BdL y de pago para el que no lo es, pero el
// código es el mismo producto. Lo que no se cruza nunca es el libro — de eso se encarga
// `puedeColocarse`, aquí y en el servidor.

import { useMemo, useState } from 'react';
import { Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { claveLibro } from '@/lib/licencias-exports';
import { cursoLabel } from '@/lib/licencias';
import { ordenNatural, puedeColocarse, type LicenciaFila } from '@/lib/licencias-envios';

interface Props {
  filas: LicenciaFila[];
  onCambio: () => void | Promise<void>;
}

export function EnviosSobrantes({ filas, onCambio }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  /** La casilla de la cabecera de cada libro: marca o desmarca ese libro entero. */
  const alternarLibro = (ids: string[], marcar: boolean) =>
    setMarcados((prev) => {
      const s = new Set(prev);
      for (const id of ids) {
        if (marcar) s.add(id);
        else s.delete(id);
      }
      return s;
    });

  const sobrantes = useMemo(() => filas.filter((f) => !f.studentId && f.codigo), [filas]);

  // A quién se le puede colocar cada sobrante: alumnos pendientes de ESE mismo libro, sean de
  // pago o del banco (ver la nota de arriba).
  const huecosPorLibro = useMemo(() => {
    const mapa = new Map<string, LicenciaFila[]>();
    for (const f of filas) {
      if (!f.studentId || f.codigo || f.descartadoAt) continue;
      const k = claveLibro(f.curso, f.cod);
      mapa.set(k, [...(mapa.get(k) ?? []), f]);
    }
    for (const [k, v] of mapa) mapa.set(k, [...v].sort(ordenNatural));
    return mapa;
  }, [filas]);

  const porLibro = useMemo(() => {
    const mapa = new Map<string, { curso: string; cod: string; asignatura: string; items: LicenciaFila[] }>();
    for (const s of sobrantes) {
      const k = claveLibro(s.curso, s.cod);
      const previo = mapa.get(k) ?? { curso: s.curso, cod: s.cod, asignatura: s.asignatura, items: [] };
      previo.items.push(s);
      mapa.set(k, previo);
    }
    return [...mapa.entries()].sort((a, b) => a[1].asignatura.localeCompare(b[1].asignatura, 'es'));
  }, [sobrantes]);

  async function colocar(sobranteId: string, licenciaId: string) {
    if (!licenciaId) return;
    setOcupado(sobranteId);
    try {
      const res = await fetch('/api/licencias/admin/licencias/sobrantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'colocar', sobranteId, licenciaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No se ha podido colocar');
        return;
      }
      haptic.success();
      toast.success('Licencia colocada');
      await onCambio();
    } finally {
      setOcupado(null);
    }
  }

  async function borrar(ids: string[]) {
    if (!ids.length) return;
    const aviso =
      ids.length === 1
        ? 'Se borrará ese código del almacén. No se puede deshacer. ¿Seguro?'
        : `Se borrarán ${ids.length} códigos del almacén. No se puede deshacer. ¿Seguro?`;
    if (!confirm(aviso)) return;
    setOcupado('borrando');
    try {
      const res = await fetch('/api/licencias/admin/licencias/sobrantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'borrar', ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'No se ha podido borrar');
        return;
      }
      haptic.success();
      toast.success(`${data.count ?? ids.length} sobrante(s) borrados`);
      setMarcados(new Set());
      await onCambio();
    } finally {
      setOcupado(null);
    }
  }

  if (sobrantes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No hay licencias sobrantes. Cuando al pegar códigos sobren, se guardan aquí con su libro para poder
        colocarlas más adelante.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        <Package className="mr-1 inline h-4 w-4 text-blue-600" />
        {sobrantes.length} licencia(s) guardadas sin dueño, de las dos pestañas. Se pueden colocar en cualquier
        alumno pendiente <strong>de ese mismo libro</strong>, sea de pago o del banco — una gratis que sobra vale
        para uno de pago, porque el código es el mismo producto.
      </p>

      {marcados.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm shadow-sm dark:border-red-500/30 dark:bg-red-500/10">
          <span className="font-medium text-red-900 dark:text-red-200">
            {marcados.size} sobrante(s) marcados
          </span>
          <button
            type="button"
            onClick={() => borrar([...marcados])}
            disabled={ocupado === 'borrando'}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Borrar del almacén
          </button>
          <button
            type="button"
            onClick={() => setMarcados(new Set())}
            className="ml-auto text-xs text-red-700 underline dark:text-red-300"
          >
            Quitar la selección
          </button>
        </div>
      )}

      {porLibro.map(([clave, grupo]) => {
        const huecos = huecosPorLibro.get(clave) ?? [];
        const idsDelLibro = grupo.items.map((i) => i.id);
        const todosMarcados = idsDelLibro.every((id) => marcados.has(id));
        return (
          <div key={clave} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 px-4 py-2 dark:bg-zinc-800/50">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={(e) => alternarLibro(idsDelLibro, e.target.checked)}
                  title="Marcar todos los sobrantes de este libro"
                />
                {grupo.asignatura} · {cursoLabel(grupo.curso)}
                <span className="font-normal text-zinc-400">{grupo.cod}</span>
              </label>
              <p className="text-xs text-zinc-500">
                {grupo.items.length} sobrante(s) · {huecos.length} alumno(s) pendiente(s)
              </p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {grupo.items.map((s) => (
                  <tr key={s.id} className="border-t dark:border-zinc-800">
                    <td className="px-4 py-2 font-mono text-[13px]">
                      {s.codigo}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          s.tipo === 'banco'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                        }`}
                      >
                        {s.tipo === 'banco' ? 'gratis' : 'de pago'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-400">{s.nota ?? ''}</td>
                    <td className="px-2 py-2 text-right">
                      <select
                        defaultValue=""
                        disabled={ocupado === s.id || huecos.length === 0}
                        onChange={(e) => colocar(s.id, e.target.value)}
                        className="max-w-56 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">
                          {huecos.length ? 'Colocar en…' : 'Nadie pendiente de este libro'}
                        </option>
                        {huecos
                          .filter((h) => puedeColocarse(s, h))
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.alumno} · {cursoLabel(h.curso)}
                              {h.letra ?? ''} · {h.tipo === 'banco' ? 'banco' : 'pago'}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="w-10 px-3 py-2 text-right">
                      <input
                        type="checkbox"
                        checked={marcados.has(s.id)}
                        onChange={() => alternar(s.id)}
                        title="Marcar para borrar en bloque"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
