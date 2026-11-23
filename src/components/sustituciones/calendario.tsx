'use client';

// El calendario de Sustituciones (docs/32, «Calendario», David 23-nov-2026): la semana entera de un
// vistazo, con las horas a escala (cada etapa tiene su rejilla, así que el eje es el reloj y no el
// tramo), cada hora que pide sustituto con el color de su estado, y las salidas y bajas de cada día.
// Tocar un hueco apunta una sustitución a esa hora; tocar la cabecera de un día, el día entero; tocar
// un bloque abre su ficha. Todo en un panel al lado, sin salir de la semana. En el móvil, día a día.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Bus, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, MailX, PencilLine, Plus, Settings2, UserRoundMinus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import { aMin, sumarDias } from '@/lib/oratorios';
import { aHHMM, colocarBloques, ESTADO_HORA_INFO, lunesDe, rotuloDia, rotuloSemana, type EstadoHoraSust } from '@/lib/sustituciones';
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

/** Las bajas de toda la semana van en una línea; en cada día, solo lo que cambia (empieza o acaba). */
function bajasDeLaSemana(dias: DiaSemana[]): { comunes: DiaSemana['bajas']; porDia: Map<string, DiaSemana['bajas']> } {
  const k = (b: DiaSemana['bajas'][number]) => `${b.nombre}#${b.cubre ?? ''}`;
  const lectivos = dias.filter((d) => !d.festivo);
  const comunes = (lectivos[0]?.bajas ?? []).filter((b) => lectivos.every((d) => d.bajas.some((x) => k(x) === k(b))));
  const enComun = new Set(comunes.map(k));
  return { comunes, porDia: new Map(dias.map((d) => [d.fecha, d.bajas.filter((b) => !enComun.has(k(b)))])) };
}

const textoBajas = (bs: DiaSemana['bajas']) => bs.map((b) => (b.cubre ? `${b.nombre} (la cubre ${b.cubre})` : `${b.nombre} (sin sustituto)`)).join(' · ');

type Grupo = 'todas' | (typeof CONFIGURACION.sustituciones.jefaturas)[number]['clave'];

type Panel = { tipo: 'nueva'; inicial: InicialAusencia; clave: number } | { tipo: 'ficha'; id: string } | null;

export interface AbrirAlCargar {
  nueva?: InicialAusencia;
  ausencia?: string;
  /** Cambia en cada petición: «Apuntar» de la cabecera vuelve a abrir el panel aunque ya estés aquí. */
  marca?: number;
}

export function Calendario({
  inicial,
  hoy,
  grupoInicial,
  propia,
  profes,
  abrir,
}: {
  inicial: DatosSemana;
  hoy: string;
  grupoInicial: Grupo;
  /** La jefatura de quien mira (para el «Mi etapa»), o null. */
  propia: Grupo | null;
  profes: ProfeSelector[];
  abrir: AbrirAlCargar;
}) {
  const [datos, setDatos] = useState(inicial);
  const [grupo, setGrupo] = useState<Grupo>(grupoInicial);
  const [cargando, setCargando] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [ficha, setFicha] = useState<DatosFicha | null>(null);
  // En el móvil se ve un día: hoy si es de esta semana; si no, el lunes.
  const [diaMovil, setDiaMovil] = useState(() => Math.max(0, inicial.dias.findIndex((d) => d.fecha === hoy)));
  const peticion = useRef(0);
  const lunes = datos.lunes;
  const etapasPrimero = useMemo(() => (grupo === 'todas' ? [] : [...(CONFIGURACION.sustituciones.jefaturas.find((j) => j.clave === grupo)?.etapas ?? [])]), [grupo]);

  const cargarSemana = useCallback(async (l: string, g: Grupo) => {
    const n = ++peticion.current;
    setCargando(true);
    try {
      const d = await pedir<DatosSemana>(`/api/sustituciones/admin/semana?lunes=${l}&grupo=${g}`);
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
    void cargarSemana(l, grupo);
  }

  function cambiarGrupo(g: Grupo) {
    setGrupo(g);
    guardarGrupoEtapas(g);
    void cargarSemana(lunes, g);
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
    void cargarSemana(lunes, grupo);
    if (panel?.tipo === 'ficha') void pedir<DatosFicha>(`/api/sustituciones/admin/ausencias/${panel.id}`).then(setFicha).catch(() => undefined);
  }, [cargarSemana, lunes, grupo, panel]);

  const esteLunes = lunesDe(hoy);
  const bajas = useMemo(() => bajasDeLaSemana(datos.dias), [datos.dias]);
  const conBajasDelDia = (d: DiaSemana): DiaSemana => ({ ...d, bajas: bajas.porDia.get(d.fecha) ?? [] });
  const pendientes = datos.cuentas.sin_cubrir + datos.cuentas.error;

  return (
    <div className="space-y-4">
      {/* Barra: semana, etapa y estados */}
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
        <Link href="/gestion/sustituciones/ajustes" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'order-last md:order-none' })}>
          <Settings2 aria-hidden /> Correos y avisos
        </Link>
        <Filtros etiqueta="Etapas" className="md:ml-auto">
          {CONFIGURACION.sustituciones.jefaturas.map((j) => (
            <Filtro key={j.clave} activo={grupo === j.clave} onClick={() => cambiarGrupo(j.clave)}>
              {j.nombre}
              {propia === j.clave && <span className="sr-only"> (la tuya)</span>}
            </Filtro>
          ))}
          <Filtro activo={grupo === 'todas'} onClick={() => cambiarGrupo('todas')}>
            Todo
          </Filtro>
        </Filtros>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-live="polite">
        {ORDEN_LEYENDA.filter((e) => datos.cuentas[e] > 0 || e === 'sin_cubrir' || e === 'confirmada').map((e) => {
          const Icono = ICONO_ESTADO[e];
          return (
            <span key={e} className={cn('inline-flex items-center gap-1.5', datos.cuentas[e] > 0 && (e === 'sin_cubrir' || e === 'error') ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400')}>
              <span aria-hidden className={cn('inline-flex size-5 items-center justify-center rounded-md border', COLOR_ESTADO[e])}>
                <Icono className={cn('size-3.5', COLOR_ICONO[e])} />
              </span>
              <span className="tabular-nums">{datos.cuentas[e]}</span> {PLURAL[e][datos.cuentas[e] === 1 ? 0 : 1]}
            </span>
          );
        })}
        <span className="hidden text-zinc-500 lg:inline dark:text-zinc-400">· Toca un hueco para apuntar a esa hora, o el nombre del día para el día entero</span>
        {pendientes === 0 && datos.bloques.length > 0 && <span className="text-emerald-700 dark:text-emerald-400">Todo cubierto</span>}
      </div>

      {bajas.comunes.length > 0 && (
        <details className="group text-sm text-zinc-600 dark:text-zinc-400">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <UserRoundMinus aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 truncate group-open:whitespace-normal">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">De baja toda la semana ({bajas.comunes.length}):</span>{' '}
              <span className="group-open:hidden">{bajas.comunes.map((b) => b.nombre).join(', ')}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-1 space-y-0.5 pl-6">
            {bajas.comunes.map((b) => (
              <li key={b.nombre}>
                {b.nombre} · {b.cubre ? `la cubre ${b.cubre}` : 'sin sustituto (sus horas se cubren aquí)'}
              </li>
            ))}
          </ul>
        </details>
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
        <Rejilla datos={datos} dias={[conBajasDelDia(datos.dias[diaMovil])]} hoy={hoy} cargando={cargando} onHueco={abrirNueva} onBloque={(b) => void abrirFicha(b.ausenciaId)} />
      </div>

      {/* Desde el iPad: la semana */}
      <div className="hidden md:block">
        <Rejilla datos={datos} dias={datos.dias.map(conBajasDelDia)} hoy={hoy} cargando={cargando} onHueco={abrirNueva} onBloque={(b) => void abrirFicha(b.ausenciaId)} />
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
                  void cargarSemana(lunes, grupo);
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

/** La rejilla: el eje de horas y una columna por día. */
function Rejilla({
  datos,
  dias,
  hoy,
  cargando,
  onHueco,
  onBloque,
}: {
  datos: DatosSemana;
  dias: DiaSemana[];
  hoy: string;
  cargando: boolean;
  onHueco: (i: InicialAusencia) => void;
  onBloque: (b: BloqueSemana) => void;
}) {
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
      {una && <BandasDia d={dias[0]} className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800" />}
      <div className={cn('relative grid', una ? 'grid-cols-[3rem_minmax(0,1fr)]' : 'grid-cols-[3.25rem_repeat(5,minmax(0,1fr))]')} style={{ height: alto + 12 }}>
        {/* Eje de horas */}
        <div className="relative">
          {horas.map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400" style={{ top: (m - datos.inicio) * PX + 6 }}>
              {aHHMM(m).replace(/^0/, '')}
            </span>
          ))}
        </div>
        {dias.map((d) => (
          <ColumnaDia key={d.fecha} d={d} datos={datos} hoy={hoy} horas={horas} onHueco={onHueco} onBloque={onBloque} />
        ))}
      </div>
    </div>
  );
}

function CabeceraDia({ d, hoy, n, onApuntar }: { d: DiaSemana; hoy: string; n: number; onApuntar: () => void }) {
  const r = rotuloDia(d.fecha);
  const esHoy = d.fecha === hoy;
  return (
    <div className={cn('min-w-0 border-l border-zinc-200 p-1.5 dark:border-zinc-800', esHoy && 'bg-blue-50/60 dark:bg-blue-500/5')}>
      <button
        type="button"
        disabled={Boolean(d.festivo)}
        onClick={onApuntar}
        title={d.festivo ? undefined : `Apuntar para todo el ${r.largo}`}
        className="group flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800"
      >
        <span className={cn('text-sm', esHoy ? 'font-semibold text-blue-700 dark:text-blue-300' : 'font-medium text-zinc-600 dark:text-zinc-400')}>{r.corto}</span>
        <span
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-full text-base font-semibold tabular-nums',
            esHoy ? 'bg-blue-600 text-white' : 'text-zinc-900 dark:text-zinc-100',
          )}
        >
          {r.numero}
        </span>
        {n > 0 && <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{n === 1 ? '1 hora' : `${n} horas`}</span>}
        {!d.festivo && <Plus aria-hidden className="ml-auto size-4 text-zinc-400 group-hover:text-blue-600" />}
        <span className="sr-only">{d.festivo ? `${r.largo}: ${d.festivo}` : `Apuntar una sustitución para todo el ${r.largo}`}</span>
      </button>
      <BandasDia d={d} className="mt-1 px-0.5" />
    </div>
  );
}

/** Lo que hay ese día además de las horas: salidas y quién está de baja. */
function BandasDia({ d, className }: { d: DiaSemana; className?: string }) {
  if (d.salidas.length === 0 && d.bajas.length === 0) return null;
  return (
    <div className={cn('space-y-1', className)}>
      {d.salidas.map((s) => (
        <p key={s.id} className="flex items-start gap-1.5 rounded-md bg-zinc-100 px-1.5 py-1 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100" title={s.acompanantes.length ? `Van: ${s.acompanantes.join(', ')}` : undefined}>
          <Bus aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium">{s.grupos.join(', ')}</span> · {s.descripcion}
            {s.horaInicio && ` · ${s.horaInicio.replace(/^0/, '')}-${s.horaFin?.replace(/^0/, '')}`}
          </span>
        </p>
      ))}
      {d.bajas.length > 0 && (
        <p className="flex items-start gap-1.5 px-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <UserRoundMinus aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            De baja: {textoBajas(d.bajas)}
          </span>
        </p>
      )}
    </div>
  );
}

function ColumnaDia({
  d,
  datos,
  hoy,
  horas,
  onHueco,
  onBloque,
}: {
  d: DiaSemana;
  datos: DatosSemana;
  hoy: string;
  horas: number[];
  onHueco: (i: InicialAusencia) => void;
  onBloque: (b: BloqueSemana) => void;
}) {
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
          aria-label={`Apuntar una sustitución el ${r.largo} a las ${aHHMM(m).replace(/^0/, '')}`}
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
          <span className="-translate-y-1/2 rounded-md bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums shadow-sm">+ {aHHMM(guia).replace(/^0/, '')}</span>
          <span className="h-px flex-1 bg-blue-500/60" />
        </div>
      )}
      {d.festivo && (
        <div className="absolute inset-0 flex items-start justify-center bg-zinc-100/80 p-3 text-center text-sm font-medium text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          {d.festivo}
        </div>
      )}
      {bloques.map((b) => {
        const c = sitios.get(b.id)!;
        const top = (aMin(b.horaInicio) - datos.inicio) * PX + 6;
        const h = Math.max(22, (aMin(b.horaFin) - aMin(b.horaInicio)) * PX - 2);
        const Icono = b.grupoDeSalida ? Bus : ICONO_ESTADO[b.estado];
        const info = ESTADO_HORA_INFO[b.estado];
        const quien = [b.sustituto, b.sustituto2].filter(Boolean).join(' y ');
        const etiqueta = `${b.horaInicio.replace(/^0/, '')}-${b.horaFin.replace(/^0/, '')} · ${b.grupos ?? b.materia ?? ''} · falta ${b.ausente} · ${quien ? `entra ${quien}` : 'sin cubrir'} · ${info.nombre}${b.grupoDeSalida ? ` · su grupo está de salida (${b.grupoDeSalida})` : ''}`;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onBloque(b)}
            aria-label={etiqueta}
            title={etiqueta}
            className={cn(
              'absolute z-[5] overflow-hidden rounded-lg border px-1.5 py-1 text-left text-xs leading-tight shadow-sm outline-none hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:ring-3 focus-visible:ring-ring/50',
              COLOR_ESTADO[b.estado],
              b.grupoDeSalida && 'opacity-70',
            )}
            style={{ top, height: h, left: `calc(${(c.columna / c.columnas) * 100}% + 2px)`, width: `calc(${100 / c.columnas}% - 4px)` }}
          >
            <span className="flex items-center gap-1 font-semibold">
              <Icono aria-hidden className={cn('size-3.5 shrink-0', COLOR_ICONO[b.estado])} />
              <span className="shrink-0 tabular-nums">{b.horaInicio.replace(/^0/, '')}</span>
              {b.grupos && <span className="min-w-0 truncate">{b.grupos}</span>}
            </span>
            {h < 46 ? (
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

