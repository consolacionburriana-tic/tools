import ConfirmarSustitucion from './confirmar-sustitucion';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ConfirmarSustitucion token={token} />;
}
