export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guards';
import { getAlumnosSeguimiento, getTeacherFromSession } from '@/lib/abc-server';
import { RegistroForm } from '@/components/registro-abc/registro-form';

export const metadata = {
  title: 'Registro ABC · Consolación',
  description: 'Registro de conductas · Análisis A-B-C',
};

// Detrás del login (cualquier persona del claustro): el profesor sale de la sesión.
export default async function RegistroAbcPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/registro-abc');

  const [alumnos, profe] = await Promise.all([
    getAlumnosSeguimiento(),
    getTeacherFromSession(user.email),
  ]);
  const registradoPor = profe
    ? [profe.nombre, profe.apellido1, profe.apellido2].filter(Boolean).join(' ')
    : (user.nombre ?? user.email);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Cabecera mínima de tool autónoma — sin navegación al hub */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Registro ABC</h1>
          <span className="text-xs text-zinc-400">{registradoPor}</span>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <RegistroForm alumnos={alumnos} registradoPor={registradoPor} />
      </main>
    </div>
  );
}
