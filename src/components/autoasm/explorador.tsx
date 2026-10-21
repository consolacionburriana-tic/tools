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

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Pin,
  Plus,
  Search,
  Tablet,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  CAMPOS_INSTRUCTOR,
  campoEditable,
  ESPEC,
  ORDEN_ARCHIVOS,
  POLITICAS_PASSWORD,
  type ArchivoAsm,
  type CampoAsm,
  type FilaCsv,
} from '@/lib/autoasm';
import {
  ARCHIVOS_CREABLES,
  crearFila,
  darDeBaja,
  editarFila,
  type AjusteAsm,
  type ProyectoAsm,
} from '@/lib/autoasm-construir';
import { Button, buttonVariants } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { Secciones } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { SkeletonTabla } from '@/components/ui/skeleton';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
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

export function ExploradorAsm({
  archivo,
  consultaInicial,
  abrirInicial,
}: {
  archivo: ArchivoAsm;
  consultaInicial: string;
  /** Clave de la fila cuya ficha se abre de entrada (los avisos enlazan así, para ir directo). */
  abrirInicial?: string;
}) {
  const { proyecto, cargando, guardar } = useProyecto();
  const [q, setQ] = useState(consultaInicial);
  const [faceta, setFaceta] = useState<{ campo: string; valor: string } | null>(null);
  const [orden, setOrden] = useState<{ campo: string; desc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);
  const [abierta, setAbierta] = useState<string | null>(abrirInicial ?? null); // clave de la fila abierta
  const [verVacias, setVerVacias] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);
  const [creando, setCreando] = useState(false);

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

  const abrir = (clave: string) => setAbierta(clave);

  return (
    <div className="space-y-4">
      <EnlaceVolver href="/gestion/autoasm">AUTOASM</EnlaceVolver>
      <TituloPagina
        className="mb-0"
        antes={<span className="font-mono">{espec.fichero}</span>}
        descripcion={
          proyecto ? (
            <span className="tabular-nums">
              {num(visibles.length)} de {num(filas.length)} filas
              {faceta && ` · ${faceta.valor}`}
            </span>
          ) : undefined
        }
        acciones={
          <>
            {ARCHIVOS_CREABLES.includes(archivo) && (
              <Button
                variant="outline"
                size="sm"
                disabled={!proyecto}
                onClick={() => {
                  setCreando(true);
                  haptic.tap();
                }}
              >
                <Plus /> Nueva fila
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!proyecto}
              onClick={() => {
                if (!proyecto) return;
                descargarCsv(archivo, filas, proyecto.opciones.csv);
                haptic.success();
                toast.success(`${espec.fichero} descargado.`);
              }}
            >
              <Download /> Descargar CSV
            </Button>
          </>
        }
      >
        <span className="flex items-center gap-2.5">
          <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', estilo.fondo)}>
            <estilo.Icono className={cn('size-5', estilo.icono)} />
          </span>
          {espec.titulo}
        </span>
      </TituloPagina>

      {/* Los seis ficheros, para saltar de uno a otro sin volver a la portada. El punto es el color de cada fichero. */}
      <Secciones
        etiqueta="Los seis ficheros"
        secciones={ORDEN_ARCHIVOS.map((a) => ({
          href: `/gestion/autoasm/${a}`,
          etiqueta: ESPEC[a].titulo,
          icono: <span aria-hidden className={cn('size-2 rounded-full', ESTILO[a].solido)} />,
          cuenta: proyecto ? proyecto.archivos[a].length : undefined,
        }))}
      />

      {proyecto === null ? (
        cargando ? (
          <SkeletonTabla n={8} columnas={5} />
        ) : (
          <Vacio
            titulo="No hay ningún proyecto empezado"
            accion={
              <Link href="/gestion/autoasm" className={buttonVariants()}>
                Empezar en la portada
              </Link>
            }
          >
            El borrador vive en este navegador: se empieza cargando la estructura del centro o el ZIP del curso pasado.
          </Vacio>
        )
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{espec.descripcion}</p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPagina(0);
                }}
                placeholder={`Buscar en ${espec.fichero}… (nombre, id, correo)`}
                aria-label={`Buscar en ${espec.fichero}`}
                className="pr-12 pl-9"
              />
              {q && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Borrar la búsqueda"
                  onClick={() => setQ('')}
                  className="absolute top-1/2 right-0.5 -translate-y-1/2"
                >
                  <X />
                </Button>
              )}
            </div>
            {valoresFaceta.map(({ campo, valores }) => (
              <Selector
                key={campo}
                aria-label={`Filtrar por ${campo}`}
                value={faceta?.campo === campo ? faceta.valor : ''}
                onChange={(e) => {
                  setFaceta(e.target.value ? { campo, valor: e.target.value } : null);
                  setPagina(0);
                }}
                className="sm:w-56"
              >
                <option value="">Todos · {campo}</option>
                {valores.map((v) => (
                  <option key={v} value={v}>
                    {indice ? etiqueta(campo, v, indice) ?? v : v}
                  </option>
                ))}
              </Selector>
            ))}
            {(cuantosArchivados > 0 || vacias.length > 0) && (
              <Filtros etiqueta="Enseñar también">
                {cuantosArchivados > 0 && (
                  <Filtro activo={verArchivados} onClick={() => setVerArchivados((v) => !v)} cuenta={cuantosArchivados}>
                    Archivados
                  </Filtro>
                )}
                {vacias.length > 0 && (
                  <Filtro activo={verVacias} onClick={() => setVerVacias((v) => !v)} cuenta={vacias.length}>
                    Columnas vacías
                  </Filtro>
                )}
              </Filtros>
            )}
          </div>

          <div className={cn(claseTarjeta, 'overflow-hidden')}>
            {/* El scroll va dentro de la tarjeta para que la cabecera de la tabla se quede fija de verdad. */}
            <div className="max-h-[70dvh] overflow-auto overscroll-contain">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr>
                    {columnas.map((campo) => {
                      const activo = orden?.campo === campo.nombre;
                      return (
                        <th
                          key={campo.nombre}
                          scope="col"
                          aria-sort={activo ? (orden.desc ? 'descending' : 'ascending') : undefined}
                          className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 p-0 font-medium whitespace-nowrap text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          <button
                            type="button"
                            title={campo.ayuda}
                            onClick={() =>
                              setOrden(activo && !orden.desc ? { campo: campo.nombre, desc: true } : { campo: campo.nombre, desc: false })
                            }
                            className="inline-flex h-10 w-full items-center gap-1 px-3 font-mono text-xs outline-none hover:text-zinc-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:hover:text-zinc-100"
                          >
                            {campo.nombre === 'instructor_id' && archivo === 'classes' ? 'profesorado' : campo.nombre}
                            {activo && (orden.desc ? <ArrowUpAZ aria-hidden className="h-3.5 w-3.5" /> : <ArrowDownAZ aria-hidden className="h-3.5 w-3.5" />)}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {trozo.map((fila, i) => {
                    const clave = fila[espec.clave];
                    const archivada = archivados.has(clave);
                    return (
                      <tr
                        key={`${clave}-${i}`}
                        onClick={() => abrir(clave)}
                        className={cn(
                          'cursor-pointer even:bg-zinc-50/60 hover:bg-zinc-100 dark:even:bg-zinc-800/30 dark:hover:bg-zinc-800/60',
                          archivada && 'text-zinc-500',
                        )}
                      >
                        {columnas.map((campo) => (
                          <td key={campo.nombre} className="px-3 py-2 align-top">
                            {campo.nombre === espec.clave ? (
                              <CeldaClave
                                archivo={archivo}
                                fila={fila}
                                indice={indice}
                                archivada={archivada}
                                onAbrir={() => abrir(clave)}
                              />
                            ) : (
                              <Celda archivo={archivo} fila={fila} campo={campo.nombre} indice={indice} />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {trozo.length === 0 && (
                    <tr>
                      <td colSpan={columnas.length} className="px-3 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Nada que enseñar con ese filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
                <Button variant="ghost" size="sm" disabled={pag === 0} onClick={() => setPagina(pag - 1)}>
                  <ChevronLeft /> Anterior
                </Button>
                <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                  Página {pag + 1} de {paginas}
                </span>
                <Button variant="ghost" size="sm" disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)}>
                  Siguiente <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {proyecto && creando && (
        <NuevaFila
          archivo={archivo}
          proyecto={proyecto}
          onCerrar={() => setCreando(false)}
          onGuardar={(p) => guardar(p)}
          onCreada={(nueva) => {
            setCreando(false);
            setAbierta(nueva);
          }}
        />
      )}

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
    if (profes.length === 0) return <Estado tono="aviso">Sin profe</Estado>;
    return (
      <span className="flex flex-wrap gap-1">
        {profes.map((p) => (
          <Etiqueta key={p}>{indice?.profes.get(p) ?? p}</Etiqueta>
        ))}
      </span>
    );
  }

  const valor = fila[campo] ?? '';
  if (!valor) return <span className="text-zinc-400 dark:text-zinc-600">—</span>;

  const destino = DESTINO[campo];
  const nombre = indice ? etiqueta(campo, valor, indice) : null;
  const esClave = campo === ESPEC[archivo].clave;

  if (destino) {
    return (
      <Link
        href={`/gestion/autoasm/${destino}?q=${encodeURIComponent(valor)}`}
        onClick={(e) => e.stopPropagation()}
        className="-mx-1 inline-flex min-h-10 flex-col justify-center rounded-lg px-1 outline-none hover:bg-blue-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-blue-500/10"
      >
        <span className="font-mono text-xs text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">{valor}</span>
        {nombre && <span className="text-xs text-zinc-500 dark:text-zinc-400">{nombre}</span>}
      </Link>
    );
  }
  return (
    <span className="block">
      <span className={esClave ? 'font-mono text-xs text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}>{valor}</span>
      {nombre && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{nombre}</span>}
    </span>
  );
}

/**
 * La primera columna: el identificador de la fila, que abre su ficha. Es un botón de verdad
 * para que también se llegue con el teclado (la fila entera solo se toca con el dedo o el ratón).
 */
function CeldaClave({
  archivo,
  fila,
  indice,
  archivada,
  onAbrir,
}: {
  archivo: ArchivoAsm;
  fila: FilaCsv;
  indice: Indice | null;
  archivada: boolean;
  onAbrir: () => void;
}) {
  const campo = ESPEC[archivo].clave;
  const valor = fila[campo] ?? '';
  const nombre = indice ? etiqueta(campo, valor, indice) : null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAbrir();
      }}
      className="-mx-1 flex min-h-10 flex-col items-start justify-center rounded-lg px-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">{valor || '—'}</span>
      {nombre && <span className="text-xs text-zinc-500 dark:text-zinc-400">{nombre}</span>}
      {archivada && (
        <Estado tono="neutro" className="mt-1">
          Archivado
        </Estado>
      )}
    </button>
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

  // Al abrir, el foco va a la ventana y no al primer campo: así no salta el teclado del iPad.
  const ventana = useRef<HTMLDivElement>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" ref={ventana} initialFocus={ventana} className="sm:max-w-lg">
        <DialogHeader>
          <Rotulo as="p">{espec.titulo}</Rotulo>
          <DialogTitle className="font-mono text-base break-all">{clave}</DialogTitle>
          {(archivo === 'students' || archivo === 'staff' || archivo === 'classes') && (
            <DialogDescription>
              {archivo === 'students' && `${fila.first_name} ${fila.last_name} · ${fila.grade_level}`}
              {archivo === 'staff' && `${fila.first_name} ${fila.last_name}`}
              {archivo === 'classes' && `${fila.class_number} · ${indice.cursos.get(fila.course_id) ?? fila.course_id}`}
            </DialogDescription>
          )}
          {(proyecto.archivados.includes(clave) || proyecto.compartidas.includes(clave)) && (
            <span className="flex flex-wrap gap-1.5 pt-1">
              {proyecto.archivados.includes(clave) && <Estado tono="neutro">Archivado</Estado>}
              {proyecto.compartidas.includes(clave) && <Estado tono="info">iPad compartido</Estado>}
            </span>
          )}
        </DialogHeader>

        <dl className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {campos.map((campo) => (
            <div key={campo.nombre} className="px-3 py-2.5">
              <dt className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{campo.nombre}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{campo.obligatorio ? 'obligatorio' : 'opcional'}</span>
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                {campoEditable(archivo, campo.nombre) ? (
                  <CampoEscribible
                    key={fila[campo.nombre] ?? ''}
                    archivo={archivo}
                    clave={clave}
                    campo={campo}
                    valor={fila[campo.nombre] ?? ''}
                    proyecto={proyecto}
                    onGuardar={onGuardar}
                  />
                ) : (
                  <Celda archivo={archivo} fila={fila} campo={campo.nombre} indice={indice} />
                )}
              </dd>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{campo.ayuda}</p>
            </div>
          ))}
        </dl>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Los campos se escriben aquí mismo y se guardan al salir del recuadro. Lo que escribas queda <strong>fijado</strong>{' '}
          (la chincheta verde): se guarda en la base de datos del colegio y se vuelve a poner después de cada «traer del
          centro», así que ya no se pierde ni al cambiar de dispositivo. El identificador y las referencias a otros ficheros
          no se tocan: cambiar un <code className="font-mono text-xs">person_id</code> no renombra a nadie en ASM, crea una
          cuenta nueva.
          {archivo === 'staff' && (
            <>
              {' '}
              Si lo que quieres es cambiarle el nombre a un profe <em>en todas partes</em> (correos, cuaderno, paneles), hazlo
              en{' '}
              <Link href="/gestion/profes" className="font-medium text-blue-700 underline dark:text-blue-400">
                Profesorado → Nombre visible
              </Link>
              .
            </>
          )}
        </p>

        {(archivo === 'students' || archivo === 'staff') && (
          <AccionesPersona archivo={archivo} personId={clave} proyecto={proyecto} onGuardar={onGuardar} onCerrar={onCerrar} />
        )}

        {archivo === 'classes' && <EditorClase clase={fila} proyecto={proyecto} indice={indice} onGuardar={onGuardar} />}

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
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dar de alta una fila a mano. Para lo que no sale de ninguna base de datos del colegio:
 * la cuenta de servicio o de supervisión que pide Apple, un curso o una clase que no está
 * en ningún horario.
 *
 * Al crear sí se pide el identificador —es lo que ASM usa para siempre para reconocer la
 * fila— y se admiten las referencias a otro fichero, comprobando que existan. Lo que no se
 * rellene sale vacío, y `crearFila` se queja antes de guardar si falta algo obligatorio.
 */
function NuevaFila({
  archivo,
  proyecto,
  onCerrar,
  onGuardar,
  onCreada,
}: {
  archivo: ArchivoAsm;
  proyecto: ProyectoAsm;
  onCerrar: () => void;
  onGuardar: (p: ProyectoAsm) => { ok: boolean; error?: string };
  onCreada: (clave: string) => void;
}) {
  const espec = ESPEC[archivo];
  // Los instructores de una clase se ponen luego en su ficha, con nombres en vez de ids.
  const campos = espec.campos.filter((c) => !c.nombre.startsWith('instructor_id'));
  // El centro ya viene puesto: es el mismo para todas las filas del proyecto.
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    if (espec.campos.some((c) => c.nombre === 'location_id')) inicial.location_id = proyecto.opciones.locationId;
    return inicial;
  });

  function crear() {
    const { proyecto: siguiente, error, clave } = crearFila(proyecto, archivo, valores);
    if (error || !clave) {
      toast.error(error ?? 'No se ha podido crear');
      haptic.warning();
      return;
    }
    const r = onGuardar(siguiente);
    if (!r.ok && r.error) toast.warning(r.error);
    toast.success(`Alta en ${espec.fichero}: ${clave}.`);
    haptic.success();
    onCreada(clave);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogHeader>
          <Rotulo as="p">Nueva fila</Rotulo>
          <DialogTitle>{espec.titulo}</DialogTitle>
          <DialogDescription>{espec.descripcion}</DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {campos.map((campo) => (
            <div key={campo.nombre} className="px-3 py-2.5">
              <dt className="flex items-baseline justify-between gap-2">
                <label htmlFor={`nueva-${campo.nombre}`} className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  {campo.nombre}
                </label>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {campo.nombre === espec.clave ? 'identificador' : campo.obligatorio ? 'obligatorio' : 'opcional'}
                </span>
              </dt>
              <dd className="mt-1">
                <Input
                  id={`nueva-${campo.nombre}`}
                  value={valores[campo.nombre] ?? ''}
                  onChange={(e) => setValores((v) => ({ ...v, [campo.nombre]: e.target.value }))}
                  spellCheck={false}
                  autoCapitalize={campo.nombre === 'email_address' || campo.nombre === 'sis_username' ? 'none' : undefined}
                  placeholder={campo.obligatorio ? 'Hace falta un valor' : 'En blanco'}
                />
              </dd>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{campo.ayuda}</p>
            </div>
          ))}
        </dl>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          El identificador no se puede cambiar después: en ASM, cambiarlo no renombra nada, crea una fila nueva. Esta alta
          vive en el borrador de este dispositivo; para que aguante el próximo «traer del centro», rellena luego sus campos en
          la ficha (quedan fijados con la chincheta verde).
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={crear}>
            <Plus /> Crear la fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Un campo de una fila, escribible en el sitio. Guarda al salir del recuadro (Enter
 * también, Esc deshace) y solo si de verdad ha cambiado; si `editarFila` lo rechaza —un
 * correo repetido, un obligatorio en blanco— se dice por qué y el recuadro vuelve a lo
 * que había, que es lo que está en el fichero.
 *
 * Y se guarda en dos sitios, que es lo importante: en el borrador del navegador (efecto
 * inmediato) y **en Neon** como ajuste fijado, para que el siguiente «traer del centro»
 * —que rehace las filas de quien está en `edu_*`— no se lo lleve por delante. El candado
 * de al lado suelta el ajuste cuando ya no haga falta.
 */
function CampoEscribible({
  archivo,
  clave,
  campo,
  valor,
  proyecto,
  onGuardar,
}: {
  archivo: ArchivoAsm;
  clave: string;
  campo: CampoAsm;
  valor: string;
  proyecto: ProyectoAsm;
  onGuardar: (p: ProyectoAsm) => { ok: boolean; error?: string };
}) {
  const [texto, setTexto] = useState(valor);
  const [ocupado, setOcupado] = useState(false);
  const ajustes = proyecto.ajustes ?? [];
  const esteAjuste = (a: AjusteAsm) => a.archivo === archivo && a.clave === clave && a.campo === campo.nombre;
  const fijado = ajustes.some(esteAjuste);

  async function guardar(nuevo: string) {
    if (nuevo.trim() === valor.trim()) return;
    const { proyecto: siguiente, error } = editarFila(proyecto, archivo, clave, { [campo.nombre]: nuevo });
    if (error) {
      setTexto(valor);
      toast.error(error);
      haptic.warning();
      return;
    }
    const r = onGuardar(siguiente);
    if (!r.ok && r.error) toast.warning(r.error);
    else haptic.success();

    // Que se quede: el borrador es de este dispositivo y lo pisa el próximo sync.
    setOcupado(true);
    try {
      const guardadoValor = siguiente.archivos[archivo].find((f) => f[ESPEC[archivo].clave] === clave)?.[campo.nombre] ?? '';
      const res = await fetch('/api/autoasm/admin/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo, clave, campo: campo.nombre, valor: guardadoValor }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error ?? 'No se ha podido guardar en Neon');
      onGuardar({
        ...siguiente,
        ajustes: [...ajustes.filter((a) => !esteAjuste(a)), { archivo, clave, campo: campo.nombre, valor: guardadoValor }],
      });
    } catch (e) {
      toast.warning(
        `${e instanceof Error ? e.message : 'No se ha podido guardar en Neon'} — el cambio está en este dispositivo, pero el próximo «traer del centro» lo pisará.`,
        { duration: 10000 },
      );
    } finally {
      setOcupado(false);
    }
  }

  async function soltar() {
    setOcupado(true);
    try {
      const res = await fetch('/api/autoasm/admin/ajustes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo, clave, campo: campo.nombre }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(datos.error ?? 'No se ha podido soltar');
      onGuardar({ ...proyecto, ajustes: ajustes.filter((a) => !esteAjuste(a)) });
      toast.success('Suelto: el valor se queda como está, pero el próximo «traer del centro» pondrá lo que diga el centro.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido soltar');
    } finally {
      setOcupado(false);
    }
  }

  // La política de contraseña es un enum de ASM (4, 6 u 8): un desplegable evita el 5.
  const control =
    campo.nombre === 'password_policy' ? (
      <Selector
        value={texto}
        disabled={ocupado}
        aria-label={campo.etiqueta}
        onChange={(e) => {
          setTexto(e.target.value);
          void guardar(e.target.value);
        }}
      >
        <option value="">— sin política —</option>
        {POLITICAS_PASSWORD.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Selector>
    ) : (
      <Input
        value={texto}
        disabled={ocupado}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={(e) => void guardar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setTexto(valor);
            e.currentTarget.blur();
          }
        }}
        inputMode={campo.nombre === 'email_address' ? 'email' : undefined}
        autoCapitalize={campo.nombre === 'email_address' || campo.nombre === 'sis_username' ? 'none' : undefined}
        spellCheck={false}
        placeholder={campo.obligatorio ? 'Hace falta un valor' : 'En blanco'}
        aria-label={campo.etiqueta}
      />
    );

  return (
    <div className="flex items-center gap-2">
      {control}
      {fijado && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => void soltar()}
          disabled={ocupado}
          aria-label="Fijado a mano: aguanta el próximo «traer del centro». Toca para soltarlo."
          className="text-emerald-700 dark:text-emerald-400"
        >
          <Pin />
        </Button>
      )}
    </div>
  );
}

function ListaEnlaces({ titulo, items, vacio }: { titulo: string; items: { id: string; texto: string; sub: string; href: string }[]; vacio: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {titulo}{' '}
        {items.length > 0 && <span className="font-normal text-zinc-500 tabular-nums dark:text-zinc-400">{num(items.length)}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{vacio}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 outline-none first:rounded-t-2xl last:rounded-b-2xl hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{item.texto}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{item.sub}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
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
  const [baja, setBaja] = useState(false);

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
        <Button variant="outline" onClick={() => alternar('archivados')}>
          <Archive /> {archivado ? 'Desarchivar' : 'Archivar'}
        </Button>
        {archivo === 'students' && (
          <Button variant="outline" onClick={() => alternar('compartidas')}>
            <Tablet /> {compartida ? 'No es un iPad compartido' : 'Es un iPad compartido'}
          </Button>
        )}
        <Button
          variant="destructive"
          onClick={() => {
            haptic.warning();
            setBaja(true);
          }}
        >
          <Trash2 /> Dar de baja
        </Button>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Archivar es lo normal cuando alguien se va: la cuenta sigue existiendo en ASM (no se pierde su iCloud), pero deja de
        estar en clases y de aparecer en estas listas.
      </p>
      {/* Lo único destructivo del módulo: antes se preguntaba dos veces; ahora hay que escribir BAJA. */}
      <ConfirmarDialogo
        abierto={baja}
        onCerrar={() => setBaja(false)}
        titulo={`¿Dar de baja a ${personId}?`}
        descripcion="Se borra de students/staff, de sus clases y de sus matrículas. Al desaparecer de la importación, ASM se lleva por delante su cuenta y su iCloud. ¿Seguro que no prefieres archivarla?"
        boton="Dar de baja"
        palabra="BAJA"
        onConfirmar={() => {
          const r = onGuardar(darDeBaja(proyecto, personId));
          if (!r.ok && r.error) toast.warning(r.error);
          toast.success('Dada de baja del fichero.');
          haptic.warning();
          onCerrar();
        }}
      />
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
    onGuardar({
      ...proyecto,
      reglas: { ...proyecto.reglas, [clase.class_id]: nuevos },
      actualizado: new Date().toISOString(),
    });
  }

  const disponibles = proyecto.archivos.staff.filter((s) => !profes.includes(s.person_id));

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Profesorado de la clase</h3>
        <ul className="space-y-1.5">
          {profes.map((p, i) => (
            <li key={p} className="flex items-center gap-2 rounded-xl border border-zinc-200 py-1 pr-1 pl-3 dark:border-zinc-800">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{indice.profes.get(p) ?? p}</span>
                <span className="block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{p}</span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => guardarProfes(profes.filter((x) => x !== p))}
                aria-label={`Quitar a ${indice.profes.get(p) ?? p}`}
              >
                <X />
              </Button>
            </li>
          ))}
          {profes.length === 0 && (
            <li>
              <Estado tono="aviso">Sin profes: en ASM esta clase no la verá nadie</Estado>
            </li>
          )}
        </ul>

        {anadiendo ? (
          <Selector
            autoFocus
            defaultValue=""
            aria-label="Profe que la imparte"
            onChange={(e) => {
              if (e.target.value) guardarProfes([...profes, e.target.value]);
              setAnadiendo(false);
            }}
            onBlur={() => setAnadiendo(false)}
          >
            <option value="">Elige a quien la imparte…</option>
            {disponibles.map((s) => (
              <option key={s.person_id} value={s.person_id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </Selector>
        ) : (
          <Button variant="outline" onClick={() => setAnadiendo(true)}>
            <Plus /> Añadir profe
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quién se matricula</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Los grupos marcados entran enteros cuando se rehacen las matrículas. Ahora mismo hay{' '}
          <span className="font-medium text-zinc-700 tabular-nums dark:text-zinc-200">{num(alumnos.length)} matriculados</span>.
        </p>
        <Filtros etiqueta="Grupos que se matriculan">
          {todosLosGrupos.map((grupo) => (
            <Filtro key={grupo} activo={grupos.includes(grupo)} onClick={() => alternarGrupo(grupo)}>
              {grupo}
            </Filtro>
          ))}
        </Filtros>
        {alumnos.length > 0 && (
          <Link
            href={`/gestion/autoasm/rosters?q=${encodeURIComponent(clase.class_id)}`}
            className={buttonVariants({ variant: 'outline', className: 'mt-1' })}
          >
            <Users aria-hidden /> Ver sus {num(alumnos.length)} matrículas
          </Link>
        )}
      </section>
    </div>
  );
}
