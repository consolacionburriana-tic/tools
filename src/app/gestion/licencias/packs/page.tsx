import { PacksEditor } from '@/components/licencias/packs-editor';
import { Subpantalla } from '@/components/licencias/subpantalla';

export const metadata = { title: 'Packs / itinerarios · Licencias' };

export default function PacksPage() {
  return (
    <Subpantalla
      ancho="estrecho"
      titulo="Packs e itinerarios"
      descripcion="Agrupan las licencias para guiar a las familias."
    >
      <PacksEditor />
    </Subpantalla>
  );
}
