'use client';

import { useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import { SyncWizard } from '@/components/educamos/sync-wizard';
import { ProfesImport } from '@/components/educamos/profes-import';
import { Segmentado } from '@/components/ui/segmentado';
import { Tarjeta } from '@/components/ui/tarjeta';

const TABS = [
  {
    k: 'alumnado' as const,
    label: 'Alumnado',
    icon: GraduationCap,
    hint: 'Vista previa con el diff campo a campo y resolución de conflictos antes de aplicar.',
  },
  {
    k: 'profesorado' as const,
    label: 'Profesorado',
    icon: Users,
    hint: 'El ALIAS es el código; el correo del cole casa con el login. Los datos laborales no se importan.',
  },
];

/** Los dos importadores en la misma pantalla: mismo sitio, mismo aspecto, misma zona de subida. */
export function SincronizarTabs() {
  const [tab, setTab] = useState<'alumnado' | 'profesorado'>('alumnado');
  const activa = TABS.find((t) => t.k === tab)!;

  return (
    <div className="space-y-4">
      <Segmentado
        etiqueta="Qué sincronizar"
        valor={tab}
        onChange={setTab}
        opciones={TABS.map((t) => ({ valor: t.k, etiqueta: t.label, icono: <t.icon aria-hidden /> }))}
      />

      <p className="text-xs text-zinc-500 dark:text-zinc-400">{activa.hint}</p>

      {tab === 'alumnado' ? (
        <SyncWizard />
      ) : (
        <Tarjeta className="p-4">
          <ProfesImport />
        </Tarjeta>
      )}
    </div>
  );
}
