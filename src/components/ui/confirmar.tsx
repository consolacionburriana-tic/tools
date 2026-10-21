'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Confirmar según lo gordo que sea (nunca `confirm()` ni `prompt()` del navegador):
//
//   · Una cosa que se puede rehacer → mejor sin preguntar y con «Deshacer» en el toast.
//   · Una cosa que no se rehace (borrar una salida) → `ConfirmarEnLinea`: el botón se
//     convierte en «¿Seguro? Sí, borrar / Cancelar» en el sitio.
//   · Muchas a la vez → `ConfirmarDialogo` (o `useConfirmar`), que dice cuántas y qué pasa.
//   · Sin vuelta atrás y gordo (suspender cuentas, borrar un curso) → además `palabra`:
//     hay que escribirla para que el botón se active.

// ─── En línea ────────────────────────────────────────────────────────────────

export function ConfirmarEnLinea({
  etiqueta,
  pregunta,
  confirmar = 'Sí, borrar',
  icono,
  onConfirmar,
  variante = 'destructive',
  tamano = 'sm',
  disabled,
  className,
}: {
  /** El texto del botón de partida («Borrar»). */
  etiqueta: React.ReactNode;
  /** Si va, sale en una franja roja junto a los botones («¿Borrar la salida a Valencia?»). */
  pregunta?: React.ReactNode;
  confirmar?: React.ReactNode;
  icono?: React.ReactNode;
  onConfirmar: () => unknown | Promise<unknown>;
  variante?: 'destructive' | 'outline' | 'ghost';
  tamano?: 'default' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!abierto) {
    return (
      <Button
        type="button"
        variant={variante}
        size={tamano}
        disabled={disabled}
        className={className}
        onClick={() => {
          haptic.warning();
          setAbierto(true);
        }}
      >
        {icono}
        {etiqueta}
      </Button>
    );
  }

  async function si() {
    setOcupado(true);
    try {
      await onConfirmar();
    } finally {
      setOcupado(false);
      setAbierto(false);
    }
  }

  const botones = (
    <>
      <Button type="button" variant="destructive-solid" size={tamano} autoFocus disabled={ocupado} onClick={() => void si()}>
        {ocupado ? <Loader2 className="animate-spin" /> : icono}
        {confirmar}
      </Button>
      <Button type="button" variant="ghost" size={tamano} disabled={ocupado} onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </>
  );

  return (
    <div
      role="group"
      aria-label="Confirmar"
      onKeyDown={(e) => e.key === 'Escape' && !ocupado && setAbierto(false)}
      className={cn(
        'flex flex-wrap items-center gap-2',
        pregunta &&
          'rounded-xl bg-red-50 py-1.5 pr-1.5 pl-3 text-sm text-red-900 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30',
        className,
      )}
    >
      {pregunta && <span className="min-w-0 flex-1">{pregunta}</span>}
      {botones}
    </div>
  );
}

// ─── En diálogo ──────────────────────────────────────────────────────────────

export interface OpcionesConfirmar {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  /** El texto del botón que confirma («Borrar 12 cuentas»). */
  boton: React.ReactNode;
  /** Rojo si borra o quita (por defecto); azul si solo es importante. */
  peligro?: boolean;
  /** Si va, hay que escribirla (sin mirar mayúsculas) para poder confirmar. */
  palabra?: string;
}

/**
 * Diálogo de confirmación controlado. `onConfirmar` puede ser asíncrono: el botón gira hasta
 * que acaba y entonces se cierra. Si falla, se queda abierto (el error lo avisa quien llama).
 */
export function ConfirmarDialogo({
  abierto,
  onCerrar,
  onConfirmar,
  titulo,
  descripcion,
  boton,
  peligro = true,
  palabra,
  children,
}: OpcionesConfirmar & {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: () => unknown | Promise<unknown>;
  children?: React.ReactNode;
}) {
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const listo = !palabra || texto.trim().toUpperCase() === palabra.toUpperCase();

  function cerrar() {
    if (ocupado) return;
    setTexto('');
    onCerrar();
  }

  async function confirmar() {
    if (!listo) return;
    setOcupado(true);
    try {
      await onConfirmar();
      setTexto('');
      onCerrar();
    } catch {
      haptic.warning();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        {children}
        {palabra && (
          <label className="block space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <span>
              Escribe <b className="font-semibold text-zinc-900 dark:text-zinc-100">{palabra}</b> para confirmar
            </span>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void confirmar()}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
            />
          </label>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={ocupado} onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={peligro ? 'destructive-solid' : 'default'}
            disabled={!listo || ocupado}
            autoFocus={!palabra}
            onClick={() => void confirmar()}
          >
            {ocupado && <Loader2 className="animate-spin" />}
            {boton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Como función ────────────────────────────────────────────────────────────

export interface OpcionesTexto {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  etiqueta?: string;
  valor?: string;
  placeholder?: string;
  boton?: React.ReactNode;
  /** Varias líneas (un comentario) en vez de una. */
  largo?: boolean;
  /** Si es `true`, deja confirmar con el campo vacío. */
  vacioVale?: boolean;
}

type Pendiente =
  | { tipo: 'confirmar'; opciones: OpcionesConfirmar; responder: (si: boolean) => void }
  | { tipo: 'texto'; opciones: OpcionesTexto; responder: (texto: string | null) => void };

/**
 * Para cambiar un `confirm()` o un `prompt()` sin rehacer el componente:
 *
 *   const { confirmar, pedirTexto, dialogo } = useConfirmar();
 *   if (!(await confirmar({ titulo: '¿Borrar la columna?', boton: 'Borrar' }))) return;
 *   const nombre = await pedirTexto({ titulo: 'Nuevo nombre', valor: actual });
 *   …
 *   return <>{…}{dialogo}</>;
 */
export function useConfirmar() {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [texto, setTexto] = useState('');
  const abierto = useRef(false);

  const confirmar = useCallback(
    (opciones: OpcionesConfirmar) =>
      new Promise<boolean>((resolver) => {
        abierto.current = true;
        setPendiente({ tipo: 'confirmar', opciones, responder: resolver });
      }),
    [],
  );

  const pedirTexto = useCallback(
    (opciones: OpcionesTexto) =>
      new Promise<string | null>((resolver) => {
        abierto.current = true;
        setTexto(opciones.valor ?? '');
        setPendiente({ tipo: 'texto', opciones, responder: resolver });
      }),
    [],
  );

  function cerrar(respuesta: boolean | string | null) {
    if (!pendiente || !abierto.current) return;
    abierto.current = false;
    if (pendiente.tipo === 'confirmar') pendiente.responder(respuesta === true);
    else pendiente.responder(typeof respuesta === 'string' ? respuesta : null);
    setPendiente(null);
  }

  let dialogo: React.ReactNode = null;
  if (pendiente?.tipo === 'confirmar') {
    dialogo = (
      <ConfirmarDialogo
        abierto
        {...pendiente.opciones}
        onConfirmar={() => cerrar(true)}
        onCerrar={() => cerrar(false)}
      />
    );
  } else if (pendiente?.tipo === 'texto') {
    const o = pendiente.opciones;
    const valido = o.vacioVale || texto.trim() !== '';
    const enviar = () => valido && cerrar(texto.trim());
    dialogo = (
      <Dialog open onOpenChange={(v) => !v && cerrar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{o.titulo}</DialogTitle>
            {o.descripcion && <DialogDescription>{o.descripcion}</DialogDescription>}
          </DialogHeader>
          <label className="block space-y-1.5">
            {o.etiqueta && <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{o.etiqueta}</span>}
            {o.largo ? (
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={o.placeholder} autoFocus />
            ) : (
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviar()}
                placeholder={o.placeholder}
                aria-label={o.etiqueta ? undefined : typeof o.titulo === 'string' ? o.titulo : undefined}
                autoFocus
              />
            )}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => cerrar(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!valido} onClick={enviar}>
              {o.boton ?? 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return { confirmar, pedirTexto, dialogo };
}
