'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, CalendarClock, Link2, Loader2, Send, Trash2, TriangleAlert, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { AUDIENCIAS, VARIABLES_CORREO, type Audiencia } from '@/lib/evaluaciones';
import { PLANTILLAS_FABRICA } from '@/lib/evaluaciones-plantillas';
import { Segmentado } from '@/components/evaluaciones/ui';

interface Plantilla {
  id: string;
  nombre: string;
  audiencia: string;
  subject: string;
  body: string;
}

interface Props {
  formId: string;
  titulo: string;
  audiencia: Audiencia;
  estado: string;
  academicYear: string;
  enlace: string;
  personalizado: boolean;
  clasesElegidas: number;
}

interface Preview {
  total: number;
  sinCorreo: string[];
  yaRespondieron: number;
  personalizado: boolean;
  ejemplo: Record<string, string>;
}

interface Envio {
  id: string;
  estado: 'programado' | 'enviado' | 'cancelado';
  programadoPara: string | null;
  asunto: string;
  total: number;
  errores: number;
  soloPendientes: boolean;
  createdByEmail: string | null;
  createdAt: string;
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Valor para <input type="datetime-local"> en hora local: "2026-09-25T08:30". */
function aLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Atajos de lo que se programa de verdad: primera hora de mañana o del lunes. */
function atajos(ahora: number): { label: string; fecha: Date }[] {
  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  manana.setHours(8, 30, 0, 0);
  const lunes = new Date(ahora);
  lunes.setDate(lunes.getDate() + (((8 - lunes.getDay()) % 7) || 7));
  lunes.setHours(8, 30, 0, 0);
  const out = [{ label: 'Mañana 8:30', fecha: manana }];
  if (lunes.getTime() !== manana.getTime()) out.push({ label: 'El lunes 8:30', fecha: lunes });
  return out;
}

const ESTADO_ENVIO: Record<Envio['estado'], string> = {
  programado: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  enviado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelado: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
};

const ETAPAS = [
  { value: 'EI', label: 'Infantil' },
  { value: 'EP', label: 'Primaria' },
  { value: 'ESO', label: 'Secundaria' },
];

const inputCls =
  'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100';

export function EnviarPanel({
  formId,
  titulo,
  audiencia,
  estado,
  academicYear,
  enlace,
  personalizado,
  clasesElegidas,
}: Props) {
  // Arranca con la primera plantilla de fábrica de la audiencia: cero clics para el caso normal.
  const inicial = PLANTILLAS_FABRICA.find((p) => p.audiencia === audiencia);
  const [subject, setSubject] = useState(inicial?.subject ?? '');
  const [body, setBody] = useState(inicial?.body ?? '');
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [etapas, setEtapas] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [guardadas, setGuardadas] = useState<Plantilla[]>([]);
  const [modo, setModo] = useState<'ahora' | 'programar'>('ahora');
  const [cuando, setCuando] = useState('');
  const [abrirSola, setAbrirSola] = useState(true);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [cancelando, setCancelando] = useState<string | null>(null);

  // "Ahora" como estado (y no Date.now() en el render): se refresca cada medio minuto para
  // que los límites del selector y la validación no se queden viejos con la pestaña abierta.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const cuandoFecha = cuando ? new Date(cuando) : null;
  const cuandoValido =
    !!cuandoFecha &&
    !Number.isNaN(cuandoFecha.getTime()) &&
    cuandoFecha.getTime() > ahora + 60_000 &&
    cuandoFecha.getTime() < ahora + 29.5 * 864e5;
  // Enviar ya exige que esté abierta; programar vale también en borrador si se abre sola.
  const puedeEnviar =
    modo === 'ahora' ? estado === 'abierto' : cuandoValido && estado !== 'cerrado' && (estado === 'abierto' || abrirSola);

  function cargarEnvios() {
    fetch('/api/evaluaciones/admin/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId, accion: 'envios' }),
    })
      .then((r) => r.json())
      .then((d) => setEnvios(d.envios ?? []))
      .catch(() => {});
  }

  async function cancelarEnvio(id: string) {
    setCancelando(id);
    try {
      const res = await fetch('/api/evaluaciones/admin/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, accion: 'cancelar', envioId: id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'No se pudo cancelar');
      haptic.success();
      toast.success(d.noCancelables > 0 ? `Cancelado (${d.noCancelables} ya habían salido)` : 'Envío cancelado: no saldrá ningún correo');
      cargarEnvios();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setCancelando(null);
    }
  }

  const deFabrica = useMemo(() => PLANTILLAS_FABRICA.filter((p) => p.audiencia === audiencia), [audiencia]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => cargarEnvios(), [formId]);

  useEffect(() => {
    fetch('/api/evaluaciones/admin/plantillas-correo')
      .then((r) => r.json())
      .then((d) => setGuardadas(d.plantillas ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPreview(null);
      fetch('/api/evaluaciones/admin/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, accion: 'preview', soloPendientes, etapas }),
      })
        .then((r) => r.json())
        .then((d) => setPreview(d.error ? null : d))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(handle);
  }, [formId, soloPendientes, etapas]);

  const vars = preview?.ejemplo ?? { nombre: 'María', curso: '1ESO', titulo, enlace, curso_escolar: academicYear };
  const rellenar = (t: string) => (t ?? '').replace(/\{(\w+)\}/g, (m, k: string) => vars[k.toLowerCase()] ?? m);

  async function accion(tipo: 'test' | 'enviar' | 'programar') {
    setBusy(true);
    try {
      const res = await fetch('/api/evaluaciones/admin/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId,
          accion: tipo,
          subject,
          body,
          testEmail: testEmail.trim() || null,
          soloPendientes,
          etapas,
          programadoPara: tipo === 'programar' && cuandoFecha ? cuandoFecha.toISOString() : null,
          abrirSola,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'No se pudo enviar');
      haptic.success();
      toast.success(
        tipo === 'test'
          ? `Prueba enviada a ${d.destino}`
          : tipo === 'programar'
            ? `${d.enviados} correos programados para ${fmtFecha(d.programadoPara)}`
            : `Enviados ${d.enviados} correos`,
      );
      setConfirmando(false);
      if (tipo !== 'test') cargarEnvios();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function guardarPlantilla() {
    const nombre = prompt('Nombre de la plantilla:');
    if (!nombre?.trim()) return;
    const existente = guardadas.find((p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase());
    const res = await fetch('/api/evaluaciones/admin/plantillas-correo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: existente?.id, nombre: nombre.trim(), audiencia, subject, body }),
    });
    const d = await res.json();
    if (!res.ok) return void toast.error(d.error ?? 'No se pudo guardar');
    setGuardadas((prev) => [d.plantilla, ...prev.filter((p) => p.id !== d.plantilla.id)]);
    toast.success(existente ? 'Plantilla actualizada' : 'Plantilla guardada para todo el claustro');
  }

  async function borrarPlantilla(p: Plantilla) {
    if (!confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
    await fetch('/api/evaluaciones/admin/plantillas-correo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    });
    setGuardadas((prev) => prev.filter((x) => x.id !== p.id));
    toast.success('Plantilla borrada');
  }

  return (
    <div className="anim-stagger space-y-4">
      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Responde: {AUDIENCIAS.find((a) => a.value === audiencia)?.label} · {academicYear} · estado {estado}
        </p>
        {estado !== 'abierto' && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Está en <strong>{estado}</strong>: ábrela antes de enviar o los enlaces no dejarán responder.
            {estado === 'borrador' && ' También puedes programar el envío y que se abra sola a esa hora.'}
          </p>
        )}
        {audiencia === 'alumnos' && clasesElegidas === 0 && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            No hay clases marcadas en los ajustes del formulario, así que no hay a quién enviárselo.{' '}
            <Link href={`/gestion/evaluaciones/${formId}`} className="underline">
              Elegir clases
            </Link>
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
          <Link2 className="h-3.5 w-3.5" />
          {personalizado
            ? 'Cada alumno/a recibirá su propio enlace (queda registrado internamente de quién viene cada respuesta).'
            : 'Todos reciben el mismo enlace, sin identificar a nadie.'}
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {preview === null ? (
              <Loader2 className="inline h-4 w-4 animate-spin text-zinc-400" />
            ) : (
              <>
                {preview.total} destinatario(s)
                {preview.yaRespondieron > 0 && <span className="text-zinc-500"> · {preview.yaRespondieron} ya han respondido</span>}
              </>
            )}
          </p>
        </div>

        {audiencia === 'alumnos' && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
            Solo a quien todavía no ha respondido
          </label>
        )}

        {audiencia === 'profesores' && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Etapas (vacío = todo el claustro)</p>
            <div className="flex flex-wrap gap-1.5">
              {ETAPAS.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEtapas((prev) => (prev.includes(e.value) ? prev.filter((x) => x !== e.value) : [...prev, e.value]))}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    etapas.includes(e.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              En profesorado no se puede filtrar por &quot;quien falta&quot;: la evaluación es 100 % anónima y no se guarda quién responde.
            </p>
          </div>
        )}

        {preview && preview.sinCorreo.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-amber-700 dark:text-amber-400">
              {preview.sinCorreo.length} sin correo (no reciben nada)
            </summary>
            <p className="mt-1 text-xs text-zinc-500">{preview.sinCorreo.slice(0, 40).join(' · ')}</p>
          </details>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Plantillas</span>
          {deFabrica.map((p) => (
            <button
              key={p.nombre}
              type="button"
              onClick={() => {
                setSubject(p.subject);
                setBody(p.body);
                toast.success('Plantilla cargada');
              }}
              className="rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {p.nombre}
            </button>
          ))}
          {guardadas
            .filter((p) => p.audiencia === audiencia)
            .map((p) => (
              <span key={p.id} className="inline-flex items-center overflow-hidden rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <button
                  type="button"
                  onClick={() => {
                    setSubject(p.subject);
                    setBody(p.body);
                    toast.success('Plantilla cargada');
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300"
                >
                  {p.nombre}
                </button>
                <button type="button" onClick={() => void borrarPlantilla(p)} className="px-1.5 py-1.5 text-blue-400 hover:text-rose-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          <button
            type="button"
            onClick={() => void guardarPlantilla()}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            <BookmarkPlus className="h-3.5 w-3.5" /> Guardar esta
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Asunto</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />

        <label className="mb-1 mt-3 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mensaje</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={`${inputCls} font-mono text-sm`} />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {VARIABLES_CORREO.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBody((b) => `${b}{${v}}`)}
              className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Vista previa</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{rellenar(subject)}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{rellenar(body)}</p>
          <div className="mt-3">
            <span className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Rellenar la evaluación</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 p-4 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Enviar una prueba a</label>
            <input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tu@consolacionburriana.com"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            disabled={busy || !subject.trim() || !body.trim()}
            onClick={() => void accion('test')}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Probar
          </button>
        </div>

        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Segmentado
            valor={modo}
            onChange={(m) => {
              setModo(m);
              setConfirmando(false);
              if (m === 'programar' && !cuando) setCuando(aLocal(atajos(ahora)[0].fecha));
            }}
            opciones={[
              { valor: 'ahora', label: 'Enviar ahora' },
              { valor: 'programar', label: 'Programar' },
            ]}
          />

          {/* Programar: la hora la guarda Resend y lo dispara él. Aquí no queda nada
             corriendo: por eso no hay cron, y por eso se puede cerrar la pestaña. */}
          {modo === 'programar' && (
            <div className="anim-up space-y-2.5 rounded-xl bg-violet-50/60 p-3 dark:bg-violet-500/5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={cuando}
                  min={aLocal(new Date(ahora + 5 * 60_000))}
                  max={aLocal(new Date(ahora + 29 * 864e5))}
                  onChange={(e) => setCuando(e.target.value)}
                  className={`${inputCls} !w-auto`}
                />
                {atajos(ahora).map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setCuando(aLocal(a.fecha))}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100 dark:bg-zinc-900 dark:text-violet-300 dark:ring-violet-500/30"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              {cuando && !cuandoValido && (
                <p className="text-xs text-rose-600 dark:text-rose-400">Elige una hora futura, como mucho a 30 días vista.</p>
              )}
              {estado === 'borrador' && (
                <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <input type="checkbox" className="mt-0.5" checked={abrirSola} onChange={(e) => setAbrirSola(e.target.checked)} />
                  <span>
                    <strong>Abrirla sola a esa hora.</strong> Sigue en borrador hasta entonces, así que nadie puede responder
                    antes de tiempo.
                  </span>
                </label>
              )}
              <p className="text-xs text-zinc-500">
                {audiencia === 'alumnos' && soloPendientes
                  ? 'Los destinatarios se calculan ahora: "quien falta" es quien falta en este momento.'
                  : 'Los destinatarios se calculan ahora, al programarlo.'}{' '}
                Se puede cancelar hasta la hora del envío.
              </p>
            </div>
          )}

          {confirmando ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                {modo === 'programar' && cuandoFecha ? (
                  <>
                    Se programarán <strong>{preview?.total ?? 0}</strong> correos para el{' '}
                    <strong>{fmtFecha(cuandoFecha.toISOString())}</strong>. ¿Seguimos?
                  </>
                ) : (
                  <>
                    Se enviarán <strong>{preview?.total ?? 0}</strong> correos. ¿Seguimos?
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accion(modo === 'programar' ? 'programar' : 'enviar')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-50 ${
                    modo === 'programar' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : modo === 'programar' ? (
                    <CalendarClock className="h-5 w-5" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  {modo === 'programar' ? 'Sí, programar' : 'Sí, enviar ahora'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !preview?.total || !puedeEnviar}
              onClick={() => setConfirmando(true)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-50 ${
                modo === 'programar' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {modo === 'programar' ? <CalendarClock className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              {modo === 'programar'
                ? `Programar ${preview?.total ?? 0} correo(s)${cuandoValido && cuandoFecha ? ` · ${fmtFecha(cuandoFecha.toISOString())}` : ''}`
                : `Enviar a ${preview?.total ?? 0} destinatario(s)`}
            </button>
          )}
        </div>
      </div>

      {envios.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Envíos</p>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {envios.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_ENVIO[e.estado]}`}>{e.estado}</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {fmtFecha(e.programadoPara ?? e.createdAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-500">
                  {e.total} correo(s){e.errores > 0 && ` · ${e.errores} con error`} · {e.asunto}
                </span>
                {e.estado === 'programado' && (
                  <button
                    type="button"
                    disabled={cancelando !== null}
                    onClick={() => void cancelarEnvio(e.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    {cancelando === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Cancelar envío
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
