'use client';

// Los dos formularios de alta, iguales en el panel flotante y en el tablero.
import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { checklistDeTexto, etiquetaModulo, moduloDeRuta, MODULOS_FALLO, type Tarea } from '@/lib/tareas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { Textarea } from '@/components/ui/textarea';
import { apiTareas } from './comun';

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
      <Selector value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
        <option value="">General (toda la plataforma)</option>
        {MODULOS_FALLO.map((m) => (
          <option key={m} value={m}>
            {etiquetaModulo(m)}
          </option>
        ))}
      </Selector>
      <div className="flex gap-2">
        <Input
          ref={input}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus={autoFocus}
          maxLength={500}
          placeholder="¿Qué falla? En una línea…"
          aria-label="Qué falla"
        />
        <Button
          type="submit"
          size="icon"
          disabled={texto.trim().length < 3}
          cargando={guardando}
          aria-label="Apuntar"
        >
          {!guardando && <Plus aria-hidden />}
        </Button>
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
      <Input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        autoFocus={autoFocus}
        maxLength={200}
        placeholder="Nombre del módulo (p. ej. Sustituciones)"
        aria-label="Nombre del módulo"
        className="font-medium"
      />
      <Textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={3}
        placeholder="¿Qué resuelve? ¿Quién lo usa? ¿Cómo funciona?"
        aria-label="Qué resuelve"
      />
      <Textarea
        value={lista}
        onChange={(e) => setLista(e.target.value)}
        rows={3}
        placeholder={'Qué tendrá, una cosa por línea (opcional)\nFormulario para…\nAviso por correo a…'}
        aria-label="Qué tendrá"
      />
      <Button type="submit" className="w-full" disabled={titulo.trim().length < 2} cargando={guardando}>
        {!guardando && <Plus aria-hidden />} Guardar idea
      </Button>
    </form>
  );
}
