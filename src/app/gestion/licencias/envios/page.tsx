export const dynamic = 'force-dynamic';

import { EnviosPanel } from '@/components/licencias/envios-panel';
import { Subpantalla } from '@/components/licencias/subpantalla';
import { Vacio } from '@/components/ui/vacio';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { PLANTILLAS_LICENCIA } from '@/lib/licencias-email';

export const metadata = { title: 'Envío de licencias · Licencias' };

// A todo el ancho del módulo a propósito: es una hoja de cálculo, no un formulario, y
// estrecha no caben las columnas del código y del destino.
export default async function EnviosPage() {
  const campaign = await getCurrentCampaign();
  return (
    <Subpantalla titulo="Envío de licencias" descripcion="Pegar los códigos que llegan y mandárselos a cada alumno.">
      {campaign ? (
        <EnviosPanel
          presets={PLANTILLAS_LICENCIA.map((p) => ({
            clave: p.clave,
            nombre: p.nombre,
            subject: p.subject,
            body: p.body,
          }))}
        />
      ) : (
        <Vacio titulo="No hay campaña activa" />
      )}
    </Subpantalla>
  );
}
