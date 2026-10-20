'use client';

// Pestaña «Cuotas»: lo que pagaría cada uno según cómo tiene el iPad HOY (Jose Miguel,
// 13-oct-2026). Cómo se cobra —cada mes, una vez, prorrateo— está pendiente de secretaría y
// Jose Miguel, así que esto es la foto del día, para descargar.
import { useMemo, useState } from 'react';
import { AlertTriangle, FileDown, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONCEPTO_LABEL, cuotaDe, resumenCuotas, type Concepto } from '@/lib/dispositivos';
import type { PanelDispositivos } from '@/lib/dispositivos-server';
import type { Acciones } from './panel';
import { ESTILO_BOTON } from './comun';

type Grupo = Concepto | 'falta';

export function Cuotas({ panel, acciones }: { panel: PanelDispositivos; acciones: Acciones }) {
  const [abierto, setAbierto] = useState<Grupo | null>('mensual');
  const filas = useMemo(
    () =>
      panel.alumnos
        .filter((a) => a.estado)
        .map((a) => ({ alumno: a, cuota: cuotaDe(a.estado!, panel.cursoActual) })),
    [panel.alumnos, panel.cursoActual],
  );
  const resumen = resumenCuotas(filas.map((f) => f.cuota));
  const sinInformar = panel.alumnos.length - filas.length;
  const prestadosSinIpad = useMemo(() => {
    const conIpad = new Set(panel.aparatos.filter((x) => x.uso === 'prestamo' && x.titular?.tipo === 'alumno').map((x) => x.titular!.id));
    return panel.alumnos.filter((a) => a.estado?.modalidad === 'prestado' && !conIpad.has(a.id)).length;
  }, [panel.alumnos, panel.aparatos]);

  const de = (g: Grupo) => filas.filter((f) => (g === 'falta' ? f.cuota.aviso : f.cuota.concepto === g && !f.cuota.aviso));

  const tarjetas: { g: Grupo; titulo: string; n: number; detalle: string }[] = [
    { g: 'mensual', titulo: CONCEPTO_LABEL.mensual, n: resumen.mensual.n, detalle: `${resumen.mensual.total} € al mes` },
    { g: 'anual', titulo: CONCEPTO_LABEL.anual, n: resumen.anual.n, detalle: `${resumen.anual.total} € este curso` },
    { g: 'falta', titulo: 'Falta un dato', n: resumen.avisos, detalle: 'Sin curso de compra: no se sabe' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          La foto de hoy: lo que paga cada uno según cómo tiene el iPad. Cómo y cuándo se cobra está pendiente de secretaría y Jose Miguel.
        </p>
        <div className="flex gap-2">
          <a href="/api/dispositivos/cuotas?formato=xlsx" className={ESTILO_BOTON} onClick={() => haptic.tap()}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </a>
          <a href="/api/dispositivos/cuotas?formato=csv" className={ESTILO_BOTON} onClick={() => haptic.tap()}>
            <FileDown className="h-4 w-4" /> CSV
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tarjetas.map((t) => (
          <button
            key={t.g}
            type="button"
            onClick={() => {
              haptic.tap();
              setAbierto(abierto === t.g ? null : t.g);
            }}
            aria-expanded={abierto === t.g}
            className={cn(
              'cursor-pointer rounded-2xl border bg-white p-4 text-left transition-colors dark:bg-zinc-900',
              abierto === t.g ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800',
              t.g === 'falta' && t.n > 0 && 'border-dashed border-amber-500 bg-amber-50/60 dark:bg-amber-500/5',
            )}
          >
            <span className="block text-sm text-zinc-500">{t.titulo}</span>
            <span className="mt-1 block text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {t.n} <span className="text-base font-medium">{t.n === 1 ? 'alumno' : 'alumnos'}</span>
            </span>
            <span className="block text-sm text-zinc-600 dark:text-zinc-400">{t.detalle}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No pagan <strong>{resumen.nada}</strong> (seguro en vigor o prestado que se queda en el cole).
        {sinInformar > 0 && (
          <>
            {' '}
            <button type="button" className="cursor-pointer font-medium text-amber-800 underline dark:text-amber-300" onClick={() => acciones.irA('alumnado', 'sin')}>
              {sinInformar} sin informar
            </button>{' '}
            no salen hasta que se sepa cómo lo tienen.
          </>
        )}
      </p>

      {prestadosSinIpad > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {prestadosSinIpad === 1 ? '1 prestado sin iPad del cole asignado.' : `${prestadosSinIpad} prestados sin iPad del cole asignado.`}
          <button type="button" className="cursor-pointer font-semibold underline" onClick={() => acciones.irA('alumnado', 'falta')}>
            Verlos
          </button>
        </p>
      )}

      {abierto && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {de(abierto).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">Nadie aquí.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-2 font-medium">Alumno</th>
                  <th className="px-4 py-2 font-medium">Clase</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Por qué</th>
                  <th className="px-4 py-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {de(abierto).map(({ alumno: a, cuota: c }) => (
                  <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2.5">
                      <button type="button" className="cursor-pointer text-left font-medium hover:underline" onClick={() => acciones.abrirFicha(a.id)}>
                        {a.nombre}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{a.clase}</td>
                    <td className="hidden px-4 py-2.5 text-zinc-600 sm:table-cell dark:text-zinc-400">{c.aviso ?? c.motivo}</td>
                    <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">{c.aviso ? '¿?' : `${c.importe} €`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
