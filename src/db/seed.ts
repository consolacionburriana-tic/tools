import { db } from './index';
import { students, teachers } from './schema';

async function seed() {
  console.log('Sembrando datos iniciales...');

  // Crear alumno de ejemplo
  const [student] = await db
    .insert(students)
    .values({
      fullName: 'R. Herreros',
      displayName: 'R. H.',
      className: '2 ESO A',
      active: true,
    })
    .onConflictDoNothing()
    .returning();

  console.log('Alumno creado:', student?.displayName ?? 'ya existía');

  // Crear profesores de ejemplo
  const teacherData = [
    {
      firstName: 'María',
      lastName: 'García López',
      email: 'maria.garcia@consolacionburriana.es',
      stage: 'ESO' as const,
    },
    {
      firstName: 'Carlos',
      lastName: 'Martínez Pérez',
      email: 'carlos.martinez@consolacionburriana.es',
      stage: 'Orientacion' as const,
    },
  ];

  for (const teacher of teacherData) {
    const [created] = await db
      .insert(teachers)
      .values(teacher)
      .onConflictDoNothing()
      .returning();
    console.log('Profesor creado:', created ? `${created.firstName} ${created.lastName}` : 'ya existía');
  }

  console.log('¡Seed completado!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});
