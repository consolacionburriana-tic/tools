'use client';

// Historial (docs/32 §4.7): las ausencias con filtros de mes, profe y motivo (agrupado: escolar /
// personal). Mes y profe van en la URL y los lee el servidor; el motivo filtra en la pantalla.
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, History } from 'lucide-react';
import { agruparMotivo, GRUPO_MOTIVO_NOMBRE, mayuscula, nombreMes, nombreMotivo, rangoCorto, type GrupoMotivo } from '@/lib/sustituciones';
import type { FilaHistorial } from '@/lib/sustituciones-server';
import { Estado } from '@/components/ui/estado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { FiltroJefatura } from './comun';

export function Historial({ filas, meses, profes, mes, profeId, grupoEtapas }: { filas: FilaHistorial[]; meses: string[]; profes: { id: string; nombre: string }[]; mes: string | null; profeId: string | null; grupoEtapas: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const sp = useSearchParams();
  const [grupo, setGrupo] = useState<GrupoMotivo | null>(null);

  function ir(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`${ruta}${p.size ? `?${p}` : ''}`);
  }

  const vistas = grupo ? filas.filter((f) => agruparMotivo(f.motivo) === grupo) : filas;
  return (
    <div className="space-y-5">
      <FiltroJefatura grupo={grupoEtapas} />
      <div className="flex flex-wrap items-center gap-3">
        <Selector aria-label="Mes" className="w-48" value={mes ?? ''} onChange={(e) => ir({ mes: e.target.value || null })}>
          <option value="">Las últimas</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {mayuscula(nombreMes(m))}
            </option>
          ))}
        </Selector>
        <Selector aria-label="Profe" className="w-56" value={profeId ?? ''} onChange={(e) => ir({ profe: e.target.value || null })}>
          <option value="">Todo el claustro</option>
          {profes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Selector>
        <Filtros etiqueta="Motivo">
          <Filtro activo={grupo === null} onClick={() => setGrupo(null)}>
            Todos
          </Filtro>
          {(['escolar', 'personal'] as GrupoMotivo[]).map((g) => (
            <Filtro key={g} activo={grupo === g} onClick={() => setGrupo(g)} cuenta={filas.filter((f) => agruparMotivo(f.motivo) === g).length}>
              {GRUPO_MOTIVO_NOMBRE[g]}
            </Filtro>
          ))}
        </Filtros>
      </div>

      {vistas.length === 0 ? (
        <Vacio icono={<History />} titulo="No hay ausencias con esos filtros" />
      ) : (
        <Tarjeta>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {vistas.map((f) => {
              const sinCubrir = f.aCubrir - f.cubiertas;
              return (
                <li key={f.id}>
                  <Link
                    href={`/gestion/sustituciones/${f.id}`}
                    className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="w-36 shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rangoCorto(f.desde, f.hasta)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.profe}</span>
                      <span className="block text-sm text-zinc-500 dark:text-zinc-400">
                        {nombreMotivo(f.motivo)} · {f.horas === 1 ? '1 hora' : `${f.horas} horas`}
                        {f.aCubrir > 0 && ` · ${f.cubiertas} de ${f.aCubrir} cubiertas`}
                      </span>
                    </span>
                    {f.estado === 'anulada' ? (
                      <Estado tono="neutro">Anulada</Estado>
                    ) : f.conError > 0 ? (
                      <Estado tono="error">Correo con error</Estado>
                    ) : sinCubrir > 0 ? (
                      <Estado tono="aviso">{sinCubrir === 1 ? '1 sin cubrir' : `${sinCubrir} sin cubrir`}</Estado>
                    ) : f.aCubrir > 0 ? (
                      <Estado tono="ok">Cubierta</Estado>
                    ) : null}
                    <ChevronRight aria-hidden className="size-4 text-zinc-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
