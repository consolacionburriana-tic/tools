'use client';

// Sesiones: el abanico de lo que se hace en cada momento (no confundir con la Agenda, que son
// los momentos planificados). Cada tipo tiene las suyas, con nombre, enlace y el curso en que se
// crearon; cada fila se despliega para editarla y, a la vista, qué niveles pueden hacerla sin
// repetirla (libre · este curso · ya la vieron en un curso anterior). Ficha: docs/26-oratorios.md
import { Archive, ArchiveRestore, BookOpenText, Check, ChevronDown, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado as EstadoPastilla } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { nombreClase } from '@/lib/cursos';
import {
  cursosAcademicosElegibles,
  describirUsos,
  esEnlaceSeguro,
  etiquetaNivel,
  fechaCorta,
  usosQueChocan,
  usosVigentes,
  type SesionCatalogo,
  type SesionOra,
  type TipoMomento,
} from '@/lib/oratorios';
import { api } from './comun';
import { SelectorTipo } from './planificar';
import type { Estado } from './panel';

export function Abanico({ e }: { e: Estado }) {
  const tipo = e.tipos.find((t) => t.id === e.tipoId) ?? e.tipos[0];
  const [abierta, setAbierta] = useState<string | 'nueva' | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const niveles = useMemo(() => (tipo ? [...(e.ctx.nivelesPorTipo?.[tipo.id] ?? [])] : []), [tipo, e.ctx.nivelesPorTipo]);
  const usos = useMemo(() => usosVigentes(e.ctx), [e.ctx]);

  if (!tipo) return <p className="text-sm text-zinc-500">No hay ningún tipo activo. Créalo en Ajustes.</p>;

  const deEsteTipo = e.catalogo.filter((s) => s.tipoId === tipo.id);
  const activas = deEsteTipo.filter((s) => s.activo);
  const archivadas = deEsteTipo.filter((s) => !s.activo);

  function guardada(s: SesionCatalogo) {
    e.setCatalogo(e.catalogo.some((x) => x.id === s.id) ? e.catalogo.map((x) => (x.id === s.id ? s : x)) : [...e.catalogo, s]);
  }

  return (
    <div className="space-y-3">
      <SelectorTipo e={e} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAbierta('nueva')} disabled={abierta === 'nueva'}>
          <Plus /> Nueva sesión
        </Button>
        <span className="text-sm text-zinc-500 tabular-nums">
          {activas.length} {activas.length === 1 ? 'sesión' : 'sesiones'}
        </span>
        <span className="ml-auto text-xs text-zinc-500">
          {tipo.sinRepetir ? 'Se revisa que no se repitan en la vida escolar del alumno' : 'Sin revisar repeticiones (se activa en Ajustes)'}
        </span>
      </div>

      {abierta === 'nueva' && (
        <section className={cn(claseTarjeta, 'p-4')}>
          <EditorSesion e={e} tipo={tipo} niveles={niveles} sesion={null} onGuardada={(s) => { guardada(s); setAbierta(s.id); }} onCerrar={() => setAbierta(null)} />
        </section>
      )}

      {activas.length === 0 && abierta !== 'nueva' && (
        <Vacio icono={<BookOpenText />} titulo={`Todavía no hay sesiones de ${tipo.nombre}`}>
          Añade las de tu abanico (nombre y enlace) y el planificador te propondrá la que toca para cada clase.
        </Vacio>
      )}

      <ul className="space-y-2">
        {activas.map((s) => (
          <FilaSesion key={s.id} e={e} tipo={tipo} niveles={niveles} usos={usos} sesion={s} abierta={abierta === s.id} onAbrir={() => setAbierta(abierta === s.id ? null : s.id)} onGuardada={guardada} onCerrar={() => setAbierta(null)} />
        ))}
      </ul>

      {archivadas.length > 0 && (
        <div className="space-y-2">
          <Filtros etiqueta="Archivadas">
            <Filtro activo={verArchivadas} onClick={() => setVerArchivadas(!verArchivadas)} icono={<Archive />} cuenta={archivadas.length}>
              Ver archivadas
            </Filtro>
          </Filtros>
          {verArchivadas && (
            <ul className="space-y-2">
              {archivadas.map((s) => (
                <FilaSesion key={s.id} e={e} tipo={tipo} niveles={niveles} usos={usos} sesion={s} abierta={abierta === s.id} onAbrir={() => setAbierta(abierta === s.id ? null : s.id)} onGuardada={guardada} onCerrar={() => setAbierta(null)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Una sesión del abanico ───────────────────────────────────────────────────

function FilaSesion({
  e,
  tipo,
  niveles,
  usos,
  sesion,
  abierta,
  onAbrir,
  onGuardada,
  onCerrar,
}: {
  e: Estado;
  tipo: TipoMomento;
  niveles: string[];
  usos: ReturnType<typeof usosVigentes>;
  sesion: SesionCatalogo;
  abierta: boolean;
  onAbrir: () => void;
  onGuardada: (s: SesionCatalogo) => void;
  onCerrar: () => void;
}) {
  const suyas = usos.filter((u) => u.catalogoId === sesion.id);
  const planificadas = e.sesiones.filter((s) => s.catalogoId === sesion.id && (s.estado === 'borrador' || s.estado === 'confirmado'));
  // Por nivel: ¿pueden hacerla los alumnos de ahora sin repetirla? Lo de cursos anteriores es
  // «ya la vieron» (⚠); lo de este curso es «se está haciendo» (no es un aviso: lo normal es que
  // todas las clases del nivel hagan la misma).
  const porNivel = niveles
    .filter((n) => sesion.cursos === null || sesion.cursos.includes(n))
    .map((nivel) => {
      const choques = tipo.sinRepetir ? usosQueChocan(suyas, sesion.id, { curso: nivel, letra: null }, e.datos.academicYear) : [];
      return { nivel, vistas: choques.filter((u) => u.academicYear !== e.datos.academicYear), enMarcha: choques.filter((u) => u.academicYear === e.datos.academicYear) };
    });

  return (
    <li className={cn(claseTarjeta, !sesion.activo && 'opacity-70')}>
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierta}
        className="flex min-h-14 w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
      >
        <BookOpenText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium">{sesion.nombre}</span>
            <span className="text-xs text-zinc-500">{sesion.academicYear ? `curso ${sesion.academicYear}` : 'sin hacer'}</span>
            {!sesion.activo && <EstadoPastilla tono="neutro">Archivada</EstadoPastilla>}
            {sesion.cursos && <Etiqueta>solo {sesion.cursos.map(etiquetaNivel).join(', ')}</Etiqueta>}
            {planificadas.length > 0 && (
              <Etiqueta title="Momentos de este curso con esta sesión">
                {planificadas.length} {planificadas.length === 1 ? 'momento' : 'momentos'} este curso
              </Etiqueta>
            )}
          </span>
          {niveles.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {porNivel.map(({ nivel, vistas, enMarcha }) => (
                <EstadoPastilla
                  key={nivel}
                  tono={vistas.length ? 'aviso' : enMarcha.length ? 'neutro' : 'ok'}
                  title={
                    vistas.length
                      ? `Ya la han visto: ${describirUsos(vistas)}`
                      : enMarcha.length
                        ? `Este curso la hacen: ${describirUsos(enMarcha)}`
                        : 'Los alumnos de este nivel no la han visto'
                  }
                >
                  {etiquetaNivel(nivel)} · {vistas.length ? 'ya la vieron' : enMarcha.length ? 'este curso' : 'libre'}
                </EstadoPastilla>
              ))}
            </span>
          )}
        </span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform', abierta && 'rotate-180')} aria-hidden />
      </button>

      {abierta && (
        <div className="space-y-3 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <EditorSesion e={e} tipo={tipo} niveles={niveles} sesion={sesion} onGuardada={onGuardada} onCerrar={onCerrar} />
          {planificadas.length > 0 && <MomentosDeLaSesion planificadas={planificadas} />}
          {suyas.some((u) => u.academicYear !== e.datos.academicYear) && (
            <p className="text-xs text-zinc-500">
              Ya se hizo: {describirUsos(suyas.filter((u) => u.academicYear !== e.datos.academicYear))}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function MomentosDeLaSesion({ planificadas }: { planificadas: SesionOra[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-zinc-500">Este curso</p>
      <ul className="flex flex-wrap gap-1.5 text-xs">
        {planificadas.map((s) => (
          <li key={s.id} className={cn('rounded-md border px-2 py-0.5 tabular-nums', s.estado === 'borrador' ? 'border-dashed border-zinc-400 text-zinc-600 dark:text-zinc-300' : 'border-zinc-200 dark:border-zinc-700')}>
            {nombreClase(s.curso, s.letra)} · {fechaCorta(s.fecha)}
            {s.estado === 'borrador' && ' · borrador'}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Crear / editar ───────────────────────────────────────────────────────────

function EditorSesion({
  e,
  tipo,
  niveles,
  sesion,
  onGuardada,
  onCerrar,
}: {
  e: Estado;
  tipo: TipoMomento;
  niveles: string[];
  sesion: SesionCatalogo | null;
  onGuardada: (s: SesionCatalogo) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(sesion?.nombre ?? '');
  const [enlace, setEnlace] = useState(sesion?.enlace ?? '');
  // Una sesión nueva se crea, por defecto, en el curso en marcha.
  const [curso, setCurso] = useState<string>(sesion ? (sesion.academicYear ?? '') : e.datos.academicYear);
  const [cursos, setCursos] = useState<string[] | null>(sesion?.cursos ?? null);
  const [trabajando, setTrabajando] = useState(false);
  const elegibles = cursosAcademicosElegibles(e.datos.academicYear, niveles.length);
  // Un curso guardado que ya no está en la lista (de hace mucho) tiene que seguir saliendo.
  const opcionesCurso = curso && !elegibles.includes(curso) ? [curso, ...elegibles] : elegibles;
  const enlaceMal = enlace.trim() !== '' && !esEnlaceSeguro(enlace.trim());
  const idBase = `ora-abanico-${sesion?.id ?? 'nueva'}`;

  async function guardar(cambios: Partial<{ activo: boolean }> = {}) {
    setTrabajando(true);
    try {
      const guardada = await api.sesionAbanico(sesion?.id ?? null, {
        tipoId: tipo.id,
        nombre: nombre.trim(),
        enlace: enlace.trim() || null,
        academicYear: curso || null,
        cursos: cursos && cursos.length > 0 ? cursos : null,
        activo: cambios.activo ?? sesion?.activo ?? true,
      });
      onGuardada(guardada);
      haptic.success();
      toast.success(sesion ? 'Guardada' : `Añadida: ${guardada.nombre}`);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  async function borrar() {
    if (!sesion) return;
    setTrabajando(true);
    try {
      await api.borrarSesionAbanico(sesion.id);
      e.setCatalogo(e.catalogo.filter((x) => x.id !== sesion.id));
      haptic.success();
      onCerrar();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Nombre" id={`${idBase}-nombre`} className="sm:col-span-2">
        <Input id={`${idBase}-nombre`} value={nombre} onChange={(ev) => setNombre(ev.target.value)} placeholder="La primera vez en el oratorio" autoFocus={!sesion} />
      </Campo>
      <Campo etiqueta="Enlace" id={`${idBase}-enlace`} error={enlaceMal ? 'Tiene que empezar por https://' : undefined}>
        <span className="flex gap-2">
          <Input id={`${idBase}-enlace`} type="url" inputMode="url" value={enlace} onChange={(ev) => setEnlace(ev.target.value)} placeholder="https://docs.google.com/…" aria-invalid={enlaceMal || undefined} />
          {enlace.trim() && !enlaceMal && (
            <a href={enlace.trim()} target="_blank" rel="noopener noreferrer" aria-label="Abrir el enlace" className={buttonVariants({ variant: 'outline', size: 'icon' })}>
              <ExternalLink />
            </a>
          )}
        </span>
      </Campo>
      <Campo etiqueta="Curso en que se creó" id={`${idBase}-curso`}>
        <Selector id={`${idBase}-curso`} value={curso} onChange={(ev) => setCurso(ev.target.value)}>
          <option value="">— sin curso: aún no se ha hecho —</option>
          {opcionesCurso.map((c) => (
            <option key={c} value={c}>
              {c}
              {c === e.datos.academicYear ? ' (este curso)' : ''}
            </option>
          ))}
        </Selector>
      </Campo>
      <div className="space-y-1.5 sm:col-span-2">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Para qué niveles</p>
        <Filtros etiqueta="Para qué niveles">
          <Filtro activo={cursos === null} onClick={() => setCursos(null)}>
            Todos
          </Filtro>
          {niveles.map((n) => (
            <Filtro key={n} activo={cursos?.includes(n) ?? false} onClick={() => setCursos(cursos?.includes(n) ? cursos.filter((x) => x !== n) : [...(cursos ?? []), n])}>
              {etiquetaNivel(n)}
            </Filtro>
          ))}
        </Filtros>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Una sesión de un curso anterior se da por vista por esos niveles aquella vez. Si es solo de un nivel («la primera vez», 1º), el resto no la verá.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button disabled={!nombre.trim() || enlaceMal} cargando={trabajando} onClick={() => void guardar()}>
          {!trabajando && <Check />} Guardar
        </Button>
        {sesion ? (
          <>
            <Button variant="outline" disabled={trabajando} onClick={() => void guardar({ activo: !sesion.activo })} title={sesion.activo ? 'Deja de proponerse, pero cuenta lo que ya se hizo' : 'Vuelve a proponerse'}>
              {sesion.activo ? <Archive /> : <ArchiveRestore />} {sesion.activo ? 'Archivar' : 'Recuperar'}
            </Button>
            <ConfirmarEnLinea
              etiqueta="Borrar"
              icono={<Trash2 />}
              tamano="default"
              pregunta={`¿Borrar «${sesion.nombre}»? Si ya está elegida en algún momento, se archiva en su lugar.`}
              disabled={trabajando}
              onConfirmar={borrar}
            />
          </>
        ) : (
          <Button variant="outline" disabled={trabajando} onClick={onCerrar}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
