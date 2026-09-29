export const dynamic = 'force-dynamic';

import { getSessionUser } from '@/lib/auth-guards';
import { puedeGestionarParticipantesBanco } from '@/lib/permissions';
import { claseLabel, getClasesDisponibles } from '@/lib/salidas-server';
import { cursoEnBanco, etapaDeCurso } from '@/lib/cursos';
import { getAlumnosFueraDeCampania, getResumenClases } from '@/lib/bancolibros-server';
import { etapasDeAlcance } from '@/lib/alumnado-server';
import { cursoEnAlcance } from '@/lib/bancolibros-alcance';
import { BancoPanel } from '@/components/bancolibros/banco-panel';

export const metadata = { title: 'Banco de libros · Gestión' };

export default async function BancoLibrosPage() {
  // El banco de libros arranca en 3º de primaria: infantil, 1º y 2º de EP se ocultan.
  const user = await getSessionUser();
  const etapas = user ? await etapasDeAlcance(user) : [];
  const [clasesRaw, resumen, fueraDeCampania] = await Promise.all([
    getClasesDisponibles(),
    getResumenClases(),
    getAlumnosFueraDeCampania(),
  ]);
  const clases = clasesRaw
    .filter((c) => cursoEnBanco(c.curso) && cursoEnAlcance(etapas, c.curso))
    .map((c) => ({ ...c, label: claseLabel(c), etapa: etapaDeCurso(c.curso) }));
  return (
    <BancoPanel
      clases={clases}
      resumenInicial={resumen.filter((r) => cursoEnBanco(r.curso) && cursoEnAlcance(etapas, r.curso))}
      fueraDeCampania={fueraDeCampania.filter((a) => cursoEnAlcance(etapas, a.curso))}
      puedeGestionarParticipantes={puedeGestionarParticipantesBanco(user?.role ?? null)}
    />
  );
}
