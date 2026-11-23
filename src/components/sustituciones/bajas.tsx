'use client';

// «Bajas» (docs/32, David 23-nov-2026): quién está de baja, desde cuándo, con qué alta prevista o
// real, por qué y quién la cubre. Es el sitio donde se gestionan las coberturas por baja: lo que viene
// de Educamos sale arriba («falta anotar la baja») para acogerlo y ponerle fechas. Mientras alguien
// está de baja no recibe sustituciones; con sustituto, además, desaparece del radar (su horario es
// de quien le sustituye).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ChevronDown, Pencil, Plus, UserRoundMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { CONFIGURACION } from '@/lib/configuracion';
import { nombreMotivoBaja, type EntradaBaja } from '@/lib/bajas';
import type { BajaFila, CoberturaSinBaja, DatosBajas } from '@/lib/bajas-server';
import { fechaCorta } from '@/lib/sustituciones';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Rotulo } from '@/components/ui/rotulo';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { pedir } from './comun';

const MOTIVOS = CONFIGURACION.sustituciones.motivosBaja;

/** Lo que se está editando: una baja nueva (con lo que venga de una cobertura) o una que ya existe. */
type Edicion = { id: string | null; inicial: Partial<EntradaBaja> } | null;

export function Bajas({ datos }: { datos: DatosBajas }) {
  const router = useRouter();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [verTerminadas, setVerTerminadas] = useState(false);
  const enCurso = datos.bajas.filter((b) => b.estado === 'en_curso');
  const proximas = datos.bajas.filter((b) => b.estado === 'proxima');
  const terminadas = datos.bajas.filter((b) => b.estado === 'terminada');

  function nueva(inicial: Partial<EntradaBaja> = {}) {
    setEdicion({ id: null, inicial });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editar(b: BajaFila) {
    setEdicion({
      id: b.id,
      inicial: { profeId: b.profeId, desde: b.desde, altaPrevista: b.altaPrevista, altaReal: b.altaReal, motivo: b.motivo, ampliable: b.ampliable, nota: b.nota, sustitutos: b.sustitutos.map((s) => ({ id: s.id, desde: s.desde })) },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function acoger(c: CoberturaSinBaja) {
    nueva({ profeId: c.titularId, desde: c.desde ?? datos.hoy, motivo: '', sustitutos: [{ id: c.sustitutoId, desde: c.desde }] });
  }

  const hecho = () => {
    setEdicion(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Mientras alguien está de baja no recibe sustituciones. Con sustituto, sus horas son de quien le sustituye, que recibe sustituciones como uno más; sin sustituto, sus horas se cubren con ausencias en «Nueva ausencia».
        </p>
        {!edicion && (
          <Button onClick={() => nueva()}>
            <Plus aria-hidden /> Nueva baja
          </Button>
        )}
      </div>

      {edicion && <FormularioBaja key={edicion.id ?? 'nueva'} id={edicion.id} inicial={edicion.inicial} datos={datos} onHecho={hecho} onCancelar={() => setEdicion(null)} />}

      {datos.sinBaja.length > 0 && (
        <Aviso tono="aviso" titulo={datos.sinBaja.length === 1 ? 'Una cobertura sin baja anotada' : `${datos.sinBaja.length} coberturas sin baja anotada`}>
          <p>Vienen de Educamos (o de Profesorado) sin las fechas de la baja. Acógelas para anotar desde cuándo, el alta y el motivo.</p>
          <ul className="mt-2 space-y-2">
            {datos.sinBaja.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1">
                  <strong className="font-semibold">{c.sustitutoNombre}</strong> cubre a <strong className="font-semibold">{c.titularNombre}</strong>
                  {c.desde ? ` desde el ${fechaCorta(c.desde)}` : ''}
                  {c.origen === 'educamos' ? ' · Educamos' : ''}
                </span>
                <Button variant="outline" size="sm" onClick={() => acoger(c)}>
                  Anotar la baja
                </Button>
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <section className="space-y-2" aria-labelledby="bajas-en-curso">
        <Rotulo as="h2" id="bajas-en-curso">De baja ahora</Rotulo>
        {enCurso.length === 0 ? (
          <Vacio icono={<UserRoundMinus />} titulo="Nadie está de baja">Apunta una con «Nueva baja».</Vacio>
        ) : (
          enCurso.map((b) => <TarjetaBaja key={b.id} b={b} hoy={datos.hoy} onEditar={() => editar(b)} onCambio={() => router.refresh()} />)
        )}
      </section>

      {proximas.length > 0 && (
        <section className="space-y-2" aria-labelledby="bajas-proximas">
          <Rotulo as="h2" id="bajas-proximas">Próximas</Rotulo>
          {proximas.map((b) => (
            <TarjetaBaja key={b.id} b={b} hoy={datos.hoy} onEditar={() => editar(b)} onCambio={() => router.refresh()} />
          ))}
        </section>
      )}

      {terminadas.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            aria-expanded={verTerminadas}
            onClick={() => setVerTerminadas((v) => !v)}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300"
          >
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', !verTerminadas && '-rotate-90')} />
            Terminadas ({terminadas.length})
          </button>
          {verTerminadas && terminadas.map((b) => <TarjetaBaja key={b.id} b={b} hoy={datos.hoy} onEditar={() => editar(b)} onCambio={() => router.refresh()} />)}
        </section>
      )}
    </div>
  );
}

function textoFechas(b: Pick<BajaFila, 'desde' | 'altaPrevista' | 'altaReal' | 'ampliable'>): string {
  const partes = [`Desde el ${fechaCorta(b.desde)}`];
  if (b.altaReal) partes.push(`alta el ${fechaCorta(b.altaReal)}`);
  else if (b.altaPrevista) partes.push(`alta prevista el ${fechaCorta(b.altaPrevista)}${b.ampliable ? ' (ampliable)' : ''}`);
  else partes.push('sin fecha de alta');
  return partes.join(' · ');
}

function TarjetaBaja({ b, hoy, onEditar, onCambio }: { b: BajaFila; hoy: string; onEditar: () => void; onCambio: () => void }) {
  const [alta, setAlta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const activos = b.sustitutos.filter((s) => s.activa);
  const terminada = b.estado === 'terminada';

  async function guardarAlta() {
    if (!alta) return;
    setGuardando(true);
    try {
      await pedir(`/api/sustituciones/admin/bajas/${b.id}`, { method: 'PATCH', body: { alta } });
      haptic.success();
      toast.success(`Alta de ${b.profeNombre} el ${fechaCorta(alta)}`);
      setAlta(null);
      onCambio();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    try {
      await pedir(`/api/sustituciones/admin/bajas/${b.id}`, { method: 'DELETE' });
      toast.success('Baja borrada');
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido borrar');
    }
  }

  return (
    <Tarjeta as="article" className="space-y-3 p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn('font-semibold text-zinc-900 dark:text-zinc-100', terminada && 'text-zinc-500 dark:text-zinc-400')}>{b.profeNombre}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            {terminada ? (
              <Estado tono="neutro">Ha vuelto</Estado>
            ) : activos.length > 0 ? (
              <Estado tono="ok">Con sustituto</Estado>
            ) : (
              <Estado tono="aviso">Sin sustituto</Estado>
            )}
            <Etiqueta>{nombreMotivoBaja(b.motivo)}</Etiqueta>
            <span>{textoFechas(b)}</span>
          </p>
          {activos.length > 0 && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              La cubre{' '}
              {activos.map((s, i) => (
                <span key={s.coberturaId}>
                  {i > 0 ? ' y ' : ''}
                  <strong className="font-semibold">{s.nombre}</strong>
                  {s.desde && s.desde > b.desde ? ` (desde el ${fechaCorta(s.desde)})` : ''}
                </span>
              ))}
              : hereda su horario y recibe sustituciones como uno más.
            </p>
          )}
          {!terminada && activos.length === 0 && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Sus horas se cubren con ausencias. No recibe sustituciones mientras dure.</p>
          )}
          {b.nota && <p className="text-sm text-zinc-500 dark:text-zinc-400">{b.nota}</p>}
        </div>
      </div>

      {b.porConfirmar && alta === null && (
        <Aviso tono="aviso" titulo={`El alta prevista era el ${fechaCorta(b.altaPrevista!)}`} accion={<Button variant="outline" size="sm" onClick={() => setAlta(b.altaPrevista!)}>Ha vuelto</Button>}>
          Sigue contando como baja hasta que anotes el alta. Si se ha ampliado, cambia el alta prevista.
        </Aviso>
      )}

      {alta !== null ? (
        <div className="flex flex-wrap items-end gap-2">
          <Campo etiqueta="Alta: primer día de vuelta" id={`alta-${b.id}`}>
            <Input id={`alta-${b.id}`} type="date" value={alta} min={b.desde} onChange={(e) => setAlta(e.target.value)} />
          </Campo>
          <Button cargando={guardando} disabled={!alta} onClick={() => void guardarAlta()}>
            <CalendarCheck aria-hidden /> Guardar el alta
          </Button>
          <Button variant="ghost" onClick={() => setAlta(null)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEditar}>
            <Pencil aria-hidden /> Editar
          </Button>
          {!b.altaReal && (
            <Button variant="outline" size="sm" onClick={() => setAlta(b.altaPrevista && b.altaPrevista <= hoy ? b.altaPrevista : hoy)}>
              <CalendarCheck aria-hidden /> Dar el alta
            </Button>
          )}
          <ConfirmarEnLinea etiqueta="Borrar" pregunta={`¿Borrar la baja de ${b.profeNombre}? Úsalo solo si se apuntó por error.`} confirmar="Sí, borrar" onConfirmar={borrar} />
        </div>
      )}
    </Tarjeta>
  );
}

function FormularioBaja({
  id,
  inicial,
  datos,
  onHecho,
  onCancelar,
}: {
  id: string | null;
  inicial: Partial<EntradaBaja>;
  datos: DatosBajas;
  onHecho: () => void;
  onCancelar: () => void;
}) {
  const [profeId, setProfeId] = useState(inicial.profeId ?? '');
  const [desde, setDesde] = useState(inicial.desde ?? datos.hoy);
  const [altaPrevista, setAltaPrevista] = useState(inicial.altaPrevista ?? '');
  const [altaReal, setAltaReal] = useState(inicial.altaReal ?? '');
  const [motivo, setMotivo] = useState(inicial.motivo ?? '');
  const [ampliable, setAmpliable] = useState(inicial.ampliable ?? false);
  const [nota, setNota] = useState(inicial.nota ?? '');
  const [sustitutos, setSustitutos] = useState<{ id: string; desde: string | null }[]>(inicial.sustitutos ?? []);
  const [nuevoSustituto, setNuevoSustituto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nombre = new Map(datos.profes.map((p) => [p.id, p.nombre]));
  const motivoInfo = MOTIVOS.find((m) => m.clave === motivo);

  function cambiarMotivo(v: string) {
    setMotivo(v);
    setAmpliable(Boolean(MOTIVOS.find((m) => m.clave === v)?.ampliable));
  }

  function anadirSustituto(v: string) {
    if (!v || sustitutos.some((s) => s.id === v)) return;
    setSustitutos((prev) => [...prev, { id: v, desde: null }]);
    setNuevoSustituto('');
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!profeId) return setError('Elige quién está de baja.');
    if (!motivo) return setError('Elige el motivo.');
    setGuardando(true);
    try {
      const body: EntradaBaja = {
        profeId,
        desde,
        altaPrevista: altaPrevista || null,
        altaReal: altaReal || null,
        motivo,
        ampliable,
        nota: nota.trim() || null,
        sustitutos: sustitutos.map((s) => ({ id: s.id, desde: s.desde || null })),
      };
      await pedir(id ? `/api/sustituciones/admin/bajas/${id}` : '/api/sustituciones/admin/bajas', { method: id ? 'PUT' : 'POST', body });
      haptic.success();
      toast.success(id ? 'Baja guardada' : 'Baja apuntada');
      onHecho();
    } catch (e) {
      haptic.warning();
      setError(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta as="section">
      <TarjetaCabecera
        titulo={id ? `Baja de ${nombre.get(profeId) ?? '—'}` : 'Nueva baja'}
        accion={
          <Button variant="ghost" size="sm" onClick={onCancelar} aria-label="Cerrar sin guardar">
            <X aria-hidden />
          </Button>
        }
      />
      <TarjetaCuerpo>
        <form onSubmit={guardar} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Quién está de baja" id="baja-profe">
              <Selector id="baja-profe" value={profeId} disabled={Boolean(id)} onChange={(e) => setProfeId(e.target.value)}>
                <option value="">Elige…</option>
                {datos.profes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Motivo" id="baja-motivo" ayuda="Solo lo ve quien tiene este módulo.">
              <Selector id="baja-motivo" value={motivo} onChange={(e) => cambiarMotivo(e.target.value)}>
                <option value="">Elige…</option>
                {MOTIVOS.map((m) => (
                  <option key={m.clave} value={m.clave}>
                    {m.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Primer día de baja" id="baja-desde" ayuda="Puede ser pasado o futuro.">
              <Input id="baja-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Campo>
            <div className="flex items-end pb-1">
              <Interruptor activo={ampliable} onChange={setAmpliable} etiqueta="Ampliable" descripcion="Se puede alargar más allá del alta prevista." />
            </div>
            <Campo etiqueta="Alta prevista" id="baja-prevista" opcional ayuda="La posible: no cierra la baja, te avisa cuando llegue.">
              <Input id="baja-prevista" type="date" value={altaPrevista} min={desde} onChange={(e) => setAltaPrevista(e.target.value)} />
            </Campo>
            <Campo etiqueta="Alta (segura)" id="baja-real" opcional ayuda="Primer día de vuelta. Desde ese día ya puede recibir sustituciones.">
              <Input id="baja-real" type="date" value={altaReal} min={desde} onChange={(e) => setAltaReal(e.target.value)} />
            </Campo>
          </div>
          {(motivoInfo?.pideNota || nota) && (
            <Campo etiqueta="Nota" id="baja-nota" opcional={!motivoInfo?.pideNota}>
              <Input id="baja-nota" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          )}

          <div className="space-y-2">
            <Rotulo as="h3">Quién la cubre</Rotulo>
            {sustitutos.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin sustituto: sus horas se cubren con ausencias del día a día.</p>
            ) : (
              <ul className="space-y-2">
                {sustitutos.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-end gap-2">
                    <p className="min-h-11 min-w-40 flex-1 content-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">{nombre.get(s.id) ?? '—'}</p>
                    <Campo etiqueta="Llega el" id={`llega-${s.id}`} opcional>
                      <Input id={`llega-${s.id}`} type="date" value={s.desde ?? ''} min={desde} onChange={(e) => setSustitutos((prev) => prev.map((x) => (x.id === s.id ? { ...x, desde: e.target.value || null } : x)))} />
                    </Campo>
                    <Button variant="ghost" onClick={() => setSustitutos((prev) => prev.filter((x) => x.id !== s.id))}>
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Campo etiqueta="Añadir sustituto" id="baja-sustituto" opcional ayuda="Hereda su horario mientras dure la baja (desde que llega).">
              <Selector id="baja-sustituto" value={nuevoSustituto} onChange={(e) => anadirSustituto(e.target.value)}>
                <option value="">Elige…</option>
                {datos.profes
                  .filter((p) => p.id !== profeId && !sustitutos.some((s) => s.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </Selector>
            </Campo>
          </div>

          {error && <Aviso tono="error">{error}</Aviso>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" cargando={guardando}>
              {id ? 'Guardar' : 'Apuntar la baja'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
          </div>
        </form>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}
