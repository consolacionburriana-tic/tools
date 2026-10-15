// Llamada a Claude para analizar los resultados de una evaluación, y su historial
// (`eval_insights`). El modelo, el interruptor y el contexto del colegio salen de los
// ajustes (/gestion/ajustes); la clave, de la variable de entorno ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { evalInsights } from '@/db/schema';
import { getAjustesIA, hayClaveIA } from '@/lib/ajustes-server';
import { insightsSchema, informeParaIA, SISTEMA_IA, type Insights } from '@/lib/evaluaciones-ia';
import { getResultados, type FiltroResultados } from '@/lib/evaluaciones-server';
import { ETAPA_LABEL, esEtapa } from '@/lib/cursos';

export interface InsightGuardado {
  id: string;
  filtro: string;
  modelo: string;
  contenido: Insights;
  respuestas: number;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  createdByEmail: string | null;
  createdAt: Date;
}

/** Clave estable del filtro: '' (todo), 'etapa:ESO' o 'clase:3ESO|A'. */
export function claveFiltro(filtro: FiltroResultados | null): string {
  if (filtro?.curso) return `clase:${filtro.curso}|${filtro.letra ?? ''}`;
  if (filtro?.etapa) return `etapa:${filtro.etapa}`;
  return '';
}

function describirFiltro(filtro: FiltroResultados | null): string | null {
  if (filtro?.curso) return `la clase ${filtro.letra && filtro.letra !== 'PDC' ? `${filtro.curso} ${filtro.letra}` : filtro.curso}`;
  if (filtro?.etapa) return `la etapa ${esEtapa(filtro.etapa) ? ETAPA_LABEL[filtro.etapa] : filtro.etapa}`;
  return null;
}

/** El último análisis de este formulario con este filtro (o null). */
export async function getUltimoInsight(formId: string, filtro: FiltroResultados | null): Promise<InsightGuardado | null> {
  const [fila] = await db
    .select()
    .from(evalInsights)
    .where(and(eq(evalInsights.formId, formId), eq(evalInsights.filtro, claveFiltro(filtro))))
    .orderBy(desc(evalInsights.createdAt))
    .limit(1);
  if (!fila) return null;
  const contenido = insightsSchema.safeParse(fila.contenido);
  if (!contenido.success) return null;
  return { ...fila, contenido: contenido.data };
}

export class ErrorIA extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Analiza los resultados (con el filtro de la pantalla) y guarda el análisis. Lanza
 * `ErrorIA` con un mensaje para enseñar tal cual si algo no cuadra.
 */
export async function generarInsight(
  formId: string,
  filtro: FiltroResultados | null,
  email: string | null,
): Promise<InsightGuardado> {
  const ajustes = await getAjustesIA();
  if (!ajustes.activado) throw new ErrorIA('El análisis con IA está desactivado en Ajustes del colegio.', 409);
  if (!hayClaveIA()) {
    throw new ErrorIA('Falta la clave de la API de Anthropic (variable de entorno ANTHROPIC_API_KEY en Vercel).', 409);
  }
  const resultados = await getResultados(formId, filtro);
  if (!resultados) throw new ErrorIA('Evaluación no encontrada', 404);
  if (resultados.totalRespuestas === 0) throw new ErrorIA('Todavía no hay respuestas que analizar.', 409);

  const informe = informeParaIA(resultados, { filtro: describirFiltro(filtro), contexto: ajustes.contexto });
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 55_000, maxRetries: 0 });

  let respuesta;
  try {
    respuesta = await client.messages.parse({
      model: ajustes.modelo,
      max_tokens: 16000,
      system: SISTEMA_IA,
      messages: [
        {
          role: 'user',
          content: `${informe}\n\nAnaliza estos resultados para el equipo de coordinación.`,
        },
      ],
      output_config: { format: zodOutputFormat(insightsSchema) },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ErrorIA('La clave de Anthropic no es válida.', 502);
    if (error instanceof Anthropic.RateLimitError) throw new ErrorIA('Anthropic dice que hay demasiadas peticiones; prueba en un minuto.', 429);
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new ErrorIA('Claude ha tardado demasiado; prueba otra vez.', 504);
    if (error instanceof Anthropic.APIError) throw new ErrorIA(`Error de la API de Anthropic (${error.status ?? 'sin código'}).`, 502);
    throw error;
  }

  if (respuesta.stop_reason === 'refusal') throw new ErrorIA('El modelo no ha querido analizar esto.', 502);
  if (respuesta.stop_reason === 'max_tokens') throw new ErrorIA('La respuesta se ha cortado por larga; prueba otra vez.', 502);
  const contenido = respuesta.parsed_output;
  if (!contenido) throw new ErrorIA('La respuesta del modelo no tenía el formato esperado.', 502);

  const [fila] = await db
    .insert(evalInsights)
    .values({
      formId,
      filtro: claveFiltro(filtro),
      modelo: ajustes.modelo,
      contenido,
      respuestas: resultados.totalRespuestas,
      tokensEntrada: respuesta.usage.input_tokens,
      tokensSalida: respuesta.usage.output_tokens,
      createdByEmail: email,
    })
    .returning();
  return { ...fila, contenido };
}
