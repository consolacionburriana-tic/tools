'use client';

// Planificar: el asistente. Semana a semana, los huecos de quien lo lleva y quién cabe en
// cada uno (con la materia y el profe que pierde la hora y sus avisos). Dos
// toques por sesión: el hueco y la clase. Ficha: docs/26-oratorios.md
import { ArrowRightLeft, BookOpen, BookOpenText, CalendarClock, CalendarOff, ChevronLeft, ChevronRight, Check, CheckCheck, Plus, Sparkles, Target, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { useConfirmar } from '@/components/ui/confirmar';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { claseCampo, Input } from '@/components/ui/input';
import { Selector } from '@/components/ui/selector';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  aMin,
  autocompletar,
  avisosCandidato,
  candidatosHueco,
  chipEstado,
  claseDeClave,
  claveClase,
  clasesDeHueco,
  clasesDeTipo,
  clasesSinHorario,
  diaCorto,
  diaSemana,
  esDiaLectivo,
  esFestivo,
  estaActiva,
  etiquetaClase,
  fechaCorta,
  fechaLarga,
  franjasDeEtapas,
  horaBonita,
  horaDeClase,
  huecoEn,
  lunesDe,
  necesidadEnFecha,
  NIVEL_INFO,
  nivelEn,
  ocupacionPropia,
  opcionesSesion,
  progresoTipo,
  rangosRapidos,
  sesionPorDefecto,
  sumarDias,
  unidadesCurso,
  unidadesEnRango,
  type Candidato,
  type Clase,
  type Disponibilidad,
  type Nivel,
  type ProfeAfectado,
  type RangoFechas,
  type SesionCatalogo,
  type SesionOra,
} from '@/lib/oratorios';
import { ETAPAS, nombreClase } from '@/lib/cursos';
import { api, AvisosCandidato, capital, EstadoChip, IconoNivel } from './comun';
import type { Estado } from './panel';

type Franja = { horaInicio: string; horaFin: string };

const FONDO_NIVEL: Record<Nivel, string> = {
  optima: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/40',
  alternativa: 'bg-amber-50 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/40',
  ultima: 'bg-zinc-100 border-zinc-300 border-dashed dark:bg-zinc-800/60 dark:border-zinc-600',
};

export function SelectorTipo({ e }: { e: Estado }) {
  return (
    <Filtros etiqueta="Tipo de momento">
      {e.tipos
        .filter((t) => t.activo)
        .map((t) => (
          <Filtro key={t.id} activo={t.id === e.tipoId} onClick={() => e.setTipoId(t.id)}>
            <span aria-hidden>{t.emoji}</span> {t.nombre}
          </Filtro>
        ))}
    </Filtros>
  );
}

export function SelectorResponsable({ e }: { e: Estado }) {
  const conCorreo = e.datos.profes.filter((p) => p.email);
  const esta = conCorreo.some((p) => p.email === e.responsable);
  return (
    <Selector
      value={e.responsable}
      onChange={(ev) => e.setResponsable(ev.target.value)}
      aria-label="Quién lo lleva (e invita)"
      title="Quién lo lleva (e invita)"
      className="w-auto max-w-full"
    >
      {!esta && <option value={e.responsable}>{e.responsable}</option>}
      {conCorreo.map((p) => (
        <option key={p.id} value={p.email!}>
          {p.nombre}
          {p.email === e.datos.yo.email ? ' (yo)' : ''}
        </option>
      ))}
    </Selector>
  );
}

function rangoInicial(e: Estado): { clave: string; rango: RangoFechas } {
  const rapidos = rangosRapidos(e.datos.hoy, e.ajustes.trimestres);
  const trimestreHoy = rapidos.find((r) => r.clave.startsWith('T') && r.rango.inicio <= e.datos.hoy && e.datos.hoy <= r.rango.fin);
  const r = trimestreHoy ?? rapidos[0];
  return { clave: r.clave, rango: r.rango };
}

export function Planificar({ e }: { e: Estado }) {
  const tipo = e.tipos.find((t) => t.id === e.tipoId) ?? e.tipos[0];
  const [{ clave: claveRango, rango }, setRango] = useState(() => rangoInicial(e));
  const [semana, setSemana] = useState(() => lunesDe(e.datos.hoy < rango.inicio ? rango.inicio : e.datos.hoy));
  const [hueco, setHueco] = useState<{ fecha: string; franja: Franja } | null>(null);
  const [manual, setManual] = useState<{ fecha: string; franja: Franja | null; clave?: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // La sesión del abanico que se fuerza para los momentos nuevos; sin forzar, cada clase lleva
  // la suya por defecto (lo normal: la misma en todas, salvo las hechas a medida para un nivel).
  const [forzadaEn, setForzadaEn] = useState<{ tipoId: string; id: string } | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  const clases = useMemo(() => (tipo ? clasesDeTipo(tipo, e.datos.clases) : []), [tipo, e.datos.clases]);
  const sinHorario = useMemo(() => clasesSinHorario(clases, e.datos.horario), [clases, e.datos.horario]);
  const abanico = useMemo(() => (tipo ? e.catalogo.filter((c) => c.tipoId === tipo.id && c.activo) : []), [tipo, e.catalogo]);
  const forzada = (tipo && forzadaEn?.tipoId === tipo.id ? abanico.find((c) => c.id === forzadaEn.id) : null) ?? null;
  const disp = useMemo(() => e.disponibilidad[e.responsable] ?? [], [e.disponibilidad, e.responsable]);
  const profeResp = e.datos.profes.find((p) => p.email === e.responsable)?.id ?? null;
  const moviendo = e.moviendo ? (e.sesiones.find((s) => s.id === e.moviendo) ?? null) : null;
  const ctx = useMemo(() => ({ ...e.ctx, responsableProfeId: profeResp }), [e.ctx, profeResp]);

  // Qué sesión se propondría sola para la semana que se está mirando (la más repetida entre las clases).
  const propuestaAuto = useMemo(() => {
    if (!tipo || abanico.length === 0) return null;
    const cuenta = new Map<string, { sesion: SesionCatalogo; n: number }>();
    for (const c of clases) {
      const d = sesionPorDefecto(opcionesSesion(ctx, tipo, c, semana));
      if (d) cuenta.set(d.id, { sesion: d, n: (cuenta.get(d.id)?.n ?? 0) + 1 });
    }
    return [...cuenta.values()].sort((a, b) => b.n - a.n)[0]?.sesion ?? null;
  }, [tipo, abanico, clases, ctx, semana]);

  // Al empezar a mover, la semana salta a la de la sesión (ajuste de estado en el render, no
  // en un efecto: es el patrón de React para «cuando cambia esta prop»).
  const [movidaVista, setMovidaVista] = useState<string | null>(null);
  if (moviendo && moviendo.id !== movidaVista) {
    setMovidaVista(moviendo.id);
    setSemana(lunesDe(moviendo.fecha));
  }

  const franjas = useMemo(() => {
    if (!tipo) return [];
    const deRejilla = franjasDeEtapas(e.datos.tramos, tipo.etapas.length ? tipo.etapas : ETAPAS);
    const mapa = new Map(deRejilla.map((f) => [`${f.horaInicio}-${f.horaFin}`, f]));
    for (const d of disp) if (![...mapa.values()].some((f) => f.horaInicio === d.horaInicio)) mapa.set(`${d.horaInicio}-${d.horaFin}`, { horaInicio: d.horaInicio, horaFin: d.horaFin });
    return [...mapa.values()].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio));
  }, [tipo, e.datos.tramos, disp]);

  const dias = [0, 1, 2, 3, 4].map((i) => sumarDias(semana, i));
  const unidades = useMemo(() => (tipo ? unidadesEnRango(unidadesCurso(tipo.frecuencia, e.ajustes.trimestres), rango) : []), [tipo, e.ajustes.trimestres, rango]);
  const progreso = useMemo(() => (tipo ? progresoTipo(tipo, clases, e.sesiones, unidades, e.datos.hoy) : []), [tipo, clases, e.sesiones, unidades, e.datos.hoy]);
  const borradores = e.sesiones.filter(
    (s) => s.tipoId === tipo?.id && s.estado === 'borrador' && s.responsableEmail === e.responsable && s.fecha >= rango.inicio && s.fecha <= rango.fin,
  );
  const porRecolocar = e.sesiones.filter((s) => s.tipoId === tipo?.id && s.estado === 'reprogramar');

  if (!tipo) return <p className="text-sm text-zinc-500">No hay ningún tipo activo. Créalo en Ajustes.</p>;

  /** La sesión del abanico para esta clase y fecha: la forzada, o la que toca por defecto. */
  function sesionPara(clase: Clase, fecha: string): SesionCatalogo | null {
    return forzada ?? sesionPorDefecto(opcionesSesion(ctx, tipo, clase, fecha));
  }

  function elegirRango(clave: string, r: RangoFechas) {
    setRango({ clave, rango: r });
    setSemana(lunesDe(e.datos.hoy >= r.inicio && e.datos.hoy <= r.fin ? e.datos.hoy : r.inicio));
  }

  async function crear(candidato: { clase: Clase; hora: { horaInicio: string; horaFin: string; profes: ProfeAfectado[] } }, fecha: string) {
    setTrabajando(true);
    try {
      const [nueva] = await api.crear([
        {
          tipoId: tipo.id,
          curso: candidato.clase.curso,
          letra: candidato.clase.letra,
          fecha,
          horaInicio: candidato.hora.horaInicio,
          horaFin: candidato.hora.horaFin,
          profes: candidato.hora.profes,
          responsableEmail: e.responsable,
          catalogoId: sesionPara(candidato.clase, fecha)?.id ?? null,
        },
      ]);
      e.guardarSesiones([nueva]);
      haptic.success();
      toast.success(`Borrador: ${etiquetaClase(nueva)} · S${nueva.numero}`, { description: `${fechaCorta(fecha)} ${horaBonita(nueva.horaInicio)}` });
      setHueco(null);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  async function moverA(s: SesionOra, fecha: string, franja: Franja) {
    const clase = { curso: s.curso, letra: s.letra };
    const hora = horaDeClase(e.ctx.idx, e.datos.periodos, clase, fecha, franja);
    if (!hora) {
      haptic.warning();
      toast.error(`${etiquetaClase(clase)} no tiene clase a esa hora`);
      return;
    }
    setTrabajando(true);
    try {
      const nueva = await api.accion(s.id, { accion: 'mover', fecha, horaInicio: hora.horaInicio, horaFin: hora.horaFin, profes: hora.profes });
      e.guardarSesiones([nueva]);
      e.mover(null);
      haptic.success();
      toast.success(`${etiquetaClase(nueva)} → ${fechaCorta(fecha)} ${horaBonita(nueva.horaInicio)}`, {
        description: nueva.calendarioError ? nueva.calendarioError : nueva.avisoEstado === 'pendiente' ? 'Toca avisar del cambio' : undefined,
      });
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  async function autocompletarRango() {
    const propuestas = autocompletar(ctx, tipo, clases, rango, disp, { email: e.responsable, profeId: profeResp }, forzada);
    if (propuestas.length === 0) {
      toast.info(disp.length === 0 ? 'Primero marca tus huecos en «Mis huecos»' : 'Nada que proponer: está cubierto o no hay huecos libres');
      return;
    }
    setTrabajando(true);
    try {
      const nuevas = await api.crear(propuestas.map((p) => ({ ...p, responsableEmail: e.responsable })));
      e.guardarSesiones(nuevas);
      haptic.success();
      toast.success(`${nuevas.length} borradores`, {
        action: {
          label: 'Deshacer',
          onClick: () => void e.lote('descartar', nuevas.map((n) => n.id)),
        },
      });
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  function tocarCelda(fecha: string, franja: Franja) {
    if (!esDiaLectivo(fecha, e.ajustes.trimestres, e.datos.festivos)) return;
    haptic.tap();
    if (moviendo) void moverA(moviendo, fecha, franja);
    else setHueco({ fecha, franja });
  }

  const rapidos = rangosRapidos(e.datos.hoy, e.ajustes.trimestres);

  return (
    <div className="space-y-3">
      {/* Tipo · responsable · rango */}
      <div className="flex flex-wrap items-center gap-2">
        <SelectorTipo e={e} />
        <SelectorResponsable e={e} />
        {abanico.length > 0 && (
          <Selector
            value={forzada?.id ?? ''}
            onChange={(ev) => setForzadaEn(ev.target.value ? { tipoId: tipo.id, id: ev.target.value } : null)}
            aria-label="Qué sesión se hace en los momentos que crees"
            title="Qué sesión se hace en los momentos que crees: la automática elige la que toca para cada clase"
            className="w-auto max-w-full"
          >
            <option value="">Sesión: automática{propuestaAuto ? ` · ${propuestaAuto.nombre}` : ''}</option>
            {abanico.map((c) => (
              <option key={c.id} value={c.id}>
                Sesión: {c.nombre}
              </option>
            ))}
          </Selector>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Filtros etiqueta="Fechas">
          {rapidos.map((r) => (
            <Filtro key={r.clave} activo={claveRango === r.clave} onClick={() => elegirRango(r.clave, r.rango)}>
              {r.etiqueta}
            </Filtro>
          ))}
        </Filtros>
        <span className="inline-flex items-center gap-1 text-sm">
          <Input
            type="date"
            aria-label="Desde"
            value={rango.inicio}
            onChange={(ev) => ev.target.value && elegirRango('libre', { inicio: ev.target.value, fin: ev.target.value > rango.fin ? ev.target.value : rango.fin })}
            className="w-auto"
          />
          →
          <Input
            type="date"
            aria-label="Hasta"
            value={rango.fin}
            onChange={(ev) => ev.target.value && elegirRango('libre', { inicio: ev.target.value < rango.inicio ? ev.target.value : rango.inicio, fin: ev.target.value })}
            className="w-auto"
          />
        </span>
      </div>

      {/* El objetivo del rango, clase a clase */}
      <BarraObjetivo progreso={progreso} unidades={unidades.length} sinHorario={new Set(sinHorario.map(claveClase))} />

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={autocompletarRango} disabled={trabajando || e.ocupado} title="Reparte el rango en tus huecos de nivel óptimo y luego en los alternativos">
          <Sparkles /> Autocompletar
        </Button>
        <Button
          disabled={borradores.length === 0 || e.ocupado}
          title="Crea los eventos en Google Calendar e invita a los profes"
          onClick={async () => {
            const si = await confirmar({
              titulo: `¿Confirmar ${borradores.length} ${borradores.length === 1 ? 'sesión' : 'sesiones'}?`,
              descripcion: 'Se crean los eventos en Google Calendar y se invita a los profes.',
              boton: `Confirmar ${borradores.length}`,
              peligro: false,
            });
            if (si) void e.lote('confirmar', borradores.map((b) => b.id));
          }}
        >
          <CheckCheck /> Confirmar {borradores.length > 0 && <span className="tabular-nums">({borradores.length})</span>}
        </Button>
        {borradores.length > 0 && (
          <Button
            variant="destructive"
            disabled={e.ocupado}
            onClick={async () => {
              const si = await confirmar({
                titulo: `¿Descartar ${borradores.length} ${borradores.length === 1 ? 'borrador' : 'borradores'}?`,
                descripcion: 'Se quitan los borradores de este rango que aún no se han confirmado.',
                boton: `Descartar ${borradores.length}`,
              });
              if (si) void e.lote('descartar', borradores.map((b) => b.id));
            }}
          >
            <Trash2 /> Descartar {borradores.length}
          </Button>
        )}
        <Button variant="outline" onClick={() => setManual({ fecha: e.datos.hoy, franja: null })} title="Una clase sin horario o una hora rara">
          <Plus /> A mano
        </Button>
      </div>

      {disp.length === 0 && <Aviso tono="aviso">Sin huecos marcados: márcalos en «Mis huecos» y el asistente te los enseña aquí.</Aviso>}

      {/* Mover / por recolocar */}
      {moviendo ? (
        <Aviso
          tono="info"
          icono={<ArrowRightLeft />}
          accion={
            <Button variant="ghost" size="sm" onClick={() => e.mover(null)}>
              <X /> Dejar de mover
            </Button>
          }
        >
          <b>{etiquetaClase(moviendo)}</b> · S{moviendo.numero}: toca su hueco nuevo
        </Aviso>
      ) : (
        porRecolocar.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 dark:text-amber-300">
              <CalendarClock className="h-4 w-4" aria-hidden /> Por recolocar
            </span>
            {porRecolocar.map((s) => (
              <Button key={s.id} variant="outline" size="sm" onClick={() => e.mover(s.id)}>
                {etiquetaClase(s)} · S{s.numero}
              </Button>
            ))}
          </div>
        )
      )}

      {/* La semana */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setSemana(sumarDias(semana, -7))} aria-label="Semana anterior">
          <ChevronLeft />
        </Button>
        <span className="min-w-32 text-center text-sm font-semibold tabular-nums">
          {fechaCorta(dias[0])} – {fechaCorta(dias[4])}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => setSemana(sumarDias(semana, 7))} aria-label="Semana siguiente">
          <ChevronRight />
        </Button>
        {semana !== lunesDe(e.datos.hoy) && (
          <Button variant="ghost" size="sm" onClick={() => setSemana(lunesDe(e.datos.hoy))}>
            Hoy
          </Button>
        )}
        <span className="ml-auto hidden flex-wrap gap-3 text-xs text-zinc-600 sm:flex dark:text-zinc-400">
          {(Object.keys(NIVEL_INFO) as Nivel[]).map((n) => (
            <span key={n} className="inline-flex items-center gap-1">
              <span className={cn('inline-flex h-4 w-4 items-center justify-center rounded border', FONDO_NIVEL[n])}>
                <IconoNivel nivel={n} className="h-3 w-3" />
              </span>
              {NIVEL_INFO[n].label}
            </span>
          ))}
        </span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="grid min-w-[680px] gap-1" style={{ gridTemplateColumns: '3.5rem repeat(5, minmax(0, 1fr))' }}>
          <div />
          {dias.map((d) => {
            const festivo = esFestivo(d, e.datos.festivos);
            const lectivo = esDiaLectivo(d, e.ajustes.trimestres, e.datos.festivos);
            return (
              <div key={d} className={cn('rounded-lg px-2 py-1 text-center text-xs font-semibold', d === e.datos.hoy ? 'bg-blue-600 text-white' : 'text-zinc-600 dark:text-zinc-300', !lectivo && 'opacity-50')}>
                <span className={cn(festivo && 'line-through')}>
                  {diaCorto(diaSemana(d))} {fechaCorta(d)}
                </span>
                {festivo && <span className="block text-xs font-normal">festivo</span>}
              </div>
            );
          })}
          {franjas.map((f) => (
            <FilaFranja key={`${f.horaInicio}-${f.horaFin}`} e={e} ctx={ctx} franja={f} dias={dias} disp={disp} profeResp={profeResp} clases={clases} tipoId={tipo.id} moviendo={moviendo} onTocar={tocarCelda} />
          ))}
        </div>
        {franjas.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No hay horario importado para las etapas de este tipo. Usa «A mano».</p>}
      </div>

      {hueco && (
        <DialogoHueco
          e={e}
          fecha={hueco.fecha}
          franja={hueco.franja}
          nivel={nivelEn(disp, diaSemana(hueco.fecha), hueco.franja)}
          candidatos={candidatosHueco(ctx, tipo, clasesDeHueco(clases, huecoEn(disp, diaSemana(hueco.fecha), hueco.franja)), hueco.fecha, hueco.franja)}
          sinHorario={clasesDeHueco(sinHorario, huecoEn(disp, diaSemana(hueco.fecha), hueco.franja)).filter((c) => necesidadEnFecha(ctx, tipo, c, hueco.fecha) > 0)}
          sesionDe={(c) => (abanico.length > 0 ? { sesion: sesionPara(c.clase, hueco.fecha) } : null)}
          trabajando={trabajando}
          onElegir={(c) => void crear(c, hueco.fecha)}
          onManual={(clave) => {
            setManual({ fecha: hueco.fecha, franja: hueco.franja, clave });
            setHueco(null);
          }}
          onClose={() => setHueco(null)}
        />
      )}
      {manual && <DialogoManual e={e} tipoId={tipo.id} fecha={manual.fecha} franja={manual.franja} claveInicial={manual.clave} forzadaId={forzada?.id ?? null} onClose={() => setManual(null)} />}
      {dialogo}
    </div>
  );
}

// ─── El objetivo ─────────────────────────────────────────────────────────────

function BarraObjetivo({ progreso, unidades, sinHorario }: { progreso: ReturnType<typeof progresoTipo>; unidades: number; sinHorario: Set<string> }) {
  if (progreso.length === 0 || unidades === 0) return null;
  const pendientes = progreso.reduce((n, f) => n + f.total.porHacer, 0);
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-1.5">
        <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 text-sm font-semibold', pendientes ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300')} title="Por hacer en el rango">
          <Target className="mr-1 h-3.5 w-3.5" aria-hidden /> {pendientes ? `${pendientes} por hacer` : <><Check className="mr-1 h-3.5 w-3.5" aria-hidden /> Todo hecho</>}
        </span>
        {progreso.map((f) => (
          <span key={f.clave} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" title={`${f.total.hechas} hechas · ${f.total.programadas} confirmadas · ${f.total.borradores} borradores · ${f.total.porHacer} por hacer${sinHorario.has(f.clave) ? ' · sin horario importado: se apunta a mano' : ''}`}>
            <span className="font-semibold">{nombreClase(f.clase.curso, f.clase.letra)}</span>
            {sinHorario.has(f.clave) && <CalendarOff className="h-3 w-3 text-zinc-500" aria-label="Sin horario importado: se apunta a mano" />}
            <Puntos t={f.total} />
            <span className="text-zinc-600 tabular-nums dark:text-zinc-400">{f.total.porHacer > 0 ? `faltan ${f.total.porHacer}` : 'hecho'}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** El color de cada punto: verde lleno, hecha; verde claro, confirmada; gris, borrador; hueco, por hacer. */
export const PUNTO = {
  hechas: 'bg-emerald-600 dark:bg-emerald-400',
  programadas: 'bg-emerald-300 dark:bg-emerald-700',
  borradores: 'bg-zinc-400 dark:bg-zinc-500',
  porHacer: 'ring-1 ring-inset ring-zinc-400 dark:ring-zinc-500',
} as const;

export function Puntos({ t }: { t: { hechas: number; programadas: number; borradores: number; porHacer: number } }) {
  const puntos = [
    ...Array(t.hechas).fill(PUNTO.hechas),
    ...Array(t.programadas).fill(PUNTO.programadas),
    ...Array(t.borradores).fill(PUNTO.borradores),
    ...Array(t.porHacer).fill(PUNTO.porHacer),
  ];
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="sr-only">
        {t.hechas} hechas, {t.programadas} confirmadas, {t.borradores} borradores y {t.porHacer} por hacer
      </span>
      {puntos.slice(0, 12).map((c, i) => (
        <span key={i} aria-hidden className={cn('h-2 w-2 rounded-full', c)} />
      ))}
      {puntos.length > 12 && <span aria-hidden className="text-xs text-zinc-500">+{puntos.length - 12}</span>}
    </span>
  );
}

// ─── Una fila de la semana ────────────────────────────────────────────────────

function FilaFranja({
  e,
  ctx,
  franja,
  dias,
  disp,
  profeResp,
  clases,
  tipoId,
  moviendo,
  onTocar,
}: {
  e: Estado;
  ctx: Estado['ctx'];
  franja: Franja;
  dias: string[];
  disp: Disponibilidad[];
  profeResp: string | null;
  clases: Clase[];
  tipoId: string;
  moviendo: SesionOra | null;
  onTocar: (fecha: string, franja: Franja) => void;
}) {
  const tipo = e.tipos.find((t) => t.id === tipoId)!;
  return (
    <>
      <div className="flex flex-col items-end justify-center pr-1 text-xs leading-tight text-zinc-500 tabular-nums">
        <span>{horaBonita(franja.horaInicio)}</span>
        <span>{horaBonita(franja.horaFin)}</span>
      </div>
      {dias.map((fecha) => {
        const dia = diaSemana(fecha);
        const lectivo = esDiaLectivo(fecha, e.ajustes.trimestres, e.datos.festivos);
        const nivel = nivelEn(disp, dia, franja);
        const propias = ocupacionPropia(e.datos.horario, profeResp, e.datos.periodos, fecha, franja);
        const aqui = e.sesiones.filter(
          (s) => (estaActiva(s) || s.id === moviendo?.id) && s.fecha === fecha && aMin(s.horaInicio) < aMin(franja.horaFin) && aMin(franja.horaInicio) < aMin(s.horaFin),
        );
        const mias = aqui.filter((s) => s.responsableEmail === e.responsable);

        let destino: { avisos: ReturnType<typeof avisosCandidato> } | null = null;
        if (moviendo && lectivo) {
          const hora = horaDeClase(e.ctx.idx, e.datos.periodos, { curso: moviendo.curso, letra: moviendo.letra }, fecha, franja);
          const tipoMov = e.tipos.find((t) => t.id === moviendo.tipoId) ?? tipo;
          if (hora) destino = { avisos: avisosCandidato(ctx, { tipo: tipoMov, clase: moviendo, fecha, horaInicio: hora.horaInicio, profes: hora.profes, excluirId: moviendo.id }) };
        }

        let sugerencia: Candidato | null = null;
        if (!moviendo && lectivo && nivel && mias.length === 0 && fecha >= e.datos.hoy) {
          sugerencia = candidatosHueco(ctx, tipo, clasesDeHueco(clases, huecoEn(disp, dia, franja)), fecha, franja).find((c) => c.necesita > 0) ?? null;
        }

        return (
          <div
            key={fecha}
            role="button"
            tabIndex={lectivo ? 0 : -1}
            onClick={() => onTocar(fecha, franja)}
            onKeyDown={(ev) => ev.key === 'Enter' && onTocar(fecha, franja)}
            className={cn(
              'relative flex min-h-16 flex-col gap-1 rounded-lg border p-1 text-left text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              nivel && lectivo && 'pr-4',
              !lectivo
                ? 'cursor-default border-transparent bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.04)_6px,rgba(0,0,0,0.04)_12px)] opacity-60'
                : nivel
                  ? cn(FONDO_NIVEL[nivel], 'cursor-pointer hover:brightness-95')
                  : 'cursor-pointer border-zinc-100 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800',
              destino && 'ring-2 ring-blue-400',
              moviendo && !destino && lectivo && 'opacity-40',
            )}
          >
            {nivel && lectivo && (
              <span className="absolute top-1 right-1 text-zinc-600 dark:text-zinc-300">
                <IconoNivel nivel={nivel} className="h-3 w-3" />
                <span className="sr-only">Hueco {NIVEL_INFO[nivel].label.toLowerCase()}</span>
              </span>
            )}
            {aqui.map((s) => {
              const t = e.tipos.find((x) => x.id === s.tipoId);
              const chip = chipEstado(s, e.datos.hoy);
              const ajena = s.responsableEmail !== e.responsable;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    e.abrir(s.id);
                  }}
                  title={`${t?.nombre ?? ''} · ${s.profes.map((p) => p.nombre).join(', ')}${ajena ? ` · lo lleva ${s.responsableNombre ?? s.responsableEmail}` : ''}${s.catalogoId ? ` · ${e.catalogo.find((c) => c.id === s.catalogoId)?.nombre ?? ''}` : ''}`}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-x-1 rounded-md border px-1 py-0.5 text-left font-medium',
                    s.estado === 'borrador'
                      ? 'border-dashed border-zinc-400 bg-white/80 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-200'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
                    ajena && 'opacity-60',
                    s.id === moviendo?.id && 'ring-2 ring-blue-500',
                  )}
                >
                  <span aria-hidden>{t?.emoji}</span>
                  <span className="truncate">{nombreClase(s.curso, s.letra)}</span>
                  <span className="ml-auto opacity-80">S{s.numero}</span>
                  <span className="w-full font-normal opacity-80">{chip.texto}</span>
                </button>
              );
            })}
            {destino && <AvisosCandidato avisos={destino.avisos} />}
            {sugerencia && (
              <span className="flex flex-wrap items-center gap-1 text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> {nombreClase(sugerencia.clase.curso, sugerencia.clase.letra)}
                </span>
                <AvisosCandidato avisos={sugerencia.avisos.filter((a) => a.nivel !== 'info')} />
              </span>
            )}
            {propias.length > 0 && (
              <span className="mt-auto flex items-center gap-0.5 truncate text-xs text-zinc-500" title="Tu horario">
                <BookOpen className="h-3 w-3 shrink-0" aria-label="Tu horario" /> {[...new Set(propias.map((p) => (p.curso ? nombreClase(p.curso, p.letra) : p.materia)))].join(', ')}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── El hueco: quién cabe ─────────────────────────────────────────────────────

function DialogoHueco({
  e,
  fecha,
  franja,
  nivel,
  candidatos,
  sinHorario,
  sesionDe,
  trabajando,
  onElegir,
  onManual,
  onClose,
}: {
  e: Estado;
  fecha: string;
  franja: Franja;
  nivel: Nivel | null;
  candidatos: Candidato[];
  /** Clases del tipo que no están en ningún horario importado y aún necesitan sesión. */
  sinHorario: Clase[];
  /** La sesión del abanico que llevaría cada clase (null = el tipo no tiene abanico). */
  sesionDe: (c: Candidato) => { sesion: SesionCatalogo | null } | null;
  trabajando: boolean;
  onElegir: (c: Candidato) => void;
  onManual: (clave?: string) => void;
  onClose: () => void;
}) {
  const aqui = e.sesiones.filter((s) => estaActiva(s) && s.fecha === fecha && aMin(s.horaInicio) < aMin(franja.horaFin) && aMin(franja.horaInicio) < aMin(s.horaFin));
  const profeResp = e.datos.profes.find((p) => p.email === e.responsable)?.id ?? null;
  const propias = ocupacionPropia(e.datos.horario, profeResp, e.datos.periodos, fecha, franja);
  const [verTodas, setVerTodas] = useState(false);
  const utiles = candidatos.filter((c) => c.necesita > 0);
  const visibles = verTodas || utiles.length === 0 ? candidatos : utiles;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="flex flex-wrap items-center gap-x-2 pr-10">
          <span>{capital(fechaLarga(fecha))}</span>
          <span className="text-zinc-500 tabular-nums">
            {horaBonita(franja.horaInicio)}–{horaBonita(franja.horaFin)}
          </span>
        </DialogTitle>
        {nivel && (
          <p className="-mt-2 inline-flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            <IconoNivel nivel={nivel} /> Hueco {NIVEL_INFO[nivel].label.toLowerCase()}
          </p>
        )}

        {propias.length > 0 && (
          <p className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            A esta hora das clase: {[...new Set(propias.map((p) => (p.curso ? nombreClase(p.curso, p.letra) : p.materia)))].join(', ')}
          </p>
        )}
        {aqui.length > 0 && (
          <div className="space-y-1">
            {aqui.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onClose();
                  e.abrir(s.id);
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded-lg bg-zinc-100 px-2 py-1.5 text-left text-sm dark:bg-zinc-800"
              >
                <span aria-hidden>{e.tipos.find((t) => t.id === s.tipoId)?.emoji}</span>
                <b>{etiquetaClase(s)}</b> S{s.numero}
                <EstadoChip chip={chipEstado(s, e.datos.hoy)} className="ml-auto" />
              </button>
            ))}
          </div>
        )}

        <ul className="space-y-1.5">
          {visibles.map((c, i) => (
            <li key={c.clave}>
              <button
                type="button"
                disabled={trabajando}
                onClick={() => onElegir(c)}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50',
                  i === 0 && c.necesita > 0 && !c.avisos.some((a) => a.nivel === 'rojo')
                    ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800',
                  c.necesita === 0 && 'opacity-60',
                )}
              >
                <span className="flex items-center gap-2">
                  <b className="text-base">{etiquetaClase(c.clase)}</b>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {horaBonita(c.hora.horaInicio)}–{horaBonita(c.hora.horaFin)}
                  </span>
                  <AvisosCandidato avisos={c.avisos} className="ml-auto justify-end" />
                </span>
                {(() => {
                  const delAbanico = sesionDe(c);
                  if (!delAbanico) return null;
                  return delAbanico.sesion ? (
                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                      <BookOpenText className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{delAbanico.sesion.nombre}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                      <BookOpenText className="h-3.5 w-3.5 shrink-0" aria-hidden /> Sin sesión libre para esta clase
                    </span>
                  );
                })()}
                <span className="flex flex-col text-sm text-zinc-600 dark:text-zinc-300">
                  {c.hora.profes.length
                    ? c.hora.profes.map((p) => (
                        <span key={p.id}>
                          {p.materia ?? '—'} · <b className="font-medium text-zinc-800 dark:text-zinc-100">{p.nombre}</b>
                        </span>
                      ))
                    : c.hora.materias.join(', ') || '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {candidatos.length === 0 && <p className="text-sm text-zinc-500">Ninguna clase de este tipo tiene clase a esa hora.</p>}
        {sinHorario.length > 0 && (
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <CalendarOff className="h-3.5 w-3.5" aria-hidden /> Sin horario importado: se apuntan a mano
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sinHorario.map((c) => (
                <Button key={claveClase(c)} variant="outline" size="sm" onClick={() => onManual(claveClase(c))} disabled={trabajando}>
                  {nombreClase(c.curso, c.letra)}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {utiles.length > 0 && utiles.length < candidatos.length && (
            <Button variant="outline" size="sm" onClick={() => setVerTodas(!verTodas)}>
              {verTodas ? 'Solo las que faltan' : `+ ${candidatos.length - utiles.length} ya cubiertas`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onManual()}>
            <Plus /> A mano
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── A mano ──────────────────────────────────────────────────────────────────

function DialogoManual({
  e,
  tipoId,
  fecha: fechaInicial,
  franja,
  claveInicial,
  forzadaId,
  onClose,
}: {
  e: Estado;
  tipoId: string;
  fecha: string;
  franja: Franja | null;
  claveInicial?: string;
  forzadaId: string | null;
  onClose: () => void;
}) {
  const [clave, setClave] = useState(claveInicial ?? (e.datos.clases[0] ? claveClase(e.datos.clases[0]) : ''));
  const [fecha, setFecha] = useState(fechaInicial);
  const [inicio, setInicio] = useState(franja?.horaInicio ?? '09:00');
  const [fin, setFin] = useState(franja?.horaFin ?? '10:00');
  // null = los que diga el horario para esa clase y hora; en cuanto se toca, manda lo elegido.
  const [elegidos, setElegidos] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Si el horario sabe quién tiene esa clase a esa hora, se propone solo.
  const clase = clave ? claseDeClave(clave) : null;
  const delHorario = clase ? horaDeClase(e.ctx.idx, e.datos.periodos, clase, fecha, { horaInicio: inicio, horaFin: fin }) : null;
  const profeIds = elegidos ?? delHorario?.profes.map((p) => p.id) ?? [];

  // La sesión del abanico: la forzada o la que toca por defecto, hasta que se toque el selector.
  const tipo = e.tipos.find((t) => t.id === tipoId);
  const abanico = e.catalogo.filter((c) => c.tipoId === tipoId && c.activo);
  const [catalogoElegido, setCatalogoElegido] = useState<string | null>(null);
  const porDefecto = forzadaId ?? (clase && tipo ? (sesionPorDefecto(opcionesSesion(e.ctx, tipo, clase, fecha))?.id ?? null) : null);
  const catalogoId = catalogoElegido ?? porDefecto ?? '';

  async function guardar() {
    if (!clase || aMin(fin) <= aMin(inicio)) {
      toast.error('Revisa la clase y las horas');
      return;
    }
    setGuardando(true);
    try {
      const profes: ProfeAfectado[] = profeIds.map((id) => {
        const h = delHorario?.profes.find((p) => p.id === id);
        return { id, nombre: h?.nombre ?? e.datos.profes.find((p) => p.id === id)?.nombre ?? '', materia: h?.materia ?? null };
      });
      const [nueva] = await api.crear([{ tipoId, curso: clase.curso, letra: clase.letra, fecha, horaInicio: inicio, horaFin: fin, profes, responsableEmail: e.responsable, catalogoId: catalogoId || null }]);
      e.guardarSesiones([nueva]);
      haptic.success();
      toast.success(`Borrador: ${etiquetaClase(nueva)} · S${nueva.numero}`);
      onClose();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Sesión a mano</DialogTitle>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Clase" id="ora-manual-clase" className="col-span-2">
            <Selector id="ora-manual-clase" value={clave} onChange={(ev) => setClave(ev.target.value)}>
              {e.datos.clases.map((c) => (
                <option key={claveClase(c)} value={claveClase(c)}>
                  {nombreClase(c.curso, c.letra)}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Día" id="ora-manual-dia" className="col-span-2">
            <Input id="ora-manual-dia" type="date" value={fecha} onChange={(ev) => setFecha(ev.target.value)} />
          </Campo>
          <Campo etiqueta="De" id="ora-manual-de">
            <Input id="ora-manual-de" type="time" value={inicio} onChange={(ev) => setInicio(ev.target.value)} />
          </Campo>
          <Campo etiqueta="a" id="ora-manual-a">
            <Input id="ora-manual-a" type="time" value={fin} onChange={(ev) => setFin(ev.target.value)} />
          </Campo>
          {abanico.length > 0 && (
            <Campo etiqueta="Sesión" id="ora-manual-sesion" className="col-span-2">
              <Selector id="ora-manual-sesion" value={catalogoId} onChange={(ev) => setCatalogoElegido(ev.target.value)}>
                <option value="">— sin elegir —</option>
                {abanico.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}
          <Campo
            etiqueta={
              <>
                Profe que pierde la hora {delHorario && <span className="font-normal text-emerald-700 dark:text-emerald-400">· del horario</span>}
              </>
            }
            id="ora-manual-profes"
            className="col-span-2"
          >
            <select
              id="ora-manual-profes"
              multiple
              value={profeIds}
              onChange={(ev) => setElegidos([...ev.target.selectedOptions].map((o) => o.value))}
              className={cn(claseCampo, 'h-32 py-2')}
            >
              {e.datos.profes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} cargando={guardando}>
            Guardar borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
