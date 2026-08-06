export const dynamic = 'force-dynamic';

import { getCurrentCampaign } from '@/lib/licencias-server';
import { HomeLanding } from '@/components/home/home-landing';

export default async function HomePage() {
  const campaign = await getCurrentCampaign();
  const cursoLabel = campaign ? `Curso ${campaign.academicYear}` : null;
  return <HomeLanding cursoLabel={cursoLabel} />;
}
