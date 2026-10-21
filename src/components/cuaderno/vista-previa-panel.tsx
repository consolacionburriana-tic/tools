'use client';

// Pestaña «Vista previa»: qué va a salir EXACTAMENTE en cada `<<etiqueta>>` de una
// plantilla, con los datos de una clase de verdad.
//
// Contesta a las dos cosas que antes obligaban a generar el documento para descubrirlas:
// si una etiqueta está mal escrita (sale marcada en rojo, con la lista de las que sí
// existen), y cómo va a quedar cada nombre. Y desde aquí mismo se arregla el nombre de
// quien haga falta, sin tocar Educamos.

import { useCallback, useEffect, useState } from 'react';
import { Check, Eye, Loader2, Pencil, RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
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
      <Aviso tono="aviso">
        Todavía no hay ninguna plantilla leída. Añade una en «Plantillas» y pulsa «Analizar».
      </Aviso>
    );
  }

  return (
    <div className="space-y-3">
      <Tarjeta className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Plantilla" id="vp-plantilla" className="min-w-48 flex-1">
            <Selector id="vp-plantilla" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
              {utiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.orden} · {p.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Con los datos de" id="vp-clase" className="min-w-40 flex-1">
            <Selector id="vp-clase" value={clase} onChange={(e) => setClase(e.target.value)}>
              {clases.map((c) => (
                <option key={claseKey(c.curso, c.letra)} value={claseKey(c.curso, c.letra)}>
                  {c.clase} · {c.numAlumnos} alumnos
                </option>
              ))}
            </Selector>
          </Campo>
          {cargando && <Loader2 aria-label="Cargando" className="mb-3.5 h-4 w-4 animate-spin text-zinc-500" />}
        </div>
        {datos && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Ejemplo con {datos.ejemplo.alumno ?? 'sin alumnado'}
            {datos.ejemplo.tutor ? ` · tutor/a ${datos.ejemplo.tutor}` : ''} · {datos.ejemplo.clase}. Lo que se repite
            por alumno se enseña una vez; en el documento sale para cada uno.
          </p>
        )}
      </Tarjeta>

      {error && <Aviso tono="aviso">{error}</Aviso>}

      {datos && datos.sinMapear.length > 0 && (
        <Aviso tono="aviso">
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
      <TarjetaCabecera
        icono={<Eye />}
        titulo="Lo que va a salir"
        descripcion={`${campos.length} ${campos.length === 1 ? 'etiqueta' : 'etiquetas'}`}
      />
      <TarjetaCuerpo className="space-y-1">
        {campos.map((campo) => (
          <div
            key={campo.etiqueta}
            className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-xs ${
              campo.problema ? 'bg-red-50 dark:bg-red-500/10' : 'odd:bg-zinc-50 dark:odd:bg-zinc-800/40'
            }`}
          >
            <code className="shrink-0 font-mono text-zinc-500 dark:text-zinc-400">&lt;&lt;{campo.etiqueta}&gt;&gt;</code>
            {campo.problema ? (
              <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
                <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> no existe ese campo
              </span>
            ) : campo.tipo !== 'campo' ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                {campo.tipo === 'filas' ? 'marca de fila repetible' : 'condición: el párrafo desaparece si no hay dato'}
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {campo.valor || <span className="font-normal text-zinc-500 italic dark:text-zinc-400">(en blanco)</span>}
                </span>
                <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                  {campo.ambito ? (AMBITO_LABELS[campo.ambito as Ambito] ?? campo.ambito) : ''}
                </span>
              </>
            )}
          </div>
        ))}
      </TarjetaCuerpo>
    </Tarjeta>
  );
}

// ─── Los nombres de los tutores, retocables ───────────────────────────────────

/**
 * Educamos manda «CARLOS ANDRES VALERO AICART»; el cuaderno escribe «Carlos Valero Aicart»
 * quitando el segundo nombre de pila. Acierta casi siempre, y aquí se arregla el resto —
 * son dos tutores por clase, no hay que revisar un listado de trescientos.
 *
 * Esto retoca el nombre SOLO en el cuaderno (`cuad_personas`). Para cambiarle el nombre a un
 * profe en todas partes (ASM, correos, paneles) está el «Nombre visible» de /gestion/profes,
 * que es lo que se usa aquí si nadie ha escrito nada.
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
      <TarjetaCabecera
        titulo="Cómo se llaman los tutores en las hojas"
        descripcion="De Educamos llegan con todos sus nombres de pila y en mayúsculas. Si alguno no queda bien, escríbelo aquí —solo para el cuaderno—; para cambiarlo en todas partes, el «Nombre visible» de Profesorado."
      />
      <TarjetaCuerpo className="space-y-2">
        {tutores.map((t) => (
          <TutorEditable key={t.teacherId} tutor={t} onCambio={onCambio} />
        ))}
      </TarjetaCuerpo>
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
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            en carpetas «{tutor.corto}»
            {tutor.completo !== tutor.usual && ` · en Educamos «${tutor.completo}»`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={abierto}
          onClick={() => {
            haptic.tap();
            setAbierto((a) => !a);
          }}
        >
          <Pencil /> {abierto ? 'Cerrar' : 'Cambiar'}
        </Button>
      </div>

      {abierto && (
        <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <Campo
            etiqueta="Nombre de pila"
            ayuda="Lo normal: «Pepe» donde Educamos dice «José Manuel»."
            id={`pila-${tutor.teacherId}`}
          >
            <Input
              id={`pila-${tutor.teacherId}`}
              value={pila}
              onChange={(e) => setPila(e.target.value)}
              placeholder={tutor.usual.split(' ')[0]}
            />
          </Campo>
          <Campo
            etiqueta="Nombre entero"
            ayuda="Solo si ni los apellidos valen; manda sobre lo de arriba."
            id={`completo-${tutor.teacherId}`}
          >
            <Input
              id={`completo-${tutor.teacherId}`}
              value={completo}
              onChange={(e) => setCompleto(e.target.value)}
              placeholder={tutor.usual}
            />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => guardar()} disabled={ocupado}>
              <Check /> Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={() => guardar(true)} disabled={ocupado}>
              <RotateCcw /> Volver al de Educamos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
