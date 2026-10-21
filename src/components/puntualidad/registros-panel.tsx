'use client';

// Listado de retrasos. Es la pantalla de "arreglar cosas": justificar a posteriori (el
// alumno trae el justificante al día siguiente), corregir un dedazo o borrar un registro
// duplicado. Todo en la propia fila, sin navegar a ningún sitio.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ClipboardCheck, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Interruptor } from '@/components/ui/interruptor';
import { Rotulo } from '@/components/ui/rotulo';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
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
      <h1 className="sr-only">Retrasos</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros etiqueta="Mostrar">
          {rangos.map((r) => (
            <Filtro key={r.clave} activo={rangoActivo === r.clave} onClick={() => router.push(filtroUrl({ rango: r.clave }))}>
              {r.label}
            </Filtro>
          ))}
          <Filtro
            activo={soloNoJustificados}
            onClick={() => router.push(filtroUrl({ sinJustificar: !soloNoJustificados }))}
          >
            Solo sin justificar
          </Filtro>
        </Filtros>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
            {filas.length} {filas.length === 1 ? 'registro' : 'registros'}
          </span>
          <a href={exportUrl} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Download aria-hidden /> Descargar CSV
          </a>
        </div>
      </div>

      {filas.length === 0 ? (
        <Vacio icono={<ClipboardCheck />} titulo="Ni un retraso en este periodo">
          Prueba con otro periodo o quita «Solo sin justificar» si buscas algo concreto.
        </Vacio>
      ) : (
        <div className="space-y-5">
          {porDias(filas).map(([dia, delDia]) => {
            const sinJustificar = delDia.filter((f) => !f.justificado).length;
            return (
              <section key={dia} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-2 px-1">
                  <Rotulo>{fechaLarga(dia)}</Rotulo>
                  <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                    {delDia.length} {delDia.length === 1 ? 'retraso' : 'retrasos'}
                    {sinJustificar !== delDia.length && ` · ${sinJustificar} sin justificar`}
                  </span>
                </div>
                <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
                  {delDia.map((f) => (
                    <li key={f.id}>
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-12 shrink-0 text-sm text-zinc-600 tabular-nums dark:text-zinc-400">{f.hora}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/gestion/puntualidad/alumno/${f.eduStudentId}`}
                              className="truncate rounded text-sm font-medium text-zinc-900 underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-100"
                            >
                              {f.alumno}
                            </Link>
                            <Etiqueta>{f.clase}</Etiqueta>
                          </div>
                          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                            {f.asignatura ?? 'sin asignatura'}
                            {f.minutosRetraso > 0 && ` · ${formatoRetraso(f.minutosRetraso)} tarde`}
                            {f.profe && ` · ${f.profe}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {f.justificado && (
                            <Estado tono="ok" className="hidden sm:inline-flex">
                              {labelJustificacion(f.justificacionTipo) || 'Justificado'}
                            </Estado>
                          )}
                          {f.consumido && (
                            <Estado tono="error" className="hidden sm:inline-flex">
                              Con consecuencia
                            </Estado>
                          )}
                          {ocupado === f.id ? (
                            <span className="flex size-10 items-center justify-center">
                              <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin text-zinc-500" />
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setAbierta(abierta === f.id ? null : f.id)}
                              aria-expanded={abierta === f.id}
                              aria-label={`Editar el retraso de ${f.alumno}`}
                            >
                              <ChevronDown className={cn('transition-transform', abierta === f.id && 'rotate-180')} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {abierta === f.id && (
                        <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                          {(f.justificado || f.consumido) && (
                            <div className="flex flex-wrap gap-1.5 sm:hidden">
                              {f.justificado && (
                                <Estado tono="ok">{labelJustificacion(f.justificacionTipo) || 'Justificado'}</Estado>
                              )}
                              {f.consumido && <Estado tono="error">Con consecuencia</Estado>}
                            </div>
                          )}
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
                            <Filtros etiqueta="Tipo de justificación">
                              {JUSTIFICACION_TIPOS.map((t) => (
                                <Filtro
                                  key={t.value}
                                  activo={f.justificacionTipo === t.value}
                                  onClick={() => patch(f.id, { justificacionTipo: t.value as JustificacionTipo })}
                                >
                                  {t.label}
                                </Filtro>
                              ))}
                            </Filtros>
                          )}
                          <Interruptor
                            activo={f.subeAClase}
                            etiqueta="Sube a clase"
                            onChange={(v) => patch(f.id, { subeAClase: v })}
                          />
                          <ObservacionesInline
                            valor={f.observaciones ?? ''}
                            onGuardar={(texto) => patch(f.id, { observaciones: texto || null })}
                          />
                          <ConfirmarEnLinea
                            etiqueta="Borrar este registro"
                            icono={<Trash2 />}
                            pregunta={`¿Borrar el retraso de ${f.alumno} del ${fechaCorta(f.fecha)}?`}
                            onConfirmar={() => borrar(f)}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
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
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Observaciones"
        placeholder="Observaciones"
        className="min-h-20 flex-1"
      />
      {sucio && (
        <Button type="button" size="sm" onClick={() => onGuardar(texto.trim())}>
          Guardar
        </Button>
      )}
    </div>
  );
}
