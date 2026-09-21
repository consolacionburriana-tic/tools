'use client';

// Pegar los códigos que ha mandado la editorial y casarlos con los alumnos, EN ORDEN.
// Es el paso que David hace cada vez que llega un Excel, así que manda la velocidad: abrir,
// pegar, mirar la vista previa, confirmar.

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { analizarPegado, codigosDeColumna, duplicadosEn, emparejar } from '@/lib/licencias-codigos';
import { claveLibro } from '@/lib/licencias-exports';
import { cursoLabel } from '@/lib/licencias';
import { librosDistintos, type LicenciaFila, type TipoLicencia } from '@/lib/licencias-envios';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tipo: TipoLicencia;
  /** Las licencias sin código que se ven ahora mismo, EN EL ORDEN DE LA TABLA. */
  candidatas: LicenciaFila[];
  onHecho: () => void | Promise<void>;
}

export function EnviosAsignar({ abierto, onCerrar, tipo, candidatas, onHecho }: Props) {
  const [texto, setTexto] = useState('');
  const [columna, setColumna] = useState<number | null>(null);
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [guardarSobrantes, setGuardarSobrantes] = useState(true);
  const [descartarResto, setDescartarResto] = useState(false);
  const [mezclaOk, setMezclaOk] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const inputFichero = useRef<HTMLInputElement>(null);

  const analisis = useMemo(() => analizarPegado(texto), [texto]);
  // La columna la elige el analizador y se puede cambiar a mano; `codigosDeColumna` es la
  // MISMA función en los dos casos, así que el descarte de cabeceras no depende de por dónde
  // se haya llegado (pegado, Excel o columna forzada).
  const columnaUsada = columna ?? analisis.columnaSugerida;
  const codigos = useMemo(
    () => codigosDeColumna(analisis.columnas, columnaUsada),
    [analisis.columnas, columnaUsada],
  );

  const huecos = useMemo(() => candidatas.filter((c) => !excluidos.has(c.id)), [candidatas, excluidos]);
  const duplicados = useMemo(() => duplicadosEn(codigos), [codigos]);
  const resultado = useMemo(() => emparejar(huecos, codigos), [huecos, codigos]);
  const libros = useMemo(() => librosDistintos(huecos), [huecos]);
  const mezcla = libros.length > 1;
  const libroUnico = huecos[0] && !mezcla ? { curso: huecos[0].curso, cod: huecos[0].cod } : null;

  function reset() {
    setTexto('');
    setColumna(null);
    setExcluidos(new Set());
    setMezclaOk(false);
  }

  async function leerExcel(fichero: File) {
    setLeyendo(true);
    try {
      const form = new FormData();
      form.append('fichero', fichero);
      const res = await fetch('/api/licencias/admin/licencias/leer-excel', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No se ha podido leer el fichero');
        return;
      }
      setTexto((data.codigos as string[]).join('\n'));
      setColumna(null);
      toast.success(`${data.codigos.length} código(s) leídos de «${data.hoja}»`);
    } finally {
      setLeyendo(false);
      if (inputFichero.current) inputFichero.current.value = '';
    }
  }

  async function asignar() {
    if (mezcla && !mezclaOk) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/licencias/admin/licencias/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          parejas: resultado.parejas.map((p) => ({ licenciaId: p.hueco.id, codigo: p.codigo })),
          sobrantes:
            guardarSobrantes && libroUnico
              ? resultado.sobrantes.map((codigo) => ({ curso: libroUnico.curso, cod: libroUnico.cod, codigo }))
              : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'No se han podido asignar');
        return;
      }
      if (descartarResto && resultado.sinCodigo.length) {
        await fetch('/api/licencias/admin/licencias/descartar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: resultado.sinCodigo.map((h) => h.id),
            motivo: 'sin licencia en esta tanda',
          }),
        });
      }
      haptic.success();
      const partes = [`${data.asignadas} asignada(s)`];
      if (data.sobrantesGuardados) partes.push(`${data.sobrantesGuardados} a sobrantes`);
      if (data.yaExistian?.length) partes.push(`${data.yaExistian.length} ya estaban puestas`);
      toast.success(partes.join(' · '));
      if (data.yaExistian?.length) {
        toast.warning(
          `Códigos que ya estaban en la campaña: ${data.yaExistian
            .slice(0, 3)
            .map((y: { codigo: string; alumno: string }) => `${y.codigo} → ${y.alumno}`)
            .join(', ')}${data.yaExistian.length > 3 ? '…' : ''}`,
          { duration: 10000 },
        );
      }
      reset();
      await onHecho();
      onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar =
    resultado.parejas.length > 0 && !guardando && (!mezcla || mezclaOk) && duplicados.length === 0;

  return (
    <Dialog open={abierto} onOpenChange={(o) => (o ? null : onCerrar())}>
      <DialogContent className="max-h-[92vh] w-full max-w-[min(64rem,calc(100%-2rem))] overflow-y-auto sm:max-w-[min(64rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Pegar códigos de la editorial</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Se reparten <strong>en el orden en que se ven</strong> entre los {candidatas.length} alumno(s) sin código
          del filtro de ahora mismo. Quita la marca a quien no le toque (una optativa que no cursa) antes de pegar.
        </p>

        {mezcla && (
          <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <strong>Ojo: el filtro mezcla {libros.length} libros distintos.</strong> Los códigos de una editorial
              son de un libro concreto; repartirlos entre varios le da a alguien la licencia de otra asignatura.
              Lo suyo es filtrar por libro y curso antes de pegar.
              <span className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={mezclaOk} onChange={(e) => setMezclaOk(e.target.checked)} />
                Sé lo que hago, repartir igualmente
              </span>
            </span>
          </label>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Izquierda: de dónde salen los códigos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Pega aquí la columna de códigos
              </label>
              <button
                type="button"
                onClick={() => inputFichero.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {leyendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                …o suelta el Excel
              </button>
              <input
                ref={inputFichero}
                type="file"
                accept=".xls,.xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void leerExcel(f);
                }}
              />
            </div>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setColumna(null);
              }}
              rows={14}
              spellCheck={false}
              placeholder={'XQXN1YG7\nTK3QN5D7\nNBMLR7L7\n…'}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-[13px] text-zinc-800 outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />

            {analisis.columnas[0] && analisis.columnas[0].length > 1 && (
              <div className="rounded-xl border border-zinc-200 p-2 text-xs dark:border-zinc-700">
                <p className="mb-1.5 text-zinc-500">Has pegado varias columnas. ¿Cuál es la del código?</p>
                <div className="flex flex-wrap gap-1.5">
                  {analisis.columnas[0].map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setColumna(i)}
                      className={`rounded-lg px-2 py-1 font-mono ${
                        i === columnaUsada
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {analisis.columnas[0][i]?.slice(0, 14) || `col ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {duplicados.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-xl bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Hay códigos repetidos en lo que has pegado ({duplicados.map((d) => d.codigo).join(', ')}). Casi
                  siempre es una selección de más en Excel: revísalo antes de guardar.
                </span>
              </p>
            )}
          </div>

          {/* Derecha: a quién le toca cada uno */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {resultado.parejas.length} casadas
              </span>
              {resultado.sinCodigo.length > 0 && (
                <span className="rounded-lg bg-amber-50 px-2 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  faltan {resultado.sinCodigo.length}
                </span>
              )}
              {resultado.sobrantes.length > 0 && (
                <span className="rounded-lg bg-blue-50 px-2 py-1 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  sobran {resultado.sobrantes.length}
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-[13px]">
                <tbody>
                  {candidatas.map((c) => {
                    const pareja = resultado.parejas.find((p) => p.hueco.id === c.id);
                    const fuera = excluidos.has(c.id);
                    return (
                      <tr key={c.id} className="border-b last:border-0 dark:border-zinc-800">
                        <td className="w-8 px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={!fuera}
                            onChange={() =>
                              setExcluidos((prev) => {
                                const s = new Set(prev);
                                if (s.has(c.id)) s.delete(c.id);
                                else s.add(c.id);
                                return s;
                              })
                            }
                          />
                        </td>
                        <td className={`px-1 py-1.5 ${fuera ? 'text-zinc-300 line-through dark:text-zinc-600' : ''}`}>
                          {c.alumno}
                          <span className="ml-1 text-xs text-zinc-400">
                            {cursoLabel(c.curso)}
                            {c.letra ? ` ${c.letra}` : ''}
                            {mezcla ? ` · ${c.asignatura}` : ''}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs">
                          {pareja ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              <ArrowRight className="mr-1 inline h-3 w-3" />
                              {pareja.codigo}
                            </span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {resultado.sobrantes.length > 0 && (
              <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={guardarSobrantes && Boolean(libroUnico)}
                  disabled={!libroUnico}
                  onChange={(e) => setGuardarSobrantes(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Guardar los {resultado.sobrantes.length} que sobran en <strong>Sobrantes</strong>
                  {libroUnico ? ` (${huecos[0].asignatura} · ${cursoLabel(libroUnico.curso)})` : ''}
                  {!libroUnico && ' — hace falta filtrar por un solo libro para saber de cuál son'}
                </span>
              </label>
            )}

            {resultado.sinCodigo.length > 0 && (
              <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={descartarResto}
                  onChange={(e) => setDescartarResto(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Marcar los {resultado.sinCodigo.length} que se quedan sin código como{' '}
                  <strong>«no le toca»</strong>, para que dejen de contar como que faltan (se puede deshacer)
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-zinc-50 p-4 sm:flex-row sm:justify-end dark:border-zinc-800 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            <X className="mr-1 inline h-4 w-4" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={asignar}
            disabled={!puedeGuardar}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {guardando ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : null}
            Asignar {resultado.parejas.length} código(s)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Exportado solo para que la pantalla pueda etiquetar un libro igual que aquí. */
export function etiquetaLibro(f: LicenciaFila): string {
  return `${f.asignatura} · ${cursoLabel(f.curso)} (${claveLibro(f.curso, f.cod)})`;
}
