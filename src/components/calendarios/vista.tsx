'use client';

// Las dos caras de /gestion/calendarios: los calendarios que deja Classroom y las propias
// clases. El escaneo (en la de calendarios) rellena las dos.
import { useState } from 'react';
import { CalendarDays, GraduationCap } from 'lucide-react';
import { Segmentado } from '@/components/ui/segmentado';
import type { CalendarioFila, ClaseFila } from '@/lib/calendarios';
import { PanelCalendarios } from './panel';
import { PanelClases } from './clases';

export function VistaCalendarios({
  calendarios,
  clases,
  errorInicial,
}: {
  calendarios: CalendarioFila[];
  clases: ClaseFila[];
  errorInicial: string | null;
}) {
  const [vista, setVista] = useState<'calendarios' | 'clases'>('calendarios');
  return (
    <div className="space-y-5">
      <Segmentado
        etiqueta="Qué ver"
        valor={vista}
        onChange={setVista}
        opciones={[
          { valor: 'calendarios', etiqueta: 'Calendarios', icono: <CalendarDays /> },
          { valor: 'clases', etiqueta: 'Clases de Classroom', icono: <GraduationCap /> },
        ]}
      />
      {vista === 'calendarios' ? (
        <PanelCalendarios iniciales={calendarios} errorInicial={errorInicial} />
      ) : (
        <PanelClases iniciales={clases} />
      )}
    </div>
  );
}
