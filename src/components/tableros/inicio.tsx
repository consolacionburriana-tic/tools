'use client';

// /gestion/tableros: lo que tengo asignado arriba, y debajo mis equipos con sus tableros en
// baldosas de colores (estilo Trello). Desde aquí se crean equipos y tableros y se lleva quién
// está en cada equipo.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Bell,
  ChevronRight,
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
  Avatar,
  Avatares,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  ChipPrioridad,
  ChipVence,
  EMOJIS_TABLERO,
  ESTILO_CAMPO,
  FONDO_FUERTE,
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
  const [datos, setDatos] = useState(inicial);
  const [nuevoEquipo, setNuevoEquipo] = useState(false);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Tableros</h1>
          <p className="text-sm text-zinc-500">Tareas por equipos: solo entra quien está en cada equipo.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAvisos(true)} className={BOTON_SECUNDARIO}>
            <Bell className="h-4 w-4" /> <span className="hidden sm:inline">Avisos por correo</span>
          </button>
          <button type="button" onClick={() => setNuevoEquipo(true)} className={BOTON_PRIMARIO}>
            <Plus className="h-4 w-4" /> Nuevo equipo
          </button>
        </div>
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
          onClose={() => setNuevoEquipo(false)}
          onCreado={async () => {
            setNuevoEquipo(false);
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
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
        <Sparkles className="h-5 w-5 text-emerald-500" />
        No tienes nada asignado ahora mismo. Cuando alguien te asigne una tarea, saldrá aquí.
      </div>
    );
  }
  const grupos = agruparMias(mias, hoy);
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <ListChecks className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Lo tuyo</h2>
        <span className="rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {mias.length}
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {grupos.map((g) => (
          <div key={g.grupo}>
            <p
              className={cn(
                'px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide uppercase',
                g.grupo === 'vencidas' ? 'text-red-600 dark:text-red-400' : g.grupo === 'hoy' ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400',
              )}
            >
              {GRUPO_MIO_LABELS[g.grupo]}
            </p>
            <ul className="pb-2">
              {g.tarjetas.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/gestion/tableros/${t.tableroId}?t=${t.id}`}
                    className="flex items-start gap-3 px-4 py-2 transition-colors hover:bg-zinc-50 sm:items-center dark:hover:bg-zinc-800/60"
                  >
                    <span className="text-lg">{t.tableroEmoji}</span>
                    {/* En el móvil los chips van debajo del título: si no, no se lee de qué es la tarea */}
                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.titulo}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {t.equipoNombre} · {t.tableroNombre} · {t.columnaNombre}
                          {t.checklistTotal > 0 && ` · ☑ ${t.checklistHechos}/${t.checklistTotal}`}
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
    </section>
  );
}

function SinEquipos({ onCrear }: { onCrear: () => void }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl shadow-lg">
        📋
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Todavía no estás en ningún equipo</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
        Crea uno (aunque sea solo para ti), mete a quien haga falta y organiza las tareas en tableros con columnas: por
        hacer, en curso y hecho. Si alguien te añade a su equipo, lo verás aquí.
      </p>
      <button type="button" onClick={onCrear} className={cn(BOTON_PRIMARIO, 'mt-5')}>
        <Plus className="h-4 w-4" /> Crear mi primer equipo
      </button>
    </div>
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
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm', FONDO_FUERTE[equipo.color])}>
          {equipo.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{equipo.nombre}</h2>
          {equipo.descripcion && <p className="truncate text-xs text-zinc-500">{equipo.descripcion}</p>}
        </div>
        <button
          type="button"
          onClick={onAjustes}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          title="Miembros y ajustes del equipo"
        >
          <Avatares emails={equipo.miembros.map((m) => m.email)} personas={equipo.miembros} max={4} />
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activos.map((t) => (
          <BaldosaTablero key={t.id} tablero={t} />
        ))}
        <button
          type="button"
          onClick={onNuevoTablero}
          className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-zinc-300 text-sm font-medium text-zinc-500 transition-colors hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-blue-500/5 dark:hover:text-blue-400"
        >
          <Plus className="h-5 w-5" /> Nuevo tablero
        </button>
      </div>

      {archivados.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerArchivados((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <Archive className="h-3.5 w-3.5" /> {archivados.length} archivado{archivados.length === 1 ? '' : 's'}
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', verArchivados && 'rotate-90')} />
          </button>
          {verArchivados && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {archivados.map((t) => (
                <li key={t.id} className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white py-1 pr-1 pl-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <Link href={`/gestion/tableros/${t.id}`} className="text-zinc-600 hover:underline dark:text-zinc-300">
                    {t.emoji} {t.nombre}
                  </Link>
                  {equipo.miRol === 'admin' && (
                    <button
                      type="button"
                      onClick={() => recuperar(t)}
                      title="Sacar del archivo"
                      className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </button>
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
      className={cn(
        'group relative flex min-h-28 flex-col justify-between overflow-hidden rounded-2xl p-4 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
        FONDO_FUERTE[t.color],
      )}
    >
      {/* Un brillo suave arriba a la derecha: le da volumen sin distraer */}
      <span className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <span className="relative flex items-start gap-2">
        <span className="text-2xl drop-shadow-sm">{t.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold drop-shadow-sm">{t.nombre}</span>
          {t.descripcion && <span className="line-clamp-2 text-xs text-white/80">{t.descripcion}</span>}
        </span>
        <NavPending className="[&_svg]:text-white" />
      </span>
      <span className="relative mt-3 flex items-center gap-1.5 text-xs font-medium">
        <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur-sm">
          {t.abiertas === 0 ? 'Todo hecho ✨' : `${t.abiertas} por hacer`}
        </span>
        {t.vencidas > 0 && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 shadow-sm">
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
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={placeholder}
          autoFocus
          maxLength={60}
          className={ESTILO_CAMPO}
        />
      </div>
      <SelectorColor valor={color} onChange={setColor} />
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Para qué es (opcional)"
        rows={2}
        maxLength={500}
        className={cn(ESTILO_CAMPO, 'resize-none')}
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
          <p className="text-xs text-zinc-500">Tú quedas de admin. Solo verán los tableros las personas del equipo.</p>
        </div>
        <button type="button" onClick={crear} disabled={guardando || !nombre.trim()} className={BOTON_PRIMARIO}>
          Crear equipo
        </button>
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
        <p className="text-xs text-zinc-500">Nace con tres listas: Por hacer, En curso y Hecho. Se pueden cambiar.</p>
        <button type="button" onClick={crear} disabled={guardando || !nombre.trim()} className={BOTON_PRIMARIO}>
          Crear tablero
        </button>
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
          <Users className="h-5 w-5" /> {equipo.emoji} {equipo.nombre}
        </DialogTitle>

        {esAdmin && (
          <div className="space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <CamposAspecto
              {...{ nombre, setNombre, emoji, setEmoji, color, setColor, descripcion, setDescripcion }}
              placeholder="Nombre del equipo"
            />
            {cambiado && (
              <button
                type="button"
                disabled={ocupado || !nombre.trim()}
                onClick={() => hacer(() => api.equipo(equipo.id, { accion: 'editar', nombre, emoji, color, descripcion }), 'Guardado')}
                className={BOTON_PRIMARIO}
              >
                Guardar cambios
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Miembros <span className="font-normal text-zinc-500">({equipo.miembros.length})</span>
          </p>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {equipo.miembros.map((m) => (
              <li key={m.email} className="flex items-center gap-2.5 px-3 py-2">
                <Avatar email={m.email} nombre={m.nombre} className="ring-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {m.nombre} {m.email === yo && <span className="text-xs font-normal text-zinc-400">(tú)</span>}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">{m.email}</span>
                </span>
                {esAdmin ? (
                  <>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        hacer(() => api.equipo(equipo.id, { accion: 'rolMiembro', email: m.email, rol: m.rol === 'admin' ? 'miembro' : 'admin' }))
                      }
                      title={m.rol === 'admin' ? 'Quitar de admin' : 'Hacer admin'}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
                        m.rol === 'admin'
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800',
                      )}
                    >
                      <Shield className="h-3 w-3" /> {m.rol === 'admin' ? 'Admin' : 'Miembro'}
                    </button>
                    {m.email !== yo && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => {
                          if (window.confirm(`¿Sacar a ${m.nombre} del equipo? Dejará de ver sus tableros y se le quitará de sus tareas.`)) {
                            void hacer(() => api.equipo(equipo.id, { accion: 'quitarMiembro', email: m.email }));
                          }
                        }}
                        title="Sacar del equipo"
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </>
                ) : (
                  m.rol === 'admin' && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
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
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  hacer(async () => {
                    await api.equipo(equipo.id, { accion: 'anadirMiembros', miembros: nuevos });
                    setNuevos([]);
                  }, nuevos.length === 1 ? 'Añadida: le llega un aviso por correo' : 'Añadidas: les llega un aviso por correo')
                }
                className={BOTON_PRIMARIO}
              >
                <Plus className="h-4 w-4" /> Añadir {nuevos.length === 1 ? 'a 1 persona' : `a ${nuevos.length} personas`}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {equipo.miembros.length > 1 && (
            <button
              type="button"
              disabled={ocupado}
              onClick={async () => {
                if (!window.confirm(`¿Salir de ${equipo.nombre}? Dejarás de ver sus tableros.`)) return;
                try {
                  await api.equipo(equipo.id, { accion: 'salir' });
                  await onFuera();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'No se ha podido');
                }
              }}
              className={BOTON_SECUNDARIO}
            >
              <LogOut className="h-4 w-4" /> Salir del equipo
            </button>
          )}
          {esAdmin && (
            <button
              type="button"
              disabled={ocupado}
              onClick={async () => {
                const escrito = window.prompt(
                  `Se borrará el equipo con TODOS sus tableros y tarjetas, para todo el mundo. No se puede deshacer.\n\nEscribe «${equipo.nombre}» para confirmarlo:`,
                );
                if (escrito?.trim() !== equipo.nombre) return;
                try {
                  await api.borrarEquipo(equipo.id);
                  toast.success('Equipo borrado');
                  await onFuera();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'No se ha podido');
                }
              }}
              className={cn(BOTON_SECUNDARIO, 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10')}
            >
              <Trash2 className="h-4 w-4" /> Borrar equipo
            </button>
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
          <Bell className="h-5 w-5" /> Avisos por correo
        </DialogTitle>
        {!p ? (
          <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : (
          <div className="space-y-2">
            <Interruptor
              activo={p.correoAsignacion}
              onChange={(v) => cambiar({ correoAsignacion: v })}
              titulo="Cuando me asignan una tarea"
              detalle="También cuando me añaden a un equipo."
            />
            <Interruptor
              activo={p.correoVencimientos}
              onChange={(v) => cambiar({ correoVencimientos: v })}
              titulo="Cuando algo mío vence"
              detalle="Un correo por la mañana (de lunes a viernes) con lo que vence ya y lo que se ha pasado de fecha."
            />
            <p className="pt-1 text-xs text-zinc-500">
              Con los correos apagados, lo urgente te sigue saliendo en el aviso de abajo a la izquierda de la pantalla.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Interruptor({
  activo,
  onChange,
  titulo,
  detalle,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!activo)}
      className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
    >
      <span
        className={cn(
          'mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
          activo ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700',
        )}
      >
        <span className={cn('h-5 w-5 rounded-full bg-white shadow transition-transform', activo && 'translate-x-4')} />
      </span>
      <span>
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{titulo}</span>
        <span className="block text-xs text-zinc-500">{detalle}</span>
      </span>
    </button>
  );
}
