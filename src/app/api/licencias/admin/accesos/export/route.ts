import { hasModule } from '@/lib/auth-guards';
import { appBaseUrl } from '@/lib/constants';
import { urlAccesoFamilia } from '@/lib/familias';
import { getTokensVigentes } from '@/lib/fam-tokens-server';
import { getCurrentCampaign, getFamiliaRecipients } from '@/lib/licencias-server';
import { cursoLabel } from '@/lib/licencias';
import { toCsv } from '@/lib/licencias-exports';

const isAdmin = () => hasModule('licencias');

// CSV con los enlaces de acceso de cada familia (para mail-merge externo o para revisarlos).
// ⚠️ Contiene magic links: quien tenga el fichero puede entrar como esa familia. No se sube
// a ningún sitio compartido — se usa y se borra.
export async function GET() {
  if (!(await isAdmin())) return new Response('No autorizado', { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return new Response('Sin campaña', { status: 404 });

  const { familias } = await getFamiliaRecipients(campaign.id);
  const tokens = await getTokensVigentes(
    'licencias',
    familias.map((f) => f.email),
  );
  const base = appBaseUrl();

  const rows = familias.map((f) => {
    const t = tokens.get(f.email);
    return [
      f.email,
      f.tutorNombre ?? '',
      f.hijos.map((h) => `${h.nombre} (${cursoLabel(h.curso)})`).join(' · '),
      f.hijos.filter((h) => !h.conPedido).length,
      t ? urlAccesoFamilia(base, 'licencias', t.token) : '(sin enlace: genéralos primero)',
      t?.useCount ?? 0,
      t?.sentAt ? t.sentAt.toISOString().slice(0, 10) : '',
      t?.expiresAt ? t.expiresAt.toISOString().slice(0, 10) : '',
    ];
  });

  const header = ['Correo', 'Tutor/a', 'Hijos en la campaña', 'Sin pedido', 'Enlace de acceso', 'Usos', 'Enviado', 'Caduca'];
  return new Response(toCsv(header, rows), {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="Enlaces-familias-${campaign.academicYear.replace('/', '-')}.csv"`,
    },
  });
}
