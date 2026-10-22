'use client';

// /gestion/nouvinguts: cada alumno nuevo es una fila con sus pasos en línea. Arriba, los que
// ya lo tienen todo (para cerrar su ciclo); los filtros dicen qué está atascado o con aviso,
// y «pendiente de» enseña solo lo que le toca a secretaría o a TIC.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronRight, Loader2, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import { RESPONSABLE_LABEL, type PasoProceso, type Responsable } from '@/lib/nouvinguts';
import type { NouvingutVista } from '@/lib/nouvinguts-server';
import { Aviso } from '@/components/ui/aviso';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Progreso } from '@/components/ui/progreso';
import { Segmentado } from '@/components/ui/segmentado';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { NavPending } from '@/components/ui/nav-pending';
import { AltaNouvingut } from './alta';
import { ANCHO_PASO, BORDE_RESPONSABLE, LineaPasos, Leyenda, pedir, textoDias } from './comun';

type FiltroLista = 'todos' | 'aviso' | 'atasco' | 'esperando' | 'listos';
type Dueno = 'todos' | Responsable;

const FILTROS: [FiltroLista, string, (n: NouvingutVista) => boolean, ('ok' | 'aviso')?][] = [
  ['todos', 'Todos', () => true],
  ['aviso', 'Con aviso', (n) => n.resumen.avisos > 0, 'aviso'],
  ['atasco', 'Atascados', (n) => n.atascado, 'aviso'],
  ['esperando', 'Esperando a Educamos', (n) => !n.eduStudentId],
  ['listos', 'Listos para cerrar', (n) => n.resumen.listo, 'ok'],
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
  // El diálogo de apuntar se abre con `?apuntar=1`: así lo abre el botón de la cabecera,
  // también desde la ficha de un alumno.
  const alta = useSearchParams().get('apuntar') === '1';
  const [pestana, setPestana] = useState<'abierto' | 'cerrado'>('abierto');
  const [cerrados, setCerrados] = useState<NouvingutVista[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroLista>('todos');
  const [dueno, setDueno] = useState<Dueno>('todos');
  const [cerrando, setCerrando] = useState<string | null>(null);

  const activos = proceso.filter((p) => p.activo);
  const base = useMemo(() => (pestana === 'abierto' ? iniciales : (cerrados ?? [])), [pestana, iniciales, cerrados]);
  const listos = iniciales.filter((n) => n.resumen.listo);

  const visibles = useMemo(() => {
    const pasa = FILTROS.find((f) => f[0] === filtro)![2];
    return base.filter((n) => pasa(n) && (dueno === 'todos' || n.resumen.pendientes[dueno] > 0));
  }, [base, filtro, dueno]);

  async function cambiarPestana(p: 'abierto' | 'cerrado') {
    setPestana(p);
    if (p === 'abierto' || cerrados) return;
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmentado
          etiqueta="Qué nouvinguts ver"
          valor={pestana}
          onChange={(p) => void cambiarPestana(p)}
          opciones={[
            { valor: 'abierto', etiqueta: 'En curso', cuenta: iniciales.length },
            { valor: 'cerrado', etiqueta: 'Ciclo cerrado' },
          ]}
        />
        <p className="flex-1 text-sm text-zinc-500 dark:text-zinc-400">Más adelante: bajas, y el inicio de curso de 3 años.</p>
        {puedeProceso && (
          <Link href="/gestion/nouvinguts/proceso" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <SlidersHorizontal aria-hidden /> Proceso
          </Link>
        )}
      </div>

      {pestana === 'abierto' && listos.length > 0 && (
        <div className="space-y-2">
          {listos.map((n) => (
            <Aviso
              key={n.id}
              tono="ok"
              accion={
                <Button variant="outline" size="sm" disabled={cerrando === n.id} onClick={() => cerrar(n)}>
                  {cerrando === n.id ? <Loader2 className="animate-spin" /> : <Check />} Cerrar ciclo
                </Button>
              }
            >
              <Link href={`/gestion/nouvinguts/${n.id}`} className="font-semibold hover:underline">
                {n.nombre}
              </Link>{' '}
              ({n.clase}) ya tiene todos sus pasos hechos{n.dias > 0 ? ` tras ${n.dias} días` : ''}. Ciérralo y sale de
              nouvinguts.
            </Aviso>
          ))}
        </div>
      )}

      {pestana === 'abierto' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Filtros etiqueta="Mostrar">
            {FILTROS.map(([clave, etiqueta, pasa, tono]) => {
              const n = iniciales.filter(pasa).length;
              if (clave !== 'todos' && n === 0) return null;
              return (
                <Filtro key={clave} activo={filtro === clave} onClick={() => setFiltro(clave)} cuenta={n} tono={tono}>
                  {etiqueta}
                </Filtro>
              );
            })}
          </Filtros>
          <div className="flex flex-wrap items-center gap-2">
            <span aria-hidden className="text-sm text-zinc-500 dark:text-zinc-400">
              Pendiente de
            </span>
            <Filtros etiqueta="Pendiente de">
              {(['todos', 'secretaria', 'tic'] as const).map((d) => (
                <Filtro key={d} activo={dueno === d} onClick={() => setDueno(d)}>
                  {d === 'todos' ? 'Todos' : RESPONSABLE_LABEL[d]}
                </Filtro>
              ))}
            </Filtros>
          </div>
        </div>
      )}

      <div className={cn(claseTarjeta, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="flex items-end gap-4 border-b border-zinc-100 bg-zinc-50/70 px-4 pt-3 pb-2 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="w-52 shrink-0 text-xs font-medium text-zinc-500 lg:w-56 dark:text-zinc-400">Alumno</span>
              <div className="flex">
                {activos.map((p) => (
                  <span key={p.clave} title={p.titulo} className={cn('flex shrink-0 flex-col items-center gap-1', ANCHO_PASO)}>
                    <span className={cn('h-1 w-7 rounded', BORDE_RESPONSABLE[p.responsable])} />
                    <span className="text-xs whitespace-nowrap text-zinc-500 dark:text-zinc-400">{p.corto}</span>
                  </span>
                ))}
              </div>
              <span className="hidden w-16 shrink-0 text-xs font-medium text-zinc-500 lg:block dark:text-zinc-400">Hecho</span>
              <span className="hidden w-60 shrink-0 text-xs font-medium text-zinc-500 lg:block dark:text-zinc-400">
                {pestana === 'abierto' ? 'Qué toca' : 'Cerrado'}
              </span>
            </div>

            {cargando && (
              <p role="status" className="flex items-center gap-2 px-4 py-10 text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            )}
            {!cargando && visibles.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
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
                <span className="flex w-52 shrink-0 items-center gap-3 lg:w-56">
                  <Avatar email={n.id} nombre={n.nombre} tamano="lg" neutro title={n.nombre} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 leading-snug font-medium text-zinc-900 dark:text-zinc-100">{n.nombre}</span>
                    <span className="flex flex-wrap gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{n.clase}</span>·
                      <span className={cn(n.atascado && 'font-semibold text-amber-700 dark:text-amber-400')}>{textoDias(n.dias)}</span>
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
                  <span className="block font-mono text-sm text-zinc-700 dark:text-zinc-300">
                    {n.resumen.hechos}/{n.resumen.total}
                  </span>
                  <Progreso hechos={n.resumen.hechos} total={n.resumen.total} etiqueta={`Pasos de ${n.nombre}`} className="mt-1 w-12" />
                </span>
                <span className="hidden w-60 shrink-0 items-center justify-between gap-2 lg:flex">
                  <QueToca n={n} />
                  <NavPending />
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Leyenda />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        El día sale en ámbar cuando lleva más de {diasAtasco} días sin terminar.
      </p>

      <AltaNouvingut abierto={alta} onCerrar={() => router.replace('/gestion/nouvinguts', { scroll: false })} />
    </div>
  );
}

function QueToca({ n }: { n: NouvingutVista }) {
  if (n.estado === 'cerrado') {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {n.cerradoAt
          ? new Date(n.cerradoAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: CONFIGURACION.calendario.zonaHoraria })
          : ''}
        {n.cerradoPor ? ` · ${n.cerradoPor}` : ''}
      </span>
    );
  }
  if (n.resumen.listo) return <Estado tono="ok">Listo para cerrar</Estado>;
  const aviso = n.resumen.primerAviso;
  if (aviso) {
    return (
      <Estado tono="aviso" icono={<TriangleAlert />} className="max-w-full min-w-0 shrink">
        <span className="truncate">
          {aviso.clave === 'licencias' ? `Licencias: ${aviso.texto.charAt(0).toLowerCase()}${aviso.texto.slice(1)}` : aviso.texto}
        </span>
        {n.resumen.avisos > 1 && <span className="shrink-0 opacity-70">+{n.resumen.avisos - 1}</span>}
      </Estado>
    );
  }
  if (!n.eduStudentId) return <Estado tono="neutro">Esperando a Educamos</Estado>;
  return (
    <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">
      Siguiente: <span className="font-medium text-zinc-900 dark:text-zinc-100">{n.resumen.siguiente?.titulo}</span>
    </span>
  );
}
