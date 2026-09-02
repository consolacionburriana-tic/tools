'use client';

import { useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import { SyncWizard } from '@/components/educamos/sync-wizard';
import { ProfesImport } from '@/components/educamos/profes-import';

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
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.k
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500">{activa.hint}</p>

      {tab === 'alumnado' ? (
        <SyncWizard />
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <ProfesImport />
        </div>
      )}
    </div>
  );
}
