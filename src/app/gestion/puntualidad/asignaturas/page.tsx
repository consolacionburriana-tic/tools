export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { vePuntualidadCompleta } from '@/lib/permissions';
import { ensureSubjects } from '@/lib/puntualidad-server';
import { getTeachers } from '@/lib/educamos-server';
import { AsignaturasPanel } from '@/components/puntualidad/asignaturas-panel';

export const metadata = { title: 'Asignaturas · Puntualidad · Tools Consolación' };

// El catálogo de asignaturas lo lleva quien ve todo el centro (dirección, jefatura, TIC,
// orientación): un tutor no tiene por qué tocar la lista común.
export default async function AsignaturasPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  if (!vePuntualidadCompleta(user.role)) redirect('/gestion/puntualidad');

  const [asignaturas, profes] = await Promise.all([ensureSubjects(), getTeachers({ active: true })]);

  return (
    <AsignaturasPanel
      asignaturas={asignaturas.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        abreviatura: a.abreviatura,
        eduTeacherId: a.eduTeacherId,
        active: a.active,
      }))}
      profes={profes.map((p) => ({
        id: p.id,
        nombre: [p.nombre, p.apellido1].filter(Boolean).join(' '),
      }))}
    />
  );
}
