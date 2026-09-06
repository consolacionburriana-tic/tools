'use client';

// Explorador de los CSV: la parte de "déjame comprobar una cosa rápida" sin abrir Excel.
//
// Tres ideas y ya:
//   1. Los identificadores son NAVEGABLES. Un `class_id` en rosters.csv no es un texto,
//      es un enlace a esa clase; y al lado se ve su nombre de verdad, no solo el código.
//   2. La ficha de una fila enseña TODO lo que cuelga de ella (los alumnos de una clase,
//      las clases de un profe), que es lo que uno viene a mirar.
//   3. Lo poco que se edita aquí es lo que no sale de ninguna base de datos: qué profes
//      dan cada clase y qué grupos se matriculan en ella.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  Tablet,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import {
  CAMPOS_INSTRUCTOR,
  ESPEC,
  ORDEN_ARCHIVOS,
  type ArchivoAsm,
  type FilaCsv,
} from '@/lib/autoasm';
import { darDeBaja, type ProyectoAsm } from '@/lib/autoasm-construir';
import { ESTILO, num } from '@/components/autoasm/paleta';
import { useProyecto } from '@/components/autoasm/proyecto-store';
import { descargarCsv } from '@/components/autoasm/descargas';

const POR_PAGINA = 60;

/** Campos por los que se puede filtrar con un desplegable en cada fichero. */
const FACETAS: Partial<Record<ArchivoAsm, string[]>> = {
  students: ['grade_level'],
  classes: ['course_id', 'class_number'],
  rosters: ['class_id'],
};

export function ExploradorAsm({ archivo, consultaInicial }: { archivo: ArchivoAsm; consultaInicial: string }) {
  const { proyecto, cargando, guardar } = useProyecto();
  const [q, setQ] = useState(consultaInicial);
  const [faceta, setFaceta] = useState<{ campo: string; valor: string } | null>(null);
  const [orden, setOrden] = useState<{ campo: string; desc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);
  const [abierta, setAbierta] = useState<string | null>(null); // clave de la fila abierta
  const [verVacias, setVerVacias] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);

  const espec = ESPEC[archivo];
  const estilo = ESTILO[archivo];
  // El `?? []` crearía un array nuevo en cada render y con él se recalcularía todo.
  const filas = useMemo(() => proyecto?.archivos[archivo] ?? [], [proyecto, archivo]);
  const indice = useMemo(() => (proyecto ? construirIndice(proyecto) : null), [proyecto]);

  const archivados = useMemo(() => new Set(proyecto?.archivados ?? []), [proyecto]);
  const conArchivados = archivo === 'students' || archivo === 'staff';
  const cuantosArchivados = useMemo(
    () => (conArchivados ? filas.filter((f) => archivados.has(f[espec.clave])).length : 0),
    [filas, archivados, conArchivados, espec.clave],
  );

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    let salida = filas;
    // Las cuentas archivadas siguen en el fichero (y en el ZIP), pero no estorban aquí.
    if (conArchivados && !verArchivados) salida = salida.filter((f) => !archivados.has(f[espec.clave]));
    if (faceta) salida = salida.filter((f) => (f[faceta.campo] ?? '') === faceta.valor);
    if (texto) {
      salida = salida.filter((f) =>
        Object.values(f).some((v) => v.toLowerCase().includes(texto)) ||
        etiquetasDeFila(archivo, f, indice).some((e) => e.toLowerCase().includes(texto)),
      );
    }
    if (orden) {
      const { campo, desc } = orden;
      salida = [...salida].sort((a, b) => {
        const r = (a[campo] ?? '').localeCompare(b[campo] ?? '', 'es', { numeric: true });
        return desc ? -r : r;
      });
    }
    return salida;
  }, [filas, q, faceta, orden, archivo, indice, archivados, conArchivados, verArchivados, espec.clave]);

  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const trozo = visibles.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA);
  const filaAbierta = abierta === null ? null : filas.find((f) => f[espec.clave] === abierta) ?? null;

  const valoresFaceta = useMemo(() => {
    const campos = FACETAS[archivo] ?? [];
    return campos.map((campo) => ({
      campo,
      valores: [...new Set(filas.map((f) => f[campo] ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    }));
  }, [archivo, filas]);

  // Columnas: en classes se colapsan los 12 instructores en una sola columna, que si no
  // la tabla es un campo de puntos y comas. Y las que están vacías en TODAS las filas
  // (person_number, middle_name…) se esconden: ocupan la mitad del ancho para no decir nada.
  const columnasBase = useMemo(
    () => espec.campos.filter((c) => !c.nombre.startsWith('instructor_id') || c.nombre === 'instructor_id'),
    [espec.campos],
  );
  const vacias = useMemo(
    () => columnasBase.filter((c) => c.nombre !== espec.clave && filas.length > 0 && filas.every((f) => (f[c.nombre] ?? '') === '')),
    [columnasBase, filas, espec.clave],
  );
  const columnas = verVacias ? columnasBase : columnasBase.filter((c) => !vacias.includes(c));

  return (
    <div className="min-h-screen bg-zinc-50 pb-16 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${estilo.fondo}`}>
                <estilo.Icono className={`h-5 w-5 ${estilo.icono}`} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                  {espec.titulo} <span className="font-mono text-xs font-normal text-zinc-400">{espec.fichero}</span>
                </h1>
                <p className="truncate text-xs text-zinc-500">
                  {num(visibles.length)} de {num(filas.length)} filas
                  {faceta && ` · ${faceta.valor}`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!proyecto) return;
                  descargarCsv(archivo, filas, proyecto.opciones.csv);
                  haptic.success();
                  toast.success(`${espec.fichero} descargado.`);
                }}
                disabled={!proyecto}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <Link
                href="/gestion/autoasm"
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" /> AUTOASM
              </Link>
            </div>
          </div>

          {/* Pestañas: navegar entre los seis ficheros sin volver a la portada */}
          <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {ORDEN_ARCHIVOS.map((a) => {
              const activo = a === archivo;
              const e = ESTILO[a];
              return (
                <Link
                  key={a}
                  href={`/gestion/autoasm/${a}`}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activo ? e.activo : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${e.solido} ${activo ? '' : 'opacity-40'}`} />
                  {ESPEC[a].titulo}
                  <span className="text-xs opacity-60">{num(proyecto?.archivos[a].length ?? 0)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {proyecto === null ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            {cargando ? 'Cargando…' : (
              <>
                No hay ningún proyecto empezado.{' '}
                <Link href="/gestion/autoasm" className="font-medium text-blue-600 dark:text-blue-400">Empieza en la portada</Link>.
              </>
            )}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-500">{espec.descripcion}</p>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPagina(0); }}
                  placeholder={`Buscar en ${espec.fichero}… (nombre, id, correo)`}
                  className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {valoresFaceta.map(({ campo, valores }) => (
                <select
                  key={campo}
                  value={faceta?.campo === campo ? faceta.valor : ''}
                  onChange={(e) => { setFaceta(e.target.value ? { campo, valor: e.target.value } : null); setPagina(0); }}
                  className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <option value="">Todos · {campo}</option>
                  {valores.map((v) => (
                    <option key={v} value={v}>{indice ? etiqueta(campo, v, indice) ?? v : v}</option>
                  ))}
                </select>
              ))}
              {cuantosArchivados > 0 && (
                <button
                  type="button"
                  onClick={() => setVerArchivados((v) => !v)}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-medium transition-colors ${
                    verArchivados
                      ? 'border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
                      : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  {verArchivados ? 'Ocultar' : 'Ver'} {num(cuantosArchivados)} archivad{cuantosArchivados === 1 ? 'o' : 'os'}
                </button>
              )}
              {vacias.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVerVacias((v) => !v)}
                  className="min-h-11 rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {verVacias ? 'Ocultar' : 'Ver'} {vacias.length} columna{vacias.length === 1 ? '' : 's'} vacía{vacias.length === 1 ? '' : 's'}
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-50 text-left dark:bg-zinc-800/60">
                    <tr>
                      {columnas.map((campo) => {
                        const activo = orden?.campo === campo.nombre;
                        return (
                          <th key={campo.nombre} className="whitespace-nowrap px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">
                            <button
                              type="button"
                              title={campo.ayuda}
                              onClick={() => setOrden(activo && !orden.desc ? { campo: campo.nombre, desc: true } : { campo: campo.nombre, desc: false })}
                              className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
                            >
                              {campo.nombre === 'instructor_id' && archivo === 'classes' ? 'profesorado' : campo.nombre}
                              {activo && (orden.desc ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />)}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {trozo.map((fila, i) => (
                      <tr
                        key={`${fila[espec.clave]}-${i}`}
                        onClick={() => setAbierta(fila[espec.clave])}
                        className={`cursor-pointer even:bg-zinc-50/60 hover:bg-blue-50/60 dark:even:bg-zinc-800/30 dark:hover:bg-blue-500/5 ${
                          archivados.has(fila[espec.clave]) ? 'opacity-50' : ''
                        }`}
                      >
                        {columnas.map((campo) => (
                          <td key={campo.nombre} className="px-3 py-2 align-top">
                            <Celda archivo={archivo} fila={fila} campo={campo.nombre} indice={indice} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {trozo.length === 0 && (
                      <tr>
                        <td colSpan={columnas.length} className="px-3 py-8 text-center text-sm text-zinc-500">
                          Nada que enseñar con ese filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {paginas > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={pag === 0}
                    onClick={() => setPagina(pag - 1)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </button>
                  <span className="text-xs text-zinc-500">Página {pag + 1} de {paginas}</span>
                  <button
                    type="button"
                    disabled={pag >= paginas - 1}
                    onClick={() => setPagina(pag + 1)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {proyecto && filaAbierta && indice && (
        <Ficha
          archivo={archivo}
          fila={filaAbierta}
          proyecto={proyecto}
          indice={indice}
          onCerrar={() => setAbierta(null)}
          onGuardar={(p) => guardar(p)}
        />
      )}
    </div>
  );
}

// ─── Índice de nombres: de identificador a "lo que es" ────────────────────────

interface Indice {
  alumnos: Map<string, { nombre: string; grupo: string }>;
  profes: Map<string, string>;
  clases: Map<string, { nombre: string; curso: string }>;
  cursos: Map<string, string>;
  centros: Map<string, string>;
  clasesDeAlumno: Map<string, string[]>;
  clasesDeProfe: Map<string, string[]>;
  alumnosDeClase: Map<string, string[]>;
  clasesDeCurso: Map<string, string[]>;
}

function construirIndice(proyecto: ProyectoAsm): Indice {
  const { students, staff, classes, courses, locations, rosters } = proyecto.archivos;
  const cursos = new Map(courses.map((c) => [c.course_id, c.course_name]));
  const indice: Indice = {
    alumnos: new Map(students.map((s) => [s.person_id, { nombre: `${s.first_name} ${s.last_name}`.trim(), grupo: s.grade_level }])),
    profes: new Map(staff.map((s) => [s.person_id, `${s.first_name} ${s.last_name}`.trim()])),
    clases: new Map(classes.map((c) => [c.class_id, { nombre: c.class_number, curso: cursos.get(c.course_id) ?? c.course_id }])),
    cursos,
    centros: new Map(locations.map((l) => [l.location_id, l.location_name])),
    clasesDeAlumno: new Map(),
    clasesDeProfe: new Map(),
    alumnosDeClase: new Map(),
    clasesDeCurso: new Map(),
  };
  for (const linea of rosters) {
    empujar(indice.clasesDeAlumno, linea.student_id, linea.class_id);
    empujar(indice.alumnosDeClase, linea.class_id, linea.student_id);
  }
  for (const clase of classes) {
    empujar(indice.clasesDeCurso, clase.course_id, clase.class_id);
    for (const campo of CAMPOS_INSTRUCTOR) {
      const profe = clase[campo];
      if (profe) empujar(indice.clasesDeProfe, profe, clase.class_id);
    }
  }
  return indice;
}

function empujar(mapa: Map<string, string[]>, clave: string, valor: string): void {
  const lista = mapa.get(clave);
  if (lista) lista.push(valor);
  else mapa.set(clave, [valor]);
}

/** Nombre humano de un identificador, según el campo en el que aparece. */
function etiqueta(campo: string, valor: string, indice: Indice): string | null {
  if (!valor) return null;
  if (campo === 'student_id') return indice.alumnos.get(valor)?.nombre ?? null;
  if (campo === 'class_id') {
    const c = indice.clases.get(valor);
    return c ? `${c.nombre} · ${c.curso}` : null;
  }
  if (campo === 'course_id') return indice.cursos.get(valor) ?? null;
  if (campo === 'location_id') return indice.centros.get(valor) ?? null;
  if (campo.startsWith('instructor_id')) return indice.profes.get(valor) ?? null;
  return null;
}

function etiquetasDeFila(archivo: ArchivoAsm, fila: FilaCsv, indice: Indice | null): string[] {
  if (!indice) return [];
  return ESPEC[archivo].campos
    .map((c) => etiqueta(c.nombre, fila[c.nombre] ?? '', indice))
    .filter((x): x is string => x !== null);
}

// ─── Celda: identificadores navegables ────────────────────────────────────────

const DESTINO: Record<string, ArchivoAsm> = {
  student_id: 'students',
  class_id: 'classes',
  course_id: 'courses',
  location_id: 'locations',
};

function Celda({ archivo, fila, campo, indice }: { archivo: ArchivoAsm; fila: FilaCsv; campo: string; indice: Indice | null }) {
  // En classes, la columna de instructores enseña a todos los profes de la fila.
  if (archivo === 'classes' && campo === 'instructor_id') {
    const profes = CAMPOS_INSTRUCTOR.map((c) => fila[c]).filter(Boolean);
    if (profes.length === 0) return <span className="text-xs text-amber-600 dark:text-amber-400">sin profe</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {profes.map((p) => (
          <span key={p} className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
            {indice?.profes.get(p) ?? p}
          </span>
        ))}
      </span>
    );
  }

  const valor = fila[campo] ?? '';
  if (!valor) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;

  const destino = DESTINO[campo];
  const nombre = indice ? etiqueta(campo, valor, indice) : null;
  const esClave = campo === ESPEC[archivo].clave;

  return (
    <span className="block">
      {destino ? (
        <Link
          href={`/gestion/autoasm/${destino}?q=${encodeURIComponent(valor)}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          {valor}
        </Link>
      ) : (
        <span className={esClave ? 'font-mono text-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}>{valor}</span>
      )}
      {nombre && <span className="block text-[11px] text-zinc-500">{nombre}</span>}
    </span>
  );
}

// ─── Ficha de una fila ────────────────────────────────────────────────────────

function Ficha({
  archivo,
  fila,
  proyecto,
  indice,
  onCerrar,
  onGuardar,
}: {
  archivo: ArchivoAsm;
  fila: FilaCsv;
  proyecto: ProyectoAsm;
  indice: Indice;
  onCerrar: () => void;
  onGuardar: (p: ProyectoAsm) => { ok: boolean; error?: string };
}) {
  const espec = ESPEC[archivo];
  const clave = fila[espec.clave];
  const campos = espec.campos.filter((c) => !c.nombre.startsWith('instructor_id'));

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal>
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white/95 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{espec.titulo}</p>
            <p className="truncate font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">{clave}</p>
            {archivo === 'students' && <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{fila.first_name} {fila.last_name} · {fila.grade_level}</p>}
            {archivo === 'staff' && <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{fila.first_name} {fila.last_name}</p>}
            <span className="mt-1 flex flex-wrap gap-1">
              {proyecto.archivados.includes(clave) && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Archivado</span>
              )}
              {proyecto.compartidas.includes(clave) && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">iPad compartido</span>
              )}
            </span>
            {archivo === 'classes' && <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{fila.class_number} · {indice.cursos.get(fila.course_id) ?? fila.course_id}</p>}
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <dl className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {campos.map((campo) => (
              <div key={campo.nombre} className="px-3 py-2">
                <dt className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-zinc-400">{campo.nombre}</span>
                  <span className="text-[11px] text-zinc-400">{campo.obligatorio ? 'obligatorio' : 'opcional'}</span>
                </dt>
                <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
                  <Celda archivo={archivo} fila={fila} campo={campo.nombre} indice={indice} />
                </dd>
                <p className="mt-0.5 text-[11px] text-zinc-500">{campo.ayuda}</p>
              </div>
            ))}
          </dl>

          {(archivo === 'students' || archivo === 'staff') && (
            <AccionesPersona archivo={archivo} personId={clave} proyecto={proyecto} onGuardar={onGuardar} onCerrar={onCerrar} />
          )}

          {archivo === 'classes' && (
            <EditorClase clase={fila} proyecto={proyecto} indice={indice} onGuardar={onGuardar} />
          )}

          {archivo === 'students' && (
            <ListaEnlaces
              titulo="Sus clases"
              vacio="No está matriculado/a en ninguna clase."
              items={(indice.clasesDeAlumno.get(clave) ?? []).map((id) => ({
                id,
                texto: indice.clases.get(id)?.nombre ?? id,
                sub: indice.clases.get(id)?.curso ?? '',
                href: `/gestion/autoasm/classes?q=${encodeURIComponent(id)}`,
              }))}
            />
          )}

          {archivo === 'staff' && (
            <ListaEnlaces
              titulo="Clases que imparte"
              vacio="No aparece como instructor en ninguna clase."
              items={(indice.clasesDeProfe.get(clave) ?? []).map((id) => ({
                id,
                texto: indice.clases.get(id)?.nombre ?? id,
                sub: indice.clases.get(id)?.curso ?? '',
                href: `/gestion/autoasm/classes?q=${encodeURIComponent(id)}`,
              }))}
            />
          )}

          {archivo === 'courses' && (
            <ListaEnlaces
              titulo="Clases de este curso"
              vacio="Este curso no tiene clases."
              items={(indice.clasesDeCurso.get(clave) ?? []).map((id) => ({
                id,
                texto: indice.clases.get(id)?.nombre ?? id,
                sub: `${num((indice.alumnosDeClase.get(id) ?? []).length)} matriculados`,
                href: `/gestion/autoasm/classes?q=${encodeURIComponent(id)}`,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ListaEnlaces({ titulo, items, vacio }: { titulo: string; items: { id: string; texto: string; sub: string; href: string }[]; vacio: string }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {titulo} <span className="text-xs font-normal text-zinc-400">{items.length > 0 && num(items.length)}</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">{vacio}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{item.texto}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{item.sub}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Qué se puede hacer con una persona sin romper nada: archivarla (se queda en el fichero,
 * conserva su cuenta y su iCloud, y sale de las clases), marcarla como cuenta de iPad
 * compartido —para que el sync no la toque nunca— o darla de baja de verdad, que es lo
 * único destructivo del módulo y por eso se pregunta dos veces.
 */
function AccionesPersona({
  archivo,
  personId,
  proyecto,
  onGuardar,
  onCerrar,
}: {
  archivo: ArchivoAsm;
  personId: string;
  proyecto: ProyectoAsm;
  onGuardar: (p: ProyectoAsm) => { ok: boolean; error?: string };
  onCerrar: () => void;
}) {
  const archivado = proyecto.archivados.includes(personId);
  const compartida = proyecto.compartidas.includes(personId);

  function alternar(campo: 'archivados' | 'compartidas') {
    const lista = proyecto[campo];
    const nueva = lista.includes(personId) ? lista.filter((p) => p !== personId) : [...lista, personId];
    haptic.tap();
    onGuardar({ ...proyecto, [campo]: nueva, actualizado: new Date().toISOString() });
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Qué hacer con esta cuenta</h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => alternar('archivados')}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Archive className="h-4 w-4" /> {archivado ? 'Desarchivar' : 'Archivar'}
        </button>
        {archivo === 'students' && (
          <button
            type="button"
            onClick={() => alternar('compartidas')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Tablet className="h-4 w-4" /> {compartida ? 'No es un iPad compartido' : 'Es un iPad compartido'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!confirm('Dar de baja quita a esta persona del fichero. Al desaparecer de la importación, ASM se lleva por delante su cuenta y su iCloud.\n\n¿Seguro que no prefieres archivarla?')) return;
            if (!confirm('Última: se borra de students/staff, de sus clases y de sus matrículas. ¿Continuamos?')) return;
            const r = onGuardar(darDeBaja(proyecto, personId));
            if (!r.ok && r.error) toast.warning(r.error);
            toast.success('Dada de baja del fichero.');
            haptic.warning();
            onCerrar();
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" /> Dar de baja
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Archivar es lo normal cuando alguien se va: la cuenta sigue existiendo en ASM (no se pierde su iCloud), pero deja de
        estar en clases y de aparecer en estas listas.
      </p>
    </section>
  );
}

/**
 * Lo único editable del módulo: los profes de una clase y los grupos que se matriculan
 * en ella. Ninguna de las dos cosas está en Educamos, así que o se ponen aquí o se
 * arrastran del export del año pasado.
 */
function EditorClase({
  clase,
  proyecto,
  indice,
  onGuardar,
}: {
  clase: FilaCsv;
  proyecto: ProyectoAsm;
  indice: Indice;
  onGuardar: (p: ProyectoAsm) => { ok: boolean; error?: string };
}) {
  const [anadiendo, setAnadiendo] = useState(false);
  const profes = CAMPOS_INSTRUCTOR.map((c) => clase[c]).filter(Boolean);
  const alumnos = indice.alumnosDeClase.get(clase.class_id) ?? [];
  const grupos = proyecto.reglas[clase.class_id] ?? [];
  const todosLosGrupos = useMemo(
    () => [...new Set(proyecto.archivos.students.map((s) => s.grade_level).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [proyecto.archivos.students],
  );

  function guardarProfes(lista: string[]) {
    if (lista.length > CAMPOS_INSTRUCTOR.length) {
      toast.error(`Una clase admite como mucho ${CAMPOS_INSTRUCTOR.length} profes en ASM.`);
      return;
    }
    const classes = proyecto.archivos.classes.map((c) => {
      if (c.class_id !== clase.class_id) return c;
      const copia = { ...c };
      CAMPOS_INSTRUCTOR.forEach((campo, i) => { copia[campo] = lista[i] ?? ''; });
      return copia;
    });
    haptic.tap();
    onGuardar({ ...proyecto, archivos: { ...proyecto.archivos, classes }, actualizado: new Date().toISOString() });
  }

  function alternarGrupo(grupo: string) {
    const nuevos = grupos.includes(grupo) ? grupos.filter((g) => g !== grupo) : [...grupos, grupo];
    haptic.tap();
    onGuardar({
      ...proyecto,
      reglas: { ...proyecto.reglas, [clase.class_id]: nuevos },
      actualizado: new Date().toISOString(),
    });
  }

  const disponibles = proyecto.archivos.staff.filter((s) => !profes.includes(s.person_id));

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Profesorado de la clase</h3>
        <ul className="space-y-1.5">
          {profes.map((p, i) => (
            <li key={p} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{indice.profes.get(p) ?? p}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-400">{p}</span>
              </span>
              <button
                type="button"
                onClick={() => guardarProfes(profes.filter((x) => x !== p))}
                className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                aria-label={`Quitar a ${indice.profes.get(p) ?? p}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
          {profes.length === 0 && <li className="text-xs text-amber-600 dark:text-amber-400">Sin profes: en ASM esta clase no la verá nadie.</li>}
        </ul>

        {anadiendo ? (
          <select
            autoFocus
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) guardarProfes([...profes, e.target.value]);
              setAnadiendo(false);
            }}
            onBlur={() => setAnadiendo(false)}
            className="mt-2 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">Elige a quien la imparte…</option>
            {disponibles.map((s) => (
              <option key={s.person_id} value={s.person_id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" /> Añadir profe
          </button>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quién se matricula</h3>
        <p className="mb-2 text-xs text-zinc-500">
          Los grupos marcados entran enteros cuando se rehacen las matrículas. Ahora mismo hay{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{num(alumnos.length)} matriculados</span>.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {todosLosGrupos.map((grupo) => {
            const activo = grupos.includes(grupo);
            return (
              <button
                key={grupo}
                type="button"
                onClick={() => alternarGrupo(grupo)}
                className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                  activo
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                }`}
              >
                {grupo}
              </button>
            );
          })}
        </div>
        {alumnos.length > 0 && (
          <Link
            href={`/gestion/autoasm/rosters?q=${encodeURIComponent(clase.class_id)}`}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Users className="h-4 w-4" /> Ver sus {num(alumnos.length)} matrículas
          </Link>
        )}
      </section>
    </div>
  );
}
