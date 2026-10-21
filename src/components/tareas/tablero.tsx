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
import { Button } from '@/components/ui/button';
import { useConfirmar } from '@/components/ui/confirmar';
import { Filtro as Pastilla, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
import { apiTareas, BotonCopiar, EstadoSelect } from './comun';
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
  const { confirmar, dialogo } = useConfirmar();

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
    if (!(await confirmar({ titulo: `¿Borrar «${t.titulo}»?`, descripcion: 'No se puede deshacer.', boton: 'Borrar' }))) return;
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
      <h1 className="sr-only">Tareas de la plataforma</h1>
      {dialogo}
      {/* Alta rápida: a la izquierda en pantalla grande, arriba en el iPad en vertical */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Tarjeta className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {pestana === 'fallo' ? <ListTodo aria-hidden className="size-4" /> : <Lightbulb aria-hidden className="size-4" />}
            {pestana === 'fallo' ? 'Apuntar un fallito' : 'Idea de módulo nuevo'}
          </p>
          {pestana === 'fallo' ? (
            <FormFallo ruta={null} onCreada={(t) => setTareas((p) => [t, ...p])} />
          ) : (
            <FormModulo onCreada={(t) => setTareas((p) => [t, ...p])} />
          )}
        </Tarjeta>
        {pestana === 'fallo' && cuenta('fallo') > 0 && (
          <BotonCopiar
            texto={() => promptFallosAbiertos(tareas)}
            etiqueta={`Copiar los ${cuenta('fallo')} fallitos pendientes`}
            className="w-full"
          />
        )}
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmentado
            etiqueta="Ver"
            valor={pestana}
            onChange={setPestana}
            opciones={[
              { valor: 'fallo', etiqueta: 'Fallitos', icono: <ListTodo aria-hidden />, cuenta: cuenta('fallo') },
              { valor: 'modulo', etiqueta: 'Módulos nuevos', icono: <Lightbulb aria-hidden />, cuenta: cuenta('modulo') },
            ]}
          />
          <Filtros etiqueta="Mostrar">
            {FILTROS.map(([id, etiqueta]) => (
              <Pastilla key={id} activo={filtro === id} onClick={() => setFiltro(id)}>
                {etiqueta}
              </Pastilla>
            ))}
          </Filtros>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar"
              className="pl-9"
            />
          </div>
          {pestana === 'fallo' && modulosConFallos.length > 1 && (
            <Selector value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo" className="w-auto">
              <option value="*">Todos los módulos</option>
              {modulosConFallos.map((m) => (
                <option key={m} value={m}>
                  {etiquetaModulo(m || null)}
                </option>
              ))}
            </Selector>
          )}
        </div>

        {visibles.length === 0 ? (
          <Vacio
            titulo={
              delTipo.length === 0
                ? pestana === 'fallo'
                  ? 'Ni un fallito apuntado. Ojalá dure.'
                  : 'Todavía no hay ideas de módulos nuevos.'
                : 'Nada con estos filtros.'
            }
          />
        ) : pestana === 'fallo' ? (
          <Tarjeta as="div" className="overflow-hidden">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((t) => (
              <FilaFallo key={t.id} t={t} onCambiar={(c) => cambiar(t.id, c)} onBorrar={() => borrar(t)} />
            ))}
          </ul>
          </Tarjeta>
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
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
      <button
        type="button"
        onClick={() => {
          haptic.tap();
          onCambiar({ estado: hecho ? 'pendiente' : 'hecho' });
        }}
        aria-label={hecho ? 'Volver a pendiente' : 'Marcar como hecho'}
        aria-pressed={hecho}
        className="-my-2 -ml-2 flex size-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full border transition-colors',
            hecho
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-zinc-300 text-transparent hover:border-emerald-600 hover:text-emerald-600 dark:border-zinc-600',
          )}
        >
          <Check aria-hidden className="size-3.5" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        {editando ? (
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Qué falla"
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardar();
              if (e.key === 'Escape') {
                setTexto(t.titulo);
                setEditando(false);
              }
            }}
            autoFocus
          />
        ) : (
          <p
            className={cn(
              'text-[15px] leading-snug text-zinc-900 dark:text-zinc-100',
              (hecho || t.estado === 'descartado') && 'text-zinc-500 line-through dark:text-zinc-400',
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
            className="field-sizing-content h-10 cursor-pointer appearance-none rounded-md bg-zinc-100 px-2 font-medium text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="">General</option>
            {MODULOS_FALLO.map((m) => (
              <option key={m} value={m}>
                {etiquetaModulo(m)}
              </option>
            ))}
          </select>
          {t.ruta && <code className="text-xs text-zinc-500 dark:text-zinc-400">{t.ruta}</code>}
          <span>
            {t.createdByNombre ?? t.createdBy} · {fechaCorta(t.createdAt)}
          </span>
        </p>
      </div>
      {/* Editar y borrar se ven siempre (en el iPad no hay ratón), aunque más tenues */}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <EstadoSelect estado={t.estado} onChange={(estado) => onCambiar({ estado })} className="mr-1" />
        <BotonCopiar texto={() => promptTarea(t)} compacto />
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditando(true)} aria-label="Editar">
          <Pencil aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onBorrar}
          aria-label="Borrar"
          className="hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300"
        >
          <Trash2 aria-hidden />
        </Button>
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
    <Tarjeta as="article" className="overflow-hidden">
      <div className="flex items-start gap-2 p-4 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setPlegado((p) => !p)}
          aria-label={plegado ? 'Desplegar' : 'Plegar'}
          aria-expanded={!plegado}
          className="-mt-1 -ml-2"
        >
          <ChevronDown aria-hidden className={cn('transition-transform', plegado && '-rotate-90')} />
        </Button>
        <div className="min-w-0 flex-1">
          {editando ? (
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              aria-label="Nombre del módulo"
              className="font-semibold"
            />
          ) : (
            <h2 className="text-lg leading-snug font-semibold text-zinc-900 dark:text-zinc-100">{t.titulo}</h2>
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
      </div>

      {total > 0 && (
        <div className="mx-4 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(hechos / total) * 100}%` }} />
        </div>
      )}

      {!plegado && (
        <div className="space-y-4 p-4 pt-3">
          {editando ? (
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={8}
              autoFocus
              aria-label="Definición funcional"
              placeholder="Definición funcional: qué resuelve, quién lo usa, cómo funciona…"
            />
          ) : t.descripcion ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {t.descripcion}
            </p>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)} className="-ml-3.5 font-normal">
              Sin descripción todavía. Añadir…
            </Button>
          )}

          <div>
            {total > 0 && (
              <ul className="space-y-1">
                {t.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <button
                      type="button"
                      onClick={() => {
                        haptic.tap();
                        cambiarLista(t.checklist.map((i) => (i.id === item.id ? { ...i, hecho: !i.hecho } : i)));
                      }}
                      aria-label={item.hecho ? 'Desmarcar' : 'Marcar'}
                      aria-pressed={item.hecho}
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-md border transition-colors',
                          item.hecho
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-zinc-300 text-transparent hover:border-emerald-600 dark:border-zinc-600',
                        )}
                      >
                        <Check aria-hidden className="size-3" />
                      </span>
                    </button>
                    <span
                      className={cn(
                        'flex-1 text-sm text-zinc-800 dark:text-zinc-200',
                        item.hecho && 'text-zinc-500 line-through dark:text-zinc-400',
                      )}
                    >
                      {item.texto}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => cambiarLista(t.checklist.filter((i) => i.id !== item.id))}
                      aria-label={`Quitar «${item.texto}»`}
                      className="text-zinc-400 hover:text-red-700 dark:text-zinc-500 dark:hover:text-red-300"
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={anadirItem} className="mt-2">
              <Input
                value={nuevoItem}
                onChange={(e) => setNuevoItem(e.target.value)}
                placeholder="+ Añadir a la lista…"
                aria-label="Añadir a la lista"
                className="border-dashed"
              />
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <BotonCopiar texto={() => promptTarea(t)} etiqueta="Copiar definición para Claude" />
            {editando ? (
              <Button type="button" size="sm" onClick={guardarTexto}>
                <Check aria-hidden /> Guardar
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
                <Pencil aria-hidden /> Editar
              </Button>
            )}
            <Button type="button" variant="destructive" size="sm" onClick={onBorrar} className="ml-auto">
              <Trash2 aria-hidden /> Borrar
            </Button>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
