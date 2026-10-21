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
import { FileDown, FileSpreadsheet, FileText, Loader2, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';
import { columnasDisponibles, type ClaveColumna, type ColumnaInforme } from '@/lib/alumnado-informe';
import { TIPO_LISTA_LABEL, type TipoLista } from '@/lib/alumnado-listas';
import type { ClaseListado, MaterialLista } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';

type Formato = 'pdf' | 'xlsx' | 'csv';
type Ambito = 'actual' | 'todas' | 'elegir';

const claveClase = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

/** Descarga lo que devuelva `url` con el nombre que diga el servidor. */
async function descargarFichero(url: string, porDefecto: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const datos = await res.json().catch(() => ({}));
    throw new Error(datos.error ?? 'No se pudo descargar');
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? porDefecto;
  const enlace = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = enlace;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(enlace), 30_000);
}

const ICONO_LISTA: Record<TipoLista, React.ReactNode> = {
  lista: <FileSpreadsheet className="h-4 w-4" />,
  alumnado: <Mail className="h-4 w-4" />,
  familias: <Users className="h-4 w-4" />,
};

/**
 * Tres Excel de un toque para la clase que se tiene delante (Jose Miguel, 16-oct-2026): la
 * lista de clase de siempre —la misma que saca el cuaderno de tutor— y dos cortas solo con
 * los correos del alumnado o de las familias. Sin clase elegida, de todas las que se ven.
 */
function ListasRapidas({ clases, claseActual }: { clases: ClaseListado[]; claseActual: ClaseListado | null }) {
  const [bajando, setBajando] = useState<TipoLista | null>(null);
  const ambito = claseActual ? claseActual.clase : clases.length === 1 ? clases[0].clase : `las ${clases.length} clases que ves`;

  async function bajar(tipo: TipoLista) {
    haptic.tap();
    setBajando(tipo);
    try {
      const params = new URLSearchParams({ tipo, clases: claseActual ? claveClase(claseActual) : '' });
      await descargarFichero(`/api/alumnado/lista?${params}`, 'lista.xlsx');
      haptic.success();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar la lista');
    } finally {
      setBajando(null);
    }
  }

  if (clases.length === 0) return null;
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Listas rápidas · {ambito}</p>
        <p className="text-xs text-zinc-500">
          En Excel, una pestaña por clase.{' '}
          {!claseActual && clases.length > 1 && 'Elige una clase arriba para sacar solo esa.'}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(TIPO_LISTA_LABEL) as TipoLista[]).map((tipo) => (
          <button
            key={tipo}
            type="button"
            disabled={bajando !== null}
            onClick={() => void bajar(tipo)}
            className="flex min-h-11 items-start gap-2.5 rounded-xl bg-zinc-50 p-3 text-left ring-1 ring-zinc-200 transition-colors outline-none hover:bg-blue-50 hover:ring-blue-200 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-zinc-800/50 dark:ring-zinc-700 dark:hover:bg-blue-950/40 dark:hover:ring-blue-900"
          >
            <span className="mt-0.5 text-blue-600 dark:text-blue-400">
              {bajando === tipo ? <Loader2 className="h-4 w-4 animate-spin" /> : ICONO_LISTA[tipo]}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{TIPO_LISTA_LABEL[tipo].titulo}</span>
              <span className="block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{TIPO_LISTA_LABEL[tipo].ayuda}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Informes({
  clases,
  claseActual,
  materiales,
  veProteccion,
  preset,
  presetFiltro = '',
}: {
  clases: ClaseListado[];
  /** La clase elegida en el carril, si la hay: es el ámbito por defecto. */
  claseActual: ClaseListado | null;
  materiales: MaterialLista[];
  /** Si no ve la protección de datos de nadie, esas columnas ni se ofrecen. */
  veProteccion: boolean;
  /** Columnas con las que se llega desde el botón «Informe» de otra pestaña. */
  preset: ClaveColumna[];
  /** Y el filtro, si llega con uno («comedor:si» desde «Lista del comedor»). */
  presetFiltro?: string;
}) {
  const disponibles = useMemo(
    () => columnasDisponibles(materiales).filter((c) => veProteccion || c.grupo !== 'Protección de datos'),
    [materiales, veProteccion],
  );
  const [columnas, setColumnas] = useState<ClaveColumna[]>(() => (preset.length > 0 ? preset : ['banco']));
  const [ambito, setAmbito] = useState<Ambito>(claseActual ? 'actual' : 'todas');
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(claseActual ? [claveClase(claseActual)] : []));
  const [filtro, setFiltro] = useState(presetFiltro);
  const [titulo, setTitulo] = useState('');
  // Por defecto un folio por clase: es lo que se reparte a cada tutor.
  const [paginaPorClase, setPaginaPorClase] = useState(true);
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
      await descargarFichero(`/api/alumnado/informe?${params}`, `informe.${formato}`);
      haptic.success();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo sacar el informe');
    } finally {
      setDescargando(null);
    }
  }

  return (
    <>
      <ListasRapidas clases={clases} claseActual={claseActual} />
      <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Informe a medida</p>
          <p className="text-xs text-zinc-500">
            Elige qué columnas quieres, de qué clases, y sácalo en PDF, Excel o CSV.
          </p>
        </div>

        {/* ── 1. Columnas ── */}
        <section className="space-y-2">
          <Rotulo as="p">1 · Qué columnas</Rotulo>
          {[...porGrupo.entries()].map(([grupo, cols]) => (
            <Filtros key={grupo} etiqueta={grupo} className="gap-1.5">
              <span className="mr-1 w-full text-xs text-zinc-500 sm:w-36 dark:text-zinc-400">{grupo}</span>
              {cols.map((c) => (
                <Filtro key={c.clave} activo={columnas.includes(c.clave)} onClick={() => alternar(c.clave)}>
                  {c.titulo}
                </Filtro>
              ))}
            </Filtros>
          ))}
          {materiales.length === 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Los materiales a la venta aparecerán aquí en cuanto se cree alguno.</p>
          )}
        </section>

        {/* ── 2. Clases ── */}
        <section className="space-y-2">
          <Rotulo as="p">2 · De qué clases</Rotulo>
          <Segmentado<Ambito>
            etiqueta="De qué clases"
            valor={ambito}
            onChange={setAmbito}
            opciones={[
              ...(claseActual ? [{ valor: 'actual' as const, etiqueta: claseActual.clase }] : []),
              { valor: 'todas', etiqueta: `Todas las que veo (${clases.length})` },
              { valor: 'elegir', etiqueta: 'Elegir clases…' },
            ]}
          />
          {ambito === 'elegir' && (
            <Filtros etiqueta="Clases del informe" className="gap-1.5 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/40">
              {clases.map((c) => {
                const k = claveClase(c);
                const puesta = elegidas.has(k);
                return (
                  <Filtro
                    key={k}
                    activo={puesta}
                    onClick={() => {
                      setElegidas((prev) => {
                        const s = new Set(prev);
                        if (puesta) s.delete(k);
                        else s.add(k);
                        return s;
                      });
                    }}
                  >
                    {c.clase}
                  </Filtro>
                );
              })}
            </Filtros>
          )}
        </section>

        {/* ── 3. Opciones ── */}
        <section className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <Rotulo as="p">3 · Solo quien…</Rotulo>
            <Selector value={filtro} onChange={(e) => setFiltro(e.target.value)}>
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
            </Selector>
          </label>
          <label className="space-y-1">
            <Rotulo as="p">Título (opcional)</Rotulo>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              placeholder="Se pone solo con las columnas elegidas"
            />
          </label>
        </section>
        {clasesDelInforme.length > 1 && (
          <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={paginaPorClase} onChange={(e) => setPaginaPorClase(e.target.checked)} className="h-4 w-4" />
            En el PDF, un folio por clase con sus tutores (para entregar a cada tutor)
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
              { f: 'pdf' as const, texto: 'PDF', icono: <FileText aria-hidden />, principal: true },
              { f: 'xlsx' as const, texto: 'Excel', icono: <FileSpreadsheet aria-hidden />, principal: false },
              { f: 'csv' as const, texto: 'CSV', icono: <FileDown aria-hidden />, principal: false },
            ]
          ).map((b) => (
            <Button
              key={b.f}
              type="button"
              variant={b.principal ? 'default' : 'outline'}
              disabled={descargando !== null}
              onClick={() => void descargar(b.f)}
            >
              {descargando === b.f ? <Loader2 className="animate-spin" /> : b.icono} {b.texto}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
