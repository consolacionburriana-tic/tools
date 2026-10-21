'use client';

// Portada del estudio de AUTOASM: de dónde salen los datos → los seis ficheros →
// revisión → ZIP. Los cuatro pasos en una pantalla, porque esto se hace una vez al año
// (y en septiembre, con prisa).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Info,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  ESPEC,
  ORDEN_ARCHIVOS,
  contarIncidencias,
  validarProyecto,
  type ArchivoAsm,
  type Incidencia,
} from '@/lib/autoasm';
import { aplicarPropuestas, proponerDesdeHorario, type AsignacionHorario, type ResultadoHorario } from '@/lib/autoasm-horario';
import {
  CURSOS_CENTRO,
  OPCIONES_POR_DEFECTO,
  OPCIONES_SYNC_POR_DEFECTO,
  aplicarAjustes,
  inferirReglas,
  inferirTipos,
  labelCurso,
  limpiarArchivos,
  pareceCompartida,
  proyectoDesdePlantilla,
  proyectoVacio,
  regenerarMatriculas,
  sincronizarConCentro,
  type AjusteAsm,
  type OpcionesSync,
  type ProyectoAsm,
  type SnapshotCentro,
} from '@/lib/autoasm-construir';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea, useConfirmar } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Interruptor } from '@/components/ui/interruptor';
import { NavPending } from '@/components/ui/nav-pending';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { ESTILO, num } from '@/components/autoasm/paleta';
import { useProyecto } from '@/components/autoasm/proyecto-store';
import { ZonaSubida } from '@/components/autoasm/zona-subida';
import { leerFicherosAsm } from '@/components/autoasm/leer-ficheros';
import { PanelCompartidas } from '@/components/autoasm/compartidas';
import { PanelEntrega } from '@/components/autoasm/entrega';

export function EstudioAsm() {
  const { proyecto, cargando, guardar } = useProyecto();
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [sync, setSync] = useState<OpcionesSync>(OPCIONES_SYNC_POR_DEFECTO);
  const [verAjustes, setVerAjustes] = useState(false);
  // Alcance elegido: manda el del proyecto si ya hay uno; si no, el de esta sesión, que
  // es el que se usará al crearlo.
  const [alcanceLocal, setAlcanceLocal] = useState<string | null>(OPCIONES_POR_DEFECTO.desdeCurso);
  const [horario, setHorario] = useState<ResultadoHorario | null>(null);
  const [estado, setEstado] = useState<EstadoApi | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  // En qué punto está el curso: si ya se subió algo a ASM y qué alumnado ha entrado
  // después. Es lo que hace que el módulo avise en vez de esperar a que alguien se acuerde.
  useEffect(() => {
    let vivo = true;
    fetch('/api/autoasm/admin/estado')
      .then((res) => (res.ok ? res.json() : null))
      .then((datos) => { if (vivo && datos) setEstado(datos as EstadoApi); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  const desdeCurso = proyecto ? proyecto.opciones.desdeCurso : alcanceLocal;

  const incidencias = useMemo(() => (proyecto ? validarProyecto(proyecto.archivos) : []), [proyecto]);
  const conteo = contarIncidencias(incidencias);
  const porArchivo = useMemo(() => contarPorArchivo(incidencias), [incidencias]);

  function aplicar(nuevo: ProyectoAsm, mensaje: string) {
    const r = guardar({ ...nuevo, actualizado: new Date().toISOString() });
    if (!r.ok && r.error) toast.warning(r.error);
    haptic.success();
    toast.success(mensaje);
  }

  const opcionesNuevas = { ...OPCIONES_POR_DEFECTO, desdeCurso: alcanceLocal };

  function cambiarAlcance(valor: string) {
    const desde = valor === 'todos' ? null : valor;
    setAlcanceLocal(desde);
    if (proyecto) guardar({ ...proyecto, opciones: { ...proyecto.opciones, desdeCurso: desde } });
  }

  async function empezarPlantilla() {
    if (
      proyecto &&
      !(await confirmar({
        titulo: '¿Empezar de nuevo con la estructura del centro?',
        descripcion: 'Esto reemplaza el proyecto que tienes empezado en este navegador.',
        boton: 'Reemplazar el proyecto',
      }))
    )
      return;
    aplicar(proyectoDesdePlantilla(proyecto?.opciones ?? opcionesNuevas), 'Estructura del centro cargada: cursos y clases listos, faltan las personas.');
  }

  async function subir(files: File[]) {
    setTrabajando('subida');
    try {
      const lectura = await leerFicherosAsm(files);
      if (lectura.detalle.length === 0) {
        toast.error('No he reconocido ningún fichero de Apple School Manager ahí dentro.');
        return;
      }
      const base = proyecto ?? proyectoVacio(opcionesNuevas);
      const archivos = { ...base.archivos };
      for (const [archivo, filas] of Object.entries(lectura.archivos)) archivos[archivo as ArchivoAsm] = filas;
      if (archivos.locations.length === 0) archivos.locations = proyectoVacio(base.opciones).archivos.locations;

      const opciones = { ...base.opciones };
      const centro = archivos.locations[0];
      if (centro) {
        opciones.locationId = centro.location_id || opciones.locationId;
        opciones.locationName = centro.location_name || opciones.locationName;
      }

      const texto = lectura.detalle.map((d) => `${ESPEC[d.archivo].fichero} (${num(d.filas)})`).join(', ');
      const compartidas = [...new Set([...base.compartidas, ...archivos.students.filter(pareceCompartida).map((f) => f.person_id)])];
      aplicar(
        {
          ...base,
          opciones,
          archivos: limpiarArchivos(archivos, base.archivados),
          reglas: inferirReglas(archivos),
          tipos: inferirTipos(archivos, base.tipos),
          compartidas,
          historial: [...base.historial, { fecha: new Date().toISOString(), texto: `Importado: ${texto}` }].slice(-20),
        },
        `Leídos ${lectura.detalle.length} ficheros: ${texto}`,
      );
      for (const aviso of lectura.avisos.slice(0, 4)) toast.info(aviso, { duration: 8000 });
      if (lectura.ignorados.length > 0) toast.info(`Ignorados: ${lectura.ignorados.join(', ')}`);
    } catch (error) {
      console.error('AUTOASM: error leyendo los ficheros subidos', error);
      toast.error('No he podido leer esos ficheros.');
    } finally {
      setTrabajando(null);
    }
  }

  async function traerDelCentro() {
    setTrabajando('centro');
    try {
      // Los dos a la vez: las personas del centro y lo que se haya escrito a mano (que se
      // vuelve a poner DESPUÉS del sync, que es de lo que se trata).
      const [res, resAjustes] = await Promise.all([
        fetch('/api/autoasm/admin/centro'),
        fetch('/api/autoasm/admin/ajustes'),
      ]);
      if (!res.ok) throw new Error(String(res.status));
      const snapshot = (await res.json()) as SnapshotCentro;
      const guardados = resAjustes.ok
        ? ((await resAjustes.json()) as { ajustes: AjusteAsm[]; aviso: string | null })
        : { ajustes: [] as AjusteAsm[], aviso: null };
      const base = proyecto ?? proyectoDesdePlantilla(opcionesNuevas);
      const { proyecto: sincronizado, resumen } = sincronizarConCentro(base, snapshot, sync);
      const conAjustes = aplicarAjustes({ ...sincronizado, ajustes: guardados.ajustes }, guardados.ajustes);
      const actualizado = conAjustes.proyecto;
      aplicar(
        actualizado,
        `Alumnado: ${resumen.alumnos.altas} altas y ${resumen.alumnos.actualizados} cambios · Profesorado: ${resumen.profes.altas} altas · Matrículas: +${resumen.matriculas.altas} / −${resumen.matriculas.bajas}${resumen.profesAutomaticos ? ` · Profes automáticos en ${resumen.profesAutomaticos.clasesTocadas} clases` : ''}`,
      );
      if (conAjustes.aplicados > 0) {
        toast.info(
          `${conAjustes.aplicados} campos que habías escrito a mano se han vuelto a poner encima de lo que dice el centro.`,
          { duration: 8000 },
        );
      }
      if (conAjustes.huerfanos.length > 0) {
        toast.info(
          `${conAjustes.huerfanos.length} campos fijados a mano ya no tienen a quién aplicarse (la fila no está): puedes soltarlos desde su ficha.`,
          { duration: 9000 },
        );
      }
      if (guardados.aviso) toast.warning(guardados.aviso, { duration: 12000 });
      if (resumen.fueraDeAlcance.length > 0) {
        const total = resumen.fueraDeAlcance.reduce((n, f) => n + f.n, 0);
        toast.info(`Fuera del alcance (${labelCurso(desdeCurso)} para arriba): ${total} alumnos de ${resumen.fueraDeAlcance.map((f) => f.curso).join(', ')}.`, { duration: 9000 });
      }
      if (resumen.alumnos.sinNia > 0) {
        toast.warning(`${resumen.alumnos.sinNia} alumnos sin NIA en la BBDD central: se les ha puesto un identificador a partir del correo.`, { duration: 9000 });
      }
      const archivados = resumen.alumnos.archivados + resumen.profes.archivados;
      if (archivados > 0) {
        toast.info(`${archivados} cuentas archivadas: siguen en el fichero (no se pierde su iCloud), fuera de las clases y escondidas aquí.`, { duration: 9000 });
      }
      if (resumen.compartidasDetectadas > 0) {
        toast.info(`${resumen.compartidasDetectadas} cuentas de iPad compartido reconocidas: el sync ya no las tocará.`, { duration: 8000 });
      }
      const sinSitio = resumen.profesAutomaticos?.sinSitio ?? [];
      if (sinSitio.length > 0) {
        toast.warning(`${sinSitio.length} clases llegan al tope de 12 profes de ASM: se ha quedado fuera dirección/jefatura (TIC nunca).`, { duration: 9000 });
      }
    } catch (error) {
      console.error('AUTOASM: error trayendo la BBDD central', error);
      toast.error('No he podido leer la BBDD central.');
    } finally {
      setTrabajando(null);
    }
  }

  async function traerDelHorario() {
    if (!proyecto) {
      toast.error('Antes carga la estructura del centro o el ZIP del curso pasado.');
      return;
    }
    setTrabajando('horario');
    try {
      const res = await fetch('/api/autoasm/admin/horario');
      if (!res.ok) throw new Error(String(res.status));
      const { asignaciones } = (await res.json()) as { asignaciones: AsignacionHorario[] };
      if (asignaciones.length === 0) {
        toast.info('El horario del periodo en vigor no tiene ninguna clase todavía.');
        return;
      }
      const resultado = proponerDesdeHorario(proyecto, asignaciones);
      setHorario(resultado);
      const cambian = resultado.propuestas.filter((p) => p.estado !== 'igual').length;
      toast.success(cambian === 0 ? 'El horario dice lo mismo que ya tienes.' : `${cambian} clases por revisar, de ${asignaciones.length} del horario.`);
    } catch (error) {
      console.error('AUTOASM: error leyendo el horario', error);
      toast.error('No he podido leer el horario.');
    } finally {
      setTrabajando(null);
    }
  }

  function aplicarHorario() {
    if (!proyecto || !horario) return;
    const cambian = horario.propuestas.filter((p) => p.estado !== 'igual');
    const conPropuestas = aplicarPropuestas(proyecto, cambian);
    const { filas } = regenerarMatriculas(conPropuestas.archivos, conPropuestas.reglas, conPropuestas.archivados);
    const nuevas = cambian.filter((p) => p.estado === 'nueva').length;
    aplicar(
      {
        ...conPropuestas,
        archivos: limpiarArchivos({ ...conPropuestas.archivos, rosters: filas }, conPropuestas.archivados),
        historial: [...proyecto.historial, { fecha: new Date().toISOString(), texto: `Del horario: ${cambian.length} clases (${nuevas} nuevas)` }].slice(-20),
      },
      `Horario aplicado: ${cambian.length} clases (${nuevas} nuevas).`,
    );
    setHorario(null);
  }

  function rehacerMatriculas() {
    if (!proyecto) return;
    const { filas, altas, bajas } = regenerarMatriculas(proyecto.archivos, proyecto.reglas, proyecto.archivados);
    aplicar(
      { ...proyecto, archivos: { ...proyecto.archivos, rosters: filas } },
      `Matrículas rehechas: ${num(filas.length)} líneas (+${altas} / −${bajas}).`,
    );
  }

  const totalFilas = proyecto ? ORDEN_ARCHIVOS.reduce((n, a) => n + proyecto.archivos[a].length, 0) : 0;
  const listo = proyecto !== null && conteo.errores === 0 && totalFilas > 0;

  return (
    <div className="space-y-8">
      <Resumen proyecto={proyecto} errores={conteo.errores} avisos={conteo.avisos} listo={listo} />

      {estado && <AvisoEstado estado={estado} />}

      {/* PASO 1 · Origen ------------------------------------------------ */}
      <Paso n={1} titulo="De dónde salen los datos" sub="Puedes combinarlos: la estructura del año pasado + el alumnado de hoy.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AccionOrigen
            titulo="Estructura del centro"
            desc="Los cursos y clases que ya existen en ASM (tutorías, asignaturas, PDC y compartidos). Sin personas."
            boton="Cargar estructura"
            icono={<Sparkles />}
            onClick={() => void empezarPlantilla()}
            ocupado={trabajando !== null}
          />
          <div className={cn(claseTarjeta, 'p-4')}>
            <ZonaSubida onFicheros={subir} ocupado={trabajando !== null} leyendo={trabajando === 'subida'} />
          </div>
          <AccionOrigen
            titulo="Alumnado y profesorado"
            desc="Se traen de la BBDD central del colegio, con su NIA como identificador y su correo del centro."
            boton={trabajando === 'centro' ? 'Trayendo…' : 'Traer del centro'}
            icono={<RefreshCw />}
            onClick={traerDelCentro}
            ocupado={trabajando !== null}
            cargando={trabajando === 'centro'}
            destacado
            extra={
              <Campo etiqueta="Alumnado desde" id="asm-alcance" ayuda="El profesorado entra siempre entero, sin filtro." className="mt-3">
                <Selector id="asm-alcance" value={desdeCurso ?? 'todos'} onChange={(e) => cambiarAlcance(e.target.value)}>
                  {CURSOS_CENTRO.map((c) => (
                    <option key={c.curso} value={c.curso}>
                      {c.label} y superiores
                    </option>
                  ))}
                  <option value="todos">Todo el centro</option>
                </Selector>
              </Campo>
            }
          />
          <AccionOrigen
            titulo="Clases desde el horario"
            desc="Cada asignación docente es una clase: materia, profes y grupos que van juntos. Se propone y tú decides."
            boton={trabajando === 'horario' ? 'Leyendo…' : 'Ver qué dice el horario'}
            icono={<CalendarClock />}
            onClick={traerDelHorario}
            ocupado={trabajando !== null}
            cargando={trabajando === 'horario'}
          />
        </div>

        {horario && <PanelHorario resultado={horario} onAplicar={aplicarHorario} onDescartar={() => setHorario(null)} />}

        <Button variant="ghost" size="sm" className="mt-3 -ml-3" aria-expanded={verAjustes} onClick={() => setVerAjustes((v) => !v)}>
          <Settings2 /> Cómo se trae del centro
          <ChevronDown className={cn('transition-transform', verAjustes && 'rotate-180')} />
        </Button>
        {verAjustes && (
          <Tarjeta className="mt-2 space-y-2 p-4">
            <Interruptor
              activo={sync.regenerarMatriculas}
              onChange={(v) => setSync({ ...sync, regenerarMatriculas: v })}
              etiqueta="Rehacer las matrículas"
              descripcion="Cada clase con regla de grupos vuelve a llenarse con el alumnado de esos grupos. Lo normal en septiembre."
            />
            <Interruptor
              activo={sync.repartirProfes}
              onChange={(v) => setSync({ ...sync, repartirProfes: v })}
              etiqueta="Meter solos a TIC, tutores y dirección"
              descripcion="TIC entra en todas las tutorías; en las clases de curso entero entran además los tutores de ese nivel y dirección/jefatura. Si no caben los 12 que admite ASM, se cae antes dirección que TIC."
            />
            <p className="pt-1 text-sm text-zinc-500 dark:text-zinc-400">
              A quien ya no está en la BBDD central no se le borra: se <strong>archiva</strong> (conserva su cuenta y su
              iCloud, sale de las clases y deja de estorbar en las pantallas). Las cuentas de los iPads compartidos no se
              tocan nunca.
            </p>
          </Tarjeta>
        )}
      </Paso>

      {/* PASO 2 · Los ficheros ------------------------------------------ */}
      <Paso n={2} titulo="Los seis ficheros" sub="Toca cualquiera para navegar por sus filas y comprobar lo que sea.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDEN_ARCHIVOS.map((archivo, i) => (
            <motion.div
              key={archivo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03, ease: 'easeOut' }}
            >
              <TarjetaArchivo
                archivo={archivo}
                filas={proyecto?.archivos[archivo].length ?? 0}
                errores={porArchivo[archivo]?.errores ?? 0}
                avisos={porArchivo[archivo]?.avisos ?? 0}
                vacio={proyecto === null}
              />
            </motion.div>
          ))}
        </div>
        {proyecto && (
          <Button variant="outline" className="mt-3" onClick={rehacerMatriculas}>
            <RefreshCw /> Rehacer matrículas con las reglas de grupo
          </Button>
        )}
      </Paso>

      {/* PASO 3 · Revisión ---------------------------------------------- */}
      <Paso n={3} titulo="Revisión" sub="Lo mismo que mira ASM al importar, pero aquí y sin esperar.">
        {proyecto === null ? (
          <Vacio titulo={cargando ? 'Cargando…' : 'Todavía no hay nada que revisar'} className="py-8">
            {!cargando && 'Empieza por el paso 1: en cuanto haya datos, aquí sale lo que ASM rechazaría.'}
          </Vacio>
        ) : (
          <PanelIncidencias incidencias={incidencias} />
        )}
      </Paso>

      {/* PASO 4 · Descarga y entrega ------------------------------------ */}
      <Paso n={4} titulo="Descargar y subir" sub="Un ZIP con los seis CSV… y quién lo sube, que si no, no es una entrega.">
        <PanelEntrega
          proyecto={proyecto}
          errores={conteo.errores}
          avisos={conteo.avisos}
          onOpciones={(csv) => proyecto && guardar({ ...proyecto, opciones: { ...proyecto.opciones, csv } })}
        />
      </Paso>

      {proyecto && <PanelCompartidas proyecto={proyecto} onGuardar={guardar} />}

      {proyecto && (
        <Tarjeta className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">El borrador se guarda solo en este navegador</p>
            <p className="text-zinc-500 dark:text-zinc-400">
              Última vez: {new Date(proyecto.actualizado).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
              {proyecto.historial.length > 0 && ` · ${proyecto.historial[proyecto.historial.length - 1].texto}`}
            </p>
          </div>
          <ConfirmarEnLinea
            etiqueta="Borrar borrador"
            icono={<Trash2 />}
            pregunta="Se borra el borrador de este navegador."
            onConfirmar={() => {
              guardar(null);
              toast.success('Borrador borrado.');
            }}
          />
        </Tarjeta>
      )}
      {dialogo}
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

/** Lo que antes decía la cabecera oscura: qué es esto y cómo está el proyecto. */
function Resumen({ proyecto, errores, avisos, listo }: { proyecto: ProyectoAsm | null; errores: number; avisos: number; listo: boolean }) {
  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        Los seis CSV que pide Apple School Manager, hechos con los datos del colegio, revisados aquí antes de subirlos y
        empaquetados en un ZIP.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {proyecto === null ? (
          <Estado tono="neutro" icono={<Info />}>
            Sin proyecto: empieza por el paso 1
          </Estado>
        ) : listo ? (
          <Estado tono="ok" icono={<CircleCheck />}>
            Listo para importar
          </Estado>
        ) : (
          <Estado tono="error" icono={<TriangleAlert />}>
            {errores} {errores === 1 ? 'error' : 'errores'} que ASM rechazaría
          </Estado>
        )}
        {avisos > 0 && (
          <Estado tono="aviso" icono={<TriangleAlert />}>
            {avisos} {avisos === 1 ? 'aviso' : 'avisos'}
          </Estado>
        )}
        {proyecto && <Etiqueta>{proyecto.opciones.locationName}</Etiqueta>}
      </div>
    </div>
  );
}

interface EstadoApi {
  ultimaSubida: { createdAt: string; modo: string; desdeCurso: string | null } | null;
  ultimaEntrega: { createdAt: string; modo: string } | null;
  alumnosSinPasar: { nombre: string; grupo: string; alta: string }[];
  esTemporada: boolean;
}

/**
 * El aviso de "esto está a medias": o estamos en el arranque de curso y todavía no se ha
 * subido nada, o han entrado alumnos nuevos después de la última subida — que son los que
 * hoy no tendrían cuenta en el iPad.
 */
function AvisoEstado({ estado }: { estado: EstadoApi }) {
  const [todos, setTodos] = useState(false);
  const nuevos = estado.alumnosSinPasar;

  if (nuevos.length === 0 && !estado.esTemporada) {
    if (!estado.ultimaSubida) return null;
    return (
      <Aviso tono="ok">
        Al día: la última entrega se subió el{' '}
        {new Date(estado.ultimaSubida.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
        {estado.ultimaSubida.modo === 'ftp' ? ' por FTP' : ' a mano'}, y desde entonces no ha entrado alumnado nuevo.
      </Aviso>
    );
  }

  const visibles = todos ? nuevos : nuevos.slice(0, 12);
  return (
    <Aviso
      tono="aviso"
      titulo={
        nuevos.length > 0
          ? `${nuevos.length} ${nuevos.length === 1 ? 'alumno no ha pasado' : 'alumnos no han pasado'} por aquí`
          : 'Arranque de curso: todavía no se ha subido nada a Apple School Manager'
      }
    >
      {nuevos.length > 0 ? (
        <>
          <p>
            Se dieron de alta en la BBDD central después de la última subida
            {estado.ultimaSubida &&
              ` (${new Date(estado.ultimaSubida.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })})`}
            , así que hoy no tienen cuenta en el iPad. Trae del centro y vuelve a entregar.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {visibles.map((a) => (
              <li
                key={`${a.nombre}-${a.alta}`}
                className="rounded-md bg-white/80 px-2 py-1 text-xs text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
              >
                {a.nombre} <span className="text-amber-800 dark:text-amber-300">· {a.grupo}</span>
              </li>
            ))}
          </ul>
          {!todos && nuevos.length > visibles.length && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setTodos(true)}>
              Ver los {nuevos.length - visibles.length} restantes
            </Button>
          )}
        </>
      ) : (
        <p>En julio, agosto y septiembre este módulo sube al principio del escritorio hasta que haya una entrega subida.</p>
      )}
    </Aviso>
  );
}

function Paso({ n, titulo, sub, children }: { n: number; titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`asm-paso-${n}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-zinc-900 text-xs font-bold text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900"
        >
          {n}
        </span>
        <h2 id={`asm-paso-${n}`} className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="sr-only">Paso {n}: </span>
          {titulo}
        </h2>
        <p className="basis-full text-sm text-zinc-500 sm:basis-auto dark:text-zinc-400">{sub}</p>
      </div>
      {children}
    </section>
  );
}

function AccionOrigen({
  titulo,
  desc,
  boton,
  icono,
  onClick,
  ocupado,
  cargando,
  destacado,
  extra,
}: {
  titulo: string;
  desc: string;
  boton: string;
  icono: React.ReactNode;
  onClick: () => void;
  ocupado?: boolean;
  cargando?: boolean;
  destacado?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={cn(claseTarjeta, 'flex flex-col p-4')}>
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 [&_svg]:size-5"
      >
        {icono}
      </span>
      <h3 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h3>
      <p className="mt-1 flex-1 text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
      {extra}
      <Button variant={destacado ? 'default' : 'outline'} className="mt-3" onClick={onClick} disabled={ocupado} cargando={cargando}>
        {boton}
      </Button>
    </div>
  );
}

function TarjetaArchivo({
  archivo,
  filas,
  errores,
  avisos,
  vacio,
}: {
  archivo: ArchivoAsm;
  filas: number;
  errores: number;
  avisos: number;
  vacio: boolean;
}) {
  const espec = ESPEC[archivo];
  const estilo = ESTILO[archivo];
  const { Icono } = estilo;
  return (
    <Link
      href={`/gestion/autoasm/${archivo}`}
      className={cn(
        claseTarjeta,
        'group flex h-full flex-col p-4 transition-colors outline-none hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-zinc-50 dark:hover:border-zinc-700 dark:active:bg-zinc-800/60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className={cn('flex size-10 items-center justify-center rounded-xl', estilo.fondo)}>
          <Icono className={cn('size-5', estilo.icono)} />
        </span>
        <span className="text-right">
          <span className="block text-2xl leading-none font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {vacio ? '—' : num(filas)}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">filas</span>
        </span>
      </div>
      <h3 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">{espec.titulo}</h3>
      <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{espec.fichero}</p>
      <p className="mt-1 flex-1 text-sm text-zinc-500 dark:text-zinc-400">{espec.descripcion}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {errores > 0 && (
          <Estado tono="error">
            {errores} {errores === 1 ? 'error' : 'errores'}
          </Estado>
        )}
        {avisos > 0 && (
          <Estado tono="aviso">
            {avisos} {avisos === 1 ? 'aviso' : 'avisos'}
          </Estado>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Explorar <NavPending />
          <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

const GRUPOS_VISIBLES = 12;

function PanelIncidencias({ incidencias }: { incidencias: Incidencia[] }) {
  const [ver, setVer] = useState<'error' | 'aviso'>('error');
  const [todo, setTodo] = useState(false);
  const grupos = useMemo(() => agrupar(incidencias.filter((i) => i.nivel === ver)), [incidencias, ver]);
  const { errores, avisos } = contarIncidencias(incidencias);

  if (incidencias.length === 0) {
    return (
      <Aviso tono="ok">
        Ni un problema: identificadores únicos, referencias completas y todos los campos obligatorios puestos.
      </Aviso>
    );
  }

  return (
    <Tarjeta>
      <div className="border-b border-zinc-100 p-3 dark:border-zinc-800">
        <Segmentado
          etiqueta="Qué incidencias ver"
          valor={ver}
          onChange={(v) => {
            setVer(v);
            setTodo(false);
          }}
          opciones={[
            { valor: 'error', etiqueta: 'Errores', cuenta: errores },
            { valor: 'aviso', etiqueta: 'Avisos', cuenta: avisos },
          ]}
        />
      </div>
      {grupos.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{ver === 'error' ? 'Ningún error.' : 'Ningún aviso.'}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {(todo ? grupos : grupos.slice(0, GRUPOS_VISIBLES)).map((g) => (
            <li key={g.clave} className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', ver === 'error' ? 'bg-red-500' : 'bg-amber-500')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{g.ejemplo.mensaje}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-mono">{ESPEC[g.ejemplo.archivo].fichero}</span>
                  {g.total > 1 && ` · ${g.total} filas`}
                  {g.claves.length > 0 && ` · ${g.claves.slice(0, 4).join(', ')}${g.claves.length > 4 ? '…' : ''}`}
                </p>
              </div>
              <Link
                href={`/gestion/autoasm/${g.ejemplo.archivo}${
                  g.ejemplo.clave ? `?q=${encodeURIComponent(g.ejemplo.clave)}&abrir=${encodeURIComponent(g.ejemplo.clave)}` : ''
                }`}
                className={buttonVariants({ variant: 'outline', size: 'sm', className: '-my-1 shrink-0' })}
              >
                Ver
              </Link>
            </li>
          ))}
          {!todo && grupos.length > GRUPOS_VISIBLES && (
            <li className="px-4 py-2">
              <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setTodo(true)}>
                Ver los {grupos.length - GRUPOS_VISIBLES} tipos restantes
              </Button>
            </li>
          )}
        </ul>
      )}
    </Tarjeta>
  );
}

/** Lo que propone el horario, antes de tocar nada. */
function PanelHorario({
  resultado,
  onAplicar,
  onDescartar,
}: {
  resultado: ResultadoHorario;
  onAplicar: () => void;
  onDescartar: () => void;
}) {
  const [todo, setTodo] = useState(false);
  const cambian = resultado.propuestas.filter((p) => p.estado !== 'igual');
  const nuevas = cambian.filter((p) => p.estado === 'nueva');
  const avisos = resultado.propuestas.flatMap((p) => p.avisos.map((a) => ({ clase: p.classId, aviso: a })));
  const visibles = todo ? cambian : cambian.slice(0, 8);

  return (
    <Tarjeta className="mt-3">
      <TarjetaCabecera
        titulo="Lo que dice el horario"
        descripcion={`${num(cambian.length)} clases cambian (${num(nuevas.length)} nuevas) · ${num(
          resultado.propuestas.length - cambian.length,
        )} ya estaban igual · ${num(resultado.clasesSinHorario.length)} clases de ASM que el horario no menciona (no se tocan)`}
      />

      {cambian.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibles.map((p) => (
            <li key={p.asignacionId} className="flex items-start gap-3 px-4 py-3">
              <Estado tono={p.estado === 'nueva' ? 'info' : 'neutro'} className="mt-0.5">
                {p.estado === 'nueva' ? 'Nueva' : 'Cambia'}
              </Estado>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  {p.className} <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{p.classId}</span>
                </p>
                {p.cambios.map((c) => (
                  <p key={c} className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c}
                  </p>
                ))}
                {p.avisos.map((a) => (
                  <p key={a} className="text-xs text-amber-700 dark:text-amber-400">
                    {a}
                  </p>
                ))}
              </div>
            </li>
          ))}
          {!todo && cambian.length > visibles.length && (
            <li className="px-4 py-2">
              <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setTodo(true)}>
                Ver las {cambian.length - visibles.length} restantes
              </Button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
        <Button onClick={onAplicar} disabled={cambian.length === 0}>
          Aplicar {num(cambian.length)} cambios
        </Button>
        <Button variant="outline" onClick={onDescartar}>
          Descartar
        </Button>
        {avisos.length > 0 && (
          <span className="text-sm text-amber-700 dark:text-amber-400">
            {avisos.length === 1 ? '1 aviso que mirar antes' : `${avisos.length} avisos que mirar antes`}
          </span>
        )}
      </div>
    </Tarjeta>
  );
}

// ─── Utilidades de esta pantalla ──────────────────────────────────────────────

function contarPorArchivo(incidencias: Incidencia[]): Partial<Record<ArchivoAsm, { errores: number; avisos: number }>> {
  const salida: Partial<Record<ArchivoAsm, { errores: number; avisos: number }>> = {};
  for (const inc of incidencias) {
    const actual = salida[inc.archivo] ?? { errores: 0, avisos: 0 };
    if (inc.nivel === 'error') actual.errores += 1;
    else actual.avisos += 1;
    salida[inc.archivo] = actual;
  }
  return salida;
}

/**
 * 300 filas sin correo son UN problema, no 300 líneas de lista: se agrupan por fichero,
 * campo y tipo de incidencia (el `tipo` lo pone el validador, así que no hay que
 * adivinarlo del texto del mensaje).
 */
function agrupar(incidencias: Incidencia[]): { clave: string; ejemplo: Incidencia; total: number; claves: string[] }[] {
  const mapa = new Map<string, { clave: string; ejemplo: Incidencia; total: number; claves: string[] }>();
  for (const inc of incidencias) {
    const clave = `${inc.archivo}|${inc.campo ?? ''}|${inc.tipo}`;
    const grupo = mapa.get(clave);
    if (grupo) {
      grupo.total += 1;
      if (grupo.claves.length < 5 && inc.clave) grupo.claves.push(inc.clave);
    } else {
      mapa.set(clave, { clave, ejemplo: inc, total: 1, claves: inc.clave ? [inc.clave] : [] });
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}
