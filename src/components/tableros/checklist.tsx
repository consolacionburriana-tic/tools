'use client';

// La lista de pasos de una tarjeta de Tableros y de una idea de módulo de Tareas: la misma
// pieza en los dos sitios. Marcar, cambiar el texto tocándolo, quitar (siempre a la vista,
// que en el iPad no hay ratón) y añadir uno o varios de golpe pegando una lista.
import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progreso } from '@/components/ui/progreso';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { checklistDeTexto, progresoChecklist, type ItemChecklist } from '@/lib/tableros';

const nuevoId = () => crypto.randomUUID();

export function Checklist({
  items,
  onCambio,
  ocultable = true,
  placeholder = 'Añadir un paso…',
}: {
  items: readonly ItemChecklist[];
  onCambio: (items: ItemChecklist[]) => void;
  /** Ofrece «Ocultar hechos» cuando ya hay alguno marcado. */
  ocultable?: boolean;
  placeholder?: string;
}) {
  const [nuevo, setNuevo] = useState('');
  const [ocultarHechos, setOcultarHechos] = useState(false);
  const { hechos, total } = progresoChecklist(items);

  function anadir() {
    const nuevos = checklistDeTexto(nuevo, nuevoId);
    if (nuevos.length === 0) return;
    onCambio([...items, ...nuevos]);
    setNuevo('');
  }

  const visibles = ocultable && ocultarHechos ? items.filter((i) => !i.hecho) : items;

  return (
    <div>
      {total > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <Progreso hechos={hechos} total={total} etiqueta="Pasos hechos" cuenta className="flex-1" />
          {ocultable && hechos > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOcultarHechos((v) => !v)}>
              {ocultarHechos ? `Ver hechos (${hechos})` : 'Ocultar hechos'}
            </Button>
          )}
        </div>
      )}
      {visibles.length > 0 && (
        <ul className="space-y-0.5">
          {visibles.map((it) => (
            <ItemCheck
              key={it.id}
              item={it}
              onToggle={() => {
                if (!it.hecho) haptic.tap();
                onCambio(items.map((x) => (x.id === it.id ? { ...x, hecho: !x.hecho } : x)));
              }}
              onTexto={(texto) => onCambio(items.map((x) => (x.id === it.id ? { ...x, texto } : x)))}
              onBorrar={() => onCambio(items.filter((x) => x.id !== it.id))}
            />
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              anadir();
            }
          }}
          onPaste={(e) => {
            // Pegar una lista de varias líneas = varios pasos de golpe.
            const pegado = e.clipboardData.getData('text');
            if (pegado.includes('\n')) {
              e.preventDefault();
              const nuevos = checklistDeTexto(pegado, nuevoId);
              if (nuevos.length) onCambio([...items, ...nuevos]);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={300}
        />
        <Button type="button" variant="outline" size="icon" onClick={anadir} disabled={!nuevo.trim()} aria-label="Añadir el paso">
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function ItemCheck({
  item,
  onToggle,
  onTexto,
  onBorrar,
}: {
  item: ItemChecklist;
  onToggle: () => void;
  onTexto: (t: string) => void;
  onBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(item.texto);
  return (
    <li className="flex items-start gap-1 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.hecho}
        onClick={onToggle}
        aria-label={item.texto}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            'flex size-5 items-center justify-center rounded-md border transition-colors',
            item.hecho ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-400 dark:border-zinc-500',
          )}
        >
          {item.hecho && <Check aria-hidden className="size-3.5" />}
        </span>
      </button>
      {editando ? (
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            setEditando(false);
            if (texto.trim() && texto.trim() !== item.texto) onTexto(texto.trim());
            else setTexto(item.texto);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setTexto(item.texto);
              setEditando(false);
            }
          }}
          autoFocus
          aria-label="Texto del paso"
          maxLength={300}
          className="h-10 flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className={cn(
            'min-h-10 min-w-0 flex-1 cursor-text rounded-lg px-1 py-2 text-left text-sm break-words outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            item.hecho ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200',
          )}
        >
          {item.texto}
        </button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onBorrar}
        aria-label={`Quitar «${item.texto}»`}
        className="text-zinc-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400"
      >
        <X />
      </Button>
    </li>
  );
}
