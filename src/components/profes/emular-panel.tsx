'use client';

// «Entrar como…»: la lista del profesorado con un botón Emular por persona, para que el SuperTIC vea la
// plataforma tal como la ve cada profe. Solo se pinta para el SuperTIC (lo decide `profes/page.tsx`).
// Ficha: docs/01-auth-roles.md §Emulación.

import { useState } from 'react';
import { ChevronDown, Search, VenetianMask } from 'lucide-react';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Rotulo } from '@/components/ui/rotulo';
import { Input } from '@/components/ui/input';
import { BotonEmular } from '@/components/ui/boton-emular';
import { Vacio } from '@/components/ui/vacio';
import { agruparProfes, type ProfeItem } from '@/lib/profes';

export interface ProfeEmularUI extends ProfeItem {
  email: string;
}

export function EmularPanel({ profes, miEmail }: { profes: ProfeEmularUI[]; miEmail: string }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const q = busqueda.trim().toLowerCase();
  const visibles = q ? profes.filter((p) => p.nombre.toLowerCase().includes(q) || p.email.includes(q)) : profes;
  const grupos = agruparProfes(visibles);

  return (
    <Tarjeta as="section">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <VenetianMask aria-hidden className="h-5 w-5 shrink-0 text-zinc-400" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Entrar como…</span>
          <span className="block text-sm text-zinc-500 dark:text-zinc-400">
            Ver la plataforma tal como la ve cada profe, con su rol y sus módulos
          </span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o correo…"
              aria-label="Buscar profe para emular"
              className="pl-9"
            />
          </div>
          {visibles.length === 0 ? (
            <Vacio titulo="Nadie coincide con esa búsqueda" />
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.clave}>
                <Rotulo as="h3" className="mb-1.5">{grupo.label}</Rotulo>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {grupo.items.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-900 dark:text-zinc-100">{p.nombre}</p>
                        <p className="truncate text-xs text-zinc-500">{p.email}</p>
                      </div>
                      {p.email !== miEmail && <BotonEmular email={p.email} nombre={p.nombre} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </Tarjeta>
  );
}
