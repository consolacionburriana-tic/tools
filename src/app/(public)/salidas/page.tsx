export const dynamic = 'force-dynamic';

import { SalidasFamilia } from '@/components/salidas/salidas-familia';
import { PaginaFamilias } from '@/components/ui/pagina-familias';

export const metadata = {
  title: 'Salidas y pagos · Consolación',
  description: 'Justificantes de pago de salidas escolares',
};

// Magic link de familias: `/salidas?t=tok_…` (se acepta `?tok=` como alias porque es lo
// que la gente teclea al copiar el enlace a mano). El token se valida al identificar.
export default async function SalidasPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tok?: string }>;
}) {
  const { t, tok } = await searchParams;
  const tokenAcceso = (t ?? tok ?? '').trim() || null;

  return (
    <PaginaFamilias titulo="Salidas y pagos" subtitulo="Colegio Consolación Burriana">
      <SalidasFamilia tokenAcceso={tokenAcceso} />
    </PaginaFamilias>
  );
}
