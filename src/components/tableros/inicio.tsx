'use client';

// /gestion/tableros: lo que tengo asignado arriba, y debajo mis equipos con sus tableros en
// baldosas de colores (estilo Trello). Desde aquí se crean equipos y tableros y se lleva quién
// está en cada equipo.
import { Avatar, Avatares } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useConfirmar } from '@/components/ui/confirmar';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Skeleton } from '@/components/ui/skeleton';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Bell,
  ChevronRight,
  LayoutGrid,
  ListChecks,
  LogOut,
  Plus,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NavPending } from '@/components/ui/nav-pending';
import { SelectorEmoji } from '@/components/mihorario/selector-emoji';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  agruparMias,
  GRUPO_MIO_LABELS,
  type ColorTablero,
  type Equipo,
  type Persona,
  type Preferencias,
  type TableroResumen,
  type TarjetaMia,
} from '@/lib/tableros';
import {
  api,
  ChipPrioridad,
  ChipVence,
  EMOJIS_TABLERO,
  ACENTO,
  TINTE,
  SelectorColor,
} from './comun';
import { SelectorPersonas } from './selector-personas';

interface DatosInicio {
  equipos: Equipo[];
  mias: TarjetaMia[];
  hoy: string;
}

export function InicioTableros({ inicial, yo }: { inicial: DatosInicio; yo: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const [datos, setDatos] = useState(inicial);
  // «Nuevo equipo» está en la cabecera del módulo como enlace con `?nuevo=1`: la página abre
  // el diálogo al verlo (también si se llega desde un tablero).
  const pideNuevo = useSearchParams().get('nuevo') === '1';
  const [nuevoEquipoAbierto, setNuevoEquipo] = useState(false);
  const nuevoEquipo = nuevoEquipoAbierto || pideNuevo;
  function cerrarNuevoEquipo() {
    setNuevoEquipo(false);
    if (pideNuevo) router.replace(ruta, { scroll: false });
  }
  const [ajustesDe, setAjustesDe] = useState<string | null>(null);
  const [nuevoTableroEn, setNuevoTableroEn] = useState<Equipo | null>(null);
  const [avisos, setAvisos] = useState(false);

  async function recargar() {
    try {
      setDatos(await api.inicio());
    } catch {
      toast.error('No se ha podido recargar');
    }
  }

  const equipoAjustes = datos.equipos.find((e) => e.id === ajustesDe) ?? null;

  return (
    <div className="space-y-8">
      <h1 className="sr-only">Tableros</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Tareas por equipos: solo entra quien está en cada equipo.</p>
        <Button type="button" variant="outline" onClick={() => setAvisos(true)} aria-label="Avisos por correo">
          <Bell aria-hidden /> <span className="hidden sm:inline">Avisos por correo</span>
        </Button>
      </div>

      <LoTuyo mias={datos.mias} hoy={datos.hoy} />

      {datos.equipos.length === 0 ? (
        <SinEquipos onCrear={() => setNuevoEquipo(true)} />
      ) : (
        <div className="space-y-8">
          {datos.equipos.map((e) => (
            <SeccionEquipo
              key={e.id}
              equipo={e}
              onAjustes={() => setAjustesDe(e.id)}
              onNuevoTablero={() => setNuevoTableroEn(e)}
              onRecargar={recargar}
            />
          ))}
        </div>
      )}

      {nuevoEquipo && (
        <DialogoNuevoEquipo
          onClose={cerrarNuevoEquipo}
          onCreado={async () => {
            cerrarNuevoEquipo();
            await recargar();
          }}
        />
      )}
      {equipoAjustes && (
        <DialogoEquipo
          equipo={equipoAjustes}
          yo={yo}
          onClose={() => setAjustesDe(null)}
          onCambio={recargar}
          onFuera={async () => {
            setAjustesDe(null);
            await recargar();
          }}
        />
      )}
      {nuevoTableroEn && (
        <DialogoNuevoTablero
          equipo={nuevoTableroEn}
          onClose={() => setNuevoTableroEn(null)}
          onCreado={(id) => {
            setNuevoTableroEn(null);
            router.push(`/gestion/tableros/${id}`);
          }}
        />
      )}
      {avisos && <DialogoAvisos onClose={() => setAvisos(false)} />}
    </div>
  );
}

// ─── Lo tuyo ─────────────────────────────────────────────────────────────────
function LoTuyo({ mias, hoy }: { mias: TarjetaMia[]; hoy: string }) {
  if (mias.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        <Sparkles aria-hidden className="size-5 shrink-0 text-zinc-400" />
        No tienes nada asignado ahora mismo. Cuando alguien te asigne una tarea, saldrá aquí.
      </div>
    );
  }
  const grupos = agruparMias(mias, hoy);
  return (
    <Tarjeta as="section" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <ListChecks aria-hidden className="size-5 text-zinc-500 dark:text-zinc-400" />
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Lo tuyo</h2>
        <span className="rounded-full bg-zinc-100 px-2 text-xs font-semibold text-zinc-700 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
          {mias.length}
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {grupos.map((g) => (
          <div key={g.grupo}>
            <p
              className={cn(
                'px-4 pt-3 pb-1 text-xs font-semibold tracking-wider uppercase',
                g.grupo === 'vencidas'
                  ? 'text-red-700 dark:text-red-400'
                  : g.grupo === 'hoy'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              {GRUPO_MIO_LABELS[g.grupo]}
            </p>
            <ul className="pb-2">
              {g.tarjetas.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/gestion/tableros/${t.tableroId}?t=${t.id}`}
                    className="flex min-h-11 items-start gap-3 px-4 py-2 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:items-center dark:hover:bg-zinc-800/60"
                  >
                    <span aria-hidden className="text-lg">{t.tableroEmoji}</span>
                    {/* En el móvil los chips van debajo del título: si no, no se lee de qué es la tarea */}
                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.titulo}</span>
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {t.equipoNombre} · {t.tableroNombre} · {t.columnaNombre}
                          {t.checklistTotal > 0 && ` · ${t.checklistHechos}/${t.checklistTotal} pasos`}
                        </span>
                      </span>
                      {(t.vence || (t.prioridad && t.prioridad !== 'baja')) && (
                        <span className="flex shrink-0 items-center gap-1.5">
                          {t.prioridad && t.prioridad !== 'baja' && <ChipPrioridad prioridad={t.prioridad} />}
                          {t.vence && <ChipVence vence={t.vence} hoy={hoy} />}
                        </span>
                      )}
                    </span>
                    <NavPending />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function SinEquipos({ onCrear }: { onCrear: () => void }) {
  return (
    <Vacio
      icono={<LayoutGrid />}
      titulo="Todavía no estás en ningún equipo"
      accion={
        <Button type="button" onClick={onCrear}>
          <Plus aria-hidden /> Crear mi primer equipo
        </Button>
      }
    >
      Crea uno (aunque sea solo para ti), mete a quien haga falta y organiza las tareas en tableros con columnas: por
      hacer, en curso y hecho. Si alguien te añade a su equipo, lo verás aquí.
    </Vacio>
  );
}

// ─── Un equipo ───────────────────────────────────────────────────────────────
function SeccionEquipo({
  equipo,
  onAjustes,
  onNuevoTablero,
  onRecargar,
}: {
  equipo: Equipo;
  onAjustes: () => void;
  onNuevoTablero: () => void;
  onRecargar: () => Promise<void>;
}) {
  const [verArchivados, setVerArchivados] = useState(false);
  const activos = equipo.tableros.filter((t) => !t.archivado);
  const archivados = equipo.tableros.filter((t) => t.archivado);

  async function recuperar(t: TableroResumen) {
    try {
      await api.accionTablero(t.id, { accion: 'editar', archivado: false });
      haptic.success();
      await onRecargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ring-1', TINTE[equipo.color])}>
          {equipo.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{equipo.nombre}</h2>
          {equipo.descripcion && <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{equipo.descripcion}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onAjustes}
          aria-label={`Miembros y ajustes de ${equipo.nombre}`}
          className="px-2"
        >
          <Avatares personas={equipo.miembros} max={4} />
          <Settings2 aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activos.map((t) => (
          <BaldosaTablero key={t.id} tablero={t} />
        ))}
        <button
          type="button"
          onClick={onNuevoTablero}
          className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 outline-none transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-blue-600 dark:hover:bg-blue-500/5 dark:hover:text-blue-400"
        >
          <Plus aria-hidden className="size-5" /> Nuevo tablero
        </button>
      </div>

      {archivados.length > 0 && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVerArchivados((v) => !v)}
            aria-expanded={verArchivados}
            className="-ml-3.5"
          >
            <Archive aria-hidden /> {archivados.length} archivado{archivados.length === 1 ? '' : 's'}
            <ChevronRight aria-hidden className={cn('transition-transform', verArchivados && 'rotate-90')} />
          </Button>
          {verArchivados && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {archivados.map((t) => (
                <li key={t.id} className="flex min-h-11 items-center gap-1 rounded-xl border border-zinc-200 bg-white py-0.5 pr-0.5 pl-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <Link href={`/gestion/tableros/${t.id}`} className="rounded text-zinc-700 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300">
                    {t.emoji} {t.nombre}
                  </Link>
                  {equipo.miRol === 'admin' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => recuperar(t)}
                      aria-label={`Sacar ${t.nombre} del archivo`}
                    >
                      <ArchiveRestore aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function BaldosaTablero({ tablero: t }: { tablero: TableroResumen }) {
  return (
    <Link
      href={`/gestion/tableros/${t.id}`}
      className="group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 outline-none transition-colors hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      {/* El color del tablero, en una raya fina arriba: se reconoce sin gritar */}
      <span className={cn('absolute inset-x-0 top-0 h-1', ACENTO[t.color])} />
      <span className="flex items-start gap-3">
        <span aria-hidden className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ring-1', TINTE[t.color])}>
          {t.emoji}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate font-semibold text-zinc-900 dark:text-zinc-100">{t.nombre}</span>
          {t.descripcion && <span className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{t.descripcion}</span>}
        </span>
        <NavPending />
      </span>
      <span className="mt-4 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{t.abiertas === 0 ? 'Todo hecho' : `${t.abiertas} por hacer`}</span>
        {t.vencidas > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {t.vencidas} vencida{t.vencidas === 1 ? '' : 's'}
          </span>
        )}
      </span>
    </Link>
  );
}

// ─── Diálogos ────────────────────────────────────────────────────────────────
function CamposAspecto({
  nombre,
  setNombre,
  emoji,
  setEmoji,
  color,
  setColor,
  descripcion,
  setDescripcion,
  placeholder,
}: {
  nombre: string;
  setNombre: (v: string) => void;
  emoji: string;
  setEmoji: (v: string) => void;
  color: ColorTablero;
  setColor: (v: ColorTablero) => void;
  descripcion: string;
  setDescripcion: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <SelectorEmoji valor={emoji} onChange={setEmoji} sugeridos={EMOJIS_TABLERO} />
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={placeholder}
          aria-label="Nombre"
          autoFocus
          maxLength={60}
        />
      </div>
      <SelectorColor valor={color} onChange={setColor} />
      <Textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Para qué es (opcional)"
        aria-label="Para qué es"
        rows={2}
        maxLength={500}
        className="min-h-0 resize-none"
      />
    </div>
  );
}

function DialogoNuevoEquipo({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [color, setColor] = useState<ColorTablero>('azul');
  const [descripcion, setDescripcion] = useState('');
  const [miembros, setMiembros] = useState<Persona[]>([]);
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await api.crearEquipo({ nombre, emoji, color, descripcion, miembros });
      haptic.success();
      toast.success(miembros.length ? 'Equipo creado: les llega un aviso por correo' : 'Equipo creado');
      onCreado();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido crear');
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogTitle>Nuevo equipo</DialogTitle>
        <CamposAspecto
          {...{ nombre, setNombre, emoji, setEmoji, color, setColor, descripcion, setDescripcion }}
          placeholder="TIC, Pastoral, 2º ciclo…"
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">¿Quién más está?</p>
          <SelectorPersonas seleccionados={miembros} onChange={setMiembros} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Tú quedas de admin. Solo verán los tableros las personas del equipo.</p>
        </div>
        <Button type="button" onClick={crear} disabled={!nombre.trim()} cargando={guardando}>
          Crear equipo
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DialogoNuevoTablero({ equipo, onClose, onCreado }: { equipo: Equipo; onClose: () => void; onCreado: (id: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [color, setColor] = useState<ColorTablero>(equipo.color);
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      const r = await api.equipo(equipo.id, { accion: 'crearTablero', nombre, emoji, color, descripcion });
      haptic.success();
      if (r.tableroId) onCreado(r.tableroId);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido crear');
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>
          Nuevo tablero en {equipo.emoji} {equipo.nombre}
        </DialogTitle>
        <CamposAspecto
          {...{ nombre, setNombre, emoji, setEmoji, color, setColor, descripcion, setDescripcion }}
          placeholder="Desarrollo interno, Mantenimiento de aulas…"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Nace con tres listas: Por hacer, En curso y Hecho. Se pueden cambiar.</p>
        <Button type="button" onClick={crear} disabled={!nombre.trim()} cargando={guardando}>
          Crear tablero
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DialogoEquipo({
  equipo,
  yo,
  onClose,
  onCambio,
  onFuera,
}: {
  equipo: Equipo;
  yo: string;
  onClose: () => void;
  onCambio: () => Promise<void>;
  onFuera: () => Promise<void>;
}) {
  const esAdmin = equipo.miRol === 'admin';
  const [nombre, setNombre] = useState(equipo.nombre);
  const [emoji, setEmoji] = useState(equipo.emoji);
  const [color, setColor] = useState<ColorTablero>(equipo.color);
  const [descripcion, setDescripcion] = useState(equipo.descripcion ?? '');
  const [nuevos, setNuevos] = useState<Persona[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const { confirmar, dialogo } = useConfirmar();

  async function hacer(fn: () => Promise<unknown>, ok?: string) {
    setOcupado(true);
    try {
      await fn();
      haptic.success();
      if (ok) toast.success(ok);
      await onCambio();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setOcupado(false);
    }
  }

  const cambiado =
    nombre.trim() !== equipo.nombre || emoji !== equipo.emoji || color !== equipo.color || descripcion.trim() !== (equipo.descripcion ?? '');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          <Users aria-hidden className="size-5" /> {equipo.emoji} {equipo.nombre}
        </DialogTitle>
        {dialogo}

        {esAdmin && (
          <div className="space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <CamposAspecto
              {...{ nombre, setNombre, emoji, setEmoji, color, setColor, descripcion, setDescripcion }}
              placeholder="Nombre del equipo"
            />
            {cambiado && (
              <Button
                type="button"
                disabled={ocupado || !nombre.trim()}
                onClick={() => hacer(() => api.equipo(equipo.id, { accion: 'editar', nombre, emoji, color, descripcion }), 'Guardado')}
              >
                Guardar cambios
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Miembros <span className="font-normal text-zinc-500 dark:text-zinc-400">({equipo.miembros.length})</span>
          </p>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {equipo.miembros.map((m) => (
              <li key={m.email} className="flex items-center gap-2.5 px-3 py-2">
                <Avatar email={m.email} nombre={m.nombre} className="ring-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {m.nombre} {m.email === yo && <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">(tú)</span>}
                  </span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{m.email}</span>
                </span>
                {esAdmin ? (
                  <>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        hacer(() => api.equipo(equipo.id, { accion: 'rolMiembro', email: m.email, rol: m.rol === 'admin' ? 'miembro' : 'admin' }))
                      }
                      aria-label={m.rol === 'admin' ? `Quitar de admin a ${m.nombre}` : `Hacer admin a ${m.nombre}`}
                      aria-pressed={m.rol === 'admin'}
                      className={cn(
                        'inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
                        m.rol === 'admin'
                          ? 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                      )}
                    >
                      <Shield aria-hidden className="size-3.5" /> {m.rol === 'admin' ? 'Admin' : 'Miembro'}
                    </button>
                    {m.email !== yo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={ocupado}
                        onClick={async () => {
                          const si = await confirmar({
                            titulo: `¿Sacar a ${m.nombre} del equipo?`,
                            descripcion: 'Dejará de ver sus tableros y se le quitará de sus tareas.',
                            boton: 'Sacar del equipo',
                          });
                          if (si) void hacer(() => api.equipo(equipo.id, { accion: 'quitarMiembro', email: m.email }));
                        }}
                        aria-label={`Sacar a ${m.nombre} del equipo`}
                        className="hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      >
                        <UserMinus aria-hidden />
                      </Button>
                    )}
                  </>
                ) : (
                  m.rol === 'admin' && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Admin
                    </span>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>

        {esAdmin && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Añadir gente</p>
            <SelectorPersonas seleccionados={nuevos} onChange={setNuevos} excluir={equipo.miembros.map((m) => m.email)} />
            {nuevos.length > 0 && (
              <Button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  hacer(async () => {
                    await api.equipo(equipo.id, { accion: 'anadirMiembros', miembros: nuevos });
                    setNuevos([]);
                  }, nuevos.length === 1 ? 'Añadida: le llega un aviso por correo' : 'Añadidas: les llega un aviso por correo')
                }
              >
                <Plus aria-hidden /> Añadir {nuevos.length === 1 ? 'a 1 persona' : `a ${nuevos.length} personas`}
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {equipo.miembros.length > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={async () => {
                const si = await confirmar({
                  titulo: `¿Salir de ${equipo.nombre}?`,
                  descripcion: 'Dejarás de ver sus tableros.',
                  boton: 'Salir del equipo',
                });
                if (!si) return;
                try {
                  await api.equipo(equipo.id, { accion: 'salir' });
                  await onFuera();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'No se ha podido');
                }
              }}
            >
              <LogOut aria-hidden /> Salir del equipo
            </Button>
          )}
          {esAdmin && (
            <Button
              type="button"
              variant="destructive"
              disabled={ocupado}
              onClick={async () => {
                // Gordo y sin vuelta atrás: hay que escribir el nombre del equipo.
                const si = await confirmar({
                  titulo: `¿Borrar ${equipo.nombre}?`,
                  descripcion: 'Se borrará el equipo con TODOS sus tableros y tarjetas, para todo el mundo. No se puede deshacer.',
                  boton: 'Borrar equipo',
                  palabra: equipo.nombre,
                });
                if (!si) return;
                try {
                  await api.borrarEquipo(equipo.id);
                  toast.success('Equipo borrado');
                  await onFuera();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'No se ha podido');
                }
              }}
            >
              <Trash2 aria-hidden /> Borrar equipo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoAvisos({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<Preferencias | null>(null);
  useEffect(() => {
    api
      .preferencias()
      .then(setP)
      .catch(() => setP({ correoAsignacion: true, correoVencimientos: true }));
  }, []);

  async function cambiar(c: Partial<Preferencias>) {
    if (!p) return;
    const nuevo = { ...p, ...c };
    setP(nuevo);
    try {
      await api.guardarPreferencias(nuevo);
      haptic.tap();
    } catch {
      setP(p);
      toast.error('No se ha podido guardar');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Bell aria-hidden className="size-5" /> Avisos por correo
        </DialogTitle>
        {!p ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <div className="space-y-2">
            <Interruptor
              activo={p.correoAsignacion}
              onChange={(v) => cambiar({ correoAsignacion: v })}
              etiqueta="Cuando me asignan una tarea"
              descripcion="También cuando me añaden a un equipo."
            />
            <Interruptor
              activo={p.correoVencimientos}
              onChange={(v) => cambiar({ correoVencimientos: v })}
              etiqueta="Cuando algo mío vence"
              descripcion="Un correo por la mañana (de lunes a viernes) con lo que vence ya y lo que se ha pasado de fecha."
            />
            <p className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Con los correos apagados, lo urgente te sigue saliendo en el aviso de abajo a la izquierda de la pantalla.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
