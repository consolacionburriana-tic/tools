// AUTOASM · lo único que este módulo lee de la base de datos: quién hay en el centro.
//
// Se piden SOLO las columnas que acaban en los CSV de Apple School Manager (nombre,
// apellidos, curso y correo). Ni teléfonos, ni DNI, ni familias: lo que no se pide no
// puede acabar por error en un fichero que se sube a un servicio de fuera.

import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { eduStudents, eduTeachers } from '@/db/schema';
import type { SnapshotCentro } from '@/lib/autoasm-construir';

export async function getSnapshotCentro(): Promise<SnapshotCentro> {
  const [alumnos, profes] = await Promise.all([
    db
      .select({
        nia: eduStudents.nia,
        codigo: eduStudents.codigo,
        nombre: eduStudents.nombre,
        apellido1: eduStudents.apellido1,
        apellido2: eduStudents.apellido2,
        curso: eduStudents.curso,
        letra: eduStudents.letra,
        email: eduStudents.email,
        emailGoogle: eduStudents.emailGoogle,
      })
      .from(eduStudents)
      .where(eq(eduStudents.active, true))
      .orderBy(asc(eduStudents.curso), asc(eduStudents.letra), asc(eduStudents.apellido1)),
    db
      .select({
        alias: eduTeachers.alias,
        nombre: eduTeachers.nombre,
        apellido1: eduTeachers.apellido1,
        apellido2: eduTeachers.apellido2,
        email: eduTeachers.email,
      })
      .from(eduTeachers)
      .where(eq(eduTeachers.active, true))
      .orderBy(asc(eduTeachers.apellido1), asc(eduTeachers.nombre)),
  ]);

  return { alumnos, profes, generado: new Date().toISOString() };
}
