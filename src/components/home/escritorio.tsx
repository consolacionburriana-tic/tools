'use client';

// El escritorio de /gestion (ficha: docs/03-escritorio-admin.md). Pensado primero para el iPad en
// horizontal, que es como se usa casi siempre: saludo con las cifras, lo que pide atención hoy,
// «Tu día» en grande y el resto de herramientas en grupos, a tres columnas. En el móvil todo va
// en una; en el iPad en vertical, a dos. El buscador encuentra cualquier herramienta («/» o ⌘K).
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronRight, Cpu, Hand, School, Search, Send, Settings2, Sparkles, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { BIENVENIDA_ID } from '@/lib/bienvenida';
import {
  buscarHerramientas,
  GRUPO_TITULO,
  GRUPOS,
  type Grupo,
  type Herramienta,
  type IconoHerramienta,
  type TonoAviso,
} from '@/lib/escritorio';
import { NavPending } from '@/components/ui/nav-pending';
import { ACENTO_GRUPO, ICONOS_MODULO } from '@/components/ui/icono-modulo';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { FiestaDePantalla } from '@/components/ui/estallido';

export interface Cifra {
  /** Lo que va antes del número, si lo hay («Educamos al»). */
  prefijo?: string;
  valor: string;
  etiqueta: string;
}

export interface Aviso {
  clave: string;
  titulo: string;
  texto: string;
  href: string;
  tono: TonoAviso;
  icono: IconoHerramienta;
}

/** La bienvenida de la primera vez: la frase con guasa y la cookie que recuerda que ya se vio. */
export interface Bienvenida {
  frase: string;
  cookie: string;
}

/** Lo de «Solicitar acceso»: qué módulos ya se han pedido y cómo se pide uno. */
const Solicitudes = createContext<{
  pedidas: readonly string[];
  enviando: string | null;
  solicitar: (h: Herramienta) => void;
}>({ pedidas: [], enviando: null, solicitar: () => {} });

const ICONO_GRUPO: Record<Exclude<Grupo, 'dia'>, LucideIcon> = {
  alumnado: Users,
  familias: Wallet,
  centro: School,
  tic: Cpu,
  config: Settings2,
};

/** Las insignias de las herramientas son estados: azul informa, ámbar pide algo, rojo urge. */
const TONO_BADGE: Record<TonoAviso, TonoEstado> = { azul: 'info', ambar: 'aviso', rojo: 'error' };

const TONO_AVISO: Record<TonoAviso, { tarjeta: string; icono: string }> = {
  azul: {
    tarjeta: 'border-blue-200 bg-blue-50/70 hover:bg-blue-50 dark:border-blue-900/70 dark:bg-blue-500/10 dark:hover:bg-blue-500/15',
    icono: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  },
  ambar: {
    tarjeta: 'border-amber-200 bg-amber-50/70 hover:bg-amber-50 dark:border-amber-900/70 dark:bg-amber-500/10 dark:hover:bg-amber-500/15',
    icono: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  rojo: {
    tarjeta: 'border-red-200 bg-red-50/70 hover:bg-red-50 dark:border-red-900/70 dark:bg-red-500/10 dark:hover:bg-red-500/15',
    icono: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  },
};

export function Escritorio({
  saludo,
  fecha,
  cifras,
  avisos,
  herramientas,
  solicitadas,
  bienvenida,
}: {
  saludo: string;
  fecha: string;
  cifras: Cifra[];
  avisos: Aviso[];
  herramientas: Herramienta[];
  /** Módulos cuyo acceso ya ha pedido esta persona desde este navegador. */
  solicitadas: string[];
  /** Solo la primera vez: la animación de bienvenida. */
  bienvenida: Bienvenida | null;
}) {
  const [consulta, setConsulta] = useState('');
  const [pedidas, setPedidas] = useState<readonly string[]>(solicitadas);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [fiesta, setFiesta] = useState(bienvenida !== null);
  const buscador = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // «/» o ⌘K / Ctrl+K llevan al buscador desde cualquier parte de la pantalla.
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      const escribiendo = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === '/' && !escribiendo) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        buscador.current?.focus();
      }
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  // La bienvenida se cuenta como vista en cuanto sale: recargar no la repite.
  useEffect(() => {
    if (!bienvenida) return;
    try {
      document.cookie = `${bienvenida.cookie}=${BIENVENIDA_ID}; path=/gestion; max-age=31536000; samesite=lax`;
    } catch {
      /* sin cookies, se enseñará otra vez: no pasa nada */
    }
  }, [bienvenida]);

  async function solicitar(h: Herramienta) {
    if (enviando || pedidas.includes(h.clave)) return;
    haptic.tap();
    setEnviando(h.clave);
    try {
      const res = await fetch('/api/acceso/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo: h.clave }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'No se ha podido enviar');
      haptic.success();
      setPedidas((p) => [...p, h.clave]);
      toast.success(`Solicitud enviada: ${h.titulo}`, { description: 'Les ha llegado a los SuperTIC; te dirán algo pronto.' });
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido enviar');
    } finally {
      setEnviando(null);
    }
  }

  const resultados = useMemo(() => (consulta.trim() ? buscarHerramientas(herramientas, consulta) : null), [herramientas, consulta]);
  // Intro abre la primera que se pueda abrir: las grises no llevan a ningún sitio.
  const primeraAbrible = resultados?.find((h) => !h.bloqueo);
  const dia = herramientas.filter((h) => h.grupo === 'dia');
  const grupos = GRUPOS.filter((g): g is Exclude<Grupo, 'dia'> => g !== 'dia')
    .map((g) => ({ grupo: g, lista: herramientas.filter((h) => h.grupo === g) }))
    .filter((x) => x.lista.length > 0);

  return (
    <Solicitudes.Provider value={{ pedidas, enviando, solicitar }}>
    <main className={cn('mx-auto w-full max-w-7xl space-y-8 px-4 pt-6 pb-20 sm:px-6 lg:pt-8', bienvenida && 'bienvenida')}>
      {bienvenida && fiesta && <FiestaDePantalla onFin={() => setFiesta(false)} />}
      {/* ── Saludo, cifras y buscador ─────────────────────────────────── */}
      <section className="anim-up flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500 first-letter:uppercase dark:text-zinc-400">{fecha}</p>
          {bienvenida ? (
            <SaludoDeBienvenida saludo={saludo} frase={bienvenida.frase} />
          ) : (
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-100">{saludo}</h1>
          )}
          {cifras.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {cifras.map((c) => (
                <li key={`${c.prefijo ?? ''}${c.etiqueta}`}>
                  {c.prefijo ? `${c.prefijo} ` : null}
                  <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{c.valor}</span>
                  {c.etiqueta ? ` ${c.etiqueta}` : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
          <Input
            ref={buscador}
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && primeraAbrible) router.push(primeraAbrible.href);
              if (e.key === 'Escape') setConsulta('');
            }}
            placeholder="Buscar herramienta"
            aria-label="Buscar herramienta"
            className="h-12 rounded-2xl pr-12 pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {consulta ? (
            <button
              type="button"
              onClick={() => {
                setConsulta('');
                buscador.current?.focus();
              }}
              aria-label="Borrar la búsqueda"
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl text-zinc-500 outline-none hover:bg-zinc-100 hover:text-zinc-800 focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-zinc-200 px-1.5 font-mono text-xs text-zinc-500 lg:block dark:border-zinc-700 dark:text-zinc-400">
              /
            </kbd>
          )}
        </div>
      </section>

      {resultados ? (
        <Resultados resultados={resultados} consulta={consulta} />
      ) : (
        <>
          {/* ── Lo que pide atención hoy ──────────────────────────────── */}
          {avisos.length > 0 && (
            <section aria-labelledby="ahora" className="space-y-3">
              <Rotulo id="ahora">Ahora</Rotulo>
              <div className="anim-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {avisos.map((a) => (
                  <AvisoTarjeta key={a.clave} aviso={a} />
                ))}
              </div>
            </section>
          )}

          {/* ── Tu día: lo de cada uno, en grande ──────────────────────── */}
          {dia.length > 0 && (
            <section aria-labelledby="dia" className="space-y-3">
              <Rotulo id="dia">{GRUPO_TITULO.dia}</Rotulo>
              <div className="anim-stagger grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {dia.map((h) => (
                  <Tesela key={h.clave} h={h} />
                ))}
              </div>
            </section>
          )}

          {/* ── El resto, por grupos ─────────────────────────────────────── */}
          {grupos.length > 0 && (
            <div className="anim-stagger columns-1 gap-4 md:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {grupos.map(({ grupo, lista }) => (
                <GrupoPanel key={grupo} grupo={grupo} lista={lista} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
    </Solicitudes.Provider>
  );
}

/**
 * El saludo la primera vez: cada palabra cae con su muelle, la mano saluda y, debajo, una frase
 * con guasa. Con «reducir movimiento» sale quieto. Es el `h1` de siempre, solo que animado.
 */
function SaludoDeBienvenida({ saludo, frase }: { saludo: string; frase: string }) {
  const quieto = useReducedMotion();
  const palabras = saludo.split(' ');
  return (
    <>
      <h1 className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
        <span aria-label={saludo} className="flex flex-wrap gap-x-2.5">
          {palabras.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={quieto ? false : { opacity: 0, y: 36, rotate: -7, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.16, type: 'spring', stiffness: 280, damping: 13 }}
              className="inline-block origin-bottom-left"
            >
              {p}
            </motion.span>
          ))}
        </span>
        <motion.span
          aria-hidden
          initial={quieto ? false : { opacity: 0, scale: 0.3 }}
          animate={quieto ? undefined : { opacity: 1, scale: 1, rotate: [0, 16, -10, 16, -6, 12, 0] }}
          transition={{
            opacity: { delay: 0.25 + palabras.length * 0.16 },
            scale: { delay: 0.25 + palabras.length * 0.16, type: 'spring', stiffness: 300, damping: 12 },
            rotate: { delay: 0.5 + palabras.length * 0.16, duration: 1.4, repeat: 1, repeatDelay: 0.6 },
          }}
          style={{ transformOrigin: '70% 80%' }}
          className="inline-flex text-blue-600 dark:text-blue-400"
        >
          <Hand className="size-7 sm:size-9" />
        </motion.span>
      </h1>
      <motion.p
        initial={quieto ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 + palabras.length * 0.16, duration: 0.5 }}
        className="mt-2 flex max-w-xl items-start gap-2 text-base text-zinc-700 dark:text-zinc-300"
      >
        <Sparkles aria-hidden className="mt-1 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
        {frase}
      </motion.p>
    </>
  );
}

function Insignia({ badge }: { badge: Herramienta['badge'] }) {
  if (!badge) return null;
  return <Estado tono={TONO_BADGE[badge.tono]}>{badge.texto}</Estado>;
}

function AvisoTarjeta({ aviso }: { aviso: Aviso }) {
  const Icono = ICONOS_MODULO[aviso.icono];
  const tono = TONO_AVISO[aviso.tono];
  return (
    <Link href={aviso.href} className={cn('group flex items-center gap-3 rounded-2xl border p-4 transition-colors', tono.tarjeta)}>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tono.icono)}>
        <Icono className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{aviso.titulo}</span>
        <span className="block text-sm text-zinc-600 dark:text-zinc-300">{aviso.texto}</span>
      </span>
      <NavPending />
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 dark:text-zinc-400" />
    </Link>
  );
}

/** Las de «Tu día»: grandes, para tocarlas sin apuntar. */
function Tesela({ h }: { h: Herramienta }) {
  const Icono = ICONOS_MODULO[h.icono];
  return (
    <Link
      href={h.href}
      className={cn(
        claseTarjeta,
        'group relative flex min-h-32 flex-col gap-3 p-4 transition-colors hover:border-zinc-300 active:bg-zinc-50 dark:hover:border-zinc-700 dark:active:bg-zinc-800/60',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', ACENTO_GRUPO[h.grupo])}>
          <Icono className="h-5.5 w-5.5" />
        </span>
        <Insignia badge={h.badge} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
          {h.titulo}
          <NavPending />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-zinc-500 dark:text-zinc-400">{h.desc}</span>
      </span>
    </Link>
  );
}

const ICONO_GRIS = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';

/**
 * Una herramienta en gris: o «Próximamente» (no se toca) o «Solicitar acceso» (un toque avisa a
 * los SuperTIC). La explicación se ve siempre, no solo en un `title`: en el iPad no hay ratón.
 */
function FilaGris({ h, conGrupo }: { h: Herramienta; conGrupo: boolean }) {
  const { pedidas, enviando, solicitar: pedir } = useContext(Solicitudes);
  const Icono = ICONOS_MODULO[h.icono];
  const pedida = pedidas.includes(h.clave);
  const cuerpo = (
    <>
      <span className={ICONO_GRIS}>
        <Icono className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">{h.titulo}</span>
          {h.bloqueo === 'proximamente' && <Estado tono="neutro">Próximamente</Estado>}
        </span>
        <span className="block text-sm leading-snug text-zinc-500 dark:text-zinc-400">
          {conGrupo ? `${GRUPO_TITULO[h.grupo]} · ${h.desc}` : h.desc}
        </span>
        {/* El botón va debajo del texto: la frase es larga y a su lado se quedaba en una columna de palabras sueltas. */}
        {h.bloqueo === 'solicitar' &&
          (pedida ? (
            <Estado tono="ok" icono={<Check aria-hidden />} className="mt-1.5">
              Solicitud enviada
            </Estado>
          ) : (
            <span className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              <Send aria-hidden className="size-3" />
              {enviando === h.clave ? 'Enviando…' : 'Solicitar acceso'}
            </span>
          ))}
      </span>
    </>
  );

  if (h.bloqueo === 'proximamente') {
    return (
      <div aria-disabled="true" title="Próximamente" className="flex min-h-16 cursor-default items-center gap-3 px-4 py-3">
        {cuerpo}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => pedir(h)}
      disabled={pedida || enviando === h.clave}
      title={h.desc}
      className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800/60"
    >
      {cuerpo}
    </button>
  );
}

function Fila({ h, conGrupo = false }: { h: Herramienta; conGrupo?: boolean }) {
  if (h.bloqueo) return <FilaGris h={h} conGrupo={conGrupo} />;
  const Icono = ICONOS_MODULO[h.icono];
  return (
    <Link
      href={h.href}
      className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 active:bg-blue-50/60 dark:hover:bg-zinc-800/60 dark:active:bg-blue-500/10"
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ACENTO_GRUPO[h.grupo])}>
        <Icono className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{h.titulo}</span>
          <Insignia badge={h.badge} />
        </span>
        <span className="line-clamp-2 block text-sm leading-snug text-zinc-500 dark:text-zinc-400">
          {conGrupo ? `${GRUPO_TITULO[h.grupo]} · ${h.desc}` : h.desc}
        </span>
      </span>
      <NavPending />
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500" />
    </Link>
  );
}

function GrupoPanel({ grupo, lista }: { grupo: Exclude<Grupo, 'dia'>; lista: Herramienta[] }) {
  const Icono = ICONO_GRUPO[grupo];
  return (
    <section
      aria-labelledby={`grupo-${grupo}`}
      className={cn(claseTarjeta, 'overflow-hidden')}
    >
      <h2
        id={`grupo-${grupo}`}
        className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
      >
        <span aria-hidden className={cn('flex size-6 items-center justify-center rounded-md', ACENTO_GRUPO[grupo])}>
          <Icono className="h-3.5 w-3.5" />
        </span>
        {GRUPO_TITULO[grupo]}
      </h2>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {lista.map((h) => (
          <li key={h.clave}>
            <Fila h={h} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resultados({ resultados, consulta }: { resultados: Herramienta[]; consulta: string }) {
  if (resultados.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Ninguna herramienta casa con «{consulta.trim()}».
      </p>
    );
  }
  return (
    <section aria-label="Resultados de la búsqueda" className="space-y-3">
      <Rotulo id="resultados">
        {resultados.length} {resultados.length === 1 ? 'herramienta' : 'herramientas'}
        {resultados[0] && !resultados[0].bloqueo ? ' · Intro abre la primera' : ''}
      </Rotulo>
      <ul className={cn(claseTarjeta, 'grid gap-x-4 overflow-hidden md:grid-cols-2')}>
        {resultados.map((h) => (
          <li key={h.clave} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
            <Fila h={h} conGrupo />
          </li>
        ))}
      </ul>
    </section>
  );
}
