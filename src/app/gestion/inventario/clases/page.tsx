export const dynamic = 'force-dynamic';

import { cargarInventario } from '@/lib/inventario-server';
import { cursoParaAjustar, cursoPosterior } from '@/lib/inventario';
import { AjusteClases } from '@/components/inventario/ajuste-clases';

export const metadata = { title: 'Clases de cada aula · Inventario y aulas' };

export default async function ClasesPage({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const [inv, { curso: pedido }] = await Promise.all([cargarInventario(), searchParams]);
  const validos = [inv.cursoActual, cursoPosterior(inv.cursoActual)];
  const curso = pedido && validos.includes(pedido) ? pedido : cursoParaAjustar(inv.hoy, inv.cursoActual);
  // Las clases que hay este curso en Educamos: la base de lo que se puede elegir.
  const opciones = Object.keys(inv.alumnos);
  return <AjusteClases key={curso} inv={inv} curso={curso} opciones={opciones} />;
}
