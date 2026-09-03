'use client';

// Listado de retrasos. Es la pantalla de "arreglar cosas": justificar a posteriori (el
// alumno trae el justificante al día siguiente), corregir un dedazo o borrar un registro
// duplicado. Todo en la propia fila, sin navegar a ningún sitio.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, ChevronDown, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Chip, ClaseChip, Interruptor } from './ui';
import { haptic } from '@/lib/haptics';
import { JUSTIFICACION_TIPOS, formatoRetraso, labelJustificacion, type JustificacionTipo } from '@/lib/puntualidad';
import type { RetrasoListado } from '@/lib/puntualidad-server';

const fechaCorta = (iso: string) => {
  try {
    return format(parseISO(iso), 'EEE d MMM', { locale: es });
  } catch {
    return iso;
  }
};

const fechaLarga = (iso: string) => {
  try {
    return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
};

/** Agrupa por día: leer "martes 3, cuatro retrasos" es mucho más rápido que una lista plana. */
function porDias(filas: RetrasoListado[]) {
  const mapa = new Map<string, RetrasoListado[]>();
  for (const f of filas) {
    const lista = mapa.get(f.fecha) ?? [];
    lista.push(f);
    mapa.set(f.fecha, lista);
  }
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function RegistrosPanel({
  filas,
  rangoActivo,
  soloNoJustificados,
  exportUrl,
}: {
  filas: RetrasoListado[];
  rangoActivo: string;
  soloNoJustificados: boolean;
  exportUrl: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const patch = async (id: string, cambios: Record<string, unknown>) => {
    setOcupado(id);
    try {
      const res = await fetch(`/api/puntualidad/admin/registros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      await haptic.success();
      startTransition(() => router.refresh());
    } catch (error) {
      await haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (fila: RetrasoListado) => {
    if (!confirm(`¿Borrar el retraso de ${fila.alumno} del ${fechaCorta(fila.fecha)}?`)) return;
    setOcupado(fila.id);
    try {
      const res = await fetch(`/api/puntualidad/admin/registros/${fila.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo borrar');
      toast.success('Registro borrado');
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo borrar');
    } finally {
      setOcupado(null);
    }
  };

  const rangos = [
    { clave: '7', label: '7 días' },
    { clave: '30', label: '30 días' },
    { clave: 'curso', label: 'Todo el curso' },
  ];

  const filtroUrl = (cambios: { rango?: string; sinJustificar?: boolean }) => {
    const p = new URLSearchParams();
    p.set('rango', cambios.rango ?? rangoActivo);
    if (cambios.sinJustificar ?? soloNoJustificados) p.set('sinJustificar', '1');
    return `/gestion/puntualidad/registros?${p.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Retrasos</h1>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" /> CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {rangos.map((r) => (
          <Link
            key={r.clave}
            href={filtroUrl({ rango: r.clave })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              rangoActivo === r.clave
                ? 'bg-orange-500 text-white'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {r.label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
        <Link
          href={filtroUrl({ sinJustificar: !soloNoJustificados })}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            soloNoJustificados
              ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
              : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
        >
          Solo sin justificar
        </Link>
        <span className="ml-auto text-xs text-zinc-400">
          {filas.length} {filas.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700">
          Ni un retraso en este periodo. 🎉
        </p>
      ) : (
        <div className="space-y-4">
        {porDias(filas).map(([dia, delDia]) => (
        <section key={dia} className="space-y-1.5">
          <div className="flex items-baseline gap-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {fechaLarga(dia)}
            </h2>
            <span className="text-xs text-zinc-400">
              {delDia.length} {delDia.length === 1 ? 'retraso' : 'retrasos'}
              {delDia.filter((f) => !f.justificado).length !== delDia.length &&
                ` · ${delDia.filter((f) => !f.justificado).length} sin justificar`}
            </span>
          </div>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {delDia.map((f) => (
            <li key={f.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-14 shrink-0 text-xs tabular-nums text-zinc-500">{f.hora}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/gestion/puntualidad/alumno/${f.eduStudentId}`}
                      className="truncate text-sm font-medium text-zinc-900 transition-colors hover:text-orange-600 dark:text-zinc-100"
                    >
                      {f.alumno}
                    </Link>
                    <ClaseChip clase={f.clase} />
                  </div>
                  <p className="truncate text-xs text-zinc-400">
                    {f.asignatura ?? 'sin asignatura'}
                    {f.minutosRetraso > 0 && ` · ${formatoRetraso(f.minutosRetraso)} tarde`}
                    {f.profe && ` · ${f.profe}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {f.justificado && (
                    <span className="hidden rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:block dark:bg-emerald-900/30 dark:text-emerald-300">
                      {labelJustificacion(f.justificacionTipo) || 'justificado'}
                    </span>
                  )}
                  {f.consumido && (
                    <span className="hidden rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 sm:block dark:bg-rose-900/30 dark:text-rose-300">
                      con consecuencia
                    </span>
                  )}
                  {ocupado === f.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      aria-label="Editar"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${abierta === f.id ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {abierta === f.id && (
                <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <Interruptor
                    activo={f.justificado}
                    etiqueta="Justificado"
                    descripcion="Los justificados no cuentan para el ciclo de tres"
                    onChange={(v) =>
                      patch(f.id, {
                        justificado: v,
                        justificacionTipo: v ? (f.justificacionTipo ?? 'familiar') : null,
                      })
                    }
                  />
                  {f.justificado && (
                    <div className="flex flex-wrap gap-2">
                      {JUSTIFICACION_TIPOS.map((t) => (
                        <Chip
                          key={t.value}
                          tamano="pequeno"
                          activo={f.justificacionTipo === t.value}
                          onClick={() => patch(f.id, { justificacionTipo: t.value as JustificacionTipo })}
                        >
                          {t.label}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <Interruptor
                    activo={f.subeAClase}
                    etiqueta="Sube a clase"
                    onChange={(v) => patch(f.id, { subeAClase: v })}
                  />
                  <ObservacionesInline valor={f.observaciones ?? ''} onGuardar={(texto) => patch(f.id, { observaciones: texto || null })} />
                  <button
                    type="button"
                    onClick={() => borrar(f)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Borrar este registro
                  </button>
                </div>
              )}
            </li>
          ))}
          </ul>
        </section>
        ))}
        </div>
      )}
    </div>
  );
}

function ObservacionesInline({ valor, onGuardar }: { valor: string; onGuardar: (texto: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const sucio = texto !== valor;
  return (
    <div className="flex items-start gap-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        placeholder="Observaciones"
        className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {sucio && (
        <button
          type="button"
          onClick={() => onGuardar(texto.trim())}
          className="mt-0.5 inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white"
        >
          <Check className="h-3.5 w-3.5" /> Guardar
        </button>
      )}
    </div>
  );
}
