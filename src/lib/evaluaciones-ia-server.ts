// Llamada a Claude para analizar los resultados de una evaluación, y su historial
// (`eval_insights`). El modelo, el interruptor y el contexto del colegio salen de los
// ajustes (/gestion/ajustes); la clave, de la variable de entorno ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
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
  const client = clienteIA();

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
    throw traducirErrorAnthropic(error, ajustes.modelo);
  }

  if (respuesta.stop_reason === 'refusal') throw new ErrorIA('El modelo no ha querido analizar esto.', 502);
  if (respuesta.stop_reason === 'max_tokens') throw new ErrorIA('La respuesta se ha cortado por larga; prueba otra vez.', 502);
  const contenido = respuesta.parsed_output;
  if (!contenido) {
    console.error('[ia] respuesta sin formato', { modelo: ajustes.modelo, stop: respuesta.stop_reason });
    throw new ErrorIA('La respuesta del modelo no tenía el formato esperado.', 502);
  }

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

/** Cliente de la API. La clave se recorta: un salto de línea al pegarla en Vercel la invalida. */
function clienteIA(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim(), timeout: 55_000, maxRetries: 0 });
}

/** El mensaje que da Anthropic dentro del cuerpo del error (`{error: {type, message}}`). */
function mensajeAnthropic(error: InstanceType<typeof Anthropic.APIError>): string {
  const cuerpo = error.error as { error?: { message?: string } } | undefined;
  return cuerpo?.error?.message ?? error.message;
}

/**
 * Traduce un error de la API a algo que se entienda en pantalla, con el motivo real de
 * Anthropic al final (antes solo decía "Error de la API (400)" y no había forma de saber qué
 * pasaba). Lo deja también en los logs de Vercel: estado, tipo, mensaje y request id, nunca
 * los datos que se mandaban.
 */
export function traducirErrorAnthropic(error: unknown, modelo: string): ErrorIA {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ErrorIA('Claude ha tardado demasiado; prueba otra vez.', 504);
  if (error instanceof Anthropic.APIConnectionError) {
    console.error('[ia] sin conexión con Anthropic', error.message);
    return new ErrorIA('No se ha podido conectar con Anthropic; prueba otra vez.', 502);
  }
  if (!(error instanceof Anthropic.APIError)) {
    console.error('[ia] error inesperado', error instanceof Error ? error.message : error);
    return new ErrorIA(`Error inesperado al llamar a Claude: ${error instanceof Error ? error.message : 'desconocido'}`, 500);
  }
  const motivo = mensajeAnthropic(error);
  console.error('[ia] Anthropic respondió con error', { status: error.status, tipo: error.type, motivo, modelo, requestId: error.requestID });
  const m = motivo.toLowerCase();
  let texto: string;
  if (error.status === 401) texto = 'La clave de Anthropic (ANTHROPIC_API_KEY) no es válida: revisa que esté bien copiada en Vercel.';
  else if (error.status === 403) texto = 'La clave de Anthropic no tiene permiso para esto.';
  else if (m.includes('credit balance')) texto = 'La cuenta de Anthropic no tiene saldo: hay que añadir crédito en platform.claude.com → Billing.';
  else if (error.status === 404) texto = `El modelo ${modelo} no está disponible para esta cuenta: prueba otro en Ajustes del colegio.`;
  else if (error.status === 429) texto = 'Anthropic dice que hay demasiadas peticiones (o se ha llegado al límite de gasto); prueba en un rato.';
  else if (error.status === 529 || (error.status ?? 0) >= 500) texto = 'Anthropic está saturado o con problemas ahora mismo; prueba en unos minutos.';
  else texto = `Anthropic ha rechazado la petición (${error.status ?? 'sin código'}).`;
  return new ErrorIA(`${texto} Motivo: ${motivo}`, error.status === 429 ? 429 : 502);
}

/**
 * Llamada mínima para comprobar clave, saldo y modelo, con la misma salida estructurada que
 * usa el análisis (así, si falla algo, falla aquí y no a mitad de una evaluación).
 */
export async function probarConexionIA(modelo: string): Promise<{ ms: number; modelo: string }> {
  if (!hayClaveIA()) throw new ErrorIA('Falta la clave de la API de Anthropic (variable de entorno ANTHROPIC_API_KEY en Vercel).', 409);
  const inicio = Date.now();
  let respuesta;
  try {
    respuesta = await clienteIA().messages.parse({
      model: modelo,
      max_tokens: 2000,
      messages: [{ role: 'user', content: 'Esto es una prueba de conexión. Devuelve ok = true.' }],
      output_config: { effort: 'low', format: zodOutputFormat(z.object({ ok: z.boolean() })) },
    });
  } catch (error) {
    throw traducirErrorAnthropic(error, modelo);
  }
  if (!respuesta.parsed_output) throw new ErrorIA(`Ha contestado, pero sin el formato esperado (${respuesta.stop_reason}).`, 502);
  return { ms: Date.now() - inicio, modelo: respuesta.model };
}

/** Los últimos 4 caracteres de la clave, para comprobar que es la que toca sin enseñarla. */
export function huellaClaveIA(): string | null {
  const clave = process.env.ANTHROPIC_API_KEY?.trim();
  return clave && clave.length > 12 ? `…${clave.slice(-4)}` : null;
}
