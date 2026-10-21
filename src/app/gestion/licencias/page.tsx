export const dynamic = 'force-dynamic';

import { getCurrentCampaign, getDashboardStats } from '@/lib/licencias-server';
import { PanelLicencias } from '@/components/licencias/panel';

export const metadata = { title: 'Panel · Licencias' };

export default async function GestionPage() {
  const campaign = await getCurrentCampaign();
  const stats = campaign ? await getDashboardStats(campaign.id) : null;
  return (
    <>
      <h1 className="sr-only">Panel de licencias digitales</h1>
      <PanelLicencias campaign={campaign} stats={stats} />
    </>
  );
}
