'use client';

// Protección de datos y participación, dentro de la ficha de alumnado.
//
// Por qué está aquí y no en un módulo propio: es la pregunta que se hace justo antes de
// publicar una foto («¿este puede salir?»), y esa pregunta se hace mirando la ficha del
// alumno, no entrando en otra pantalla. Lo que se edita desde aquí (banco de libros y AMPA)
// se sigue gestionando también en su módulo, con el mismo permiso y llamando al mismo
// código: la ficha condensa la información, no se queda con la autoridad.
//
// Dos casillas, las dos tri-estado: **fotos** (sí · no · sin marcar) y el **documento
// Prodat** (recibido · no · sin contestar). El tercer estado no es un adorno: en fotos
// significa «nadie lo ha mirado» y en Prodat, «el papel no ha vuelto», que es justo lo que
// la dirección quiere poder buscar.

import { useState } from 'react';
import { Check, Loader2, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Tarjeta } from '@/components/alumnado/ficha-alumno';
import { CAMPOS_PROTECCION, PROTECCION_LABELS, type CampoProteccion, type ProteccionDatos } from '@/lib/alumnado';
import { haptic } from '@/lib/haptics';

type Estado = boolean | null;

export function TarjetaProteccion({
  id,
  proteccion,
  bancoLibros,
  ampa,
  puedeEditar,
  puedeParticipacion,
  onCambio,
}: {
  id: string;
  /** `null` = a quien mira no le toca verla (tutor de otra clase). */
  proteccion: ProteccionDatos | null;
  bancoLibros: boolean;
  ampa: boolean;
  puedeEditar: boolean;
  puedeParticipacion: boolean;
  onCambio: (cambio: { proteccion?: ProteccionDatos; bancoLibros?: boolean; ampa?: boolean }) => void;
}) {
  const [guardando, setGuardando] = useState<string | null>(null);

  if (!proteccion && !puedeParticipacion) {
    return (
      <p className="px-1 text-xs text-zinc-400">
        La protección de datos (fotos y documento Prodat) solo la ven dirección, secretaría, jefatura, orientación y
        el tutor/a de su clase.
      </p>
    );
  }

  async function guardar(campo: string, cuerpo: Record<string, unknown>, ruta: 'proteccion' | 'participacion') {
    haptic.tap();
    setGuardando(campo);
    try {
      const res = await fetch(`/api/alumnado/${id}/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      // Se pinta lo que dice la BBDD, no lo que creía la pantalla: son datos que firma
      // alguien, y un optimista que se queda colgado aquí es peor que medio segundo de espera.
      onCambio(
        ruta === 'proteccion'
          ? { proteccion: datos.proteccion as ProteccionDatos }
          : (cuerpo as { bancoLibros?: boolean; ampa?: boolean }),
      );
      haptic.success();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Tarjeta
      titulo="Protección de datos"
      accion={
        proteccion && puedeEditar ? (
          // El atajo del caso normal: puede salir en fotos y el Prodat ha vuelto. Para una
          // clase entera está la pestaña de al lado.
          <button
            type="button"
            disabled={guardando === 'todo'}
            onClick={() => guardar('todo', { imagen: true, prodat: true }, 'proteccion')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {guardando === 'todo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Todo sí
          </button>
        ) : undefined
      }
    >
      {proteccion ? (
        <>
          <div className="space-y-1">
            {CAMPOS_PROTECCION.map((campo) => (
              <Fila
                key={campo}
                campo={campo}
                valor={proteccion[campo]}
                editable={puedeEditar}
                guardando={guardando === campo}
                onElegir={(valor) => guardar(campo, { [campo]: valor }, 'proteccion')}
              />
            ))}
          </div>

          {(proteccion.notas || proteccion.actualizadoAt) && (
            <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
              {proteccion.notas && <p className="min-w-0 text-xs italic text-zinc-500">{proteccion.notas}</p>}
              {proteccion.actualizadoAt && (
                // Quién y cuándo, siempre a la vista: esto es la voluntad de una familia.
                <p className="ml-auto text-[11px] text-zinc-400">
                  Última vez: {new Date(proteccion.actualizadoAt).toLocaleDateString('es-ES')}
                  {proteccion.actualizadoPor && ` · ${proteccion.actualizadoPor.split('@')[0]}`}
                </p>
              )}
            </div>
          )}
          {!puedeEditar && (
            <p className="mt-1.5 text-[11px] text-zinc-400">
              Para cambiar algo de aquí, secretaría (o dirección/TIC): son los papeles que guardan ellos.
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-zinc-400">
          La protección de datos de este alumno no te toca: un tutor solo ve la de su propia tutoría.
        </p>
      )}

      {puedeParticipacion && (
        <div className="mt-2.5 space-y-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Participación</p>
          <Interruptor
            etiqueta="Banco de libros"
            ayuda="Se gestiona también en el panel del banco"
            puesto={bancoLibros}
            editable
            guardando={guardando === 'bancoLibros'}
            onCambiar={(v) => guardar('bancoLibros', { bancoLibros: v }, 'participacion')}
          />
          <Interruptor
            etiqueta="Familia socia del AMPA"
            ayuda="No es lo mismo que el permiso de fotos del AMPA"
            puesto={ampa}
            editable
            guardando={guardando === 'ampa'}
            onCambiar={(v) => guardar('ampa', { ampa: v }, 'participacion')}
          />
        </div>
      )}
    </Tarjeta>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

const ESTADOS: { valor: Estado; texto: string; icono: React.ReactNode; puesto: string }[] = [
  {
    valor: true,
    texto: 'Sí',
    icono: <Check className="h-3.5 w-3.5" />,
    puesto: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
  },
  {
    valor: false,
    texto: 'No',
    icono: <X className="h-3.5 w-3.5" />,
    puesto: 'bg-red-600 text-white dark:bg-red-500 dark:text-red-950',
  },
  {
    valor: null,
    texto: 'Sin marcar',
    icono: <Minus className="h-3.5 w-3.5" />,
    puesto: 'bg-zinc-500 text-white dark:bg-zinc-400 dark:text-zinc-900',
  },
];

function Fila({
  campo,
  valor,
  editable,
  guardando,
  onElegir,
}: {
  campo: CampoProteccion;
  valor: Estado;
  editable: boolean;
  guardando: boolean;
  onElegir: (valor: Estado) => void;
}) {
  const label = PROTECCION_LABELS[campo];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <p className="text-sm text-zinc-800 dark:text-zinc-100">{label.titulo}</p>
        <p className="text-[11px] text-zinc-400">{label.ayuda}</p>
      </div>
      {editable ? (
        // Tres botones de verdad y no un desplegable: en un iPad, elegir entre tres cosas
        // con un select son tres toques y un menú que tapa la fila.
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-zinc-400" />}
          {ESTADOS.map((e) => {
            const puesto = valor === e.valor;
            return (
              <button
                key={String(e.valor)}
                type="button"
                disabled={guardando}
                aria-pressed={puesto}
                onClick={() => !puesto && onElegir(e.valor)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                  puesto ? e.puesto : 'text-zinc-500 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {e.icono}
                <span className={e.valor === null ? 'hidden sm:inline' : ''}>{e.texto}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <Valor valor={valor} />
      )}
    </div>
  );
}

function Valor({ valor }: { valor: Estado }) {
  const e = ESTADOS.find((x) => x.valor === valor)!;
  const tono =
    valor === true
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : valor === false
        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${tono}`}>
      {e.icono} {e.texto}
    </span>
  );
}

function Interruptor({
  etiqueta,
  ayuda,
  puesto,
  editable,
  guardando,
  onCambiar,
}: {
  etiqueta: string;
  ayuda?: string;
  puesto: boolean;
  editable: boolean;
  guardando: boolean;
  onCambiar: (valor: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-zinc-800 dark:text-zinc-100">{etiqueta}</p>
        {ayuda && <p className="text-[11px] text-zinc-400">{ayuda}</p>}
      </div>
      {editable ? (
        <button
          type="button"
          role="switch"
          aria-checked={puesto}
          aria-label={etiqueta}
          disabled={guardando}
          onClick={() => onCambiar(!puesto)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            puesto ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
        >
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white transition-transform dark:bg-zinc-100 ${
              puesto ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
            }`}
          >
            {guardando && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
          </span>
        </button>
      ) : (
        <span className="shrink-0 text-xs text-zinc-500">{puesto ? 'Sí' : 'No'}</span>
      )}
    </div>
  );
}
