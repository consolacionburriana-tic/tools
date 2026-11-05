'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Input } from '@/components/ui/input';

// «Crear la campaña siguiente»: sale en el panel cuando la actual está cerrada. La nueva nace en
// borrador, con el alumnado de la central ya dentro y SIN libros (el catálogo se trae de la hoja
// «BBDD Libros» en Sincronizar). Se abre a mano cuando todo está listo.
export function NuevaCampana({
  propuesta,
}: {
  propuesta: { academicYear: string; name: string } | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [name, setName] = useState(propuesta?.name ?? '');
  const [academicYear, setAcademicYear] = useState(propuesta?.academicYear ?? '');
  const [promociona, setPromociona] = useState(true);
  const [orderDeadline, setOrderDeadline] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/licencias/admin/campaign/nueva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, academicYear, promociona, orderDeadline: orderDeadline || null }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'No se ha podido crear la campaña');
      haptic.success();
      router.refresh();
    } catch (err) {
      haptic.warning();
      setError(err instanceof Error ? err.message : 'No se ha podido crear la campaña');
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <Button type="button" onClick={() => setAbierto(true)}>
        <Plus aria-hidden className="size-4" /> Crear la campaña siguiente
      </Button>
    );
  }

  return (
    <form onSubmit={crear} className="space-y-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <Campo etiqueta="Nombre" id="nc-name">
        <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Curso escolar" id="nc-year" ayuda="Con la forma 2027/2028.">
        <Input id="nc-year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required className="sm:max-w-40" />
      </Campo>
      <Campo etiqueta="Cierre automático" id="nc-deadline" ayuda="Se puede poner después." opcional>
        <Input id="nc-deadline" type="date" value={orderDeadline} onChange={(e) => setOrderDeadline(e.target.value)} className="sm:max-w-56" />
      </Campo>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={promociona}
          onChange={(e) => setPromociona(e.target.checked)}
          className="mt-1 size-4 shrink-0"
        />
        <span>
          <strong className="font-medium">El alumnado aún está en el curso de este año</strong>
          <span className="block text-zinc-500 dark:text-zinc-400">
            Déjalo marcado si abres la campaña antes de pasar el curso en Educamos: cada alumno se lee un curso por delante
            (2º ESO pide libros de 3º) y 4º ESO queda fuera. Desmárcalo si la central ya está pasada de curso.
          </span>
        </span>
      </label>
      <Aviso tono="info">
        La campaña nace en <strong>borrador</strong> con el alumnado de la central dentro y <strong>sin libros</strong>: el
        catálogo se trae de la hoja «BBDD Libros» en Sincronizar. Las familias no pueden pedir hasta que la abras. El panel y
        los enlaces pasan a la nueva desde este momento.
      </Aviso>
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando && <Loader2 aria-hidden className="size-4 animate-spin" />} Crear la campaña
        </Button>
        <Button type="button" variant="outline" onClick={() => setAbierto(false)} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
