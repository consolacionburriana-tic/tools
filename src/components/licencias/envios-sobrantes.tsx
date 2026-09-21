'use client';

// El almacén: códigos que llegaron de más y no tienen dueño. «A veces nos pueden sobrar 10
// licencias porque se equivocan los comerciales y yo las guardo porque a lo mejor las puedo
// asignar a alguien en otro momento» (David). Por eso no se tiran: se guardan con su libro y
// su curso, y desde aquí se colocan en cualquier alumno que esté pendiente de ese mismo libro.

import { useMemo, useState } from 'react';
import { Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { claveLibro } from '@/lib/licencias-exports';
import { cursoLabel } from '@/lib/licencias';
import { ordenNatural, type LicenciaFila, type TipoLicencia } from '@/lib/licencias-envios';

interface Props {
  filas: LicenciaFila[];
  tipo: TipoLicencia;
  onCambio: () => void | Promise<void>;
}

export function EnviosSobrantes({ filas, tipo, onCambio }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);

  const sobrantes = useMemo(
    () => filas.filter((f) => f.tipo === tipo && !f.studentId && f.codigo),
    [filas, tipo],
  );

  // A quién se le puede colocar cada sobrante: alumnos pendientes de ESE mismo libro.
  const huecosPorLibro = useMemo(() => {
    const mapa = new Map<string, LicenciaFila[]>();
    for (const f of filas) {
      if (f.tipo !== tipo || !f.studentId || f.codigo || f.descartadoAt) continue;
      const k = claveLibro(f.curso, f.cod);
      mapa.set(k, [...(mapa.get(k) ?? []), f]);
    }
    for (const [k, v] of mapa) mapa.set(k, [...v].sort(ordenNatural));
    return mapa;
  }, [filas, tipo]);

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

  async function borrar(id: string, codigo: string) {
    if (!confirm(`Se borrará el código ${codigo} del almacén. No se puede deshacer. ¿Seguro?`)) return;
    setOcupado(id);
    try {
      const res = await fetch('/api/licencias/admin/licencias/sobrantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'borrar', id }),
      });
      if (!res.ok) {
        toast.error((await res.json()).error ?? 'No se ha podido borrar');
        return;
      }
      toast.success('Sobrante borrado');
      await onCambio();
    } finally {
      setOcupado(null);
    }
  }

  if (sobrantes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No hay licencias sobrantes de {tipo === 'banco' ? 'banco de libros' : 'pago'}. Cuando al pegar códigos
        sobren, se guardan aquí con su libro para poder colocarlas más adelante.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        <Package className="mr-1 inline h-4 w-4 text-blue-600" />
        {sobrantes.length} licencia(s) guardadas sin dueño. Se pueden colocar en cualquier alumno que esté
        pendiente <strong>de ese mismo libro</strong>.
      </p>

      {porLibro.map(([clave, grupo]) => {
        const huecos = huecosPorLibro.get(clave) ?? [];
        return (
          <div key={clave} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2 bg-zinc-50 px-4 py-2 dark:bg-zinc-800/50">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {grupo.asignatura} · {cursoLabel(grupo.curso)}
                <span className="ml-2 font-normal text-zinc-400">{grupo.cod}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {grupo.items.length} sobrante(s) · {huecos.length} alumno(s) pendiente(s)
              </p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {grupo.items.map((s) => (
                  <tr key={s.id} className="border-t dark:border-zinc-800">
                    <td className="px-4 py-2 font-mono text-[13px]">{s.codigo}</td>
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
                        {huecos.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.alumno} · {cursoLabel(h.curso)}
                            {h.letra ?? ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="w-10 px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => borrar(s.id, s.codigo ?? '')}
                        disabled={ocupado === s.id}
                        title="Borrar del almacén"
                        className="text-zinc-300 transition-colors hover:text-red-500 disabled:opacity-40 dark:text-zinc-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
