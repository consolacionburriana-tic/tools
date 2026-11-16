'use client';

// Robótica (el material de pensamiento computacional): el pedido, lo que va llegando y cada kit con
// su número. Cuando llega material se pulsa «Ha llegado» y se numera solo a continuación (L5, L6…);
// cada kit lleva dónde está, cómo está, sus notas y sus arreglos («le falta una pieza»). Cada
// material tiene sus recursos didácticos: la guía, las sesiones, el curso.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, ExternalLink, PackageCheck, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import {
  CATEGORIAS_ROB,
  CATEGORIA_ROB_LABEL,
  ESTADOS_KIT,
  ESTADO_KIT_LABEL,
  ESTADO_KIT_TONO,
  ESTADO_PEDIDO_LABEL,
  estadoPedido,
  normalizar,
  prefijoSugerido,
  siguientesCodigos,
  tituloDeUrl,
  type CategoriaRob,
  type EstadoKit,
  type EstadoPedido,
} from '@/lib/inventario';
import type { Inventario, KitRob, ModeloRob } from '@/lib/inventario-server';
import {
  archivarModelo,
  borrarKit,
  borrarRecurso,
  guardarKit,
  guardarModelo,
  guardarRecurso,
  moverKits,
  recibirKits,
} from '@/app/gestion/inventario/acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Selector } from '@/components/ui/selector';
import { Segmentado } from '@/components/ui/segmentado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Estado } from '@/components/ui/estado';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Contador, OpcionesAulas, cuando, etiquetaAula, useAccion, useIndice, type FilaAula } from './comun';
import { ListaArreglos } from './arreglos';

type FiltroRob = 'pedido' | 'falta' | 'incidencias' | 'todo';

const TONO_PEDIDO: Record<EstadoPedido, 'ok' | 'aviso' | 'error' | 'neutro'> = {
  completo: 'ok',
  parcial: 'aviso',
  falta_todo: 'aviso',
  sin_pedir: 'neutro',
};

export function Robotica({ inv, kitInicial }: { inv: Inventario; kitInicial: string | null }) {
  const filas = useIndice(inv);
  const [filtro, setFiltro] = useState<FiltroRob>('pedido');
  const [q, setQ] = useState('');
  const [abiertos, setAbiertos] = useState<Set<string>>(() => {
    const k = kitInicial ? inv.kits.find((x) => x.id === kitInicial) : null;
    return new Set(k ? [k.modeloId] : []);
  });
  const [kitAbierto, setKitAbierto] = useState<string | null>(kitInicial);
  const [recibir, setRecibir] = useState<ModeloRob | null>(null);
  const [editarModelo, setEditarModelo] = useState<ModeloRob | 'nuevo' | null>(null);

  useEffect(() => {
    if (!kitInicial) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('kit');
    window.history.replaceState(null, '', url);
  }, [kitInicial]);

  const kitsDe = useMemo(() => {
    const m = new Map<string, KitRob[]>();
    for (const k of inv.kits) m.set(k.modeloId, [...(m.get(k.modeloId) ?? []), k]);
    return m;
  }, [inv.kits]);
  const arreglosKit = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of inv.arreglos) if (a.kitId && !a.hechoAt) m.set(a.kitId, (m.get(a.kitId) ?? 0) + 1);
    return m;
  }, [inv.arreglos]);
  const aulas = new Map(filas.map((f) => [f.aula.id, f]));

  const recibidas = (m: ModeloRob) => (kitsDe.get(m.id) ?? []).length;
  const conIncidencia = (k: KitRob) => k.estado === 'incompleto' || k.estado === 'averiado' || (arreglosKit.get(k.id) ?? 0) > 0;
  const pedidos = inv.modelos.filter((m) => (m.pedidas ?? 0) > 0 || recibidas(m) > 0);
  const totalPedidas = pedidos.reduce((t, m) => t + (m.pedidas ?? 0), 0);
  const totalRecibidas = pedidos.reduce((t, m) => t + Math.min(recibidas(m), m.pedidas ?? recibidas(m)), 0);
  const faltan = pedidos.filter((m) => (m.pedidas ?? 0) > recibidas(m));
  const kitsConAlgo = inv.kits.filter(conIncidencia);

  const t = normalizar(q.trim());
  const coincide = (m: ModeloRob) =>
    !t ||
    normalizar(`${m.nombre} ${m.codigoArticulo ?? ''} ${CATEGORIA_ROB_LABEL[m.categoria as CategoriaRob] ?? ''}`).includes(t) ||
    (kitsDe.get(m.id) ?? []).some((k) => normalizar(k.codigo) === t || normalizar(k.codigo).startsWith(t));
  const visibles = inv.modelos.filter((m) => {
    if (!coincide(m)) return false;
    if (t) return true; // buscando, se mira todo el catálogo
    if (filtro === 'pedido') return (m.pedidas ?? 0) > 0 || recibidas(m) > 0;
    if (filtro === 'falta') return (m.pedidas ?? 0) > recibidas(m);
    if (filtro === 'incidencias') return (kitsDe.get(m.id) ?? []).some(conIncidencia);
    return true;
  });
  const porCategoria = CATEGORIAS_ROB.map((c) => ({ c, lista: visibles.filter((m) => m.categoria === c) })).filter((g) => g.lista.length);
  const kit = kitAbierto ? inv.kits.find((k) => k.id === kitAbierto) : null;

  const alternar = (id: string) => {
    haptic.tap();
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Robótica</h1>
      <Cifras>
        <Cifra etiqueta="Material pedido" valor={pedidos.length} nota={`${totalPedidas} unidades`} />
        <Cifra
          etiqueta="Ha llegado"
          valor={`${totalRecibidas} de ${totalPedidas}`}
          barra={totalPedidas ? totalRecibidas / totalPedidas : 1}
        />
        <Cifra etiqueta="Falta por llegar" valor={faltan.length} nota={faltan.length ? 'materiales' : 'todo recibido'} tono={faltan.length ? 'aviso' : 'ok'} />
        <Cifra etiqueta="Kits con algo" valor={kitsConAlgo.length} nota="incompletos, averiados o con arreglos" tono={kitsConAlgo.length ? 'aviso' : undefined} />
      </Cifras>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Material, código o kit (L3)…" aria-label="Buscar material o kit" className="pl-9" />
        </div>
        <Filtros etiqueta="Mostrar">
          <Filtro activo={filtro === 'pedido'} onClick={() => setFiltro('pedido')} cuenta={pedidos.length}>
            Pedido
          </Filtro>
          <Filtro activo={filtro === 'falta'} onClick={() => setFiltro('falta')} cuenta={faltan.length} tono="aviso">
            Falta por llegar
          </Filtro>
          <Filtro activo={filtro === 'incidencias'} onClick={() => setFiltro('incidencias')} cuenta={new Set(kitsConAlgo.map((k) => k.modeloId)).size} tono="error">
            Con incidencias
          </Filtro>
          <Filtro activo={filtro === 'todo'} onClick={() => setFiltro('todo')} cuenta={inv.modelos.length}>
            Todo el catálogo
          </Filtro>
        </Filtros>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditarModelo('nuevo')}>
          <Plus aria-hidden /> Añadir material
        </Button>
        <Link href="/gestion/inventario/imprimir?informe=robotica" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Printer aria-hidden /> Imprimir inventario
        </Link>
      </div>

      {porCategoria.length === 0 ? (
        <Vacio icono={<Search />} titulo="Nada con ese filtro" />
      ) : (
        porCategoria.map(({ c, lista }) => (
          <section key={c} className="space-y-2">
            <Rotulo>{CATEGORIA_ROB_LABEL[c]}</Rotulo>
            <Tarjeta>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lista.map((m) => {
                  const kits = kitsDe.get(m.id) ?? [];
                  const est = estadoPedido(m.pedidas, kits.length);
                  const abierto = abiertos.has(m.id) || Boolean(t && kits.some((k) => normalizar(k.codigo).startsWith(t)));
                  const recursos = inv.recursos.filter((r) => r.modeloId === m.id);
                  const conAlgo = kits.filter(conIncidencia).length;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        aria-expanded={abierto}
                        onClick={() => alternar(m.id)}
                        className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-zinc-900 dark:text-zinc-100">{m.nombre}</span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {[m.codigoArticulo && `Art. ${m.codigoArticulo}`, m.prefijo && `Kits ${m.prefijo}1, ${m.prefijo}2…`, recursos.length ? `${recursos.length} recursos` : null]
                              .filter(Boolean)
                              .join(' · ') || ' '}
                          </span>
                        </span>
                        {conAlgo > 0 && <Estado tono="aviso">{conAlgo === 1 ? '1 con algo' : `${conAlgo} con algo`}</Estado>}
                        <span className="hidden w-28 sm:block">
                          {m.pedidas ? (
                            <span className="block text-right text-sm tabular-nums">
                              {kits.length}/{m.pedidas}
                              <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                <span
                                  className={cn('block h-full rounded-full', est === 'completo' ? 'bg-emerald-500' : 'bg-amber-500')}
                                  style={{ width: `${Math.min(100, Math.round((kits.length / m.pedidas) * 100))}%` }}
                                />
                              </span>
                            </span>
                          ) : kits.length ? (
                            <span className="block text-right text-sm tabular-nums">{kits.length} kits</span>
                          ) : null}
                        </span>
                        <Estado tono={TONO_PEDIDO[est]}>{est === 'parcial' ? `Faltan ${(m.pedidas ?? 0) - kits.length}` : ESTADO_PEDIDO_LABEL[est]}</Estado>
                        <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-zinc-500 transition-transform', abierto && 'rotate-180')} />
                      </button>
                      {abierto && (
                        <DetalleModelo
                          m={m}
                          kits={kits}
                          recursos={recursos}
                          aulas={aulas}
                          filas={filas}
                          arreglosKit={arreglosKit}
                          onKit={(id) => {
                            haptic.tap();
                            setKitAbierto(id);
                          }}
                          onRecibir={() => setRecibir(m)}
                          onEditar={() => setEditarModelo(m)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          </section>
        ))
      )}

      {kit && <HojaKit kit={kit} modelo={inv.modelos.find((m) => m.id === kit.modeloId)} inv={inv} filas={filas} onCerrar={() => setKitAbierto(null)} />}
      {recibir && <HojaRecibir modelo={recibir} inv={inv} filas={filas} onCerrar={() => setRecibir(null)} />}
      {editarModelo && <HojaModelo modelo={editarModelo === 'nuevo' ? null : editarModelo} onCerrar={() => setEditarModelo(null)} />}
    </div>
  );
}

function DetalleModelo({
  m,
  kits,
  recursos,
  aulas,
  filas,
  arreglosKit,
  onKit,
  onRecibir,
  onEditar,
}: {
  m: ModeloRob;
  kits: KitRob[];
  recursos: Inventario['recursos'];
  aulas: Map<string, FilaAula>;
  filas: readonly FilaAula[];
  arreglosKit: Map<string, number>;
  onKit: (id: string) => void;
  onRecibir: () => void;
  onEditar: () => void;
}) {
  const { correr, ocupado } = useAccion();
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [mover, setMover] = useState('');
  const faltan = Math.max(0, (m.pedidas ?? 0) - kits.length);

  async function anadirRecurso() {
    const r = await correr(() => guardarRecurso({ modeloId: m.id, titulo, url, notas: null }), 'Recurso añadido');
    if (r !== false) {
      setTitulo('');
      setUrl('');
    }
  }

  return (
    <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/60 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      {m.notas && <p className="text-sm whitespace-pre-line text-zinc-600 dark:text-zinc-400">{m.notas}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={faltan ? 'default' : 'outline'} onClick={onRecibir}>
          <PackageCheck aria-hidden /> Ha llegado{faltan ? ` (faltan ${faltan})` : ''}
        </Button>
        <Button size="sm" variant="ghost" onClick={onEditar}>
          <Pencil aria-hidden /> Editar
        </Button>
      </div>

      {kits.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Kits numerados</p>
          <ul className="flex flex-wrap gap-1.5">
            {kits.map((k) => {
              const n = arreglosKit.get(k.id) ?? 0;
              const aula = k.aulaId ? aulas.get(k.aulaId) : null;
              return (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => onKit(k.id)}
                    className={cn(
                      'flex min-h-11 cursor-pointer flex-col items-start justify-center rounded-xl border bg-white px-3 py-1 text-left outline-none hover:border-zinc-400 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-zinc-900',
                      k.estado === 'baja' ? 'border-dashed border-zinc-300 opacity-60 dark:border-zinc-700' : 'border-zinc-200 dark:border-zinc-700',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold">{k.codigo}</span>
                      {k.estado !== 'ok' && <Estado tono={ESTADO_KIT_TONO[k.estado as EstadoKit]}>{ESTADO_KIT_LABEL[k.estado as EstadoKit]}</Estado>}
                      {n > 0 && <Estado tono="aviso">{n === 1 ? '1 arreglo' : `${n} arreglos`}</Estado>}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{aula ? etiquetaAula(aula) : 'Sin ubicar'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Selector aria-label="Mover todos los kits a" value={mover} onChange={(e) => setMover(e.target.value)} className="w-auto min-w-56">
              <option value="">Mover todos a…</option>
              <option value="ninguna">Sin ubicar</option>
              <OpcionesAulas filas={filas} />
            </Selector>
            {mover && (
              <Button
                size="sm"
                variant="suave"
                cargando={ocupado}
                onClick={async () => {
                  const r = await correr(
                    () => moverKits(kits.filter((k) => k.estado !== 'baja').map((k) => k.id), mover === 'ninguna' ? null : mover),
                    'Kits movidos',
                  );
                  if (r !== false) setMover('');
                }}
              >
                Mover {kits.filter((k) => k.estado !== 'baja').length}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Todavía no hay kits numerados. Cuando llegue, pulsa «Ha llegado» y se numeran solos.</p>
      )}

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <BookOpen aria-hidden className="size-4 text-zinc-500" /> Recursos didácticos
        </p>
        {recursos.length > 0 && (
          <ul className="space-y-1">
            {recursos.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 font-medium text-blue-700 underline-offset-4 hover:underline dark:text-blue-400">
                    {r.titulo} <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                ) : (
                  <span className="min-h-10 py-2">{r.titulo}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${r.titulo}`}
                  onClick={() => correr(() => borrarRecurso(r.id), 'Recurso quitado')}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input aria-label="Enlace del recurso" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega el enlace (guía, sesiones, curso…)" />
          <Input aria-label="Título del recurso" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={url ? tituloDeUrl(url) : 'Título'} className="sm:max-w-64" />
          <Button variant="suave" onClick={anadirRecurso} cargando={ocupado} disabled={!url.trim() && !titulo.trim()}>
            <Plus aria-hidden /> Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}

function HojaRecibir({ modelo, inv, filas, onCerrar }: { modelo: ModeloRob; inv: Inventario; filas: readonly FilaAula[]; onCerrar: () => void }) {
  const kits = inv.kits.filter((k) => k.modeloId === modelo.id);
  const faltan = Math.max(0, (modelo.pedidas ?? 0) - kits.length);
  // Dónde se dejan: donde están los demás de su modelo; si no hay, Informática si existe.
  const habitual = (() => {
    const c = new Map<string, number>();
    for (const k of kits) if (k.aulaId) c.set(k.aulaId, (c.get(k.aulaId) ?? 0) + 1);
    const [top] = [...c.entries()].sort((a, b) => b[1] - a[1]);
    return top?.[0] ?? filas.find((f) => f.aula.espacioCodigo === 'INFO')?.aula.id ?? '';
  })();
  const [cantidad, setCantidad] = useState<number | null>(faltan || 1);
  const [prefijo, setPrefijo] = useState(modelo.prefijo ?? prefijoSugerido(modelo.nombre));
  const [aulaId, setAulaId] = useState(habitual);
  const { correr, ocupado } = useAccion();
  const codigos = prefijo.trim() && cantidad ? siguientesCodigos(prefijo, inv.kits.map((k) => k.codigo), Math.min(cantidad, 100)) : [];

  async function recibir() {
    const r = await correr(
      () => recibirKits({ modeloId: modelo.id, cantidad: cantidad ?? 0, prefijo, aulaId: aulaId || null }),
      (cods) => `Recibidos: ${(cods ?? []).join(', ')}`,
    );
    if (r !== false) onCerrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogTitle>Ha llegado: {modelo.nombre}</DialogTitle>
        <DialogDescription>
          {modelo.pedidas ? `Pedidas ${modelo.pedidas}, recibidas ${kits.length}.` : 'Sin cantidad pedida apuntada.'} Cada unidad que llega se numera para
          poder seguirla.
        </DialogDescription>
        <div className="space-y-4">
          <Campo etiqueta="Cuántas han llegado">
            <Contador valor={cantidad} onChange={setCantidad} etiqueta="Unidades recibidas" min={1} max={100} vacio={false} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Letra de los kits" id="rec-prefijo" ayuda="La etiqueta que se les pone: L → L1, L2…">
              <Input id="rec-prefijo" value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())} className="font-mono" maxLength={8} />
            </Campo>
            <Campo etiqueta="Dónde se dejan" id="rec-aula">
              <Selector id="rec-aula" value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
                <option value="">Sin ubicar</option>
                <OpcionesAulas filas={filas} />
              </Selector>
            </Campo>
          </div>
          {codigos.length > 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Se numerarán <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{codigos.length > 6 ? `${codigos.slice(0, 3).join(', ')} … ${codigos.at(-1)}` : codigos.join(', ')}</span>
            </p>
          )}
          <Button onClick={recibir} cargando={ocupado} disabled={!codigos.length}>
            <PackageCheck aria-hidden /> Recibir {cantidad ?? 0}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HojaKit({
  kit,
  modelo,
  inv,
  filas,
  onCerrar,
}: {
  kit: KitRob;
  modelo: ModeloRob | undefined;
  inv: Inventario;
  filas: readonly FilaAula[];
  onCerrar: () => void;
}) {
  const [codigo, setCodigo] = useState(kit.codigo);
  const [estado, setEstado] = useState<EstadoKit>(kit.estado as EstadoKit);
  const [aulaId, setAulaId] = useState(kit.aulaId ?? '');
  const [notas, setNotas] = useState(kit.notas ?? '');
  const { correr, ocupado } = useAccion();
  const arreglos = inv.arreglos.filter((a) => a.kitId === kit.id);

  async function guardar() {
    const r = await correr(() => guardarKit({ id: kit.id, codigo, aulaId: aulaId || null, estado, notas }), `${codigo} guardado`);
    if (r !== false) onCerrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>
          <span className="font-mono">{kit.codigo}</span> · {modelo?.nombre}
        </DialogTitle>
        <DialogDescription>
          {kit.recibidoAt ? `Llegó el ${new Date(kit.recibidoAt).toLocaleDateString('es-ES')}` : ''}
          {kit.actualizadoPor ? ` · Último cambio: ${cuando(kit.updatedAt, kit.actualizadoPor)}` : ''}
        </DialogDescription>
        <div className="space-y-4">
          <Campo etiqueta="Cómo está">
            <Segmentado etiqueta="Cómo está" opciones={ESTADOS_KIT.map((e) => ({ valor: e, etiqueta: ESTADO_KIT_LABEL[e] }))} valor={estado} onChange={setEstado} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Campo etiqueta="Código" id="kit-codigo">
              <Input id="kit-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className="font-mono" />
            </Campo>
            <Campo etiqueta="Dónde está" id="kit-aula">
              <Selector id="kit-aula" value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
                <option value="">Sin ubicar</option>
                <OpcionesAulas filas={filas} />
              </Selector>
            </Campo>
          </div>
          <Campo etiqueta="Notas" id="kit-notas" opcional ayuda="Lo que tenga de particular: «pieza azul cambiada», «batería nueva en enero»…">
            <Textarea id="kit-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </Campo>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={guardar} cargando={ocupado} disabled={!codigo.trim()}>
              Guardar {codigo}
            </Button>
            <ConfirmarEnLinea
              etiqueta="Borrar"
              icono={<Trash2 aria-hidden />}
              pregunta="¿Borrarlo? Solo si se numeró por error; si se ha roto, márcalo «De baja»."
              onConfirmar={async () => {
                const r = await correr(() => borrarKit(kit.id), `${kit.codigo} borrado`);
                if (r !== false) onCerrar();
              }}
            />
          </div>
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Arreglos de este kit</p>
            <ListaArreglos arreglos={arreglos} kitId={kit.id} aulaId={null} areaPorDefecto="robotica" filas={filas} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HojaModelo({ modelo, onCerrar }: { modelo: ModeloRob | null; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(modelo?.nombre ?? '');
  const [codigoArticulo, setCodigoArticulo] = useState(modelo?.codigoArticulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaRob>((modelo?.categoria as CategoriaRob) ?? 'robot');
  const [pedidas, setPedidas] = useState<number | null>(modelo?.pedidas ?? null);
  const [prefijo, setPrefijo] = useState(modelo?.prefijo ?? '');
  const [notas, setNotas] = useState(modelo?.notas ?? '');
  const { correr, ocupado } = useAccion();

  async function guardar() {
    const r = await correr(
      () => guardarModelo({ id: modelo?.id, nombre, codigoArticulo, categoria, pedidas, prefijo, notas }),
      modelo ? 'Material guardado' : 'Material añadido',
    );
    if (r !== false) onCerrar();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogTitle>{modelo ? 'Editar material' : 'Añadir material'}</DialogTitle>
        <DialogDescription>Un artículo del pedido. Las unidades que llegan se numeran desde «Ha llegado».</DialogDescription>
        <div className="space-y-4">
          <Campo etiqueta="Nombre" id="mod-nombre">
            <Input id="mod-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Código de artículo" id="mod-cod" opcional>
              <Input id="mod-cod" value={codigoArticulo} onChange={(e) => setCodigoArticulo(e.target.value)} />
            </Campo>
            <Campo etiqueta="Tipo" id="mod-cat">
              <Selector id="mod-cat" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaRob)}>
                {CATEGORIAS_ROB.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_ROB_LABEL[c]}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
          <div className="flex flex-wrap gap-6">
            <Campo etiqueta="Unidades pedidas" ayuda="Vacío = no se ha pedido">
              <Contador valor={pedidas} onChange={setPedidas} etiqueta="Unidades pedidas" />
            </Campo>
            <Campo etiqueta="Letra de los kits" id="mod-pref" opcional>
              <Input id="mod-pref" value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())} placeholder={prefijoSugerido(nombre || 'K')} className="w-28 font-mono" maxLength={8} />
            </Campo>
          </div>
          <Campo etiqueta="Notas" id="mod-notas" opcional ayuda="Lo del pedido: «el proveedor dice que llega en enero»…">
            <Textarea id="mod-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </Campo>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={guardar} cargando={ocupado} disabled={!nombre.trim()}>
              {modelo ? 'Guardar' : 'Añadir'}
            </Button>
            {modelo && (
              <ConfirmarEnLinea
                etiqueta="Quitar del catálogo"
                icono={<Trash2 aria-hidden />}
                pregunta="¿Quitarlo? Solo se puede si no tiene kits numerados."
                confirmar="Sí, quitar"
                onConfirmar={async () => {
                  const r = await correr(() => archivarModelo(modelo.id), 'Material quitado');
                  if (r !== false) onCerrar();
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
