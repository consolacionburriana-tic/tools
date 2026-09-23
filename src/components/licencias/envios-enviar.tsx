'use client';

// Mandar los correos. Por defecto **uno por licencia** (mejor trazabilidad al buscarlo luego
// en el buzón), con opción de fusionar en uno por alumno.
//
// El envío va por tandas de 80 desde el navegador con su barra de progreso, no en una sola
// llamada: la API de Gmail manda de uno en uno a ~2,5 correos/segundo, así que un masivo de
// 300 no cabe en el `maxDuration` de una función. Cada tanda marca lo suyo en cuanto sale, o
// sea que cortar por la mitad no reenvía nada de lo ya entregado.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, Loader2, Save, Send, TestTube2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { VARIABLES_LICENCIA, type Destino, type LicenciaFila, type TipoLicencia } from '@/lib/licencias-envios';

/** Mismo tope que la ruta: ~80 correos ≈ 32 s de Gmail, dentro del maxDuration de 60. */
const TANDA = 80;
/** Aviso de cuota: Workspace corta sobre los 2.000 mensajes/día por buzón. */
const AVISO_CUOTA = 1200;

interface Plantilla {
  id: string;
  nombre: string;
  subject: string;
  body: string;
}

interface Preset {
  clave: string;
  nombre: string;
  subject: string;
  body: string;
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tipo: TipoLicencia;
  destino: Destino;
  /** Las licencias listas para enviar que se han elegido, en el orden de la tabla. */
  seleccionadas: LicenciaFila[];
  /** Cuántas filas hay a la vista con el filtro de ahora (para el aviso de confirmación). */
  aLaVista: number;
  /** De esas, cuántas están listas para enviar. */
  listasALaVista: number;
  /** Si lo elegido viene de marcar filas a mano o es «todo lo que está listo a la vista». */
  porSeleccion: boolean;
  /** Reenvío explícito de licencias ya marcadas como enviadas (mismo código, otro correo). */
  forzar?: boolean;
  presets: Preset[];
  onHecho: () => void | Promise<void>;
}

export function EnviosEnviar({
  abierto,
  onCerrar,
  tipo,
  destino,
  seleccionadas,
  aLaVista,
  listasALaVista,
  porSeleccion,
  forzar = false,
  presets,
  onHecho,
}: Props) {
  const preset = presets.find((p) => p.clave === tipo) ?? presets[0];
  const [asunto, setAsunto] = useState(preset?.subject ?? '');
  const [cuerpo, setCuerpo] = useState(preset?.body ?? '');
  const [fusionar, setFusionar] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [previa, setPrevia] = useState<{ html: string; asunto: string; para: string } | null>(null);
  const [ocupado, setOcupado] = useState<null | 'previa' | 'prueba' | 'envio' | 'guardar'>(null);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  /** Tope de licencias de esta tacada. `null` = todas las elegidas. */
  const [tope, setTope] = useState<number | null>(null);

  // Al cambiar de pestaña (pago ↔ banco) hace falta proponer la plantilla de ese tipo. No se
  // hace con un efecto que pise el estado: la pantalla monta este diálogo con `key={tipo}`, así
  // que React lo recrea entero y el `useState` de arriba arranca ya con la plantilla buena. De
  // paso, lo que se haya editado sobrevive a cerrar y volver a abrir dentro del mismo tipo.
  /**
   * Mientras se está enviando, el navegador pregunta antes de cerrar. No es solo comodidad: al
   * cerrar la pestaña se cortan las tandas que falten, y aunque eso NUNCA marca como enviado
   * nada que no haya salido (el marcado va después de que Gmail acepte el correo, uno a uno),
   * sí deja el trabajo a medias sin que nadie se entere.
   */
  useEffect(() => {
    if (ocupado !== 'envio') return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [ocupado]);

  useEffect(() => {
    if (!abierto) return;
    fetch('/api/licencias/admin/plantillas?contexto=licencias')
      .then((r) => r.json())
      .then((d) => setPlantillas(d.plantillas ?? []))
      .catch(() => setPlantillas([]));
  }, [abierto]);

  const cuentaCorreos = useCallback(
    (ls: LicenciaFila[]) => (fusionar ? new Set(ls.map((l) => `${l.studentId}|${l.destinatario}`)).size : ls.length),
    [fusionar],
  );

  /**
   * Lo que sale de verdad en esta tacada. El tope corta por licencias, pero **fusionando corta
   * por alumno**: partir a un alumno por la mitad le mandaría dos correos, que es justo lo que
   * se quería evitar al fusionar.
   */
  const aEnviar = useMemo(() => {
    if (tope === null || tope >= seleccionadas.length) return seleccionadas;
    if (!fusionar) return seleccionadas.slice(0, Math.max(0, tope));
    const salida: LicenciaFila[] = [];
    const vistos = new Set<string>();
    for (const l of seleccionadas) {
      const k = `${l.studentId}|${l.destinatario}`;
      if (!vistos.has(k) && salida.length >= tope) break;
      vistos.add(k);
      salida.push(l);
    }
    return salida;
  }, [seleccionadas, tope, fusionar]);

  // Cuántos CORREOS van a salir, que no es lo mismo que cuántas licencias.
  const correos = useMemo(() => cuentaCorreos(aEnviar), [aEnviar, cuentaCorreos]);

  async function llamar(accion: 'previsualizar' | 'prueba' | 'enviar', ids: string[]) {
    const res = await fetch('/api/licencias/admin/licencias/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, tipo, ids, asunto, cuerpo, fusionar, destino, forzar }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Error');
    return data;
  }

  async function verPrevia() {
    setOcupado('previa');
    try {
      const d = await llamar('previsualizar', [seleccionadas[0].id]);
      setPrevia({ html: d.html, asunto: d.asunto, para: d.para });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido generar la vista previa');
    } finally {
      setOcupado(null);
    }
  }

  async function prueba() {
    setOcupado('prueba');
    try {
      const d = await llamar('prueba', [seleccionadas[0].id]);
      toast.success(`Prueba enviada a ${d.para}. No se ha marcado ninguna licencia.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido enviar la prueba');
    } finally {
      setOcupado(null);
    }
  }

  async function enviar() {
    setConfirmando(false);
    setOcupado('envio');
    // Las tandas se parten por ALUMNO cuando se fusiona: si un alumno quedara a caballo entre
    // dos tandas recibiría dos correos, que es justo lo que se quería evitar al fusionar.
    const tandas: string[][] = [];
    if (fusionar) {
      const porAlumno = new Map<string, string[]>();
      for (const l of aEnviar) {
        const k = `${l.studentId}|${l.destinatario}`;
        porAlumno.set(k, [...(porAlumno.get(k) ?? []), l.id]);
      }
      let actual: string[] = [];
      let correosEnTanda = 0;
      for (const ids of porAlumno.values()) {
        if (correosEnTanda >= TANDA) {
          tandas.push(actual);
          actual = [];
          correosEnTanda = 0;
        }
        actual.push(...ids);
        correosEnTanda++;
      }
      if (actual.length) tandas.push(actual);
    } else {
      for (let i = 0; i < aEnviar.length; i += TANDA) {
        tandas.push(aEnviar.slice(i, i + TANDA).map((l) => l.id));
      }
    }

    let enviados = 0;
    let fallidos = 0;
    setProgreso({ hechos: 0, total: correos });
    try {
      for (const ids of tandas) {
        try {
          const d = await llamar('enviar', ids);
          enviados += d.enviados ?? 0;
          fallidos += d.fallidos ?? 0;
        } catch (e) {
          fallidos += ids.length;
          toast.error(e instanceof Error ? e.message : 'Una tanda ha fallado');
        }
        setProgreso({ hechos: enviados + fallidos, total: correos });
      }
      haptic.success();
      if (fallidos) toast.warning(`${enviados} enviados · ${fallidos} con error (se pueden reintentar)`);
      else toast.success(`${enviados} correo(s) enviados`);
      await onHecho();
      if (!fallidos) onCerrar();
    } finally {
      setOcupado(null);
      setProgreso(null);
    }
  }

  async function guardarPlantilla() {
    const nombre = prompt('Nombre de la plantilla');
    if (!nombre) return;
    setOcupado('guardar');
    try {
      const res = await fetch('/api/licencias/admin/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, subject: asunto, body: cuerpo, contexto: 'licencias' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Error');
      setPlantillas((prev) => [d.plantilla, ...prev]);
      toast.success('Plantilla guardada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setOcupado(null);
    }
  }

  const sinCorreo = seleccionadas.filter((l) => !l.destinatario).length;

  return (
    <Dialog open={abierto} onOpenChange={(o) => (o ? null : onCerrar())}>
      <DialogContent className="max-h-[92vh] w-full max-w-[min(64rem,calc(100%-2rem))] overflow-y-auto sm:max-w-[min(64rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>
            {forzar ? 'Reenviar' : 'Enviar'} {aEnviar.length} licencia(s) · {correos} correo(s)
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.clave}
              type="button"
              onClick={() => {
                setAsunto(p.subject);
                setCuerpo(p.body);
              }}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {p.nombre}
            </button>
          ))}
          {plantillas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setAsunto(p.subject);
                setCuerpo(p.body);
              }}
              className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
            >
              {p.nombre}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-500">Asunto</label>
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Mensaje</label>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={12}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Variables: {VARIABLES_LICENCIA.map((v) => `{${v}}`).join(' · ')}. Donde escribas{' '}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{codigo}'}</code> sale el código en
              grande; si no lo pones, se añade al final igualmente. Puedes usar{' '}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">&lt;b&gt;</code> como en las plantillas de
              siempre.
            </p>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800 sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fusionar} onChange={(e) => setFusionar(e.target.checked)} />
            <span>
              Fusionar: <strong>un correo por alumno</strong>
              <span className="block text-xs text-zinc-500">
                Por defecto va uno por licencia, que es más fácil de buscar luego en el buzón.
              </span>
            </span>
          </label>
          <p className="text-xs text-zinc-500">
            Destinatario: <strong>{destino === 'familia' ? 'correo de la familia' : 'correo del alumno'}</strong> (se
            cambia en la barra de la pantalla).
            {sinCorreo > 0 && (
              <span className="mt-1 flex items-start gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {sinCorreo} sin dirección: esas no se mandan.
              </span>
            )}
          </p>
        </div>

        {correos > AVISO_CUOTA && (
          <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{correos} correos en una tacada.</strong> Google Workspace corta sobre los 2.000 mensajes al
              día por buzón, y el resto del día ya no sale nada de <code>licencias@</code>. Fusionando por alumno
              bajan mucho; si no, pon un tope al darle a Enviar y sigue mañana por donde lo dejaste (las ya
              enviadas no vuelven a salir).
            </span>
          </p>
        )}

        {progreso && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.round((progreso.hechos / Math.max(1, progreso.total)) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {progreso.hechos} de {progreso.total} correos
            </p>
          </div>
        )}

        {previa && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
            <p className="border-b px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
              <strong>Para:</strong> {previa.para} · <strong>Asunto:</strong> {previa.asunto}
            </p>
            <iframe title="Vista previa" srcDoc={previa.html} className="h-96 w-full rounded-b-xl bg-white" />
          </div>
        )}

        {confirmando && (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/5">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Repasa antes de mandar
            </p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
              {forzar && (
                <li className="text-amber-700 dark:text-amber-300">
                  Ya se había enviado antes: esto es un <strong>reenvío</strong> del mismo código.
                </li>
              )}
              <li>
                Pestaña <strong>{tipo === 'banco' ? 'Banco de libros (gratis)' : 'De pago'}</strong>, con el filtro
                de ahora mismo: <strong>{aLaVista}</strong> licencia(s) a la vista, de ellas{' '}
                <strong>{listasALaVista}</strong> listas para enviar.
              </li>
              <li>
                {porSeleccion ? (
                  <>
                    Has marcado <strong>{seleccionadas.length}</strong> a mano.
                  </>
                ) : (
                  <>
                    No has marcado ninguna fila, así que van <strong>las {seleccionadas.length} que están
                    listas a la vista</strong>. Si querías menos, marca las filas o pon un tope aquí abajo.
                  </>
                )}
              </li>
              <li className="font-medium text-emerald-800 dark:text-emerald-300">
                Van a salir <strong>{correos} correo(s)</strong> con <strong>{aEnviar.length} licencia(s)</strong>.
                {aEnviar.length < seleccionadas.length && (
                  <> Las otras {seleccionadas.length - aEnviar.length} se quedan como están, para otro momento.</>
                )}
              </li>
            </ul>

            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              Mandar solo las primeras
              <input
                type="number"
                min={1}
                max={seleccionadas.length}
                value={tope ?? seleccionadas.length}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setTope(!Number.isFinite(n) || n >= seleccionadas.length ? null : Math.max(1, n));
                }}
                className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              de {seleccionadas.length}
              {tope !== null && (
                <button
                  type="button"
                  onClick={() => setTope(null)}
                  className="text-xs text-blue-600 underline dark:text-blue-400"
                >
                  quitar el tope
                </button>
              )}
            </label>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              El envío se parte solo en tandas de {TANDA} correos con barra de progreso — eso es cosa del límite
              por segundo de Gmail, no un tope de cuántas puedes mandar. Cada licencia se marca como enviada{' '}
              <strong>en cuanto su correo sale</strong>, así que si esto se corta a medias, al repetirlo no se
              reenvía nada de lo ya entregado.
            </p>
          </div>
        )}

        <div className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-zinc-50 p-4 sm:flex-row sm:justify-end dark:border-zinc-800 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={confirmando ? () => setConfirmando(false) : onCerrar}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            <X className="mr-1 inline h-4 w-4" /> {confirmando ? 'Atrás' : 'Cerrar'}
          </button>
          <button
            type="button"
            onClick={guardarPlantilla}
            disabled={Boolean(ocupado)}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            <Save className="mr-1 inline h-4 w-4" /> Guardar plantilla
          </button>
          <button
            type="button"
            onClick={verPrevia}
            disabled={Boolean(ocupado) || !seleccionadas.length}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            {ocupado === 'previa' ? (
              <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-1 inline h-4 w-4" />
            )}
            Vista previa
          </button>
          <button
            type="button"
            onClick={prueba}
            disabled={Boolean(ocupado) || !seleccionadas.length}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            {ocupado === 'prueba' ? (
              <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="mr-1 inline h-4 w-4" />
            )}
            Prueba a mí
          </button>
          <button
            type="button"
            onClick={confirmando ? enviar : () => setConfirmando(true)}
            disabled={Boolean(ocupado) || !seleccionadas.length}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {ocupado === 'envio' ? (
              <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 inline h-4 w-4" />
            )}
            {confirmando
              ? `Sí, ${forzar ? 'reenviar' : 'mandar'} ${correos} correo(s)`
              : `${forzar ? 'Reenviar' : 'Enviar'} ${correos} correo(s)`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
