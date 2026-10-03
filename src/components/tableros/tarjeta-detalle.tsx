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
import { copiarTexto } from '@/components/alumnado/copiable';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  checklistDeTexto,
  diaLargo,
  normalizarUrl,
  PASO_ORDEN,
  PRIORIDAD_LABELS,
  PRIORIDADES,
  progresoChecklist,
  proximoViernes,
  sumarDias,
  tipoEnlace,
  tituloEnlace,
  type EntradaAccionTarjeta as AccionTarjeta,
  type DatosTablero,
  type Enlace,
  type ItemChecklist,
  type Seguimiento,
  type Tarjeta,
  type TipoEnlace,
} from '@/lib/tableros';
import { api, Avatar, BOTON_PRIMARIO, BOTON_SECUNDARIO, ChipVence, ESTILO_CAMPO, ETIQUETA_CLASES, nuevoId, PRIORIDAD_CLASES } from './comun';

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
      toast.success('Archivada. Está en el botón de archivadas del tablero.');
      onFuera(t.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar «${t.titulo}»? No se puede deshacer (si solo está terminada, mejor archívala).`)) return;
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
        <div className="flex flex-wrap items-center gap-2 pr-8 text-xs text-zinc-500">
          <span>{tablero.emoji} {tablero.nombre}</span>
          <span>·</span>
          <select
            value={t.columnaId}
            onChange={(e) => mover(e.target.value)}
            aria-label="Lista"
            className="rounded-md border-0 bg-zinc-100 px-2 py-1 font-medium text-zinc-700 outline-none dark:bg-zinc-800 dark:text-zinc-200"
          >
            {columnas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {primeraHecha && !hecha && (
            <button
              type="button"
              onClick={() => mover(primeraHecha.id)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-700"
            >
              <Check className="h-3.5 w-3.5" /> Terminada
            </button>
          )}
          {hecha && primeraAbierta && (
            <button
              type="button"
              onClick={() => mover(primeraAbierta.id)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Reabrir
            </button>
          )}
        </div>

        <Titulo valor={t.titulo} hecha={hecha} onGuardar={(titulo) => guardar({ titulo })} />

        <div className="grid gap-6 md:grid-cols-[1fr_15rem]">
          {/* Propiedades: en el móvil, lo primero */}
          <aside className="space-y-4 md:order-2">
            <Bloque icono={Users} titulo="Responsables">
              <div className="flex flex-wrap gap-1.5">
                {miembros.map((m) => {
                  const esta = t.responsables.includes(m.email);
                  return (
                    <button
                      key={m.email}
                      type="button"
                      onClick={() => {
                        haptic.tap();
                        void guardar(
                          { responsables: esta ? t.responsables.filter((e) => e !== m.email) : [...t.responsables, m.email] },
                          true,
                        );
                      }}
                      title={esta ? `Quitar a ${m.nombre}` : `Asignar a ${m.nombre}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition-colors',
                        esta
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
                      )}
                    >
                      <Avatar email={m.email} nombre={m.nombre} className="h-6 w-6 text-[10px] ring-0" />
                      {m.email === yo ? 'Yo' : m.nombre.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
              {t.responsables.length > 0 && (
                <p className="mt-1.5 text-[11px] text-zinc-500">Les llega un correo cuando se les asigna, y otro si se acerca la fecha.</p>
              )}
            </Bloque>

            <Bloque icono={CalendarClock} titulo="Fecha límite">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={t.vence ?? ''}
                  onChange={(e) => guardar({ vence: e.target.value || null }, true)}
                  className={cn(ESTILO_CAMPO, 'py-1.5')}
                />
                {t.vence && (
                  <button
                    type="button"
                    onClick={() => guardar({ vence: null }, true)}
                    aria-label="Quitar fecha"
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(
                  [
                    ['Hoy', hoy],
                    ['Mañana', sumarDias(hoy, 1)],
                    ['Viernes', proximoViernes(hoy)],
                    ['+1 semana', sumarDias(hoy, 7)],
                  ] as const
                ).map(([texto, fecha]) => (
                  <button
                    key={texto}
                    type="button"
                    onClick={() => guardar({ vence: fecha }, true)}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                      t.vence === fecha
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                    )}
                  >
                    {texto}
                  </button>
                ))}
              </div>
              {t.vence && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <ChipVence vence={t.vence} hoy={hoy} hecha={hecha} /> {diaLargo(t.vence)}
                </p>
              )}
            </Bloque>

            <Bloque icono={Flag} titulo="Prioridad">
              <div className="grid grid-cols-2 gap-1">
                {PRIORIDADES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => guardar({ prioridad: t.prioridad === p ? null : p }, true)}
                    className={cn(
                      'rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
                      t.prioridad === p ? cn(PRIORIDAD_CLASES[p], 'ring-2 ring-zinc-900/20 dark:ring-white/30') : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800/60 dark:hover:bg-zinc-800',
                    )}
                  >
                    {PRIORIDAD_LABELS[p]}
                  </button>
                ))}
              </div>
            </Bloque>

            {tablero.etiquetas.length > 0 && (
              <Bloque icono={Tag} titulo="Etiquetas">
                <div className="flex flex-wrap gap-1">
                  {tablero.etiquetas.map((e) => {
                    const esta = t.etiquetas.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => guardar({ etiquetas: esta ? t.etiquetas.filter((x) => x !== e.id) : [...t.etiquetas, e.id] })}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-semibold transition-opacity',
                          ETIQUETA_CLASES[e.color].fondo,
                          esta ? 'opacity-100 ring-2 ring-zinc-900/30 dark:ring-white/40' : 'opacity-45 hover:opacity-80',
                        )}
                      >
                        {esta && <Check className="mr-0.5 inline h-3 w-3" />}
                        {e.nombre || e.color}
                      </button>
                    );
                  })}
                </div>
              </Bloque>
            )}

            <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <button type="button" onClick={copiarEnlace} className={cn(BOTON_SECUNDARIO, 'px-2.5 py-1.5 text-xs')}>
                <Copy className="h-3.5 w-3.5" /> Copiar enlace
              </button>
              <button type="button" onClick={archivar} className={cn(BOTON_SECUNDARIO, 'px-2.5 py-1.5 text-xs')}>
                <Archive className="h-3.5 w-3.5" /> Archivar
              </button>
              <button
                type="button"
                onClick={borrar}
                className={cn(BOTON_SECUNDARIO, 'px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10')}
              >
                <Trash2 className="h-3.5 w-3.5" /> Borrar
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Creada por {t.createdByNombre ?? t.createdBy ?? 'alguien'} · {formatDistanceToNow(new Date(t.createdAt), { locale: es, addSuffix: true })}
            </p>
          </aside>

          <div className="min-w-0 space-y-6 md:order-1">
            <Descripcion valor={t.descripcion ?? ''} onGuardar={(descripcion) => guardar({ descripcion })} />
            <Checklist items={t.checklist} onCambio={(checklist) => guardar({ checklist })} />
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
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-zinc-400 uppercase">
        <Icono className="h-3.5 w-3.5" /> {titulo}
      </p>
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
      {hecha && <CheckCircle2 className="mt-1.5 h-6 w-6 shrink-0 text-emerald-500" />}
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
        className="w-full resize-none overflow-hidden rounded-lg bg-transparent px-1 py-0.5 text-xl font-bold text-zinc-900 outline-none hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-2 focus:ring-blue-400 dark:text-zinc-50 dark:hover:bg-zinc-800/60 dark:focus:bg-zinc-800/60"
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
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            rows={5}
            maxLength={10000}
            placeholder="Detalles, pasos, a quién preguntar…"
            className={cn(ESTILO_CAMPO, 'resize-y')}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                if (texto.trim() !== valor.trim()) onGuardar(texto.trim());
              }}
              className={cn(BOTON_PRIMARIO, 'px-3 py-1.5')}
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setTexto(valor);
                setEditando(false);
              }}
              className={cn(BOTON_SECUNDARIO, 'px-3 py-1.5')}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className={cn(
            'block w-full rounded-xl px-3 py-2 text-left text-sm whitespace-pre-wrap transition-colors',
            valor
              ? 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60'
              : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800',
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

function Checklist({ items, onCambio }: { items: ItemChecklist[]; onCambio: (i: ItemChecklist[]) => void }) {
  const [nuevo, setNuevo] = useState('');
  const [ocultarHechos, setOcultarHechos] = useState(false);
  const { hechos, total } = progresoChecklist(items);
  const pct = total ? Math.round((hechos / total) * 100) : 0;

  function anadir() {
    const nuevos = checklistDeTexto(nuevo, nuevoId);
    if (nuevos.length === 0) return;
    onCambio([...items, ...nuevos]);
    setNuevo('');
  }

  const visibles = ocultarHechos ? items.filter((i) => !i.hecho) : items;

  return (
    <Bloque icono={ListChecks} titulo="Checklist">
      {total > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <span className="w-9 text-xs font-medium text-zinc-500">{pct}%</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={cn('h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-emerald-500' : 'bg-blue-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
          {hechos > 0 && (
            <button type="button" onClick={() => setOcultarHechos((v) => !v)} className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              {ocultarHechos ? `Ver hechos (${hechos})` : 'Ocultar hechos'}
            </button>
          )}
        </div>
      )}
      <ul className="space-y-0.5">
        {visibles.map((it) => (
          <ItemCheck
            key={it.id}
            item={it}
            onToggle={() => {
              if (!it.hecho) haptic.tap();
              onCambio(items.map((x) => (x.id === it.id ? { ...x, hecho: !x.hecho } : x)));
            }}
            onTexto={(texto) => onCambio(items.map((x) => (x.id === it.id ? { ...x, texto } : x)))}
            onBorrar={() => onCambio(items.filter((x) => x.id !== it.id))}
          />
        ))}
      </ul>
      <div className="mt-1.5 flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && anadir()}
          onPaste={(e) => {
            // Pegar una lista de varias líneas = varios items de golpe.
            const pegado = e.clipboardData.getData('text');
            if (pegado.includes('\n')) {
              e.preventDefault();
              const nuevos = checklistDeTexto(pegado, nuevoId);
              if (nuevos.length) onCambio([...items, ...nuevos]);
            }
          }}
          placeholder="Añadir un paso…"
          maxLength={300}
          className={cn(ESTILO_CAMPO, 'py-1.5')}
        />
        <button type="button" onClick={anadir} disabled={!nuevo.trim()} aria-label="Añadir" className={cn(BOTON_SECUNDARIO, 'px-2.5 py-1.5')}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </Bloque>
  );
}

function ItemCheck({
  item,
  onToggle,
  onTexto,
  onBorrar,
}: {
  item: ItemChecklist;
  onToggle: () => void;
  onTexto: (t: string) => void;
  onBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(item.texto);
  return (
    <li className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.hecho ? 'Desmarcar' : 'Marcar como hecho'}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          item.hecho ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 hover:border-emerald-500 dark:border-zinc-600',
        )}
      >
        {item.hecho && <Check className="h-3.5 w-3.5" />}
      </button>
      {editando ? (
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            setEditando(false);
            if (texto.trim() && texto.trim() !== item.texto) onTexto(texto.trim());
            else setTexto(item.texto);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          autoFocus
          maxLength={300}
          className="min-w-0 flex-1 rounded bg-white px-1 text-sm outline-none ring-2 ring-blue-400 dark:bg-zinc-950"
        />
      ) : (
        <span
          onClick={() => setEditando(true)}
          className={cn('min-w-0 flex-1 cursor-text text-sm break-words', item.hecho ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-200')}
        >
          {item.texto}
        </span>
      )}
      <button
        type="button"
        onClick={onBorrar}
        aria-label="Quitar"
        className="rounded p-0.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 focus:opacity-100 dark:text-zinc-600"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
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
              <li key={e.id} className="group flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <Icono className={cn('h-4 w-4 shrink-0', tipo === 'web' ? 'text-zinc-400' : 'text-blue-600 dark:text-blue-400')} />
                <a
                  href={e.url}
                  target={interno ? undefined : '_blank'}
                  rel={interno ? undefined : 'noopener noreferrer'}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 hover:text-blue-600 hover:underline dark:text-zinc-200 dark:hover:text-blue-400"
                >
                  {tituloEnlace(e)}
                </a>
                {!interno && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
                <button
                  type="button"
                  onClick={() => onCambio(enlaces.filter((x) => x.id !== e.id))}
                  aria-label="Quitar enlace"
                  className="rounded p-0.5 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 focus:opacity-100 dark:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {abierto ? (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/50">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadir()}
            autoFocus
            placeholder="Pega el enlace (Drive, un Doc, una pantalla de la plataforma…)"
            className={cn(ESTILO_CAMPO, 'py-1.5')}
          />
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && anadir()}
            placeholder="Cómo se llama (opcional)"
            maxLength={120}
            className={cn(ESTILO_CAMPO, 'py-1.5')}
          />
          <div className="flex gap-2">
            <button type="button" onClick={anadir} disabled={!url.trim()} className={cn(BOTON_PRIMARIO, 'px-3 py-1.5')}>
              Añadir enlace
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={cn(BOTON_SECUNDARIO, 'px-3 py-1.5')}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className={cn(BOTON_SECUNDARIO, 'px-2.5 py-1.5 text-xs')}>
          <Plus className="h-3.5 w-3.5" /> Añadir enlace
        </button>
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
    if (!window.confirm('¿Borrar el comentario?')) return;
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
        <Avatar email={yo} nombre={yoNombre} className="mt-1 ring-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void comentar();
            }}
            rows={2}
            maxLength={4000}
            placeholder="Cómo va, qué falta, a quién se ha llamado…"
            className={cn(ESTILO_CAMPO, 'resize-y')}
          />
          {texto.trim() && (
            <button type="button" onClick={comentar} disabled={enviando} className={cn(BOTON_PRIMARIO, 'px-3 py-1.5')}>
              Comentar
            </button>
          )}
        </div>
      </div>

      {items === null ? (
        <div className="mt-3 h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((s) =>
            s.tipo === 'comentario' ? (
              <li key={s.id} className="group flex gap-2">
                <Avatar email={s.autorEmail ?? '?'} nombre={s.autorNombre} className="ring-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">
                    <b className="font-semibold text-zinc-800 dark:text-zinc-200">{s.autorNombre ?? s.autorEmail}</b> ·{' '}
                    {formatDistanceToNow(new Date(s.createdAt), { locale: es, addSuffix: true })}
                    {s.autorEmail === yo && (
                      <button
                        type="button"
                        onClick={() => borrar(s.id)}
                        className="ml-2 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                      >
                        Borrar
                      </button>
                    )}
                  </p>
                  <div className="mt-0.5 rounded-xl rounded-tl-sm bg-zinc-100 px-3 py-2 text-sm whitespace-pre-wrap break-words text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                    <TextoConEnlaces texto={s.texto} />
                  </div>
                </div>
              </li>
            ) : (
              <li key={s.id} className="flex items-center gap-2 pl-1 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <span>
                  <b className="font-medium text-zinc-700 dark:text-zinc-300">{s.autorNombre ?? s.autorEmail}</b> {s.texto} ·{' '}
                  {formatDistanceToNow(new Date(s.createdAt), { locale: es, addSuffix: true })}
                </span>
              </li>
            ),
          )}
          {items.length === 0 && <li className="text-xs text-zinc-400">Todavía no hay seguimiento.</li>}
        </ul>
      )}
    </Bloque>
  );
}
