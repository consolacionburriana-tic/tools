'use client';

// «Tengo uno nuevo»: lo justo para que no se pierda. Nombre y apellidos en MAYÚSCULAS, curso
// en desplegable, fecha de matrícula (hoy por defecto) y una nota. Cuando aparezca en la
// sincronización de Educamos, el sistema lo vincula solo.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { ETAPA_LABEL } from '@/lib/cursos';
import { altaSchema, cursosOfrecidos, esInicioDeCurso, etiquetaCurso } from '@/lib/nouvinguts';
import { ESTILO_CAMPO, pedir } from './comun';

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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={apuntar} className="space-y-4">
          <div className="space-y-1 pr-8">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <UserPlus className="h-5 w-5 text-blue-600" /> Tengo uno nuevo
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
              Lo justo para que no se pierda. Cuando aparezca en la sincronización de Educamos se vincula solo.
            </DialogDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Nombre</span>
              <input
                className={`${ESTILO_CAMPO} font-medium tracking-wide uppercase`}
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
                autoComplete="off"
                autoFocus
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Apellidos</span>
              <input
                className={`${ESTILO_CAMPO} font-medium tracking-wide uppercase`}
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value.toUpperCase())}
                autoComplete="off"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Curso</span>
              <select className={ESTILO_CAMPO} value={curso} onChange={(e) => setCurso(e.target.value)} required>
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
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Fecha de matrícula</span>
              <input type="date" className={ESTILO_CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nota <span className="font-normal text-zinc-500">(opcional)</span>
            </span>
            <input className={ESTILO_CAMPO} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Viene de otro centro, empieza el lunes…" />
          </label>

          {inicioCurso && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
              Un 3 años matriculado entre junio y septiembre va por Inicio de curso, no por aquí.
            </p>
          )}

          {completo && (
            <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/60">
              <p className="text-xs text-zinc-500">Así sale en la lista</p>
              <p className="mt-0.5 text-sm">
                <span className="font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">{completo}</span>
                <span className="text-zinc-500"> · {curso ? etiquetaCurso(curso) : 'sin curso'} · esperando a Educamos</span>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Apuntar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
