import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eduTeachers, teachers } from '@/db/schema';
import { hasModule } from '@/lib/auth-guards';

// Catálogo de profes para pintar nombres en el panel ABC: unión del profesorado de la
// BBDD central (registros nuevos, edu_teacher_id) y de la tabla legada (registros
// anteriores al login). La gestión de profesorado vive en /gestion/educamos.
export async function GET() {
  if (!(await hasModule('abc'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const [edu, legacy] = await Promise.all([db.select().from(eduTeachers), db.select().from(teachers)]);
    const result = [
      ...edu.map((t) => ({
        id: t.id,
        firstName: t.nombre ?? '',
        lastName: [t.apellido1, t.apellido2].filter(Boolean).join(' '),
        email: t.email ?? '',
        stage: t.claseTutor ?? '',
        active: t.active,
      })),
      ...legacy.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        stage: t.stage,
        active: t.active,
      })),
    ];
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cargando profesores:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
