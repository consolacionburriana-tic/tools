'use client';

// «Mi horario» / «El de Alejandro (cubres su baja)»: cambia de quién es el horario que se ve.
// Solo sale cuando hay una sustitución vigente. El cambio va en la URL (`?de=<id>`, sin él =
// el mío) y conserva el periodo que se estuviera mirando.
import { useRouter, useSearchParams } from 'next/navigation';

import { Segmentado } from '@/components/ui/segmentado';

export function SelectorDe({
  opciones,
  actual,
  basePath = '/mi-horario',
}: {
  /** La primera es siempre la propia (`id: 'yo'`). */
  opciones: { id: string; etiqueta: string }[];
  actual: string;
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <Segmentado
      etiqueta="De quién es el horario"
      valor={actual}
      opciones={opciones.map((o) => ({ valor: o.id, etiqueta: o.etiqueta }))}
      onChange={(id) => {
        const p = new URLSearchParams(params.toString());
        p.set('de', id);
        router.push(`${basePath}?${p.toString()}`);
      }}
    />
  );
}
