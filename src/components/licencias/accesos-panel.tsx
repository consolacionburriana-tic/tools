'use client';

import { useState } from 'react';
import { Download, KeyRound, Loader2, RefreshCw, ShieldOff, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import type { EstadoAccesos } from '@/lib/licencias-server';

type Estado = EstadoAccesos;

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function AccesosPanel({ inicial, diasValidez }: { inicial: Estado; diasValidez: number }) {
  // El estado inicial lo calcula la página en el servidor; aquí solo se refresca tras actuar.
  const [estado, setEstado] = useState<Estado | null>(inicial);
  const [busy, setBusy] = useState(false);
  const [revocando, setRevocando] = useState(false);

  async function cargar() {
    try {
      const r = await fetch('/api/licencias/admin/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'estado' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEstado(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo consultar el estado');
    }
  }

  async function generar() {
    setBusy(true);
    try {
      const r = await fetch('/api/licencias/admin/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'generar', diasValidez }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      haptic.success();
      toast.success(`${d.nuevos} enlaces nuevos · ${d.reutilizados} reutilizados`);
      await cargar();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se pudieron generar');
    } finally {
      setBusy(false);
    }
  }

  async function revocar() {
    if (!confirm('¿Anular TODOS los enlaces de licencias? Los que ya se enviaron dejarán de funcionar.')) return;
    setRevocando(true);
    try {
      const r = await fetch('/api/licencias/admin/accesos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'revocar' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`${d.revocados} enlaces anulados`);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron anular');
    } finally {
      setRevocando(false);
    }
  }

  const faltan = estado ? estado.familias - estado.conEnlace : 0;

  return (
    <div className="space-y-4">
      {!estado ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando familias de la campaña…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Familias con correo" value={String(estado.familias)} />
            <Kpi label="Con enlace" value={String(estado.conEnlace)} />
            <Kpi label="Sin enlace" value={String(faltan)} accent={faltan > 0} />
            <Kpi label="Ya lo han usado" value={String(estado.usados)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generar}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Generar los enlaces que falten
            </button>
            <a
              href="/api/licencias/admin/accesos/export"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" /> CSV con los enlaces
            </a>
            <button
              type="button"
              onClick={() => void cargar()}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Generar es <strong>idempotente</strong>: reutiliza los enlaces que ya existen (los correos enviados siguen
            funcionando) y solo crea los que falten. Los nuevos caducan a los {diasValidez} días. No hace falta venir
            aquí antes de un envío: la pantalla de <strong>Correos</strong> genera lo que falte al enviar.
          </p>

          {estado.alumnosSinCorreo.length > 0 && (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-500/10">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <TriangleAlert className="h-4 w-4" />
                {estado.alumnosSinCorreo.length} alumnos sin correo de tutor en Educamos
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Estas familias no reciben enlace: hay que avisarlas por otra vía (o completar su correo en Educamos y
                volver a sincronizar).
              </p>
              <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-amber-800/90 dark:text-amber-200/90">
                {estado.alumnosSinCorreo.map((a, i) => (
                  <li key={i}>
                    {a.curso} · {a.apellidos}, {a.nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {estado.alumnosSinEnlaceCentral > 0 && (
            <p className="text-xs text-zinc-400">
              {estado.alumnosSinEnlaceCentral} alumnos de la campaña no están enlazados a la BBDD central: sin enlace a
              `edu_students` no se les puede localizar el tutor (se arregla sincronizando alumnos).
            </p>
          )}

          <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={revocar}
              disabled={revocando}
              className="inline-flex items-center gap-2 text-sm text-red-600 hover:underline disabled:opacity-40 dark:text-red-400 cursor-pointer"
            >
              {revocando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Anular todos los enlaces
            </button>
            <p className="mt-1 text-xs text-zinc-400">
              Solo si sospechas que un enlace se ha compartido donde no debía. Después habrá que generar y reenviar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
