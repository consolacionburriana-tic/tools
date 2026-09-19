'use client';

// Banco de libros y AMPA de una clase entera, en una tabla.
//
// Por qué existe, dicho por David (19-sep-2026): da igual que entres por el módulo del banco
// de libros o por Alumnado, te tienes que encontrar la misma opción para cambiarlo rápido.
// Antes esto solo se podía tocar alumno a alumno desde la ficha, y marcar quién va al banco
// son 492 personas: eso, a ficha por alumno, no lo hace nadie.
//
// Es la hermana pequeña de `tabla-proteccion.tsx` y se comporta igual (un toque por celda,
// masivos por columna con segundo toque de confirmación), con una diferencia de fondo: esto
// NO es tri-estado. Se participa o no se participa; no existe el «no consta», así que la
// celda alterna entre dos valores y el «no» se pinta en gris y no en rojo — no es que nadie
// haya dicho que no a nada, es que esa familia no está apuntada.
//
// El dato sigue siendo del banco de libros: la API llama a sus mismos `setBanco`/`setAmpa`.
// Esta pantalla es un atajo, no un segundo sitio donde vivan estas dos columnas.

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PARTICIPACION_LABELS, reparteParticipacion, type CampoParticipacion } from '@/lib/alumnado';
import type { AlumnoLista } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';

const CELDA = {
  si: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60',
  no: 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700',
};

export function TablaParticipacion({
  alumnos,
  campo,
  ambito,
  puedeEditar,
  onCambio,
}: {
  /** Los que se ven ahora mismo: la clase elegida, o el resultado de la búsqueda. */
  alumnos: AlumnoLista[];
  campo: CampoParticipacion;
  /** Cómo se llama lo que hay delante («2º ESO B»), para que lo masivo diga a qué afecta. */
  ambito: string;
  puedeEditar: boolean;
  onCambio: (ids: string[], campo: CampoParticipacion, valor: boolean) => void;
}) {
  const [guardando, setGuardando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const label = PARTICIPACION_LABELS[campo];
  const reparto = reparteParticipacion(alumnos, campo);

  async function guardar(clave: string, ids: string[], valor: boolean) {
    if (ids.length === 0) return;
    haptic.tap();
    setGuardando(clave);
    try {
      const res = await fetch('/api/alumnado/participacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eduStudentIds: ids, cambios: { [campo]: valor } }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      // Se repintan los que ha tocado el servidor, no los que mandó la pantalla: si alguno
      // quedaba fuera de alcance, no se ha guardado y no puede quedarse pintado como si sí.
      onCambio(datos.ids as string[], campo, valor);
      haptic.success();
      if (ids.length > 1) toast.success(`${(datos.ids as string[]).length} alumnos actualizados`);
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(null);
      setConfirmando(null);
    }
  }

  /** Lo masivo pide un segundo toque, y en él dice a cuántos va. */
  function masivo(clave: string, valor: boolean) {
    if (confirmando !== clave) {
      haptic.tap();
      setConfirmando(clave);
      return;
    }
    void guardar(
      clave,
      alumnos.map((a) => a.id),
      valor,
    );
  }

  if (alumnos.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        Aquí no hay alumnado que enseñar. Elige una clase o busca a alguien.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <p className="mr-auto text-xs text-zinc-500">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{ambito}</span> · {reparto.si} de{' '}
          {reparto.total} {label.si}
        </p>
        {puedeEditar && (
          <>
            <BotonMasivo
              clave="todos-si"
              confirmando={confirmando}
              guardando={guardando}
              texto="Todos sí"
              confirmacion={`Sí: los ${reparto.total}`}
              tono="verde"
              onClick={() => masivo('todos-si', true)}
            />
            <BotonMasivo
              clave="todos-no"
              confirmando={confirmando}
              guardando={guardando}
              texto="Todos no"
              confirmacion={`Sí: quitar a los ${reparto.total}`}
              tono="gris"
              onClick={() => masivo('todos-no', false)}
            />
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Alumno</th>
              {/* Ancho fijo: con solo dos columnas, dejarla elástica manda el interruptor al
                  centro de medio folio en blanco y cuesta saber de qué fila es. */}
              <th className="w-28 p-2 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {label.columna}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {alumnos.map((a) => {
              const puesto = a[campo];
              return (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="max-w-[18rem] truncate p-2 text-zinc-800 dark:text-zinc-100">
                    {a.numero !== null && <span className="mr-1.5 text-xs text-zinc-400">{a.numero}</span>}
                    {a.completo}
                  </td>
                  <td className="p-1 text-center">
                    <Celda
                      puesto={puesto}
                      editable={puedeEditar}
                      ocupada={guardando === a.id}
                      etiqueta={`${label.titulo} de ${a.completo}`}
                      onTocar={() => guardar(a.id, [a.id], !puesto)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-zinc-400">
        {label.ayuda}.{!puedeEditar && ' Aquí solo miras: esto lo cambian dirección o TIC.'}
      </p>
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

function Celda({
  puesto,
  editable,
  ocupada,
  etiqueta,
  onTocar,
}: {
  puesto: boolean;
  editable: boolean;
  ocupada: boolean;
  etiqueta: string;
  onTocar: () => void;
}) {
  const contenido = ocupada ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : puesto ? (
    <Check className="h-4 w-4" />
  ) : (
    <X className="h-4 w-4" />
  );
  const color = puesto ? CELDA.si : CELDA.no;
  if (!editable) {
    return (
      <span
        aria-label={etiqueta}
        className={`pointer-events-none inline-flex h-8 w-9 items-center justify-center rounded-lg ${color}`}
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
      aria-pressed={puesto}
      title={etiqueta}
      className={`inline-flex h-9 w-10 items-center justify-center rounded-lg transition-colors disabled:opacity-60 ${color}`}
    >
      {contenido}
    </button>
  );
}

function BotonMasivo({
  clave,
  confirmando,
  guardando,
  texto,
  confirmacion,
  tono,
  onClick,
}: {
  clave: string;
  confirmando: string | null;
  guardando: string | null;
  texto: string;
  confirmacion: string;
  tono: 'verde' | 'gris';
  onClick: () => void;
}) {
  const activa = confirmando === clave;
  const ocupada = guardando === clave;
  const colores =
    tono === 'verde'
      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';
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
