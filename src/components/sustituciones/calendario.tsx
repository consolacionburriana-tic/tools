'use client';

// La semana de Sustituciones (docs/32, decisiones 28 y 31, David 23-nov-2026). Una etapa se ve en su
// REJILLA (sus tramos en filas: es como se piensa, no hay horas libres); Infantil y Primaria juntas o el
// cole entero, en CALENDARIO (las horas a escala: cada etapa tiene su rejilla y solo el reloj las junta),
// que también se puede elegir para una etapa. Cada hora que pide sustituto va pintada por su estado o,
// con un toque, por ciclo o curso. Tocar una casilla o un hueco apunta a esa hora; la cabecera del día,
// el día entero; un bloque abre su ficha. Todo en un panel al lado. En el móvil, día a día.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Bus, CalendarClock, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, LayoutGrid, MailX, Palette, PencilLine, Plus, Settings2, UserRoundMinus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import type { Etapa } from '@/lib/cursos';
import { aMin, diaSemana, sumarDias } from '@/lib/oratorios';
import { aHHMM, colocarBloques, ESTADO_HORA_INFO, etapasDeVista, filaDe, jefaturaDeVista, lunesDe, rotuloDia, rotuloSemana, VISTA_NOMBRE, VISTAS_SEMANA, vistaConRejilla, type ColorCurso, type EstadoHoraSust, type VistaSemana } from '@/lib/sustituciones';
import type { BloqueSemana, DatosSemana, DiaSemana } from '@/lib/sustituciones-semana-server';
import type { FichaAusencia as DatosFicha, ProfeSelector } from '@/lib/sustituciones-server';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Skeleton } from '@/components/ui/skeleton';
import { FichaAusencia } from './ficha';
import { FormularioAusencia, type InicialAusencia } from './formulario';
import { guardarGrupoEtapas, pedir } from './comun';

/** Píxeles por minuto: una hora de 45 minutos son 54 px, que da para tres líneas de texto. */
const PX = 1.2;

export const ICONO_ESTADO: Record<EstadoHoraSust, typeof Check> = {
  confirmada: CheckCheck,
  cubierta: Check,
  borrador: PencilLine,
  sin_cubrir: AlertCircle,
  error: MailX,
  no_hace_falta: Check,
};

/** El bloque de una hora, teñido por su estado (verde, azul, gris punteado, ámbar, rojo). */
export const COLOR_ESTADO: Record<EstadoHoraSust, string> = {
  confirmada: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50',
  cubierta: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-50',
  borrador: 'border-dashed border-zinc-400 bg-white text-zinc-800 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100',
  sin_cubrir: 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-50',
  error: 'border-red-400 bg-red-50 text-red-950 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-50',
  no_hace_falta: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
};

const COLOR_ICONO: Record<EstadoHoraSust, string> = {
  confirmada: 'text-emerald-600 dark:text-emerald-400',
  cubierta: 'text-blue-600 dark:text-blue-400',
  borrador: 'text-zinc-500 dark:text-zinc-400',
  sin_cubrir: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  no_hace_falta: 'text-zinc-400',
};

const ORDEN_LEYENDA: EstadoHoraSust[] = ['sin_cubrir', 'error', 'borrador', 'cubierta', 'confirmada'];
const PLURAL: Record<EstadoHoraSust, [string, string]> = {
  sin_cubrir: ['sin cubrir', 'sin cubrir'],
  error: ['con error', 'con error'],
  borrador: ['borrador', 'borradores'],
  cubierta: ['cubierta', 'cubiertas'],
  confirmada: ['confirmada', 'confirmadas'],
  no_hace_falta: ['no hace falta', 'no hacen falta'],
};

/**
 * Colorear por curso (David, 23-nov-2026): Infantil y los tres ciclos de Primaria, o los cuatro cursos de
 * la ESO. Cuatro tintes que no son de estado (excepción de diseno.md); el estado sigue en el icono.
 */
export const COLOR_CURSO: Record<ColorCurso, string> = {
  c1: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-50',
  c2: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-50',
  c3: 'border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-50',
  c4: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-50',
};
const SIN_CURSO = 'border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100';

/** La leyenda de los colores por curso de cada etapa. */
const LEYENDA_CURSO: Record<Etapa, { color: ColorCurso; nombre: string }[]> = {
  EI: [{ color: 'c4', nombre: 'Infantil' }],
  EP: [
    { color: 'c1', nombre: '1.er ciclo' },
    { color: 'c2', nombre: '2.º ciclo' },
    { color: 'c3', nombre: '3.er ciclo' },
  ],
  ESO: [
    { color: 'c1', nombre: '1º' },
    { color: 'c2', nombre: '2º' },
    { color: 'c3', nombre: '3º' },
    { color: 'c4', nombre: '4º' },
  ],
  BACH: [],
};

type ModoColor = 'estado' | 'curso';
type Modo = 'rejilla' | 'calendario';

function leerColor(): ModoColor {
  try {
    return localStorage.getItem('sust_color') === 'curso' ? 'curso' : 'estado';
  } catch {
    return 'estado';
  }
}
function guardarColor(c: ModoColor) {
  try {
    localStorage.setItem('sust_color', c);
  } catch {
    // Sin almacenamiento: vuelve a colorear por estado, que es lo de siempre.
  }
}
function guardarCookie(nombre: string, valor: string) {
  try {
    document.cookie = `${nombre}=${valor}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // Sin cookies: la próxima vez empieza por la vista de su jefatura.
  }
}

type Panel = { tipo: 'nueva'; inicial: InicialAusencia; clave: number } | { tipo: 'ficha'; id: string } | null;

export interface AbrirAlCargar {
  nueva?: InicialAusencia;
  ausencia?: string;
  /** Cambia en cada petición: «Apuntar» de la cabecera vuelve a abrir el panel aunque ya estés aquí. */
  marca?: number;
}

const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V'];

export function Calendario({
  inicial,
  hoy,
  modoInicial,
  propia,
  profes,
  abrir,
}: {
  inicial: DatosSemana;
  hoy: string;
  modoInicial: Modo;
  /** La jefatura de quien mira, o null. */
  propia: string | null;
  profes: ProfeSelector[];
  abrir: AbrirAlCargar;
}) {
  const [datos, setDatos] = useState(inicial);
  const [vista, setVista] = useState<VistaSemana>(inicial.vista);
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [color, setColor] = useState<ModoColor>('estado');
  const [verBajas, setVerBajas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [ficha, setFicha] = useState<DatosFicha | null>(null);
  // En el móvil se ve un día: hoy si es de esta semana; si no, el lunes.
  const [diaMovil, setDiaMovil] = useState(() => Math.max(0, inicial.dias.findIndex((d) => d.fecha === hoy)));
  const peticion = useRef(0);
  const lunes = datos.lunes;
  const etapasPrimero = useMemo(() => (vista === 'todas' ? [] : etapasDeVista(vista)), [vista]);
  const conRejilla = vistaConRejilla(vista) && modo === 'rejilla';

  // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una vez al montar: localStorage no existe en el servidor
  useEffect(() => setColor(leerColor()), []);

  const cargarSemana = useCallback(async (l: string, v: VistaSemana) => {
    const n = ++peticion.current;
    setCargando(true);
    try {
      const d = await pedir<DatosSemana>(`/api/sustituciones/admin/semana?lunes=${l}&vista=${v}`);
      if (n === peticion.current) setDatos(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido cargar la semana');
    } finally {
      if (n === peticion.current) setCargando(false);
    }
  }, []);

  function irA(l: string, dia?: number) {
    const url = new URL(window.location.href);
    url.searchParams.set('semana', l);
    window.history.pushState(null, '', url);
    if (dia !== undefined) setDiaMovil(dia);
    void cargarSemana(l, vista);
  }

  function cambiarVista(v: VistaSemana) {
    setVista(v);
    guardarCookie('sust_vista', v);
    guardarGrupoEtapas(jefaturaDeVista(v)); // las demás secciones ven lo mismo
    void cargarSemana(lunes, v);
  }

  function cambiarModo(m: Modo) {
    setModo(m);
    guardarCookie('sust_modo', m);
  }

  const abrirFicha = useCallback(async (id: string) => {
    setPanel({ tipo: 'ficha', id });
    setFicha(null);
    try {
      setFicha(await pedir<DatosFicha>(`/api/sustituciones/admin/ausencias/${id}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido abrir');
      setPanel(null);
    }
  }, []);

  function abrirNueva(ini: InicialAusencia) {
    haptic.tap();
    setPanel({ tipo: 'nueva', inicial: ini, clave: Date.now() });
  }

  // Lo que pide la URL al llegar (⌘K, un enlace a una ausencia): se abre una vez y se limpia.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se abre una vez por petición (abrir.marca): lo pide la URL
    if (abrir.ausencia) void abrirFicha(abrir.ausencia);
    else if (abrir.nueva) setPanel({ tipo: 'nueva', inicial: abrir.nueva, clave: Date.now() });
    if (abrir.ausencia || abrir.nueva) {
      const url = new URL(window.location.href);
      for (const k of ['nueva', 'ausencia', 'profe', 'desde', 'hasta', 'tramos', 'hi', 'hf', 'motivo']) url.searchParams.delete(k);
      window.history.replaceState(null, '', url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir.marca]);

  // ← → para cambiar de semana (cuando no se está escribiendo ni hay un panel abierto).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (panel || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') irA(sumarDias(lunes, -7));
      else if (e.key === 'ArrowRight') irA(sumarDias(lunes, 7));
      else if (e.key.toLowerCase() === 'n') abrirNueva({ desde: hoy >= lunes && hoy <= sumarDias(lunes, 4) ? hoy : lunes });
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const recargar = useCallback(() => {
    void cargarSemana(lunes, vista);
    if (panel?.tipo === 'ficha') void pedir<DatosFicha>(`/api/sustituciones/admin/ausencias/${panel.id}`).then(setFicha).catch(() => undefined);
  }, [cargarSemana, lunes, vista, panel]);

  const esteLunes = lunesDe(hoy);
  const pendientes = datos.cuentas.sin_cubrir + datos.cuentas.error;
  const bajasSin = datos.bajas.filter((b) => !b.cubre);
  const bajasCon = datos.bajas.filter((b) => b.cubre);
  const leyendaCurso = etapasDeVista(vista).flatMap((e) => (etapasDeVista(vista).length > 1 && e === 'EP' ? LEYENDA_CURSO.EP : LEYENDA_CURSO[e]).map((x) => ({ ...x, nombre: e === 'ESO' && vista !== 'ESO' ? `${x.nombre} ESO` : x.nombre })));
  const pinta = { color, onBloque: (b: BloqueSemana) => void abrirFicha(b.ausenciaId), onHueco: abrirNueva };

  return (
    <div className="space-y-4">
      {/* Barra: semana y qué se mira */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Semana anterior" onClick={() => irA(sumarDias(lunes, -7))}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Semana siguiente" onClick={() => irA(sumarDias(lunes, 7))}>
            <ChevronRight aria-hidden />
          </Button>
          {lunes !== esteLunes && (
            <Button variant="ghost" size="sm" onClick={() => irA(esteLunes, Math.max(0, [0, 1, 2, 3, 4].findIndex((i) => sumarDias(esteLunes, i) === hoy)))}>
              Hoy
            </Button>
          )}
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{rotuloSemana(lunes)}</h2>
        <label className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 focus-within:ring-3 focus-within:ring-ring/50 dark:text-zinc-300 dark:hover:bg-zinc-800">
          <CalendarDays aria-hidden className="size-4" />
          <span className="sr-only">Ir a una fecha</span>
          <input
            type="date"
            className="absolute inset-0 cursor-pointer opacity-0"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const l = lunesDe(e.target.value);
              irA(l, Math.max(0, [0, 1, 2, 3, 4].findIndex((i) => sumarDias(l, i) === e.target.value)));
            }}
          />
        </label>
        <Filtros etiqueta="Qué ver" className="md:ml-auto">
          {VISTAS_SEMANA.map((v) => (
            <Filtro key={v} activo={vista === v} onClick={() => cambiarVista(v)}>
              {VISTA_NOMBRE[v]}
              {propia && jefaturaDeVista(v) === propia && vistaConRejilla(v) && <span className="sr-only"> (tu etapa)</span>}
            </Filtro>
          ))}
        </Filtros>
      </div>

      {/* Cifras por estado (o leyenda de cursos), bajas y cómo pintarlo */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-live="polite">
        {color === 'estado'
          ? ORDEN_LEYENDA.filter((e) => datos.cuentas[e] > 0 || e === 'sin_cubrir').map((e) => {
              const Icono = ICONO_ESTADO[e];
              return (
                <span key={e} className={cn('inline-flex items-center gap-1.5', datos.cuentas[e] > 0 && (e === 'sin_cubrir' || e === 'error') ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400')}>
                  <span aria-hidden className={cn('inline-flex size-5 items-center justify-center rounded-md border', COLOR_ESTADO[e])}>
                    <Icono className={cn('size-3.5', COLOR_ICONO[e])} />
                  </span>
                  <span className="tabular-nums">{datos.cuentas[e]}</span> {PLURAL[e][datos.cuentas[e] === 1 ? 0 : 1]}
                </span>
              );
            })
          : leyendaCurso.map((l) => (
              <span key={`${l.color}-${l.nombre}`} className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <span aria-hidden className={cn('size-4 rounded-md border', COLOR_CURSO[l.color])} />
                {l.nombre}
              </span>
            ))}
        {color === 'estado' && pendientes === 0 && datos.bloques.length > 0 && <span className="text-emerald-700 dark:text-emerald-400">Todo cubierto</span>}

        <div className="flex flex-wrap items-center gap-1 md:ml-auto">
          {datos.bajas.length > 0 && (
            <Button variant={verBajas ? 'secondary' : 'ghost'} size="sm" aria-expanded={verBajas} onClick={() => setVerBajas((x) => !x)}>
              <UserRoundMinus aria-hidden /> Bajas <span className="tabular-nums">{bajasSin.length}</span>
            </Button>
          )}
          {vistaConRejilla(vista) && (
            <div role="group" aria-label="Cómo verlo" className="inline-flex rounded-xl border border-zinc-200 p-0.5 dark:border-zinc-700">
              <Button variant={modo === 'rejilla' ? 'secondary' : 'ghost'} size="icon-sm" aria-pressed={modo === 'rejilla'} aria-label="Rejilla de la etapa" title="Rejilla de la etapa" onClick={() => cambiarModo('rejilla')}>
                <LayoutGrid aria-hidden />
              </Button>
              <Button variant={modo === 'calendario' ? 'secondary' : 'ghost'} size="icon-sm" aria-pressed={modo === 'calendario'} aria-label="Calendario por horas" title="Calendario por horas" onClick={() => cambiarModo('calendario')}>
                <CalendarClock aria-hidden />
              </Button>
            </div>
          )}
          <Button
            variant={color === 'curso' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={color === 'curso'}
            onClick={() => {
              const c = color === 'curso' ? 'estado' : 'curso';
              setColor(c);
              guardarColor(c);
            }}
          >
            <Palette aria-hidden /> {vista === 'ESO' ? 'Cursos' : vista === 'EI' ? 'Cursos' : 'Ciclos'}
          </Button>
          <Link href="/gestion/sustituciones/ajustes" aria-label="Correos y avisos" title="Correos y avisos" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
            <Settings2 aria-hidden />
          </Link>
        </div>
      </div>

      {verBajas && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {bajasSin.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">Esta semana no hay bajas sin sustituto.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {bajasSin.map((b) => (
                <li key={b.nombre} className="text-zinc-900 dark:text-zinc-100">
                  {b.nombre}
                  {b.dias.length < datos.dias.filter((d) => !d.festivo).length && <span className="text-zinc-500 dark:text-zinc-400"> · {b.dias.map((d) => DIAS_CORTOS[d - 1]).join(' ')}</span>}
                </li>
              ))}
            </ul>
          )}
          {bajasCon.length > 0 && (
            <details className="group mt-2">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-zinc-600 [&::-webkit-details-marker]:hidden dark:text-zinc-400">
                <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" /> Con sustituto ({bajasCon.length})
              </summary>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 pl-6 text-zinc-700 dark:text-zinc-300">
                {bajasCon.map((b) => (
                  <li key={b.nombre}>
                    {b.corto} <span aria-hidden>→</span>
                    <span className="sr-only">la cubre</span> {b.cubre}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Móvil: un día */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Día" className="mb-3 grid grid-cols-5 gap-1">
          {datos.dias.map((d, i) => {
            const r = rotuloDia(d.fecha);
            const del = datos.bloques.filter((b) => b.fecha === d.fecha);
            const malos = del.filter((b) => b.estado === 'sin_cubrir' || b.estado === 'error').length;
            return (
              <button
                key={d.fecha}
                type="button"
                role="tab"
                aria-selected={i === diaMovil}
                onClick={() => setDiaMovil(i)}
                className={cn(
                  'flex h-14 flex-col items-center justify-center rounded-xl border text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  i === diaMovil ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
                  d.fecha === hoy && i !== diaMovil && 'border-blue-400 dark:border-blue-500',
                )}
              >
                <span className="text-xs">{r.corto}</span>
                <span className="font-semibold tabular-nums">{r.numero}</span>
                <span aria-hidden className={cn('mt-0.5 size-1.5 rounded-full', malos > 0 ? 'bg-amber-500' : del.length > 0 ? 'bg-blue-500' : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 pb-2">
          <Button variant="ghost" size="sm" onClick={() => (diaMovil > 0 ? setDiaMovil(diaMovil - 1) : irA(sumarDias(lunes, -7), 4))}>
            <ChevronLeft aria-hidden /> Anterior
          </Button>
          <Button variant="suave" size="sm" onClick={() => abrirNueva({ desde: datos.dias[diaMovil].fecha })} disabled={Boolean(datos.dias[diaMovil].festivo)}>
            <Plus aria-hidden /> Apuntar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => (diaMovil < 4 ? setDiaMovil(diaMovil + 1) : irA(sumarDias(lunes, 7), 0))}>
            Siguiente <ChevronRight aria-hidden />
          </Button>
        </div>
        {conRejilla ? (
          <VistaRejilla datos={datos} dias={[datos.dias[diaMovil]]} hoy={hoy} cargando={cargando} {...pinta} />
        ) : (
          <VistaCalendario datos={datos} dias={[datos.dias[diaMovil]]} hoy={hoy} cargando={cargando} {...pinta} />
        )}
      </div>

      {/* Desde el iPad: la semana */}
      <div className="hidden md:block">
        {conRejilla ? <VistaRejilla datos={datos} dias={datos.dias} hoy={hoy} cargando={cargando} {...pinta} /> : <VistaCalendario datos={datos} dias={datos.dias} hoy={hoy} cargando={cargando} {...pinta} />}
      </div>

      <Dialog open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent variante="lateral" aria-describedby={undefined}>
          {panel?.tipo === 'nueva' && (
            <>
              <DialogTitle className="pr-10 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Nueva sustitución</DialogTitle>
              <FormularioAusencia
                key={panel.clave}
                profes={profes}
                hoy={hoy}
                inicial={panel.inicial}
                etapasPrimero={etapasPrimero}
                onHecho={(id) => {
                  void cargarSemana(lunes, vista);
                  void abrirFicha(id);
                }}
              />
            </>
          )}
          {panel?.tipo === 'ficha' && (
            <>
              <DialogTitle className="sr-only">Ficha de la ausencia</DialogTitle>
              {ficha ? (
                <div className="pb-6">
                  <FichaAusencia ficha={ficha} hoy={hoy} recargar={recargar} />
                </div>
              ) : (
                <div className="space-y-3 pb-6">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PropsVista {
  datos: DatosSemana;
  dias: DiaSemana[];
  hoy: string;
  cargando: boolean;
  color: ModoColor;
  onHueco: (i: InicialAusencia) => void;
  onBloque: (b: BloqueSemana) => void;
}

const h = (x: string) => x.replace(/^0/, '');

/** Lo que dice un bloque, y su texto completo para el lector de pantalla. */
function describir(b: BloqueSemana): { quien: string; etiqueta: string; horas: string } {
  const quien = [b.sustituto, b.sustituto2].filter(Boolean).join(' y ');
  const horas = b.parcial ? `${h(b.parcial.inicio)}-${h(b.parcial.fin)}` : `${h(b.horaInicio)}-${h(b.horaFin)}`;
  const etiqueta = `${horas}${b.parcial ? ' (parte de la hora)' : ''} · ${b.grupos ?? b.materia ?? ''} · falta ${b.ausente} · ${quien ? `entra ${quien}` : 'sin cubrir'} · ${ESTADO_HORA_INFO[b.estado].nombre}${b.grupoDeSalida ? ` · su grupo está de salida (${b.grupoDeSalida})` : ''}`;
  return { quien, etiqueta, horas };
}

const colorDeBloque = (b: BloqueSemana, color: ModoColor) => (color === 'curso' ? (b.color ? COLOR_CURSO[b.color] : SIN_CURSO) : COLOR_ESTADO[b.estado]);

/** La rejilla de una etapa: sus tramos de verdad en filas y un día por columna. Tocar una casilla apunta a esa hora. */
function VistaRejilla({ datos, dias, hoy, cargando, color, onHueco, onBloque }: PropsVista) {
  const una = dias.length === 1;
  const columnas = una ? '4.75rem minmax(0,1fr)' : '5.5rem repeat(5,minmax(0,1fr))';
  // Cada hora en su fila (la que más se solapa ese día); las que no caen en ninguna, a «Otras horas».
  const porCelda = new Map<string, BloqueSemana[]>();
  const otras = new Map<string, BloqueSemana[]>();
  for (const b of datos.bloques) {
    const i = filaDe(b, diaSemana(b.fecha), datos.filas);
    const m = i === -1 ? otras : porCelda;
    const k = i === -1 ? b.fecha : `${i}#${b.fecha}`;
    m.set(k, [...(m.get(k) ?? []), b]);
  }
  const hayOtras = dias.some((d) => (otras.get(d.fecha) ?? []).length > 0);

  if (datos.filas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        No encuentro la rejilla de esta etapa para esta semana. Míralo en calendario.
      </div>
    );
  }
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-opacity dark:border-zinc-800 dark:bg-zinc-900', cargando && 'opacity-60')} aria-busy={cargando}>
      <div className="grid" style={{ gridTemplateColumns: columnas }}>
        {!una && (
          <>
            <div className="border-b border-zinc-200 dark:border-zinc-800" />
            {dias.map((d) => (
              <CabeceraDia key={d.fecha} d={d} hoy={hoy} n={datos.bloques.filter((b) => b.fecha === d.fecha).length} onApuntar={() => onHueco({ desde: d.fecha })} />
            ))}
          </>
        )}
        {una && (
          <div className="col-span-2 border-b border-zinc-200 px-3 py-2 empty:hidden dark:border-zinc-800">
            <BandasDia d={dias[0]} />
          </div>
        )}
        {datos.filas.map((f, i) => (
          <FilaDeRejilla key={`${f.horaInicio}-${f.horaFin}`} etiqueta={f.etiqueta} horas={`${h(f.horaInicio)}-${h(f.horaFin)}`}>
            {dias.map((d) => {
              const dia = diaSemana(d.fecha);
              const tiene = f.dias.includes(dia) && !d.festivo;
              return (
                <Casilla
                  key={d.fecha}
                  d={d}
                  hoy={hoy}
                  activa={tiene}
                  etiqueta={`Apuntar una sustitución el ${rotuloDia(d.fecha).largo} a ${f.etiqueta ?? h(f.horaInicio)}`}
                  onApuntar={() => onHueco({ desde: d.fecha, hora: f.horaInicio })}
                  bloques={porCelda.get(`${i}#${d.fecha}`) ?? []}
                  color={color}
                  onBloque={onBloque}
                />
              );
            })}
          </FilaDeRejilla>
        ))}
        {hayOtras && (
          <FilaDeRejilla etiqueta="Otras" horas="horas">
            {dias.map((d) => (
              <Casilla key={d.fecha} d={d} hoy={hoy} activa={false} etiqueta="" onApuntar={() => undefined} bloques={otras.get(d.fecha) ?? []} color={color} onBloque={onBloque} />
            ))}
          </FilaDeRejilla>
        )}
      </div>
    </div>
  );
}

function FilaDeRejilla({ etiqueta, horas, children }: { etiqueta: string | null; horas: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col justify-center border-t border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{etiqueta}</span>
        <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{horas}</span>
      </div>
      {children}
    </>
  );
}

function Casilla({
  d,
  hoy,
  activa,
  etiqueta,
  onApuntar,
  bloques,
  color,
  onBloque,
}: {
  d: DiaSemana;
  hoy: string;
  activa: boolean;
  etiqueta: string;
  onApuntar: () => void;
  bloques: BloqueSemana[];
  color: ModoColor;
  onBloque: (b: BloqueSemana) => void;
}) {
  return (
    <div
      className={cn(
        'group relative min-h-16 border-t border-l border-zinc-100 dark:border-zinc-800',
        d.fecha === hoy && 'bg-blue-50/40 dark:bg-blue-500/5',
        !activa && 'bg-zinc-50 dark:bg-zinc-950/40',
      )}
    >
      {activa && (
        <button type="button" aria-label={etiqueta} onClick={onApuntar} className="absolute inset-0 outline-none hover:bg-blue-50/60 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-blue-500/10">
          {bloques.length === 0 && <Plus aria-hidden className="mx-auto size-4 text-zinc-300 group-hover:text-blue-600 dark:text-zinc-700" />}
        </button>
      )}
      {bloques.length > 0 && (
        <div className="pointer-events-none relative z-[1] flex flex-col gap-1 p-1">
          {bloques.map((b) => {
            const { quien, etiqueta: texto, horas } = describir(b);
            const Icono = b.grupoDeSalida ? Bus : ICONO_ESTADO[b.estado];
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onBloque(b)}
                aria-label={texto}
                title={texto}
                className={cn('pointer-events-auto rounded-lg border px-1.5 py-1 text-left text-xs leading-tight shadow-sm outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50', colorDeBloque(b, color), b.grupoDeSalida && 'opacity-70')}
              >
                <span className="flex items-center gap-1 font-semibold">
                  <Icono aria-hidden className={cn('size-3.5 shrink-0', COLOR_ICONO[b.estado])} />
                  {b.grupos && <span className="min-w-0 truncate">{b.grupos}</span>}
                  {b.parcial && <span className="shrink-0 font-normal tabular-nums opacity-80">{horas}</span>}
                </span>
                <span className="block truncate">
                  <span className="opacity-80">{b.ausente}</span> <span className={cn('font-medium', !quien && 'italic')}>{quien ? `→ ${quien}` : '· sin cubrir'}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** El calendario: el eje de horas y una columna por día (para ver juntas etapas con rejillas distintas). */
function VistaCalendario({ datos, dias, hoy, cargando, color, onHueco, onBloque }: PropsVista) {
  const alto = (datos.fin - datos.inicio) * PX;
  const horas: number[] = [];
  for (let m = datos.inicio; m <= datos.fin; m += 60) horas.push(m);
  const una = dias.length === 1;
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-opacity dark:border-zinc-800 dark:bg-zinc-900', cargando && 'opacity-60')} aria-busy={cargando}>
      {/* Cabecera de los días (en el móvil no: ya están las pestañas) */}
      <div className={cn('grid border-b border-zinc-200 dark:border-zinc-800', una ? 'hidden' : 'grid-cols-[3.25rem_repeat(5,minmax(0,1fr))]')}>
        <div />
        {dias.map((d) => (
          <CabeceraDia key={d.fecha} d={d} hoy={hoy} n={datos.bloques.filter((b) => b.fecha === d.fecha).length} onApuntar={() => onHueco({ desde: d.fecha })} />
        ))}
      </div>
      {una && (
        <div className="border-b border-zinc-200 px-3 py-2 empty:hidden dark:border-zinc-800">
          <BandasDia d={dias[0]} />
        </div>
      )}
      <div className={cn('relative grid', una ? 'grid-cols-[3rem_minmax(0,1fr)]' : 'grid-cols-[3.25rem_repeat(5,minmax(0,1fr))]')} style={{ height: alto + 12 }}>
        <div className="relative">
          {horas.map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400" style={{ top: (m - datos.inicio) * PX + 6 }}>
              {h(aHHMM(m))}
            </span>
          ))}
        </div>
        {dias.map((d) => (
          <ColumnaDia key={d.fecha} d={d} datos={datos} hoy={hoy} horas={horas} color={color} onHueco={onHueco} onBloque={onBloque} />
        ))}
      </div>
    </div>
  );
}

function CabeceraDia({ d, hoy, n, onApuntar }: { d: DiaSemana; hoy: string; n: number; onApuntar: () => void }) {
  const r = rotuloDia(d.fecha);
  const esHoy = d.fecha === hoy;
  return (
    <div className={cn('min-w-0 border-b border-l border-zinc-200 p-1.5 dark:border-zinc-800', esHoy && 'bg-blue-50/60 dark:bg-blue-500/5')}>
      <button
        type="button"
        disabled={Boolean(d.festivo)}
        onClick={onApuntar}
        className="group flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800"
      >
        <span className={cn('text-sm', esHoy ? 'font-semibold text-blue-700 dark:text-blue-300' : 'font-medium text-zinc-600 dark:text-zinc-400')}>{r.corto}</span>
        <span className={cn('inline-flex size-8 items-center justify-center rounded-full text-base font-semibold tabular-nums', esHoy ? 'bg-blue-600 text-white' : 'text-zinc-900 dark:text-zinc-100')}>{r.numero}</span>
        {d.festivo ? (
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{d.festivo}</span>
        ) : (
          n > 0 && <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{n === 1 ? '1 hora' : `${n} horas`}</span>
        )}
        {!d.festivo && <Plus aria-hidden className="ml-auto size-4 text-zinc-400 group-hover:text-blue-600" />}
        <span className="sr-only">{d.festivo ? `${r.largo}: ${d.festivo}` : `Apuntar una sustitución para todo el ${r.largo}`}</span>
      </button>
      <BandasDia d={d} className="mt-1 px-0.5" />
    </div>
  );
}

/** Lo que hay ese día además de las horas: las salidas. */
function BandasDia({ d, className }: { d: DiaSemana; className?: string }) {
  if (d.salidas.length === 0) return null;
  return (
    <div className={cn('space-y-1', className)}>
      {d.salidas.map((s) => (
        <p key={s.id} className="flex items-start gap-1.5 rounded-md bg-zinc-100 px-1.5 py-1 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100" title={s.acompanantes.length ? `Van: ${s.acompanantes.join(', ')}` : undefined}>
          <Bus aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium">{s.grupos.join(', ')}</span> · {s.descripcion}
            {s.horaInicio && ` · ${h(s.horaInicio)}-${h(s.horaFin ?? '')}`}
          </span>
        </p>
      ))}
    </div>
  );
}

function ColumnaDia({ d, datos, hoy, horas, color, onHueco, onBloque }: { d: DiaSemana; datos: DatosSemana; hoy: string; horas: number[]; color: ModoColor; onHueco: (i: InicialAusencia) => void; onBloque: (b: BloqueSemana) => void }) {
  const bloques = datos.bloques.filter((b) => b.fecha === d.fecha);
  const sitios = new Map(colocarBloques(bloques).map((c) => [c.id, c]));
  const [guia, setGuia] = useState<number | null>(null);
  const esHoy = d.fecha === hoy;
  const pasado = d.fecha < hoy;
  const r = rotuloDia(d.fecha);
  const minutoDe = (e: React.MouseEvent<HTMLElement>, base: number) => {
    const caja = e.currentTarget.getBoundingClientRect();
    return Math.max(datos.inicio, Math.min(datos.fin - 5, base + Math.round((e.clientY - caja.top) / PX / 5) * 5));
  };
  return (
    <div className={cn('relative border-l border-zinc-200 dark:border-zinc-800', esHoy && 'bg-blue-50/40 dark:bg-blue-500/5', pasado && 'bg-zinc-50/60 dark:bg-zinc-950/30')} onMouseLeave={() => setGuia(null)}>
      {/* Las horas en punto, y un botón por hora para apuntar ahí (el minuto exacto sale de dónde se toca) */}
      {horas.slice(0, -1).map((m) => (
        <button
          key={m}
          type="button"
          disabled={Boolean(d.festivo)}
          aria-label={`Apuntar una sustitución el ${r.largo} a las ${h(aHHMM(m))}`}
          onMouseMove={(e) => setGuia(minutoDe(e, m))}
          onClick={(e) => {
            const min = e.detail === 0 ? m : minutoDe(e, m);
            onHueco({ desde: d.fecha, hora: aHHMM(min) });
          }}
          className="absolute inset-x-0 border-t border-zinc-100 outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default dark:border-zinc-800/70"
          style={{ top: (m - datos.inicio) * PX + 6, height: 60 * PX }}
        />
      ))}
      {guia !== null && !d.festivo && (
        <div aria-hidden className="pointer-events-none absolute inset-x-1 z-10 flex items-center" style={{ top: (guia - datos.inicio) * PX + 6 }}>
          <span className="-translate-y-1/2 rounded-md bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums shadow-sm">+ {h(aHHMM(guia))}</span>
          <span className="h-px flex-1 bg-blue-500/60" />
        </div>
      )}
      {d.festivo && <div className="absolute inset-0 flex items-start justify-center bg-zinc-100/80 p-3 text-center text-sm font-medium text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">{d.festivo}</div>}
      {bloques.map((b) => {
        const c = sitios.get(b.id)!;
        // Si solo se cubre una parte de la hora, el bloque ocupa esa parte.
        const ini = b.parcial?.inicio ?? b.horaInicio;
        const fin = b.parcial?.fin ?? b.horaFin;
        const top = (aMin(ini) - datos.inicio) * PX + 6;
        const alto = Math.max(22, (aMin(fin) - aMin(ini)) * PX - 2);
        const Icono = b.grupoDeSalida ? Bus : ICONO_ESTADO[b.estado];
        const { quien, etiqueta } = describir(b);
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onBloque(b)}
            aria-label={etiqueta}
            title={etiqueta}
            className={cn('absolute z-[5] overflow-hidden rounded-lg border px-1.5 py-1 text-left text-xs leading-tight shadow-sm outline-none hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:ring-3 focus-visible:ring-ring/50', colorDeBloque(b, color), b.grupoDeSalida && 'opacity-70')}
            style={{ top, height: alto, left: `calc(${(c.columna / c.columnas) * 100}% + 2px)`, width: `calc(${100 / c.columnas}% - 4px)` }}
          >
            <span className="flex items-center gap-1 font-semibold">
              <Icono aria-hidden className={cn('size-3.5 shrink-0', COLOR_ICONO[b.estado])} />
              <span className="shrink-0 tabular-nums">{h(ini)}</span>
              {b.grupos && <span className="min-w-0 truncate">{b.grupos}</span>}
            </span>
            {alto < 46 ? (
              <span className="block truncate">
                <span className="opacity-80">{b.ausente}</span> <span className={cn('font-medium', !quien && 'italic')}>{quien ? `→ ${quien}` : '· sin cubrir'}</span>
              </span>
            ) : (
              <>
                <span className="block truncate opacity-80">{b.ausente}</span>
                <span className={cn('block truncate font-medium', !quien && 'italic')}>{quien ? `→ ${quien}` : 'Sin cubrir'}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
