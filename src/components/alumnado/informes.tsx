'use client';

// Informes a medida (David, 23-sep-2026): «a principio de curso nos hace falta esa
// información». Eliges qué columnas, de qué clases, si quieres solo a quien cumpla algo
// («solo quien NO ha pagado la agenda») y en qué formato: PDF para imprimir o mandar, Excel
// o CSV para seguir trabajando.
//
// La pantalla solo arma la petición: el informe lo hace el servidor con la misma función que
// pinta la lista, así que no enseña nada que no se vea ya aquí (ni la protección de datos que
// no te toca, ni las becas si no te tocan).

import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { columnasDisponibles, type ClaveColumna, type ColumnaInforme } from '@/lib/alumnado-informe';
import type { ClaseListado, MaterialLista } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';

type Formato = 'pdf' | 'xlsx' | 'csv';
type Ambito = 'actual' | 'todas' | 'elegir';

const claveClase = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function Informes({
  clases,
  claseActual,
  materiales,
  veProteccion,
  preset,
}: {
  clases: ClaseListado[];
  /** La clase elegida en el carril, si la hay: es el ámbito por defecto. */
  claseActual: ClaseListado | null;
  materiales: MaterialLista[];
  /** Si no ve la protección de datos de nadie, esas columnas ni se ofrecen. */
  veProteccion: boolean;
  /** Columnas con las que se llega desde el botón «Informe» de otra pestaña. */
  preset: ClaveColumna[];
}) {
  const disponibles = useMemo(
    () => columnasDisponibles(materiales).filter((c) => veProteccion || c.grupo !== 'Protección de datos'),
    [materiales, veProteccion],
  );
  const [columnas, setColumnas] = useState<ClaveColumna[]>(() => (preset.length > 0 ? preset : ['banco']));
  const [ambito, setAmbito] = useState<Ambito>(claseActual ? 'actual' : 'todas');
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(claseActual ? [claveClase(claseActual)] : []));
  const [filtro, setFiltro] = useState('');
  const [titulo, setTitulo] = useState('');
  const [paginaPorClase, setPaginaPorClase] = useState(false);
  const [descargando, setDescargando] = useState<Formato | null>(null);

  const porGrupo = useMemo(() => {
    const mapa = new Map<string, ColumnaInforme[]>();
    for (const c of disponibles) mapa.set(c.grupo, [...(mapa.get(c.grupo) ?? []), c]);
    return mapa;
  }, [disponibles]);

  const filtrables = disponibles.filter((c) => columnas.includes(c.clave) && c.valores.length > 0);

  const alternar = (clave: ClaveColumna) => {
    haptic.tap();
    setColumnas((prev) => (prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]));
  };

  const clasesDelInforme =
    ambito === 'actual' && claseActual
      ? [claseActual]
      : ambito === 'elegir'
        ? clases.filter((c) => elegidas.has(claveClase(c)))
        : clases;
  const alumnosDelInforme = clasesDelInforme.reduce((n, c) => n + c.alumnos, 0);

  async function descargar(formato: Formato) {
    if (columnas.length === 0) return toast.error('Elige al menos una columna');
    if (clasesDelInforme.length === 0) return toast.error('Elige al menos una clase');
    haptic.tap();
    setDescargando(formato);
    try {
      const params = new URLSearchParams({
        formato,
        clases: ambito === 'todas' ? '' : clasesDelInforme.map(claveClase).join(','),
        // Se respeta el orden de la lista de columnas, no el de los toques.
        columnas: disponibles.filter((c) => columnas.includes(c.clave)).map((c) => c.clave).join(','),
        filtro: filtrables.some((c) => filtro.startsWith(`${c.clave}:`)) ? filtro : '',
        titulo,
        paginaPorClase: paginaPorClase ? '1' : '0',
      });
      const res = await fetch(`/api/alumnado/informe?${params}`);
      if (!res.ok) {
        const datos = await res.json().catch(() => ({}));
        throw new Error(datos.error ?? 'No se pudo sacar el informe');
      }
      const nombre =
        /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `informe.${formato}`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      haptic.success();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo sacar el informe');
    } finally {
      setDescargando(null);
    }
  }

  const chip = (puesto: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
      puesto
        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
    }`;

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Informe a medida</p>
        <p className="text-xs text-zinc-500">
          Elige qué columnas quieres, de qué clases, y sácalo en PDF, Excel o CSV.
        </p>
      </div>

      {/* ── 1. Columnas ── */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">1 · Qué columnas</p>
        {[...porGrupo.entries()].map(([grupo, cols]) => (
          <div key={grupo} className="flex flex-wrap items-center gap-1">
            <span className="mr-1 w-full text-[11px] text-zinc-400 sm:w-36">{grupo}</span>
            {cols.map((c) => (
              <button key={c.clave} type="button" onClick={() => alternar(c.clave)} className={chip(columnas.includes(c.clave))}>
                {c.titulo}
              </button>
            ))}
          </div>
        ))}
        {materiales.length === 0 && (
          <p className="text-[11px] text-zinc-400">Los materiales a la venta aparecerán aquí en cuanto se cree alguno.</p>
        )}
      </section>

      {/* ── 2. Clases ── */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">2 · De qué clases</p>
        <div className="flex flex-wrap gap-1">
          {claseActual && (
            <button type="button" onClick={() => setAmbito('actual')} className={chip(ambito === 'actual')}>
              {claseActual.clase}
            </button>
          )}
          <button type="button" onClick={() => setAmbito('todas')} className={chip(ambito === 'todas')}>
            Todas las que veo ({clases.length})
          </button>
          <button type="button" onClick={() => setAmbito('elegir')} className={chip(ambito === 'elegir')}>
            Elegir clases…
          </button>
        </div>
        {ambito === 'elegir' && (
          <div className="flex flex-wrap gap-1 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/40">
            {clases.map((c) => {
              const k = claveClase(c);
              const puesta = elegidas.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    haptic.tap();
                    setElegidas((prev) => {
                      const s = new Set(prev);
                      if (puesta) s.delete(k);
                      else s.add(k);
                      return s;
                    });
                  }}
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    puesta ? 'bg-blue-600 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700'
                  }`}
                >
                  {c.clase}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3. Opciones ── */}
      <section className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">3 · Solo quien…</span>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Todo el mundo</option>
            {filtrables.map((c) => (
              <optgroup key={c.clave} label={c.titulo}>
                {c.valores.map((v) => (
                  <option key={v.clave} value={`${c.clave}:${v.clave}`}>
                    {c.titulo}: {v.texto}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Título (opcional)</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            placeholder="Se pone solo con las columnas elegidas"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
      </section>
      {clasesDelInforme.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={paginaPorClase} onChange={(e) => setPaginaPorClase(e.target.checked)} className="h-4 w-4" />
          En el PDF, cada clase en su página (para repartir a los tutores)
        </label>
      )}

      {/* ── 4. Formato ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <p className="mr-auto text-xs text-zinc-500">
          {clasesDelInforme.length} {clasesDelInforme.length === 1 ? 'clase' : 'clases'} · hasta {alumnosDelInforme} alumnos ·{' '}
          {columnas.length} {columnas.length === 1 ? 'columna' : 'columnas'}
        </p>
        {(
          [
            { f: 'pdf' as const, texto: 'PDF', icono: <FileText className="h-3.5 w-3.5" />, principal: true },
            { f: 'xlsx' as const, texto: 'Excel', icono: <FileSpreadsheet className="h-3.5 w-3.5" />, principal: false },
            { f: 'csv' as const, texto: 'CSV', icono: <FileDown className="h-3.5 w-3.5" />, principal: false },
          ]
        ).map((b) => (
          <button
            key={b.f}
            type="button"
            disabled={descargando !== null}
            onClick={() => void descargar(b.f)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
              b.principal
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {descargando === b.f ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : b.icono} {b.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
