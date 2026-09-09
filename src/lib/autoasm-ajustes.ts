// AUTOASM · lo escrito a mano, guardado en Neon.
//
// «Traer del centro» lee de la BBDD central (`edu_students`, `edu_teachers`…) y rehace las
// filas de todo el que esté allí. Eso está bien —es la fuente de verdad del colegio—, pero
// deja fuera lo que solo existe en Apple School Manager: el correo de una cuenta de
// supervisión, el nombre con el que se ve un iPad compartido, una clase que no sale de
// ningún horario. Antes eso se escribía en el borrador del navegador y el siguiente sync
// se lo llevaba por delante.
//
// Aquí vive ahora: una fila por campo tocado (`asm_ajustes`), que se **re-aplica después**
// del sync (`aplicarAjustes`) y que, al estar en Neon, sobrevive también a cambiar de
// iPad. La tabla es pequeña por definición: son las excepciones, no los datos.
//
// Ojo con la tabla que no existe: `src/db/sql/autoasm.sql` está pendiente de aplicar en
// Neon (ver docs/19-autoasm.md). Mientras no esté, esto no puede reventar el módulo, así
// que las lecturas devuelven vacío y las escrituras dicen que falta la tabla.

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { asmAjustes } from '@/db/schema';
import { campoEditable, ESPEC, type ArchivoAsm } from '@/lib/autoasm';
import { ARCHIVOS_CREABLES, type AjusteAsm } from '@/lib/autoasm-construir';

/** Postgres 42P01 = la tabla no existe todavía. */
function faltaLaTabla(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  return codigo === '42P01' || /asm_ajustes.*does not exist|relation .*asm_ajustes/i.test(String(error));
}

export const AVISO_SIN_TABLA =
  'Falta crear la tabla `asm_ajustes` en Neon (src/db/sql/autoasm.sql): lo que escribas se guarda en este dispositivo, pero no sobrevivirá al próximo «traer del centro».';

export interface AjustesLeidos {
  ajustes: AjusteAsm[];
  /** Mensaje que la pantalla tiene que enseñar, si hay algo que decir. */
  aviso: string | null;
}

/** Todos los ajustes fijados, listos para `aplicarAjustes`. Nunca lanza. */
export async function getAjustes(): Promise<AjustesLeidos> {
  try {
    const filas = await db
      .select()
      .from(asmAjustes)
      .orderBy(asc(asmAjustes.archivo), asc(asmAjustes.clave), asc(asmAjustes.campo));
    return {
      ajustes: filas
        .filter((f) => esArchivo(f.archivo) && campoEditable(f.archivo as ArchivoAsm, f.campo))
        .map((f) => ({ archivo: f.archivo as ArchivoAsm, clave: f.clave, campo: f.campo, valor: f.valor })),
      aviso: null,
    };
  } catch (error) {
    if (faltaLaTabla(error)) return { ajustes: [], aviso: AVISO_SIN_TABLA };
    throw error;
  }
}

function esArchivo(valor: string): boolean {
  return valor in ESPEC;
}

export interface EntradaAjuste {
  archivo: ArchivoAsm;
  clave: string;
  campo: string;
  valor: string;
  quien?: string | null;
}

/**
 * Fija un ajuste (o lo actualiza). Se comprueba aquí también qué campos son tocables: el
 * navegador ya lo hace, pero esto es una API y la regla vive en un solo sitio.
 */
export async function fijarAjuste(entrada: EntradaAjuste): Promise<{ ok: boolean; error?: string }> {
  if (!ARCHIVOS_CREABLES.includes(entrada.archivo)) {
    return { ok: false, error: `Las filas de ${ESPEC[entrada.archivo]?.fichero ?? entrada.archivo} no se fijan a mano.` };
  }
  if (!campoEditable(entrada.archivo, entrada.campo)) {
    return { ok: false, error: `«${entrada.campo}» no se puede cambiar a mano.` };
  }
  const valor = entrada.campo === 'email_address' ? entrada.valor.trim().toLowerCase() : entrada.valor.trim();
  try {
    await db
      .insert(asmAjustes)
      .values({ archivo: entrada.archivo, clave: entrada.clave, campo: entrada.campo, valor, quien: entrada.quien ?? null })
      .onConflictDoUpdate({
        target: [asmAjustes.archivo, asmAjustes.clave, asmAjustes.campo],
        set: { valor, quien: entrada.quien ?? null, updatedAt: new Date() },
      });
    return { ok: true };
  } catch (error) {
    if (faltaLaTabla(error)) return { ok: false, error: AVISO_SIN_TABLA };
    throw error;
  }
}

/** Suelta un ajuste: a partir de aquí, ese campo vuelve a ser lo que diga el centro. */
export async function soltarAjuste(entrada: { archivo: string; clave: string; campo: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    await db
      .delete(asmAjustes)
      .where(
        and(eq(asmAjustes.archivo, entrada.archivo), eq(asmAjustes.clave, entrada.clave), eq(asmAjustes.campo, entrada.campo)),
      );
    return { ok: true };
  } catch (error) {
    if (faltaLaTabla(error)) return { ok: false, error: AVISO_SIN_TABLA };
    throw error;
  }
}
