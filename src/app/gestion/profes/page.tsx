export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTeachers } from '@/lib/educamos-server';
import { getClasesConTutores } from '@/lib/tutorias-server';
import { TutoriasPanel } from '@/components/profes/tutorias-panel';
import { NombresPanel } from '@/components/profes/nombres-panel';
import { nombreProfeBreve, nombresDeProfe } from '@/lib/profes';
import { mayusculasBellas, nombreDePila } from '@/lib/personas';

export const metadata = { title: 'Profesorado · Gestión' };

export default async function ProfesPage() {
  const [clases, profes] = await Promise.all([getClasesConTutores(), getTeachers()]);
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100">Profesorado</h1>
            <p className="text-xs text-zinc-500">
              Tutores de cada clase, reparto del alumnado entre ellos y el nombre con el que sale cada profe
            </p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <TutoriasPanel
          clases={clases}
          profes={profes
            .filter((p) => p.email)
            .map((p) => ({
              id: p.id,
              nombre: nombreProfeBreve(p),
              etapa: p.etapa,
              esTutor: p.esTutor,
              claseTutor: p.claseTutor,
            }))}
        />
        {/* El "given name": se ajusta aquí y sale en todas las salidas del centro. */}
        <NombresPanel
          profes={profes.map((p) => ({
            id: p.id,
            nombre: nombresDeProfe(p).usual,
            etapa: p.etapa,
            esTutor: p.esTutor,
            claseTutor: p.claseTutor,
            educamos: nombresDeProfe(p).completo,
            nombreMostrado: p.nombreMostrado,
            pilaSugerida: nombreDePila(p.nombre),
            apellidos: [mayusculasBellas(p.apellido1), mayusculasBellas(p.apellido2)].filter(Boolean).join(' '),
          }))}
        />
      </main>
    </div>
  );
}
