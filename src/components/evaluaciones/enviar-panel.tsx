'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Link2, Loader2, Send, Trash2, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { AUDIENCIAS, VARIABLES_CORREO, type Audiencia } from '@/lib/evaluaciones';
import { PLANTILLAS_FABRICA } from '@/lib/evaluaciones-email';

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

  const deFabrica = useMemo(() => PLANTILLAS_FABRICA.filter((p) => p.audiencia === audiencia), [audiencia]);

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

  async function accion(tipo: 'test' | 'enviar') {
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
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'No se pudo enviar');
      haptic.success();
      toast.success(tipo === 'test' ? `Prueba enviada a ${d.destino}` : `Enviados ${d.enviados} correos`);
      setConfirmando(false);
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Responde: {AUDIENCIAS.find((a) => a.value === audiencia)?.label} · {academicYear} · estado {estado}
        </p>
        {estado !== 'abierto' && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Está en <strong>{estado}</strong>: ábrela antes de enviar o los enlaces no dejarán responder.
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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

        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {confirmando ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                Se enviarán <strong>{preview?.total ?? 0}</strong> correos. ¿Seguimos?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void accion('enviar')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Sí, enviar ahora
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
              disabled={busy || !preview?.total || estado !== 'abierto'}
              onClick={() => setConfirmando(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-5 w-5" /> Enviar a {preview?.total ?? 0} destinatario(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
