'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Eraser, Loader2, Plus, Search, TriangleAlert, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { etapaDeCurso, type Etapa } from '@/lib/cursos';
import type { ProfeItem } from '@/lib/profes';
import { type CambioPromocion, type ClaseConTutoresUI, planPromocion, resumenPlan } from '@/lib/tutorias';
import { RepartoAlumnos } from '@/components/profes/reparto-alumnos';

export type ClaseConTutoresProp = ClaseConTutoresUI;

const ETAPA_LABEL: Record<'EI' | 'EP' | 'ESO', string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria' };
const ETAPA_ORDEN: ('EI' | 'EP' | 'ESO')[] = ['EI', 'EP', 'ESO'];

function claseLabel(curso: string, letra: string | null) {
  return letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
}

/**
 * Estado del reparto de alumnos de una clase. Solo tiene sentido con dos o más tutores:
 * con un tutor único, todo su alumnado es suyo y no hay nada que repartir.
 *
 * Hay dos avisos distintos a propósito: "faltan N" salta solo cuando llega alumnado nuevo
 * (que nunca se autoasigna), y "falta confirmar" cuando nadie ha dicho todavía que el
 * reparto de este curso está revisado.
 */
function estadoReparto(c: ClaseConTutoresProp): { texto: string; alerta: boolean } | null {
  if (c.tutores.length < 2) return null;
  const faltan = c.numAlumnos - c.conTutorPersonal;
  if (faltan > 0) return { texto: `${faltan} sin tutor personal`, alerta: true };
  if (!c.repartoConfirmadoAt) return { texto: 'Falta confirmar el reparto', alerta: true };
  return { texto: 'Reparto confirmado', alerta: false };
}

export function TutoriasPanel({ clases: inicial, profes }: { clases: ClaseConTutoresProp[]; profes: ProfeItem[] }) {
  const [clases, setClases] = useState(inicial);
  const [abriendo, setAbriendo] = useState<string | null>(null); // curso|letra de la clase con el buscador abierto
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [previa, setPrevia] = useState<CambioPromocion[] | null>(null); // plan de promoción a la vista
  const [limpiando, setLimpiando] = useState<Etapa | 'todas' | null>(null); // confirmación pendiente
  const [enMarcha, setEnMarcha] = useState(false);
  const [reparto, setReparto] = useState<string | null>(null); // clase con el reparto de alumnos abierto

  const porEtapa = useMemo(() => {
    const grupos: Record<string, ClaseConTutoresProp[]> = { EI: [], EP: [], ESO: [], General: [] };
    for (const c of clases) grupos[etapaDeCurso(c.curso) ?? 'General'].push(c);
    return grupos;
  }, [clases]);

  function claseKey(c: { curso: string; letra: string | null }) {
    return `${c.curso}|${c.letra ?? ''}`;
  }

  async function añadir(clase: ClaseConTutoresProp, profe: ProfeItem) {
    const key = claseKey(clase);
    setOcupado(key);
    try {
      const res = await fetch('/api/profes/admin/tutorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: clase.curso, letra: clase.letra, teacherId: profe.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo asignar');
      setClases((prev) =>
        prev.map((c) =>
          claseKey(c) === key ? { ...c, tutores: [...c.tutores, { id: data.id, teacherId: profe.id, nombre: profe.nombre }] } : c,
        ),
      );
      haptic.success();
      setAbriendo(null);
      setBusqueda('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(clase: ClaseConTutoresProp, tutoriaId: string) {
    const key = claseKey(clase);
    setOcupado(key);
    const previo = clases;
    setClases((prev) => prev.map((c) => (claseKey(c) === key ? { ...c, tutores: c.tutores.filter((t) => t.id !== tutoriaId) } : c)));
    try {
      const res = await fetch('/api/profes/admin/tutorias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tutoriaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo quitar');
      haptic.tap();
    } catch (e) {
      setClases(previo);
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  // Acciones en bloque. El servidor recalcula el plan por su cuenta: esta previa es solo
  // para que se vea qué va a pasar antes de tocar las tutorías reales del centro.
  async function accion(body: Record<string, unknown>, exito: (r: Record<string, number>) => string) {
    setEnMarcha(true);
    try {
      const res = await fetch('/api/profes/admin/tutorias/acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClases(data.clases);
      setPrevia(null);
      setLimpiando(null);
      toast.success(exito(data.resultado));
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo aplicar');
      haptic.warning();
    } finally {
      setEnMarcha(false);
    }
  }

  const totalTutorias = clases.reduce((n, c) => n + c.tutores.length, 0);
  const aLimpiar =
    limpiando === null
      ? 0
      : clases
          .filter((c) => limpiando === 'todas' || etapaDeCurso(c.curso) === limpiando)
          .reduce((n, c) => n + c.tutores.length, 0);

  return (
    <div className="space-y-6">
      {/* Acciones en bloque, para ahorrar clics a principio de curso */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-zinc-400">{totalTutorias} tutorías asignadas:</span>
          <button
            type="button"
            disabled={enMarcha || totalTutorias === 0}
            onClick={() => {
              setLimpiando(null);
              setPrevia(planPromocion(clases));
            }}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40 dark:bg-blue-500/10 dark:text-blue-300"
          >
            <ArrowRight className="h-3.5 w-3.5" /> Promocionar +1 curso
          </button>
          <span className="mx-1 text-zinc-300 dark:text-zinc-600">|</span>
          <span className="text-zinc-400">Limpiar:</span>
          {(['todas', 'EI', 'EP', 'ESO'] as const).map((q) => (
            <button
              key={q}
              type="button"
              disabled={enMarcha || totalTutorias === 0}
              onClick={() => {
                setPrevia(null);
                setLimpiando(limpiando === q ? null : q);
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium disabled:opacity-40 ${
                limpiando === q
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" /> {q === 'todas' ? 'Todas' : ETAPA_LABEL[q]}
            </button>
          ))}
        </div>

        {/* Confirmación de limpiar */}
        {limpiando && (
          <div className="anim-up mt-2.5 rounded-xl bg-red-50 p-3 text-sm dark:bg-red-500/10">
            <p className="flex items-start gap-1.5 text-red-800 dark:text-red-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Se van a borrar <strong>{aLimpiar} tutorías</strong>{' '}
                {limpiando === 'todas' ? 'de todo el centro' : `de ${ETAPA_LABEL[limpiando].toLowerCase()}`} en el curso
                académico en vigor. El formulario del ABC usa las tutorías para sugerir a quién avisar, así que se
                quedará sin sugerencias hasta que se reasignen.
              </span>
            </p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                disabled={enMarcha}
                onClick={() =>
                  void accion({ accion: 'limpiar', etapa: limpiando === 'todas' ? null : limpiando }, (r) => `${r.borradas} tutorías borradas`)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {enMarcha ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />}
                Sí, borrar {aLimpiar}
              </button>
              <button
                type="button"
                onClick={() => setLimpiando(null)}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Vista previa de la promoción */}
        {previa && (
          <div className="anim-up mt-2.5 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              <strong>{resumenPlan(previa).movidas}</strong> tutorías cambian de clase y{' '}
              <strong>{resumenPlan(previa).liberadas}</strong> se quedan libres. Infantil y Primaria rotan dentro de su
              ciclo; en la ESO se sube de curso y 4º egresa.
            </p>
            <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto text-xs">
              {previa.map((c) => (
                <li key={c.tutoriaId} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.nombre}</span>
                  <span className="text-zinc-400">{claseLabel(c.desde.curso, c.desde.letra)}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                  {c.hasta ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      {claseLabel(c.hasta.curso, c.hasta.letra)}
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">
                      sin tutoría {c.motivo === 'egresa' ? '(egresa)' : '(no existe la clase destino)'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                disabled={enMarcha}
                onClick={() =>
                  void accion({ accion: 'promocionar' }, (r) => `${r.movidas} tutorías movidas, ${r.liberadas} liberadas`)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {enMarcha ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Aplicar promoción
              </button>
              <button
                type="button"
                onClick={() => setPrevia(null)}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {ETAPA_ORDEN.filter((et) => porEtapa[et]?.length).map((et) => (
        <section key={et}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{ETAPA_LABEL[et]}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {porEtapa[et].map((c) => {
              const key = claseKey(c);
              const etapaClase = etapaDeCurso(c.curso);
              const estado = estadoReparto(c);
              const yaAsignados = new Set(c.tutores.map((t) => t.teacherId));
              const candidatos = profes
                .filter((p) => !yaAsignados.has(p.id))
                .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
                .sort((a, b) => Number(b.etapa === etapaClase) - Number(a.etapa === etapaClase) || a.nombre.localeCompare(b.nombre, 'es'));

              return (
                <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{claseLabel(c.curso, c.letra)}</p>
                    <div className="flex items-center gap-1.5">
                      {estado && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            estado.alerta
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          }`}
                        >
                          {estado.alerta && <TriangleAlert className="h-3 w-3" />}
                          {estado.texto}
                        </span>
                      )}
                      <p className="text-xs text-zinc-400">{c.numAlumnos} alumnos</p>
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {c.tutores.length === 0 && <span className="text-xs text-zinc-400">Sin tutor asignado</span>}
                    {c.tutores.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 py-1 pl-2.5 pr-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        {t.nombre}
                        <button
                          type="button"
                          disabled={ocupado === key}
                          onClick={() => void quitar(c, t.id)}
                          className="rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-500/30"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {ocupado === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                  </div>

                  {abriendo === key ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        <Search className="h-3.5 w-3.5 text-zinc-400" />
                        <input
                          autoFocus
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar profe…"
                          className="w-full bg-transparent text-xs text-zinc-900 outline-none dark:text-zinc-100"
                        />
                        <button type="button" onClick={() => { setAbriendo(null); setBusqueda(''); }} className="text-zinc-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                        {candidatos.slice(0, 30).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => void añadir(c, p)}
                            className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            {p.nombre}
                          </button>
                        ))}
                        {candidatos.length === 0 && <span className="text-xs text-zinc-400">Sin resultados</span>}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setAbriendo(key); setBusqueda(''); }}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir tutor
                    </button>
                  )}

                  {/* Reparto de alumnos: solo cuando la tutoría está compartida */}
                  {c.tutores.length >= 2 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReparto(reparto === key ? null : key)}
                        className="mt-2.5 flex w-full items-center gap-1.5 rounded-lg bg-zinc-50 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Reparto de alumnos
                        <span className="text-zinc-400">
                          {c.conTutorPersonal}/{c.numAlumnos} con tutor personal
                        </span>
                        <ChevronDown
                          className={`ml-auto h-3.5 w-3.5 transition-transform ${reparto === key ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {reparto === key && (
                        <RepartoAlumnos
                          curso={c.curso}
                          letra={c.letra}
                          tutores={c.tutores.map((t) => ({ teacherId: t.teacherId, nombre: t.nombre }))}
                          onClases={setClases}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
