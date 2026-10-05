'use client';

// ⏰ Mis huecos: la semana tipo de quien lo lleva, con su horario pintado debajo. Cada toque
// cicla ⭐ → 👍 → 🤏 → nada y se guarda solo. «⚡ Desde mi horario» marca como ⭐ las horas
// que el horario ya tiene como Oratorio. Va con `key` = la persona: cambiar de responsable
// monta una rejilla nueva con la suya.
import { Eraser, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ETAPAS_VISIBLES, etapaDeCurso, nombreClase } from '@/lib/cursos';
import { aMin, diaCorto, ETAPA_LABELS, franjasDeEtapas, horaBonita, NIVEL_INFO, nivelEn, periodoDeFecha, siguienteNivel, type Disponibilidad, type Nivel } from '@/lib/oratorios';
import { Accion, api, Pastilla } from './comun';
import { SelectorResponsable } from './planificar';
import type { Estado } from './panel';

const FONDO: Record<Nivel, string> = {
  optima: 'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-100',
  alternativa: 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-100',
  ultima: 'bg-zinc-200 border-zinc-400 border-dashed text-zinc-700 dark:bg-zinc-700/60 dark:border-zinc-500 dark:text-zinc-200',
};

export function EditorDisponibilidad({ e }: { e: Estado }) {
  const email = e.responsable;
  const profeId = e.datos.profes.find((p) => p.email === email)?.id ?? null;
  const periodo = periodoDeFecha(e.datos.periodos, e.datos.hoy);

  // Lo que tiene esa persona en su horario, por día y hora.
  const mio = useMemo(
    () => (profeId && periodo ? e.datos.horario.filter((h) => h.periodoId === periodo.id && h.profes.some((p) => p.id === profeId)) : []),
    [e.datos.horario, profeId, periodo],
  );
  // La rejilla por defecto: la de las etapas donde da clase, o la del primer tipo activo.
  const etapasMias = [...new Set(mio.map((h) => etapaDeCurso(h.curso)).filter((x): x is NonNullable<typeof x> => x !== null))];
  const [etapas, setEtapas] = useState<string[]>(() => (etapasMias.length ? etapasMias : (e.tipos.find((t) => t.activo)?.etapas ?? ['ESO'])));
  const [huecos, setHuecos] = useState<Disponibilidad[]>(e.disponibilidad[email] ?? []);
  const [estado, setEstado] = useState<'ok' | 'guardando' | 'sucio'>('ok');
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const franjas = useMemo(() => {
    const base = franjasDeEtapas(e.datos.tramos, etapas);
    const mapa = new Map(base.map((f) => [`${f.horaInicio}-${f.horaFin}`, f]));
    for (const h of huecos) if (!base.some((f) => f.horaInicio === h.horaInicio)) mapa.set(`${h.horaInicio}-${h.horaFin}`, { horaInicio: h.horaInicio, horaFin: h.horaFin });
    return [...mapa.values()].sort((a, b) => aMin(a.horaInicio) - aMin(b.horaInicio));
  }, [e.datos.tramos, etapas, huecos]);

  function guardar(nuevos: Disponibilidad[]) {
    setHuecos(nuevos);
    setEstado('sucio');
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(async () => {
      setEstado('guardando');
      try {
        const guardados = await api.disponibilidad(email, nuevos);
        e.setDisponibilidad(email, guardados);
        setEstado('ok');
      } catch (err) {
        setEstado('sucio');
        haptic.warning();
        toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
      }
    }, 700);
  }

  function tocar(dia: number, f: { horaInicio: string; horaFin: string }) {
    haptic.tap();
    const actual = nivelEn(huecos, dia, f);
    const sin = huecos.filter((h) => !(h.dia === dia && h.horaInicio === f.horaInicio));
    const siguiente = siguienteNivel(actual);
    guardar(siguiente ? [...sin, { dia, horaInicio: f.horaInicio, horaFin: f.horaFin, nivel: siguiente }] : sin);
  }

  function desdeMiHorario() {
    const oratorio = mio.filter((h) => h.actividad === 'oratorio');
    if (oratorio.length === 0) {
      toast.info('Tu horario no tiene horas marcadas como Oratorio');
      return;
    }
    const nuevos = [...huecos];
    for (const h of oratorio) {
      const i = nuevos.findIndex((x) => x.dia === h.dia && x.horaInicio === h.horaInicio);
      const hueco = { dia: h.dia, horaInicio: h.horaInicio, horaFin: h.horaFin, nivel: 'optima' as const };
      if (i >= 0) nuevos[i] = hueco;
      else nuevos.push(hueco);
    }
    guardar(nuevos);
    toast.success(`${oratorio.length} horas de Oratorio marcadas como ⭐`);
  }

  // Si se sale con un cambio sin guardar (el guardado espera 0,7 s), el navegador pregunta.
  useEffect(() => {
    if (estado === 'ok') return;
    const aviso = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [estado]);

  const cuenta = (n: Nivel) => huecos.filter((h) => h.nivel === n).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectorResponsable e={e} />
        {ETAPAS_VISIBLES.map((et) => (
          <Pastilla key={et} activa={etapas.includes(et)} onClick={() => setEtapas(etapas.includes(et) ? etapas.filter((x) => x !== et) : [...etapas, et])}>
            {ETAPA_LABELS[et]}
          </Pastilla>
        ))}
        <span className="ml-auto text-xs text-zinc-500">{estado === 'ok' ? 'Guardado' : 'Guardando…'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Accion onClick={desdeMiHorario} disabled={!profeId} title="Marca ⭐ las horas de Oratorio de tu horario">
          <Zap className="h-4 w-4" /> Desde mi horario
        </Accion>
        {huecos.length > 0 && (
          <Accion tono="rojo" onClick={() => window.confirm('¿Vaciar todos los huecos?') && guardar([])} title="Vaciar">
            <Eraser className="h-4 w-4" />
          </Accion>
        )}
        <span className="flex gap-3 text-sm">
          {(Object.keys(NIVEL_INFO) as Nivel[]).map((n) => (
            <span key={n} title={NIVEL_INFO[n].label}>
              {NIVEL_INFO[n].emoji} <span className="tabular-nums">{cuenta(n)}</span>
            </span>
          ))}
        </span>
      </div>
      {!profeId && <p className="text-sm text-amber-700 dark:text-amber-300">{email} no está en la BBDD central de profes: no se puede pintar su horario.</p>}

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: '3.5rem repeat(5, minmax(0, 1fr))' }}>
          <div />
          {[1, 2, 3, 4, 5].map((d) => (
            <div key={d} className="py-1 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {diaCorto(d)}
            </div>
          ))}
          {franjas.map((f) => (
            <FilaHuecos key={`${f.horaInicio}-${f.horaFin}`} franja={f} huecos={huecos} mio={mio} onTocar={tocar} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilaHuecos({
  franja,
  huecos,
  mio,
  onTocar,
}: {
  franja: { horaInicio: string; horaFin: string };
  huecos: Disponibilidad[];
  mio: Estado['datos']['horario'];
  onTocar: (dia: number, f: { horaInicio: string; horaFin: string }) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-end justify-center pr-1 text-[11px] leading-tight text-zinc-500 tabular-nums">
        <span>{horaBonita(franja.horaInicio)}</span>
        <span className="text-zinc-400">{horaBonita(franja.horaFin)}</span>
      </div>
      {[1, 2, 3, 4, 5].map((dia) => {
        const nivel = nivelEn(huecos, dia, franja);
        const aqui = mio.filter((h) => h.dia === dia && aMin(h.horaInicio) < aMin(franja.horaFin) && aMin(franja.horaInicio) < aMin(h.horaFin));
        const esOratorio = aqui.some((h) => h.actividad === 'oratorio');
        const etiquetas = [...new Set(aqui.map((h) => (h.curso ? nombreClase(h.curso, h.letra) : h.materia)).filter(Boolean))].sort();
        const materia = aqui.find((h) => h.curso)?.materia;
        return (
          <button
            key={dia}
            type="button"
            onClick={() => onTocar(dia, franja)}
            className={cn(
              'flex min-h-14 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left text-[11px] transition-colors',
              nivel ? FONDO[nivel] : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800',
            )}
          >
            <span className="text-base leading-none">{nivel ? NIVEL_INFO[nivel].emoji : ''}</span>
            {etiquetas.length > 0 && (
              <span className={cn('w-full truncate', nivel ? 'opacity-80' : 'text-zinc-500')}>
                {esOratorio ? 'Oratorio · ' : ''}
                {etiquetas.join(', ')}
                {materia && <span className="block truncate opacity-70">{materia}</span>}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
