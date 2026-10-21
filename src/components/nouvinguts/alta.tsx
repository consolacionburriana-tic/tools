'use client';

// «Tengo uno nuevo»: lo justo para que no se pierda. Nombre y apellidos en MAYÚSCULAS, curso
// en desplegable, fecha de matrícula (hoy por defecto) y una nota. Cuando aparezca en la
// sincronización de Educamos, el sistema lo vincula solo.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { Campo } from '@/components/ui/campo';
import { Aviso } from '@/components/ui/aviso';
import { haptic } from '@/lib/haptics';
import { ETAPA_LABEL } from '@/lib/cursos';
import { altaSchema, cursosOfrecidos, esInicioDeCurso, etiquetaCurso } from '@/lib/nouvinguts';
import { pedir } from './comun';

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AltaNouvingut({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [curso, setCurso] = useState('');
  const [fecha, setFecha] = useState(hoyLocal);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const porEtapa = useMemo(() => {
    const grupos = new Map<string, { codigo: string; etiqueta: string }[]>();
    for (const c of cursosOfrecidos()) grupos.set(c.etapa, [...(grupos.get(c.etapa) ?? []), c]);
    return [...grupos.entries()];
  }, []);

  const inicioCurso = curso && fecha ? esInicioDeCurso(curso, fecha) : false;
  const completo = `${nombre} ${apellidos}`.replace(/\s+/g, ' ').trim();

  function limpiar() {
    setNombre('');
    setApellidos('');
    setCurso('');
    setFecha(hoyLocal());
    setNota('');
  }

  async function apuntar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = altaSchema.safeParse({ nombre, apellidos, curso, fechaMatricula: fecha, nota: nota.trim() || undefined });
    if (!parsed.success) {
      haptic.warning();
      toast.error(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }
    setGuardando(true);
    try {
      const { id } = await pedir<{ id: string }>('/api/nouvinguts', { method: 'POST', body: JSON.stringify(parsed.data) });
      haptic.success();
      toast.success(`${completo} apuntado. Se vinculará solo al sincronizar Educamos.`);
      limpiar();
      onCerrar();
      router.push(`/gestion/nouvinguts/${id}`);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido apuntar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={apuntar} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus aria-hidden className="size-5 text-zinc-500" /> Tengo uno nuevo
            </DialogTitle>
            <DialogDescription>
              Lo justo para que no se pierda. Cuando aparezca en la sincronización de Educamos se vincula solo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre" id="alta-nombre">
              <Input
                id="alta-nombre"
                className="font-medium tracking-wide uppercase"
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
                autoComplete="off"
                autoFocus
                required
              />
            </Campo>
            <Campo etiqueta="Apellidos" id="alta-apellidos">
              <Input
                id="alta-apellidos"
                className="font-medium tracking-wide uppercase"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value.toUpperCase())}
                autoComplete="off"
                required
              />
            </Campo>
            <Campo etiqueta="Curso" id="alta-curso">
              <Selector id="alta-curso" value={curso} onChange={(e) => setCurso(e.target.value)} required>
                <option value="">Elige curso…</option>
                {porEtapa.map(([etapa, cursos]) => (
                  <optgroup key={etapa} label={ETAPA_LABEL[etapa as keyof typeof ETAPA_LABEL]}>
                    {cursos.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.etiqueta}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Fecha de matrícula" id="alta-fecha">
              <Input id="alta-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </Campo>
          </div>
          <Campo etiqueta="Nota" id="alta-nota" opcional>
            <Input id="alta-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Viene de otro centro, empieza el lunes…" />
          </Campo>

          {inicioCurso && <Aviso tono="aviso">Un 3 años matriculado entre junio y septiembre va por Inicio de curso, no por aquí.</Aviso>}

          {completo && (
            <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/60">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Así sale en la lista</p>
              <p className="mt-0.5 text-sm">
                <span className="font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">{completo}</span>
                <span className="text-zinc-500 dark:text-zinc-400"> · {curso ? etiquetaCurso(curso) : 'sin curso'} · esperando a Educamos</span>
              </p>
            </div>
          )}

          <Button type="submit" size="lg" disabled={guardando} className="w-full">
            {guardando && <Loader2 className="animate-spin" />} Apuntar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
