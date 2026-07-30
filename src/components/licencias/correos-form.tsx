'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, ChevronDown, Link2, Loader2, Send, Trash2, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cursoLabel, varsDeFamilia, VARIABLES_FAMILIA } from '@/lib/licencias';

type Modo = 'familias' | 'alumnos';
type Grupo = 'faltan' | 'tienen';

export interface ClaseOpt {
  curso: string;
  letra: string | null;
}

interface Props {
  clases: ClaseOpt[];
  deadline: string | null;
  academicYear: string;
  baseUrl: string;
}

const SAMPLE_ALUMNO = { nombre: 'María', apellidos: 'García López', curso: '1ESO' };
const SAMPLE_FAMILIA = {
  tutorNombre: 'Ana López',
  hijos: [
    { nombre: 'María', curso: '1ESO' },
    { nombre: 'Marc', curso: '4ESO' },
  ],
};

interface Plantilla {
  id: string;
  nombre: string;
  subject: string;
  body: string;
  modo?: Modo;
}

// Plantillas de fábrica: editables tras cargarlas; los cambios se pueden guardar como propias.
const PREDEFINIDAS: (Omit<Plantilla, 'id'> & { modo: Modo })[] = [
  {
    modo: 'familias',
    nombre: '📣 Se abre el plazo (con enlace)',
    subject: 'Licencias digitales {curso_escolar} — ya podéis hacer el pedido',
    body:
      'Hola {tutor}:\n\n' +
      'Se abre el periodo para solicitar las licencias digitales del curso {curso_escolar} de {hijos}.\n\n' +
      'El plazo termina el {fecha_limite}. Pasada esa fecha cerramos el pedido y no podremos garantizar las licencias.\n\n' +
      'Con el botón de aquí abajo entráis directamente a vuestro formulario: no hace falta DNI ni contraseña, y desde el mismo enlace podéis pedir las de todos vuestros hijos/as.\n\n' +
      'Las licencias digitales no son obligatorias: marcad solo las que queráis solicitar.\n\n' +
      'Gracias,',
  },
  {
    modo: 'familias',
    nombre: '🔔 Recordatorio (falta su pedido)',
    subject: 'Licencias digitales de {hijos} — falta vuestro pedido',
    body:
      'Hola {tutor}:\n\n' +
      'Todavía no hemos recibido el pedido de licencias digitales de {hijos} para el curso {curso_escolar}.\n\n' +
      'Podéis hacerlo en un par de minutos con el botón de abajo (el enlace es vuestro, no hace falta ningún dato).\n\n' +
      'El plazo termina el {fecha_limite}. Si ya lo habéis hecho estos días, ignorad este correo.\n\n' +
      'Gracias,',
  },
  {
    modo: 'familias',
    nombre: '⏰ Últimos días',
    subject: '⏰ Últimos días para las licencias digitales de {hijos}',
    body:
      'Hola {tutor}:\n\n' +
      'El plazo para pedir las licencias digitales de {hijos} termina el {fecha_limite}. Después del cierre no podremos garantizar el pedido.\n\n' +
      'Se hace en dos minutos con el botón de abajo.\n\n' +
      'Gracias,',
  },
  {
    modo: 'alumnos',
    nombre: 'Recordatorio: falta tu pedido',
    subject: 'Licencias digitales de {nombre} — falta vuestro pedido',
    body:
      'Hola,\n\nOs recordamos que todavía no hemos recibido el pedido de licencias digitales de {nombre} ({curso}) para el próximo curso.\n\nPodéis hacerlo en un par de minutos desde:\nhttps://tools.consolacionburriana.com/licencias\n\nSi ya lo habéis hecho estos días, ignorad este correo.\n\nGracias,\nColegio Consolación · Burriana',
  },
  {
    modo: 'alumnos',
    nombre: 'Últimos días de plazo',
    subject: '⏰ Últimos días: licencias digitales de {nombre}',
    body:
      'Hola,\n\nEl plazo para pedir las licencias digitales de {nombre} ({curso}) está a punto de terminar. Después del cierre no podremos garantizar el pedido.\n\nSe hace en 2 minutos:\nhttps://tools.consolacionburriana.com/licencias\n\nGracias,\nColegio Consolación · Burriana',
  },
];

const claseKey = (c: ClaseOpt) => `${c.curso}|${c.letra ?? ''}`;

interface CountFamilias {
  count: number;
  alumnos: number;
  hijosAlcanzados: number;
  sinCorreo: { nombre: string; apellidos: string; curso: string }[];
  sinEnlaceCentral: number;
}

export function CorreosForm({ clases, deadline, academicYear, baseUrl }: Props) {
  const [modo, setModo] = useState<Modo>('familias');
  const [grupo, setGrupo] = useState<Grupo>('faltan');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [soloFaltan, setSoloFaltan] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<CountFamilias | null>(null);
  const [verSinCorreo, setVerSinCorreo] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('Hola,\n\n');
  const [testEmail, setTestEmail] = useState('');
  const [soloEmail, setSoloEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const clasesElegidas = useMemo(
    () => clases.filter((c) => seleccion.has(claseKey(c))).map(({ curso, letra }) => ({ curso, letra })),
    [clases, seleccion],
  );
  const cursos = useMemo(() => [...new Set(clases.map((c) => c.curso))].sort(), [clases]);

  // Vista previa con datos de ejemplo: mismas variables y mismo formato que el envío real.
  const varsPreview = useMemo<Record<string, string>>(
    () =>
      modo === 'familias'
        ? varsDeFamilia({
            tutorNombre: SAMPLE_FAMILIA.tutorNombre,
            hijos: SAMPLE_FAMILIA.hijos,
            enlace: `${baseUrl}/licencias?t=tok_ejemplo`,
            deadline,
            academicYear,
          })
        : { nombre: SAMPLE_ALUMNO.nombre, apellidos: SAMPLE_ALUMNO.apellidos, curso: cursoLabel(SAMPLE_ALUMNO.curso) },
    [modo, baseUrl, deadline, academicYear],
  );

  const fillSample = (t: string) =>
    (t ?? '').replace(/\{(\w+)\}/g, (m, k: string) => varsPreview[k.toLowerCase()] ?? m);

  useEffect(() => {
    fetch('/api/licencias/admin/plantillas')
      .then((r) => r.json())
      .then((d) => setPlantillas(d.plantillas ?? []))
      .catch(() => {});
  }, []);

  // Recuento de destinatarios: se rehace al cambiar modo, grupo, clases o filtro.
  useEffect(() => {
    const handle = setTimeout(() => {
      setCount(null);
      setDetalle(null);
      fetch('/api/licencias/admin/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'count', modo, grupo, clases: clasesElegidas, soloFaltan }),
      })
        .then((r) => r.json())
        .then((d) => {
          setCount(d.count ?? 0);
          setDetalle(modo === 'familias' ? (d as CountFamilias) : null);
        })
        .catch(() => setCount(0));
    }, 250);
    return () => clearTimeout(handle);
  }, [modo, grupo, clasesElegidas, soloFaltan]);

  function cargarPlantilla(p: { subject: string; body: string }) {
    setSubject(p.subject);
    setBody(p.body);
  }

  async function guardarComoPlantilla() {
    const nombre = prompt('Nombre de la plantilla:');
    if (!nombre?.trim()) return;
    setGuardandoPlantilla(true);
    try {
      const existente = plantillas.find((p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase());
      const res = await fetch('/api/licencias/admin/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: existente?.id, nombre: nombre.trim(), subject, body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPlantillas((prev) => [d.plantilla, ...prev.filter((p) => p.id !== d.plantilla.id)]);
      toast.success(existente ? 'Plantilla actualizada' : 'Plantilla guardada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  async function borrarPlantilla(p: Plantilla) {
    if (!confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
    const res = await fetch('/api/licencias/admin/plantillas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    });
    if (res.ok) setPlantillas((prev) => prev.filter((x) => x.id !== p.id));
  }

  function insertVar(v: string) {
    setBody((b) => b + `{${v}}`);
  }

  function toggleClase(k: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  }

  function toggleCurso(curso: string) {
    const claves = clases.filter((c) => c.curso === curso).map(claseKey);
    setSeleccion((prev) => {
      const s = new Set(prev);
      const todas = claves.every((k) => s.has(k));
      for (const k of claves) {
        if (todas) s.delete(k);
        else s.add(k);
      }
      return s;
    });
  }

  async function enviarPrueba() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch('/api/licencias/admin/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'test', modo, grupo, clases: clasesElegidas, soloFaltan, subject, body, testEmail }),
      });
      const d = await r.json();
      setMsg(r.ok ? (d.status === 'sent' ? `Prueba enviada a ${testEmail}` : `No se pudo enviar (${d.status})`) : d.error);
    } finally {
      setBusy(false);
    }
  }

  async function enviarSoloA() {
    if (!soloEmail.trim()) return;
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch('/api/licencias/admin/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'send',
          modo,
          clases: clasesElegidas,
          soloFaltan,
          subject,
          body,
          soloEmail: soloEmail.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) setMsg(d.error ?? 'Error');
      else if (d.skipped) setMsg('Resend no está configurado (no se envió nada).');
      else setMsg(`Enviado de verdad a ${soloEmail.trim()} (${d.sent} correo).`);
    } finally {
      setBusy(false);
    }
  }

  async function enviarReal() {
    setMsg(null);
    setBusy(true);
    setConfirming(false);
    try {
      const r = await fetch('/api/licencias/admin/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'send', modo, grupo, clases: clasesElegidas, soloFaltan, subject, body }),
      });
      const d = await r.json();
      if (!r.ok) setMsg(d.error ?? 'Error');
      else if (d.skipped) setMsg('Resend no está configurado (no se envió nada).');
      else
        setMsg(
          `Enviados ${d.sent} · errores ${d.errors}` +
            (d.tokensNuevos ? ` · ${d.tokensNuevos} enlaces nuevos generados` : ''),
        );
    } finally {
      setBusy(false);
    }
  }

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium cursor-pointer ${
      activo
        ? 'bg-blue-600 text-white'
        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
    }`;

  const variables = modo === 'familias' ? VARIABLES_FAMILIA : (['nombre', 'apellidos', 'curso'] as const);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">¿A quién escribimos?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                v: 'familias' as Modo,
                icono: <Link2 className="h-4 w-4" />,
                titulo: 'A las familias, con enlace',
                desc: 'Al correo de los tutores de Educamos. Cada familia recibe UN correo con su enlace: entra sin DNI y ve a todos sus hijos.',
              },
              {
                v: 'alumnos' as Modo,
                icono: <Users className="h-4 w-4" />,
                titulo: 'Al correo del alumno',
                desc: 'El envío clásico: un correo por alumno a su dirección, sin enlace personal.',
              },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setModo(o.v)}
              className={`rounded-xl border p-3 text-left cursor-pointer ${
                modo === o.v
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
              }`}
            >
              <p
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  modo === o.v ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                {o.icono} {o.titulo}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {modo === 'familias' ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cursos y clases</p>
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                className="text-xs text-zinc-400 underline hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                Todas ({clases.length} clases)
              </button>
            </div>
            <div className="space-y-2">
              {cursos.map((curso) => {
                const delCurso = clases.filter((c) => c.curso === curso);
                const todas = delCurso.every((c) => seleccion.has(claseKey(c)));
                return (
                  <div key={curso} className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => toggleCurso(curso)} className={chip(todas)}>
                      {cursoLabel(curso)}
                    </button>
                    {delCurso.length > 1 &&
                      delCurso.map((c) => (
                        <button
                          key={claseKey(c)}
                          type="button"
                          onClick={() => toggleClase(claseKey(c))}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer ${
                            seleccion.has(claseKey(c))
                              ? 'bg-blue-500 text-white'
                              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {c.letra ?? '—'}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Sin nada marcado se escribe a <strong>todas las familias de la campaña</strong>. Pulsa el curso para
              marcarlo entero o una letra para una clase concreta.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={soloFaltan}
              onChange={(e) => setSoloFaltan(e.target.checked)}
              className="mt-0.5"
            />
            Solo familias con algún hijo/a <strong>sin pedido</strong>
          </label>

          <div className="rounded-lg bg-zinc-50 p-2.5 text-sm dark:bg-zinc-800/50">
            {count === null || !detalle ? (
              <span className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculando destinatarios…
              </span>
            ) : (
              <div className="space-y-1">
                <p className="text-zinc-700 dark:text-zinc-200">
                  <strong>{detalle.count} familias</strong> · {detalle.hijosAlcanzados} alumnos alcanzados de{' '}
                  {detalle.alumnos} en la selección
                </p>
                {detalle.sinCorreo.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setVerSinCorreo((v) => !v)}
                    className="flex items-center gap-1 text-xs text-amber-700 underline dark:text-amber-400 cursor-pointer"
                  >
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {detalle.sinCorreo.length} alumnos sin correo de tutor (no reciben enlace)
                    <ChevronDown className={`h-3 w-3 transition-transform ${verSinCorreo ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {verSinCorreo && (
                  <ul className="max-h-40 overflow-y-auto text-xs text-zinc-500">
                    {detalle.sinCorreo.map((a, i) => (
                      <li key={i}>
                        {a.curso} · {a.apellidos}, {a.nombre}
                      </li>
                    ))}
                  </ul>
                )}
                {detalle.sinEnlaceCentral > 0 && (
                  <p className="text-xs text-zinc-400">
                    {detalle.sinEnlaceCentral} alumnos de la campaña no están enlazados a la BBDD central (sin tutores
                    localizables).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Destinatarios</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setGrupo('faltan')} className={chip(grupo === 'faltan')}>
              Quienes faltan (sin pedido)
            </button>
            <button type="button" onClick={() => setGrupo('tienen')} className={chip(grupo === 'tienen')}>
              Quienes ya tienen pedido
            </button>
            <span className="ml-auto self-center text-sm text-zinc-400">
              {count === null ? '…' : `${count} destinatarios`}
            </span>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Plantillas</p>
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINIDAS.filter((p) => p.modo === modo).map((p) => (
            <button
              key={p.nombre}
              type="button"
              onClick={() => cargarPlantilla(p)}
              className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 cursor-pointer"
            >
              {p.nombre}
            </button>
          ))}
          {plantillas.map((p) => (
            <span key={p.id} className="inline-flex items-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => cargarPlantilla(p)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              >
                {p.nombre}
              </button>
              <button
                type="button"
                onClick={() => void borrarPlantilla(p)}
                aria-label={`Borrar plantilla ${p.nombre}`}
                className="px-1.5 py-1.5 text-zinc-400 hover:text-red-500 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => void guardarComoPlantilla()}
            disabled={guardandoPlantilla || !subject || !body}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
          >
            <BookmarkPlus className="h-3 w-3" /> Guardar actual
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Carga una plantilla, personalízala a tu gusto y (si quieres) guárdala para la próxima. Se comparten entre
          gestores.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Asunto</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mensaje</label>
          <div className="flex flex-wrap justify-end gap-1">
            {variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />
        {modo === 'familias' && (
          <p className="mt-1 text-xs text-zinc-400">
            El botón de acceso se añade solo al final del correo (con el enlace de cada familia). `{'{enlace}'}` sirve
            para ponerlo también dentro del texto.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Vista previa</p>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {fillSample(subject) || '(sin asunto)'}
          </p>
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{fillSample(body)}</p>
          {modo === 'familias' && (
            <p className="mt-3">
              <span className="inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                Entrar y pedir las licencias
              </span>
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            —<br />Colegio Consolación · Burriana
          </p>
        </div>
        {modo === 'familias' && (
          <p className="mt-1 text-xs text-zinc-400">
            Ejemplo con una familia de dos hijos. En el envío real cada correo lleva los nombres y el enlace de esa
            familia.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="correo para prueba (a ti)"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={enviarPrueba}
            disabled={busy || !testEmail || !subject || !body}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer"
          >
            Enviar prueba
          </button>
        </div>
        {modo === 'familias' && (
          <>
            <p className="text-xs text-zinc-400">
              La prueba usa la primera familia de la selección y su <strong>enlace real</strong>: si lo pulsas, entrarás
              a su formulario. Es para comprobar que todo funciona.
            </p>
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <input
                type="email"
                value={soloEmail}
                onChange={(e) => setSoloEmail(e.target.value)}
                placeholder="enviar de verdad solo a esta familia"
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={enviarSoloA}
                disabled={busy || !soloEmail || !subject || !body}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                Enviar a una
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Para estrenar con una familia de confianza antes del masivo. El correo tiene que estar en la selección de
              arriba.
            </p>
          </>
        )}
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy || !subject || !body || !count}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar a {count ?? 0} {modo === 'familias' ? 'familias' : 'destinatarios'}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-500/10">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            ¿Enviar de verdad a {count} {modo === 'familias' ? 'familias' : 'correos'}?
          </span>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={enviarReal} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 cursor-pointer">
            Sí, enviar
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-zinc-600 dark:text-zinc-300">{msg}</p>}
    </div>
  );
}
