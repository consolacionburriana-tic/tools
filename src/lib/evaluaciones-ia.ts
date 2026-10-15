// Análisis de resultados de una evaluación con Claude: qué se le manda y qué se espera.
// Puro (sin IO): la llamada a la API vive en `evaluaciones-ia-server.ts`.
//
// Qué se manda: las cifras agregadas y los comentarios escritos, SIN identidad (ni nombres
// ni correos: la BBDD ni siquiera los tiene en profesorado). Como mucho la clase o la etapa,
// lo mismo que ya sale en el CSV. Los comentarios "no cambiaría nada" y los vacíos no se
// mandan uno a uno: se cuentan.
import { z } from 'zod';
import { clasificarComentario, escalaDe, escalaValora, normalizarComentario } from '@/lib/evaluaciones';
import { ETAPA_LABEL, esEtapa } from '@/lib/cursos';
import type { Resultados } from '@/lib/evaluaciones-server';

export const insightsSchema = z.object({
  titular: z.string().describe('Una frase que diga cómo ha ido, para leer en dos segundos.'),
  resumen: z.string().describe('Tres a cinco frases con lo esencial, con cifras.'),
  loMejor: z
    .array(z.object({ titulo: z.string(), detalle: z.string() }))
    .describe('Lo que mejor ha funcionado, de más a menos claro. Entre 2 y 4.'),
  aMejorar: z
    .array(z.object({ titulo: z.string(), detalle: z.string() }))
    .describe('Lo que peor ha funcionado o más se critica. Entre 2 y 4.'),
  propuestas: z
    .array(
      z.object({
        propuesta: z.string().describe('La idea, dicha en limpio.'),
        cuantos: z.number().int().describe('Cuántos comentarios la piden (aproximado).'),
        ejemplo: z.string().describe('Un comentario literal que la represente, tal cual lo escribieron.'),
      }),
    )
    .describe('Lo que más se repite en los comentarios, de más a menos repetido. Máximo 6.'),
  alertas: z
    .array(z.object({ detalle: z.string(), cita: z.string() }))
    .describe(
      'Comentarios que alguien del equipo debería mirar con cuidado: malestar, convivencia, respeto, intimidad, alguien que lo pasa mal. Vacío si no hay ninguno. No incluyas quejas normales de actividades.',
    ),
  diferencias: z
    .array(z.string())
    .describe('Diferencias llamativas entre clases o etapas, si las hay. Vacío si no hay datos o no son llamativas.'),
  siguientesPasos: z.array(z.string()).describe('Dos o tres cosas concretas que haría el equipo con esto.'),
});
export type Insights = z.infer<typeof insightsSchema>;

export const SISTEMA_IA = `Eres quien ayuda al equipo de coordinación de un colegio concertado católico (Colegio Consolación, Burriana) a leer las evaluaciones de sus actividades: tutorías, convivencias, oratorios, Godly Play, celebraciones.

Te llegan los resultados de UNA evaluación: medias de 0 a 100 (70 o más es bien; de 45 a 70, regular; menos de 45, flojo), repartos de respuestas y los comentarios escritos. Las respuestas son anónimas: nunca intentes adivinar quién escribió algo.

Cómo trabajar:
- Escribe en castellano, claro y directo, para gente con poco tiempo. Nada de relleno ni de frases de manual.
- Apóyate en los datos: cita cifras ("el 62 % pide más salidas", "la duración saca un 49") y comentarios literales cuando ayuden.
- Agrupa los comentarios por lo que piden de verdad, aunque estén escritos de formas distintas o con faltas (muchos son de niños y adolescentes). Cuenta cuántos piden cada cosa.
- Distingue lo que es una queja de la actividad de lo que es una señal de que alguien lo pasa mal: lo segundo va en "alertas".
- Las preguntas de Sí/No son preferencias, no notas: interpreta el porcentaje de Sí como una opinión.
- Si hay pocas respuestas, dilo y no saques conclusiones fuertes.
- No inventes nada que no esté en los datos.`;

function etiquetaEtapa(e: string | null): string | null {
  if (!e) return null;
  return esEtapa(e) ? ETAPA_LABEL[e] : e;
}

function pct(n: number | null): string {
  return n === null ? 'sin datos' : String(Math.round(n));
}

/**
 * El informe en texto que se le pasa al modelo. Texto y no JSON a propósito: es más corto
 * (cuesta menos) y el modelo lo lee igual de bien.
 */
export function informeParaIA(
  r: Resultados,
  opciones: { filtro: string | null; contexto?: string; destacadas?: readonly string[] },
): string {
  const destacadas = new Set(opciones.destacadas ?? r.destacadas);
  const L: string[] = [];
  const quien = r.form.audiencia === 'alumnos' ? 'alumnado' : r.form.audiencia === 'profesores' ? 'profesorado' : 'familias';

  if (opciones.contexto?.trim()) {
    L.push('## Contexto del colegio', opciones.contexto.trim(), '');
  }
  L.push(`# Evaluación: ${r.form.titulo}`);
  L.push(`Responde: ${quien}. Curso ${r.form.academicYear}.`);
  if (opciones.filtro) L.push(`OJO: solo se analizan las respuestas de ${opciones.filtro}.`);
  L.push(
    `Respuestas: ${r.totalRespuestas}${r.objetivo ? ` de ${r.objetivo} posibles` : ''}. Valoración media: ${pct(r.mediaPct)}/100.`,
  );
  const totalAnimo = r.animo.bien + r.animo.regular + r.animo.flojo;
  if (totalAnimo > 0) {
    L.push(
      `Personas según su media: ${r.animo.bien} contentas (≥70), ${r.animo.regular} regular (45-70), ${r.animo.flojo} descontentas (<45).`,
    );
  }

  const etapas = r.etapas.filter((e) => e.respuestas > 0);
  if (etapas.length > 1 && !opciones.filtro) {
    L.push('', '## Por etapa');
    for (const e of etapas) L.push(`- ${etiquetaEtapa(e.etapa)}: ${pct(e.mediaPct)}/100 (${e.respuestas} respuestas)`);
  }
  const clases = r.clases.filter((c) => c.respuestas > 0);
  if (clases.length > 1) {
    L.push('', '## Por clase');
    for (const c of clases) {
      const nombre = c.letra && c.letra !== 'PDC' ? `${c.curso} ${c.letra}` : c.curso;
      L.push(`- ${nombre}: ${pct(c.mediaPct)}/100 (${c.respuestas}${c.objetivo ? ` de ${c.objetivo}` : ''} respuestas)`);
    }
  }

  for (const b of r.bloques) {
    L.push('', `## Actividad: ${b.titulo} — media ${pct(b.mediaPct)}/100`);
    for (const q of b.preguntas) {
      if (q.tipo === 'escala') {
        const puntos = escalaDe(q.escala).puntos.map((p) => p.label);
        if (!escalaValora(q.escala)) {
          L.push(`### ${q.texto} (Sí/No: preferencia, no nota)`);
          for (const f of q.filas) {
            const si = f.distribucion.find((d) => d.label === 'Sí')?.n ?? 0;
            L.push(`- ${f.texto}: ${f.n ? Math.round((si / f.n) * 100) : 0} % dice Sí (${f.n} respuestas)`);
          }
        } else {
          L.push(`### ${q.texto} (escala: ${puntos.join(' / ')})`);
          for (const f of q.filas) {
            const reparto = f.distribucion.map((d) => `${d.label} ${d.n}`).join(', ');
            L.push(`- ${f.texto}: ${pct(f.mediaPct)}/100 [${reparto}]`);
          }
        }
      } else if (q.tipo === 'opcion' || q.tipo === 'varias' || q.tipo === 'quiz') {
        L.push(`### ${q.texto} (${q.tipo === 'quiz' ? 'pregunta de comprobación' : 'opciones'})`);
        for (const o of q.opciones.filter((o) => o.texto.trim() || o.n > 0)) {
          L.push(`- ${o.texto.trim() || '(opción sin texto)'}${o.correcta ? ' ✓ correcta' : ''}: ${o.n}`);
        }
      } else if (q.tipo === 'texto') {
        const tipos = q.textos.map((t) => ({ t, tipo: clasificarComentario(t.valor) }));
        const vacios = tipos.filter((x) => x.tipo === 'vacio').length;
        const sinCambios = tipos.filter((x) => x.tipo === 'sinCambios').length;
        const utiles = tipos.filter((x) => x.tipo === 'util');
        L.push(`### Comentarios: ${q.texto}`);
        L.push(
          `${q.textos.length} escritos: ${utiles.length} con contenido, ${sinCambios} dicen que no cambiarían nada o que todo bien, ${vacios} vacíos ("nada", "no sé").`,
        );
        // Los repetidos (mismo texto normalizado) van una vez con ×N.
        const vistos = new Map<string, { texto: string; n: number; quien: string; media: number | null; estrella: boolean }>();
        for (const { t } of utiles) {
          const clave = normalizarComentario(t.valor);
          const previo = vistos.get(clave);
          if (previo) {
            previo.n++;
            previo.estrella ||= destacadas.has(t.id);
            continue;
          }
          vistos.set(clave, {
            texto: t.valor.trim().replace(/\s+/g, ' '),
            n: 1,
            quien: t.clase ?? etiquetaEtapa(t.etapa) ?? '',
            media: t.pct,
            estrella: destacadas.has(t.id),
          });
        }
        for (const v of vistos.values()) {
          const meta = [v.quien, v.media !== null ? `su media ${Math.round(v.media)}` : null].filter(Boolean).join(', ');
          L.push(`- ${v.estrella ? '★ ' : ''}"${v.texto}"${v.n > 1 ? ` ×${v.n}` : ''}${meta ? ` (${meta})` : ''}`);
        }
      }
    }
  }
  if (destacadas.size > 0) {
    L.push('', '★ = comentario que el equipo ha marcado como importante: tenlo especialmente en cuenta.');
  }
  return L.join('\n');
}
