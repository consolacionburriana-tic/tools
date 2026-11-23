import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { eduTeachers } from '@/db/schema';
import { getSessionUser } from '@/lib/auth-guards';
import { etapasActivas } from '@/lib/jefaturas-server';
import { datosBajas } from '@/lib/bajas-server';
import { etapasDePersona } from '@/lib/sustituciones';
import { Bajas } from '@/components/sustituciones/bajas';
import { FiltroJefatura } from '@/components/sustituciones/comun';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bajas · Sustituciones' };

export default async function BajasPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const [datos, { grupo, etapas }, fichas] = await Promise.all([
    datosBajas(),
    etapasActivas(user.email),
    db.select({ id: eduTeachers.id, etapa: eduTeachers.etapa, etapas: eduTeachers.etapas }).from(eduTeachers).where(eq(eduTeachers.active, true)),
  ]);
  // Cada jefatura ve las bajas de su etapa (quien no tiene etapa en la ficha sale en todas).
  const de = new Map(fichas.map((f) => [f.id, etapasDePersona([], f)]));
  const mia = (id: string) => {
    const es = de.get(id) ?? [];
    return es.length === 0 || es.some((e) => etapas.includes(e));
  };
  const vistos = { ...datos, bajas: datos.bajas.filter((b) => mia(b.profeId)), sinBaja: datos.sinBaja.filter((c) => mia(c.titularId)) };
  return (
    <div className="space-y-5">
      <h1 className="sr-only">Bajas del profesorado</h1>
      <FiltroJefatura grupo={grupo} />
      <Bajas datos={vistos} />
    </div>
  );
}
