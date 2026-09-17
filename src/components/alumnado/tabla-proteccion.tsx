'use client';

// La protección de datos de una clase entera, en una tabla.
//
// Por qué existe: la ficha sirve para consultar a UNA persona, pero llenar esto son 639
// alumnos × 5 casillas. A mano no lo hace nadie, así que la forma real de trabajar es la
// que pidió David: **poner todo a «sí» y luego ir marcando los noes**. Aquí eso son dos
// toques por clase, y cada «no» es un toque más sobre su celda.
//
// Tres decisiones de la pantalla:
//
//  1. **Cada celda cicla sí → no → no consta.** Un toque sobre lo que quieres cambiar, sin
//     menús: es lo que se puede hacer con el dedo repasando una lista de papel.
//  2. **Cada columna tiene su «todos sí» y su «todos no»** en la cabecera, que es lo que
//     David pidió por columna: entra una autorización nueva y se resuelve de un toque.
//  3. **Lo masivo se confirma**, y dice a cuántos va a afectar antes de hacerlo. Cambiar 25
//     fichas sin querer es un mal rato; el segundo toque cuesta medio segundo.

import { useState } from 'react';
import { Check, Loader2, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import { CAMPOS_PROTECCION, PROTECCION_LABELS, type CampoProteccion } from '@/lib/alumnado';
import type { AlumnoLista, ProteccionLista } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';

type Estado = boolean | null;

/** El ciclo de un toque. «No consta» es el final, no el principio: ya se parte de ahí. */
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

type Cambios = Partial<Record<CampoProteccion | 'firmada', Estado>>;

export function TablaProteccion({
  alumnos,
  ambito,
  puedeEditar,
  onCambio,
}: {
  /** Los que se ven ahora mismo: la clase elegida, o el resultado de la búsqueda. */
  alumnos: AlumnoLista[];
  /** Cómo se llama lo que hay delante («2º ESO B»), para que lo masivo diga a qué afecta. */
  ambito: string;
  puedeEditar: boolean;
  onCambio: (filas: (ProteccionLista & { id: string })[]) => void;
}) {
  const [guardando, setGuardando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const conPd = alumnos.filter((a) => a.proteccion);
  const sinPd = alumnos.length - conPd.length;

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

  /** Lo masivo pide un segundo toque, y en él dice a cuántos va. */
  function masivo(clave: string, cambios: Cambios) {
    if (confirmando !== clave) {
      haptic.tap();
      setConfirmando(clave);
      return;
    }
    void guardar(clave, conPd.map((a) => a.id), cambios);
  }

  if (conPd.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        Aquí no hay ningún alumno cuya protección de datos te toque. Un tutor solo ve la de su
        propia tutoría.
      </div>
    );
  }

  const todoSi: Cambios = { imagen: true, redes: true, ampa: true, ong: true };

  return (
    <div className="space-y-2">
      {puedeEditar && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mr-auto text-xs text-zinc-500">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{ambito}</span> · {conPd.length} alumnos
            {sinPd > 0 && <span className="text-zinc-400"> · {sinPd} fuera de tu tutoría</span>}
          </p>
          <BotonMasivo
            clave="todo-si"
            confirmando={confirmando}
            guardando={guardando}
            texto="Poner todo a SÍ"
            confirmacion={`Sí: ${conPd.length} alumnos × 4 permisos`}
            tono="verde"
            onClick={() => masivo('todo-si', todoSi)}
          />
          <BotonMasivo
            clave="firmadas"
            confirmando={confirmando}
            guardando={guardando}
            texto="Marcar firmadas"
            confirmacion={`Sí: ${conPd.length} documentos firmados`}
            onClick={() => masivo('firmadas', { firmada: true })}
          />
          <BotonMasivo
            clave="limpiar"
            confirmando={confirmando}
            guardando={guardando}
            texto="Dejar sin constar"
            confirmacion={`Sí: borrar los ${conPd.length}`}
            tono="gris"
            onClick={() => masivo('limpiar', { imagen: null, redes: null, ampa: null, ong: null })}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
              {CAMPOS_PROTECCION.map((campo) => (
                <th key={campo} className="p-2 align-bottom">
                  <span className="block text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {PROTECCION_LABELS[campo].titulo}
                  </span>
                  {puedeEditar && (
                    // El «por columna» que pidió David: entra una autorización nueva y se
                    // resuelve de dos toques, sin bajar por las 25 filas.
                    <span className="mt-1 flex justify-center gap-0.5">
                      <ColumnaBoton
                        activa={confirmando === `${campo}-si`}
                        ocupada={guardando === `${campo}-si`}
                        tono="verde"
                        titulo={`Poner «${PROTECCION_LABELS[campo].titulo}» a sí en ${ambito}`}
                        onClick={() => masivo(`${campo}-si`, { [campo]: true })}
                      >
                        <Check className="h-3 w-3" />
                      </ColumnaBoton>
                      <ColumnaBoton
                        activa={confirmando === `${campo}-no`}
                        ocupada={guardando === `${campo}-no`}
                        tono="rojo"
                        titulo={`Poner «${PROTECCION_LABELS[campo].titulo}» a no en ${ambito}`}
                        onClick={() => masivo(`${campo}-no`, { [campo]: false })}
                      >
                        <X className="h-3 w-3" />
                      </ColumnaBoton>
                    </span>
                  )}
                </th>
              ))}
              <th className="p-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">Firmada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {conPd.map((a) => {
              const pd = a.proteccion!;
              return (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="max-w-[14rem] truncate p-2 text-zinc-800 dark:text-zinc-100">
                    {a.numero !== null && <span className="mr-1.5 text-xs text-zinc-400">{a.numero}</span>}
                    {a.completo}
                  </td>
                  {CAMPOS_PROTECCION.map((campo) => (
                    <td key={campo} className="p-1 text-center">
                      <Celda
                        valor={pd[campo]}
                        editable={puedeEditar}
                        ocupada={guardando === `${a.id}-${campo}`}
                        etiqueta={`${PROTECCION_LABELS[campo].titulo} de ${a.completo}`}
                        onTocar={() =>
                          guardar(`${a.id}-${campo}`, [a.id], { [campo]: SIGUIENTE[String(pd[campo])] })
                        }
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <Celda
                      valor={pd.firmada}
                      editable={puedeEditar}
                      ocupada={guardando === `${a.id}-firmada`}
                      etiqueta={`Documento firmado de ${a.completo}`}
                      onTocar={() => guardar(`${a.id}-firmada`, [a.id], { firmada: !pd.firmada })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-zinc-400">
        Cada casilla cicla <strong className="font-medium text-emerald-600 dark:text-emerald-400">sí</strong> →{' '}
        <strong className="font-medium text-red-600 dark:text-red-400">no</strong> → sin constar.
        {!puedeEditar && ' Aquí solo miras: esto lo cambian secretaría, dirección o TIC.'}
      </p>
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

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
        aria-label={etiqueta}
        className={`inline-flex h-8 w-9 items-center justify-center rounded-lg ${CELDA[clave]} pointer-events-none`}
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
      aria-label={etiqueta}
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
  tono?: 'verde' | 'gris' | 'neutro';
  onClick: () => void;
}) {
  const activa = confirmando === clave;
  const ocupada = guardando === clave;
  const colores =
    tono === 'verde'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : tono === 'gris'
        ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
        : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white';
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
