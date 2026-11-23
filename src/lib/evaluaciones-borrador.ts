// Borrador local de lo que alguien lleva contestado en el formulario público de una
// evaluación. Vive en el `localStorage` del dispositivo (nunca viaja al servidor): si se
// recarga la página, se cierra la pestaña o el iPad se queda sin batería, no se pierde lo
// escrito. Helpers puros, sin IO: la lectura/escritura está en `responder-form.tsx`.

export const BORRADOR_VERSION = 1;
// Una evaluación se contesta el mismo día o poco después; pasado esto, mejor empezar de cero.
export const BORRADOR_CADUCA_EN_MS = 3 * 24 * 60 * 60 * 1000;

export interface BorradorRespuestas {
  version: number;
  guardadoEl: number;
  clase: string | null;
  etapa: string | null;
  escalas: Record<string, number>;
  opciones: Record<string, string[]>;
  textos: Record<string, string>;
  otras: Record<string, string>;
}

export interface PreguntaParaBorrador {
  id: string;
  tipo: string;
  filas: { clave: string }[];
  opciones: { clave: string }[];
  permiteOtra: boolean;
}

/** Clave de `localStorage`: un borrador por formulario y, si el enlace es personal, por invitación. */
export function claveBorrador(token: string, invite: string | null): string {
  return `eval-borrador:${token}:${invite ?? ''}`;
}

/** Sin una sola respuesta no hay nada que guardar (y así no se deja basura en el dispositivo). */
export function borradorVacio(b: Pick<BorradorRespuestas, 'clase' | 'etapa' | 'escalas' | 'opciones' | 'textos' | 'otras'>): boolean {
  return (
    !b.clase &&
    !b.etapa &&
    Object.keys(b.escalas).length === 0 &&
    Object.values(b.opciones).every((v) => v.length === 0) &&
    Object.values(b.textos).every((t) => !t.trim()) &&
    Object.values(b.otras).every((t) => !t.trim())
  );
}

/**
 * Lee un borrador crudo y se queda SOLO con lo que todavía existe en el formulario: si
 * entre un día y otro se cambió una pregunta o una opción, lo huérfano se descarta en
 * vez de colarse en el envío. Devuelve `null` si está caducado, es de otra versión o
 * queda vacío.
 */
export function restaurarBorrador(
  crudo: string | null,
  preguntas: PreguntaParaBorrador[],
  clasesValidas: string[],
  etapasValidas: string[],
  ahora: number = Date.now(),
): Omit<BorradorRespuestas, 'version' | 'guardadoEl'> | null {
  if (!crudo) return null;
  let b: Partial<BorradorRespuestas>;
  try {
    b = JSON.parse(crudo) as Partial<BorradorRespuestas>;
  } catch {
    return null;
  }
  if (!b || typeof b !== 'object' || b.version !== BORRADOR_VERSION) return null;
  if (typeof b.guardadoEl !== 'number' || ahora - b.guardadoEl > BORRADOR_CADUCA_EN_MS) return null;

  const porId = new Map(preguntas.map((q) => [q.id, q]));
  const escalas: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.escalas ?? {})) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const [qid, fila] = k.split('::');
    const q = porId.get(qid);
    if (!q || q.tipo !== 'escala') continue;
    if (fila === undefined ? q.filas.length === 0 : q.filas.some((f) => f.clave === fila)) escalas[k] = v;
  }

  const opciones: Record<string, string[]> = {};
  for (const [qid, claves] of Object.entries(b.opciones ?? {})) {
    const q = porId.get(qid);
    if (!q || !Array.isArray(claves)) continue;
    const validas = claves.filter((c): c is string => typeof c === 'string' && q.opciones.some((o) => o.clave === c));
    if (validas.length > 0) opciones[qid] = validas;
  }

  const textos: Record<string, string> = {};
  for (const [qid, t] of Object.entries(b.textos ?? {})) {
    if (typeof t === 'string' && porId.get(qid)?.tipo === 'texto' && t.trim()) textos[qid] = t;
  }

  const otras: Record<string, string> = {};
  for (const [qid, t] of Object.entries(b.otras ?? {})) {
    if (typeof t === 'string' && porId.get(qid)?.permiteOtra && t.trim()) otras[qid] = t;
  }

  const restaurado = {
    clase: typeof b.clase === 'string' && clasesValidas.includes(b.clase) ? b.clase : null,
    etapa: typeof b.etapa === 'string' && etapasValidas.includes(b.etapa) ? b.etapa : null,
    escalas,
    opciones,
    textos,
    otras,
  };
  return borradorVacio(restaurado) ? null : restaurado;
}
