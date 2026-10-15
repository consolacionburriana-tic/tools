// Ajustes del colegio que se cambian desde la app (/gestion/ajustes), sin tocar código.
// Puro (sin IO): lo usan el servidor y la pantalla. Lo que se guarda vive en `cfg_ajustes`.
import { z } from 'zod';

// ─── IA (Claude) ──────────────────────────────────────────────────────────────

/**
 * Modelos que se pueden elegir para analizar resultados. Precio en dólares por millón de
 * tokens (entrada / salida), tarifa de la API de Anthropic a octubre de 2026. Un análisis
 * típico de evaluación son ~10.000 tokens de entrada y ~2.000 de salida.
 */
export const MODELOS_IA = [
  {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    nota: 'Rápido y muy barato. Recomendado para el día a día.',
    entrada: 0.1,
    salida: 0.5,
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    nota: 'Lee mejor los matices. Unas 20 veces más caro que Haiku.',
    entrada: 2,
    salida: 10,
  },
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    nota: 'El más capaz. Para un análisis que vaya a un claustro o a dirección.',
    entrada: 4,
    salida: 20,
  },
] as const;

export type ModeloIA = (typeof MODELOS_IA)[number]['id'];
export const MODELO_IA_POR_DEFECTO: ModeloIA = 'claude-haiku-5-5';

export function modeloIA(id: string | null | undefined): (typeof MODELOS_IA)[number] {
  return MODELOS_IA.find((m) => m.id === id) ?? MODELOS_IA[0];
}

/** Coste aproximado en dólares de una llamada (para enseñarlo, no para facturar). */
export function costeIA(modelo: string, tokensEntrada: number, tokensSalida: number): number {
  const m = modeloIA(modelo);
  return (tokensEntrada * m.entrada + tokensSalida * m.salida) / 1_000_000;
}

export const ajustesIASchema = z.object({
  /** Interruptor general: apagado, no se ofrece el botón en ningún módulo. */
  activado: z.boolean(),
  modelo: z.enum(MODELOS_IA.map((m) => m.id) as [ModeloIA, ...ModeloIA[]]),
  /**
   * Lo que el modelo debería saber del colegio para no decir obviedades: carisma, qué es
   * un Godly Play o un oratorio, cómo se organizan las etapas… Va en cada análisis.
   */
  contexto: z.string().max(4000),
});
export type AjustesIA = z.infer<typeof ajustesIASchema>;

export const AJUSTES_IA_POR_DEFECTO: AjustesIA = {
  activado: true,
  modelo: MODELO_IA_POR_DEFECTO,
  contexto: '',
};

/** Lo guardado en la BBDD, completado con los valores por defecto (y a salvo de basura). */
export function leerAjustesIA(valor: unknown): AjustesIA {
  const parcial = ajustesIASchema.partial().safeParse(valor);
  return { ...AJUSTES_IA_POR_DEFECTO, ...(parcial.success ? parcial.data : {}) };
}
