'use client';

// Disponibilidad (docs/32, decisión 15): lo dispuesto que está cada profe en cada franja de su semana.
// Sale sola del horario y Jefatura la retoca a mano. Dos vistas (filtros, no un segundo segmentado:
// ya hay secciones): «Por profe», su rejilla tocable; y «La semana», cuántos hay en cada estado y
// dónde va a faltar gente. Mismo aspecto que la rejilla de Oratorios.
import { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { diaCorto } from '@/lib/oratorios';
import { ETAPA_LABEL, type Etapa } from '@/lib/cursos';
import { DISPONIBILIDAD_INFO, DISPONIBILIDADES, hora, siguienteEstado, type CasillaDisponibilidad, type Disponibilidad as Disp } from '@/lib/sustituciones';
import type { DatosDisponibilidad } from '@/lib/sustituciones-server';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { COLOR_DISPONIBILIDAD, IconoDisponibilidad, pedir } from './comun';

type Vista = 'profe' | 'semana';
const DIAS = [1, 2, 3, 4, 5];

function urlCon(cambios: Record<string, string | null>): URL {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(cambios)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  return url;
}

export function Disponibilidad({ inicial, vistaInicial, etapaInicial }: { inicial: DatosDisponibilidad; vistaInicial: Vista; etapaInicial: Etapa | null }) {
  const [datos, setDatos] = useState(inicial);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial ?? inicial.semana.find((s) => s.franjas.length > 0)?.etapa ?? 'EP');
  const [cargando, setCargando] = useState(false);
  // Mientras se guarda una casilla no se toca otra: la siguiente se calcula desde lo guardado.
  const [guardando, setGuardando] = useState(false);
  const peticion = useRef(0);

  async function recargar(profeId: string | null) {
    const n = ++peticion.current;
    setCargando(true);
    try {
      const d = await pedir<DatosDisponibilidad>(`/api/sustituciones/admin/disponibilidad${profeId ? `?profeId=${profeId}` : ''}`);
      if (n === peticion.current) setDatos(d);
    } catch (e) {
      if (n === peticion.current) toast.error(e instanceof Error ? e.message : 'No se ha podido cargar');
    } finally {
      if (n === peticion.current) setCargando(false);
    }
  }

  function elegirProfe(id: string) {
    window.history.pushState(null, '', urlCon({ profe: id || null }));
    void recargar(id || null);
  }

  function cambiarVista(v: Vista) {
    setVista(v);
    window.history.pushState(null, '', urlCon({ vista: v === 'semana' ? 'semana' : null }));
  }

  async function tocar(c: CasillaDisponibilidad) {
    const profe = datos.porProfe?.profe;
    if (!profe || c.bloqueada || guardando) return;
    setGuardando(true);
    const actual = c.retocada ? c.disponibilidad : null;
    const nuevo = siguienteEstado(actual);
    haptic.tap();
    // Al momento en pantalla; luego se guarda y se relee (las cuentas de «La semana» cambian).
    setDatos((d) =>
      d.porProfe
        ? {
            ...d,
            porProfe: {
              ...d.porProfe,
              bloques: d.porProfe.bloques.map((b) => ({
                ...b,
                casillas: b.casillas.map((x) =>
                  x.dia === c.dia && x.horaInicio === c.horaInicio && x.horaFin === c.horaFin ? { ...x, disponibilidad: nuevo ?? x.automatica, retocada: nuevo !== null } : x,
                ),
              })),
            },
          }
        : d,
    );
    try {
      await pedir('/api/sustituciones/admin/disponibilidad', { method: 'PUT', body: { profeId: profe.id, dia: c.dia, horaInicio: c.horaInicio, horaFin: c.horaFin, estado: nuevo } });
      toast.success(`${diaLargo(c.dia)} ${hora(c.horaInicio)}: ${nuevo ? DISPONIBILIDAD_INFO[nuevo].nombre : `automático (${DISPONIBILIDAD_INFO[c.automatica].nombre})`}`);
      await recargar(profe.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
      await recargar(profe.id);
    } finally {
      setGuardando(false);
    }
  }

  async function volverAlHorario() {
    const profe = datos.porProfe?.profe;
    if (!profe) return;
    try {
      const r = await pedir<{ borrados: number }>(`/api/sustituciones/admin/disponibilidad?profeId=${profe.id}`, { method: 'DELETE' });
      toast.success(r.borrados ? `Quitados ${r.borrados} retoques: vuelve a lo del horario` : 'No tenía retoques');
      await recargar(profe.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido');
    }
  }

  const retoques = datos.porProfe?.bloques.flatMap((b) => b.casillas).filter((c) => c.retocada).length ?? 0;
  const semana = datos.semana.find((s) => s.etapa === etapa);

  return (
    <div className={cn('space-y-5 transition-opacity', cargando && 'opacity-70')} aria-busy={cargando}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Filtros etiqueta="Vista">
          <Filtro activo={vista === 'profe'} onClick={() => cambiarVista('profe')}>
            Por profe
          </Filtro>
          <Filtro activo={vista === 'semana'} onClick={() => cambiarVista('semana')}>
            La semana
          </Filtro>
        </Filtros>
        <Leyenda />
      </div>

      {vista === 'profe' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Selector aria-label="Profe" className="max-w-xs" value={datos.porProfe?.profe.id ?? ''} onChange={(e) => elegirProfe(e.target.value)}>
              <option value="">Elige un profe…</option>
              {datos.profes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
            {retoques > 0 && (
              <ConfirmarEnLinea
                etiqueta="Volver a lo del horario"
                icono={<RotateCcw aria-hidden />}
                variante="ghost"
                pregunta={`¿Quitar sus ${retoques} retoques?`}
                confirmar="Quitar"
                onConfirmar={volverAlHorario}
              />
            )}
          </div>
          {!datos.porProfe ? (
            <Vacio titulo="Elige un profe para ver su semana">Sale sola de su horario: tocar una casilla la cambia (Sí → Si hace falta → Solo urgencia → No → automático).</Vacio>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Toca una casilla para cambiarla: Sí → Si hace falta → Solo urgencia → No → automático. Las de clase propia, en gris, no se pueden subir.
              </p>
              {datos.porProfe.bloques.map((b) => (
                <section key={b.etapa} className="space-y-2">
                  {datos.porProfe!.bloques.length > 1 && <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{ETAPA_LABEL[b.etapa]}</h2>}
                  <Rejilla franjas={b.franjas}>
                    {(dia, f) => {
                      const c = b.casillas.find((x) => x.dia === dia && x.horaInicio === f.horaInicio && x.horaFin === f.horaFin);
                      return c ? <Casilla c={c} onTocar={() => void tocar(c)} /> : <div />;
                    }}
                  </Rejilla>
                </section>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <Filtros etiqueta="Etapa">
            {datos.semana.map((s) => (
              <Filtro key={s.etapa} activo={etapa === s.etapa} onClick={() => setEtapa(s.etapa)}>
                {ETAPA_LABEL[s.etapa]}
              </Filtro>
            ))}
          </Filtros>
          {!semana || semana.franjas.length === 0 ? (
            <Vacio titulo="Esta etapa no tiene horario importado" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                <span>La vista «La semana» resume la disponibilidad del equipo. Para cambiar una casilla, edítala por profesor.</span>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => cambiarVista('profe')}>Editar por profe</Button>
              </div>
              {semana.casillas.some((c) => c.falta) && (
                <Aviso tono="aviso">En ámbar, las franjas sin nadie en «Sí» ni en «Si hace falta»: si alguien falta ahí, costará cubrirlo.</Aviso>
              )}
              <Rejilla franjas={semana.franjas}>
                {(dia, f) => {
                  const c = semana.casillas.find((x) => x.dia === dia && x.horaInicio === f.horaInicio);
                  if (!c) return <div />;
                  return (
                    <details className={cn('group min-h-14 rounded-lg border p-1.5 text-xs', c.falta ? COLOR_DISPONIBILIDAD.urgencia : COLOR_DISPONIBILIDAD.si_hace_falta)}>
                      <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {(['si', 'si_hace_falta', 'urgencia'] as Disp[]).map((d) => (
                          <span key={d} className="inline-flex items-center gap-0.5 tabular-nums" aria-label={`${DISPONIBILIDAD_INFO[d].nombre}: ${c.cuenta[d]}`}>
                            <IconoDisponibilidad d={d} className="size-3.5" />
                            {c.cuenta[d]}
                          </span>
                        ))}
                      </summary>
                      <div className="mt-1 space-y-0.5 text-zinc-700 dark:text-zinc-300">
                        {c.disponibles.length > 0 ? <p>{c.disponibles.join(', ')}</p> : <p>Nadie disponible</p>}
                        {c.enCuadro.length > 0 && <p className="text-zinc-500 dark:text-zinc-400">En el cuadro: {c.enCuadro.join(', ')}</p>}
                      </div>
                    </details>
                  );
                }}
              </Rejilla>
            </>
          )}
        </>
      )}
    </div>
  );
}

function diaLargo(d: number): string {
  return ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][d] ?? '';
}

function Leyenda() {
  return (
    <span className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-300">
      {DISPONIBILIDADES.map((d) => (
        <span key={d} className="inline-flex items-center gap-1">
          <IconoDisponibilidad d={d} /> {DISPONIBILIDAD_INFO[d].nombre}
        </span>
      ))}
    </span>
  );
}

function Rejilla({ franjas, children }: { franjas: { horaInicio: string; horaFin: string }[]; children: (dia: number, f: { horaInicio: string; horaFin: string }) => React.ReactNode }) {
  return (
    <Tarjeta className="overflow-x-auto p-3">
      <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: '3.5rem repeat(5, minmax(0, 1fr))' }}>
        <div />
        {DIAS.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {diaCorto(d)}
          </div>
        ))}
        {franjas.map((f) => (
          <div key={`${f.horaInicio}-${f.horaFin}`} className="contents">
            <div className="flex flex-col items-end justify-center pr-1 text-xs leading-tight text-zinc-500 tabular-nums">
              <span>{hora(f.horaInicio)}</span>
              <span>{hora(f.horaFin)}</span>
            </div>
            {DIAS.map((dia) => (
              <div key={dia}>{children(dia, f)}</div>
            ))}
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function Casilla({ c, onTocar }: { c: CasillaDisponibilidad; onTocar: () => void }) {
  const d = c.disponibilidad;
  const texto = c.ocupacion.length > 0 ? c.ocupacion.join(' · ') : c.nivel === 'libre' ? 'Hora libre' : 'Sin horario';
  return (
    <button
      type="button"
      onClick={onTocar}
      disabled={c.bloqueada}
      aria-pressed={c.retocada}
      aria-label={`${diaLargo(c.dia)} ${hora(c.horaInicio)}: ${DISPONIBILIDAD_INFO[d].nombre}${c.retocada ? ' (a mano)' : ''}. ${texto}`}
      className={cn(
        'touch-manipulation flex min-h-14 w-full flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed',
        COLOR_DISPONIBILIDAD[d],
      )}
    >
      <span className="inline-flex items-center gap-1 font-semibold">
        <IconoDisponibilidad d={d} className="size-3.5" />
        {DISPONIBILIDAD_INFO[d].nombre}
      </span>
      <span className="line-clamp-2 w-full opacity-80">{texto}</span>
      {c.retocada && <span className="rounded bg-white/70 px-1 font-medium dark:bg-black/30">a mano</span>}
    </button>
  );
}
