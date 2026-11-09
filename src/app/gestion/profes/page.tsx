export const dynamic = 'force-dynamic';

import { getTeachers } from '@/lib/educamos-server';
import { getSessionUser } from '@/lib/auth-guards';
import { puedeEmularUsuarios } from '@/lib/emulacion';
import { EmularPanel } from '@/components/profes/emular-panel';
import { getClasesConTutores } from '@/lib/tutorias-server';
import { TutoriasPanel } from '@/components/profes/tutorias-panel';
import { EtapasPanel } from '@/components/profes/etapas-panel';
import { etapasAutomaticasPorProfe } from '@/lib/alumnado-server';
import { esEtapa } from '@/lib/cursos';
import { NombresPanel } from '@/components/profes/nombres-panel';
import { SustitucionesPanel } from '@/components/profes/sustituciones-panel';
import { listarSustituciones } from '@/lib/sustituciones-server';
import { nombreProfeBreve, nombresDeProfe } from '@/lib/profes';
import { mayusculasBellas, nombreDePila } from '@/lib/personas';

export const metadata = { title: 'Profesorado · Gestión' };

export default async function ProfesPage() {
  const [user, clases, profes, automaticas, sustituciones] = await Promise.all([
    getSessionUser(),
    getClasesConTutores(),
    getTeachers(),
    etapasAutomaticasPorProfe(),
    listarSustituciones(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Profesorado y tutorías</h1>
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
      {/* Quién cubre a quién: el sustituto hereda las tutorías y los avisos del titular mientras dure. */}
      <SustitucionesPanel
        filas={sustituciones}
        profes={profes.map((p) => ({ id: p.id, nombre: nombresDeProfe(p).usual }))}
      />
      {/* Multiselección: hay quien da clase en dos etapas. Decide qué ve en Alumnado y Banco. */}
      <EtapasPanel
        profes={profes
          .filter((p) => p.email)
          .map((p) => ({
            id: p.id,
            nombre: nombresDeProfe(p).usual,
            etapa: p.etapa,
            esTutor: p.esTutor,
            claseTutor: p.claseTutor,
            etapas: p.etapas ?? (esEtapa(p.etapa) ? [p.etapa] : []),
            automaticas: automaticas.get(p.id) ?? [],
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
      {/* Solo el SuperTIC (también si ya está emulando a alguien: puede saltar directo a otra persona). */}
      {user && (user.emulando || puedeEmularUsuarios(user.role)) && (
        <EmularPanel
          miEmail={user.emulando?.email ?? user.email}
          profes={profes
            .filter((p) => p.email)
            .map((p) => ({
              id: p.id,
              email: p.email!.toLowerCase(),
              nombre: nombreProfeBreve(p),
              etapa: p.etapa,
              esTutor: p.esTutor,
              claseTutor: p.claseTutor,
            }))}
        />
      )}
    </div>
  );
}
