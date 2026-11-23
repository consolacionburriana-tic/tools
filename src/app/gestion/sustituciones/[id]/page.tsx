import { redirect } from 'next/navigation';
import { db } from '@/db';
import { sustAusencias } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// La ficha de una ausencia se abre en el panel del calendario, en su semana (enlaces de antes y del historial).
export default async function AusenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/gestion/sustituciones');
  const [a] = await db.select({ desde: sustAusencias.desde }).from(sustAusencias).where(eq(sustAusencias.id, id)).limit(1);
  redirect(a ? `/gestion/sustituciones?semana=${a.desde}&ausencia=${id}` : '/gestion/sustituciones');
}
