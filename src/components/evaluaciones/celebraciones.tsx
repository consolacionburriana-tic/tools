'use client';

// Quince finales distintos para el formulario de evaluación. Quien responde no sabe
// cuál le va a tocar, y esa pequeña lotería es justo la gracia: la evaluación deja de
// ser un trámite. Se sortea una al enviar (familias mantiene el check de siempre).
//
// Todas comparten contrato: ocupan un lienzo de altura fija, duran ~2,5 s y por debajo
// va el mensaje final. Si el sistema pide menos animación (`prefers-reduced-motion`),
// cada una degrada a su versión quieta — no a una pantalla en blanco.
import { useMemo } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

export type IdCelebracion =
  | 'check' | 'confeti' | 'fuegos' | 'cohete' | 'globos' | 'estrellas' | 'sello'
  | 'ola' | 'trazo' | 'corazones' | 'trofeo' | 'serpentinas' | 'onda' | 'maquina'
  | 'pompas' | 'arcoiris';

interface Props {
  titulo: string;
}

// ─── Utilidades comunes ───────────────────────────────────────────────────────

/** Lienzo de la animación: alto fijo para que el mensaje de abajo no dé saltos. */
function Escenario({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`relative h-40 w-full overflow-hidden ${className}`}>{children}</div>;
}

function Titular({ children, delay = 0.2 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.p
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 14 }}
      className="absolute inset-x-0 bottom-3 text-center text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50"
    >
      {children}
    </motion.p>
  );
}

/** Piezas con propiedades al azar, estables durante toda la animación. */
function usePiezas<T>(n: number, hacer: (i: number) => T): T[] {
  return useMemo(() => Array.from({ length: n }, (_, i) => hacer(i)), [n]); // eslint-disable-line react-hooks/exhaustive-deps
}

const azar = (min: number, max: number) => min + Math.random() * (max - min);
const elegir = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

// Los colores vienen de la paleta categórica validada del repo (ver dataviz):
// azul, naranja, aqua, amarillo, magenta. Nunca hues generados al vuelo.
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

const MUELLE: Transition = { type: 'spring', stiffness: 220, damping: 14 };

// ─── 1 · El de siempre (familias) ─────────────────────────────────────────────

function Check() {
  const quieto = useReducedMotion();
  return (
    <Escenario className="flex items-center justify-center">
      <motion.div
        initial={quieto ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={MUELLE}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white"
      >
        <CheckCircle2 className="h-9 w-9" />
      </motion.div>
    </Escenario>
  );
}

// ─── 2 · Confeti ──────────────────────────────────────────────────────────────

function Confeti() {
  const quieto = useReducedMotion();
  const piezas = usePiezas(46, () => ({
    x: azar(0, 100),
    color: elegir(COLORES),
    retraso: azar(0, 0.5),
    giro: azar(-540, 540),
    ancho: azar(5, 10),
    alto: azar(8, 15),
    deriva: azar(-40, 40),
  }));
  if (quieto) return <Estatico emoji="🎉" texto="¡Enviado!" />;
  return (
    <Escenario>
      {piezas.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: 190, x: p.deriva, rotate: p.giro, opacity: [1, 1, 0] }}
          transition={{ duration: azar(1.6, 2.4), delay: p.retraso, ease: 'easeIn' }}
          style={{ left: `${p.x}%`, width: p.ancho, height: p.alto, background: p.color, borderRadius: 2 }}
          className="absolute top-0 block"
        />
      ))}
      <Titular>¡Enviado! 🎉</Titular>
    </Escenario>
  );
}

// ─── 3 · Fuegos artificiales ──────────────────────────────────────────────────

function Fuegos() {
  const quieto = useReducedMotion();
  const estallidos = usePiezas(3, (i) => ({
    cx: 22 + i * 28,
    cy: azar(30, 55),
    color: COLORES[i % COLORES.length],
    retraso: i * 0.45,
    chispas: Array.from({ length: 14 }, (_, j) => (j / 14) * Math.PI * 2),
  }));
  if (quieto) return <Estatico emoji="🎆" texto="¡Enviado!" />;
  return (
    <Escenario>
      {estallidos.map((e, i) => (
        <div key={i} className="absolute" style={{ left: `${e.cx}%`, top: `${e.cy}%` }}>
          {e.chispas.map((ang, j) => (
            <motion.span
              key={j}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: Math.cos(ang) * 52, y: Math.sin(ang) * 52, opacity: [0, 1, 0], scale: [0.4, 1, 0.2] }}
              transition={{ duration: 1.1, delay: e.retraso, ease: 'easeOut' }}
              style={{ background: e.color }}
              className="absolute block h-1.5 w-1.5 rounded-full"
            />
          ))}
        </div>
      ))}
      <Titular delay={0.6}>¡Bravo! 🎆</Titular>
    </Escenario>
  );
}

// ─── 4 · Cohete ───────────────────────────────────────────────────────────────

function Cohete() {
  const quieto = useReducedMotion();
  const estela = usePiezas(12, (i) => ({ retraso: 0.1 + i * 0.05 }));
  if (quieto) return <Estatico emoji="🚀" texto="¡Despegamos!" />;
  return (
    <Escenario>
      {estela.map((e, i) => (
        <motion.span
          key={i}
          initial={{ y: 120, opacity: 0.9, scale: 1 }}
          animate={{ y: -20, opacity: 0, scale: 0.3 }}
          transition={{ duration: 1, delay: e.retraso, ease: 'easeOut' }}
          className="absolute left-1/2 block h-3 w-3 -translate-x-1/2 rounded-full bg-amber-400/70"
        />
      ))}
      <motion.span
        initial={{ y: 130, rotate: -12, scale: 0.9 }}
        animate={{ y: -140, rotate: -12, scale: 1.1 }}
        transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
        className="absolute left-1/2 -translate-x-1/2 text-5xl"
      >
        🚀
      </motion.span>
      <Titular delay={1}>¡Despegamos! 🚀</Titular>
    </Escenario>
  );
}

// ─── 5 · Globos ───────────────────────────────────────────────────────────────

function Globos() {
  const quieto = useReducedMotion();
  const globos = usePiezas(9, () => ({
    x: azar(5, 90),
    emoji: elegir(['🎈', '🎈', '🎈', '🎊']),
    retraso: azar(0, 0.7),
    tam: azar(28, 46),
    vaiven: azar(10, 28),
  }));
  if (quieto) return <Estatico emoji="🎈" texto="¡Gracias!" />;
  return (
    <Escenario>
      {globos.map((g, i) => (
        <motion.span
          key={i}
          initial={{ y: 170, opacity: 0 }}
          animate={{ y: -60, opacity: [0, 1, 1, 0], x: [0, g.vaiven, -g.vaiven, 0] }}
          transition={{ duration: azar(2.2, 3), delay: g.retraso, ease: 'easeOut' }}
          style={{ left: `${g.x}%`, fontSize: g.tam }}
          className="absolute block"
        >
          {g.emoji}
        </motion.span>
      ))}
      <Titular delay={0.5}>¡Gracias! 🎈</Titular>
    </Escenario>
  );
}

// ─── 6 · Estrellas que convergen ──────────────────────────────────────────────

function Estrellas() {
  const quieto = useReducedMotion();
  const estrellas = usePiezas(16, (i) => ({ ang: (i / 16) * Math.PI * 2, retraso: i * 0.03 }));
  if (quieto) return <Estatico emoji="⭐" texto="¡Genial!" />;
  return (
    <Escenario className="flex items-center justify-center">
      {estrellas.map((e, i) => (
        <motion.span
          key={i}
          initial={{ x: Math.cos(e.ang) * 130, y: Math.sin(e.ang) * 90, opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ x: 0, y: 0, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.2], rotate: 240 }}
          transition={{ duration: 1.3, delay: e.retraso, ease: 'easeIn' }}
          className="absolute block text-xl"
        >
          ⭐
        </motion.span>
      ))}
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.3, 1], opacity: 1 }}
        transition={{ delay: 1.2, ...MUELLE }}
        className="text-5xl"
      >
        🌟
      </motion.span>
      <Titular delay={1.4}>¡Genial!</Titular>
    </Escenario>
  );
}

// ─── 7 · Sello ────────────────────────────────────────────────────────────────

function Sello() {
  const quieto = useReducedMotion();
  const polvo = usePiezas(14, (i) => ({ ang: (i / 14) * Math.PI * 2 }));
  if (quieto) return <Estatico emoji="✅" texto="HECHO" />;
  return (
    <Escenario className="flex items-center justify-center">
      <motion.div
        initial={{ scale: 4, opacity: 0, rotate: -25 }}
        animate={{ scale: 1, opacity: 1, rotate: -8 }}
        transition={{ duration: 0.45, ease: [0.6, 0, 0.2, 1] }}
        className="rounded-2xl border-[5px] border-emerald-600 px-6 py-2.5"
      >
        <span className="text-3xl font-black uppercase tracking-widest text-emerald-600">Hecho</span>
      </motion.div>
      {polvo.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
          animate={{ x: Math.cos(p.ang) * 90, y: Math.sin(p.ang) * 45, opacity: [0, 0.5, 0], scale: 1.4 }}
          transition={{ duration: 0.7, delay: 0.42, ease: 'easeOut' }}
          className="absolute block h-2 w-2 rounded-full bg-zinc-400/60"
        />
      ))}
      <Titular delay={0.7}>Evaluación entregada</Titular>
    </Escenario>
  );
}

// ─── 8 · Ola de emojis ────────────────────────────────────────────────────────

function Ola() {
  const quieto = useReducedMotion();
  const olas = usePiezas(14, (i) => ({ emoji: elegir(['👏', '🙌', '✨', '💪']), retraso: i * 0.07, y: azar(20, 100) }));
  if (quieto) return <Estatico emoji="👏" texto="¡Bien hecho!" />;
  return (
    <Escenario>
      {olas.map((o, i) => (
        <motion.span
          key={i}
          initial={{ x: -60, opacity: 0, scale: 0.6 }}
          animate={{ x: 420, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: 1.8, delay: o.retraso, ease: 'linear' }}
          style={{ top: o.y }}
          className="absolute block text-3xl"
        >
          {o.emoji}
        </motion.span>
      ))}
      <Titular delay={0.6}>¡Bien hecho! 👏</Titular>
    </Escenario>
  );
}

// ─── 9 · Trazo dibujado ───────────────────────────────────────────────────────

function Trazo() {
  const quieto = useReducedMotion();
  if (quieto) return <Estatico emoji="✔️" texto="¡Listo!" />;
  return (
    <Escenario className="flex items-center justify-center">
      <svg width="150" height="110" viewBox="0 0 150 110" fill="none">
        <motion.circle
          cx="75" cy="52" r="40" stroke="#1baf7a" strokeWidth="5" strokeLinecap="round"
          initial={{ pathLength: 0, rotate: -90 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
          style={{ transformOrigin: '75px 52px', rotate: -90 }}
        />
        <motion.path
          d="M56 53 L70 68 L96 38" stroke="#1baf7a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.85, ease: 'easeOut' }}
        />
      </svg>
      <Titular delay={1.2}>¡Listo!</Titular>
    </Escenario>
  );
}

// ─── 10 · Corazones ───────────────────────────────────────────────────────────

function Corazones() {
  const quieto = useReducedMotion();
  const corazones = usePiezas(14, () => ({
    x: azar(8, 88),
    emoji: elegir(['💛', '💚', '💙', '🧡', '💜']),
    retraso: azar(0, 0.9),
    tam: azar(18, 36),
  }));
  if (quieto) return <Estatico emoji="💛" texto="¡Gracias por tu opinión!" />;
  return (
    <Escenario>
      {corazones.map((c, i) => (
        <motion.span
          key={i}
          initial={{ y: 160, opacity: 0, scale: 0.5 }}
          animate={{ y: -40, opacity: [0, 1, 1, 0], scale: 1, x: [0, 14, -14, 0] }}
          transition={{ duration: azar(2, 2.8), delay: c.retraso, ease: 'easeOut' }}
          style={{ left: `${c.x}%`, fontSize: c.tam }}
          className="absolute block"
        >
          {c.emoji}
        </motion.span>
      ))}
      <Titular delay={0.5}>¡Gracias por tu opinión!</Titular>
    </Escenario>
  );
}

// ─── 11 · Trofeo ──────────────────────────────────────────────────────────────

function Trofeo() {
  const quieto = useReducedMotion();
  const rayos = usePiezas(12, (i) => ({ ang: (i / 12) * 360 }));
  if (quieto) return <Estatico emoji="🏆" texto="¡Campeón/a!" />;
  return (
    <Escenario className="flex items-center justify-center">
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        className="absolute"
      >
        {rayos.map((r, i) => (
          <span
            key={i}
            style={{ transform: `rotate(${r.ang}deg) translateY(-58px)` }}
            className="absolute block h-8 w-1.5 -translate-x-1/2 rounded-full bg-amber-400/45"
          />
        ))}
      </motion.div>
      <motion.span
        initial={{ scale: 0, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ delay: 0.15, ...MUELLE }}
        className="relative text-6xl"
      >
        🏆
      </motion.span>
      <Titular delay={0.6}>¡Campeón/a!</Titular>
    </Escenario>
  );
}

// ─── 12 · Serpentinas ─────────────────────────────────────────────────────────

function Serpentinas() {
  const quieto = useReducedMotion();
  const cintas = usePiezas(11, () => ({
    x: azar(2, 94),
    color: elegir(COLORES),
    retraso: azar(0, 0.6),
    largo: azar(50, 100),
  }));
  if (quieto) return <Estatico emoji="🎊" texto="¡Enviado!" />;
  return (
    <Escenario>
      {cintas.map((c, i) => (
        <motion.span
          key={i}
          initial={{ y: -110, opacity: 1, skewX: 0 }}
          animate={{ y: 190, opacity: [1, 1, 0], skewX: [0, 22, -22, 0] }}
          transition={{ duration: azar(1.8, 2.6), delay: c.retraso, ease: 'easeIn' }}
          style={{ left: `${c.x}%`, height: c.largo, background: c.color, width: 6, borderRadius: 3 }}
          className="absolute top-0 block origin-top"
        />
      ))}
      <Titular delay={0.5}>¡Enviado! 🎊</Titular>
    </Escenario>
  );
}

// ─── 13 · Onda expansiva ──────────────────────────────────────────────────────

function Onda() {
  const quieto = useReducedMotion();
  const ondas = usePiezas(4, (i) => ({ retraso: i * 0.25 }));
  if (quieto) return <Estatico emoji="💫" texto="¡Recibido!" />;
  return (
    <Escenario className="flex items-center justify-center">
      {ondas.map((o, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0.2, opacity: 0.7 }}
          animate={{ scale: 3.4, opacity: 0 }}
          transition={{ duration: 1.6, delay: o.retraso, ease: 'easeOut' }}
          className="absolute block h-24 w-24 rounded-full border-[3px] border-blue-500"
        />
      ))}
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...MUELLE, delay: 0.1 }}
        className="text-5xl"
      >
        💫
      </motion.span>
      <Titular delay={0.7}>¡Recibido!</Titular>
    </Escenario>
  );
}

// ─── 14 · Máquina de escribir ─────────────────────────────────────────────────

function Maquina() {
  const quieto = useReducedMotion();
  const letras = '¡GRACIAS!'.split('');
  if (quieto) return <Estatico emoji="⌨️" texto="¡GRACIAS!" />;
  return (
    <Escenario className="flex items-center justify-center">
      <div className="flex gap-0.5">
        {letras.map((l, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: -22, rotate: azar(-25, 25) }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 420, damping: 12 }}
            className="text-4xl font-black tracking-tight text-blue-600 dark:text-blue-400"
          >
            {l}
          </motion.span>
        ))}
      </div>
      <Titular delay={letras.length * 0.08 + 0.2}>Tu opinión ya está con nosotros</Titular>
    </Escenario>
  );
}

// ─── 15 · Pompas ──────────────────────────────────────────────────────────────

function Pompas() {
  const quieto = useReducedMotion();
  const pompas = usePiezas(18, () => ({
    x: azar(3, 92),
    tam: azar(12, 40),
    retraso: azar(0, 1),
    dur: azar(1.8, 2.8),
  }));
  if (quieto) return <Estatico emoji="🫧" texto="¡Enviado!" />;
  return (
    <Escenario>
      {pompas.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: 170, opacity: 0, scale: 0.6 }}
          animate={{ y: -50, opacity: [0, 0.85, 0.85, 0], scale: [0.6, 1, 1.25], x: [0, 12, -12, 0] }}
          transition={{ duration: p.dur, delay: p.retraso, ease: 'easeOut' }}
          style={{ left: `${p.x}%`, width: p.tam, height: p.tam }}
          className="absolute block rounded-full border border-blue-300/70 bg-blue-200/25 dark:border-blue-400/50 dark:bg-blue-400/10"
        />
      ))}
      <Titular delay={0.5}>¡Enviado! 🫧</Titular>
    </Escenario>
  );
}

// ─── 16 · Arcoíris ────────────────────────────────────────────────────────────

function Arcoiris() {
  const quieto = useReducedMotion();
  const barras = usePiezas(COLORES.length, (i) => ({ color: COLORES[i], retraso: i * 0.09 }));
  if (quieto) return <Estatico emoji="🌈" texto="¡Enviado!" />;
  return (
    <Escenario className="flex items-center justify-center">
      <div className="absolute inset-0 flex flex-col justify-center gap-1.5">
        {barras.map((b, i) => (
          <motion.span
            key={i}
            initial={{ scaleX: 0, opacity: 0.9 }}
            animate={{ scaleX: 1, opacity: [0.9, 0.9, 0] }}
            transition={{ duration: 1.5, delay: b.retraso, ease: 'easeOut' }}
            style={{ background: b.color }}
            className="block h-3 w-full origin-left rounded-full"
          />
        ))}
      </div>
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.5, ...MUELLE }}
        className="relative text-5xl"
      >
        🌈
      </motion.span>
      <Titular delay={0.8}>¡Enviado!</Titular>
    </Escenario>
  );
}

// ─── Degradado sin animación ──────────────────────────────────────────────────

/** Lo que ve quien tiene activado "reducir movimiento": el mismo remate, quieto. */
function Estatico({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <Escenario className="flex flex-col items-center justify-center gap-2">
      <span className="text-5xl">{emoji}</span>
      <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{texto}</p>
    </Escenario>
  );
}

// ─── Registro y sorteo ────────────────────────────────────────────────────────

export const CELEBRACIONES: Record<IdCelebracion, () => React.ReactElement> = {
  check: Check,
  confeti: Confeti,
  fuegos: Fuegos,
  cohete: Cohete,
  globos: Globos,
  estrellas: Estrellas,
  sello: Sello,
  ola: Ola,
  trazo: Trazo,
  corazones: Corazones,
  trofeo: Trofeo,
  serpentinas: Serpentinas,
  onda: Onda,
  maquina: Maquina,
  pompas: Pompas,
  arcoiris: Arcoiris,
};

/** Las 15 que entran en el sorteo (todas menos el check sobrio de familias). */
export const SORTEABLES: IdCelebracion[] = [
  'confeti', 'fuegos', 'cohete', 'globos', 'estrellas', 'sello', 'ola', 'trazo',
  'corazones', 'trofeo', 'serpentinas', 'onda', 'maquina', 'pompas', 'arcoiris',
];

/**
 * Qué final le toca a quien acaba de responder. Familias mantiene el check de
 * siempre (tono más sobrio); alumnado y profesorado se llevan una de las quince.
 */
export function sortearCelebracion(audiencia: string): IdCelebracion {
  if (audiencia === 'familias') return 'check';
  return SORTEABLES[Math.floor(Math.random() * SORTEABLES.length)];
}

export function Celebracion({ id }: { id: IdCelebracion } & Partial<Props>) {
  const Componente = CELEBRACIONES[id] ?? Check;
  return <Componente />;
}
