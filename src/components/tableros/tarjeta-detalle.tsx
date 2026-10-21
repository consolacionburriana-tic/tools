'use client';

// La ficha de una tarjeta: título, a quién le toca, para cuándo, prioridad, etiquetas,
// descripción, checklist, enlaces y el seguimiento (comentarios + lo que ha ido pasando).
// Todo se guarda solo al tocarlo, sin botón de guardar, como en Trello.
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlignLeft,
  AppWindow,
  Archive,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  FolderOpen,
  Globe,
  GraduationCap,
  Link2,
  ListChecks,
  MessageSquare,
  Plus,
  Presentation,
  Sheet,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { copiarTexto } from '@/components/ui/copiable';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { Selector } from '@/components/ui/selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  diaLargo,
  normalizarUrl,
  PASO_ORDEN,
  PRIORIDAD_LABELS,
  PRIORIDADES,
  proximoViernes,
  sumarDias,
  tipoEnlace,
  tituloEnlace,
  type EntradaAccionTarjeta as AccionTarjeta,
  type DatosTablero,
  type Enlace,
  type Seguimiento,
  type Tarjeta,
  type TipoEnlace,
} from '@/lib/tableros';
import { Checklist } from './checklist';
import { api, ChipVence, ETIQUETA_CLASES, nuevoId } from './comun';

type Edicion = Omit<Extract<AccionTarjeta, { accion: 'editar' }>, 'accion'>;

const ICONO_ENLACE: Record<TipoEnlace, typeof Globe> = {
  tools: AppWindow,
  drive: FolderOpen,
  doc: FileText,
  hoja: Sheet,
  presentacion: Presentation,
  formulario: ClipboardList,
  classroom: GraduationCap,
  calendar: CalendarDays,
  web: Globe,
};

export function DetalleTarjeta({
  tarjeta: t,
  datos,
  onCambio,
  onFuera,
  onClose,
}: {
  tarjeta: Tarjeta;
  datos: DatosTablero;
  onCambio: (t: Tarjeta) => void;
  /** Archivada o borrada: sale del tablero. */
  onFuera: (id: string) => void;
  onClose: () => void;
}) {
  const { columnas, miembros, hoy, yo, tablero } = datos;
  const columna = columnas.find((c) => c.id === t.columnaId);
  const hecha = Boolean(columna?.hecho);
  const [seguimiento, setSeguimiento] = useState<Seguimiento[] | null>(null);

  const cargarSeguimiento = () =>
    api
      .seguimiento(t.id)
      .then(setSeguimiento)
      .catch(() => setSeguimiento([]));
  useEffect(() => {
    void cargarSeguimiento();
    // Solo al abrir la ficha (la key del componente es el id de la tarjeta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dos guardados seguidos (marcar dos pasos del checklist de un tirón) no se pueden pisar:
  // cada cambio se monta sobre el último estado conocido, no sobre el del último render, y
  // solo la respuesta del ÚLTIMO guardado vuelve a la pantalla (las anteriores ya están viejas).
  const actual = useRef(t);
  useEffect(() => {
    actual.current = t;
  }, [t]);
  const ultimo = useRef(0);

  function aplicar(nueva: Tarjeta) {
    actual.current = nueva;
    onCambio(nueva);
  }

  async function enviar(a: Parameters<typeof api.tarjeta>[1], optimista: Tarjeta, recargarSeguimiento: boolean) {
    const antes = actual.current;
    const yo = ++ultimo.current;
    aplicar(optimista);
    try {
      const r = await api.tarjeta(t.id, a);
      if (r.tarjeta && yo === ultimo.current) aplicar({ ...r.tarjeta, comentarios: actual.current.comentarios });
      if (recargarSeguimiento) void cargarSeguimiento();
    } catch (err) {
      if (yo === ultimo.current) aplicar(antes);
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    }
  }

  function guardar(cambios: Edicion, recargarSeguimiento = false) {
    const base = actual.current;
    const optimista = { ...base } as Tarjeta;
    for (const [k, v] of Object.entries(cambios)) if (v !== undefined) (optimista as unknown as Record<string, unknown>)[k] = v;
    return enviar({ accion: 'editar', ...cambios }, optimista, recargarSeguimiento);
  }

  function mover(columnaId: string) {
    const base = actual.current;
    if (columnaId === base.columnaId) return;
    const destino = columnas.find((c) => c.id === columnaId);
    const ultimas = datos.tarjetas.filter((x) => x.columnaId === columnaId).map((x) => x.orden);
    const orden = (ultimas.length ? Math.max(...ultimas) : 0) + PASO_ORDEN;
    if (destino?.hecho) haptic.success();
    return enviar(
      { accion: 'mover', columnaId, orden },
      { ...base, columnaId, orden, completadaAt: destino?.hecho ? (base.completadaAt ?? new Date().toISOString()) : null },
      true,
    );
  }

  async function archivar() {
    try {
      await api.tarjeta(t.id, { accion: 'archivar', archivada: true });
      onFuera(t.id);
      toast.success('Tarjeta archivada', {
        action: {
          label: 'Deshacer',
          onClick: () =>
            void api
              .tarjeta(t.id, { accion: 'archivar', archivada: false })
              .then((r) => r.tarjeta && onCambio({ ...r.tarjeta, comentarios: t.comentarios }))
              .catch(() => toast.error('No se ha podido deshacer')),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  async function borrar() {
    try {
      await api.borrarTarjeta(t.id);
      onFuera(t.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  async function copiarEnlace() {
    const ok = await copiarTexto(window.location.href);
    if (ok) {
      haptic.success();
      toast.success('Enlace copiado: solo lo abre quien esté en el equipo');
    } else toast.error('No se ha podido copiar');
  }

  const primeraHecha = columnas.find((c) => c.hecho);
  const primeraAbierta = columnas.find((c) => !c.hecho);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-5 overflow-y-auto p-5 sm:max-w-3xl">
        {/* Dónde está */}
        <div className="flex flex-wrap items-center gap-2 pr-10 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="min-w-0 truncate">
            {tablero.emoji} {tablero.nombre}
          </span>
          <Selector value={t.columnaId} onChange={(e) => mover(e.target.value)} aria-label="Lista" className="w-auto">
            {columnas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
          {primeraHecha && !hecha && (
            <Button type="button" size="sm" onClick={() => mover(primeraHecha.id)}>
              <Check aria-hidden /> Marcar terminada
            </Button>
          )}
          {hecha && primeraAbierta && (
            <Button type="button" variant="outline" size="sm" onClick={() => mover(primeraAbierta.id)}>
              Reabrir
            </Button>
          )}
        </div>

        <Titulo valor={t.titulo} hecha={hecha} onGuardar={(titulo) => guardar({ titulo })} />

        <div className="grid gap-6 md:grid-cols-[1fr_17rem]">
          {/* Propiedades: en el móvil, lo primero */}
          <aside className="space-y-5 md:order-2">
            <Bloque icono={Users} titulo="Responsables">
              <Filtros etiqueta="Responsables">
                {miembros.map((m) => {
                  const esta = t.responsables.includes(m.email);
                  return (
                    <Filtro
                      key={m.email}
                      activo={esta}
                      onClick={() =>
                        void guardar(
                          { responsables: esta ? t.responsables.filter((e) => e !== m.email) : [...t.responsables, m.email] },
                          true,
                        )
                      }
                      icono={<Avatar email={m.email} nombre={m.nombre} tamano="sm" className="-ml-2.5 ring-0" />}
                    >
                      {m.email === yo ? 'Yo' : m.nombre.split(' ')[0]}
                    </Filtro>
                  );
                })}
              </Filtros>
              {t.responsables.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Les llega un correo cuando se les asigna, y otro si se acerca la fecha.</p>
              )}
            </Bloque>

            <Bloque icono={CalendarClock} titulo="Fecha límite">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={t.vence ?? ''}
                  onChange={(e) => guardar({ vence: e.target.value || null }, true)}
                  aria-label="Fecha límite"
                />
                {t.vence && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => guardar({ vence: null }, true)} aria-label="Quitar la fecha">
                    <X />
                  </Button>
                )}
              </div>
              <Filtros etiqueta="Fechas rápidas" className="mt-2">
                {(
                  [
                    ['Hoy', hoy],
                    ['Mañana', sumarDias(hoy, 1)],
                    ['Viernes', proximoViernes(hoy)],
                    ['+1 semana', sumarDias(hoy, 7)],
                  ] as const
                ).map(([texto, fecha]) => (
                  <Filtro key={texto} activo={t.vence === fecha} onClick={() => guardar({ vence: fecha }, true)} className="px-3">
                    {texto}
                  </Filtro>
                ))}
              </Filtros>
              {t.vence && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <ChipVence vence={t.vence} hoy={hoy} hecha={hecha} /> {diaLargo(t.vence)}
                </p>
              )}
            </Bloque>

            <Bloque icono={Flag} titulo="Prioridad">
              <Filtros etiqueta="Prioridad">
                {PRIORIDADES.map((p) => (
                  <Filtro key={p} activo={t.prioridad === p} onClick={() => guardar({ prioridad: t.prioridad === p ? null : p }, true)} className="px-3">
                    {PRIORIDAD_LABELS[p]}
                  </Filtro>
                ))}
              </Filtros>
            </Bloque>

            {tablero.etiquetas.length > 0 && (
              <Bloque icono={Tag} titulo="Etiquetas">
                <div role="group" aria-label="Etiquetas" className="flex flex-wrap gap-1.5">
                  {tablero.etiquetas.map((e) => {
                    const esta = t.etiquetas.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={esta}
                        onClick={() => guardar({ etiquetas: esta ? t.etiquetas.filter((x) => x !== e.id) : [...t.etiquetas, e.id] })}
                        className={cn(
                          'inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          ETIQUETA_CLASES[e.color].fondo,
                          esta ? 'ring-2 ring-zinc-900/40 dark:ring-white/50' : 'opacity-60 hover:opacity-90',
                        )}
                      >
                        {esta && <Check aria-hidden className="size-4" />}
                        {e.nombre || e.color}
                      </button>
                    );
                  })}
                </div>
              </Bloque>
            )}

            <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <Button type="button" variant="outline" size="sm" onClick={copiarEnlace}>
                <Copy aria-hidden /> Copiar enlace
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={archivar}>
                <Archive aria-hidden /> Archivar
              </Button>
              <ConfirmarEnLinea
                etiqueta="Borrar"
                icono={<Trash2 aria-hidden />}
                pregunta="No se puede deshacer. Si solo está terminada, mejor archívala."
                confirmar="Sí, borrar"
                onConfirmar={borrar}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Creada por {t.createdByNombre ?? t.createdBy ?? 'alguien'} · {formatDistanceToNow(new Date(t.createdAt), { locale: es, addSuffix: true })}
            </p>
          </aside>

          <div className="min-w-0 space-y-6 md:order-1">
            <Descripcion valor={t.descripcion ?? ''} onGuardar={(descripcion) => guardar({ descripcion })} />
            <Bloque icono={ListChecks} titulo="Checklist">
              <Checklist items={t.checklist} onCambio={(checklist) => guardar({ checklist })} />
            </Bloque>
            <Enlaces enlaces={t.enlaces} onCambio={(enlaces) => guardar({ enlaces })} />
            <SeguimientoVista
              tarjetaId={t.id}
              yo={yo}
              yoNombre={miembros.find((m) => m.email === yo)?.nombre ?? null}
              items={seguimiento}
              onCambio={(s, delta) => {
                setSeguimiento(s);
                onCambio({ ...t, comentarios: Math.max(0, t.comentarios + delta) });
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Bloque({ icono: Icono, titulo, children }: { icono: typeof Globe; titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <Rotulo as="h3" className="mb-2 flex items-center gap-1.5">
        <Icono aria-hidden className="size-4" /> {titulo}
      </Rotulo>
      {children}
    </div>
  );
}

function Titulo({ valor, hecha, onGuardar }: { valor: string; hecha: boolean; onGuardar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [texto]);
  return (
    <div className="flex items-start gap-2">
      {hecha && <CheckCircle2 aria-label="Terminada" className="mt-1.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" />}
      <DialogTitle className="sr-only">{valor}</DialogTitle>
      <textarea
        ref={ref}
        value={texto}
        onChange={(e) => setTexto(e.target.value.replace(/\n/g, ' '))}
        onBlur={() => {
          const v = texto.trim();
          if (v && v !== valor) onGuardar(v);
          else setTexto(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        rows={1}
        maxLength={200}
        aria-label="Título"
        className="w-full resize-none overflow-hidden rounded-xl bg-transparent px-2 py-1 text-xl font-semibold text-zinc-900 outline-none hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-50 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60"
      />
    </div>
  );
}

function Descripcion({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  return (
    <Bloque icono={AlignLeft} titulo="Descripción">
      {editando ? (
        <div className="space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            rows={5}
            maxLength={10000}
            placeholder="Detalles, pasos, a quién preguntar…"
            aria-label="Descripción"
            className="min-h-32 resize-y"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditando(false);
                if (texto.trim() !== valor.trim()) onGuardar(texto.trim());
              }}
            >
              Guardar descripción
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTexto(valor);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className={cn(
            'block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm whitespace-pre-wrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            valor
              ? 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60'
              : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-800',
          )}
        >
          <TextoConEnlaces texto={valor || 'Añade una descripción…'} />
        </button>
      )}
    </Bloque>
  );
}

/** Pinta las URL de un texto como enlaces (abren en otra pestaña). */
function TextoConEnlaces({ texto }: { texto: string }) {
  const trozos = texto.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {trozos.map((tr, i) =>
        /^https?:\/\//.test(tr) ? (
          <a
            key={i}
            href={tr}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="break-all text-blue-600 underline decoration-blue-300 underline-offset-2 dark:text-blue-400"
          >
            {tr}
          </a>
        ) : (
          <span key={i}>{tr}</span>
        ),
      )}
    </>
  );
}

function Enlaces({ enlaces, onCambio }: { enlaces: Enlace[]; onCambio: (e: Enlace[]) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const hostApp = useMemo(() => (typeof window === 'undefined' ? null : window.location.hostname), []);

  function anadir() {
    const limpia = normalizarUrl(url);
    if (!limpia) {
      toast.error('Eso no parece un enlace');
      return;
    }
    // Un enlace a la propia plataforma se guarda como ruta: así sigue valiendo si cambia el dominio.
    let final = limpia;
    if (hostApp && !limpia.startsWith('/')) {
      try {
        const u = new URL(limpia);
        if (u.hostname === hostApp) final = `${u.pathname}${u.search}${u.hash}`;
      } catch {
        /* se queda como está */
      }
    }
    onCambio([...enlaces, { id: nuevoId(), url: final, titulo: titulo.trim() || null }]);
    setUrl('');
    setTitulo('');
    setAbierto(false);
  }

  return (
    <Bloque icono={Link2} titulo="Enlaces">
      {enlaces.length > 0 && (
        <ul className="mb-2 space-y-1">
          {enlaces.map((e) => {
            const tipo = tipoEnlace(e.url, hostApp);
            const Icono = ICONO_ENLACE[tipo];
            const interno = e.url.startsWith('/');
            return (
              <li key={e.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 py-0.5 pr-0.5 pl-3 dark:border-zinc-800">
                <Icono aria-hidden className={cn('size-4 shrink-0', tipo === 'web' ? 'text-zinc-400' : 'text-blue-600 dark:text-blue-400')} />
                <a
                  href={e.url}
                  target={interno ? undefined : '_blank'}
                  rel={interno ? undefined : 'noopener noreferrer'}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 hover:text-blue-600 hover:underline dark:text-zinc-200 dark:hover:text-blue-400"
                >
                  {tituloEnlace(e)}
                </a>
                {!interno && <ExternalLink aria-label="Se abre en otra pestaña" className="size-3.5 shrink-0 text-zinc-400" />}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onCambio(enlaces.filter((x) => x.id !== e.id))}
                  aria-label={`Quitar el enlace «${tituloEnlace(e)}»`}
                  className="text-zinc-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400"
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {abierto ? (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/50">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadir()}
            autoFocus
            placeholder="Pega el enlace (Drive, un Doc, una pantalla de la plataforma…)"
            aria-label="Enlace"
          />
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadir()}
            placeholder="Cómo se llama (opcional)"
            aria-label="Cómo se llama"
            maxLength={120}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={anadir} disabled={!url.trim()}>
              Añadir enlace
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
          <Plus aria-hidden /> Añadir enlace
        </Button>
      )}
    </Bloque>
  );
}

function SeguimientoVista({
  tarjetaId,
  yo,
  yoNombre,
  items,
  onCambio,
}: {
  tarjetaId: string;
  yo: string;
  yoNombre: string | null;
  items: Seguimiento[] | null;
  /** La lista nueva y cuántos comentarios se han sumado o quitado. */
  onCambio: (s: Seguimiento[], delta: number) => void;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function comentar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const r = await api.tarjeta(tarjetaId, { accion: 'comentar', texto: t });
      if (r.seguimiento) onCambio(r.seguimiento, 1);
      setTexto('');
      haptic.tap();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido enviar');
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(id: string) {
    try {
      const r = await api.tarjeta(tarjetaId, { accion: 'borrarComentario', comentarioId: id });
      if (r.seguimiento) onCambio(r.seguimiento, -1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  return (
    <Bloque icono={MessageSquare} titulo="Seguimiento">
      <div className="flex gap-2">
        <Avatar email={yo} nombre={yoNombre} className="mt-1.5 ring-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void comentar();
            }}
            rows={2}
            maxLength={4000}
            placeholder="Cómo va, qué falta, a quién se ha llamado…"
            aria-label="Comentario"
            className="min-h-20 resize-y"
          />
          {texto.trim() && (
            <Button type="button" size="sm" onClick={comentar} cargando={enviando}>
              Comentar
            </Button>
          )}
        </div>
      </div>

      {items === null ? (
        <Skeleton className="mt-3 h-12 rounded-xl" />
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((s) =>
            s.tipo === 'comentario' ? (
              <li key={s.id} className="flex gap-2">
                <Avatar email={s.autorEmail ?? '?'} nombre={s.autorNombre} className="ring-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      <b className="font-semibold text-zinc-800 dark:text-zinc-200">{s.autorNombre ?? s.autorEmail}</b> ·{' '}
                      {formatDistanceToNow(new Date(s.createdAt), { locale: es, addSuffix: true })}
                    </span>
                    {s.autorEmail === yo && (
                      <ConfirmarEnLinea
                        etiqueta="Borrar"
                        variante="ghost"
                        confirmar="Sí, borrar"
                        onConfirmar={() => borrar(s.id)}
                        className="text-zinc-600 dark:text-zinc-400"
                      />
                    )}
                  </div>
                  <div className="mt-0.5 rounded-xl rounded-tl-sm bg-zinc-100 px-3 py-2 text-sm whitespace-pre-wrap break-words text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                    <TextoConEnlaces texto={s.texto} />
                  </div>
                </div>
              </li>
            ) : (
              <li key={s.id} className="flex items-center gap-2 pl-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                <span>
                  <b className="font-medium text-zinc-700 dark:text-zinc-300">{s.autorNombre ?? s.autorEmail}</b> {s.texto} ·{' '}
                  {formatDistanceToNow(new Date(s.createdAt), { locale: es, addSuffix: true })}
                </span>
              </li>
            ),
          )}
          {items.length === 0 && <li className="text-xs text-zinc-500 dark:text-zinc-400">Todavía no hay seguimiento.</li>}
        </ul>
      )}
    </Bloque>
  );
}
