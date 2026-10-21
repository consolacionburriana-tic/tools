'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, ChevronDown, Link2, Send, Trash2, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { useConfirmar } from '@/components/ui/confirmar';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Segmentado } from '@/components/ui/segmentado';
import { Skeleton } from '@/components/ui/skeleton';
import { Tarjeta, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { cursoLabel, varsDeFamilia, VARIABLES_FAMILIA } from '@/lib/licencias';
import { ordenCurso } from '@/lib/cursos';

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
// El enlace de 'alumnos' es genérico (sin token, a diferencia de 'familias') así que se
// interpola con el `baseUrl` real en vez de llevarlo escrito a fuego en el código.
function plantillasDeFabrica(baseUrl: string): (Omit<Plantilla, 'id'> & { modo: Modo })[] {
  return [
  {
    modo: 'familias',
    nombre: 'Se abre el plazo (con enlace)',
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
    nombre: 'Recordatorio (falta su pedido)',
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
    nombre: 'Últimos días',
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
      `Hola,\n\nOs recordamos que todavía no hemos recibido el pedido de licencias digitales de {nombre} ({curso}) para el próximo curso.\n\nPodéis hacerlo en un par de minutos desde:\n${baseUrl}/licencias\n\nSi ya lo habéis hecho estos días, ignorad este correo.\n\nGracias,\nColegio Consolación · Burriana`,
  },
  {
    modo: 'alumnos',
    nombre: 'Últimos días de plazo',
    subject: '⏰ Últimos días: licencias digitales de {nombre}',
    body:
      `Hola,\n\nEl plazo para pedir las licencias digitales de {nombre} ({curso}) está a punto de terminar. Después del cierre no podremos garantizar el pedido.\n\nSe hace en 2 minutos:\n${baseUrl}/licencias\n\nGracias,\nColegio Consolación · Burriana`,
  },
  ];
}

const claseKey = (c: ClaseOpt) => `${c.curso}|${c.letra ?? ''}`;

interface CountFamilias {
  count: number;
  alumnos: number;
  alumnosAlcanzados: number;
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
  const { confirmar, pedirTexto, dialogo } = useConfirmar();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const predefinidas = useMemo(() => plantillasDeFabrica(baseUrl), [baseUrl]);

  const clasesElegidas = useMemo(
    () => clases.filter((c) => seleccion.has(claseKey(c))).map(({ curso, letra }) => ({ curso, letra })),
    [clases, seleccion],
  );
  // Orden natural (infantil → primaria → ESO), no alfabético: si no, 1ESO se cuela entre los PRI.
  const cursos = useMemo(
    () => [...new Set(clases.map((c) => c.curso))].sort((a, b) => ordenCurso(a) - ordenCurso(b) || a.localeCompare(b, 'es')),
    [clases],
  );
  const todasLasClases = clases.length > 0 && clases.every((c) => seleccion.has(claseKey(c)));

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
    const nombre = await pedirTexto({
      titulo: 'Guardar como plantilla',
      descripcion: 'Si ya hay una con ese nombre, se actualiza. Se comparten entre gestores.',
      etiqueta: 'Nombre de la plantilla',
      boton: 'Guardar plantilla',
    });
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
    const si = await confirmar({ titulo: `¿Borrar la plantilla «${p.nombre}»?`, boton: 'Borrar la plantilla' });
    if (!si) return;
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
    const si = await confirmar({
      titulo: `¿Enviar de verdad ${count} correo${count === 1 ? '' : 's'}?`,
      descripcion: 'Salen ahora mismo y no se pueden recuperar. Si no lo has hecho, mándate antes una prueba.',
      boton: `Enviar ${count} correo${count === 1 ? '' : 's'}`,
      peligro: false,
    });
    if (!si) return;
    setMsg(null);
    setBusy(true);
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

  const variables = modo === 'familias' ? VARIABLES_FAMILIA : (['nombre', 'apellidos', 'curso'] as const);

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="correos-quien">
        <h2 id="correos-quien" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          ¿A quién escribimos?
        </h2>
        <Segmentado
          etiqueta="A quién escribimos"
          lleno
          valor={modo}
          onChange={setModo}
          opciones={[
            { valor: 'familias', etiqueta: 'A las familias, con enlace', icono: <Link2 /> },
            { valor: 'alumnos', etiqueta: 'Al correo del alumno', icono: <Users /> },
          ]}
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {modo === 'familias'
            ? 'Al correo de los tutores de Educamos. Cada familia recibe UN correo con su enlace: entra sin DNI y ve a todos sus hijos.'
            : 'El envío clásico: un correo por alumno a su dirección, sin enlace personal.'}
        </p>
      </section>

      {modo === 'familias' ? (
        <Tarjeta>
          <TarjetaCuerpo className="space-y-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Cursos y clases</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSeleccion(todasLasClases ? new Set() : new Set(clases.map(claseKey)))}
                >
                  {todasLasClases ? 'Quitar la selección' : `Marcar las ${clases.length} clases`}
                </Button>
              </div>
              <div className="space-y-2">
                {cursos.map((curso) => {
                  const delCurso = clases.filter((c) => c.curso === curso);
                  const todas = delCurso.every((c) => seleccion.has(claseKey(c)));
                  return (
                    <Filtros key={curso} etiqueta={`Clases de ${cursoLabel(curso)}`}>
                      <Filtro activo={todas} onClick={() => toggleCurso(curso)}>
                        {cursoLabel(curso)}
                      </Filtro>
                      {delCurso.length > 1 &&
                        delCurso.map((c) => (
                          <Filtro
                            key={claseKey(c)}
                            activo={seleccion.has(claseKey(c))}
                            onClick={() => toggleClase(claseKey(c))}
                            className="min-w-10 justify-center px-3"
                          >
                            {c.letra ?? '—'}
                          </Filtro>
                        ))}
                    </Filtros>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Sin nada marcado se escribe a <strong>todas las familias de la campaña</strong>. Pulsa el curso para
                marcarlo entero o una letra para una clase concreta.
              </p>
            </div>

            <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={soloFaltan}
                onChange={(e) => setSoloFaltan(e.target.checked)}
                className="mt-0.5 size-4 accent-blue-600"
              />
              <span>
                Solo familias con algún hijo/a <strong>pendiente</strong> (sin pedido y sin marcar como que no lo hará,
                igual que en Quién falta)
              </span>
            </label>

            <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50" aria-live="polite">
              {count === null || !detalle ? (
                <span className="flex flex-col gap-2">
                  <span className="sr-only">Calculando destinatarios…</span>
                  <Skeleton className="h-4 w-64 max-w-full" />
                </span>
              ) : (
                <div className="space-y-1">
                  <p className="text-zinc-800 tabular-nums dark:text-zinc-200">
                    <strong>
                      {detalle.count} correo{detalle.count === 1 ? '' : 's'}
                    </strong>{' '}
                    para {detalle.alumnosAlcanzados} alumno{detalle.alumnosAlcanzados === 1 ? '' : 's'} de{' '}
                    {detalle.alumnos} en la selección
                  </p>
                  {detalle.count > detalle.alumnosAlcanzados && (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      Salen más correos que alumnos porque se escribe a cada tutor con correo propio (padre y madre).
                    </p>
                  )}
                  {detalle.sinCorreo.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={verSinCorreo}
                      onClick={() => setVerSinCorreo((v) => !v)}
                      className="-ml-3 text-amber-800 dark:text-amber-300"
                    >
                      <TriangleAlert aria-hidden />
                      {detalle.sinCorreo.length} alumnos sin correo de tutor (no reciben enlace)
                      <ChevronDown aria-hidden className={verSinCorreo ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </Button>
                  )}
                  {verSinCorreo && (
                    <ul className="max-h-40 overflow-y-auto text-zinc-600 dark:text-zinc-400">
                      {detalle.sinCorreo.map((a, i) => (
                        <li key={i}>
                          {a.curso} · {a.apellidos}, {a.nombre}
                        </li>
                      ))}
                    </ul>
                  )}
                  {detalle.sinEnlaceCentral > 0 && (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      {detalle.sinEnlaceCentral} alumnos de la campaña no están enlazados a la BBDD central (sin tutores
                      localizables).
                    </p>
                  )}
                </div>
              )}
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
      ) : (
        <section className="space-y-2" aria-labelledby="correos-dest">
          <h2 id="correos-dest" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Destinatarios
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Segmentado
              etiqueta="Destinatarios"
              valor={grupo}
              onChange={setGrupo}
              opciones={[
                { valor: 'faltan', etiqueta: 'Quienes faltan' },
                { valor: 'tienen', etiqueta: 'Quienes ya tienen pedido' },
              ]}
            />
            <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
              {count === null ? 'Contando…' : `${count} destinatarios`}
            </span>
          </div>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="correos-plantillas">
        <h2 id="correos-plantillas" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Plantillas
        </h2>
        <div className="flex flex-wrap gap-2">
          {predefinidas
            .filter((p) => p.modo === modo)
            .map((p) => (
              <Button key={p.nombre} variant="outline" size="sm" onClick={() => cargarPlantilla(p)}>
                {p.nombre}
              </Button>
            ))}
          {plantillas.map((p) => (
            <span key={p.id} className="inline-flex items-center">
              <Button variant="outline" size="sm" className="rounded-r-none" onClick={() => cargarPlantilla(p)}>
                {p.nombre}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="-ml-px rounded-l-none text-zinc-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-300"
                onClick={() => void borrarPlantilla(p)}
                aria-label={`Borrar la plantilla ${p.nombre}`}
              >
                <Trash2 />
              </Button>
            </span>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void guardarComoPlantilla()}
            disabled={!subject || !body}
            cargando={guardandoPlantilla}
          >
            {!guardandoPlantilla && <BookmarkPlus aria-hidden />} Guardar la actual
          </Button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Carga una plantilla, personalízala a tu gusto y (si quieres) guárdala para la próxima. Se comparten entre
          gestores.
        </p>
      </section>

      <Campo etiqueta="Asunto" id="correo-asunto">
        <Input id="correo-asunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Campo>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label htmlFor="correo-mensaje" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Mensaje
          </label>
          <div className="flex flex-wrap justify-end gap-1" role="group" aria-label="Añadir una variable">
            {variables.map((v) => (
              <Button key={v} variant="secondary" size="sm" className="px-2.5 font-mono text-xs" onClick={() => insertVar(v)}>
                {`{${v}}`}
              </Button>
            ))}
          </div>
        </div>
        <Textarea id="correo-mensaje" value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
        {modo === 'familias' && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            El botón de acceso se añade solo al final del correo (con el enlace de cada familia). `{'{enlace}'}` sirve
            para ponerlo también dentro del texto.
          </p>
        )}
      </div>

      <section className="space-y-1.5" aria-labelledby="correos-previa">
        <h2 id="correos-previa" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Vista previa
        </h2>
        <Tarjeta className="p-4">
          <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {fillSample(subject) || '(sin asunto)'}
          </p>
          <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{fillSample(body)}</p>
          {modo === 'familias' && (
            <p className="mt-3">
              <span className="inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                Entrar y pedir las licencias
              </span>
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            —<br />
            Colegio Consolación · Burriana
          </p>
        </Tarjeta>
        {modo === 'familias' && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ejemplo con una familia de dos hijos. En el envío real cada correo lleva los nombres y el enlace de esa
            familia.
          </p>
        )}
      </section>

      <Tarjeta>
        <TarjetaCuerpo className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Correo para la prueba (a ti)"
              aria-label="Correo para la prueba"
              className="min-w-0 flex-1 basis-56"
            />
            <Button variant="outline" onClick={enviarPrueba} disabled={busy || !testEmail || !subject || !body}>
              Enviar prueba
            </Button>
          </div>
          {modo === 'familias' && (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                La prueba usa la primera familia de la selección y su <strong>enlace real</strong>: si lo pulsas,
                entrarás a su formulario. Es para comprobar que todo funciona.
              </p>
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <Input
                  type="email"
                  value={soloEmail}
                  onChange={(e) => setSoloEmail(e.target.value)}
                  placeholder="Enviar de verdad solo a esta familia"
                  aria-label="Correo de la única familia a la que enviar"
                  className="min-w-0 flex-1 basis-56"
                />
                <Button variant="outline" onClick={enviarSoloA} disabled={busy || !soloEmail || !subject || !body}>
                  Enviar a una
                </Button>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Para estrenar con una familia de confianza antes del masivo. El correo tiene que estar en la selección
                de arriba.
              </p>
            </>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      <Button size="lg" className="w-full" onClick={() => void enviarReal()} disabled={!subject || !body || !count} cargando={busy}>
        {!busy && <Send aria-hidden />}
        Enviar a {count ?? 0} {modo === 'familias' ? 'correos de familias' : 'destinatarios'}
      </Button>

      {msg && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300" role="status">
          {msg}
        </p>
      )}
      {dialogo}
    </div>
  );
}
