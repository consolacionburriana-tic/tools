// Las reglas de diseño que se pueden contar en el código (docs/diseno.md, «Lo que no se
// hace»). Puro: recibe el texto de un fichero y devuelve cuántas veces rompe cada regla. El
// comando `pnpm diseno:guardia` (scripts/guardia-diseno.ts) lo pasa por todo `src/`.

export const REGLAS = {
  navegador: {
    explicacion: 'confirm(), prompt() o alert() del navegador → ui/confirmar o un toast',
    // «confirm()» sin nada dentro es que se está nombrando en un texto, no llamando.
    patron: /(?:\bwindow\.|(?<![\w.$]))(?:confirm|prompt|alert)\s*\((?!\s*\))/g,
  },
  estilos: {
    explicacion: 'constante de estilo propia para botones o campos → Button, Input',
    patron: /\bconst\s+(?:BOTON\w*|ESTILO_BOTON\w*|ESTILO_CAMPO\w*|CAMPO\w*|BTN_\w*)\s*=/g,
  },
  cabecera: {
    explicacion: '<header> propio en /gestion → PaginaModulo',
    patron: /<header\b/g,
  },
  letra: {
    explicacion: 'letra de 9-11 px a mano → text-xs como mínimo',
    patron: /\btext-\[(?:9|10|11)(?:\.\d+)?px\]/g,
  },
  hover: {
    explicacion: 'acción que solo aparece con el ratón → que se vea siempre',
    patron: /\bopacity-0\b[^"'`\n]*\bgroup-hover:opacity-100\b/g,
  },
} as const;

export type Regla = keyof typeof REGLAS;
export type Cuentas = Partial<Record<Regla, number>>;

/** Las reglas que se miran en un fichero, según dónde está. */
export function reglasPara(ruta: string): Regla[] {
  const r = ruta.replaceAll('\\', '/');
  if (r.includes('/components/ui/')) return [];
  const todas = Object.keys(REGLAS) as Regla[];
  // La cabecera propia solo cuenta en las pantallas de gestión: las de familias tienen la suya.
  return r.includes('/app/gestion/') ? todas : todas.filter((x) => x !== 'cabecera');
}

/** Quita los comentarios de línea y de bloque para no contar lo que solo se menciona. */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1');
}

export function contar(ruta: string, texto: string): Cuentas {
  const limpio = sinComentarios(texto);
  const cuentas: Cuentas = {};
  for (const regla of reglasPara(ruta)) {
    const n = limpio.match(REGLAS[regla].patron)?.length ?? 0;
    if (n > 0) cuentas[regla] = n;
  }
  return cuentas;
}

export interface Exceso {
  ruta: string;
  regla: Regla;
  antes: number;
  ahora: number;
}

/** Lo que ha subido respecto a la lista de lo que ya había (un fichero nuevo parte de 0). */
export function excesos(actual: Record<string, Cuentas>, permitido: Record<string, Cuentas>): Exceso[] {
  const salida: Exceso[] = [];
  for (const [ruta, cuentas] of Object.entries(actual)) {
    for (const [regla, ahora] of Object.entries(cuentas) as [Regla, number][]) {
      const antes = permitido[ruta]?.[regla] ?? 0;
      if (ahora > antes) salida.push({ ruta, regla, antes, ahora });
    }
  }
  return salida.sort((a, b) => a.ruta.localeCompare(b.ruta) || a.regla.localeCompare(b.regla));
}

/**
 * La lista nueva tras limpiar: lo de ahora, pero nunca por encima de lo que había (bajar
 * sí, subir no). Los ficheros que quedan a cero desaparecen de la lista.
 */
export function rebajar(actual: Record<string, Cuentas>, permitido: Record<string, Cuentas>): Record<string, Cuentas> {
  const salida: Record<string, Cuentas> = {};
  for (const ruta of Object.keys(permitido).sort()) {
    const cuentas: Cuentas = {};
    for (const [regla, antes] of Object.entries(permitido[ruta]) as [Regla, number][]) {
      const ahora = Math.min(antes, actual[ruta]?.[regla] ?? 0);
      if (ahora > 0) cuentas[regla] = ahora;
    }
    if (Object.keys(cuentas).length > 0) salida[ruta] = cuentas;
  }
  return salida;
}
