// La bienvenida del escritorio: la primera vez que alguien entra tras el estreno, el saludo se
// anima, cae confeti y sale una frase con guasa. Puro, sin IO. Ficha: docs/03-escritorio-admin.md
//
// Se decide EN EL SERVIDOR con una cookie por persona (como las preferencias de Números): así la
// página sale ya con la animación, sin el parpadeo de «se ve normal y luego se anima». Los iPads
// del claustro son compartidos, de ahí que la cookie lleve la huella de quien entra y no valga
// para el siguiente profe que use el mismo iPad.
import { huella } from '@/lib/huella';

/**
 * El «estreno». Cambiar este valor vuelve a enseñar la bienvenida a todo el mundo: pasa en cada
 * novedad grande que se quiera presentar con ruido; mientras no se toque, cada persona la ve una vez.
 */
export const BIENVENIDA_ID = '2026-11-02';

export const cookieBienvenida = (email: string) => `bienvenida-${huella(email.toLowerCase())}`;

/** Se enseña si no la ha visto (o ha visto otro estreno), o si se fuerza con `?bienvenida=1`. */
export function debeBienvenida(valorCookie: string | undefined, forzar: boolean): boolean {
  return forzar || valorCookie !== BIENVENIDA_ID;
}

// Sin emojis (la interfaz va con iconos) y sin prometer nada que no esté. La última apunta al
// botón de sugerencias, que es lo que más interesa que encuentren hoy.
const FRASES = [
  'Te damos la bienvenida a la navaja suiza del cole: tiene de todo y no pincha.',
  'Menos papeles, menos Excel y más café caliente. Es todo lo que prometemos.',
  'Esto es nuevo, es tuyo y todavía huele a recién estrenado.',
  'Aquí no hay que firmar nada en triplicado. Lo hemos comprobado dos veces.',
  '¿Algo no te cuadra? Hay un botoncito abajo a la derecha para chivarte, sin rencores.',
] as const;

/** Siempre la misma frase para la misma persona (el servidor y el navegador tienen que coincidir). */
export function fraseBienvenida(email: string): string {
  return FRASES[parseInt(huella(email.toLowerCase()), 16) % FRASES.length];
}
