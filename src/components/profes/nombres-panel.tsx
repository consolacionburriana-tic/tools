'use client';

// El nombre visible del profesorado: el "given name" que sale en TODAS las salidas del
// centro (el ASM, el cuaderno de tutor, los correos y los paneles).
//
// Educamos manda «JOSE MANUEL SANCHEZ GIL» y a esa persona todo el mundo la llama «Pepe».
// La heurística acierta casi siempre (coge el primer nombre y los compuestos con María,
// José…), así que aquí solo hay que escribir las excepciones: se ve lo que va a salir de
// cada profe y se corrige el puñado que no cuadre. No hay botón de guardar: se escribe y
// al salir del recuadro queda guardado.

import { useState } from 'react';
import { ChevronDown, IdCard, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { agruparProfes, type ProfeItem } from '@/lib/profes';

export interface ProfeNombreUI extends ProfeItem {
  /** Tal cual viene de Educamos: «JOSE MANUEL SANCHEZ GIL». */
  educamos: string;
  /** El nombre escrito a mano, si lo hay. */
  nombreMostrado: string | null;
  /** El nombre de pila que se usaría sin escribir nada (la heurística). */
  pilaSugerida: string;
  /** Los apellidos, ya bien escritos: se pegan al nombre para ver el resultado. */
  apellidos: string;
}

export function NombresPanel({ profes }: { profes: ProfeNombreUI[] }) {
  const [abierto, setAbierto] = useState(false);
  const grupos = agruparProfes(profes);
  const aMano = profes.filter((p) => p.nombreMostrado).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <IdCard className="h-4 w-4 text-zinc-400" />
        <span className="flex-1">
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Nombre visible</span>
          <span className="block text-xs text-zinc-500">
            Cómo sale cada profe en el ASM, el cuaderno, los correos y los paneles
            {aMano > 0 ? ` · ${aMano} escrito(s) a mano` : ''}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Escribe solo el <strong>nombre</strong> (los apellidos salen solos). Déjalo en blanco y se usa el que se
            saca de Educamos.
          </p>
          {grupos.map((grupo) => (
            <div key={grupo.clave}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">{grupo.label}</h3>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {grupo.items.map((profe) => (
                  <FilaProfe key={profe.id} profe={profe} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilaProfe({ profe }: { profe: ProfeNombreUI }) {
  const [valor, setValor] = useState(profe.nombreMostrado ?? '');
  const [guardado, setGuardado] = useState(profe.nombreMostrado ?? '');
  const [guardando, setGuardando] = useState(false);

  async function guardar(nuevo: string) {
    const limpio = nuevo.replace(/\s+/g, ' ').trim();
    if (limpio === guardado) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/profes/admin/nombres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: profe.id, nombreMostrado: limpio || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      setValor(limpio);
      setGuardado(limpio);
      haptic.success();
    } catch (e) {
      setValor(guardado); // si falla, se ve lo que hay de verdad guardado
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setGuardando(false);
    }
  }

  const pila = valor.trim() || profe.pilaSugerida;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-900 dark:text-zinc-100">
          {[pila, profe.apellidos].filter(Boolean).join(' ')}
        </p>
        <p className="truncate text-[11px] text-zinc-400">
          Educamos: {profe.educamos}
          {profe.esTutor && profe.claseTutor ? ` · tutor/a de ${profe.claseTutor}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={(e) => void guardar(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder={profe.pilaSugerida}
          aria-label={`Nombre visible de ${profe.educamos}`}
          className="w-36 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        {guardando ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        ) : (
          guardado !== '' && (
            <button
              type="button"
              onClick={() => void guardar('')}
              title="Volver al nombre de Educamos"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
    </li>
  );
}
