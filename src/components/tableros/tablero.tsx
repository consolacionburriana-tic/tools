'use client';

// Un tablero abierto: las listas en columnas (scroll horizontal) y las tarjetas que se
// arrastran de una a otra. En iPad se arrastra con una pulsación larga (para no robarle el
// scroll al dedo); con ratón, en cuanto se mueve. Tocar una tarjeta abre su ficha, y la ficha
// abierta va en la URL (`?t=`) para poder pasar el enlace a alguien.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignLeft,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CircleCheck,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  SquareCheckBig,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectorEmoji } from '@/components/mihorario/selector-emoji';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  COLORES_ETIQUETA,
  estadoVence,
  ordenEntre,
  porOrden,
  PRIORIDAD_LABELS,
  PRIORIDADES,
  progresoChecklist,
  type ColorEtiqueta,
  type ColorTablero,
  type Columna,
  type DatosTablero,
  type Etiqueta,
  type Prioridad,
  type Tarjeta,
} from '@/lib/tableros';
import {
  api,
  Avatares,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  ChipPrioridad,
  ChipVence,
  EMOJIS_TABLERO,
  ESTILO_CAMPO,
  ETIQUETA_CLASES,
  FONDO_SUAVE,
  nuevoId,
  PRIORIDAD_BORDE,
  SelectorColor,
} from './comun';
import { DetalleTarjeta } from './tarjeta-detalle';

type Items = Record<string, string[]>;

export function VistaTablero({ inicial, tarjetaInicial }: { inicial: DatosTablero; tarjetaInicial: string | null }) {
  const router = useRouter();
  const [datos, setDatos] = useState(inicial);
  const [abierta, setAbierta] = useState<string | null>(tarjetaInicial);
  const [busqueda, setBusqueda] = useState('');
  const [soloMias, setSoloMias] = useState(false);
  const [prioridad, setPrioridad] = useState<Prioridad | ''>('');
  const [etiqueta, setEtiqueta] = useState('');
  const [ajustes, setAjustes] = useState(false);
  const [archivadas, setArchivadas] = useState(false);
  const [arrastre, setArrastre] = useState<{ activo: string; items: Items } | null>(null);

  const { tablero, equipo, columnas, tarjetas, miembros, hoy, yo } = datos;
  const esAdmin = equipo.miRol === 'admin';
  const hayFiltro = Boolean(busqueda.trim() || soloMias || prioridad || etiqueta);

  // ── La tarjeta abierta va en la URL (pushState: sin recargar la página entera) ──
  const abrir = useCallback((id: string | null) => {
    setAbierta(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('t', id);
    else url.searchParams.delete('t');
    window.history.pushState(null, '', `${url.pathname}${url.search}`);
  }, []);
  useEffect(() => {
    const alVolver = () => setAbierta(new URL(window.location.href).searchParams.get('t'));
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const setTarjetas = (fn: (prev: Tarjeta[]) => Tarjeta[]) => setDatos((d) => ({ ...d, tarjetas: fn(d.tarjetas) }));
  const reemplazar = (t: Tarjeta) => setTarjetas((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [...prev, t]));

  async function recargar() {
    try {
      setDatos(await api.tablero(tablero.id));
    } catch {
      toast.error('No se ha podido recargar el tablero');
    }
  }

  // ── Filtros ──
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tarjetas.filter(
      (t) =>
        (!q || `${t.titulo} ${t.descripcion ?? ''}`.toLowerCase().includes(q)) &&
        (!soloMias || t.responsables.includes(yo)) &&
        (!prioridad || t.prioridad === prioridad) &&
        (!etiqueta || t.etiquetas.includes(etiqueta)),
    );
  }, [tarjetas, busqueda, soloMias, prioridad, etiqueta, yo]);

  const itemsBase = useMemo<Items>(() => {
    const r: Items = {};
    for (const c of columnas) r[c.id] = visibles.filter((t) => t.columnaId === c.id).sort(porOrden).map((t) => t.id);
    return r;
  }, [columnas, visibles]);
  const items = arrastre?.items ?? itemsBase;
  const porId = useMemo(() => new Map(tarjetas.map((t) => [t.id, t])), [tarjetas]);

  // ── Arrastrar ──
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const contenedorDe = (id: string, it: Items) => (id in it ? id : Object.keys(it).find((k) => it[k].includes(id)));

  function alEmpezar(e: DragStartEvent) {
    haptic.tap();
    setArrastre({ activo: String(e.active.id), items: itemsBase });
  }

  function alPasar(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    setArrastre((prev) => {
      if (!prev) return prev;
      const desde = contenedorDe(String(active.id), prev.items);
      const hacia = contenedorDe(String(over.id), prev.items);
      if (!desde || !hacia || desde === hacia) return prev;
      const lista = [...prev.items[hacia]];
      const iOver = lista.indexOf(String(over.id));
      const abajo =
        active.rect.current.translated && over.rect ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2 : false;
      const i = iOver >= 0 ? iOver + (abajo ? 1 : 0) : lista.length;
      lista.splice(i, 0, String(active.id));
      return { ...prev, items: { ...prev.items, [desde]: prev.items[desde].filter((x) => x !== active.id), [hacia]: lista } };
    });
  }

  async function alSoltar(e: DragEndEvent) {
    const estado = arrastre;
    setArrastre(null);
    const { active, over } = e;
    if (!over || !estado) return;
    const id = String(active.id);
    const hacia = contenedorDe(String(over.id), estado.items);
    if (!hacia) return;
    let lista = estado.items[hacia];
    const de = lista.indexOf(id);
    const a = over.id in estado.items ? lista.length - 1 : lista.indexOf(String(over.id));
    if (de >= 0 && a >= 0 && de !== a) lista = arrayMove(lista, de, a);
    const pos = lista.indexOf(id);
    const antes = pos > 0 ? porId.get(lista[pos - 1])?.orden : null;
    const despues = pos < lista.length - 1 ? porId.get(lista[pos + 1])?.orden : null;
    const t = porId.get(id);
    if (!t) return;
    const mismoSitio = t.columnaId === hacia && itemsBase[hacia]?.indexOf(id) === pos;
    if (mismoSitio) return;
    const orden = ordenEntre(antes, despues);
    const col = columnas.find((c) => c.id === hacia);
    const previa = t;
    reemplazar({
      ...t,
      columnaId: hacia,
      orden,
      completadaAt: col?.hecho ? (t.completadaAt ?? new Date().toISOString()) : null,
    });
    if (col?.hecho && !t.completadaAt) haptic.success();
    try {
      const r = await api.tarjeta(id, { accion: 'mover', columnaId: hacia, orden });
      if (r.tarjeta) reemplazar({ ...r.tarjeta, comentarios: previa.comentarios });
    } catch (err) {
      reemplazar(previa);
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido mover');
    }
  }

  // ── Listas ──
  async function accion(a: Parameters<typeof api.accionTablero>[1], ok?: string) {
    try {
      const r = await api.accionTablero(tablero.id, a);
      if (ok) toast.success(ok);
      await recargar();
      return r;
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
      return null;
    }
  }

  function moverColumna(c: Columna, delta: -1 | 1) {
    const ids = columnas.map((x) => x.id);
    const i = ids.indexOf(c.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    const nuevas = arrayMove(columnas, i, j).map((x, k) => ({ ...x, orden: k }));
    setDatos((d) => ({ ...d, columnas: nuevas }));
    void api.accionTablero(tablero.id, { accion: 'ordenColumnas', ids: nuevas.map((x) => x.id) }).catch(() => {
      toast.error('No se ha podido mover la lista');
      void recargar();
    });
  }

  async function crearTarjeta(columnaId: string, titulo: string) {
    try {
      const r = await api.accionTablero(tablero.id, {
        accion: 'crearTarjeta',
        columnaId,
        titulo,
        // Con «solo lo mío» puesto, lo que se crea es para mí: si no, desaparecería al crearlo.
        responsables: soloMias ? [yo] : [],
        prioridad: null,
        vence: null,
      });
      if (r.tarjeta) reemplazar(r.tarjeta);
      haptic.tap();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido crear');
      return false;
    }
  }

  const tarjetaAbierta = abierta ? (porId.get(abierta) ?? null) : null;
  const activa = arrastre ? porId.get(arrastre.activo) : null;
  const abiertasTotal = tarjetas.filter((t) => !columnas.find((c) => c.id === t.columnaId)?.hecho).length;

  return (
    <div className={cn('min-h-[calc(100dvh-3.5rem)]', FONDO_SUAVE[tablero.color])}>
      {/* Cabecera del tablero */}
      <div className="mx-auto max-w-[1800px] space-y-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/gestion/tableros"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-white/60 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
          >
            <ChevronLeft className="h-4 w-4" /> {equipo.emoji} {equipo.nombre}
          </Link>
          {datos.hermanos.length > 1 && (
            <select
              value={tablero.id}
              onChange={(e) => router.push(`/gestion/tableros/${e.target.value}`)}
              aria-label="Cambiar de tablero"
              className="rounded-lg border-0 bg-white/60 px-2 py-1 text-sm text-zinc-700 outline-none dark:bg-zinc-900/60 dark:text-zinc-200"
            >
              {datos.hermanos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.emoji} {h.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setAjustes(true)} className="group flex min-w-0 items-center gap-3 text-left">
            <span className="text-3xl">{tablero.emoji}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                <span className="truncate">{tablero.nombre}</span>
                <Pencil className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">
                {tablero.archivado ? '📦 Archivado · ' : ''}
                {abiertasTotal} por hacer{tablero.descripcion ? ` · ${tablero.descripcion}` : ''}
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Avatares emails={miembros.map((m) => m.email)} personas={miembros} max={5} tamano="h-7 w-7 text-[10px]" />
            <button type="button" onClick={() => setArchivadas(true)} className={cn(BOTON_SECUNDARIO, 'px-2.5')} title="Tarjetas archivadas">
              <Archive className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setAjustes(true)} className={cn(BOTON_SECUNDARIO, 'px-2.5')} title="Ajustes del tablero">
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el tablero…"
              className={cn(ESTILO_CAMPO, 'bg-white/80 pl-9 dark:bg-zinc-900/80')}
            />
          </div>
          <button
            type="button"
            onClick={() => setSoloMias((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              soloMias ? 'bg-blue-600 text-white' : 'bg-white/80 text-zinc-700 hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-200',
            )}
          >
            <User className="h-3.5 w-3.5" /> Lo mío
          </button>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as Prioridad | '')}
            aria-label="Filtrar por prioridad"
            className={cn(
              'rounded-full border-0 px-3 py-1.5 text-xs font-medium outline-none',
              prioridad ? 'bg-blue-600 text-white' : 'bg-white/80 text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200',
            )}
          >
            <option value="">Prioridad: todas</option>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDAD_LABELS[p]}
              </option>
            ))}
          </select>
          {tablero.etiquetas.length > 0 && (
            <select
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              aria-label="Filtrar por etiqueta"
              className={cn(
                'rounded-full border-0 px-3 py-1.5 text-xs font-medium outline-none',
                etiqueta ? 'bg-blue-600 text-white' : 'bg-white/80 text-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200',
              )}
            >
              <option value="">Etiqueta: todas</option>
              {tablero.etiquetas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre || e.color}
                </option>
              ))}
            </select>
          )}
          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setSoloMias(false);
                setPrioridad('');
                setEtiqueta('');
              }}
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <X className="h-3.5 w-3.5" /> Quitar filtros
            </button>
          )}
        </div>
      </div>

      {/* Las listas */}
      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={alEmpezar}
        onDragOver={alPasar}
        onDragEnd={alSoltar}
        onDragCancel={() => setArrastre(null)}
      >
        <div className="mx-auto flex max-w-[1800px] snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pt-4 pb-8 sm:snap-none">
          {columnas.map((c, i) => (
            <ColumnaVista
              key={c.id}
              columna={c}
              ids={items[c.id] ?? []}
              porId={porId}
              datos={datos}
              primera={i === 0}
              ultima={i === columnas.length - 1}
              hayFiltro={hayFiltro}
              onAbrir={abrir}
              onCrear={(titulo) => crearTarjeta(c.id, titulo)}
              onRenombrar={(nombre) => accion({ accion: 'editarColumna', columnaId: c.id, nombre })}
              onHecho={(hecho) =>
                accion({ accion: 'editarColumna', columnaId: c.id, hecho }, hecho ? 'Lo que esté aquí cuenta como terminado' : undefined)
              }
              onMover={(d) => moverColumna(c, d)}
              onBorrar={() => {
                const n = tarjetas.filter((t) => t.columnaId === c.id).length;
                const aviso = n ? `\n\nSus ${n} tarjeta${n === 1 ? '' : 's'} pasará${n === 1 ? '' : 'n'} a otra lista.` : '';
                if (window.confirm(`¿Borrar la lista «${c.nombre}»?${aviso}`)) void accion({ accion: 'borrarColumna', columnaId: c.id });
              }}
            />
          ))}
          <NuevaColumna onCrear={(nombre) => accion({ accion: 'crearColumna', nombre, hecho: false })} />
        </div>
        <DragOverlay>
          {activa ? (
            <div className="rotate-2 cursor-grabbing">
              <TarjetaVista t={activa} datos={datos} hecha={!!columnas.find((c) => c.id === activa.columnaId)?.hecho} elevada />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {tarjetaAbierta && (
        <DetalleTarjeta
          key={tarjetaAbierta.id}
          tarjeta={tarjetaAbierta}
          datos={datos}
          onCambio={reemplazar}
          onFuera={(id) => {
            setTarjetas((prev) => prev.filter((t) => t.id !== id));
            abrir(null);
          }}
          onClose={() => abrir(null)}
        />
      )}
      {abierta && !tarjetaAbierta && <TarjetaNoEsta onClose={() => abrir(null)} />}

      {ajustes && (
        <DialogoAjustesTablero
          datos={datos}
          esAdmin={esAdmin}
          onClose={() => setAjustes(false)}
          onCambio={recargar}
          onBorrado={() => router.push('/gestion/tableros')}
        />
      )}
      {archivadas && (
        <DialogoArchivadas
          tableroId={tablero.id}
          hoy={hoy}
          onClose={() => setArchivadas(false)}
          onRecuperada={(t) => reemplazar(t)}
        />
      )}
    </div>
  );
}

// ─── Columna ─────────────────────────────────────────────────────────────────
function ColumnaVista({
  columna,
  ids,
  porId,
  datos,
  primera,
  ultima,
  hayFiltro,
  onAbrir,
  onCrear,
  onRenombrar,
  onHecho,
  onMover,
  onBorrar,
}: {
  columna: Columna;
  ids: string[];
  porId: Map<string, Tarjeta>;
  datos: DatosTablero;
  primera: boolean;
  ultima: boolean;
  hayFiltro: boolean;
  onAbrir: (id: string) => void;
  onCrear: (titulo: string) => Promise<boolean>;
  onRenombrar: (nombre: string) => void;
  onHecho: (hecho: boolean) => void;
  onMover: (d: -1 | 1) => void;
  onBorrar: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columna.id });
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(columna.nombre);
  const [menu, setMenu] = useState(false);

  function guardarNombre() {
    setRenombrando(false);
    if (nombre.trim() && nombre.trim() !== columna.nombre) onRenombrar(nombre.trim());
    else setNombre(columna.nombre);
  }

  return (
    <section
      className={cn(
        'flex max-h-[calc(100dvh-13rem)] w-[85vw] shrink-0 snap-center flex-col rounded-2xl bg-zinc-100/85 shadow-sm ring-1 ring-black/5 backdrop-blur-sm sm:w-72 dark:bg-zinc-900/85 dark:ring-white/10',
        isOver && 'ring-2 ring-blue-400',
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        {columna.hecho && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        {renombrando ? (
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardarNombre();
              if (e.key === 'Escape') {
                setNombre(columna.nombre);
                setRenombrando(false);
              }
            }}
            autoFocus
            maxLength={40}
            className="min-w-0 flex-1 rounded-md bg-white px-2 py-0.5 text-sm font-semibold outline-none ring-2 ring-blue-400 dark:bg-zinc-950"
          />
        ) : (
          <h3
            onDoubleClick={() => setRenombrando(true)}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100"
          >
            {columna.nombre}
          </h3>
        )}
        <span className="rounded-full bg-zinc-200/80 px-2 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {ids.length}
        </span>
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger
            aria-label="Opciones de la lista"
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 gap-0.5 p-1">
            <ItemMenu
              onClick={() => {
                setMenu(false);
                setRenombrando(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Cambiar nombre
            </ItemMenu>
            <ItemMenu
              onClick={() => {
                setMenu(false);
                onHecho(!columna.hecho);
              }}
            >
              <CircleCheck className="h-4 w-4" /> {columna.hecho ? 'Ya no es «terminado»' : 'Lo de aquí está terminado'}
            </ItemMenu>
            {!primera && (
              <ItemMenu
                onClick={() => {
                  setMenu(false);
                  onMover(-1);
                }}
              >
                <ArrowLeft className="h-4 w-4" /> Mover a la izquierda
              </ItemMenu>
            )}
            {!ultima && (
              <ItemMenu
                onClick={() => {
                  setMenu(false);
                  onMover(1);
                }}
              >
                <ArrowRight className="h-4 w-4" /> Mover a la derecha
              </ItemMenu>
            )}
            <ItemMenu
              peligro
              onClick={() => {
                setMenu(false);
                onBorrar();
              }}
            >
              <Trash2 className="h-4 w-4" /> Borrar la lista
            </ItemMenu>
          </PopoverContent>
        </Popover>
      </header>

      <SortableContext id={columna.id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-12 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {ids.map((id) => {
            const t = porId.get(id);
            return t ? <TarjetaArrastrable key={id} t={t} datos={datos} hecha={columna.hecho} onAbrir={() => onAbrir(id)} /> : null;
          })}
          {ids.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-zinc-300/80 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
              {hayFiltro ? 'Nada con estos filtros' : columna.hecho ? 'Arrastra aquí lo terminado' : 'Sin tareas'}
            </p>
          )}
        </div>
      </SortableContext>

      <AltaRapida onCrear={onCrear} />
    </section>
  );
}

function ItemMenu({ children, onClick, peligro }: { children: React.ReactNode; onClick: () => void; peligro?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
        peligro ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  );
}

function AltaRapida({ onCrear }: { onCrear: (titulo: string) => Promise<boolean> }) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function crear() {
    const t = texto.trim();
    if (!t || guardando) return;
    setGuardando(true);
    const ok = await onCrear(t);
    setGuardando(false);
    if (ok) {
      // Se queda abierta para apuntar otra seguida, como en Trello.
      setTexto('');
      ref.current?.focus();
    }
  }

  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="mx-2 mb-2 flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Plus className="h-4 w-4" /> Añadir tarea
      </button>
    );
  }
  return (
    <div className="space-y-2 px-2 pb-2">
      <textarea
        ref={ref}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void crear();
          }
          if (e.key === 'Escape') setAbierta(false);
        }}
        autoFocus
        rows={2}
        maxLength={200}
        placeholder="¿Qué hay que hacer?"
        className="w-full resize-none rounded-xl border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-blue-400 dark:bg-zinc-950 dark:ring-white/10"
      />
      <div className="flex items-center gap-2">
        <button type="button" onClick={crear} disabled={!texto.trim() || guardando} className={cn(BOTON_PRIMARIO, 'px-3 py-1.5')}>
          Añadir
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierta(false);
            setTexto('');
          }}
          aria-label="Cancelar"
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NuevaColumna({ onCrear }: { onCrear: (nombre: string) => Promise<unknown> }) {
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState('');

  async function crear() {
    if (!nombre.trim()) return;
    await onCrear(nombre.trim());
    setNombre('');
    setAbierta(false);
  }

  return (
    <div className="w-[85vw] shrink-0 snap-center sm:w-72">
      {abierta ? (
        <div className="space-y-2 rounded-2xl bg-zinc-100/85 p-3 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/85 dark:ring-white/10">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void crear();
              if (e.key === 'Escape') setAbierta(false);
            }}
            autoFocus
            maxLength={40}
            placeholder="Nombre de la lista"
            className={ESTILO_CAMPO}
          />
          <div className="flex gap-2">
            <button type="button" onClick={crear} disabled={!nombre.trim()} className={cn(BOTON_PRIMARIO, 'px-3 py-1.5')}>
              Añadir lista
            </button>
            <button type="button" onClick={() => setAbierta(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="flex w-full items-center gap-1.5 rounded-2xl bg-white/40 px-3 py-3 text-sm font-medium text-zinc-700 ring-1 ring-black/5 transition-colors hover:bg-white/70 dark:bg-zinc-900/40 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-zinc-900/70"
        >
          <Plus className="h-4 w-4" /> Añadir otra lista
        </button>
      )}
    </div>
  );
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────────
function TarjetaArrastrable({ t, datos, hecha, onAbrir }: { t: Tarjeta; datos: DatosTablero; hecha: boolean; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onAbrir();
        listeners?.onKeyDown?.(e);
      }}
      className={cn('touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-xl', isDragging && 'opacity-40')}
    >
      <TarjetaVista t={t} datos={datos} hecha={hecha} />
    </div>
  );
}

export function TarjetaVista({ t, datos, hecha, elevada }: { t: Tarjeta; datos: DatosTablero; hecha: boolean; elevada?: boolean }) {
  const etiquetas = t.etiquetas
    .map((id) => datos.tablero.etiquetas.find((e) => e.id === id))
    .filter((e): e is Etiqueta => Boolean(e));
  const { hechos, total } = progresoChecklist(t.checklist);
  const { estado } = estadoVence(t.vence, datos.hoy, hecha);
  return (
    <article
      className={cn(
        'cursor-pointer rounded-xl border-l-4 bg-white p-3 shadow-sm ring-1 ring-black/5 transition-shadow select-none hover:shadow-md dark:bg-zinc-800 dark:ring-white/10',
        t.prioridad ? PRIORIDAD_BORDE[t.prioridad] : 'border-l-transparent',
        estado === 'vencida' && 'ring-red-300 dark:ring-red-500/40',
        elevada && 'shadow-2xl ring-2 ring-blue-400',
      )}
    >
      {etiquetas.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {etiquetas.map((e) => (
            <span key={e.id} className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', ETIQUETA_CLASES[e.color].fondo)}>
              {e.nombre || '   '}
            </span>
          ))}
        </div>
      )}
      <p
        className={cn(
          'line-clamp-4 text-sm font-medium break-words text-zinc-900 dark:text-zinc-100',
          hecha && 'text-zinc-500 line-through decoration-zinc-400/60 dark:text-zinc-400',
        )}
      >
        {t.titulo}
      </p>
      {(t.prioridad || t.vence || total > 0 || t.comentarios > 0 || t.enlaces.length > 0 || t.descripcion || t.responsables.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          {t.prioridad && (t.prioridad === 'alta' || t.prioridad === 'urgente') && !hecha && <ChipPrioridad prioridad={t.prioridad} />}
          {t.vence && <ChipVence vence={t.vence} hoy={datos.hoy} hecha={hecha} />}
          {total > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium',
                hechos === total && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
              )}
            >
              <SquareCheckBig className="h-3 w-3" /> {hechos}/{total}
            </span>
          )}
          {t.descripcion && <AlignLeft className="h-3.5 w-3.5" aria-label="Tiene descripción" />}
          {t.comentarios > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <MessageSquare className="h-3.5 w-3.5" /> {t.comentarios}
            </span>
          )}
          {t.enlaces.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <Link2 className="h-3.5 w-3.5" /> {t.enlaces.length}
            </span>
          )}
          <Avatares emails={t.responsables} personas={datos.miembros} className="ml-auto" />
        </div>
      )}
    </article>
  );
}

function TarjetaNoEsta({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Esta tarjeta no está</DialogTitle>
        <p className="text-sm text-zinc-500">
          Puede que se haya archivado o borrado. Las archivadas están en el botón <Archive className="inline h-4 w-4" /> de arriba.
        </p>
        <button type="button" onClick={onClose} className={BOTON_SECUNDARIO}>
          Vale
        </button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ajustes del tablero ─────────────────────────────────────────────────────
function DialogoAjustesTablero({
  datos,
  esAdmin,
  onClose,
  onCambio,
  onBorrado,
}: {
  datos: DatosTablero;
  esAdmin: boolean;
  onClose: () => void;
  onCambio: () => Promise<void>;
  onBorrado: () => void;
}) {
  const t = datos.tablero;
  const [nombre, setNombre] = useState(t.nombre);
  const [emoji, setEmoji] = useState(t.emoji);
  const [color, setColor] = useState<ColorTablero>(t.color);
  const [descripcion, setDescripcion] = useState(t.descripcion ?? '');
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>(t.etiquetas);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    if (!nombre.trim()) return;
    setOcupado(true);
    try {
      await api.accionTablero(t.id, { accion: 'editar', nombre, emoji, color, descripcion });
      await api.accionTablero(t.id, { accion: 'etiquetas', etiquetas: etiquetas.filter((e) => e.nombre.trim() || e.color) });
      haptic.success();
      await onCambio();
      onClose();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setOcupado(false);
    }
  }

  async function archivar() {
    if (!window.confirm(t.archivado ? '¿Sacar el tablero del archivo?' : '¿Archivar el tablero? Deja de salir en la lista y sus tareas dejan de avisar. Se puede recuperar.')) return;
    try {
      await api.accionTablero(t.id, { accion: 'editar', archivado: !t.archivado });
      await onCambio();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  async function borrar() {
    const escrito = window.prompt(`Se borrará el tablero con TODAS sus tarjetas, para todo el equipo. No se puede deshacer.\n\nEscribe «${t.nombre}» para confirmarlo:`);
    if (escrito?.trim() !== t.nombre) return;
    try {
      await api.borrarTablero(t.id);
      toast.success('Tablero borrado');
      onBorrado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>Ajustes del tablero</DialogTitle>
        <div className="space-y-3">
          <div className="flex gap-2">
            <SelectorEmoji valor={emoji} onChange={setEmoji} sugeridos={EMOJIS_TABLERO} />
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className={ESTILO_CAMPO} />
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

        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Etiquetas</p>
          <p className="text-xs text-zinc-500">Para clasificar las tarjetas de un vistazo («iPad», «Hay que comprar», «Esperando a alguien»…).</p>
          <ul className="space-y-1.5">
            {etiquetas.map((e, i) => (
              <li key={e.id} className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger
                    aria-label="Color"
                    className={cn('h-8 w-10 shrink-0 rounded-lg', ETIQUETA_CLASES[e.color].barra)}
                  />
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="grid grid-cols-5 gap-1.5">
                      {COLORES_ETIQUETA.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          onClick={() => setEtiquetas((prev) => prev.map((x, j) => (j === i ? { ...x, color: c as ColorEtiqueta } : x)))}
                          className={cn('h-7 w-9 rounded-md', ETIQUETA_CLASES[c].barra, e.color === c && 'ring-2 ring-zinc-900 ring-offset-1 dark:ring-white')}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <input
                  value={e.nombre}
                  onChange={(ev) => setEtiquetas((prev) => prev.map((x, j) => (j === i ? { ...x, nombre: ev.target.value } : x)))}
                  placeholder="Nombre"
                  maxLength={40}
                  className={ESTILO_CAMPO}
                />
                <button
                  type="button"
                  onClick={() => setEtiquetas((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Quitar etiqueta"
                  className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              setEtiquetas((prev) => [...prev, { id: nuevoId(), nombre: '', color: COLORES_ETIQUETA[prev.length % COLORES_ETIQUETA.length] }])
            }
            className={cn(BOTON_SECUNDARIO, 'py-1.5')}
          >
            <Plus className="h-4 w-4" /> Etiqueta
          </button>
        </div>

        <button type="button" onClick={guardar} disabled={ocupado || !nombre.trim()} className={BOTON_PRIMARIO}>
          Guardar
        </button>

        {esAdmin && (
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button type="button" onClick={archivar} className={BOTON_SECUNDARIO}>
              {t.archivado ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {t.archivado ? 'Sacar del archivo' : 'Archivar tablero'}
            </button>
            <button
              type="button"
              onClick={borrar}
              className={cn(BOTON_SECUNDARIO, 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10')}
            >
              <Trash2 className="h-4 w-4" /> Borrar tablero
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Archivadas ──────────────────────────────────────────────────────────────
function DialogoArchivadas({
  tableroId,
  hoy,
  onClose,
  onRecuperada,
}: {
  tableroId: string;
  hoy: string;
  onClose: () => void;
  onRecuperada: (t: Tarjeta) => void;
}) {
  const [lista, setLista] = useState<Tarjeta[] | null>(null);
  useEffect(() => {
    api
      .archivadas(tableroId)
      .then(setLista)
      .catch(() => setLista([]));
  }, [tableroId]);

  async function recuperar(t: Tarjeta) {
    try {
      const r = await api.tarjeta(t.id, { accion: 'archivar', archivada: false });
      if (r.tarjeta) onRecuperada(r.tarjeta);
      setLista((prev) => prev?.filter((x) => x.id !== t.id) ?? prev);
      haptic.success();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  async function borrar(t: Tarjeta) {
    if (!window.confirm(`¿Borrar «${t.titulo}» para siempre?`)) return;
    try {
      await api.borrarTarjeta(t.id);
      setLista((prev) => prev?.filter((x) => x.id !== t.id) ?? prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" /> Tarjetas archivadas
        </DialogTitle>
        {lista === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ) : lista.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay nada archivado en este tablero.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {lista.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.titulo}</span>
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                    {t.archivadaAt && `Archivada el ${new Date(t.archivadaAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                    {t.vence && <ChipVence vence={t.vence} hoy={hoy} hecha />}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => recuperar(t)}
                  title="Devolver al tablero"
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => borrar(t)}
                  title="Borrar para siempre"
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

