'use client';

// La ficha de una ausencia (docs/32, decisión 9): cambiar el sustituto de una hora en el sitio,
// añadir o quitar horas, cambiar fechas, editar motivo e indicaciones, reenviar avisos y anular.
// Las ausencias no se borran nunca: se anulan (dejan de contar).
import { useState } from 'react';
import { Ban, CalendarRange, CircleOff, Mail, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import {
  agruparCandidatos,
  agruparMotivo,
  describirSesion,
  estadoHora,
  ESTADO_HORA_INFO,
  fechaLarga,
  GRUPO_MOTIVO_NOMBRE,
  lugarDe,
  mayuscula,
  nombreMotivo,
  nombreNivel,
  rangoLargo,
  type PropuestaSesion,
} from '@/lib/sustituciones';
import type { FichaAusencia as DatosFicha } from '@/lib/sustituciones-server';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { TituloPagina } from '@/components/ui/cabecera-modulo';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Rotulo } from '@/components/ui/rotulo';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { horaRango, pedir, TEXTO_AVISO, textoAvisos, type Avisos } from './comun';

const CFG = CONFIGURACION.sustituciones;
const SIN_CUBRIR = '__sin__';

/** Una fecha que puede venir como Date (servidor) o como texto (JSON). */
const comoFecha = (x: Date | string | null | undefined) => (x ? new Date(x) : null);

export function FichaAusencia({ ficha, hoy, recargar }: { ficha: DatosFicha; hoy: string; recargar: () => void }) {
  const a = ficha.ausencia;
  const anulada = a.estado === 'anulada';
  const [avisar, setAvisar] = useState(a.hasta >= hoy);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [motivo, setMotivo] = useState(a.motivo);
  const [nota, setNota] = useState(a.nota ?? '');
  const [indicaciones, setIndicaciones] = useState(a.indicaciones ?? '');
  const [desde, setDesde] = useState(a.desde);
  const [hasta, setHasta] = useState(a.hasta);

  async function cambiar(clave: string, cuerpo: Record<string, unknown>, ok: string): Promise<boolean> {
    setOcupado(clave);
    try {
      const r = await pedir<{ avisos: Avisos | null }>(`/api/sustituciones/admin/ausencias/${a.id}`, { method: 'PATCH', body: cuerpo });
      haptic.success();
      const avisos = textoAvisos(r.avisos);
      if (r.avisos?.fallidos.length) toast.warning(`${ok}. ${avisos}`);
      else toast.success(avisos ? `${ok}. ${avisos}` : ok);
      recargar();
      return true;
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
      recargar();
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function reenviar(todos: boolean, enviarYa = false, clave?: string) {
    setOcupado(clave ?? (enviarYa ? 'enviar-ya' : todos ? 'reenviar-todos' : 'reenviar'));
    try {
      const r = await pedir<{ avisos: Avisos }>(`/api/sustituciones/admin/ausencias/${a.id}/reenviar`, { body: { todos, enviarYa } });
      const t = textoAvisos(r.avisos);
      if (r.avisos.fallidos.length) toast.warning(t ?? 'Ha fallado otra vez');
      else toast.success(t ?? 'No había nada que reenviar');
      recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido reenviar');
    } finally {
      setOcupado(null);
    }
  }

  async function anadir(fecha: string, horSesionId: string) {
    const clave = `${fecha}#${horSesionId}`;
    setOcupado(clave);
    try {
      const { propuesta } = await pedir<{ propuesta: PropuestaSesion[] }>(`/api/sustituciones/admin/ausencias/${a.id}/candidatos`, { body: { claves: [clave] } });
      const sustitutoId = propuesta[0]?.elegido?.id ?? null;
      await cambiar(
        clave,
        {
          accion: 'anadir',
          avisar,
          sesiones: [{ fecha, horSesionId, sustitutoId }],
        },
        sustitutoId ? `Añadida; entra ${propuesta[0].elegido!.nombre}` : 'Añadida',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido añadir');
      setOcupado(null);
    }
  }

  const porDia = new Map<string, typeof ficha.sesiones>();
  for (const s of ficha.sesiones) porDia.set(s.fecha, [...(porDia.get(s.fecha) ?? []), s]);
  const conError = ficha.sesiones.filter((s) => s.avisoEstado === 'error');
  const programadas = ficha.sesiones.filter((s) => s.avisoEstado === 'programado' && s.avisoProgramadoPara);
  const primeraProgramada = programadas.map((s) => new Date(s.avisoProgramadoPara!)).sort((x, y) => x.getTime() - y.getTime())[0];
  const borradores = ficha.sesiones.filter((s) => estadoHora(s, hoy) === 'borrador');
  const aAvisar = new Set(borradores.flatMap((s) => [s.sustitutoId, s.sustituto2Id]).filter(Boolean)).size + (a.avisarAusente ? 1 : 0);
  const aCubrir = ficha.sesiones.filter((s) => s.hayQueCubrir);
  const sinCubrir = aCubrir.filter((s) => !s.sustitutoId && !s.sustituto2Id).length;
  const avisados = new Set(
    ficha.sesiones
      .filter((s) => s.avisoEstado === 'enviado' && s.fecha >= hoy)
      .flatMap((s) => [s.sustitutoId, s.sustituto2Id])
      .filter(Boolean),
  ).size;
  const motivoInfo = CFG.motivos.find((m) => m.clave === motivo);
  const cambioMotivo = motivo !== a.motivo || (nota || '') !== (a.nota ?? '');
  const cambioIndicaciones = (indicaciones || '') !== (a.indicaciones ?? '');
  const quedanFuera = ficha.sesiones.filter((s) => s.fecha < desde || s.fecha > hasta).length;

  return (
    <div className="space-y-5">
      <div className="pr-10">
        <TituloPagina
          antes={anulada ? <Estado tono="neutro">Anulada</Estado> : undefined}
          descripcion={
            <span className="flex flex-wrap items-center gap-2">
              <Etiqueta>{nombreMotivo(a.motivo)}</Etiqueta>
              <span>
                {GRUPO_MOTIVO_NOMBRE[agruparMotivo(a.motivo)]} · {ficha.sesiones.length === 1 ? '1 hora' : `${ficha.sesiones.length} horas`}
                {aCubrir.length > 0 && ` · ${aCubrir.length - sinCubrir} de ${aCubrir.length} cubiertas`}
              </span>
            </span>
          }
        >
          {a.profeNombre} · {rangoLargo(a.desde, a.hasta).replace(/^el /, '')}
        </TituloPagina>
      </div>

      {anulada && (
        <Aviso tono="info">
          Anulada
          {a.anuladaAt ? ` el ${fechaLarga(comoFecha(a.anuladaAt)!.toISOString().slice(0, 10))}` : ''}. Ya no cuenta en las cifras ni en el informe.
        </Aviso>
      )}

      {!anulada && borradores.length > 0 && (
        <Aviso
          tono="info"
          titulo={borradores.length === 1 ? 'Una hora en borrador' : `${borradores.length} horas en borrador`}
          accion={
            <Button size="sm" cargando={ocupado === 'enviar'} onClick={() => void reenviar(false, false, 'enviar')}>
              <Send aria-hidden /> Avisar a {aAvisar === 1 ? '1 persona' : `${aAvisar} personas`}
            </Button>
          }
        >
          Tienen sustituto, pero aún no se ha avisado a nadie.
        </Aviso>
      )}

      {!anulada && conError.length > 0 && (
        <Aviso
          tono="error"
          titulo={conError.length === 1 ? 'Un aviso no ha salido' : `${conError.length} avisos no han salido`}
          accion={
            <Button variant="outline" size="sm" cargando={ocupado === 'reenviar'} onClick={() => void reenviar(false)}>
              <RefreshCw aria-hidden /> Reenviar
            </Button>
          }
        >
          {[...new Set(conError.map((s) => `${s.sustitutoNombre ?? '—'}: ${s.avisoError ?? 'error'}`))].join(' · ')}
        </Aviso>
      )}

      {!anulada && primeraProgramada && (
        <Aviso
          tono="info"
          titulo={programadas.length === 1 ? 'Un aviso está programado' : `${programadas.length} avisos están programados`}
          accion={
            <Button variant="outline" size="sm" cargando={ocupado === 'enviar-ya'} onClick={() => void reenviar(false, true)}>
              <Send aria-hidden /> Enviar ya
            </Button>
          }
        >
          Saldrán el{' '}
          {primeraProgramada.toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          (nunca antes de las 8, después de las 18 ni en fin de semana). Si hace falta antes, envíalos ya.
        </Aviso>
      )}

      {!anulada && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Interruptor activo={avisar} onChange={setAvisar} etiqueta="Avisar de los cambios por correo" />
          <Button variant="ghost" size="sm" cargando={ocupado === 'reenviar-todos'} onClick={() => void reenviar(true)}>
            <Mail aria-hidden /> Reenviar todos los avisos
          </Button>
        </div>
      )}

      {[...porDia].map(([fecha, sesiones]) => (
        <section key={fecha} className="space-y-2">
          <Rotulo>{mayuscula(fechaLarga(fecha))}</Rotulo>
          <Tarjeta>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sesiones.map((s) => {
                const prop = ficha.candidatos[s.id];
                return (
                  <li key={s.id} className="space-y-2 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                          {s.tramo ? `${s.tramo} · ` : ''}
                          {horaRango(s.horaInicio, s.horaFin)}
                        </span>
                        {s.grupos && <Etiqueta>{s.grupos}</Etiqueta>}
                        <Estado tono={ESTADO_HORA_INFO[estadoHora(s, hoy)].tono}>{ESTADO_HORA_INFO[estadoHora(s, hoy)].nombre}</Estado>
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                        {lugarDe({
                          grupos: null,
                          materia: s.materia,
                          aula: s.aula,
                        })}
                      </p>
                      {s.hayQueCubrir && (
                        <div className="mt-2 flex flex-col gap-1">
                          {anulada || !prop ? (
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{s.sustitutoNombre ? `Entró ${s.sustitutoNombre}` : 'Sin cubrir'}</span>
                          ) : (
                            <Selector
                              aria-label={`Quién cubre las ${s.horaInicio}`}
                              className="w-full min-w-0 sm:max-w-md"
                              value={s.sustitutoId ?? SIN_CUBRIR}
                              disabled={ocupado !== null}
                              onChange={(e) => {
                                const id = e.target.value === SIN_CUBRIR ? null : e.target.value;
                                const nombre = prop.candidatos.find((c) => c.id === id)?.nombre;
                                void cambiar(
                                  s.id,
                                  {
                                    accion: 'cambiar',
                                    sesionId: s.id,
                                    sustitutoId: id,
                                    avisar,
                                  },
                                  nombre ? `Ahora entra ${nombre}` : 'Queda sin cubrir',
                                );
                              }}
                            >
                              <option value={SIN_CUBRIR}>Sin cubrir</option>
                              {s.sustitutoId && !prop.candidatos.some((c) => c.id === s.sustitutoId) && <option value={s.sustitutoId}>{s.sustitutoNombre}</option>}
                              {agruparCandidatos(prop.candidatos).map((g) => (
                                <optgroup key={g.etiqueta} label={g.etiqueta}>
                                  {g.candidatos.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.nombre}
                                      {c.esteMes ? ` · ${c.esteMes} este mes` : ''}
                                      {c.enCuadro ? ' · en el cuadro' : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                              {prop.deBaja.length > 0 && (
                                <optgroup label="De baja (no reciben sustituciones)">
                                  {prop.deBaja.map((n) => (
                                    <option key={`baja-${n}`} value="" disabled>
                                      {n} — de baja
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </Selector>
                          )}
                          {s.sustitutoId && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {nombreNivel(s.nivel)} · {TEXTO_AVISO[s.avisoEstado] ?? s.avisoEstado}
                              {s.avisoProgramadoPara ? ` para ${comoFecha(s.avisoProgramadoPara)!.toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}` : ''}
                              {s.confirmacionToken ? ` · ${s.confirmacionEstado === 'confirmada' ? 'confirmada por el sustituto' : 'pendiente de confirmación'}` : ''}
                            </span>
                          )}
                          {s.sustituto2Id && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              También entra {s.sustituto2Nombre} · {horaRango(s.sustituto2HoraInicio ?? s.horaInicio, s.sustituto2HoraFin ?? s.horaFin)}
                              {s.confirmacion2Token ? ` · ${s.confirmacion2Estado === 'confirmada' ? 'confirmada' : 'pendiente de confirmación'}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!anulada && (s.hayQueCubrir || ficha.sesiones.length > 1) && (
                      <div className="-ml-3 flex flex-wrap gap-1">
                        {s.hayQueCubrir && (
                          <ConfirmarEnLinea
                            etiqueta="Ya no hace falta"
                            icono={<CircleOff aria-hidden />}
                            tamano="sm"
                            variante="ghost"
                            pregunta={s.sustitutoId && avisar && s.avisoEstado === 'enviado' ? `¿Nadie entra? Se avisa a ${s.sustitutoNombre}` : '¿Nadie tiene que entrar?'}
                            confirmar="Sí"
                            onConfirmar={() =>
                              cambiar(
                                `nhf-${s.id}`,
                                {
                                  accion: 'no_hace_falta',
                                  sesionId: s.id,
                                  avisar,
                                },
                                'Sigue contando, pero ya no pide sustituto',
                              )
                            }
                          />
                        )}
                        {ficha.sesiones.length > 1 && (
                          <ConfirmarEnLinea
                            etiqueta="Quitar hora"
                            icono={<Trash2 aria-hidden />}
                            tamano="sm"
                            variante="ghost"
                            pregunta={s.sustitutoId && avisar && s.avisoEstado === 'enviado' ? `¿Quitar? Se avisa a ${s.sustitutoNombre}` : '¿Quitar esta hora?'}
                            confirmar="Quitar"
                            onConfirmar={() => cambiar(s.id, { accion: 'quitar', sesionId: s.id, avisar }, 'Hora quitada')}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        </section>
      ))}

      {!anulada && ficha.sinApuntar.length > 0 && (
        <Tarjeta>
          <TarjetaCabecera titulo="Añadir horas" descripcion="Horas de su horario en estas fechas que no están en la ausencia." />
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ficha.sinApuntar.map((s) => {
              const clave = `${s.fecha}#${s.sesionId}`;
              return (
                <li key={clave} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium tabular-nums">
                      {fechaLarga(s.fecha)} · {horaRango(s.horaInicio, s.horaFin)}
                    </span>{' '}
                    · {describirSesion(s)}
                  </span>
                  <Button variant="suave" size="sm" cargando={ocupado === clave} disabled={ocupado !== null && ocupado !== clave} onClick={() => void anadir(s.fecha, s.sesionId)}>
                    <Plus aria-hidden /> Añadir
                  </Button>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      {!anulada && (
        <div className="grid gap-4">
          <Tarjeta>
            <TarjetaCabecera titulo="Indicaciones para la clase" descripcion="Les llegan a quienes entran en el aula." />
            <TarjetaCuerpo className="space-y-3">
              <Textarea aria-label="Indicaciones para la clase" rows={4} maxLength={1500} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} />
              <Button
                variant="outline"
                disabled={!cambioIndicaciones}
                cargando={ocupado === 'indicaciones'}
                onClick={() => void cambiar('indicaciones', { accion: 'indicaciones', indicaciones }, 'Indicaciones guardadas')}
              >
                <Save aria-hidden /> Guardar indicaciones
              </Button>
            </TarjetaCuerpo>
          </Tarjeta>
          <Tarjeta>
            <TarjetaCabecera titulo="Motivo" descripcion="Solo se ve aquí: no sale en correos ni en «Mis sustituciones»." />
            <TarjetaCuerpo className="space-y-3">
              <Selector aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                {CFG.motivos.map((m) => (
                  <option key={m.clave} value={m.clave}>
                    {m.nombre}
                  </option>
                ))}
              </Selector>
              {(motivoInfo?.pideNota || nota) && <Input aria-label="Nota" placeholder="Nota corta" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />}
              <Button
                variant="outline"
                disabled={!cambioMotivo || (Boolean(motivoInfo?.pideNota) && !nota.trim())}
                cargando={ocupado === 'motivo'}
                onClick={() => void cambiar('motivo', { accion: 'motivo', motivo, nota: nota || null }, 'Motivo guardado')}
              >
                <Save aria-hidden /> Guardar motivo
              </Button>
            </TarjetaCuerpo>
          </Tarjeta>
          <Tarjeta>
            <TarjetaCabecera titulo="Fechas" descripcion="Al acortar, las horas que quedan fuera se quitan. Al alargar, añade luego sus horas." />
            <TarjetaCuerpo className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Desde" id="f-desde">
                  <Input
                    id="f-desde"
                    type="date"
                    value={desde}
                    onChange={(e) => {
                      setDesde(e.target.value);
                      if (hasta < e.target.value) setHasta(e.target.value);
                    }}
                  />
                </Campo>
                <Campo etiqueta="Hasta" id="f-hasta">
                  <Input id="f-hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
                </Campo>
              </div>
              {quedanFuera > 0 ? (
                <ConfirmarEnLinea
                  etiqueta="Cambiar fechas"
                  icono={<CalendarRange aria-hidden />}
                  variante="outline"
                  pregunta={`Se quitan ${quedanFuera === 1 ? '1 hora' : `${quedanFuera} horas`}. ¿Seguro?`}
                  confirmar="Cambiar"
                  onConfirmar={() => cambiar('fechas', { accion: 'fechas', desde, hasta, avisar }, 'Fechas cambiadas')}
                />
              ) : (
                <Button
                  variant="outline"
                  disabled={desde === a.desde && hasta === a.hasta}
                  cargando={ocupado === 'fechas'}
                  onClick={() => void cambiar('fechas', { accion: 'fechas', desde, hasta, avisar }, 'Fechas cambiadas')}
                >
                  <CalendarRange aria-hidden /> Cambiar fechas
                </Button>
              )}
            </TarjetaCuerpo>
          </Tarjeta>
          <Tarjeta>
            <TarjetaCabecera titulo="Anular la ausencia" descripcion="Si al final viene. No se borra: deja de contar." />
            <TarjetaCuerpo>
              <ConfirmarEnLinea
                etiqueta="Anular ausencia"
                icono={<Ban aria-hidden />}
                variante="destructive"
                peligro
                pregunta={avisar && avisados > 0 ? `Se avisará a ${avisados + 1} personas de que ya no hace falta.` : '¿Anularla?'}
                confirmar="Anular"
                onConfirmar={() => cambiar('anular', { accion: 'anular', avisar }, 'Ausencia anulada')}
              />
            </TarjetaCuerpo>
          </Tarjeta>
        </div>
      )}

      {a.nota && anulada && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nota: {a.nota}</p>}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Apuntada por {a.creadaPorEmail}
        {a.anuladaPorEmail ? ` · anulada por ${a.anuladaPorEmail}` : ''}
      </p>
    </div>
  );
}
