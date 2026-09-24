'use client';

// Los dos formularios de alta, iguales en el panel flotante y en el tablero.
import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { checklistDeTexto, etiquetaModulo, moduloDeRuta, MODULOS_FALLO, type Tarea } from '@/lib/tareas';
import { apiTareas, ESTILO_CAMPO } from './comun';

/**
 * Un fallito es UNA línea: módulo (ya elegido según la pantalla en la que estás) y qué
 * pasa. Intro guarda y deja el cursor listo para el siguiente.
 */
export function FormFallo({
  ruta,
  onCreada,
  autoFocus = false,
}: {
  /** Pantalla desde la que se apunta; se guarda con el fallito y elige el módulo. */
  ruta: string | null;
  onCreada: (t: Tarea) => void;
  autoFocus?: boolean;
}) {
  // null = «el de la pantalla»: si cambias de página con el panel abierto, el módulo la
  // sigue hasta que eliges uno a mano.
  const [elegido, setModulo] = useState<string | null>(null);
  const modulo = elegido ?? moduloDeRuta(ruta) ?? '';
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 3 || guardando) return;
    setGuardando(true);
    try {
      const t = await apiTareas.crear({ tipo: 'fallo', titulo: texto.trim(), modulo: modulo || null, ruta });
      haptic.success();
      toast.success('Apuntado');
      setTexto('');
      onCreada(t);
      input.current?.focus();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-2">
      <select
        value={modulo}
        onChange={(e) => setModulo(e.target.value)}
        aria-label="Módulo"
        className={cn(ESTILO_CAMPO, 'py-1.5')}
      >
        <option value="">General (toda la plataforma)</option>
        {MODULOS_FALLO.map((m) => (
          <option key={m} value={m}>
            {etiquetaModulo(m)}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          ref={input}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus={autoFocus}
          maxLength={500}
          placeholder="¿Qué falla? En una línea…"
          className={ESTILO_CAMPO}
        />
        <button
          type="submit"
          disabled={texto.trim().length < 3 || guardando}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          aria-label="Apuntar"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}

/**
 * Idea de módulo nuevo: nombre, definición funcional y, si ya se sabe, la lista de cosas
 * que tendrá (una por línea; luego se marcan y se editan en el tablero).
 */
export function FormModulo({ onCreada, autoFocus = false }: { onCreada: (t: Tarea) => void; autoFocus?: boolean }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lista, setLista] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (titulo.trim().length < 2 || guardando) return;
    setGuardando(true);
    try {
      const t = await apiTareas.crear({
        tipo: 'modulo',
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        checklist: checklistDeTexto(lista),
      });
      haptic.success();
      toast.success('Idea guardada');
      setTitulo('');
      setDescripcion('');
      setLista('');
      onCreada(t);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-2">
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        autoFocus={autoFocus}
        maxLength={200}
        placeholder="Nombre del módulo (p. ej. Sustituciones)"
        className={cn(ESTILO_CAMPO, 'font-medium')}
      />
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={3}
        placeholder="¿Qué resuelve? ¿Quién lo usa? ¿Cómo funciona?"
        className={cn(ESTILO_CAMPO, 'resize-y')}
      />
      <textarea
        value={lista}
        onChange={(e) => setLista(e.target.value)}
        rows={3}
        placeholder={'Qué tendrá, una cosa por línea (opcional)\nFormulario para…\nAviso por correo a…'}
        className={cn(ESTILO_CAMPO, 'resize-y')}
      />
      <button
        type="submit"
        disabled={titulo.trim().length < 2 || guardando}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
      >
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar idea
      </button>
    </form>
  );
}
