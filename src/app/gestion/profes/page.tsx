export const dynamic = 'force-dynamic';

import { getTeachers } from '@/lib/educamos-server';
import { getClasesConTutores } from '@/lib/tutorias-server';
import { TutoriasPanel } from '@/components/profes/tutorias-panel';
import { EtapasPanel } from '@/components/profes/etapas-panel';
import { etapasAutomaticasPorProfe } from '@/lib/alumnado-server';
import { esEtapa } from '@/lib/cursos';
import { NombresPanel } from '@/components/profes/nombres-panel';
import { nombreProfeBreve, nombresDeProfe } from '@/lib/profes';
import { mayusculasBellas, nombreDePila } from '@/lib/personas';

export const metadata = { title: 'Profesorado · Gestión' };

export default async function ProfesPage() {
  const [clases, profes, automaticas] = await Promise.all([
    getClasesConTutores(),
    getTeachers(),
    etapasAutomaticasPorProfe(),
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
    </div>
  );
}
