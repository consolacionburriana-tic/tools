'use client';

// Apuntar una sustitución (docs/32, «Calendario», 23-nov-2026). Se abre en un panel al tocar un hueco
// del calendario (esa hora ya marcada), la cabecera de un día (el día entero) o desde ⌘K (lo escrito,
// ya entendido). Lo mínimo: quién → (las horas y quién entra ya vienen propuestas) → motivo → Guardar.
// La propuesta NO se guarda: vive aquí y se recalcula con `proponerSustitutos` (puro) a cada cambio;
// confirmar lo vuelve a comprobar todo en el servidor.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarX2, Info, PencilLine, Search, Send, SplitSquareHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import { aMin } from '@/lib/oratorios';
import { sinAcentos } from '@/lib/sustituciones-interpretar';
import {
  agruparCandidatos,
  claveSesion,
  cubreDentro,
  entradaDesdeContexto,
  fechaLarga,
  hora,
  lugarDe,
  mayuscula,
  nombreNivel,
  proponerSustitutos,
  solapa,
  type Candidato,
  type PropuestaSesion,
  type SesionAusente,
} from '@/lib/sustituciones';
import type { ProfeSelector, RespuestaPropuesta } from '@/lib/sustituciones-server';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Selector } from '@/components/ui/selector';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
import { horaRango, pedir, textoAvisos, type Avisos } from './comun';

const CFG = CONFIGURACION.sustituciones;
const SIN_CUBRIR = '__sin__';

export interface InicialAusencia {
  profeId?: string;
  desde?: string;
  hasta?: string;
  /** Tocaron un hueco a esta hora: solo la clase de esa hora. */
  hora?: string;
  /** «3ª, 4ª» (de ⌘K). */
  tramos?: string[];
  /** Una franja de reloj (de ⌘K). */
  hi?: string;
  hf?: string;
  motivo?: string;
}

/** Qué horas salen marcadas al cargar: las que pidió quien abrió el panel o, si no, todas las clases. */
function marcadasDeSalida(r: RespuestaPropuesta, ini: InicialAusencia, ya: (s: SesionAusente) => boolean): { claves: Set<string>; nota: string | null } {
  const todas = r.dias.flatMap((d) => d.sesiones).filter((s) => !ya(s));
  const clases = todas.filter((s) => s.hayQueCubrir);
  let elegidas: SesionAusente[] | null = null;
  let nota: string | null = null;
  if (ini.hora) {
    const t = aMin(ini.hora);
    const delDia = todas.filter((s) => s.fecha === r.desde);
    let enHora = delDia.filter((s) => aMin(s.horaInicio) <= t && t < aMin(s.horaFin));
    // Tocar cerca de una clase (en el recreo de antes, al borde) vale como tocarla.
    if (enHora.length === 0) {
      const distancia = (s: SesionAusente) => Math.min(Math.abs(aMin(s.horaInicio) - t), Math.abs(aMin(s.horaFin) - t));
      const cerca = delDia.filter((s) => distancia(s) <= 20).sort((a, b) => distancia(a) - distancia(b));
      if (cerca.length > 0) enHora = [cerca[0]];
    }
    if (enHora.length > 0) elegidas = enHora;
    else nota = `A las ${hora(ini.hora)} no tiene nada en el horario: te marco sus clases del día.`;
  } else if (ini.tramos?.length) {
    const pedidos = new Set(ini.tramos.map((t) => t.replace(/\D/g, '')));
    const casan = todas.filter((s) => s.tramo && pedidos.has(s.tramo.replace(/\D/g, '')));
    if (casan.length > 0) elegidas = casan;
    else nota = `No encuentro sus horas ${ini.tramos.join(', ')}: te marco sus clases.`;
  } else if (ini.hi) {
    const f = { horaInicio: ini.hi, horaFin: ini.hf ?? ini.hi.replace(/^(\d+)/, (h) => String(Number(h) + 1).padStart(2, '0')) };
    const casan = todas.filter((s) => solapa(s, f));
    if (casan.length > 0) elegidas = casan;
  }
  return { claves: new Set((elegidas ?? clases).map(claveSesion)), nota };
}

export function FormularioAusencia({
  profes,
  hoy,
  inicial,
  etapasPrimero,
  onHecho,
}: {
  profes: ProfeSelector[];
  hoy: string;
  inicial: InicialAusencia;
  /** Las etapas de quien apunta: sus profes salen primero. */
  etapasPrimero: string[];
  onHecho: (id: string) => void;
}) {
  const [profeId, setProfeId] = useState(inicial.profeId ?? '');
  const [desde, setDesde] = useState(inicial.desde ?? hoy);
  const [hasta, setHasta] = useState(inicial.hasta ?? inicial.desde ?? hoy);
  const [varios, setVarios] = useState((inicial.hasta ?? inicial.desde ?? hoy) !== (inicial.desde ?? hoy));
  const [motivo, setMotivo] = useState(inicial.motivo && CFG.motivos.some((m) => m.clave === inicial.motivo) ? inicial.motivo : '');
  const [nota, setNota] = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [conIndicaciones, setConIndicaciones] = useState(false);
  const [avisarAusente, setAvisarAusente] = useState(true);
  const [enviarYa, setEnviarYa] = useState(false);
  const motivoTocado = useRef(Boolean(inicial.motivo));
  const [datos, setDatos] = useState<RespuestaPropuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notaSeleccion, setNotaSeleccion] = useState<string | null>(null);
  const [encendidas, setEncendidas] = useState<Set<string>>(new Set());
  const [fijados, setFijados] = useState<Record<string, string | null>>({});
  const [segundos, setSegundos] = useState<Record<string, string | null>>({});
  const [partidas, setPartidas] = useState<Set<string>>(new Set());
  const [rangos1, setRangos1] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [rangos2, setRangos2] = useState<Record<string, { inicio: string; fin: string }>>({});
  const [verTodas, setVerTodas] = useState(false);
  const [guardando, setGuardando] = useState<'borrador' | 'avisar' | null>(null);
  const peticion = useRef(0);
  const primeraCarga = useRef(true);
  const pasado = hasta < hoy;

  async function cargar(id: string, d: string, h: string) {
    if (!id || !d || !h || h < d) {
      peticion.current++;
      setDatos(null);
      setCargando(false);
      return;
    }
    const n = ++peticion.current;
    setCargando(true);
    setError(null);
    try {
      const r = await pedir<RespuestaPropuesta>('/api/sustituciones/admin/propuesta', { body: { profeId: id, desde: d, hasta: h } });
      if (n !== peticion.current) return;
      setDatos(r);
      if (r.deBajaSinSustituto && !motivoTocado.current) {
        setMotivo('baja');
        setAvisarAusente(false);
      }
      const ya = (s: SesionAusente) => r.yaApuntadas.some((y) => y.fecha === s.fecha && solapa(y, s));
      // Lo que pidió quien abrió el panel vale solo para la primera carga.
      const { claves, nota: n2 } = marcadasDeSalida(r, primeraCarga.current ? inicial : {}, ya);
      primeraCarga.current = false;
      setNotaSeleccion(n2);
      setEncendidas(claves);
      setFijados({});
      setSegundos({});
      setPartidas(new Set());
      setRangos1({});
      setRangos2({});
      setVerTodas(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la propuesta se pide una vez al abrir, si ya viene el profe
    if (inicial.profeId) void cargar(inicial.profeId, desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegirProfe(id: string) {
    setProfeId(id);
    void cargar(id, desde, hasta);
  }
  function cambiarDesde(v: string) {
    const h = !varios || !hasta || hasta < v ? v : hasta;
    setDesde(v);
    setHasta(h);
    void cargar(profeId, v, h);
  }
  function cambiarHasta(v: string) {
    setHasta(v);
    void cargar(profeId, desde, v);
  }

  const yaApuntada = (s: SesionAusente) => (datos?.yaApuntadas ?? []).some((y) => y.fecha === s.fecha && solapa(y, s));

  const propuesta = useMemo(() => {
    if (!datos) return new Map<string, PropuestaSesion>();
    const aCubrir = datos.dias.flatMap((d) => d.sesiones.filter((s) => s.hayQueCubrir && encendidas.has(claveSesion(s))));
    return new Map(proponerSustitutos(entradaDesdeContexto(datos.contexto, aCubrir, datos.profe.id, fijados)).map((p) => [p.clave, p]));
  }, [datos, encendidas, fijados]);

  const elegidas = useMemo(() => (datos?.dias ?? []).flatMap((d) => d.sesiones.filter((s) => encendidas.has(claveSesion(s)))), [datos, encendidas]);
  const cubriaA = datos ? cubreDentro(datos.cubreYa, elegidas) : [];
  const personas = new Set([...propuesta.values()].map((p) => p.elegido?.id).filter(Boolean)).size + Object.values(segundos).filter(Boolean).length + (avisarAusente && elegidas.length > 0 ? 1 : 0);
  const sinCubrir = [...propuesta.values()].filter((p) => !p.elegido).length;
  const bloqueado = !datos || datos.excede || Boolean(datos.bajaCubiertaPor);
  const motivoInfo = CFG.motivos.find((m) => m.clave === motivo);
  const faltaNota = Boolean(motivoInfo?.pideNota) && !nota.trim();
  const listo = !bloqueado && elegidas.length > 0 && Boolean(motivo) && !faltaNota && !cargando;

  async function guardar(avisar: boolean) {
    if (!datos) return;
    if (!motivo) {
      toast.error('Elige el motivo');
      return;
    }
    setGuardando(avisar ? 'avisar' : 'borrador');
    try {
      const sesiones = elegidas.map((s) => {
        const k = claveSesion(s);
        const s2 = s.hayQueCubrir && partidas.has(k) ? (segundos[k] ?? null) : null;
        return {
          fecha: s.fecha,
          horSesionId: s.sesionId,
          sustitutoId: s.hayQueCubrir ? (propuesta.get(k)?.elegido?.id ?? null) : null,
          sustituto2Id: s2,
          ...(s.hayQueCubrir ? { sustitutoHoraInicio: rangos1[k]?.inicio ?? s.horaInicio, sustitutoHoraFin: rangos1[k]?.fin ?? s.horaFin } : {}),
          ...(s2 ? { sustituto2HoraInicio: rangos2[k]?.inicio ?? s.horaInicio, sustituto2HoraFin: rangos2[k]?.fin ?? s.horaFin } : {}),
        };
      });
      const r = await pedir<{ id: string; avisos: Avisos | null; liberadas: unknown[] }>('/api/sustituciones/admin/ausencias', {
        body: { profeId: datos.profe.id, desde: datos.desde, hasta: datos.hasta, motivo, nota: nota || null, indicaciones: indicaciones || null, avisar, avisarAusente, enviarYa, sesiones },
      });
      haptic.success();
      const avisos = textoAvisos(r.avisos);
      if (r.avisos?.fallidos.length) toast.warning(`Guardada. ${avisos}. Puedes reenviarlo desde la ficha.`);
      else toast.success(avisar ? (avisos ? `Guardada. ${avisos}.` : 'Guardada') : pasado ? 'Guardada' : 'Guardada como borrador: avisa cuando quieras desde su ficha');
      if (r.liberadas.length > 0) toast.warning(`${r.liberadas.length === 1 ? 'Una hora que cubría se ha quedado' : `${r.liberadas.length} horas que cubría se han quedado`} sin cubrir: salen en ámbar en el calendario.`);
      onHecho(r.id);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
      void cargar(profeId, desde, hasta);
    } finally {
      setGuardando(null);
    }
  }

  const profe = profes.find((p) => p.id === profeId);
  const diasConHoras = datos?.dias ?? [];
  const ocultas = diasConHoras.reduce((n, d) => n + d.sesiones.filter((s) => !s.hayQueCubrir && !encendidas.has(claveSesion(s))).length, 0);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 pb-4">
        {/* 1 · Quién */}
        {profe ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Falta</p>
              <p className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{profe.nombre}</p>
              {profe.estado && <p className="text-sm text-zinc-500 dark:text-zinc-400">{profe.estado}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProfeId('');
                setDatos(null);
                peticion.current++;
              }}
            >
              <X aria-hidden /> Cambiar
            </Button>
          </div>
        ) : (
          <BuscadorProfe profes={profes} etapasPrimero={etapasPrimero} onElegir={elegirProfe} />
        )}

        {/* 2 · Cuándo */}
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta={varios ? 'Desde' : 'Día'} id="f-desde" className="w-[11rem]">
            <Input id="f-desde" type="date" value={desde} onChange={(e) => cambiarDesde(e.target.value)} />
          </Campo>
          {varios ? (
            <Campo etiqueta="Hasta" id="f-hasta" className="w-[11rem]">
              <Input id="f-hasta" type="date" value={hasta} min={desde} onChange={(e) => cambiarHasta(e.target.value)} />
            </Campo>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setVarios(true)}>
              Varios días
            </Button>
          )}
          <p className="pb-2.5 text-sm text-zinc-500 dark:text-zinc-400">{desde === hasta ? mayuscula(fechaLarga(desde)) : `${diasConHoras.length} días lectivos`}</p>
        </div>

        {/* 3 · Por qué */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Motivo <span className="font-normal text-zinc-500 dark:text-zinc-400">· solo lo ve Jefatura</span>
          </p>
          <Filtros etiqueta="Motivo">
            {CFG.motivos.map((m) => (
              <Filtro
                key={m.clave}
                activo={motivo === m.clave}
                onClick={() => {
                  motivoTocado.current = true;
                  setMotivo(m.clave);
                  setAvisarAusente(m.clave !== 'baja');
                }}
              >
                {m.nombre}
              </Filtro>
            ))}
          </Filtros>
          {motivoInfo?.pideNota && (
            <Input aria-label="Nota del motivo" placeholder="Una nota corta (solo la ve Jefatura)" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} aria-invalid={faltaNota} />
          )}
        </div>

        {error && <Aviso tono="error">{error}</Aviso>}

        {profeId && cargando && !datos && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {datos && (
          <div className={cn('space-y-4 transition-opacity', cargando && 'opacity-60')} aria-busy={cargando}>
            {datos.excede && (
              <Aviso tono="aviso" titulo={`Más de ${CFG.maxDiasAusencia} días lectivos`} accion={<Link href="/gestion/sustituciones/bajas" className={buttonVariants({ variant: 'outline', size: 'sm' })}>Ir a Bajas</Link>}>
                Apúntala por tramos más cortos o, si viene alguien a sustituirle, anota la baja con su sustituto.
              </Aviso>
            )}
            {datos.bajaCubiertaPor && (
              <Aviso tono="aviso" titulo="Su baja ya está cubierta">
                La cubre {datos.bajaCubiertaPor}: sus clases ya tienen quien las dé.
              </Aviso>
            )}
            {datos.deBajaSinSustituto && !datos.excede && <Aviso tono="info">Está de baja sin sustituto: el motivo va como «Baja» y, de salida, no se le escribe.</Aviso>}
            {datos.saltados.length > 0 && !datos.excede && <p className="text-sm text-zinc-500 dark:text-zinc-400">{textoSaltados(datos.saltados)}</p>}
            {notaSeleccion && <p className="text-sm text-zinc-500 dark:text-zinc-400">{notaSeleccion}</p>}
            {cubriaA.length > 0 && (
              <Aviso tono="aviso" titulo={cubriaA.length === 1 ? 'Estaba cubriendo una hora' : `Estaba cubriendo ${cubriaA.length} horas`}>
                Se quedarán sin cubrir: {cubriaA.map((c) => `${hora(c.horaInicio)}${c.grupos ? ` (${c.grupos})` : ''}, de ${c.cubreA}`).join('; ')}.
              </Aviso>
            )}

            {!bloqueado &&
              (diasConHoras.length === 0 ? (
                <Vacio icono={<CalendarX2 />} titulo="No hay días lectivos en esas fechas" />
              ) : (
                diasConHoras.map((d) => {
                  const visibles = d.sesiones.filter((s) => verTodas || s.hayQueCubrir || encendidas.has(claveSesion(s)) || s.grupoFuera);
                  return (
                    <section key={d.fecha} aria-label={fechaLarga(d.fecha)} className="space-y-2">
                      {diasConHoras.length > 1 && <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{mayuscula(fechaLarga(d.fecha))}</h3>}
                      {d.notas.map((n) => (
                        <p key={n} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Info aria-hidden className="size-3.5" /> {n}
                        </p>
                      ))}
                      {d.sesiones.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Ese día no tiene horas.</p>
                      ) : (
                        <ul className="space-y-2">
                          {visibles.map((s) => {
                            const k = claveSesion(s);
                            return (
                              <FilaHora
                                key={k}
                                s={s}
                                activa={encendidas.has(k)}
                                yaApuntada={yaApuntada(s)}
                                onActiva={(v) =>
                                  setEncendidas((prev) => {
                                    const sig = new Set(prev);
                                    if (v) sig.add(k);
                                    else sig.delete(k);
                                    return sig;
                                  })
                                }
                                propuesta={propuesta.get(k)}
                                onElegir={(id) => {
                                  setFijados((prev) => ({ ...prev, [k]: id }));
                                  if (id && id === segundos[k]) setSegundos((prev) => ({ ...prev, [k]: null }));
                                }}
                                partida={partidas.has(k)}
                                onPartir={(v) => setPartidas((prev) => { const sig = new Set(prev); if (v) sig.add(k); else sig.delete(k); return sig; })}
                                segundo={segundos[k] ?? null}
                                onElegirSegundo={(id) => setSegundos((prev) => ({ ...prev, [k]: id }))}
                                rango1={rangos1[k] ?? { inicio: s.horaInicio, fin: s.horaFin }}
                                onRango1={(inicio, fin) => setRangos1((prev) => ({ ...prev, [k]: { inicio, fin } }))}
                                rango2={rangos2[k] ?? { inicio: s.horaInicio, fin: s.horaFin }}
                                onRango2={(inicio, fin) => setRangos2((prev) => ({ ...prev, [k]: { inicio, fin } }))}
                              />
                            );
                          })}
                        </ul>
                      )}
                      {diasConHoras.length === 1 && d.sesiones.some((s) => s.hayQueCubrir) && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEncendidas(new Set(d.sesiones.filter((s) => s.hayQueCubrir && !yaApuntada(s)).map(claveSesion)))}
                          >
                            Todas sus clases del día
                          </Button>
                        </div>
                      )}
                    </section>
                  );
                })
              ))}
            {!bloqueado && ocultas > 0 && (
              <Button variant="link" size="sm" onClick={() => setVerTodas((v) => !v)}>
                {verTodas ? 'Ocultar las horas sin clase' : `Ver también sus ${ocultas} horas sin clase (reuniones, codocencias…)`}
              </Button>
            )}

            {!bloqueado && elegidas.length > 0 && (
              conIndicaciones ? (
                <Campo etiqueta="Indicaciones para la clase" id="indicaciones" opcional ayuda="Les llegan a quienes entran en el aula.">
                  <Textarea id="indicaciones" rows={3} maxLength={1500} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} placeholder="Qué hacen, dónde está el material…" autoFocus />
                </Campo>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConIndicaciones(true)}>
                  <PencilLine aria-hidden /> Añadir indicaciones para la clase
                </Button>
              )
            )}
          </div>
        )}
      </div>

      {/* El pie: fijo abajo del panel */}
      {datos && !bloqueado && elegidas.length > 0 && (
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-zinc-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/95">
          {!pasado && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Interruptor activo={avisarAusente} onChange={setAvisarAusente} etiqueta="Avisar también a quien falta" className="w-auto flex-row-reverse justify-end border-0 bg-transparent px-0 py-0 hover:border-0 dark:bg-transparent" />
              <Interruptor activo={enviarYa} onChange={setEnviarYa} etiqueta="Que salga ya (aunque sea tarde o fin de semana)" className="w-auto flex-row-reverse justify-end border-0 bg-transparent px-0 py-0 hover:border-0 dark:bg-transparent" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-sm text-zinc-600 dark:text-zinc-400">
              {elegidas.length === 1 ? '1 hora' : `${elegidas.length} horas`}
              {sinCubrir > 0 && <span className="text-amber-700 dark:text-amber-400"> · {sinCubrir} sin cubrir</span>}
              {!motivo && <span className="text-amber-700 dark:text-amber-400"> · falta el motivo</span>}
            </span>
            {pasado ? (
              <Button onClick={() => void guardar(false)} cargando={guardando === 'borrador'} disabled={!listo || guardando !== null}>
                Guardar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => void guardar(false)} cargando={guardando === 'borrador'} disabled={!listo || guardando !== null}>
                  <PencilLine aria-hidden /> Borrador
                </Button>
                <Button onClick={() => void guardar(true)} cargando={guardando === 'avisar'} disabled={!listo || guardando !== null}>
                  <Send aria-hidden /> {personas > 0 ? `Guardar y avisar a ${personas}` : 'Guardar y avisar'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Buscar a quién falta: escribir dos letras y Intro. Los de tu etapa, primero. */
function BuscadorProfe({ profes, etapasPrimero, onElegir }: { profes: ProfeSelector[]; etapasPrimero: string[]; onElegir: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const mias = new Set(etapasPrimero);
  const esMio = (p: ProfeSelector) => mias.size === 0 || p.etapas.some((e) => mias.has(e));
  const t = sinAcentos(q.trim());
  const lista = profes
    .filter((p) => !t || sinAcentos(p.nombre).split(/\s+/).some((w) => w.startsWith(t)) || sinAcentos(p.nombre).includes(t))
    .sort((a, b) => Number(esMio(b)) - Number(esMio(a)) || a.nombre.localeCompare(b.nombre, 'es'));
  const primeraOtra = lista.findIndex((p) => !esMio(p));
  return (
    <div className="space-y-2">
      <label htmlFor="buscar-profe" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        ¿Quién falta?
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          id="buscar-profe"
          autoFocus
          autoComplete="off"
          placeholder="Escribe un nombre…"
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActivo((i) => Math.min(i + 1, lista.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActivo((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && lista[activo]) {
              e.preventDefault();
              onElegir(lista[activo].id);
            }
          }}
          role="combobox"
          aria-expanded
          aria-controls="lista-profes"
          aria-activedescendant={lista[activo] ? `profe-${lista[activo].id}` : undefined}
        />
      </div>
      <ul id="lista-profes" role="listbox" aria-label="Profesorado" className="max-h-[50dvh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {lista.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">Nadie con ese nombre</li>}
        {lista.map((p, i) => (
          <li key={p.id} role="presentation">
            {i === primeraOtra && primeraOtra > 0 && <p className="px-3 pt-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">De otras etapas</p>}
            <button
              type="button"
              id={`profe-${p.id}`}
              role="option"
              aria-selected={i === activo}
              disabled={p.cubierto}
              onMouseEnter={() => setActivo(i)}
              onClick={() => onElegir(p.id)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm outline-none disabled:opacity-50',
                i === activo ? 'bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-100' : 'text-zinc-800 dark:text-zinc-200',
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{p.nombre}</span>
              {p.estado && <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{p.estado}</span>}
            </button>
          </li>
        ))}
      </ul>
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

/** El desplegable de quién entra, con los candidatos agrupados por disponibilidad y nivel. */
export function SelectorSustituto({
  propuesta,
  valor,
  onChange,
  etiqueta,
  disabled,
  extra,
  className,
}: {
  propuesta: PropuestaSesion;
  valor: string | null;
  onChange: (id: string | null) => void;
  etiqueta: string;
  disabled?: boolean;
  /** Alguien que ya está elegido y no sale entre los candidatos. */
  extra?: { id: string; nombre: string } | null;
  className?: string;
}) {
  return (
    <Selector aria-label={etiqueta} className={cn('w-full min-w-0', className)} value={valor ?? SIN_CUBRIR} disabled={disabled} onChange={(e) => onChange(e.target.value === SIN_CUBRIR ? null : e.target.value)}>
      <option value={SIN_CUBRIR}>Sin cubrir</option>
      {extra && !propuesta.candidatos.some((c) => c.id === extra.id) && <option value={extra.id}>{extra.nombre}</option>}
      {agruparCandidatos(propuesta.candidatos).map((g) => (
        <optgroup key={g.etiqueta} label={g.etiqueta}>
          {g.candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {etiquetaCandidato(c)}
            </option>
          ))}
        </optgroup>
      ))}
      {propuesta.deBaja.length > 0 && (
        <optgroup label="De baja (no reciben sustituciones)">
          {propuesta.deBaja.map((n) => (
            <option key={`baja-${n}`} value="" disabled>
              {n} — de baja
            </option>
          ))}
        </optgroup>
      )}
    </Selector>
  );
}

function Franja({ rango, onCambiar, etiqueta }: { rango: { inicio: string; fin: string }; onCambiar: (inicio: string, fin: string) => void; etiqueta: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
      <input aria-label={`${etiqueta}: desde`} type="time" value={rango.inicio} onChange={(e) => onCambiar(e.target.value, rango.fin)} className="h-10 rounded-lg border border-zinc-300 bg-white px-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
      –
      <input aria-label={`${etiqueta}: hasta`} type="time" value={rango.fin} onChange={(e) => onCambiar(rango.inicio, e.target.value)} className="h-10 rounded-lg border border-zinc-300 bg-white px-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-900" />
    </span>
  );
}

/** Una hora del ausente: si cuenta, y si pide sustituto, quién entra (y si se parte entre dos). */
function FilaHora({
  s,
  activa,
  yaApuntada,
  onActiva,
  propuesta,
  onElegir,
  partida,
  onPartir,
  segundo,
  onElegirSegundo,
  rango1,
  onRango1,
  rango2,
  onRango2,
}: {
  s: SesionAusente;
  activa: boolean;
  yaApuntada: boolean;
  onActiva: (v: boolean) => void;
  propuesta?: PropuestaSesion;
  onElegir: (id: string | null) => void;
  partida: boolean;
  onPartir: (v: boolean) => void;
  segundo: string | null;
  onElegirSegundo: (id: string | null) => void;
  rango1: { inicio: string; fin: string };
  onRango1: (inicio: string, fin: string) => void;
  rango2: { inicio: string; fin: string };
  onRango2: (inicio: string, fin: string) => void;
}) {
  const elegido = propuesta?.elegido ?? null;
  const lugar = lugarDe({ grupos: null, materia: s.materia ?? s.etiqueta, aula: s.aula });
  return (
    <li className={cn('rounded-xl border p-3 transition-colors', activa ? 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900' : 'border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40')}>
      <div className="flex items-start gap-3">
        <Interruptor activo={activa} onChange={onActiva} etiqueta={`Falta a las ${hora(s.horaInicio)}`} etiquetaOculta disabled={yaApuntada} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {s.tramo ? `${s.tramo} · ` : ''}
              {horaRango(s.horaInicio, s.horaFin)}
            </span>
            {s.grupos.map((g) => (
              <Etiqueta key={g}>{g}</Etiqueta>
            ))}
            <span className="min-w-0 truncate text-sm text-zinc-500 dark:text-zinc-400">{s.hayQueCubrir ? lugar : (s.etiqueta ?? s.materia ?? s.actividadNombre ?? s.actividad)}</span>
          </div>
          {s.grupoFuera && <p className="text-sm text-zinc-500 dark:text-zinc-400">Su grupo está de salida: no hace falta que entre nadie.</p>}
          {yaApuntada && <p className="text-sm text-zinc-500 dark:text-zinc-400">Ya está en otra ausencia suya.</p>}
          {!s.hayQueCubrir && activa && !s.grupoFuera && <p className="text-xs text-zinc-500 dark:text-zinc-400">Cuenta como ausencia; no pide sustituto.</p>}
          {activa && s.hayQueCubrir && propuesta && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SelectorSustituto className="sm:max-w-sm sm:flex-1" etiqueta={`Quién entra a las ${hora(s.horaInicio)}`} propuesta={propuesta} valor={elegido?.id ?? null} onChange={onElegir} />
                {elegido ? (
                  <Estado tono={elegido.disponibilidad === 'urgencia' || elegido.disponibilidad === 'no' ? 'aviso' : 'ok'}>{nombreNivel(elegido.nivel)}</Estado>
                ) : (
                  <Estado tono="aviso">Sin cubrir</Estado>
                )}
                {elegido && (
                  <Button variant="ghost" size="sm" aria-pressed={partida} onClick={() => onPartir(!partida)}>
                    <SplitSquareHorizontal aria-hidden /> {partida ? 'Una sola persona' : 'Partir la hora'}
                  </Button>
                )}
              </div>
              {propuesta.enCuadro.length > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">En el cuadro: {propuesta.enCuadro.join(', ')}</p>}
              {partida && elegido && (
                <div className="space-y-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 truncate font-medium">{elegido.nombre}</span>
                    <Franja rango={rango1} onCambiar={onRango1} etiqueta={`Franja de ${elegido.nombre}`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Selector aria-label="Segunda persona" className="w-auto min-w-0 flex-1 sm:max-w-xs" value={segundo ?? ''} onChange={(e) => onElegirSegundo(e.target.value || null)}>
                      <option value="">Segunda persona…</option>
                      {propuesta.candidatos.filter((c) => c.id !== elegido.id).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </Selector>
                    {segundo && <Franja rango={rango2} onCambiar={onRango2} etiqueta="Franja de la segunda persona" />}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
