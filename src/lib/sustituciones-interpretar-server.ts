// La parte con IA de «escribir una sustitución como se dice» (⌘K, docs/32, decisión 27). Primero se
// entiende todo lo posible SIN IA (`interpretar`, puro y con tests); Claude solo rellena lo que falte
// de cuándo, a qué horas y por qué, con frases raras («el jueves que viene, después del recreo»).
// A Claude NO le llega el nombre del profe: se quita antes (el nombre se resuelve aquí, en casa).
// Usa el modelo y el interruptor de Ajustes del colegio › IA; sin clave o apagado, se queda en lo local.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getAjustesIA, hayClaveIA } from '@/lib/ajustes-server';
import { CONFIGURACION } from '@/lib/configuracion';
import { diaSemana } from '@/lib/oratorios';
import { interpretar, sinAcentos, type Interpretacion, type ProfeNombre } from '@/lib/sustituciones-interpretar';
import { fechaLarga } from '@/lib/sustituciones';

const respuestaIA = z.object({
  desde: z.string().nullable().describe('Primer día, YYYY-MM-DD, o null si no lo dice'),
  hasta: z.string().nullable().describe('Último día, YYYY-MM-DD (igual que desde si es un día), o null'),
  tramos: z.array(z.number().int()).describe('Ordinales de las horas de clase (3 = 3ª hora); vacío si no los dice'),
  horaInicio: z.string().nullable().describe('HH:mm si da una hora de reloj, o null'),
  horaFin: z.string().nullable().describe('HH:mm si da una hora de fin, o null'),
  motivo: z.enum(['actividad_escolar', 'medico', 'medico_familiar', 'enfermedad_leve', 'baja', 'otros']).nullable(),
});

/** Quita del texto cualquier palabra que sea parte del nombre de alguien del claustro. */
export function anonimizar(texto: string, profes: readonly ProfeNombre[]): string {
  const nombres = new Set(profes.flatMap((p) => sinAcentos(p.nombre).split(/[\s.-]+/)).filter((w) => w.length >= 2));
  return texto
    .split(/(\s+)/)
    .map((w) => (nombres.has(sinAcentos(w).replace(/[^a-z0-9ñ]/g, '')) ? 'X' : w))
    .join('');
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/** Lo local, completado (si hace falta y se puede) con Claude. Nunca lanza: lo peor es quedarse en lo local. */
export async function interpretarConIA(texto: string, hoy: string, profes: readonly ProfeNombre[]): Promise<Interpretacion & { conIA: boolean }> {
  const local = interpretar(texto, hoy, profes);
  const falta = !local.desde || (local.tramos.length === 0 && !local.horaInicio && !/todo el d[ií]a/i.test(texto)) || !local.motivo;
  if (!falta || !hayClaveIA()) return { ...local, conIA: false };
  const ajustes = await getAjustesIA();
  if (!ajustes.activado) return { ...local, conIA: false };
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY?.trim(), timeout: 15_000, maxRetries: 1 });
    const r = await client.messages.parse({
      model: ajustes.modelo,
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(respuestaIA) },
      system:
        'Extraes de una frase corta de Jefatura de estudios de un colegio cuándo falta un profesor y a qué horas. ' +
        `Hoy es ${fechaLarga(hoy)} (${hoy}); la semana lectiva va de lunes a viernes. «X» es el nombre de una persona: ignóralo. ` +
        'Fechas relativas («mañana», «el jueves», «la semana que viene») resuélvelas desde hoy; un día de la semana sin más es el próximo (hoy incluido). ' +
        'Las horas de clase se dicen por ordinal («a 3ª», «primera y segunda», «las dos últimas» no: eso déjalo vacío). ' +
        'Motivo: actividad_escolar (salidas, formación, reuniones del colegio), medico, medico_familiar (acompañar a un familiar), enfermedad_leve, baja, otros. Si no se dice, null. No inventes nada.',
      messages: [{ role: 'user', content: anonimizar(texto, profes).slice(0, 400) }],
    });
    const ia = r.stop_reason === 'refusal' ? null : r.parsed_output;
    if (!ia) return { ...local, conIA: false };
    const desde = local.desde ?? (ia.desde && FECHA.test(ia.desde) ? ia.desde : null);
    const hasta = local.desde ? local.hasta : desde ? (ia.hasta && FECHA.test(ia.hasta) && ia.hasta >= desde ? ia.hasta : desde) : null;
    const sinHoras = local.tramos.length === 0 && !local.horaInicio;
    const tramos = sinHoras ? ia.tramos.filter((n) => n >= 1 && n <= 10).map((n) => `${n}ª`) : local.tramos;
    const horaInicio = sinHoras && tramos.length === 0 && ia.horaInicio && HORA.test(ia.horaInicio) ? ia.horaInicio : local.horaInicio;
    const horaFin = sinHoras && tramos.length === 0 && ia.horaFin && HORA.test(ia.horaFin) ? ia.horaFin : local.horaFin;
    const motivo = local.motivo ?? (ia.motivo && CONFIGURACION.sustituciones.motivos.some((m) => m.clave === ia.motivo) ? ia.motivo : null);
    // Un día suelto que cae en fin de semana es un malentendido: mejor sin fecha.
    const bueno = (f: string | null) => (f && diaSemana(f) <= 5 ? f : null);
    return { ...local, desde: bueno(desde), hasta: bueno(desde) ? hasta : null, tramos, horaInicio, horaFin, motivo, conIA: true };
  } catch (e) {
    console.error('Sustituciones · interpretar con IA:', e instanceof Error ? e.message.slice(0, 200) : 'error');
    return { ...local, conIA: false };
  }
}
