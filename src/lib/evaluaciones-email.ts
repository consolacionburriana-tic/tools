// Correos de Evaluaciones (servidor). Reutiliza los primitivos de envío masivo de `correos.ts`
// (variables, escapado, enlaces clicables y lotes) — aquí solo vive el armado de destinatarios;
// las plantillas de fábrica están en `evaluaciones-plantillas.ts` porque las usa el panel.
import { sendChunks, type BlastItem } from '@/lib/correos';
import { varsDeDestinatario } from '@/lib/evaluaciones';

export { PLANTILLAS_FABRICA, type PlantillaFabrica } from '@/lib/evaluaciones-plantillas';

export interface DestinatarioCorreo {
  email: string;
  nombre: string;
  curso?: string | null;
  /** Enlace ya montado: personalizado en alumnado, común en profesorado. */
  enlace: string;
}

export interface EnvioInput {
  destinatarios: DestinatarioCorreo[];
  subject: string;
  body: string;
  titulo: string;
  academicYear: string;
  /** Correo de quien lo manda: las respuestas van a esa persona, no a un buzón sin dueño. */
  replyTo?: string;
}

const CTA_LABEL = 'Rellenar la evaluación';

export async function enviarEvaluacion(input: EnvioInput): Promise<{ sent: number; errors: number; skipped: boolean }> {
  const items: BlastItem[] = input.destinatarios.map((d) => ({
    email: d.email,
    vars: varsDeDestinatario({
      nombre: d.nombre,
      curso: d.curso ?? null,
      titulo: input.titulo,
      enlace: d.enlace,
      academicYear: input.academicYear,
    }),
    cta: { url: d.enlace, label: CTA_LABEL },
  }));
  return sendChunks(items, input.subject, input.body, { perfil: 'evaluaciones', replyTo: input.replyTo });
}
