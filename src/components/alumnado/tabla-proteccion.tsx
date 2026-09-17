'use client';

// La pantalla de protección de datos: quién puede salir en fotos y quién ha devuelto el
// documento Prodat, de un vistazo y para un centro entero.
//
// Es la pantalla de la dirección, y por eso está montada alrededor de tres preguntas reales,
// no alrededor de la tabla:
//
//   «¿quién NO puede salir?»            → un vistazo, y el PDF que se lleva a la reunión
//   «¿a quién no ha mirado nadie?»      → otro vistazo
//   «¿a quién le falta el Prodat?»      → otro
//
// De ahí el orden de arriba abajo: primero los cuatro CONTADORES (que son a la vez el
// filtro, porque el número y el filtro son la misma pregunta), luego el ÁMBITO —etapa de un
// clic, clase a dos, que es lo raro— y por último la tabla, que es donde se trabaja.
//
// El orden de las filas (etapa → clase → nº de lista → apellidos) lo pone el servidor una
// sola vez y lo respetan igual la tabla y el PDF: dos ordenaciones distintas del mismo
// listado es lo que hace que alguien deje de fiarse del papel.

import { useMemo, useState } from 'react';
import { Check, ChevronDown, FileDown, Loader2, Minus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  agruparPorClase,
  CAMPOS_PROTECCION,
  casaBusqueda,
  casaFiltroProteccion,
  cuentaProteccion,
  FILTRO_LABELS,
  FILTROS_PROTECCION,
  PROTECCION_LABELS,
  textoPermiso,
  type CampoProteccion,
  type FiltroProteccion,
} from '@/lib/alumnado';
import type { AlumnoLista, ClaseListado, ProteccionLista } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';

type Estado = boolean | null;

/** El ciclo de un toque. Vuelve a «sin marcar» al final, que también es una respuesta útil. */
const SIGUIENTE: Record<string, Estado> = { true: false, false: null, null: true };

const CELDA: Record<string, string> = {
  true: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60',
  false: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60',
  null: 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700',
};

const ICONO: Record<string, React.ReactNode> = {
  true: <Check className="h-4 w-4" />,
  false: <X className="h-4 w-4" />,
  null: <Minus className="h-4 w-4" />,
};

const VISTAZO_TONO: Record<FiltroProteccion, { puesto: string; suelto: string; numero: string }> = {
  todos: {
    puesto: 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
    suelto: 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800',
    numero: 'text-zinc-900 dark:text-zinc-100',
  },
  'sin-fotos': {
    puesto: 'bg-red-600 text-white',
    suelto: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 dark:bg-zinc-900 dark:text-red-300 dark:ring-red-900/60 dark:hover:bg-red-950/40',
    numero: 'text-red-600 dark:text-red-400',
  },
  'sin-marcar': {
    puesto: 'bg-amber-500 text-white',
    suelto: 'bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-300 dark:ring-amber-900/60 dark:hover:bg-amber-950/40',
    numero: 'text-amber-600 dark:text-amber-400',
  },
  'sin-prodat': {
    puesto: 'bg-blue-600 text-white',
    suelto: 'bg-white text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50 dark:bg-zinc-900 dark:text-blue-300 dark:ring-blue-900/60 dark:hover:bg-blue-950/40',
    numero: 'text-blue-600 dark:text-blue-400',
  },
};

const ETAPAS = [
  { id: 'EI' as const, texto: 'Infantil' },
  { id: 'EP' as const, texto: 'Primaria' },
  { id: 'ESO' as const, texto: 'Secundaria' },
];

type Cambios = Partial<Record<CampoProteccion, Estado>>;

export function PanelProteccion({
  alumnos,
  clases,
  puedeEditar,
  onCambio,
}: {
  /** Todo lo que alcanza quien mira. Los filtros de esta pantalla son suyos, no del panel. */
  alumnos: AlumnoLista[];
  clases: ClaseListado[];
  puedeEditar: boolean;
  onCambio: (filas: (ProteccionLista & { id: string })[]) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroProteccion>('todos');
  const [etapa, setEtapa] = useState<'EI' | 'EP' | 'ESO' | null>(null);
  const [clase, setClase] = useState<string | null>(null);
  // Las clases van a dos clics a propósito: el 90% de las veces se trabaja por etapa o con
  // el centro entero, y 28 chips permanentes dejarían la tabla bajo el pliegue.
  const [verClases, setVerClases] = useState(false);
  const [termino, setTermino] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  // Solo se trabaja con alumnado cuya protección de datos le toca a quien mira. Lo demás no
  // es que se esconda: es que ni siquiera ha llegado del servidor.
  const suyos = useMemo(() => alumnos.filter((a) => a.proteccion), [alumnos]);

  const delAmbito = useMemo(
    () =>
      suyos.filter((a) => {
        if (clase) return `${a.curso}|${a.letra ?? ''}` === clase;
        if (etapa) return a.etapa === etapa;
        return true;
      }),
    [suyos, clase, etapa],
  );

  // Los contadores son del ÁMBITO, no del centro entero: «3 sin marcar» mirando Primaria
  // tiene que querer decir tres en Primaria.
  const cuenta = useMemo(() => cuentaProteccion(delAmbito), [delAmbito]);

  const buscando = termino.trim().length >= 2;
  const visibles = useMemo(() => {
    const porFiltro = delAmbito.filter((a) => casaFiltroProteccion(a.proteccion, filtro));
    return buscando ? porFiltro.filter((a) => casaBusqueda(a.busca, termino)) : porFiltro;
  }, [delAmbito, filtro, buscando, termino]);

  const grupos = useMemo(() => agruparPorClase(visibles), [visibles]);
  const claseActual = clases.find((c) => `${c.curso}|${c.letra ?? ''}` === clase);
  const ambito = claseActual ? claseActual.clase : etapa ? ETAPAS.find((e) => e.id === etapa)!.texto : 'Todo el centro';

  async function guardar(clave: string, ids: string[], cambios: Cambios) {
    if (ids.length === 0) return;
    haptic.tap();
    setGuardando(clave);
    try {
      const res = await fetch('/api/alumnado/proteccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eduStudentIds: ids, cambios }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      onCambio(datos.filas as (ProteccionLista & { id: string })[]);
      haptic.success();
      if (ids.length > 1) toast.success(`${ids.length} alumnos actualizados`);
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(null);
      setConfirmando(null);
    }
  }

  /** Lo masivo siempre pide un segundo toque, y en él dice a cuántos va. */
  function masivo(clave: string, cambios: Cambios) {
    if (confirmando !== clave) {
      haptic.tap();
      setConfirmando(clave);
      return;
    }
    void guardar(
      clave,
      visibles.map((a) => a.id),
      cambios,
    );
  }

  function urlPdf(porEtapa: boolean): string {
    const p = new URLSearchParams();
    if (clase) p.set('clase', clase);
    else if (etapa) p.set('etapa', etapa);
    if (filtro !== 'todos') p.set('filtro', filtro);
    if (porEtapa) p.set('porEtapa', '1');
    return `/api/alumnado/proteccion/pdf?${p.toString()}`;
  }

  if (suyos.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        Aquí no hay ningún alumno cuya protección de datos te toque. Un tutor solo ve la de su propia tutoría.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── 1 · Los cuatro vistazos. El número ES el filtro ───────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTROS_PROTECCION.map((f) => {
          const puesto = filtro === f;
          const tono = VISTAZO_TONO[f];
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                haptic.tap();
                setFiltro(f);
              }}
              className={`rounded-2xl px-3 py-2.5 text-left transition-colors ${puesto ? tono.puesto : tono.suelto}`}
            >
              <span className={`block text-xl font-semibold leading-none ${puesto ? '' : tono.numero}`}>
                {cuenta[f]}
              </span>
              <span className={`mt-1 block text-xs ${puesto ? 'opacity-90' : 'opacity-80'}`}>
                {FILTRO_LABELS[f].corto}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 2 · El ámbito: etapa a un clic, clase a dos ───────────────── */}
      <div className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <Ambito
            texto="Todo el centro"
            puesto={!etapa && !clase}
            onClick={() => {
              setEtapa(null);
              setClase(null);
            }}
          />
          {ETAPAS.filter((e) => clases.some((c) => c.etapa === e.id)).map((e) => (
            <Ambito
              key={e.id}
              texto={e.texto}
              puesto={etapa === e.id && !clase}
              onClick={() => {
                setEtapa(etapa === e.id && !clase ? null : e.id);
                setClase(null);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              haptic.tap();
              setVerClases((v) => !v);
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {claseActual ? claseActual.clase : 'Por clases'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verClases ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {verClases && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            {clases
              .filter((c) => !etapa || c.etapa === etapa)
              .map((c) => {
                const k = `${c.curso}|${c.letra ?? ''}`;
                const puesta = clase === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      haptic.tap();
                      setClase(puesta ? null : k);
                      if (!puesta && c.etapa) setEtapa(c.etapa as 'EI' | 'EP' | 'ESO');
                    }}
                    className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      puesta
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {c.clase}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* ── 3 · Buscar, masivos y papel ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder={`Buscar en ${ambito.toLowerCase()}…`}
            aria-label="Buscar alumnado en esta vista"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-blue-900/40"
          />
        </div>

        {/* El PDF sale del ÁMBITO y del filtro, no de la búsqueda: un papel que depende de
            lo que hubiera escrito en una caja no lo entiende nadie dos días después. */}
        <a
          href={urlPdf(false)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <FileDown className="h-3.5 w-3.5" /> PDF
        </a>
        {!clase && (
          <a
            href={urlPdf(true)}
            title="Un PDF con cada etapa en su propia hoja"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <FileDown className="h-3.5 w-3.5" /> por etapas
          </a>
        )}
      </div>

      {puedeEditar && visibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mr-auto text-xs text-zinc-500">
            A los <span className="font-medium text-zinc-700 dark:text-zinc-200">{visibles.length}</span> de esta vista:
          </p>
          <BotonMasivo
            clave="fotos-si"
            confirmando={confirmando}
            guardando={guardando}
            texto="Fotos: todos SÍ"
            confirmacion={`Sí, a los ${visibles.length}`}
            tono="verde"
            onClick={() => masivo('fotos-si', { imagen: true })}
          />
          <BotonMasivo
            clave="fotos-no"
            confirmando={confirmando}
            guardando={guardando}
            texto="Fotos: todos NO"
            confirmacion={`Sí, a los ${visibles.length}`}
            tono="rojo"
            onClick={() => masivo('fotos-no', { imagen: false })}
          />
          <BotonMasivo
            clave="prodat-si"
            confirmando={confirmando}
            guardando={guardando}
            texto="Prodat: recibido"
            confirmacion={`Sí, a los ${visibles.length}`}
            onClick={() => masivo('prodat-si', { prodat: true })}
          />
        </div>
      )}

      {/* ── 4 · La tabla, agrupada por clase ──────────────────────────── */}
      {visibles.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {filtro === 'sin-fotos'
            ? `Nadie sin permiso de fotos en ${ambito.toLowerCase()}. 🎉`
            : `No hay nadie aquí con ese filtro${buscando ? ' y esa búsqueda' : ''}.`}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-10 bg-white dark:bg-zinc-900">
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
                {CAMPOS_PROTECCION.map((campo) => (
                  <th key={campo} className="w-24 p-2 align-bottom">
                    <span className="block text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {PROTECCION_LABELS[campo].titulo}
                    </span>
                    {puedeEditar && (
                      // El masivo por columna, donde se está mirando la columna.
                      <span className="mt-1 flex justify-center gap-0.5">
                        <ColumnaBoton
                          activa={confirmando === `${campo}-si`}
                          ocupada={guardando === `${campo}-si`}
                          tono="verde"
                          titulo={`Poner «${PROTECCION_LABELS[campo].titulo}» a sí en los ${visibles.length} de esta vista`}
                          onClick={() => masivo(`${campo}-si`, { [campo]: true })}
                        >
                          <Check className="h-3 w-3" />
                        </ColumnaBoton>
                        <ColumnaBoton
                          activa={confirmando === `${campo}-no`}
                          ocupada={guardando === `${campo}-no`}
                          tono="rojo"
                          titulo={`Poner «${PROTECCION_LABELS[campo].titulo}» a no en los ${visibles.length} de esta vista`}
                          onClick={() => masivo(`${campo}-no`, { [campo]: false })}
                        >
                          <X className="h-3 w-3" />
                        </ColumnaBoton>
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo) => (
                <Grupo
                  key={grupo.clase}
                  grupo={grupo}
                  unaSola={grupos.length === 1}
                  puedeEditar={puedeEditar}
                  guardando={guardando}
                  onCelda={(alumno, campo, valor) => guardar(`${alumno.id}-${campo}`, [alumno.id], { [campo]: valor })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-1 pb-2 text-xs text-zinc-400">
        Cada casilla cicla <strong className="font-medium text-emerald-600 dark:text-emerald-400">sí</strong> →{' '}
        <strong className="font-medium text-red-600 dark:text-red-400">no</strong> → sin marcar.{' '}
        {puedeEditar
          ? 'Lo que cambia una casilla cambia también en la ficha del alumno: es el mismo dato.'
          : 'Aquí solo miras: esto lo cambian secretaría, dirección o TIC.'}
      </p>
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

function Grupo({
  grupo,
  unaSola,
  puedeEditar,
  guardando,
  onCelda,
}: {
  grupo: { clase: string; alumnos: AlumnoLista[] };
  unaSola: boolean;
  puedeEditar: boolean;
  guardando: string | null;
  onCelda: (alumno: AlumnoLista, campo: CampoProteccion, valor: Estado) => void;
}) {
  return (
    <>
      {/* Con una sola clase a la vista, su nombre ya está arriba: una fila de cabecera que
          repite lo que pone en el filtro es ruido. */}
      {!unaSola && (
        <tr className="bg-zinc-50 dark:bg-zinc-800/50">
          <td colSpan={CAMPOS_PROTECCION.length + 1} className="px-2 py-1.5">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{grupo.clase}</span>
            <span className="ml-2 text-xs text-zinc-400">{grupo.alumnos.length}</span>
          </td>
        </tr>
      )}
      {grupo.alumnos.map((a) => (
        <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
          <td className="max-w-0 truncate p-2 text-zinc-800 dark:text-zinc-100">
            {a.numero !== null && <span className="mr-1.5 text-xs text-zinc-400">{a.numero}</span>}
            {a.completo}
          </td>
          {CAMPOS_PROTECCION.map((campo) => (
            <td key={campo} className="p-1 text-center">
              <Celda
                valor={a.proteccion![campo]}
                editable={puedeEditar}
                ocupada={guardando === `${a.id}-${campo}`}
                etiqueta={`${PROTECCION_LABELS[campo].titulo} de ${a.completo}`}
                onTocar={() => onCelda(a, campo, SIGUIENTE[String(a.proteccion![campo])])}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Ambito({ texto, puesto, onClick }: { texto: string; puesto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        puesto
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
      }`}
    >
      {texto}
    </button>
  );
}

function Celda({
  valor,
  editable,
  ocupada,
  etiqueta,
  onTocar,
}: {
  valor: Estado;
  editable: boolean;
  ocupada: boolean;
  etiqueta: string;
  onTocar: () => void;
}) {
  const clave = String(valor);
  const contenido = ocupada ? <Loader2 className="h-4 w-4 animate-spin" /> : ICONO[clave];
  if (!editable) {
    return (
      <span
        aria-label={`${etiqueta}: ${textoPermiso(valor)}`}
        className={`pointer-events-none inline-flex h-8 w-9 items-center justify-center rounded-lg ${CELDA[clave]}`}
      >
        {contenido}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onTocar}
      disabled={ocupada}
      aria-label={`${etiqueta}: ${textoPermiso(valor)}`}
      title={etiqueta}
      className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition-colors disabled:opacity-60 ${CELDA[clave]}`}
    >
      {contenido}
    </button>
  );
}

function ColumnaBoton({
  activa,
  ocupada,
  tono,
  titulo,
  onClick,
  children,
}: {
  activa: boolean;
  ocupada: boolean;
  tono: 'verde' | 'rojo';
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    tono === 'verde'
      ? 'text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950'
      : 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950';
  const puesta = tono === 'verde' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupada}
      title={activa ? `${titulo} · toca otra vez para confirmar` : titulo}
      aria-label={titulo}
      className={`inline-flex h-6 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-60 ${
        activa ? puesta : base
      }`}
    >
      {ocupada ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

function BotonMasivo({
  clave,
  confirmando,
  guardando,
  texto,
  confirmacion,
  tono = 'neutro',
  onClick,
}: {
  clave: string;
  confirmando: string | null;
  guardando: string | null;
  texto: string;
  confirmacion: string;
  tono?: 'verde' | 'rojo' | 'neutro';
  onClick: () => void;
}) {
  const activa = confirmando === clave;
  const ocupada = guardando === clave;
  const colores =
    tono === 'verde'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : tono === 'rojo'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupada}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${
        activa ? 'bg-amber-500 text-white hover:bg-amber-600' : colores
      }`}
    >
      {ocupada && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {activa ? confirmacion : texto}
    </button>
  );
}
