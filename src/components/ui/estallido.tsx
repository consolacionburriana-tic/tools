'use client';

// Las animaciones de fiesta de una sola vez: confeti disparado desde las esquinas, burbujas con
// iconos que suben (los globos de siempre, pero de cole) y una explosión desde el centro. Las usan
// la bienvenida del escritorio y el «gracias» del botón de sugerencias; la guía las permite porque
// son la «celebración» (docs/diseno.md, §3). Todas pasan **una vez** y se quitan solas; con
// «reducir movimiento» del sistema no pintan nada (quien las usa deja su versión quieta).
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Apple, BookOpen, GraduationCap, Heart, Lightbulb, Pencil, Rocket, Smile, Sparkles, Star, type LucideIcon } from 'lucide-react';

// La paleta categórica validada del repo (la misma de las celebraciones de Evaluaciones).
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

const ICONOS: readonly LucideIcon[] = [Sparkles, Star, GraduationCap, BookOpen, Pencil, Lightbulb, Heart, Apple, Smile, Rocket];

const azar = (min: number, max: number) => min + Math.random() * (max - min);
const elegir = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Piezas con propiedades al azar, que no cambian mientras dura la animación. */
function usePiezas<T>(n: number, hacer: (i: number) => T): T[] {
  return useMemo(() => Array.from({ length: n }, (_, i) => hacer(i)), [n]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Falso en el servidor y en la hidratación, verdadero ya en el navegador. Las piezas se sortean
 * con `Math.random`, y si se pintaran en el servidor no coincidirían con las del navegador
 * (hidratación rota): por eso las animaciones solo se montan cuando esto es verdadero.
 */
function useEnNavegador(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Avisa cuando la animación ha terminado, para que quien la monta la desmonte. */
function useAlTerminar(ms: number, onFin?: () => void) {
  useEffect(() => {
    if (!onFin) return;
    const t = window.setTimeout(onFin, ms);
    return () => window.clearTimeout(t);
  }, [ms, onFin]);
}

/**
 * Pantalla completa, sin tocarse: dos cañones de confeti en las esquinas de abajo y burbujas con
 * iconos que suben desde el fondo. Dura unos 6 s.
 */
export function FiestaDePantalla({ onFin }: { onFin?: () => void }) {
  const enNavegador = useEnNavegador();
  return enNavegador ? <Fiesta onFin={onFin} /> : null;
}

function Fiesta({ onFin }: { onFin?: () => void }) {
  const quieto = useReducedMotion();
  useAlTerminar(6500, onFin);

  const confeti = usePiezas(70, (i) => {
    const izquierda = i % 2 === 0;
    return {
      izquierda,
      color: elegir(COLORES),
      // Hacia dónde sale (vw/vh: a cada pantalla le toca lo suyo) y hasta dónde sube.
      dx: (izquierda ? 1 : -1) * azar(12, 60),
      subida: azar(35, 85),
      caida: azar(5, 20),
      giro: azar(-720, 720),
      ancho: azar(6, 11),
      alto: azar(9, 16),
      retraso: azar(0, 0.35),
      duracion: azar(2.6, 3.8),
      redondo: Math.random() < 0.25,
    };
  });

  const burbujas = usePiezas(14, () => ({
    Icono: elegir(ICONOS),
    color: elegir(COLORES),
    x: azar(4, 92),
    tam: azar(44, 68),
    retraso: azar(0.5, 2.6),
    duracion: azar(4.2, 5.8),
    vaiven: azar(18, 46),
  }));

  if (quieto) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden print:hidden">
      {confeti.map((p, i) => (
        <motion.span
          key={`c${i}`}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: ['0vw', `${p.dx * 0.7}vw`, `${p.dx}vw`],
            y: ['0vh', `${-p.subida}vh`, `${p.caida}vh`],
            rotate: p.giro,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duracion,
            delay: p.retraso,
            times: [0, 0.45, 1],
            ease: ['easeOut', 'easeIn'],
            opacity: { times: [0, 0.8, 1], duration: p.duracion, delay: p.retraso },
          }}
          style={{
            [p.izquierda ? 'left' : 'right']: 0,
            bottom: 0,
            width: p.ancho,
            height: p.redondo ? p.ancho : p.alto,
            background: p.color,
            borderRadius: p.redondo ? 999 : 2,
          }}
          className="absolute block"
        />
      ))}
      {burbujas.map(({ Icono, color, x, tam, retraso, duracion, vaiven }, i) => (
        <motion.span
          key={`b${i}`}
          initial={{ y: '12vh', opacity: 0, scale: 0.6 }}
          animate={{
            y: '-115vh',
            opacity: [0, 1, 1, 0],
            scale: [0.6, 1, 1, 1.05],
            x: [0, vaiven, -vaiven, vaiven * 0.5],
          }}
          transition={{ duration: duracion, delay: retraso, ease: 'easeOut', opacity: { duration: duracion, delay: retraso, times: [0, 0.12, 0.8, 1] } }}
          style={{ left: `${x}%`, bottom: 0, width: tam, height: tam, background: `${color}22`, border: `2px solid ${color}66`, color }}
          className="absolute flex items-center justify-center rounded-full backdrop-blur-[1px]"
        >
          <Icono style={{ width: tam * 0.5, height: tam * 0.5 }} />
        </motion.span>
      ))}
    </div>
  );
}

/**
 * Dentro de una caja (necesita `relative overflow-hidden`): chispas que salen del centro y
 * corazoncitos que suben. Para el «gracias».
 */
export function ExplosionCentral({ onFin }: { onFin?: () => void }) {
  const enNavegador = useEnNavegador();
  return enNavegador ? <Explosion onFin={onFin} /> : null;
}

function Explosion({ onFin }: { onFin?: () => void }) {
  const quieto = useReducedMotion();
  useAlTerminar(3200, onFin);

  const chispas = usePiezas(34, (i) => {
    const angulo = (i / 34) * Math.PI * 2 + azar(-0.12, 0.12);
    const radio = azar(70, 150);
    return {
      color: elegir(COLORES),
      x: Math.cos(angulo) * radio,
      y: Math.sin(angulo) * radio,
      caida: azar(10, 40),
      giro: azar(-540, 540),
      ancho: azar(5, 9),
      alto: azar(8, 13),
      retraso: azar(0, 0.12),
      redondo: Math.random() < 0.3,
    };
  });

  const corazones = usePiezas(8, () => ({
    x: azar(8, 90),
    tam: azar(16, 28),
    retraso: azar(0.3, 1.2),
    color: elegir(COLORES),
    vaiven: azar(8, 20),
  }));

  if (quieto) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {chispas.map((p, i) => (
        <motion.span
          key={`s${i}`}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: p.x, y: [0, p.y, p.y + p.caida], rotate: p.giro, opacity: [1, 1, 0], scale: [0.4, 1, 1] }}
          transition={{ duration: 1.6, delay: p.retraso, ease: 'easeOut', times: [0, 0.55, 1] }}
          style={{ width: p.ancho, height: p.redondo ? p.ancho : p.alto, background: p.color, borderRadius: p.redondo ? 999 : 2 }}
          className="absolute top-1/2 left-1/2 block"
        />
      ))}
      {corazones.map((c, i) => (
        <motion.span
          key={`h${i}`}
          initial={{ y: 0, opacity: 0, scale: 0.5 }}
          animate={{ y: -170, opacity: [0, 1, 1, 0], scale: 1, x: [0, c.vaiven, -c.vaiven, 0] }}
          transition={{ duration: 2.4, delay: c.retraso, ease: 'easeOut' }}
          style={{ left: `${c.x}%`, bottom: 4, color: c.color }}
          className="absolute block"
        >
          <Heart style={{ width: c.tam, height: c.tam }} className="fill-current" />
        </motion.span>
      ))}
    </div>
  );
}
