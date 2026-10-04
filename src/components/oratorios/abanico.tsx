'use client';

// 📚 Sesiones: el abanico de lo que se hace en cada momento (no confundir con la Agenda, que son
// los momentos planificados). Cada tipo tiene las suyas, con nombre, enlace y el curso en que se
// crearon; cada fila se despliega para editarla y, a la vista, qué niveles pueden hacerla sin
// repetirla (✓ libre · 📅 se hace este curso · ⚠ ya la vieron en un curso anterior). Ficha: docs/26-oratorios.md
import { Archive, ArchiveRestore, BookOpenText, CalendarCheck, Check, ChevronDown, ExternalLink, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
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
import { Accion, api, Pastilla } from './comun';
import { SelectorTipo } from './planificar';
import type { Estado } from './panel';

const campo = 'min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

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
        <Accion tono="azul" onClick={() => setAbierta('nueva')} disabled={abierta === 'nueva'}>
          <Plus className="h-4 w-4" /> Nueva sesión
        </Accion>
        <span className="text-sm text-zinc-500 tabular-nums">
          {activas.length} {activas.length === 1 ? 'sesión' : 'sesiones'}
        </span>
        <span className="ml-auto text-xs text-zinc-500">
          {tipo.sinRepetir ? 'Se revisa que no se repitan en la vida escolar del alumno' : 'Sin revisar repeticiones (se activa en Ajustes)'}
        </span>
      </div>

      {abierta === 'nueva' && (
        <section className="rounded-xl border border-blue-300 bg-white p-3 dark:border-blue-500/40 dark:bg-zinc-900">
          <EditorSesion e={e} tipo={tipo} niveles={niveles} sesion={null} onGuardada={(s) => { guardada(s); setAbierta(s.id); }} onCerrar={() => setAbierta(null)} />
        </section>
      )}

      {activas.length === 0 && abierta !== 'nueva' && (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Todavía no hay sesiones de {tipo.nombre}. Añade las de tu abanico (nombre y enlace) y el planificador te propondrá la que toca para cada clase.
        </p>
      )}

      <ul className="space-y-2">
        {activas.map((s) => (
          <FilaSesion key={s.id} e={e} tipo={tipo} niveles={niveles} usos={usos} sesion={s} abierta={abierta === s.id} onAbrir={() => setAbierta(abierta === s.id ? null : s.id)} onGuardada={guardada} onCerrar={() => setAbierta(null)} />
        ))}
      </ul>

      {archivadas.length > 0 && (
        <div className="space-y-2">
          <Pastilla activa={verArchivadas} onClick={() => setVerArchivadas(!verArchivadas)}>
            <Archive className="h-4 w-4" /> Archivadas <span className="tabular-nums opacity-70">{archivadas.length}</span>
          </Pastilla>
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
    <li className={cn('rounded-xl border bg-white dark:bg-zinc-900', abierta ? 'border-blue-300 dark:border-blue-500/40' : 'border-zinc-200 dark:border-zinc-800', !sesion.activo && 'opacity-70')}>
      <button type="button" onClick={onAbrir} aria-expanded={abierta} className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
        <BookOpenText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium">{sesion.nombre}</span>
            <span className="text-xs text-zinc-500">{sesion.academicYear ? `curso ${sesion.academicYear}` : 'sin hacer'}</span>
            {sesion.cursos && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">solo {sesion.cursos.map(etiquetaNivel).join(', ')}</span>}
            {planificadas.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" title="Momentos de este curso con esta sesión">
                {planificadas.length} {planificadas.length === 1 ? 'momento' : 'momentos'}
              </span>
            )}
          </span>
          {niveles.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {porNivel.map(({ nivel, vistas, enMarcha }) => (
                <span
                  key={nivel}
                  title={
                    vistas.length
                      ? `Ya la han visto: ${describirUsos(vistas)}`
                      : enMarcha.length
                        ? `Este curso la hacen: ${describirUsos(enMarcha)}`
                        : 'Los alumnos de este nivel no la han visto'
                  }
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                    vistas.length
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      : enMarcha.length
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
                  )}
                >
                  {etiquetaNivel(nivel)}{' '}
                  {vistas.length ? (
                    <TriangleAlert className="h-3 w-3" aria-label="ya la han visto" />
                  ) : enMarcha.length ? (
                    <CalendarCheck className="h-3 w-3" aria-label="se hace este curso" />
                  ) : (
                    <Check className="h-3 w-3" aria-label="libre" />
                  )}
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-zinc-400 transition-transform', abierta && 'rotate-180')} aria-hidden />
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
    if (!sesion || !window.confirm(`¿Borrar «${sesion.nombre}»? Si ya está elegida en algún momento, se archiva en su lugar.`)) return;
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
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Nombre
        <input value={nombre} onChange={(ev) => setNombre(ev.target.value)} placeholder="La primera vez en el oratorio" className={campo} autoFocus={!sesion} />
      </label>
      <label className="text-xs text-zinc-500">
        Enlace
        <span className="flex gap-1">
          <input type="url" inputMode="url" value={enlace} onChange={(ev) => setEnlace(ev.target.value)} placeholder="https://docs.google.com/…" className={cn(campo, enlaceMal && 'border-rose-400')} />
          {enlace.trim() && !enlaceMal && (
            <a href={enlace.trim()} target="_blank" rel="noopener noreferrer" aria-label="Abrir el enlace" className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-zinc-200 px-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </span>
        {enlaceMal && <span className="text-rose-600">Tiene que empezar por https://</span>}
      </label>
      <label className="text-xs text-zinc-500">
        Curso en que se creó
        <select value={curso} onChange={(ev) => setCurso(ev.target.value)} className={campo}>
          <option value="">— sin curso: aún no se ha hecho —</option>
          {opcionesCurso.map((c) => (
            <option key={c} value={c}>
              {c}
              {c === e.datos.academicYear ? ' (este curso)' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-1 sm:col-span-2">
        <p className="text-xs text-zinc-500">Para qué niveles</p>
        <div className="flex flex-wrap gap-1.5">
          <Pastilla activa={cursos === null} onClick={() => setCursos(null)}>
            Todos
          </Pastilla>
          {niveles.map((n) => (
            <Pastilla key={n} activa={cursos?.includes(n) ?? false} onClick={() => setCursos(cursos?.includes(n) ? cursos.filter((x) => x !== n) : [...(cursos ?? []), n])}>
              {etiquetaNivel(n)}
            </Pastilla>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400">
          Una sesión de un curso anterior se da por vista por esos niveles aquella vez. Si es solo de un nivel («la primera vez», 1º), el resto no la verá.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Accion tono="azul" disabled={trabajando || !nombre.trim() || enlaceMal} onClick={() => void guardar()}>
          <Check className="h-4 w-4" /> Guardar
        </Accion>
        {sesion ? (
          <>
            <Accion disabled={trabajando} onClick={() => void guardar({ activo: !sesion.activo })} title={sesion.activo ? 'Deja de proponerse, pero cuenta lo que ya se hizo' : 'Vuelve a proponerse'}>
              {sesion.activo ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />} {sesion.activo ? 'Archivar' : 'Recuperar'}
            </Accion>
            <Accion tono="rojo" disabled={trabajando} onClick={() => void borrar()}>
              <Trash2 className="h-4 w-4" />
            </Accion>
          </>
        ) : (
          <Accion disabled={trabajando} onClick={onCerrar}>
            Cancelar
          </Accion>
        )}
      </div>
    </div>
  );
}
