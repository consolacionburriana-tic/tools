'use client';

// «Hoy» (docs/32 §4.7): las horas de un día POR HORA, no por profe — es como lo piensa Jefatura a las
// 8:45. Cambiar de día no recarga la página: `history.pushState` y una consulta ligera (docs/04).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck2, ChevronLeft, ChevronRight, Mail, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sumarDias, diaSemana } from '@/lib/oratorios';
import { fechaLarga, lugarDe, mayuscula } from '@/lib/sustituciones';
import type { DatosHoy } from '@/lib/sustituciones-server';
import { Button, buttonVariants } from '@/components/ui/button';
import { Cifra, Cifras } from '@/components/ui/cifra';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Input } from '@/components/ui/input';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { EstadoHora, horaRango, pedir } from './comun';

/** El día lectivo de al lado (salta el fin de semana). */
function otroDia(fecha: string, paso: 1 | -1): string {
  let f = sumarDias(fecha, paso);
  while (diaSemana(f) > 5) f = sumarDias(f, paso);
  return f;
}

export function Hoy({ inicial, hoy }: { inicial: DatosHoy; hoy: string }) {
  const [datos, setDatos] = useState(inicial);
  const [cargando, setCargando] = useState(false);

  async function ir(fecha: string, apuntar = true) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    if (apuntar) {
      const url = new URL(window.location.href);
      if (fecha === hoy) url.searchParams.delete('fecha');
      else url.searchParams.set('fecha', fecha);
      window.history.pushState(null, '', url);
    }
    setCargando(true);
    try {
      setDatos(await pedir<DatosHoy>(`/api/sustituciones/admin/dia?fecha=${fecha}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido cargar el día');
    } finally {
      setCargando(false);
    }
  }

  // Atrás / adelante del navegador.
  useEffect(() => {
    const alVolver = () => void ir(new URL(window.location.href).searchParams.get('fecha') ?? hoy, false);
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy]);

  const esHoy = datos.fecha === hoy;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => void ir(otroDia(datos.fecha, -1))}>
            <ChevronLeft />
          </Button>
          <Input type="date" aria-label="Día" value={datos.fecha} onChange={(e) => void ir(e.target.value)} className="w-44" />
          <Button variant="outline" size="icon" aria-label="Día siguiente" onClick={() => void ir(otroDia(datos.fecha, 1))}>
            <ChevronRight />
          </Button>
          {!esHoy && (
            <Button variant="ghost" onClick={() => void ir(hoy)}>
              Hoy
            </Button>
          )}
        </div>
        <Link href="/gestion/sustituciones/ajustes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <SlidersHorizontal aria-hidden /> Ajustes de los correos
        </Link>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {mayuscula(fechaLarga(datos.fecha))}
        {esHoy ? ' · hoy' : ''}
      </p>

      <div className={cn('space-y-5 transition-opacity', cargando && 'opacity-60')} aria-busy={cargando}>
        <Cifras className="sm:grid-cols-3">
          <Cifra etiqueta="Horas a cubrir" valor={datos.aCubrir} />
          <Cifra etiqueta="Cubiertas" valor={datos.cubiertas} barra={datos.aCubrir ? datos.cubiertas / datos.aCubrir : undefined} />
          <Cifra etiqueta="Sin cubrir" valor={datos.sinCubrir} tono={datos.sinCubrir > 0 ? 'aviso' : undefined} />
        </Cifras>

        {datos.filas.length === 0 ? (
          <Vacio
            icono={<CalendarCheck2 />}
            titulo={esHoy ? 'Hoy no falta nadie' : 'Ese día no falta nadie'}
            accion={
              <Link href="/gestion/sustituciones/nueva" className={buttonVariants({ variant: 'outline' })}>
                Apuntar una ausencia
              </Link>
            }
          />
        ) : (
          <Tarjeta>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {datos.filas.map((f) => (
              <li key={f.sesionId}>
                <Link
                  href={`/gestion/sustituciones/${f.ausenciaId}`}
                  className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800/50"
                >
                  <span className="w-28 shrink-0 text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                    {f.tramo ? `${f.tramo} · ` : ''}
                    {horaRango(f.horaInicio, f.horaFin)}
                  </span>
                  {f.grupos && <Etiqueta>{f.grupos}</Etiqueta>}
                  <span className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {lugarDe({ grupos: null, materia: f.materia, aula: f.aula })}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      Falta {f.profe}
                      {f.hayQueCubrir && (
                        <>
                          <ArrowRight aria-hidden className="size-3.5 text-zinc-400" />
                          {f.sustituto ? <span>entra <strong className="font-semibold">{f.sustituto}</strong></span> : <span className="text-amber-700 dark:text-amber-400">nadie todavía</span>}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {f.avisoEstado === 'enviado' && <Mail aria-label="Avisado por correo" className="size-4 text-zinc-400" />}
                    <EstadoHora hayQueCubrir={f.hayQueCubrir} sustituto={f.sustituto} avisoEstado={f.avisoEstado} />
                  </span>
                </Link>
              </li>
            ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
