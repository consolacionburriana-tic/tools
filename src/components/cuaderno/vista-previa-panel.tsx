'use client';

// Pestaña «Vista previa»: qué va a salir EXACTAMENTE en cada `<<etiqueta>>` de una
// plantilla, con los datos de una clase de verdad.
//
// Contesta a las dos cosas que antes obligaban a generar el documento para descubrirlas:
// si una etiqueta está mal escrita (sale marcada en rojo, con la lista de las que sí
// existen), y cómo va a quedar cada nombre. Y desde aquí mismo se arregla el nombre de
// quien haga falta, sin tocar Educamos.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Eye, Loader2, Pencil, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Aviso, Tarjeta } from '@/components/cuaderno/cuaderno-panel';
import { claseKey, type ClaseUI, type PlantillaUI } from '@/components/cuaderno/tipos';
import { AMBITO_LABELS, type Ambito } from '@/lib/cuaderno/campos';
import { haptic } from '@/lib/haptics';

interface CampoPrevisto {
  etiqueta: string;
  campo: string | null;
  ambito: string | null;
  label: string | null;
  tipo: 'campo' | 'filas' | 'condicion';
  valor: string;
  problema: boolean;
}

interface VistaPrevia {
  ejemplo: { alumno: string | null; tutor: string | null; clase: string };
  campos: CampoPrevisto[];
  tutores: { teacherId: string; completo: string; usual: string; corto: string }[];
  sinMapear: string[];
}

export function VistaPreviaPanel({ plantillas, clases }: { plantillas: PlantillaUI[]; clases: ClaseUI[] }) {
  const utiles = plantillas.filter((p) => p.analizadaAt);
  const [plantillaId, setPlantillaId] = useState(utiles[0]?.id ?? '');
  const [clase, setClase] = useState(clases[0] ? claseKey(clases[0].curso, clases[0].letra) : '');
  // El contador vuelve a pedir la vista previa cuando se retoca un nombre.
  const [refresco, setRefresco] = useState(0);
  const recargar = useCallback(() => setRefresco((n) => n + 1), []);

  // Lo cargado se guarda junto a la clave de lo que se pidió. Así «está cargando» es una
  // comparación, no otro estado que haya que poner en el efecto (`set-state-in-effect`).
  const clavePedida = `${plantillaId}|${clase}|${refresco}`;
  const [cargado, setCargado] = useState<{ clave: string; datos: VistaPrevia | null; error: string | null } | null>(null);
  const cargando = cargado?.clave !== clavePedida;
  const datos = cargado?.clave === clavePedida ? cargado.datos : (cargado?.datos ?? null);
  const error = cargado?.clave === clavePedida ? cargado.error : null;

  useEffect(() => {
    if (!plantillaId || !clase) return;
    const [curso, letra] = clase.split('|');
    const url = `/api/cuaderno/admin/vista-previa?plantilla=${plantillaId}&curso=${encodeURIComponent(curso)}&letra=${encodeURIComponent(letra)}`;
    let vivo = true;
    fetch(url, { cache: 'no-store' })
      .then(async (res) => ({ ok: res.ok, cuerpo: await res.json() }))
      .then(({ ok, cuerpo }) => {
        if (vivo) {
          setCargado({
            clave: clavePedida,
            datos: ok ? cuerpo : null,
            error: ok ? null : (cuerpo.error ?? 'No se pudo cargar la vista previa'),
          });
        }
      })
      .catch(() => {
        if (vivo) setCargado({ clave: clavePedida, datos: null, error: 'No se pudo cargar la vista previa' });
      });
    return () => {
      vivo = false;
    };
  }, [plantillaId, clase, clavePedida]);

  if (utiles.length === 0) {
    return (
      <Aviso tono="ambar">
        Todavía no hay ninguna plantilla leída. Añade una en «Plantillas» y pulsa «Analizar».
      </Aviso>
    );
  }

  return (
    <div className="space-y-3">
      <Tarjeta>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-48 text-xs text-zinc-500">
            Plantilla
            <select
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {utiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.orden} · {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-40 text-xs text-zinc-500">
            Con los datos de
            <select
              value={clase}
              onChange={(e) => setClase(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {clases.map((c) => (
                <option key={claseKey(c.curso, c.letra)} value={claseKey(c.curso, c.letra)}>
                  {c.clase} · {c.numAlumnos} alumnos
                </option>
              ))}
            </select>
          </label>
          {cargando && <Loader2 className="mb-2 h-4 w-4 animate-spin text-zinc-400" />}
        </div>
        {datos && (
          <p className="mt-2 text-xs text-zinc-500">
            Ejemplo con {datos.ejemplo.alumno ?? 'sin alumnado'}
            {datos.ejemplo.tutor ? ` · tutor/a ${datos.ejemplo.tutor}` : ''} · {datos.ejemplo.clase}. Lo que se repite
            por alumno se enseña una vez; en el documento sale para cada uno.
          </p>
        )}
      </Tarjeta>

      {error && <Aviso tono="ambar">{error}</Aviso>}

      {datos && datos.sinMapear.length > 0 && (
        <Aviso tono="ambar">
          <strong>{datos.sinMapear.length} etiqueta(s) de la plantilla no existen</strong>:{' '}
          {datos.sinMapear.map((e) => `<<${e}>>`).join(', ')}. Corrígelas en el Google Doc, o dales su campo en
          «Plantillas» → Analizar. Tal como están saldrán impresas en crudo.
        </Aviso>
      )}

      {datos && <Tutores tutores={datos.tutores} onCambio={recargar} />}
      {datos && <Campos campos={datos.campos} />}
    </div>
  );
}

// ─── Los campos, uno a uno ────────────────────────────────────────────────────

function Campos({ campos }: { campos: CampoPrevisto[] }) {
  return (
    <Tarjeta>
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Lo que va a salir <span className="text-zinc-400">· {campos.length} etiqueta(s)</span>
        </h3>
      </div>
      <div className="mt-3 space-y-1">
        {campos.map((campo) => (
          <div
            key={campo.etiqueta}
            className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-xs ${
              campo.problema ? 'bg-red-50 dark:bg-red-950/40' : 'odd:bg-zinc-50 dark:odd:bg-zinc-800/40'
            }`}
          >
            <code className="shrink-0 font-mono text-zinc-500">&lt;&lt;{campo.etiqueta}&gt;&gt;</code>
            {campo.problema ? (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> no existe ese campo
              </span>
            ) : campo.tipo !== 'campo' ? (
              <span className="text-zinc-400">
                {campo.tipo === 'filas' ? 'marca de fila repetible' : 'condición: el párrafo desaparece si no hay dato'}
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {campo.valor || <span className="font-normal italic text-zinc-400">(en blanco)</span>}
                </span>
                <span className="shrink-0 text-zinc-400">
                  {campo.ambito ? (AMBITO_LABELS[campo.ambito as Ambito] ?? campo.ambito) : ''}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

// ─── Los nombres de los tutores, retocables ───────────────────────────────────

/**
 * Educamos manda «CARLOS ANDRES VALERO AICART»; el cuaderno escribe «Carlos Valero Aicart»
 * quitando el segundo nombre de pila. Acierta casi siempre, y aquí se arregla el resto —
 * son dos tutores por clase, no hay que revisar un listado de trescientos.
 */
function Tutores({
  tutores,
  onCambio,
}: {
  tutores: { teacherId: string; completo: string; usual: string; corto: string }[];
  onCambio: () => void;
}) {
  if (tutores.length === 0) return null;
  return (
    <Tarjeta>
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Cómo se llaman los tutores en las hojas</h3>
      <p className="mt-1 text-xs text-zinc-500">
        De Educamos llegan con todos sus nombres de pila y en mayúsculas. Si alguno no queda bien, escríbelo aquí.
      </p>
      <div className="mt-3 space-y-2">
        {tutores.map((t) => (
          <TutorEditable key={t.teacherId} tutor={t} onCambio={onCambio} />
        ))}
      </div>
    </Tarjeta>
  );
}

function TutorEditable({
  tutor,
  onCambio,
}: {
  tutor: { teacherId: string; completo: string; usual: string; corto: string };
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pila, setPila] = useState('');
  const [completo, setCompleto] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(vaciar = false) {
    setOcupado(true);
    try {
      const res = await fetch('/api/cuaderno/admin/personas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ambito: 'profe',
          personaId: tutor.teacherId,
          pila: vaciar ? null : pila.trim() || null,
          completo: vaciar ? null : completo.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo guardar');
      toast.success(vaciar ? 'Vuelve a salir el de Educamos' : 'Guardado');
      setAbierto(false);
      setPila('');
      setCompleto('');
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{tutor.usual}</p>
          <p className="truncate text-xs text-zinc-500">
            en carpetas «{tutor.corto}»
            {tutor.completo !== tutor.usual && ` · en Educamos «${tutor.completo}»`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setAbierto((a) => !a);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Pencil className="h-3.5 w-3.5" /> {abierto ? 'Cerrar' : 'Cambiar'}
        </button>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
          <label className="block text-xs text-zinc-500">
            Nombre de pila (lo normal: «Pepe» donde Educamos dice «José Manuel»)
            <input
              value={pila}
              onChange={(e) => setPila(e.target.value)}
              placeholder={tutor.usual.split(' ')[0]}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Nombre entero (solo si ni los apellidos valen; manda sobre lo de arriba)
            <input
              value={completo}
              onChange={(e) => setCompleto(e.target.value)}
              placeholder={tutor.usual}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => guardar()}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Check className="h-3.5 w-3.5" /> Guardar
            </button>
            <button
              type="button"
              onClick={() => guardar(true)}
              disabled={ocupado}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-white disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Volver al de Educamos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
