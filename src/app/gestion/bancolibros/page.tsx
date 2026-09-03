export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { claseLabel, getClasesDisponibles } from '@/lib/salidas-server';
import { cursoEnBanco, etapaDeCurso } from '@/lib/cursos';
import { getAlumnosFueraDeCampania, getResumenClases } from '@/lib/bancolibros-server';
import { BancoPanel } from '@/components/bancolibros/banco-panel';

export const metadata = { title: 'Banco de libros · Gestión' };

export default async function BancoLibrosPage() {
  // El banco de libros arranca en 3º de primaria: infantil, 1º y 2º de EP se ocultan.
  const [user, clasesRaw, resumen, fueraDeCampania] = await Promise.all([
    getSessionUser(),
    getClasesDisponibles(),
    getResumenClases(),
    getAlumnosFueraDeCampania(),
  ]);
  const clases = clasesRaw
    .filter((c) => cursoEnBanco(c.curso))
    .map((c) => ({ ...c, label: claseLabel(c), etapa: etapaDeCurso(c.curso) }));
  return (
    <BancoPanel
      clases={clases}
      resumenInicial={resumen.filter((r) => cursoEnBanco(r.curso))}
      fueraDeCampania={fueraDeCampania}
      puedeGestionarParticipantes={puedeGestionarParticipantesBanco(user?.role ?? null)}
    />
  );
}
