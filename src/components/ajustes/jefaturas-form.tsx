'use client';

// Quién lleva cada Jefatura de estudios: lo que cada una ve por defecto en Sustituciones.
import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CONFIGURACION } from '@/lib/configuracion';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Selector } from '@/components/ui/selector';

export function JefaturasForm({ inicial, candidatos }: { inicial: Record<string, string | null>; candidatos: { email: string; nombre: string }[] }) {
  const [valor, setValor] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const cambiado = JSON.stringify(valor) !== JSON.stringify(guardado);

  async function guardar() {
    setGuardando(true);
    try {
      const r = await fetch('/api/ajustes/jefaturas', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(valor) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'No se ha podido guardar');
      setGuardado(valor);
      toast.success('Jefaturas guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {CONFIGURACION.sustituciones.jefaturas.map((j) => {
          const actual = valor[j.clave] ?? '';
          return (
            <Campo key={j.clave} etiqueta={`Jefatura de ${j.nombre}`} id={`jef-${j.clave}`}>
              <Selector id={`jef-${j.clave}`} value={actual} onChange={(e) => setValor((v) => ({ ...v, [j.clave]: e.target.value || null }))}>
                <option value="">Nadie</option>
                {actual && !candidatos.some((c) => c.email === actual) && <option value={actual}>{actual}</option>}
                {candidatos.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          );
        })}
      </div>
      <Button variant="outline" disabled={!cambiado} cargando={guardando} onClick={() => void guardar()}>
        <Save aria-hidden /> Guardar jefaturas
      </Button>
    </div>
  );
}
