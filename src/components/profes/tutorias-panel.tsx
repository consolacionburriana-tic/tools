'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Eraser, Loader2, Plus, Search, TriangleAlert, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Estado } from '@/components/ui/estado';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { ConfirmarDialogo, ConfirmarEnLinea } from '@/components/ui/confirmar';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ETAPA_LABEL, ETAPAS, ETAPAS_VISIBLES, etapaDeCurso, type Etapa } from '@/lib/cursos';
import type { ProfeItem } from '@/lib/profes';
import { type CambioPromocion, type ClaseConTutoresUI, planPromocion, resumenPlan } from '@/lib/tutorias';
import { RepartoAlumnos } from '@/components/profes/reparto-alumnos';

export type ClaseConTutoresProp = ClaseConTutoresUI;

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
    const grupos: Record<string, ClaseConTutoresProp[]> = { ...Object.fromEntries(ETAPAS.map((e) => [e, []])), General: [] };
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
      <Tarjeta className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{totalTutorias} tutorías asignadas</span>
          <Button
            variant="outline"
            size="sm"
            disabled={enMarcha || totalTutorias === 0}
            onClick={() => {
              setLimpiando(null);
              setPrevia(planPromocion(clases));
            }}
          >
            <ArrowRight aria-hidden /> Promocionar +1 curso
          </Button>
          <span aria-hidden className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Limpiar:</span>
          {(['todas', ...ETAPAS_VISIBLES] as const).map((q) => (
            <Button
              key={q}
              variant="ghost"
              size="sm"
              disabled={enMarcha || totalTutorias === 0}
              onClick={() => {
                setPrevia(null);
                setLimpiando(q);
              }}
            >
              <Eraser aria-hidden /> {q === 'todas' ? 'Todas' : ETAPA_LABEL[q]}
            </Button>
          ))}
        </div>

        {/* Vista previa de la promoción */}
        {previa && (
          <div className="anim-up mt-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">
              <strong>{resumenPlan(previa).movidas}</strong> tutorías cambian de clase y{' '}
              <strong>{resumenPlan(previa).liberadas}</strong> se quedan libres. Infantil y Primaria rotan dentro de su
              ciclo; en la ESO se sube de curso y 4º egresa.
            </p>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
              {previa.map((c) => (
                <li key={c.tutoriaId} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{c.nombre}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">{claseLabel(c.desde.curso, c.desde.letra)}</span>
                  <ArrowRight aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
                  {c.hasta ? (
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{claseLabel(c.hasta.curso, c.hasta.letra)}</span>
                  ) : (
                    <Estado tono="aviso">
                      sin tutoría {c.motivo === 'egresa' ? '(egresa)' : '(no existe la clase destino)'}
                    </Estado>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                cargando={enMarcha}
                onClick={() =>
                  void accion({ accion: 'promocionar' }, (r) => `${r.movidas} tutorías movidas, ${r.liberadas} liberadas`)
                }
              >
                {!enMarcha && <ArrowRight aria-hidden />}
                Aplicar promoción
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPrevia(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Tarjeta>

      {/* Limpiar son muchas tutorías de golpe: diálogo que dice cuántas. */}
      <ConfirmarDialogo
        abierto={limpiando !== null}
        onCerrar={() => setLimpiando(null)}
        titulo={
          limpiando === 'todas' || limpiando === null
            ? `¿Borrar las ${aLimpiar} tutorías del centro?`
            : `¿Borrar las ${aLimpiar} tutorías de ${ETAPA_LABEL[limpiando].toLowerCase()}?`
        }
        descripcion="Se borran en el curso académico en vigor. El formulario del ABC usa las tutorías para sugerir a quién avisar, así que se quedará sin sugerencias hasta que se reasignen."
        boton={`Borrar ${aLimpiar} tutorías`}
        onConfirmar={() =>
          accion(
            { accion: 'limpiar', etapa: limpiando === 'todas' ? null : limpiando },
            (r) => `${r.borradas} tutorías borradas`,
          )
        }
      />

      {ETAPAS.filter((et) => porEtapa[et]?.length).map((et) => (
        <section key={et}>
          <Rotulo className="mb-2">{ETAPA_LABEL[et]}</Rotulo>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                // Con el reparto abierto la tarjeta ocupa el ancho entero: en un ordenador
                // la lista de 30 alumnos no cabe cómoda en media columna.
                <Tarjeta key={key} className={`p-3.5 ${reparto === key ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{claseLabel(c.curso, c.letra)}</h3>
                    <div className="flex items-center gap-2">
                      {estado && (
                        <Estado tono={estado.alerta ? 'aviso' : 'ok'} icono={estado.alerta ? <TriangleAlert aria-hidden /> : undefined}>
                          {estado.texto}
                        </Estado>
                      )}
                      <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{c.numAlumnos} alumnos</span>
                    </div>
                  </div>

                  <ul className="mb-2 space-y-1">
                    {c.tutores.length === 0 && <li className="text-sm text-zinc-500 dark:text-zinc-400">Sin tutor asignado</li>}
                    {c.tutores.map((t) => (
                      <li key={t.id} className="flex min-h-10 flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{t.nombre}</span>
                        <ConfirmarEnLinea
                          etiqueta="Quitar"
                          confirmar="Sí, quitar"
                          variante="ghost"
                          icono={<X aria-hidden />}
                          disabled={ocupado === key}
                          onConfirmar={() => quitar(c, t.id)}
                        />
                      </li>
                    ))}
                    {ocupado === key && (
                      <li>
                        <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-400" />
                      </li>
                    )}
                  </ul>

                  {abriendo === key ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          autoFocus
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar profe…"
                          aria-label={`Buscar tutor para ${claseLabel(c.curso, c.letra)}`}
                          className="pr-12 pl-9"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cerrar el buscador"
                          className="absolute top-0.5 right-0.5"
                          onClick={() => {
                            setAbriendo(null);
                            setBusqueda('');
                          }}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>
                      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                        {candidatos.slice(0, 30).map((p) => (
                          <Button key={p.id} variant="secondary" size="sm" className="rounded-full" onClick={() => void añadir(c, p)}>
                            {p.nombre}
                          </Button>
                        ))}
                        {candidatos.length === 0 && <span className="text-sm text-zinc-500 dark:text-zinc-400">Sin resultados</span>}
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAbriendo(key);
                        setBusqueda('');
                      }}
                    >
                      <Plus aria-hidden /> Añadir tutor
                    </Button>
                  )}

                  {/* Reparto de alumnos: solo cuando la tutoría está compartida */}
                  {c.tutores.length >= 2 && (
                    <>
                      <button
                        type="button"
                        aria-expanded={reparto === key}
                        onClick={() => setReparto(reparto === key ? null : key)}
                        className="mt-3 flex min-h-10 w-full items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <Users aria-hidden className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          Reparto de alumnos{' '}
                          <span className="font-normal text-zinc-500 tabular-nums dark:text-zinc-400">
                            {c.conTutorPersonal}/{c.numAlumnos} con tutor personal
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden
                          className={`ml-auto h-4 w-4 shrink-0 transition-transform ${reparto === key ? 'rotate-180' : ''}`}
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
                </Tarjeta>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
