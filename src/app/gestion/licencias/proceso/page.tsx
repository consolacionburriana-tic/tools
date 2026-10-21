export const dynamic = 'force-dynamic';

import { ProcesoEsquema } from '@/components/licencias/proceso-esquema';
import { Subpantalla } from '@/components/licencias/subpantalla';

export const metadata = { title: 'Esquema del proceso · Licencias' };

export default function ProcesoPage() {
  return (
    <Subpantalla
      ancho="estrecho"
      titulo="Esquema del proceso"
      descripcion="Las cinco fases de una campaña de licencias. Toca una fase para ver sus pasos, y un paso para saber exactamente qué botón hay que pulsar y qué ojo hay que tener."
    >
      <ProcesoEsquema />
    </Subpantalla>
  );
}
