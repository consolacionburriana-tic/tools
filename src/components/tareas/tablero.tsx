'use client';

// /gestion/tareas: todo lo apuntado, para leerlo con calma y llevarlo. Dos pestañas —
// fallitos y módulos nuevos— con el mismo filtro de estado. Cuando esto sea un kanban, las
// columnas serán ESTADOS_TAREA y estas mismas tarjetas.
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Lightbulb, ListTodo, Pencil, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  estaAbierta,
  etiquetaModulo,
  fechaCorta,
  MODULOS_FALLO,
  promptFallosAbiertos,
  promptTarea,
  type ActualizarTarea,
  type EstadoTarea,
  type ItemChecklist,
  type Tarea,
} from '@/lib/tareas';
import { apiTareas, BotonCopiar, ESTILO_CAMPO, EstadoSelect } from './comun';
import { FormFallo, FormModulo } from './formularios';

type Filtro = 'abiertas' | 'hecho' | 'descartado' | 'todas';
const FILTROS: [Filtro, string][] = [
  ['abiertas', 'Por hacer'],
  ['hecho', 'Hechas'],
  ['descartado', 'Descartadas'],
  ['todas', 'Todas'],
];

function pasaFiltro(t: Tarea, f: Filtro): boolean {
  if (f === 'todas') return true;
  if (f === 'abiertas') return estaAbierta(t.estado);
  return t.estado === f;
}

export function TableroTareas({ iniciales }: { iniciales: Tarea[] }) {
  const [tareas, setTareas] = useState(iniciales);
  const [pestana, setPestana] = useState<'fallo' | 'modulo'>('fallo');
  const [filtro, setFiltro] = useState<Filtro>('abiertas');
  const [modulo, setModulo] = useState('*');
  const [busqueda, setBusqueda] = useState('');

  const delTipo = tareas.filter((t) => t.tipo === pestana);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tareas.filter(
      (t) =>
        t.tipo === pestana &&
        pasaFiltro(t, filtro) &&
        (pestana !== 'fallo' || modulo === '*' || (t.modulo ?? '') === modulo) &&
        (!q || `${t.titulo} ${t.descripcion ?? ''}`.toLowerCase().includes(q)),
    );
  }, [tareas, pestana, filtro, modulo, busqueda]);

  const cuenta = (tipo: 'fallo' | 'modulo') => tareas.filter((t) => t.tipo === tipo && estaAbierta(t.estado)).length;

  async function cambiar(id: string, cambios: ActualizarTarea) {
    const antes = tareas;
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } as Tarea : t)));
    try {
      const nueva = await apiTareas.actualizar(id, cambios);
      setTareas((prev) => prev.map((t) => (t.id === id ? nueva : t)));
    } catch (err) {
      setTareas(antes);
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    }
  }

  async function borrar(t: Tarea) {
    if (!window.confirm(`¿Borrar «${t.titulo}»? No se puede deshacer.`)) return;
    const antes = tareas;
    setTareas((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await apiTareas.borrar(t.id);
    } catch {
      setTareas(antes);
      toast.error('No se ha podido borrar');
    }
  }

  // Módulos que tienen algún fallito, para el filtro (no tiene sentido ofrecer los vacíos).
  const modulosConFallos = useMemo(() => {
    const usados = new Set(tareas.filter((t) => t.tipo === 'fallo').map((t) => t.modulo ?? ''));
    return ['', ...MODULOS_FALLO].filter((m) => usados.has(m));
  }, [tareas]);

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      {/* Alta rápida: a la izquierda en pantalla grande, arriba en el iPad en vertical */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {pestana === 'fallo' ? <ListTodo className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            {pestana === 'fallo' ? 'Apuntar un fallito' : 'Idea de módulo nuevo'}
          </p>
          {pestana === 'fallo' ? (
            <FormFallo ruta={null} onCreada={(t) => setTareas((p) => [t, ...p])} />
          ) : (
            <FormModulo onCreada={(t) => setTareas((p) => [t, ...p])} />
          )}
        </div>
        {pestana === 'fallo' && cuenta('fallo') > 0 && (
          <BotonCopiar
            texto={() => promptFallosAbiertos(tareas)}
            etiqueta={`Copiar los ${cuenta('fallo')} fallitos pendientes`}
            className="w-full justify-center py-2"
          />
        )}
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
            {(
              [
                ['fallo', 'Fallitos', ListTodo],
                ['modulo', 'Módulos nuevos', Lightbulb],
              ] as const
            ).map(([id, etiqueta, Icono]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPestana(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  pestana === id
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                )}
              >
                <Icono className="h-4 w-4" /> {etiqueta}
                <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                  {cuenta(id)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {FILTROS.map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filtro === id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className={cn(ESTILO_CAMPO, 'pl-9')}
            />
          </div>
          {pestana === 'fallo' && modulosConFallos.length > 1 && (
            <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={cn(ESTILO_CAMPO, 'w-auto')}>
              <option value="*">Todos los módulos</option>
              {modulosConFallos.map((m) => (
                <option key={m} value={m}>
                  {etiquetaModulo(m || null)}
                </option>
              ))}
            </select>
          )}
        </div>

        {visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {delTipo.length === 0
              ? pestana === 'fallo'
                ? 'Ni un fallito apuntado. Ojalá dure.'
                : 'Todavía no hay ideas de módulos nuevos.'
              : 'Nada con estos filtros.'}
          </div>
        ) : pestana === 'fallo' ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {visibles.map((t) => (
              <FilaFallo key={t.id} t={t} onCambiar={(c) => cambiar(t.id, c)} onBorrar={() => borrar(t)} />
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            {visibles.map((t) => (
              <TarjetaModulo key={t.id} t={t} onCambiar={(c) => cambiar(t.id, c)} onBorrar={() => borrar(t)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Fallito ─────────────────────────────────────────────────────────────────
function FilaFallo({
  t,
  onCambiar,
  onBorrar,
}: {
  t: Tarea;
  onCambiar: (c: ActualizarTarea) => void;
  onBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(t.titulo);
  const hecho = t.estado === 'hecho';

  function guardar() {
    setEditando(false);
    if (texto.trim().length >= 2 && texto.trim() !== t.titulo) onCambiar({ titulo: texto.trim() });
    else setTexto(t.titulo);
  }

  return (
    <li className="group flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={() => {
          haptic.tap();
          onCambiar({ estado: hecho ? 'pendiente' : 'hecho' });
        }}
        aria-label={hecho ? 'Volver a pendiente' : 'Marcar como hecho'}
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
          hecho
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500 dark:border-zinc-600',
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        {editando ? (
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardar();
              if (e.key === 'Escape') {
                setTexto(t.titulo);
                setEditando(false);
              }
            }}
            autoFocus
            className={ESTILO_CAMPO}
          />
        ) : (
          <p
            className={cn(
              'text-[15px] leading-snug text-zinc-900 dark:text-zinc-100',
              (hecho || t.estado === 'descartado') && 'text-zinc-400 line-through dark:text-zinc-500',
            )}
          >
            {t.titulo}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
          <select
            value={t.modulo ?? ''}
            onChange={(e) => onCambiar({ modulo: e.target.value || null })}
            aria-label="Módulo"
            className="field-sizing-content cursor-pointer appearance-none rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700 outline-none dark:bg-blue-500/10 dark:text-blue-300"
          >
            <option value="">General</option>
            {MODULOS_FALLO.map((m) => (
              <option key={m} value={m}>
                {etiquetaModulo(m)}
              </option>
            ))}
          </select>
          {t.ruta && <code className="text-[11px] text-zinc-400">{t.ruta}</code>}
          <span>
            {t.createdByNombre ?? t.createdBy} · {fechaCorta(t.createdAt)}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <EstadoSelect estado={t.estado} onChange={(estado) => onCambiar({ estado })} className="mr-1" />
        <BotonCopiar texto={() => promptTarea(t)} compacto />
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar"
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 group-hover:flex sm:flex dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onBorrar}
          aria-label="Borrar"
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 group-hover:flex sm:flex dark:hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

// ─── Módulo nuevo ────────────────────────────────────────────────────────────
function TarjetaModulo({
  t,
  onCambiar,
  onBorrar,
}: {
  t: Tarea;
  onCambiar: (c: ActualizarTarea) => void;
  onBorrar: () => void;
}) {
  const [plegado, setPlegado] = useState(!estaAbierta(t.estado));
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(t.titulo);
  const [descripcion, setDescripcion] = useState(t.descripcion ?? '');
  const [nuevoItem, setNuevoItem] = useState('');

  const hechos = t.checklist.filter((i) => i.hecho).length;
  const total = t.checklist.length;

  function guardarTexto() {
    setEditando(false);
    const cambios: ActualizarTarea = {};
    if (titulo.trim().length >= 2 && titulo.trim() !== t.titulo) cambios.titulo = titulo.trim();
    if (descripcion.trim() !== (t.descripcion ?? '').trim()) cambios.descripcion = descripcion.trim() || null;
    if (Object.keys(cambios).length > 0) onCambiar(cambios);
  }

  function cambiarLista(lista: ItemChecklist[]) {
    onCambiar({ checklist: lista });
  }

  function anadirItem(e: React.FormEvent) {
    e.preventDefault();
    const texto = nuevoItem.trim();
    if (!texto) return;
    cambiarLista([...t.checklist, { id: crypto.randomUUID(), texto, hecho: false }]);
    setNuevoItem('');
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-start gap-3 p-4 pb-3">
        <button
          type="button"
          onClick={() => setPlegado((p) => !p)}
          aria-label={plegado ? 'Desplegar' : 'Plegar'}
          className="mt-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', plegado && '-rotate-90')} />
        </button>
        <div className="min-w-0 flex-1">
          {editando ? (
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={cn(ESTILO_CAMPO, 'text-base font-semibold')}
            />
          ) : (
            <h3 className="text-lg leading-snug font-semibold text-zinc-900 dark:text-zinc-100">{t.titulo}</h3>
          )}
          <p className="mt-0.5 text-xs text-zinc-500">
            {t.createdByNombre ?? t.createdBy} · {fechaCorta(t.createdAt)}
            {total > 0 && (
              <>
                {' · '}
                <span className={cn(hechos === total && 'text-emerald-600 dark:text-emerald-400')}>
                  {hechos}/{total} hecho
                </span>
              </>
            )}
          </p>
        </div>
        <EstadoSelect estado={t.estado} onChange={(estado: EstadoTarea) => onCambiar({ estado })} />
      </header>

      {total > 0 && (
        <div className="mx-4 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(hechos / total) * 100}%` }} />
        </div>
      )}

      {!plegado && (
        <div className="space-y-4 p-4 pt-3">
          {editando ? (
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={8}
              autoFocus
              placeholder="Definición funcional: qué resuelve, quién lo usa, cómo funciona…"
              className={cn(ESTILO_CAMPO, 'resize-y leading-relaxed')}
            />
          ) : t.descripcion ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {t.descripcion}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-sm text-zinc-400 italic hover:text-zinc-600"
            >
              Sin descripción todavía. Añadir…
            </button>
          )}

          <div>
            {total > 0 && (
              <ul className="space-y-1">
                {t.checklist.map((item) => (
                  <li key={item.id} className="group flex items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <button
                      type="button"
                      onClick={() => {
                        haptic.tap();
                        cambiarLista(t.checklist.map((i) => (i.id === item.id ? { ...i, hecho: !i.hecho } : i)));
                      }}
                      aria-label={item.hecho ? 'Desmarcar' : 'Marcar'}
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        item.hecho
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-zinc-300 text-transparent hover:border-emerald-500 dark:border-zinc-600',
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <span
                      className={cn(
                        'flex-1 text-sm text-zinc-800 dark:text-zinc-200',
                        item.hecho && 'text-zinc-400 line-through dark:text-zinc-500',
                      )}
                    >
                      {item.texto}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarLista(t.checklist.filter((i) => i.id !== item.id))}
                      aria-label="Quitar"
                      className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 focus-visible:opacity-100 dark:text-zinc-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={anadirItem} className="mt-2">
              <input
                value={nuevoItem}
                onChange={(e) => setNuevoItem(e.target.value)}
                placeholder="+ Añadir a la lista…"
                className={cn(ESTILO_CAMPO, 'border-dashed py-1.5')}
              />
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <BotonCopiar texto={() => promptTarea(t)} etiqueta="Copiar definición para Claude" />
            {editando ? (
              <button
                type="button"
                onClick={guardarTexto}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Check className="h-4 w-4" /> Guardar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
            <button
              type="button"
              onClick={onBorrar}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" /> Borrar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
