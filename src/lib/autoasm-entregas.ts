// AUTOASM · lo único que el módulo guarda en Neon: el histórico de entregas y el FTP.
//
// El "qué se subió" (alumnado, clases, matrículas) no se guarda: eso es el ZIP, y vive en
// el navegador de quien lo prepara y en Apple School Manager. Aquí queda **el diario**:
// qué día se generó, con qué alcance, cuántas filas llevaba y si llegó a subirse — que es
// justo lo que hace falta para saber, en enero, si aquello se terminó o se quedó a medias.

import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { asmEntregas, asmFtpConfig, eduStudents, type AsmEntrega } from '@/db/schema';
import { academicYearActual } from '@/lib/constants';
import { cifrar, descifrar } from '@/lib/cripto';
import { entraEnAlcance } from '@/lib/autoasm-construir';
import { gradeLevelDe } from '@/lib/autoasm';

export type ModoEntrega = 'descargado' | 'ftp' | 'manual';

export interface NuevaEntrega {
  modo: ModoEntrega;
  estado?: 'ok' | 'error';
  quien?: string | null;
  desdeCurso?: string | null;
  recuentos: { alumnos: number; profes: number; cursos: number; clases: number; matriculas: number };
  errores?: number;
  avisos?: number;
  fichero?: string | null;
  destino?: string | null;
  detalle?: string | null;
}

export async function registrarEntrega(entrada: NuevaEntrega): Promise<AsmEntrega> {
  const [fila] = await db
    .insert(asmEntregas)
    .values({
      academicYear: academicYearActual(),
      modo: entrada.modo,
      estado: entrada.estado ?? 'ok',
      quien: entrada.quien ?? null,
      desdeCurso: entrada.desdeCurso ?? null,
      alumnos: entrada.recuentos.alumnos,
      profes: entrada.recuentos.profes,
      cursos: entrada.recuentos.cursos,
      clases: entrada.recuentos.clases,
      matriculas: entrada.recuentos.matriculas,
      errores: entrada.errores ?? 0,
      avisos: entrada.avisos ?? 0,
      fichero: entrada.fichero ?? null,
      destino: entrada.destino ?? null,
      detalle: entrada.detalle ?? null,
    })
    .returning();
  return fila;
}

/**
 * Marca una entrega ya registrada como subida (a mano o por FTP). Es lo que convierte el
 * "me lo he descargado" en "esto está en ASM".
 */
export async function marcarSubida(id: string, modo: ModoEntrega, detalle?: string | null, destino?: string | null): Promise<void> {
  await db
    .update(asmEntregas)
    .set({ modo, estado: 'ok', detalle: detalle ?? null, destino: destino ?? null })
    .where(eq(asmEntregas.id, id));
}

export async function getEntregas(limite = 12): Promise<AsmEntrega[]> {
  return db.select().from(asmEntregas).orderBy(desc(asmEntregas.createdAt)).limit(limite);
}

// ─── Estado del módulo (lo que decide dónde sale en el escritorio) ────────────

export interface AlumnoSinPasar {
  nombre: string;
  grupo: string;
  alta: string; // ISO
}

export interface EstadoAutoasm {
  /** Última entrega SUBIDA (a mano o por FTP) del curso académico en vigor. */
  ultimaSubida: AsmEntrega | null;
  /** Última vez que se generó algo, aunque se quedara sin subir. */
  ultimaEntrega: AsmEntrega | null;
  /**
   * Alumnado dado de alta DESPUÉS de la última subida y **dentro del alcance** de esa
   * subida: los que hoy no tendrían cuenta en ASM. Si la última entrega fue de 6º EP para
   * arriba y entran cinco de 1º de primaria, esto sigue a cero — y el módulo no molesta.
   */
  alumnosSinPasar: AlumnoSinPasar[];
  /** Julio, agosto o septiembre y todavía sin subir nada de este curso. */
  esTemporada: boolean;
}

const MESES_DE_ARRANQUE = [6, 7, 8]; // julio, agosto y septiembre (0 = enero)

export async function getEstadoAutoasm(ahora = new Date()): Promise<EstadoAutoasm> {
  const academicYear = academicYearActual(ahora);
  const [subidas, ultimas] = await Promise.all([
    db
      .select()
      .from(asmEntregas)
      .where(and(eq(asmEntregas.academicYear, academicYear), sql`${asmEntregas.modo} in ('ftp','manual')`, eq(asmEntregas.estado, 'ok')))
      .orderBy(desc(asmEntregas.createdAt))
      .limit(1),
    db.select().from(asmEntregas).orderBy(desc(asmEntregas.createdAt)).limit(1),
  ]);

  const ultimaSubida = subidas[0] ?? null;
  const esTemporada = MESES_DE_ARRANQUE.includes(ahora.getMonth()) && ultimaSubida === null;

  let alumnosSinPasar: AlumnoSinPasar[] = [];
  if (ultimaSubida) {
    const nuevos = await db
      .select({
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
        createdAt: eduStudents.createdAt,
      })
      .from(eduStudents)
      .where(and(eq(eduStudents.active, true), gt(eduStudents.createdAt, ultimaSubida.createdAt)));

    alumnosSinPasar = nuevos
      // Solo molestan los que habrían entrado en esa misma entrega: si ASM va de 6º EP
      // para arriba, un alta de 1º de primaria no es asunto de este módulo.
      .filter((a) => entraEnAlcance(a.curso, ultimaSubida.desdeCurso))
      .map((a) => ({
        nombre: [a.nombre, a.apellido1, a.apellido2].filter(Boolean).join(' '),
        grupo: gradeLevelDe(a.curso, a.letra),
        alta: a.createdAt.toISOString(),
      }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  }

  return { ultimaSubida, ultimaEntrega: ultimas[0] ?? null, alumnosSinPasar, esTemporada };
}

// ─── Configuración del FTP ────────────────────────────────────────────────────

export interface ConfigFtpPublica {
  protocolo: 'ftps' | 'ftp' | 'sftp';
  host: string;
  puerto: number | null;
  usuario: string;
  ruta: string;
  notas: string | null;
  actualizadoPor: string | null;
  actualizado: string | null;
}

/** La configuración SIN la contraseña: es lo único que sale hacia el navegador. */
export async function getConfigFtpPublica(): Promise<ConfigFtpPublica | null> {
  const [fila] = await db.select().from(asmFtpConfig).limit(1);
  if (!fila) return null;
  return {
    protocolo: fila.protocolo as ConfigFtpPublica['protocolo'],
    host: fila.host,
    puerto: fila.puerto,
    usuario: fila.usuario,
    ruta: fila.ruta,
    notas: fila.notas,
    actualizadoPor: fila.actualizadoPor,
    actualizado: fila.updatedAt.toISOString(),
  };
}

export interface GuardarConfigFtp {
  protocolo: 'ftps' | 'ftp' | 'sftp';
  host: string;
  puerto?: number | null;
  usuario: string;
  /** Si viene vacía en una edición, se conserva la que ya había. */
  password?: string;
  ruta: string;
  notas?: string | null;
  quien?: string | null;
}

export async function guardarConfigFtp(entrada: GuardarConfigFtp): Promise<void> {
  const [actual] = await db.select().from(asmFtpConfig).limit(1);
  const passwordCifrada = entrada.password ? cifrar(entrada.password) : actual?.passwordCifrada;
  if (!passwordCifrada) throw new Error('Hace falta la contraseña del FTP la primera vez');

  const valores = {
    protocolo: entrada.protocolo,
    host: entrada.host.trim(),
    puerto: entrada.puerto ?? null,
    usuario: entrada.usuario.trim(),
    passwordCifrada,
    ruta: entrada.ruta.trim() || '/',
    notas: entrada.notas ?? null,
    actualizadoPor: entrada.quien ?? null,
    updatedAt: new Date(),
  };

  if (actual) await db.update(asmFtpConfig).set(valores).where(eq(asmFtpConfig.id, actual.id));
  else await db.insert(asmFtpConfig).values(valores);
}

export async function borrarConfigFtp(): Promise<void> {
  await db.delete(asmFtpConfig);
}

/** La configuración completa, contraseña incluida. Solo para el servidor que sube. */
export async function getConfigFtpCompleta(): Promise<(ConfigFtpPublica & { password: string }) | null> {
  const [fila] = await db.select().from(asmFtpConfig).limit(1);
  if (!fila) return null;
  return {
    protocolo: fila.protocolo as ConfigFtpPublica['protocolo'],
    host: fila.host,
    puerto: fila.puerto,
    usuario: fila.usuario,
    ruta: fila.ruta,
    notas: fila.notas,
    actualizadoPor: fila.actualizadoPor,
    actualizado: fila.updatedAt.toISOString(),
    password: descifrar(fila.passwordCifrada),
  };
}
