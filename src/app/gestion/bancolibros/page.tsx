export const dynamic = 'force-dynamic';

import { claseLabel, getClasesDisponibles } from '@/lib/salidas-server';
import { cursoEnBanco, etapaDeCurso } from '@/lib/cursos';
import { BancoPanel } from '@/components/bancolibros/banco-panel';

export const metadata = { title: 'Banco de libros · Gestión' };

export default async function BancoLibrosPage() {
  // El banco de libros arranca en 3º de primaria: infantil, 1º y 2º de EP se ocultan.
  const clases = (await getClasesDisponibles())
    .filter((c) => cursoEnBanco(c.curso))
    .map((c) => ({ ...c, label: claseLabel(c), etapa: etapaDeCurso(c.curso) }));
  return <BancoPanel clases={clases} />;
}
