'use client';

// Catálogo de asignaturas del módulo. Viene sembrado con las de secundaria como relleno de
// ejemplo; aquí se ajustan los nombres, se desactiva lo que no se use y —para el futuro— se
// le puede asignar el profe que la imparte: es el destinatario del aviso "un alumno llegó
// tarde a tu clase", que está escrito pero apagado hasta que los horarios estén en la app.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Selector } from '@/components/ui/selector';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { cn } from '@/lib/utils';

interface Asignatura {
  id: string;
  nombre: string;
  abreviatura: string | null;
  eduTeacherId: string | null;
  active: boolean;
}

export function AsignaturasPanel({
  asignaturas,
  profes,
}: {
  asignaturas: Asignatura[];
  profes: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const refrescar = () => startTransition(() => router.refresh());

  const patch = async (id: string, cambios: Record<string, unknown>) => {
    setOcupado(id);
    try {
      const res = await fetch('/api/puntualidad/admin/asignaturas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...cambios }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo guardar');
      refrescar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setOcupado(null);
    }
  };

  const crear = async () => {
    const nombre = nueva.trim();
    if (nombre.length < 2) return;
    setOcupado('nueva');
    try {
      const res = await fetch('/api/puntualidad/admin/asignaturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se pudo crear');
      setNueva('');
      toast.success(`"${nombre}" añadida`);
      refrescar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <EnlaceVolver href="/gestion/puntualidad">Panel</EnlaceVolver>
        <TituloPagina
          className="mt-1 mb-0"
          descripcion="Son las que salen en el formulario. Las que vienen puestas son de ejemplo: cámbialas por las de verdad y desactiva las que no uséis."
        >
          Asignaturas
        </TituloPagina>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <Input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          aria-label="Nueva asignatura"
          placeholder="Añadir asignatura…"
          className="flex-1"
        />
        <Button type="submit" disabled={nueva.trim().length < 2} cargando={ocupado === 'nueva'}>
          {ocupado !== 'nueva' && <Plus aria-hidden />} Añadir
        </Button>
      </form>

      <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
        {asignaturas.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <NombreEditable
              nombre={a.nombre}
              abreviatura={a.abreviatura}
              onGuardar={(nombre, abreviatura) => patch(a.id, { nombre, abreviatura: abreviatura || null })}
            />
            <Selector
              value={a.eduTeacherId ?? ''}
              onChange={(e) => patch(a.id, { eduTeacherId: e.target.value || null })}
              aria-label={`Profe de ${a.nombre}`}
              className="w-full sm:w-56"
            >
              <option value="">Sin profe asignado</option>
              {profes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
            <Interruptor
              activo={a.active}
              etiqueta="Activa"
              onChange={(v) => patch(a.id, { active: v })}
              className="w-auto shrink-0"
            />
            {ocupado === a.id && <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-500" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NombreEditable({
  nombre,
  abreviatura,
  onGuardar,
}: {
  nombre: string;
  abreviatura: string | null;
  onGuardar: (nombre: string, abreviatura: string) => void;
}) {
  const [n, setN] = useState(nombre);
  const [abrev, setAbrev] = useState(abreviatura ?? '');
  const sucio = n !== nombre || abrev !== (abreviatura ?? '');
  return (
    <div className="flex min-w-64 flex-1 items-center gap-2">
      <Input value={n} onChange={(e) => setN(e.target.value)} aria-label="Nombre" className="min-w-0 flex-1 font-medium" />
      <Input
        value={abrev}
        onChange={(e) => setAbrev(e.target.value)}
        aria-label="Abreviatura"
        placeholder="abrev."
        maxLength={12}
        className="w-24"
      />
      {sucio && (
        <Button type="button" size="sm" onClick={() => onGuardar(n.trim(), abrev.trim())}>
          Guardar
        </Button>
      )}
    </div>
  );
}
