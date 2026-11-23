import { datosBajas } from '@/lib/bajas-server';
import { Bajas } from '@/components/sustituciones/bajas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bajas · Sustituciones' };

export default async function BajasPage() {
  const datos = await datosBajas();
  return (
    <>
      <h1 className="sr-only">Bajas del profesorado</h1>
      <Bajas datos={datos} />
    </>
  );
}
