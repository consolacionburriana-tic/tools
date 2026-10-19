'use client';

// /gestion/nouvinguts: cada alumno nuevo es una fila con sus pasos en línea. Arriba, los que
// ya lo tienen todo (para cerrar su ciclo); los filtros dicen qué está atascado o con aviso,
// y «pendiente de» enseña solo lo que le toca a secretaría o a TIC.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, SlidersHorizontal, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import { RESPONSABLE_LABEL, type PasoProceso, type Responsable } from '@/lib/nouvinguts';
import type { NouvingutVista } from '@/lib/nouvinguts-server';
import { AltaNouvingut } from './alta';
import { ANCHO_PASO, BORDE_RESPONSABLE, LineaPasos, Leyenda, pedir, textoDias } from './comun';

type Filtro = 'todos' | 'aviso' | 'atasco' | 'esperando' | 'listos';
type Dueno = 'todos' | Responsable;

const FILTROS: [Filtro, string, (n: NouvingutVista) => boolean][] = [
  ['todos', 'Todos', () => true],
  ['aviso', 'Con aviso', (n) => n.resumen.avisos > 0],
  ['atasco', 'Atascados', (n) => n.atascado],
  ['esperando', 'Esperando a Educamos', (n) => !n.eduStudentId],
  ['listos', 'Listos para cerrar', (n) => n.resumen.listo],
];

export function ListaNouvinguts({
  iniciales,
  proceso,
  diasAtasco,
  puedeProceso,
}: {
  iniciales: NouvingutVista[];
  proceso: PasoProceso[];
  diasAtasco: number;
  puedeProceso: boolean;
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState<'abierto' | 'cerrado'>('abierto');
  const [cerrados, setCerrados] = useState<NouvingutVista[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [dueno, setDueno] = useState<Dueno>('todos');
  const [alta, setAlta] = useState(false);
  const [cerrando, setCerrando] = useState<string | null>(null);

  const activos = proceso.filter((p) => p.activo);
  const base = useMemo(() => (pestana === 'abierto' ? iniciales : (cerrados ?? [])), [pestana, iniciales, cerrados]);
  const listos = iniciales.filter((n) => n.resumen.listo);

  const visibles = useMemo(() => {
    const pasa = FILTROS.find((f) => f[0] === filtro)![2];
    return base.filter((n) => pasa(n) && (dueno === 'todos' || n.resumen.pendientes[dueno] > 0));
  }, [base, filtro, dueno]);

  async function verCerrados() {
    setPestana('cerrado');
    if (cerrados) return;
    setCargando(true);
    try {
      const r = await pedir<{ nouvinguts: NouvingutVista[] }>('/api/nouvinguts?estado=cerrado');
      setCerrados(r.nouvinguts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se han podido cargar');
    } finally {
      setCargando(false);
    }
  }

  async function cerrar(n: NouvingutVista) {
    setCerrando(n.id);
    try {
      await pedir(`/api/nouvinguts/${n.id}`, { method: 'PATCH', body: JSON.stringify({ accion: 'cerrar' }) });
      haptic.success();
      toast.success(`${n.nombre} sale de nouvinguts`);
      setCerrados(null);
      router.refresh();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido cerrar');
    } finally {
      setCerrando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Nouvinguts</h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Los que acaban de llegar: desde que se apuntan hasta que tienen hecho todo lo del principio. Cuando está todo, se
            cierra su ciclo y salen de aquí.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeProceso && (
            <Link
              href="/gestion/nouvinguts/proceso"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <SlidersHorizontal className="h-4 w-4" /> Proceso
            </Link>
          )}
          <button
            type="button"
            onClick={() => setAlta(true)}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" /> Apuntar nouvingut
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 border-b border-zinc-200 dark:border-zinc-800">
        <PestanaBoton activa={pestana === 'abierto'} onClick={() => setPestana('abierto')}>
          En curso <span className="font-mono text-zinc-500">{iniciales.length}</span>
        </PestanaBoton>
        <PestanaBoton activa={pestana === 'cerrado'} onClick={verCerrados}>
          Ciclo cerrado
        </PestanaBoton>
        <span className="flex items-center gap-2 py-2.5 text-sm text-zinc-400">
          Bajas <Pronto>más adelante</Pronto>
        </span>
        <span className="flex items-center gap-2 py-2.5 text-sm text-zinc-400">
          Inicio de curso · 3 años <Pronto>curso que viene</Pronto>
        </span>
      </div>

      {pestana === 'abierto' && listos.length > 0 && (
        <div className="space-y-2">
          {listos.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            >
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              <p className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-200">
                <Link href={`/gestion/nouvinguts/${n.id}`} className="font-semibold hover:underline">
                  {n.nombre}
                </Link>{' '}
                ({n.clase}) ya tiene todos sus pasos hechos{n.dias > 0 ? ` tras ${n.dias} días` : ''}.{' '}
                <span className="text-zinc-600 dark:text-zinc-400">Ciérralo y sale de nouvinguts.</span>
              </p>
              <button
                type="button"
                disabled={cerrando === n.id}
                onClick={() => cerrar(n)}
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {cerrando === n.id && <Loader2 className="h-4 w-4 animate-spin" />} Cerrar ciclo
              </button>
            </div>
          ))}
        </div>
      )}

      {pestana === 'abierto' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map(([clave, etiqueta, pasa]) => {
              const n = iniciales.filter(pasa).length;
              if (clave !== 'todos' && n === 0) return null;
              return (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setFiltro(clave)}
                  className={cn(
                    'inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                    filtro === clave
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                  )}
                >
                  {etiqueta} <span className="font-mono text-xs opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Pendiente de</span>
            <div className="flex rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
              {(['todos', 'secretaria', 'tic'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDueno(d)}
                  className={cn(
                    'h-8 cursor-pointer rounded-lg px-3 text-sm',
                    dueno === d ? 'bg-white font-semibold shadow-sm dark:bg-zinc-900' : 'text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {d === 'todos' ? 'Todos' : RESPONSABLE_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="flex items-end gap-4 border-b border-zinc-100 bg-zinc-50/70 px-4 pt-3 pb-2 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="w-52 shrink-0 text-xs font-medium text-zinc-500 lg:w-64">Alumno</span>
              <div className="flex">
                {activos.map((p) => (
                  <span key={p.clave} title={p.titulo} className={cn('flex shrink-0 flex-col items-center gap-1', ANCHO_PASO)}>
                    <span className={cn('h-1 w-7 rounded', BORDE_RESPONSABLE[p.responsable])} />
                    <span className="text-[11px] whitespace-nowrap text-zinc-500">{p.corto}</span>
                  </span>
                ))}
              </div>
              <span className="hidden w-16 shrink-0 text-xs font-medium text-zinc-500 lg:block">Hecho</span>
              <span className="hidden w-72 shrink-0 text-xs font-medium text-zinc-500 lg:block">{pestana === 'abierto' ? 'Qué toca' : 'Cerrado'}</span>
            </div>

            {cargando && (
              <p className="flex items-center gap-2 px-4 py-10 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            )}
            {!cargando && visibles.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-zinc-500">
                {base.length === 0
                  ? pestana === 'abierto'
                    ? 'No hay nadie nuevo en curso. Las altas de Educamos entran solas; también puedes apuntar a alguien a mano.'
                    : 'Todavía no se ha cerrado ningún ciclo.'
                  : 'Nadie en este filtro.'}
              </p>
            )}
            {visibles.map((n) => (
              <Link
                key={n.id}
                href={`/gestion/nouvinguts/${n.id}`}
                className="group flex items-center gap-4 border-t border-zinc-100 px-4 py-3 transition-colors first:border-t-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
              >
                <span className="flex w-52 shrink-0 items-center gap-3 lg:w-64">
                  <Iniciales nombre={n.nombre} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 leading-snug font-medium text-zinc-900 dark:text-zinc-100">{n.nombre}</span>
                    <span className="flex flex-wrap gap-1.5 text-xs text-zinc-500">
                      <span>{n.clase}</span>·
                      <span className={cn(n.atascado && 'font-semibold text-orange-700 dark:text-orange-400')}>{textoDias(n.dias)}</span>
                      {n.notas > 0 && <span>· {n.notas} nota{n.notas === 1 ? '' : 's'}</span>}
                      <span className="font-mono lg:hidden">
                        · {n.resumen.hechos}/{n.resumen.total}
                      </span>
                    </span>
                    {/* Sin sitio para la columna «Qué toca» (iPad en vertical), va aquí debajo. */}
                    <span className="mt-1 flex lg:hidden">
                      <QueToca n={n} />
                    </span>
                  </span>
                </span>
                <LineaPasos pasos={n.pasos} />
                <span className="hidden w-16 shrink-0 lg:block">
                  <span className="block font-mono text-sm">
                    {n.resumen.hechos}/{n.resumen.total}
                  </span>
                  <span className="mt-1 block h-1 w-12 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                    <span
                      className="block h-1 bg-emerald-600"
                      style={{ width: `${n.resumen.total ? Math.round((n.resumen.hechos / n.resumen.total) * 100) : 0}%` }}
                    />
                  </span>
                </span>
                <span className="hidden w-72 shrink-0 items-center justify-between gap-2 lg:flex">
                  <QueToca n={n} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Leyenda />
      <p className="text-xs text-zinc-500">El día sale en naranja cuando lleva más de {diasAtasco} días sin terminar.</p>

      <AltaNouvingut abierto={alta} onCerrar={() => setAlta(false)} />
    </div>
  );
}

function QueToca({ n }: { n: NouvingutVista }) {
  if (n.estado === 'cerrado') {
    return (
      <span className="text-xs text-zinc-500">
        {n.cerradoAt ? new Date(n.cerradoAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: CONFIGURACION.calendario.zonaHoraria }) : ''}
        {n.cerradoPor ? ` · ${n.cerradoPor}` : ''}
      </span>
    );
  }
  if (n.resumen.listo) {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        Listo para cerrar
      </span>
    );
  }
  const aviso = n.resumen.primerAviso;
  if (aviso) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {aviso.clave === 'licencias' ? `Licencias: ${aviso.texto.charAt(0).toLowerCase()}${aviso.texto.slice(1)}` : aviso.texto}
        </span>
        {n.resumen.avisos > 1 && <span className="shrink-0 opacity-70">+{n.resumen.avisos - 1}</span>}
      </span>
    );
  }
  if (!n.eduStudentId) {
    return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Esperando a Educamos</span>;
  }
  return (
    <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">
      Siguiente: <span className="font-medium text-zinc-900 dark:text-zinc-100">{n.resumen.siguiente?.titulo}</span>
    </span>
  );
}

function Iniciales({ nombre }: { nombre: string }) {
  const partes = nombre.split(' ').filter(Boolean);
  const ini = ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {ini}
    </span>
  );
}

function PestanaBoton({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px flex cursor-pointer items-center gap-2 border-b-2 py-2.5 text-sm',
        activa ? 'border-zinc-900 font-semibold text-zinc-900 dark:border-zinc-100 dark:text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-800',
      )}
    >
      {children}
    </button>
  );
}

function Pronto({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] dark:border-zinc-700">{children}</span>;
}
