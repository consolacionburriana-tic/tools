// Consultas de la portada pública (`/`). Una sola función: qué trámites hay abiertos
// ahora mismo. La decisión de qué se enseña y cómo se titula es pura y vive en
// `@/lib/portada`; aquí solo se va a buscar el dato a cada módulo.
//
// Todas las consultas van en paralelo y son las más baratas que tiene cada módulo: la
// portada es la página que más se abre de todo el sitio (es el icono de la PWA) y no
// puede pagar el arranque de un panel.
import { getCurrentCampaign } from '@/lib/licencias-server';
import { getSalidasParaFamilias } from '@/lib/salidas-server';
import { accesosPortada, type AccesoPortada } from '@/lib/portada';

export async function getAccesosPortada(): Promise<AccesoPortada[]> {
  const [campaign, salidas] = await Promise.all([getCurrentCampaign(), getSalidasParaFamilias()]);
  return accesosPortada({ campaign, salidas });
}
