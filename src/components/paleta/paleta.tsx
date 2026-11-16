'use client';

// La paleta de ⌘K (Ctrl+K), en todo /gestion (docs/34-paleta-y-tareas-por-correo.md): ir a
// cualquier herramienta, tablero, aula o alumno, y crear una tarea en una línea
// («t proyector 3ºB @amparo viernes !alta #mant»). En el iPad sin teclado se abre con la lupa de la
// barra de arriba (`BotonPaleta`, que lanza el evento `abrir-paleta`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { CalendarClock, DoorOpen, Flag, GraduationCap, KanbanSquare, Loader2, Plus, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { buscarHerramientas, type Grupo, type Herramienta, type IconoHerramienta } from '@/lib/escritorio';
import { elegirPersona, elegirTablero, esTareaRapida, interpretarTarea, normalizar } from '@/lib/paleta';
import { PRIORIDAD_LABELS } from '@/lib/tableros';
import type { DestinoTarea } from '@/lib/tareas-rapidas-server';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { IconoModulo } from '@/components/ui/icono-modulo';
import { Estado } from '@/components/ui/estado';
import { avisarPaletaLista } from './boton';

export const EVENTO_ABRIR_PALETA = 'abrir-paleta';

interface HerramientaPaleta {
  clave: string;
  titulo: string;
  desc: string;
  href: string;
  icono: IconoHerramienta;
  grupo: Grupo;
  palabras: string[];
}
interface AulaPaleta {
  id: string;
  titulo: string;
  detalle: string;
  numero: string | null;
}
interface Datos {
  herramientas: HerramientaPaleta[];
  tableros: DestinoTarea[];
  aulas: AulaPaleta[];
  alumnado: boolean;
  /** A dónde se reenvía un correo para que sea tarea (`tic+tarea@…`). */
  correoTareas: string | null;
}
interface AlumnoPaleta {
  id: string;
  nombre: string;
  clase: string;
}

function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function fechaCorta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

const ITEM =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-800 outline-none data-[selected=true]:bg-zinc-100 dark:text-zinc-200 dark:data-[selected=true]:bg-zinc-800';
const GRUPO =
  'px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase';

export function Paleta() {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [respuesta, setRespuesta] = useState<{ q: string; alumnos: AlumnoPaleta[] }>({ q: '', alumnos: [] });
  const [creando, setCreando] = useState(false);
  const pedidos = useRef(0);

  const abrir = useCallback(() => {
    haptic.tap();
    setAbierta(true);
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierta((a) => !a);
      }
    };
    window.addEventListener('keydown', tecla);
    window.addEventListener(EVENTO_ABRIR_PALETA, abrir);
    avisarPaletaLista(true);
    return () => {
      avisarPaletaLista(false);
      window.removeEventListener('keydown', tecla);
      window.removeEventListener(EVENTO_ABRIR_PALETA, abrir);
    };
  }, [abrir]);

  // Lo que se puede abrir se pide la primera vez que se abre (y se refresca cada vez que se vuelve a abrir).
  useEffect(() => {
    if (!abierta) return;
    fetch('/api/paleta')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Datos | null) => d && setDatos(d))
      .catch(() => undefined);
  }, [abierta]);

  const tarea = esTareaRapida(q);

  // Alumnos: en el servidor (solo los de su alcance), con una pausa para no preguntar a cada letra.
  // El resultado se guarda con la búsqueda a la que responde: si ya no es la de ahora, no se pinta.
  const consulta = q.trim();
  const buscaAlumnos = abierta && !tarea && Boolean(datos?.alumnado) && consulta.length >= 3;
  useEffect(() => {
    if (!buscaAlumnos) return;
    const n = ++pedidos.current;
    const temporizador = setTimeout(() => {
      fetch(`/api/paleta?q=${encodeURIComponent(consulta)}`)
        .then((r) => (r.ok ? r.json() : { alumnos: [] }))
        .then((d: { alumnos: AlumnoPaleta[] }) => n === pedidos.current && setRespuesta({ q: consulta, alumnos: d.alumnos }))
        .catch(() => n === pedidos.current && setRespuesta({ q: consulta, alumnos: [] }));
    }, 220);
    return () => clearTimeout(temporizador);
  }, [consulta, buscaAlumnos]);
  const alumnos = buscaAlumnos && respuesta.q === consulta ? respuesta.alumnos : [];
  const buscando = buscaAlumnos && respuesta.q !== consulta;

  const herramientas = useMemo(
    () => (datos ? buscarHerramientas(datos.herramientas.map((h) => ({ ...h, badge: null, bloqueo: null }) as Herramienta), tarea ? '' : q) : []),
    [datos, q, tarea],
  );
  const t = normalizar(q);
  const tableros = (datos?.tableros ?? []).filter((b) => !t || normalizar(`${b.nombre} ${b.equipo}`).includes(t));
  const numero = t.replace(/^aula\s*/, '');
  const aulas = (datos?.aulas ?? []).filter(
    (a) => t && (a.numero === numero || normalizar(`${a.titulo} ${a.detalle}`).includes(t)),
  );

  // La tarea rápida: a qué tablero va, a quién y cuándo.
  const plan = useMemo(() => {
    if (!tarea || !datos) return null;
    const r = interpretarTarea(q, hoyLocal());
    const destino = elegirTablero(datos.tableros, r.tablero);
    const personas = destino ? r.menciones.map((m) => ({ pista: m, persona: elegirPersona(destino.miembros, m) })) : [];
    return { ...r, destino, personas };
  }, [tarea, datos, q]);

  function ir(href: string) {
    haptic.tap();
    setAbierta(false);
    setQ('');
    router.push(href);
  }

  async function crear() {
    if (!plan?.destino || !plan.titulo || creando) return;
    setCreando(true);
    try {
      const res = await fetch('/api/paleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableroId: plan.destino.id,
          titulo: plan.titulo,
          responsables: plan.personas.flatMap((p) => (p.persona ? [p.persona.email] : [])),
          prioridad: plan.prioridad,
          vence: plan.vence,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'No se ha podido crear');
      haptic.success();
      const destino = plan.destino;
      toast.success(`Tarea apuntada en ${destino.nombre}`, {
        action: { label: 'Abrir', onClick: () => router.push(`/gestion/tableros/${destino.id}`) },
      });
      setQ('');
      setAbierta(false);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido crear');
    } finally {
      setCreando(false);
    }
  }

  return (
    <Dialog
      open={abierta}
      onOpenChange={(o) => {
        setAbierta(o);
        if (!o) setQ('');
      }}
    >
      <DialogContent showCloseButton={false} className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Ir a o crear</DialogTitle>
        <DialogDescription className="sr-only">Busca una herramienta, un tablero, un aula o un alumno, o escribe «t» y la tarea para apuntarla.</DialogDescription>
        <Command shouldFilter={false} loop label="Ir a o crear" className="flex max-h-[min(70dvh,560px)] flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 dark:border-zinc-800">
            {tarea ? <Plus aria-hidden className="size-5 text-blue-600" /> : <Search aria-hidden className="size-5 text-zinc-500" />}
            <Command.Input
              value={q}
              onValueChange={setQ}
              autoFocus
              placeholder="Ir a…  ·  t tarea @persona viernes !alta"
              className="h-14 w-full bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            />
            {(buscando || creando) && <Loader2 aria-hidden className="size-4 animate-spin text-zinc-500" />}
            <kbd className="hidden rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono text-xs text-zinc-500 sm:block dark:border-zinc-700">esc</kbd>
          </div>
          <Command.List className="overflow-y-auto overscroll-contain p-1">
            {!datos && (
              <Command.Loading>
                <p className="px-3 py-6 text-center text-sm text-zinc-500">Cargando…</p>
              </Command.Loading>
            )}

            {tarea && plan && (
              <Command.Group heading="Nueva tarea" className={GRUPO}>
                {!plan.destino ? (
                  <p className="px-3 py-3 text-sm text-zinc-500">
                    {datos?.tableros.length ? `Ningún tablero empieza por «${plan.tablero}».` : 'No estás en ningún equipo con tableros.'}
                  </p>
                ) : (
                  <Command.Item value="crear-tarea" onSelect={crear} disabled={!plan.titulo} className={cn(ITEM, 'items-start py-3')}>
                    <KanbanSquare aria-hidden className="mt-0.5 size-5 shrink-0 text-blue-600" />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{plan.titulo || 'Escribe qué hay que hacer…'}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <span>
                          en {plan.destino.emoji ? `${plan.destino.emoji} ` : ''}
                          <b className="font-semibold">{plan.destino.nombre}</b>
                        </span>
                        {plan.personas.map((p) =>
                          p.persona ? (
                            <Estado key={p.pista} tono="info" icono={<User />}>
                              {p.persona.nombre ?? p.persona.email}
                            </Estado>
                          ) : (
                            <Estado key={p.pista} tono="aviso" icono={<User />}>
                              @{p.pista}: no está en el equipo
                            </Estado>
                          ),
                        )}
                        {plan.vence && (
                          <Estado tono="neutro" icono={<CalendarClock />}>
                            {fechaCorta(plan.vence)}
                          </Estado>
                        )}
                        {plan.prioridad && (
                          <Estado tono={plan.prioridad === 'urgente' ? 'error' : plan.prioridad === 'alta' ? 'aviso' : 'neutro'} icono={<Flag />}>
                            {PRIORIDAD_LABELS[plan.prioridad]}
                          </Estado>
                        )}
                      </span>
                    </span>
                    <kbd className="hidden shrink-0 rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono text-xs text-zinc-500 sm:block dark:border-zinc-700">↵</kbd>
                  </Command.Item>
                )}
                {plan.destino && datos && datos.tableros.length > 1 && (
                  <p className="px-3 pb-2 text-xs text-zinc-500">
                    Otro tablero con <span className="font-mono">#</span>: {datos.tableros.map((b) => b.nombre).join(' · ')}
                  </p>
                )}
              </Command.Group>
            )}

            {!tarea && datos && (
              <>
                {herramientas.length > 0 && (
                  <Command.Group heading="Ir a" className={GRUPO}>
                    {herramientas.slice(0, q ? 6 : 30).map((h) => (
                      <Command.Item key={h.clave} value={`h-${h.clave}`} onSelect={() => ir(h.href)} className={ITEM}>
                        <IconoModulo icono={h.icono} grupo={h.grupo} tamano="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{h.titulo}</span>
                          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{h.desc}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {q && tableros.length > 0 && (
                  <Command.Group heading="Tableros" className={GRUPO}>
                    {tableros.slice(0, 6).map((b) => (
                      <Command.Item key={b.id} value={`t-${b.id}`} onSelect={() => ir(`/gestion/tableros/${b.id}`)} className={ITEM}>
                        <KanbanSquare aria-hidden className="size-5 text-zinc-500" />
                        <span className="min-w-0 flex-1 truncate">
                          {b.emoji ? `${b.emoji} ` : ''}
                          {b.nombre} <span className="text-xs text-zinc-500">· {b.equipo}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {aulas.length > 0 && (
                  <Command.Group heading="Aulas y espacios" className={GRUPO}>
                    {aulas.slice(0, 6).map((a) => (
                      <Command.Item key={a.id} value={`a-${a.id}`} onSelect={() => ir(`/gestion/inventario/aulas/${a.id}`)} className={ITEM}>
                        <DoorOpen aria-hidden className="size-5 text-zinc-500" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.titulo} <span className="text-xs text-zinc-500">· {a.detalle}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {alumnos.length > 0 && (
                  <Command.Group heading="Alumnado" className={GRUPO}>
                    {alumnos.map((a) => (
                      <Command.Item key={a.id} value={`al-${a.id}`} onSelect={() => ir(`/gestion/alumnado?alumno=${a.id}`)} className={ITEM}>
                        <GraduationCap aria-hidden className="size-5 text-zinc-500" />
                        <span className="min-w-0 flex-1 truncate">
                          {a.nombre} <span className="text-xs text-zinc-500">· {a.clase}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {q && !buscando && herramientas.length + tableros.length + aulas.length + alumnos.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-zinc-500">Nada con «{q}».</p>
                )}
              </>
            )}
          </Command.List>
          {datos && datos.tableros.length > 0 && !tarea && (
            <p className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Apunta una tarea: <span className="font-mono text-zinc-700 dark:text-zinc-300">t proyector 3ºB @amparo viernes !alta #mant</span>
              {datos.correoTareas && (
                <>
                  {' '}
                  · o reenvía un correo a <span className="font-mono text-zinc-700 dark:text-zinc-300">{datos.correoTareas}</span>
                </>
              )}
            </p>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
