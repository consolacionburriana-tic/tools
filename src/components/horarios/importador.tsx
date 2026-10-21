'use client';

// Importar un horario: arrastrar el fichero → ver qué va a entrar → confirmar.
//
// La vista previa NO es un adorno. Importar sobrescribe el periodo entero de esa etapa, así
// que aquí se ve, antes de tocar nada, cuántas sesiones trae cada clase, qué códigos no ha
// reconocido y qué notas del fichero no caben en la cuadrícula.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileUp, Loader2, StickyNote, TriangleAlert, Users, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { academicYearActual } from '@/lib/constants';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Estado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';

interface Previa {
  bloquesTotales: number;
  deProfesor: number;
  clases: { codigo: string; nombre: string; etapa: string | null; sesiones: number; tramos: number; conAula: number; apoyos: number; incidencias: number }[];
  incidencias: { tipo: string; clave: string; detalle: string; veces: number }[];
  notas: string[];
  /** Lo que el importador ha corregido solo (el inglés del PDC, un segundo profe…). */
  ajustes: string[];
  hojasProfe: { nombre: string; codigo: string | null; horas: number }[];
  /** Las horas que no son clase, sacadas de las hojas de profe: 'Reunión · TIC', 8 h, 3 profes. */
  horasProfe: { que: string; horas: number; profes: number }[];
  /** La reunión de etapa de la configuración, para cada etapa del fichero: se pregunta. */
  reunionesEtapa: { etapa: string; dias: number[]; horaInicio: string; horaFin: string; etiqueta: string }[];
  periodoSugerido: 'Ordinario' | 'Jornada corta';
}

/** Cómo se titula cada tipo de aviso en la vista previa. */
const TITULO_INCIDENCIA: Record<string, string> = {
  codigo_desconocido: 'Código que no está en la leyenda',
  celda_ilegible: 'Texto suelto en una celda',
  actividad_desconocida: 'Algo escrito a mano que no se reconoce',
  profe_desconocido: 'Hoja de profesor sin dueño',
  solo_en_hoja_profe: 'Clase que solo está en la hoja del profe',
  dato_personal: 'Posible nombre de alumno',
  sin_tramos: 'Bloque sin horas',
  grupo_ilegible: 'Bloque sin título de clase',
};

/**
 * Los periodos del curso y cuándo manda cada uno.
 *
 * Se SOLAPAN a propósito: el ordinario cubre el curso entero y septiembre y junio le
 * recortan por encima con más prioridad, así que en cada fecha manda el más específico y no
 * hay que cuadrar calendarios a mano. Septiembre y junio son horarios distintos aunque se
 * parezcan (uno arranca el curso y el otro lo cierra), y por eso son dos periodos: uno solo
 * no puede tener dos ventanas de fechas.
 */
const PERIODOS = [
  { nombre: 'Ordinario', desde: (y: number) => `${y}-09-01`, hasta: (y: number) => `${y + 1}-06-30`, prioridad: 0 },
  { nombre: 'Septiembre', desde: (y: number) => `${y}-09-01`, hasta: (y: number) => `${y}-09-30`, prioridad: 10 },
  { nombre: 'Junio', desde: (y: number) => `${y + 1}-06-01`, hasta: (y: number) => `${y + 1}-06-30`, prioridad: 10 },
] as const;

export function Importador() {
  const router = useRouter();
  const [fichero, setFichero] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [cargando, setCargando] = useState(false);
  const [sobre, setSobre] = useState(false);
  // Etapas cuya reunión NO se quiere añadir. Por defecto se añaden todas (lo pidió David).
  const [sinReunion, setSinReunion] = useState<Set<string>>(new Set());

  const year = academicYearActual();
  const primerAño = Number(year.slice(0, 4));
  const [periodo, setPeriodo] = useState<string>('Ordinario');
  const [desde, setDesde] = useState(PERIODOS[0].desde(primerAño));
  const [hasta, setHasta] = useState(PERIODOS[0].hasta(primerAño));

  /** Al cambiar de periodo se recolocan las fechas; siguen siendo editables. */
  function elegirPeriodo(nombre: string) {
    setPeriodo(nombre);
    const p = PERIODOS.find((x) => x.nombre === nombre);
    if (!p) return;
    setDesde(p.desde(primerAño));
    setHasta(p.hasta(primerAño));
  }

  async function enviar(f: File, confirmar: boolean) {
    setCargando(true);
    try {
      const fd = new FormData();
      fd.set('fichero', f);
      fd.set('confirmar', String(confirmar));
      if (confirmar) {
        fd.set('academicYear', year);
        fd.set('periodo', periodo);
        fd.set('desde', desde);
        fd.set('hasta', hasta);
        fd.set('prioridad', String(PERIODOS.find((p) => p.nombre === periodo)?.prioridad ?? 10));
        fd.set('ordinario', String(periodo === 'Ordinario'));
        fd.set('reunionesEtapa', JSON.stringify((previa?.reunionesEtapa ?? []).filter((r) => !sinReunion.has(r.etapa))));
      }
      const res = await fetch('/api/horarios/admin/importar', { method: 'POST', body: fd });
      const datos = await leerJson(res);
      if (!res.ok) throw new Error(datos.error ?? 'Error al importar');
      if (!datos.previa) throw new Error('El servidor no ha devuelto la vista previa');
      setPrevia(datos.previa);
      if (confirmar) {
        haptic.success();
        toast.success(
          `Importadas ${datos.resumen?.sesiones ?? 0} sesiones de ${datos.previa.clases.length} clases` +
            (datos.resumen?.horasProfe ? ` y ${datos.resumen.horasProfe} horas de profesorado` : ''),
        );
        router.push('/gestion/horarios');
        router.refresh();
      } else {
        // El fichero distingue ordinario de jornada corta, pero no septiembre de junio.
        elegirPeriodo(datos.previa.periodoSugerido === 'Ordinario' ? 'Ordinario' : 'Septiembre');
      }
    } catch (e) {
      haptic.warning();
      toast.error((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  /**
   * Respuesta del servidor, aunque NO sea JSON. Cuando la función se pasa de tiempo, la
   * plataforma devuelve una página de error en HTML: `res.json()` reventaba con un
   * "Unexpected token '<'" que no le decía nada a nadie. Aquí se traduce a lo que de
   * verdad ha pasado.
   */
  async function leerJson(
    res: Response,
  ): Promise<{ error?: string; previa?: Previa; resumen?: { sesiones: number; horasProfe?: number } }> {
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return {
        error:
          res.status === 504 || res.status === 502
            ? 'El servidor ha tardado demasiado y ha cortado la importación. Vuelve a intentarlo: lo que ya hubiera entrado se sustituye, no se duplica.'
            : `El servidor ha respondido algo que no se entiende (${res.status}).`,
      };
    }
  }

  function elegir(f: File | null | undefined) {
    if (!f) return;
    setFichero(f);
    setPrevia(null);
    void enviar(f, false);
  }

  return (
    <div className="space-y-5">
      <label
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); elegir(e.dataTransfer.files?.[0]); }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
          sobre ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-zinc-300 bg-white hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-900',
        )}
      >
        <input
          type="file"
          accept=".docx,.xlsx"
          className="sr-only"
          onChange={(e) => elegir(e.target.files?.[0])}
        />
        {cargando && !previa ? (
          <Loader2 aria-label="Leyendo el fichero" className="size-8 animate-spin text-blue-600 dark:text-blue-400" />
        ) : (
          <FileUp aria-hidden className="size-8 text-zinc-400 dark:text-zinc-500" />
        )}
        <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {fichero ? fichero.name : 'Arrastra aquí el horario de Educamos'}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          El <strong>.docx</strong> es el bueno: es el único que trae el aula. También vale el .xlsx.
        </p>
      </label>

      {previa && (
        <>
          <Tarjeta>
            <TarjetaCabecera
              titulo="Esto es lo que va a entrar"
              descripcion={
                <>
                  {previa.clases.length} clases · {previa.clases.reduce((n, c) => n + c.sesiones, 0)} sesiones.
                  {previa.deProfesor > 0 &&
                    ` De los ${previa.deProfesor} horarios de profesor se saca lo que no está en los de clase: reuniones, atención a familias, departamento… y quién más entra en una clase.`}
                </>
              }
            />
            <TarjetaCuerpo className="grid gap-1.5 sm:grid-cols-2">
              {previa.clases.map((c) => (
                <div key={c.codigo} className="flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-800/60">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.nombre}</span>
                  <span className="flex items-center gap-2 tabular-nums text-zinc-500 dark:text-zinc-400">
                    {c.sesiones} ses{c.conAula > 0 && ` · ${c.conAula} aula`}
                    {c.incidencias > 0 && (
                      <Estado tono="aviso" icono={<TriangleAlert />}>
                        {c.incidencias} por revisar
                      </Estado>
                    )}
                  </span>
                </div>
              ))}
            </TarjetaCuerpo>
          </Tarjeta>

          {(previa.horasProfe?.length ?? 0) > 0 && (
            <Tarjeta>
              <TarjetaCabecera
                icono={<Users />}
                titulo="Horas del profesorado que no son clase"
                descripcion="Salen de lo que cada uno escribe en su hoja. Si alguien ya se lo había anotado a mano en Mi horario, se queda lo suyo y esto no se duplica."
              />
              <ul className="grid gap-1.5 p-4 text-sm sm:grid-cols-2">
                {previa.horasProfe.map((h) => (
                  <li key={h.que} className="flex min-h-10 items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 dark:bg-zinc-800/60">
                    <span className="min-w-0 truncate text-zinc-800 dark:text-zinc-200">{h.que}</span>
                    <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {h.horas} h · {h.profes} {h.profes === 1 ? 'profe' : 'profes'}
                    </span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}

          {(previa.reunionesEtapa?.length ?? 0) > 0 && (
            <Tarjeta>
              <TarjetaCabecera
                titulo="¿Añado la reunión de etapa?"
                descripcion="No suele venir en el fichero. Se pone a todo el profesorado de la etapa que sale en él; a quien ya tenga algo a esa hora no se le duplica."
              />
              <div className="space-y-1 p-2">
                {previa.reunionesEtapa.map((r) => (
                  <label key={r.etapa} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-blue-600"
                      checked={!sinReunion.has(r.etapa)}
                      onChange={(e) =>
                        setSinReunion((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) n.delete(r.etapa);
                          else n.add(r.etapa);
                          return n;
                        })
                      }
                    />
                    <span>
                      <strong>{r.etapa}</strong> · {r.dias.map((d) => DIAS[d - 1]).join(' y ')} de {r.horaInicio} a {r.horaFin}
                    </span>
                  </label>
                ))}
              </div>
            </Tarjeta>
          )}

          {(previa.ajustes?.length ?? 0) > 0 && (
            <Aviso tono="info" icono={<Wand2 />} titulo="Arreglado solo">
              <ul className="mt-1 space-y-1">
                {previa.ajustes.map((a) => <li key={a}>· {a}</li>)}
              </ul>
            </Aviso>
          )}

          {previa.incidencias.length > 0 && (
            <Aviso tono="aviso" titulo="Cosas que conviene revisar">
              <p className="mb-2">
                No se inventa nada: lo que no se reconoce entra con su texto tal cual y se puede arreglar luego.
              </p>
              <ul className="space-y-1.5">
                {previa.incidencias.map((i) => (
                  <li key={i.clave}>
                    <span className="font-medium">{TITULO_INCIDENCIA[i.tipo] ?? i.tipo}</span>
                    {i.veces > 1 && <span className="tabular-nums"> · {i.veces}×</span>}
                    <span className="block opacity-80">{i.detalle}</span>
                  </li>
                ))}
              </ul>
            </Aviso>
          )}

          {previa.notas.length > 0 && (
            <Aviso tono="aviso" icono={<StickyNote />} titulo="Notas del fichero que no caben en la cuadrícula">
              <ul className="mt-1 space-y-0.5">
                {previa.notas.map((n) => <li key={n}>· {n}</li>)}
              </ul>
            </Aviso>
          )}

          <Tarjeta>
            <TarjetaCabecera
              titulo="¿De qué periodo es?"
              descripcion={
                <>
                  El fichero no lo dice, pero se nota: parece <strong>{previa.periodoSugerido}</strong>
                  {previa.periodoSugerido === 'Ordinario' ? ' (tiene comedor y jornada partida)' : ' (jornada corta, sin comedor)'}.
                  {previa.periodoSugerido !== 'Ordinario' && ' Septiembre y junio son el mismo horario en dos momentos del curso: eso sí hay que elegirlo.'}
                  {' '}La etapa sí se deduce sola del código de cada clase, eso no hay que decirlo.
                </>
              }
            />
            <TarjetaCuerpo>
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo etiqueta="Periodo" id="importar-periodo">
                  <Selector id="importar-periodo" value={periodo} onChange={(e) => elegirPeriodo(e.target.value)}>
                    {PERIODOS.map((p) => (
                      <option key={p.nombre}>{p.nombre}</option>
                    ))}
                  </Selector>
                </Campo>
                <Campo etiqueta="Desde" id="importar-desde">
                  <Input id="importar-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </Campo>
                <Campo etiqueta="Hasta" id="importar-hasta">
                  <Input id="importar-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </Campo>
              </div>
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Curso académico: <strong className="text-zinc-800 dark:text-zinc-200">{year}</strong>
              </p>

              <Button
                className="mt-4 w-full sm:w-auto"
                cargando={cargando}
                disabled={!fichero}
                onClick={() => fichero && enviar(fichero, true)}
              >
                {!cargando && <CheckCircle2 aria-hidden />}
                Importar {previa.clases.length} clases
              </Button>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Sustituye el horario que ya hubiera <strong>de estas clases</strong> en este periodo. Las
                demás etapas (y lo que hayas añadido a mano) no se tocan: la ESO y primaria se importan
                de ficheros distintos y conviven sin pisarse. Los periodos también conviven: en cada
                fecha manda el más específico, así que septiembre y junio se comen al ordinario esos días.
              </p>
            </TarjetaCuerpo>
          </Tarjeta>
        </>
      )}
    </div>
  );
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
