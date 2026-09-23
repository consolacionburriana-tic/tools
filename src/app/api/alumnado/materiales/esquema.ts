import { z } from 'zod';

/** Lo que se manda al crear o editar un material. Compartido por las dos rutas. */
export const esquemaMaterial = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre').max(80),
  importe: z.number().min(0).max(9999).nullable(),
  notas: z.string().max(300).nullable(),
  destinos: z
    .array(
      z.discriminatedUnion('tipo', [
        z.object({ tipo: z.literal('etapa'), etapa: z.enum(['EI', 'EP', 'ESO']) }),
        z.object({ tipo: z.literal('curso'), curso: z.string().min(1).max(20) }),
        z.object({ tipo: z.literal('clase'), curso: z.string().min(1).max(20), letra: z.string().max(10).nullable() }),
      ]),
    )
    .min(1, 'Elige al menos una etapa, curso o clase')
    .max(60),
});
