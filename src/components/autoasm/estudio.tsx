'use client';

// Portada del estudio de AUTOASM: de dónde salen los datos → los seis ficheros →
// revisión → ZIP. Los cuatro pasos en una pantalla, porque esto se hace una vez al año
// (y en septiembre, con prisa).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Info,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
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
  inferirReglas,
  inferirTipos,
  labelCurso,
  limpiarArchivos,
  pareceCompartida,
  proyectoDesdePlantilla,
  proyectoVacio,
  regenerarMatriculas,
  sincronizarConCentro,
  type OpcionesSync,
  type ProyectoAsm,
  type SnapshotCentro,
} from '@/lib/autoasm-construir';
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

  function empezarPlantilla() {
    if (proyecto && !confirm('Esto reemplaza el proyecto que tienes empezado. ¿Seguimos?')) return;
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
      const res = await fetch('/api/autoasm/admin/centro');
      if (!res.ok) throw new Error(String(res.status));
      const snapshot = (await res.json()) as SnapshotCentro;
      const base = proyecto ?? proyectoDesdePlantilla(opcionesNuevas);
      const { proyecto: actualizado, resumen } = sincronizarConCentro(base, snapshot, sync);
      aplicar(
        actualizado,
        `Alumnado: ${resumen.alumnos.altas} altas y ${resumen.alumnos.actualizados} cambios · Profesorado: ${resumen.profes.altas} altas · Matrículas: +${resumen.matriculas.altas} / −${resumen.matriculas.bajas}${resumen.profesAutomaticos ? ` · Profes automáticos en ${resumen.profesAutomaticos.clasesTocadas} clases` : ''}`,
      );
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
    <div className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
      <Cabecera proyecto={proyecto} errores={conteo.errores} avisos={conteo.avisos} listo={listo} />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {estado && <AvisoEstado estado={estado} />}

        {/* PASO 1 · Origen ------------------------------------------------ */}
        <Paso n={1} titulo="De dónde salen los datos" sub="Puedes combinarlos: la estructura del año pasado + el alumnado de hoy.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AccionOrigen
              titulo="Estructura del centro"
              desc="Los cursos y clases que ya existen en ASM (tutorías, asignaturas, PDC y compartidos). Sin personas."
              boton="Cargar estructura"
              icono={<Sparkles className="h-5 w-5" />}
              onClick={empezarPlantilla}
              ocupado={trabajando !== null}
            />
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <ZonaSubida onFicheros={subir} ocupado={trabajando !== null} />
              {trabajando === 'subida' && (
                <p className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo…
                </p>
              )}
            </div>
            <AccionOrigen
              titulo="Alumnado y profesorado"
              desc="Se traen de la BBDD central del colegio, con su NIA como identificador y su correo del centro."
              boton={trabajando === 'centro' ? 'Trayendo…' : 'Traer del centro'}
              icono={trabajando === 'centro' ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              onClick={traerDelCentro}
              ocupado={trabajando !== null}
              destacado
              extra={
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Alumnado desde</span>
                  <select
                    value={desdeCurso ?? 'todos'}
                    onChange={(e) => cambiarAlcance(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {CURSOS_CENTRO.map((c) => (
                      <option key={c.curso} value={c.curso}>{c.label} y superiores</option>
                    ))}
                    <option value="todos">Todo el centro</option>
                  </select>
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    El profesorado entra siempre entero, sin filtro.
                  </span>
                </label>
              }
            />
            <AccionOrigen
              titulo="Clases desde el horario"
              desc="Cada asignación docente es una clase: materia, profes y grupos que van juntos. Se propone y tú decides."
              boton={trabajando === 'horario' ? 'Leyendo…' : 'Ver qué dice el horario'}
              icono={trabajando === 'horario' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CalendarClock className="h-5 w-5" />}
              onClick={traerDelHorario}
              ocupado={trabajando !== null}
            />
          </div>

          {horario && <PanelHorario resultado={horario} onAplicar={aplicarHorario} onDescartar={() => setHorario(null)} />}

          <button
            type="button"
            onClick={() => setVerAjustes((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <Settings2 className="h-3.5 w-3.5" /> Cómo se trae del centro
          </button>
          {verAjustes && (
            <div className="mt-2 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <Interruptor
                valor={sync.regenerarMatriculas}
                onChange={(v) => setSync({ ...sync, regenerarMatriculas: v })}
                titulo="Rehacer las matrículas"
                desc="Cada clase con regla de grupos vuelve a llenarse con el alumnado de esos grupos. Lo normal en septiembre."
              />
              <Interruptor
                valor={sync.repartirProfes}
                onChange={(v) => setSync({ ...sync, repartirProfes: v })}
                titulo="Meter solos a TIC, tutores y dirección"
                desc="TIC entra en todas las tutorías; en las clases de curso entero entran además los tutores de ese nivel y dirección/jefatura. Si no caben los 12 que admite ASM, se cae antes dirección que TIC."
              />
              <p className="pt-1 text-xs text-zinc-500">
                A quien ya no está en la BBDD central no se le borra: se <strong>archiva</strong> (conserva su cuenta y su
                iCloud, sale de las clases y deja de estorbar en las pantallas). Las cuentas de los iPads compartidos no se
                tocan nunca.
              </p>
            </div>
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
            <button
              type="button"
              onClick={rehacerMatriculas}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="h-4 w-4" /> Rehacer matrículas con las reglas de grupo
            </button>
          )}
        </Paso>

        {/* PASO 3 · Revisión ---------------------------------------------- */}
        <Paso n={3} titulo="Revisión" sub="Lo mismo que mira ASM al importar, pero aquí y sin esperar.">
          {proyecto === null ? (
            <p className="text-sm text-zinc-500">{cargando ? 'Cargando…' : 'Todavía no hay nada que revisar.'}</p>
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <div>
              <p className="font-medium text-zinc-700 dark:text-zinc-300">El borrador se guarda solo en este navegador</p>
              <p>
                Última vez: {new Date(proyecto.actualizado).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                {proyecto.historial.length > 0 && ` · ${proyecto.historial[proyecto.historial.length - 1].texto}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!confirm('Se borra el borrador de este navegador. ¿Seguro?')) return;
                guardar(null);
                toast.success('Borrador borrado.');
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Trash2 className="h-3.5 w-3.5" /> Borrar borrador
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

function Cabecera({ proyecto, errores, avisos, listo }: { proyecto: ProyectoAsm | null; errores: number; avisos: number; listo: boolean }) {
  return (
    <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-zinc-900 via-blue-950 to-zinc-900 dark:border-zinc-800">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:34px_34px]"
      />
      <div className="relative mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">Apple School Manager</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">AUTOASM</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-300">
              Los seis CSV que come ASM, generados desde los datos del colegio, revisados antes de subirlos y empaquetados en un ZIP.
            </p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-white/20 px-3 text-sm text-white/90 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {proyecto === null ? (
            <Pastilla tono="neutro" icono={<Info className="h-3.5 w-3.5" />} texto="Sin proyecto: empieza por el paso 1" />
          ) : listo ? (
            <Pastilla tono="ok" icono={<CheckCircle2 className="h-3.5 w-3.5" />} texto="Listo para importar" />
          ) : (
            <Pastilla tono="error" icono={<TriangleAlert className="h-3.5 w-3.5" />} texto={`${errores} error(es) que ASM rechazaría`} />
          )}
          {avisos > 0 && <Pastilla tono="aviso" icono={<AlertTriangle className="h-3.5 w-3.5" />} texto={`${avisos} aviso(s)`} />}
          {proyecto && <Pastilla tono="neutro" texto={proyecto.opciones.locationName} />}
        </div>
      </div>
    </header>
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
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-500/10">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          Al día: la última entrega se subió el{' '}
          {new Date(estado.ultimaSubida.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
          {estado.ultimaSubida.modo === 'ftp' ? ' por FTP' : ' a mano'}, y desde entonces no ha entrado alumnado nuevo.
        </p>
      </div>
    );
  }

  const visibles = todos ? nuevos : nuevos.slice(0, 12);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-500/10">
      <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        {nuevos.length > 0
          ? `${nuevos.length} alumno(s) no han pasado por aquí`
          : 'Arranque de curso: todavía no se ha subido nada a Apple School Manager'}
      </p>
      {nuevos.length > 0 ? (
        <>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Se dieron de alta en la BBDD central después de la última subida
            {estado.ultimaSubida && ` (${new Date(estado.ultimaSubida.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })})`}
            , así que hoy no tienen cuenta en el iPad. Trae del centro y vuelve a entregar.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {visibles.map((a) => (
              <li key={`${a.nombre}-${a.alta}`} className="rounded-full bg-white/70 px-2.5 py-1 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                {a.nombre} <span className="opacity-70">· {a.grupo}</span>
              </li>
            ))}
          </ul>
          {!todos && nuevos.length > visibles.length && (
            <button type="button" onClick={() => setTodos(true)} className="mt-2 text-xs font-medium text-amber-900 underline dark:text-amber-200">
              Ver los {nuevos.length - visibles.length} restantes
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          En julio, agosto y septiembre este módulo sube al principio del escritorio hasta que haya una entrega subida.
        </p>
      )}
    </div>
  );
}

function Pastilla({ tono, texto, icono }: { tono: 'ok' | 'aviso' | 'error' | 'neutro'; texto: string; icono?: React.ReactNode }) {
  const tonos = {
    ok: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
    aviso: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
    error: 'bg-red-500/15 text-red-200 ring-red-400/30',
    neutro: 'bg-white/10 text-zinc-200 ring-white/15',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${tonos[tono]}`}>
      {icono}
      {texto}
    </span>
  );
}

function Paso({ n, titulo, sub, children }: { n: number; titulo: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
          {n}
        </span>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</h2>
        <p className="hidden text-xs text-zinc-500 sm:block">{sub}</p>
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
  destacado,
  extra,
}: {
  titulo: string;
  desc: string;
  boton: string;
  icono: React.ReactNode;
  onClick: () => void;
  ocupado?: boolean;
  destacado?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border bg-white p-4 dark:bg-zinc-900 ${destacado ? 'border-blue-300 dark:border-blue-800' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${destacado ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
        {icono}
      </span>
      <p className="mt-3 font-medium text-zinc-900 dark:text-zinc-100">{titulo}</p>
      <p className="mt-1 flex-1 text-xs text-zinc-500">{desc}</p>
      {extra}
      <button
        type="button"
        onClick={onClick}
        disabled={ocupado}
        className={`mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
          destacado
            ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
        }`}
      >
        {boton}
      </button>
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
      className={`group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition-colors dark:border-zinc-800 dark:bg-zinc-900 ${estilo.borde}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${estilo.fondo}`}>
          <Icono className={`h-5 w-5 ${estilo.icono}`} />
        </span>
        <span className="text-right">
          <span className="block text-2xl font-bold leading-none text-zinc-900 tabular-nums dark:text-zinc-100">{vacio ? '—' : num(filas)}</span>
          <span className="text-[11px] text-zinc-400">filas</span>
        </span>
      </div>
      <p className="mt-3 font-medium text-zinc-900 dark:text-zinc-100">{espec.titulo}</p>
      <p className="font-mono text-[11px] text-zinc-400">{espec.fichero}</p>
      <p className="mt-1 flex-1 text-xs text-zinc-500">{espec.descripcion}</p>
      <div className="mt-3 flex items-center gap-2">
        {errores > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {errores} error{errores === 1 ? '' : 'es'}
          </span>
        )}
        {avisos > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {avisos} aviso{avisos === 1 ? '' : 's'}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
          Explorar <ArrowRight className="h-3.5 w-3.5" />
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
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-500/10">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          Ni un problema: identificadores únicos, referencias completas y todos los campos obligatorios puestos.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        {(['error', 'aviso'] as const).map((nivel) => {
          const n = nivel === 'error' ? errores : avisos;
          const activo = ver === nivel;
          return (
            <button
              key={nivel}
              type="button"
              onClick={() => { setVer(nivel); setTodo(false); }}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors ${
                activo
                  ? nivel === 'error'
                    ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {nivel === 'error' ? <TriangleAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {n} {nivel === 'error' ? 'errores' : 'avisos'}
            </button>
          );
        })}
      </div>
      {grupos.length === 0 ? (
        <p className="p-4 text-sm text-zinc-500">Nada por aquí.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {(todo ? grupos : grupos.slice(0, GRUPOS_VISIBLES)).map((g) => (
            <li key={g.clave} className="flex items-start gap-3 p-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ver === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{g.ejemplo.mensaje}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  <span className="font-mono">{ESPEC[g.ejemplo.archivo].fichero}</span>
                  {g.total > 1 && ` · ${g.total} filas`}
                  {g.claves.length > 0 && ` · ${g.claves.slice(0, 4).join(', ')}${g.claves.length > 4 ? '…' : ''}`}
                </p>
              </div>
              <Link
                href={`/gestion/autoasm/${g.ejemplo.archivo}${g.ejemplo.clave ? `?q=${encodeURIComponent(g.ejemplo.clave)}` : ''}`}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
              >
                Ver
              </Link>
            </li>
          ))}
          {!todo && grupos.length > GRUPOS_VISIBLES && (
            <li className="p-3">
              <button
                type="button"
                onClick={() => setTodo(true)}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Ver los {grupos.length - GRUPOS_VISIBLES} tipos restantes
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
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
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white dark:border-emerald-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Lo que dice el horario</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {num(cambian.length)} clases cambian ({num(nuevas.length)} nuevas) · {num(resultado.propuestas.length - cambian.length)} ya estaban igual ·{' '}
          {num(resultado.clasesSinHorario.length)} clases de ASM que el horario no menciona (no se tocan)
        </p>
      </div>

      {cambian.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visibles.map((p) => (
            <li key={p.asignacionId} className="flex items-start gap-3 p-3">
              <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                p.estado === 'nueva'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
              }`}>
                {p.estado === 'nueva' ? 'nueva' : 'cambia'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  {p.className} <span className="font-mono text-[11px] text-zinc-400">{p.classId}</span>
                </p>
                {p.cambios.map((c) => (
                  <p key={c} className="text-xs text-zinc-500">{c}</p>
                ))}
                {p.avisos.map((a) => (
                  <p key={a} className="text-xs text-amber-600 dark:text-amber-400">{a}</p>
                ))}
              </div>
            </li>
          ))}
          {!todo && cambian.length > visibles.length && (
            <li className="p-3">
              <button type="button" onClick={() => setTodo(true)} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                Ver las {cambian.length - visibles.length} restantes
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onAplicar}
          disabled={cambian.length === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
        >
          Aplicar {num(cambian.length)} cambios
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className="inline-flex min-h-11 items-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Descartar
        </button>
        {avisos.length > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {avisos.length === 1 ? '1 aviso que mirar antes' : `${avisos.length} avisos que mirar antes`}
          </span>
        )}
      </div>
    </div>
  );
}

function Interruptor({ valor, onChange, titulo, desc }: { valor: boolean; onChange: (v: boolean) => void; titulo: string; desc: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      onClick={() => { haptic.tap(); onChange(!valor); }}
      className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      <span className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${valor ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${valor ? 'translate-x-4' : ''}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{titulo}</span>
        <span className="block text-xs text-zinc-500">{desc}</span>
      </span>
    </button>
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
