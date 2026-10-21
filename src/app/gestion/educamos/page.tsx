export const dynamic = 'force-dynamic';

import { Database, GraduationCap, History } from 'lucide-react';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { eduStudents, eduSyncRuns, eduTeachers } from '@/db/schema';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { TarjetaEnlace } from '@/components/ui/tarjeta';
import { Aviso } from '@/components/ui/aviso';

export const metadata = { title: 'BBDD central · Educamos' };

export default async function EducamosPage() {
  const [[alumnos], [profes], [ultimoSync]] = await Promise.all([
    db.select({ n: count() }).from(eduStudents).where(eq(eduStudents.active, true)),
    db.select({ n: count() }).from(eduTeachers).where(eq(eduTeachers.active, true)),
    db.select().from(eduSyncRuns).orderBy(desc(eduSyncRuns.createdAt)).limit(1),
  ]);

  return (
    <div className="anim-stagger space-y-4">
      <h1 className="sr-only">BBDD central (Educamos): alumnado, tutores y profesorado que consumen todos los módulos</h1>
      <Cifras className="grid-cols-1 min-[420px]:grid-cols-3 sm:grid-cols-3">
        <Cifra etiqueta="Alumnado activo" valor={alumnos.n} />
        <Cifra etiqueta="Profesorado activo" valor={profes.n} />
        <Cifra
          etiqueta="Último sync"
          valor={
            ultimoSync
              ? new Date(ultimoSync.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
              : '—'
          }
          nota={ultimoSync ? <span className="block truncate">{ultimoSync.filename}</span> : undefined}
        />
      </Cifras>

      <TarjetaEnlace
        href="/gestion/educamos/sincronizar"
        icono={<GraduationCap aria-hidden />}
        titulo="Sincronizar"
        descripcion="Alumnado y profesorado, en la misma pantalla: subes el export, revisas y aplicas"
      />

      <TarjetaEnlace
        href="/gestion/educamos/historial"
        icono={<History aria-hidden />}
        titulo="Historial de sincronizaciones"
        descripcion="Qué se subió, cuándo, quién y con qué resultado"
      />

      <Aviso icono={<Database />}>
        Los ficheros se procesan en memoria y nunca se guardan. Los datos bancarios no se importan.
      </Aviso>
    </div>
  );
}
