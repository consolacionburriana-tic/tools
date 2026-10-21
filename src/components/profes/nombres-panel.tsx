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
import { Tarjeta } from '@/components/ui/tarjeta';
import { Rotulo } from '@/components/ui/rotulo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <Tarjeta as="section">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <IdCard aria-hidden className="h-5 w-5 shrink-0 text-zinc-400" />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nombre visible</span>
          <span className="block text-sm text-zinc-500 dark:text-zinc-400">
            Cómo sale cada profe en el ASM, el cuaderno, los correos y los paneles
            {aMano > 0 ? ` · ${aMano} escrito(s) a mano` : ''}
          </span>
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Escribe solo el <strong>nombre</strong> (los apellidos salen solos). Déjalo en blanco y se usa el que se
            saca de Educamos.
          </p>
          {grupos.map((grupo) => (
            <div key={grupo.clave}>
              <Rotulo as="h3" className="mb-1.5">{grupo.label}</Rotulo>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {grupo.items.map((profe) => (
                  <FilaProfe key={profe.id} profe={profe} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
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
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          Educamos: {profe.educamos}
          {profe.esTutor && profe.claseTutor ? ` · tutor/a de ${profe.claseTutor}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={(e) => void guardar(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder={profe.pilaSugerida}
          aria-label={`Nombre visible de ${profe.educamos}`}
          className="h-10 w-40"
        />
        {guardando ? (
          <span className="flex size-10 items-center justify-center">
            <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-400" />
          </span>
        ) : (
          guardado !== '' && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void guardar('')}
              aria-label="Volver al nombre de Educamos"
              title="Volver al nombre de Educamos"
            >
              <RotateCcw aria-hidden />
            </Button>
          )
        )}
      </div>
    </li>
  );
}
