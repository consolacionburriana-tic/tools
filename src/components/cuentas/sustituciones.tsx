'use client';

// «Sustituciones» en Correos y grupos: cuando alguien está sustituyendo a otra persona, se
// sugiere meterla en los grupos de Google donde está el titular (el equipo de sostenibilidad,
// el claustro de su etapa…). No se añade a nadie solo: se ve en qué grupos está el titular y
// se marca a mano en cuáles entra el sustituto. Los grupos que mantienen reglas que añaden y
// quitan salen sin casilla, porque el próximo «Aplicar» lo sacaría.
import { useEffect, useState } from 'react';
import { UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { ResultadoGrupoSustituto, SugerenciasSustitucion } from '@/lib/cuentas-server';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Tarjeta, TarjetaCabecera } from '@/components/ui/tarjeta';
import { post } from './comun';

const API = '/api/cuentas/admin/sustituciones';

export function SustitucionesGrupos({
  sustituciones,
  puedeGestionar,
}: {
  sustituciones: { id: string; sustituto: string; titular: string }[];
  puedeGestionar: boolean;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  if (sustituciones.length === 0) return null;

  return (
    <Tarjeta>
      <TarjetaCabecera
        className="border-b-0"
        icono={<UserRoundCog />}
        titulo="Sustituciones"
        descripcion="Quien sustituye a alguien puede necesitar sus grupos (equipos, claustro…). Mira en cuáles está el titular y elige a mano."
      />
      <ul className="divide-y divide-zinc-100 px-4 pb-3 dark:divide-zinc-800">
        {sustituciones.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="text-sm text-zinc-800 dark:text-zinc-200">
              <b className="font-semibold">{s.sustituto}</b> sustituye a <b className="font-semibold">{s.titular}</b>
            </span>
            {puedeGestionar && (
              <Button size="sm" variant="outline" onClick={() => setAbierta(s.id)}>
                Ver grupos
              </Button>
            )}
          </li>
        ))}
      </ul>
      {abierta && <DialogoGrupos sustitucionId={abierta} onCerrar={() => setAbierta(null)} />}
    </Tarjeta>
  );
}

function DialogoGrupos({ sustitucionId, onCerrar }: { sustitucionId: string; onCerrar: () => void }) {
  const [datos, setDatos] = useState<SugerenciasSustitucion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoGrupoSustituto[] | null>(null);

  // Se lee de Google al abrir (una vez): cuesta dos llamadas, no se hace al cargar la pestaña.
  useEffect(() => {
    let vigente = true;
    post<SugerenciasSustitucion>(API, { sustitucionId })
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e instanceof Error ? e.message : 'No se ha podido leer de Google'));
    return () => {
      vigente = false;
    };
  }, [sustitucionId]);

  const elegibles = datos?.grupos.filter((g) => !g.bloqueado) ?? [];

  function alternar(email: string, v: boolean) {
    setMarcados((prev) => {
      const nuevo = new Set(prev);
      if (v) nuevo.add(email);
      else nuevo.delete(email);
      return nuevo;
    });
  }

  async function aplicar() {
    setEnviando(true);
    try {
      const r = await post<{ resultados: ResultadoGrupoSustituto[] }>(`${API}/aplicar`, { sustitucionId, grupos: [...marcados] });
      setResultados(r.resultados);
      const bien = r.resultados.filter((x) => x.ok).length;
      const mal = r.resultados.length - bien;
      if (mal === 0) {
        toast.success(`Añadido a ${bien} grupo${bien === 1 ? '' : 's'}`);
        haptic.success();
      } else {
        toast.warning(`${bien} bien, ${mal} con error`);
        haptic.warning();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !enviando && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{datos ? `Grupos de ${datos.titular.nombre}` : 'Grupos del titular'}</DialogTitle>
          <DialogDescription>
            {datos
              ? `Marca en cuáles entra ${datos.sustituto.nombre}. No se añade nada sin marcar; cuando termine la sustitución, quitarlo es a mano.`
              : 'Leyendo de Google…'}
          </DialogDescription>
        </DialogHeader>

        {error && <Aviso tono="error">{error}</Aviso>}
        {!datos && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">Leyendo los grupos de Google…</p>}
        {datos?.avisos.map((a) => (
          <Aviso key={a} tono="aviso">
            {a}
          </Aviso>
        ))}

        {datos && datos.grupos.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {datos.grupos.map((g) => {
                const r = resultados?.find((x) => x.grupo === g.email);
                return (
                  <li key={g.email} className={cn('px-3 py-2', g.bloqueado && 'opacity-80')}>
                    <label className={cn('flex min-h-10 items-start gap-3 py-1', !g.bloqueado && 'cursor-pointer')}>
                      <input
                        type="checkbox"
                        disabled={Boolean(g.bloqueado) || enviando || Boolean(resultados)}
                        checked={marcados.has(g.email)}
                        onChange={(e) => alternar(g.email, e.target.checked)}
                        className="mt-1 size-4 shrink-0 accent-blue-600"
                        aria-label={`Meter a ${datos.sustituto.nombre} en ${g.nombre ?? g.email}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.nombre ?? g.email}</span>
                          {g.gestionado && <Etiqueta>Con reglas</Etiqueta>}
                          {r && (
                            <span className={cn('text-xs font-medium', r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
                              {r.ok ? (r.sinCambio ? 'Ya estaba' : 'Añadido') : r.error}
                            </span>
                          )}
                        </span>
                        <span className="block truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">{g.email}</span>
                        {g.bloqueado && <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{g.bloqueado}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter>
          {datos && elegibles.length > 1 && !resultados && (
            <Button
              variant="ghost"
              disabled={enviando}
              onClick={() => setMarcados(marcados.size === elegibles.length ? new Set() : new Set(elegibles.map((g) => g.email)))}
            >
              {marcados.size === elegibles.length ? 'Quitar todas las marcas' : 'Marcar todos'}
            </Button>
          )}
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>
            {resultados ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!resultados && (
            <Button cargando={enviando} disabled={marcados.size === 0} onClick={aplicar}>
              Añadir a {marcados.size} grupo{marcados.size === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
