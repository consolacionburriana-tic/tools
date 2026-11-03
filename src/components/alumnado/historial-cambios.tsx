'use client';

// El libro de cambios de Alumnado (docs/31-auditoria.md): quién marcó qué, cuándo, y volver atrás.
//
// Dos niveles, porque David no sabía si restaurar «por clase o por persona» y lo mejor es no
// elegir: la lista agrupa por CAMBIO (un clic, aunque tocara a 600 alumnos) y se puede deshacer
// entero; al abrirlo salen las líneas una a una y se restaura la que haga falta. Y en la ficha de
// cada alumno está su historial suelto. Lo que viene de Educamos se anota y no se restaura.

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  CAMPO_LABEL,
  GRUPO_LABEL,
  ORIGEN_LABEL,
  codigoATexto,
  type CampoAuditado,
  type GrupoAuditoria,
  type OrigenCambio,
} from '@/lib/auditoria';
import type { EntradaHistorial, LoteResumen } from '@/lib/auditoria-server';
import { haptic } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { useConfirmar } from '@/components/ui/confirmar';
import { Vacio } from '@/components/ui/vacio';

const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const quien = (por: string | null) => (por ? por.split('@')[0] : 'El sistema');
const campoLabel = (c: string) => CAMPO_LABEL[c as CampoAuditado] ?? c;

/** «Ana Pérez, Luis Gil y 22 más». */
function quienes(l: Pick<LoteResumen, 'alumnos' | 'muestra'>) {
  if (l.alumnos <= l.muestra.length) return l.muestra.join(', ');
  return `${l.muestra.slice(0, 2).join(', ')} y ${l.alumnos - 2} más`;
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error ?? 'No se pudo completar');
  return datos as T;
}

interface Resultado {
  restauradas: number;
  omitidas: { alumno: string; campo: string; motivo: string }[];
}

/** Restaura y cuenta lo que ha pasado, con lo que se saltó y por qué. */
async function restaurar(cuerpo: { ids: string[] } | { lote: string }): Promise<Resultado> {
  const r = await pedir<Resultado>('/api/alumnado/historial/restaurar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  haptic.success();
  const saltadas = r.omitidas.length;
  if (r.restauradas === 0) {
    toast.warning(saltadas ? `No se ha restaurado nada: ${r.omitidas[0].motivo.toLowerCase()}` : 'No había nada que restaurar');
  } else {
    toast.success(
      `${r.restauradas} ${r.restauradas === 1 ? 'casilla restaurada' : 'casillas restauradas'}` +
        (saltadas ? ` · ${saltadas} sin tocar (ya cambiadas, o sin permiso)` : ''),
    );
  }
  return r;
}

// ─── Una línea ────────────────────────────────────────────────────────────────

function Linea({
  e,
  conAlumno,
  ocupada,
  onRestaurar,
}: {
  e: EntradaHistorial;
  conAlumno: boolean;
  ocupada: boolean;
  onRestaurar: (id: string) => void;
}) {
  const estado =
    e.origen === 'educamos' ? (
      <Estado tono="neutro">Solo registro</Estado>
    ) : e.restaurable ? null : e.yaRestaurado ? (
      <Estado tono="ok">Ya está como antes</Estado>
    ) : (
      <Estado tono="aviso" title="Alguien lo ha vuelto a cambiar después de este cambio">
        Cambiado después
      </Estado>
    );
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="min-w-0 flex-1">
        {conAlumno && (
          <span className="mr-2 font-medium text-zinc-800 dark:text-zinc-100">
            {e.alumno} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{e.clase}</span>
          </span>
        )}
        <span className="text-zinc-600 dark:text-zinc-300">
          {campoLabel(e.campo)}: {codigoATexto(e.campo, e.antes)} → <strong className="font-medium">{codigoATexto(e.campo, e.despues)}</strong>
        </span>
        {!conAlumno && (
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            {cuando(e.at)} · {quien(e.por)} · {ORIGEN_LABEL[e.origen as OrigenCambio] ?? e.origen}
          </span>
        )}
      </span>
      {estado}
      {e.restaurable && (
        <Button type="button" variant="outline" size="sm" disabled={ocupada} onClick={() => onRestaurar(e.id)}>
          {ocupada ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Restaurar
        </Button>
      )}
    </li>
  );
}

// ─── Un cambio (lote) ─────────────────────────────────────────────────────────

function Lote({ lote, alCambiar }: { lote: LoteResumen; alCambiar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<EntradaHistorial[] | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();
  const deEducamos = lote.origen === 'educamos';

  const cargar = useCallback(async () => {
    try {
      setEntradas((await pedir<{ entradas: EntradaHistorial[] }>(`/api/alumnado/historial?lote=${lote.lote}`)).entradas);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar');
    }
  }, [lote.lote]);

  async function alternar() {
    haptic.tap();
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente && !entradas) await cargar();
  }

  async function hacer(clave: string, cuerpo: { ids: string[] } | { lote: string }) {
    setOcupada(clave);
    try {
      await restaurar(cuerpo);
      await cargar();
      alCambiar();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo restaurar');
    } finally {
      setOcupada(null);
    }
  }

  async function deshacerTodo() {
    const ok = await confirmar({
      titulo: `¿Deshacer este cambio entero?`,
      descripcion: `Las ${lote.filas} ${lote.filas === 1 ? 'casilla' : 'casillas'} de ${lote.alumnos} ${lote.alumnos === 1 ? 'alumno' : 'alumnos'} vuelven a como estaban antes. Las que alguien haya vuelto a tocar después se dejan como están.`,
      boton: 'Sí, deshacer',
      peligro: false,
    });
    if (ok) await hacer('lote', { lote: lote.lote });
  }

  const campos = lote.campos.map(campoLabel).join(', ');
  return (
    <li className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={abierto}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {abierto ? <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0 text-zinc-400" /> : <ChevronRight aria-hidden className="mt-0.5 size-4 shrink-0 text-zinc-400" />}
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {deEducamos ? 'Sincronización con Educamos' : campos}
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              {cuando(lote.at)} · {quien(lote.por)} · {quienes(lote)}
              {lote.clases.length > 0 && ` · ${lote.clases.length <= 2 ? lote.clases.join(' y ') : `${lote.clases.length} clases`}`}
            </span>
          </span>
        </button>
        <Etiqueta>{ORIGEN_LABEL[lote.origen as OrigenCambio] ?? lote.origen}</Etiqueta>
        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {lote.filas} {lote.filas === 1 ? 'cambio' : 'cambios'}
        </span>
        {!deEducamos && (
          <Button type="button" variant="outline" size="sm" disabled={ocupada !== null} onClick={deshacerTodo}>
            {ocupada === 'lote' ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
            Deshacer todo
          </Button>
        )}
      </div>
      {abierto && (
        <div className="border-t border-zinc-100 px-3.5 pb-2 dark:border-zinc-800">
          {!entradas ? (
            <p className="py-3 text-sm text-zinc-500">Cargando…</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entradas.slice(0, 300).map((e) => (
                <Linea key={e.id} e={e} conAlumno ocupada={ocupada === e.id} onRestaurar={(id) => hacer(id, { ids: [id] })} />
              ))}
              {entradas.length > 300 && (
                <li className="py-2 text-xs text-zinc-500">Y {entradas.length - 300} líneas más (se ven en la ficha de cada alumno).</li>
              )}
            </ul>
          )}
        </div>
      )}
      {dialogo}
    </li>
  );
}

// ─── La pestaña ───────────────────────────────────────────────────────────────

type FiltroGrupo = 'todos' | GrupoAuditoria;

export function HistorialCambios() {
  const [grupo, setGrupo] = useState<FiltroGrupo>('todos');
  const [lotes, setLotes] = useState<LoteResumen[] | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `recarga` cambia cuando se restaura algo: vuelve a pedir la lista sin tocar el filtro.
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    const q = grupo === 'todos' ? '' : `?grupo=${grupo}`;
    pedir<{ lotes: LoteResumen[] }>(`/api/alumnado/historial${q}`)
      .then(({ lotes: l }) => {
        if (!vivo) return;
        setError(null);
        setLotes(l);
        setHayMas(l.length >= 40);
      })
      .catch((e) => {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar');
        setLotes([]);
      });
    return () => {
      vivo = false;
    };
  }, [grupo, recarga]);

  async function verMas() {
    if (!lotes?.length) return;
    setCargandoMas(true);
    try {
      const q = new URLSearchParams({ antesDe: lotes[lotes.length - 1].at });
      if (grupo !== 'todos') q.set('grupo', grupo);
      const { lotes: mas } = await pedir<{ lotes: LoteResumen[] }>(`/api/alumnado/historial?${q}`);
      setLotes([...lotes, ...mas]);
      setHayMas(mas.length >= 40);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white px-3.5 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
        Cada casilla que se marca en Alumnado queda aquí: quién, cuándo, cómo estaba y cómo quedó. Abre un cambio para ver
        alumno por alumno, y restaura uno o el cambio entero. Lo que llega de Educamos solo se anota.
      </div>

      <Filtros etiqueta="Mostrar">
        <Filtro activo={grupo === 'todos'} onClick={() => setGrupo('todos')}>Todo</Filtro>
        {(Object.keys(GRUPO_LABEL) as GrupoAuditoria[]).map((g) => (
          <Filtro key={g} activo={grupo === g} onClick={() => setGrupo(g)}>
            {GRUPO_LABEL[g]}
          </Filtro>
        ))}
      </Filtros>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {lotes === null ? (
        <p className="p-6 text-center text-sm text-zinc-500">Cargando…</p>
      ) : lotes.length === 0 && !error ? (
        <Vacio icono={<History />} titulo="Todavía no hay cambios anotados">
          Desde el 3-nov-2026 cada casilla que se marque en Alumnado deja aquí su línea.
        </Vacio>
      ) : (
        <ul className="space-y-2">
          {lotes.map((l) => (
            <Lote key={l.lote} lote={l} alCambiar={() => setRecarga((n) => n + 1)} />
          ))}
        </ul>
      )}
      {hayMas && (
        <div className="text-center">
          <Button type="button" variant="outline" size="sm" disabled={cargandoMas} onClick={verMas}>
            {cargandoMas && <Loader2 className="animate-spin" aria-hidden />} Ver más antiguos
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── El historial de UNA persona, dentro de su ficha ─────────────────────────

export function HistorialAlumno({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<EntradaHistorial[] | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setEntradas((await pedir<{ entradas: EntradaHistorial[] }>(`/api/alumnado/historial?alumno=${id}`)).entradas);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar');
    }
  }, [id]);

  async function restaurarUna(linea: string) {
    setOcupada(linea);
    try {
      await restaurar({ ids: [linea] });
      await cargar();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo restaurar');
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => {
          haptic.tap();
          const siguiente = !abierto;
          setAbierto(siguiente);
          if (siguiente) void cargar();
        }}
        className="flex min-h-11 w-full items-center gap-2 rounded-2xl px-3.5 text-left text-sm font-medium text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-200"
      >
        {abierto ? <ChevronDown aria-hidden className="size-4 text-zinc-400" /> : <ChevronRight aria-hidden className="size-4 text-zinc-400" />}
        <History aria-hidden className="size-4 text-zinc-400" />
        Historial de cambios de este alumno
      </button>
      {abierto && (
        <div className="border-t border-zinc-100 px-3.5 pb-2 dark:border-zinc-800">
          {!entradas ? (
            <p className="py-3 text-sm text-zinc-500">Cargando…</p>
          ) : entradas.length === 0 ? (
            <p className="py-3 text-sm text-zinc-500">Nada anotado todavía.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entradas.map((e) => (
                <Linea key={e.id} e={e} conAlumno={false} ocupada={ocupada === e.id} onRestaurar={restaurarUna} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
