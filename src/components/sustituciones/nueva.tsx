'use client';

// «Nueva ausencia» (docs/32 §4.7): elijo profe, fechas y motivo → la app me dice qué clases quedan
// descubiertas y propone a quién mandar → reviso, confirmo y salen los correos. La propuesta NO se
// guarda: vive aquí, y se recalcula en la pantalla (`proponerSustitutos`, puro) cada vez que Jefatura
// cambia algo, para descontar a quien ya se ha elegido. Confirmar vuelve a comprobarlo todo en el servidor.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarX2, ChevronDown, Info, Send, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import {
  agruparCandidatos,
  claveSesion,
  cubreDentro,
  describirSesion,
  entradaDesdeContexto,
  fechaLarga,
  lugarDe,
  mayuscula,
  nombreNivel,
  proponerSustitutos,
  solapa,
  type Candidato,
  type PropuestaSesion,
  type SesionAusente,
} from '@/lib/sustituciones';
import type { RespuestaPropuesta } from '@/lib/sustituciones-server';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Campo } from '@/components/ui/campo';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Selector } from '@/components/ui/selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
import { horaRango, pedir, textoAvisos, type Avisos } from './comun';

const CFG = CONFIGURACION.sustituciones;
const SIN_CUBRIR = '__sin__';

export function NuevaAusencia({ profes, hoy, inicial }: { profes: { id: string; nombre: string }[]; hoy: string; inicial: { profeId?: string; fecha?: string } }) {
  const router = useRouter();
  const [profeId, setProfeId] = useState(inicial.profeId ?? '');
  const [desde, setDesde] = useState(inicial.fecha ?? hoy);
  const [hasta, setHasta] = useState(inicial.fecha ?? hoy);
  const [motivo, setMotivo] = useState('');
  const [avisarAusente, setAvisarAusente] = useState(true);
  const [nota, setNota] = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [avisar, setAvisar] = useState(desde >= hoy);
  const avisarTocado = useRef(false);
  const [datos, setDatos] = useState<RespuestaPropuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encendidas, setEncendidas] = useState<Set<string>>(new Set());
  const [fijados, setFijados] = useState<Record<string, string | null>>({});
  const [segundos, setSegundos] = useState<Record<string, string | null>>({});
  const [rangosPrincipales, setRangosPrincipales] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [rangosCobertura, setRangosCobertura] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const peticion = useRef(0);

  // Cada cambio de profe o de fechas pide la propuesta otra vez («hasta» nunca antes de «desde»).
  function cambiarProfe(v: string) {
    setProfeId(v);
    void cargar(v, desde, hasta);
  }

  function cambiarDesde(v: string) {
    const h = !hasta || hasta < v ? v : hasta;
    setDesde(v);
    setHasta(h);
    if (!avisarTocado.current) setAvisar(v >= hoy);
    void cargar(profeId, v, h);
  }

  function cambiarHasta(v: string) {
    setHasta(v);
    void cargar(profeId, desde, v);
  }

  async function cargar(profeId: string, desde: string, hasta: string) {
    if (!profeId || !desde || !hasta || hasta < desde) {
      peticion.current++;
      setDatos(null);
      setCargando(false);
      return;
    }
    const n = ++peticion.current;
    setCargando(true);
    setError(null);
    try {
      const r = await pedir<RespuestaPropuesta>('/api/sustituciones/admin/propuesta', { body: { profeId, desde, hasta } });
      if (n !== peticion.current) return;
      setDatos(r);
      const ya = (s: SesionAusente) => r.yaApuntadas.some((y) => y.fecha === s.fecha && solapa(y, s));
      setEncendidas(new Set(r.dias.flatMap((d) => d.sesiones.filter((s) => s.hayQueCubrir && !ya(s)).map(claveSesion))));
      setFijados({});
      setSegundos({});
      setRangosPrincipales({});
      setRangosCobertura({});
      setAbiertos(new Set(r.dias.slice(0, 1).map((d) => d.fecha)));
    } catch (e) {
      if (n === peticion.current) {
        setDatos(null);
        setError(e instanceof Error ? e.message : 'No se ha podido preparar la propuesta');
      }
    } finally {
      if (n === peticion.current) setCargando(false);
    }
  }

  useEffect(() => {
    if (inicial.profeId) void cargar(inicial.profeId, desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yaApuntada = (s: SesionAusente) => (datos?.yaApuntadas ?? []).some((y) => y.fecha === s.fecha && solapa(y, s));

  // La propuesta, recalculada en la pantalla con lo elegido a mano.
  const propuesta = useMemo(() => {
    if (!datos) return new Map<string, PropuestaSesion>();
    const aCubrir = datos.dias.flatMap((d) => d.sesiones.filter((s) => s.hayQueCubrir && encendidas.has(claveSesion(s))));
    return new Map(proponerSustitutos(entradaDesdeContexto(datos.contexto, aCubrir, datos.profe.id, fijados)).map((p) => [p.clave, p]));
  }, [datos, encendidas, fijados]);

  const elegidas = useMemo(() => (datos?.dias ?? []).flatMap((d) => d.sesiones.filter((s) => encendidas.has(claveSesion(s)))), [datos, encendidas]);
  // Si falta a horas en las que cubría a otra persona, esas se quedan sin cubrir al confirmar.
  const cubriaA = datos ? cubreDentro(datos.cubreYa, elegidas) : [];
  const sustitutos = new Set([...propuesta.values()].map((p) => p.elegido?.id).filter(Boolean));
  const personas = sustitutos.size + (elegidas.length > 0 ? 1 : 0);
  const sinCubrir = [...propuesta.values()].filter((p) => !p.elegido).length;
  const bloqueado = !datos || datos.excede || Boolean(datos.bajaCubiertaPor);
  const motivoInfo = CFG.motivos.find((m) => m.clave === motivo);
  const faltaNota = Boolean(motivoInfo?.pideNota) && !nota.trim();
  const puedeConfirmar = !bloqueado && elegidas.length > 0 && Boolean(motivo) && !faltaNota && !cargando;

  function alternar(s: SesionAusente, activo: boolean) {
    const k = claveSesion(s);
    setEncendidas((prev) => {
      const sig = new Set(prev);
      if (activo) sig.add(k);
      else sig.delete(k);
      return sig;
    });
  }

  function atajo(fecha: string, que: 'todo' | 'clases') {
    const dia = datos?.dias.find((d) => d.fecha === fecha);
    if (!dia) return;
    setEncendidas((prev) => {
      const sig = new Set(prev);
      for (const s of dia.sesiones) {
        const k = claveSesion(s);
        if (yaApuntada(s)) continue;
        if (que === 'todo' || s.hayQueCubrir) sig.add(k);
        else sig.delete(k);
      }
      return sig;
    });
  }

  async function confirmar() {
    if (!datos) return;
    if (!motivo) {
      toast.error('Elige el motivo');
      return;
    }
    setGuardando(true);
    try {
      const sesiones = elegidas.map((s) => ({
        fecha: s.fecha,
        horSesionId: s.sesionId,
        sustitutoId: s.hayQueCubrir ? (propuesta.get(claveSesion(s))?.elegido?.id ?? null) : null,
        sustituto2Id: s.hayQueCubrir ? (segundos[claveSesion(s)] ?? null) : null,
        ...(s.hayQueCubrir ? {
          sustitutoHoraInicio: rangosPrincipales[claveSesion(s)]?.inicio ?? s.horaInicio,
          sustitutoHoraFin: rangosPrincipales[claveSesion(s)]?.fin ?? s.horaFin,
        } : {}),
        ...(s.hayQueCubrir && segundos[claveSesion(s)] ? {
          sustituto2HoraInicio: rangosCobertura[claveSesion(s)]?.inicio ?? s.horaInicio,
          sustituto2HoraFin: rangosCobertura[claveSesion(s)]?.fin ?? s.horaFin,
        } : {}),
      }));
      const r = await pedir<{ id: string; avisos: Avisos | null; liberadas: unknown[] }>('/api/sustituciones/admin/ausencias', {
        body: { profeId: datos.profe.id, desde: datos.desde, hasta: datos.hasta, motivo, nota: nota || null, indicaciones: indicaciones || null, avisar, avisarAusente, sesiones },
      });
      haptic.success();
      const avisos = textoAvisos(r.avisos);
      if (r.avisos?.fallidos.length) toast.warning(`Ausencia guardada. ${avisos}. Puedes reenviarlo desde la ficha.`);
      else toast.success(avisos ? `Ausencia guardada. ${avisos}.` : 'Ausencia guardada');
      if (r.liberadas.length > 0) toast.warning(`${r.liberadas.length === 1 ? 'Una hora que cubría se ha quedado' : `${r.liberadas.length} horas que cubría se han quedado`} sin cubrir: búscalas en «Hoy».`);
      router.push(`/gestion/sustituciones/${r.id}`);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
      // Si alguien se ha ocupado mientras tanto, la propuesta vuelve a estar al día.
      void cargar(profeId, desde, hasta);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <EnlaceVolver href="/gestion/sustituciones">Hoy</EnlaceVolver>
        <TituloPagina>Nueva ausencia</TituloPagina>
      </div>

      <Tarjeta>
        <TarjetaCabecera titulo="Quién y cuándo" />
        <TarjetaCuerpo className="space-y-4">
          <Campo etiqueta="Profe que falta" id="profe">
            <Selector id="profe" value={profeId} onChange={(e) => cambiarProfe(e.target.value)}>
              <option value="">Elige…</option>
              {profes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde" id="desde">
              <Input id="desde" type="date" value={desde} onChange={(e) => cambiarDesde(e.target.value)} />
            </Campo>
            <Campo etiqueta="Hasta" id="hasta" ayuda={desde === hasta ? 'Un solo día' : undefined}>
              <Input id="hasta" type="date" value={hasta} min={desde} onChange={(e) => cambiarHasta(e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Motivo" id="motivo" ayuda="Solo lo ve quien tiene este módulo: no sale en los correos.">
            <Selector id="motivo" value={motivo} onChange={(e) => { setMotivo(e.target.value); if (e.target.value === 'baja') setAvisarAusente(false); }}>
              <option value="">Elige…</option>
              {CFG.motivos.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          {motivoInfo?.pideNota && (
            <Campo etiqueta="Nota" id="nota" error={faltaNota ? 'Escribe una nota corta' : undefined}>
              <Input id="nota" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} aria-invalid={faltaNota} />
            </Campo>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      {error && <Aviso tono="error">{error}</Aviso>}

      {profeId && cargando && !datos && (
        <Tarjeta className="space-y-3 p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </Tarjeta>
      )}

      {datos && (
        <div className={cn('space-y-5 transition-opacity', cargando && 'opacity-60')} aria-busy={cargando}>
          {datos.excede && (
            <Aviso tono="aviso" titulo={`Más de ${CFG.maxDiasAusencia} días lectivos`} accion={<Link href="/gestion/profes" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Ir a Profesorado</Link>}>
              Una ausencia tan larga es una cobertura por baja: se apunta en Profesorado y tutorías, y quien la cubre hereda su horario.
            </Aviso>
          )}
          {datos.bajaCubiertaPor && (
            <Aviso tono="aviso" titulo="Su baja ya está cubierta" accion={<Link href="/gestion/profes" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Ver en Profesorado</Link>}>
              Su baja la cubre {datos.bajaCubiertaPor}: sus clases ya tienen quien las dé. No se le apunta una ausencia.
            </Aviso>
          )}
          {datos.saltados.length > 0 && !datos.excede && <p className="text-sm text-zinc-500 dark:text-zinc-400">{textoSaltados(datos.saltados)}</p>}
          {cubriaA.length > 0 && (
            <Aviso tono="aviso" titulo={cubriaA.length === 1 ? 'Estaba cubriendo una hora' : `Estaba cubriendo ${cubriaA.length} horas`}>
              Al confirmar, se quedan sin cubrir:{' '}
              {cubriaA.map((c) => `${fechaLarga(c.fecha)} a las ${c.horaInicio.replace(/^0/, '')}${c.grupos ? ` (${c.grupos})` : ''}, de ${c.cubreA}`).join('; ')}. Luego, desde su ficha, se busca a otra persona.
            </Aviso>
          )}

          {!bloqueado && (
            <Tarjeta>
              <TarjetaCabecera
                titulo="Sus horas y quién cubre"
                descripcion="Encendidas, las que cuentan. Las de clase con su grupo piden sustituto; el resto solo cuenta."
              />
              {datos.dias.length === 0 ? (
                <Vacio icono={<CalendarX2 />} titulo="No hay días lectivos en esas fechas" className="m-4" />
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {datos.dias.map((d) => {
                    const abierto = abiertos.has(d.fecha) || datos.dias.length === 1;
                    const encendidasDia = d.sesiones.filter((s) => encendidas.has(claveSesion(s)));
                    const aCubrirDia = encendidasDia.filter((s) => s.hayQueCubrir).length;
                    return (
                      <section key={d.fecha} aria-label={fechaLarga(d.fecha)}>
                        <button
                          type="button"
                          aria-expanded={abierto}
                          onClick={() => setAbiertos((prev) => { const sig = new Set(prev); if (sig.has(d.fecha)) sig.delete(d.fecha); else sig.add(d.fecha); return sig; })}
                          className="flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-zinc-500 transition-transform', !abierto && '-rotate-90')} />
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{mayuscula(fechaLarga(d.fecha))}</span>
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">· {aCubrirDia === 1 ? '1 hora a cubrir' : `${aCubrirDia} horas a cubrir`}</span>
                        </button>
                        {abierto && (
                          <div className="space-y-3 px-4 pb-4">
                            {d.notas.map((n) => (
                              <p key={n} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                <Info aria-hidden className="size-3.5" /> {n}
                              </p>
                            ))}
                            {d.sesiones.length === 0 ? (
                              <Vacio icono={<CalendarX2 />} titulo="Ese día no tiene horas" />
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-2">
                                  <Button variant="outline" size="sm" onClick={() => atajo(d.fecha, 'todo')}>Todo el día</Button>
                                  <Button variant="outline" size="sm" onClick={() => atajo(d.fecha, 'clases')}>Solo las clases</Button>
                                </div>
                                <ul className="space-y-2">
                                  {d.sesiones.map((s) => (
                                    <FilaHora
                                      key={claveSesion(s)}
                                      s={s}
                                      activa={encendidas.has(claveSesion(s))}
                                      yaApuntada={yaApuntada(s)}
                                      onActiva={(v) => alternar(s, v)}
                                      propuesta={propuesta.get(claveSesion(s))}
                                      onElegir={(id) => { const clave = claveSesion(s); setFijados((prev) => ({ ...prev, [clave]: id })); if (id && id === segundos[clave]) setSegundos((prev) => ({ ...prev, [clave]: null })); }}
                                      segundo={segundos[claveSesion(s)] ?? null}
                                      onElegirSegundo={(id) => setSegundos((prev) => ({ ...prev, [claveSesion(s)]: id }))}
                                      rangoPrincipal={rangosPrincipales[claveSesion(s)] ?? { inicio: s.horaInicio, fin: s.horaFin }}
                                      onCambiarRangoPrincipal={(inicio, fin) => setRangosPrincipales((prev) => ({ ...prev, [claveSesion(s)]: { inicio, fin } }))}
                                      rango={rangosCobertura[claveSesion(s)] ?? { inicio: s.horaInicio, fin: s.horaFin }}
                                      onCambiarRango={(inicio, fin) => setRangosCobertura((prev) => ({ ...prev, [claveSesion(s)]: { inicio, fin } }))}
                                    />
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </Tarjeta>
          )}

          {!bloqueado && elegidas.length > 0 && (
            <Tarjeta>
              <TarjetaCuerpo>
                <Campo etiqueta="Indicaciones para la clase" id="indicaciones" opcional ayuda="Una para toda la ausencia. Les llega a quienes entran en el aula.">
                  <Textarea id="indicaciones" rows={3} maxLength={1500} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} placeholder="Qué hacen, dónde está el material…" />
                </Campo>
              </TarjetaCuerpo>
            </Tarjeta>
          )}
        </div>
      )}

      <BarraAcciones
        visible={Boolean(datos) && !bloqueado && elegidas.length > 0}
        resumen={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Interruptor
              activo={avisar}
              onChange={(v) => {
                avisarTocado.current = true;
                setAvisar(v);
              }}
              etiqueta="Avisar por correo"
              className="w-auto flex-row-reverse justify-end border-0 bg-transparent px-0 py-0 hover:border-0 dark:bg-transparent"
            />
            {avisar && <Interruptor activo={avisarAusente} onChange={setAvisarAusente} etiqueta="Enviar correo al profesor sustituido" className="w-auto flex-row-reverse justify-end border-0 bg-transparent px-0 py-0 hover:border-0 dark:bg-transparent" />}
            {sinCubrir > 0 && <span className="hidden text-amber-700 sm:inline dark:text-amber-400">{sinCubrir === 1 ? '1 sin cubrir' : `${sinCubrir} sin cubrir`}</span>}
          </div>
        }
      >
        <Button onClick={() => void confirmar()} cargando={guardando} disabled={!puedeConfirmar}>
          {avisar ? <Send aria-hidden /> : <Save aria-hidden />}
          <span className="sm:hidden">{avisar ? 'Confirmar' : 'Guardar'}</span>
          <span className="hidden sm:inline">{avisar ? `Confirmar y avisar a ${personas === 1 ? '1 persona' : `${personas} personas`}` : 'Guardar sin avisar'}</span>
        </Button>
      </BarraAcciones>
    </div>
  );
}

/** «Se salta el viernes 8 de diciembre (Inmaculada) y el fin de semana.» */
function textoSaltados(saltados: RespuestaPropuesta['saltados']): string {
  const partes = saltados.filter((s) => s.porque === 'festivo').map((s) => `el ${fechaLarga(s.fecha)}${s.nombre ? ` (${s.nombre})` : ''}`);
  if (saltados.some((s) => s.porque === 'finde')) partes.push('el fin de semana');
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
  return `No ${partes.length > 1 ? 'son lectivos' : 'es lectivo'} ${lista}: se salta${partes.length > 1 ? 'n' : ''}.`;
}

function etiquetaCandidato(c: Candidato): string {
  const extra: string[] = [];
  if (c.esteMes > 0) extra.push(`${c.esteMes} este mes`);
  if (c.enCuadro) extra.push('en el cuadro');
  if (c.disponibilidad === 'no' || c.disponibilidad === 'urgencia') extra.push(c.ocupacion.join(', ') || (c.disponibilidad === 'no' ? 'no está en el colegio' : 'hora libre'));
  return extra.length ? `${c.nombre} · ${extra.join(' · ')}` : c.nombre;
}

/** Una hora del ausente: su interruptor y, si pide sustituto, a quién se manda. */
export function FilaHora({
  s,
  activa,
  yaApuntada,
  onActiva,
  propuesta,
  onElegir,
  segundo,
  onElegirSegundo,
  rangoPrincipal,
  onCambiarRangoPrincipal,
  rango,
  onCambiarRango,
}: {
  s: SesionAusente;
  activa: boolean;
  yaApuntada: boolean;
  onActiva: (v: boolean) => void;
  propuesta?: PropuestaSesion;
  onElegir: (id: string | null) => void;
  segundo: string | null;
  onElegirSegundo: (id: string | null) => void;
  rangoPrincipal: { inicio: string; fin: string };
  onCambiarRangoPrincipal: (inicio: string, fin: string) => void;
  rango: { inicio: string; fin: string };
  onCambiarRango: (inicio: string, fin: string) => void;
}) {
  const elegido = propuesta?.elegido ?? null;
  const que = describirSesion(s);
  return (
    <li className={cn('rounded-xl border border-zinc-200 p-3 dark:border-zinc-800', !activa && 'bg-zinc-50 dark:bg-zinc-900/40')}>
      <div className="flex items-start gap-3">
        <Interruptor activo={activa} onChange={onActiva} etiqueta={`No asiste · ${s.horaInicio} ${que}`} etiquetaOculta disabled={yaApuntada} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {s.tramo ? `${s.tramo} · ` : ''}
              {horaRango(s.horaInicio, s.horaFin)}
            </span>
            {s.grupos.map((g) => (
              <Etiqueta key={g}>{g}</Etiqueta>
            ))}
            {!s.hayQueCubrir && <span className="text-sm text-zinc-500 dark:text-zinc-400">{s.etiqueta ?? s.actividadNombre ?? s.actividad}</span>}
          </div>
          {s.hayQueCubrir && (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{lugarDe({ grupos: null, materia: s.materia ?? s.etiqueta, aula: s.aula })}</p>
          )}
          {yaApuntada && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Ya está en otra ausencia suya</p>}
          {activa && s.hayQueCubrir && propuesta && (
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Selector
                  aria-label={`Quién cubre la hora de las ${s.horaInicio}`}
                  className="w-full min-w-0 sm:w-auto sm:max-w-sm sm:flex-1"
                  value={elegido?.id ?? SIN_CUBRIR}
                  onChange={(e) => onElegir(e.target.value === SIN_CUBRIR ? null : e.target.value)}
                >
                  <option value={SIN_CUBRIR}>Sin cubrir</option>
                  {agruparCandidatos(propuesta.candidatos).map((g) => (
                    <optgroup key={g.etiqueta} label={g.etiqueta}>
                      {g.candidatos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {etiquetaCandidato(c)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Selector>
                {elegido ? (
                  <Estado tono={elegido.disponibilidad === 'urgencia' || elegido.disponibilidad === 'no' ? 'aviso' : 'ok'}>{nombreNivel(elegido.nivel)}</Estado>
                ) : (
                  <Estado tono="aviso">Sin cubrir</Estado>
                )}
              </div>
              {propuesta.enCuadro.length > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">En el cuadro: {propuesta.enCuadro.join(', ')}</p>}
              {elegido && <div className="flex flex-wrap items-center gap-2 text-sm"><span>Franja de {elegido.nombre}:</span><label>Desde <input aria-label="Desde la hora del primer sustituto" type="time" value={rangoPrincipal.inicio} onChange={(e) => onCambiarRangoPrincipal(e.target.value, rangoPrincipal.fin)} className="h-11 rounded-md border bg-background px-2" /></label><label>Hasta <input aria-label="Hasta la hora del primer sustituto" type="time" value={rangoPrincipal.fin} onChange={(e) => onCambiarRangoPrincipal(rangoPrincipal.inicio, e.target.value)} className="h-11 rounded-md border bg-background px-2" /></label></div>}
              {elegido && <div className="grid gap-2 sm:grid-cols-2">
                <Selector aria-label={`Segundo sustituto de ${s.horaInicio}`} value={segundo ?? ''} onChange={(e) => onElegirSegundo(e.target.value || null)}>
                  <option value="">Sin segundo sustituto</option>
                  {propuesta.candidatos.filter((c) => c.id !== elegido?.id).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Selector>
                {segundo && <div className="flex items-center gap-2 text-sm"><span>Franja del segundo:</span><label>Desde <input aria-label="Desde la hora del segundo sustituto" type="time" value={rango.inicio} onChange={(e) => onCambiarRango(e.target.value, rango.fin)} className="h-11 rounded-md border bg-background px-2" /></label><label>Hasta <input aria-label="Hasta la hora del segundo sustituto" type="time" value={rango.fin} onChange={(e) => onCambiarRango(rango.inicio, e.target.value)} className="h-11 rounded-md border bg-background px-2" /></label></div>}
              </div>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
