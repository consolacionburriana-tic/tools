'use client';

// Paso 4 del estudio: generar el ZIP y **cerrar el círculo** — porque un fichero
// descargado no es una entrega. De aquí sale el histórico ("este día se hizo y no se
// llegó a subir", "este otro se subió por FTP") y la subida al FTP de Apple School
// Manager, que hoy David hace a mano y aquí es un paso opcional.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, History, Loader2, Lock, Send, Server, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ESPEC, ORDEN_ARCHIVOS, serializarArchivo, type ArchivoAsm } from '@/lib/autoasm';
import type { ProyectoAsm } from '@/lib/autoasm-construir';
import { descargarZip, nombreZip } from '@/components/autoasm/descargas';
import { num } from '@/components/autoasm/paleta';

interface EntregaApi {
  id: string;
  createdAt: string;
  modo: 'descargado' | 'ftp' | 'manual';
  estado: 'ok' | 'error';
  quien: string | null;
  desdeCurso: string | null;
  alumnos: number;
  clases: number;
  matriculas: number;
  fichero: string | null;
  destino: string | null;
  detalle: string | null;
}

interface ConfigFtp {
  protocolo: 'ftps' | 'ftp' | 'sftp';
  host: string;
  puerto: number | null;
  usuario: string;
  ruta: string;
  notas: string | null;
  actualizado: string | null;
}

const MODOS: Record<EntregaApi['modo'], { texto: string; clase: string }> = {
  ftp: { texto: 'subido por FTP', clase: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  manual: { texto: 'subido a mano', clase: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  descargado: { texto: 'solo descargado', clase: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
};

export function PanelEntrega({
  proyecto,
  errores,
  avisos,
  onOpciones,
}: {
  proyecto: ProyectoAsm | null;
  errores: number;
  avisos: number;
  onOpciones: (csv: ProyectoAsm['opciones']['csv']) => void;
}) {
  const [entregas, setEntregas] = useState<EntregaApi[]>([]);
  const [config, setConfig] = useState<ConfigFtp | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null); // id de la última descarga
  const [verFormFtp, setVerFormFtp] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  /** Releer el histórico después de una acción (descargar, marcar, subir). */
  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/autoasm/admin/entregas');
      if (res.ok) setEntregas(((await res.json()).entregas ?? []) as EntregaApi[]);
    } catch {
      // Sin histórico se sigue trabajando igual.
    }
  }, []);

  // Carga inicial. Se escribe con `.then` a propósito (y no con `await` dentro del
  // efecto): así el estado se toca en el callback de la promesa, que es el patrón del
  // repo y lo que el compilador de React espera.
  useEffect(() => {
    let vivo = true;
    Promise.all([fetch('/api/autoasm/admin/entregas'), fetch('/api/autoasm/admin/ftp')])
      .then(async ([h, f]) => ({
        entregas: h.ok ? (((await h.json()).entregas ?? []) as EntregaApi[]) : [],
        config: f.ok ? (((await f.json()).config ?? null) as ConfigFtp | null) : null,
      }))
      .then(({ entregas: e, config: c }) => {
        if (!vivo) return;
        setEntregas(e);
        setConfig(c);
      })
      // El histórico es un extra: si las tablas aún no están creadas, el módulo sigue yendo.
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const recuentos = proyecto
    ? {
        alumnos: proyecto.archivos.students.length,
        profes: proyecto.archivos.staff.length,
        cursos: proyecto.archivos.courses.length,
        clases: proyecto.archivos.classes.length,
        matriculas: proyecto.archivos.rosters.length,
      }
    : null;
  const totalFilas = recuentos ? ORDEN_ARCHIVOS.reduce((n, a) => n + (proyecto?.archivos[a].length ?? 0), 0) : 0;

  async function descargar() {
    if (!proyecto || !recuentos) return;
    setTrabajando('zip');
    try {
      await descargarZip(proyecto);
      haptic.success();
      const res = await fetch('/api/autoasm/admin/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'descargado',
          desdeCurso: proyecto.opciones.desdeCurso,
          recuentos,
          errores,
          avisos,
          fichero: nombreZip(),
        }),
      });
      if (res.ok) {
        setPendiente(((await res.json()).entrega as EntregaApi).id);
        void cargar();
      }
      toast.success('ZIP generado. Contiene datos personales: cuidado dónde queda.');
    } catch (error) {
      console.error('AUTOASM: error generando el ZIP', error);
      toast.error('No he podido generar el ZIP.');
    } finally {
      setTrabajando(null);
    }
  }

  async function marcarManual() {
    if (!pendiente) return;
    setTrabajando('manual');
    try {
      const res = await fetch('/api/autoasm/admin/entregas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendiente, modo: 'manual' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPendiente(null);
      void cargar();
      haptic.success();
      toast.success('Apuntado: subido a mano.');
    } catch {
      toast.error('No he podido apuntarlo.');
    } finally {
      setTrabajando(null);
    }
  }

  async function subirPorFtp() {
    if (!proyecto || !recuentos) return;
    setTrabajando('ftp');
    try {
      const ficheros = ORDEN_ARCHIVOS.map((archivo: ArchivoAsm) => ({
        nombre: ESPEC[archivo].fichero,
        contenido: serializarArchivo(archivo, proyecto.archivos[archivo], proyecto.opciones.csv),
      }));
      const res = await fetch('/api/autoasm/admin/subir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ficheros,
          entregaId: pendiente,
          desdeCurso: proyecto.opciones.desdeCurso,
          recuentos,
          errores,
          avisos,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'Error');
      setPendiente(null);
      void cargar();
      haptic.success();
      toast.success(`Subidos ${datos.subidos.length} ficheros a ${datos.destino}.`);
    } catch (error) {
      console.error('AUTOASM: error subiendo por FTP', error);
      toast.error(error instanceof Error ? error.message : 'No se ha podido subir.');
    } finally {
      setTrabajando(null);
    }
  }

  const csv = proyecto?.opciones.csv;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2">
          <Opcion activo={csv?.delimitador === ','} onClick={() => csv && onOpciones({ ...csv, delimitador: ',' })} titulo="Separado por comas" nota="lo que pide Apple" />
          <Opcion activo={csv?.delimitador === ';'} onClick={() => csv && onOpciones({ ...csv, delimitador: ';' })} titulo="Separado por puntos y coma" nota="como los abre Excel en español" />
          <Opcion activo={csv?.bom === true} onClick={() => csv && onOpciones({ ...csv, bom: !csv.bom })} titulo="Con BOM" nota="tildes correctas al abrir en Excel" />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Para subir a Apple School Manager, comas y sin BOM. El punto y coma solo si vas a revisarlo antes en Excel.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={descargar}
            disabled={!proyecto || trabajando !== null || totalFilas === 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40"
          >
            {trabajando === 'zip' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar el ZIP {totalFilas > 0 && `· ${num(totalFilas)} filas`}
          </button>
          <button
            type="button"
            onClick={subirPorFtp}
            disabled={!proyecto || trabajando !== null || totalFilas === 0 || !config}
            title={config ? `Subir a ${config.host}` : 'Configura antes el FTP'}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300 px-5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          >
            {trabajando === 'ftp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Subir por FTP
          </button>
        </div>

        {errores > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <TriangleAlert className="h-3.5 w-3.5" /> Puedes descargarlo igual, pero con {errores} error(es) ASM lo rechazará.
          </p>
        )}

        {pendiente && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-500/5">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">¿Y este fichero, quién lo sube?</p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              Queda apuntado como “solo descargado” hasta que se suba. Dilo aquí y el histórico dirá la verdad.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={marcarManual}
                disabled={trabajando !== null}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {trabajando === 'manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Lo subo yo a mano
              </button>
              <button
                type="button"
                onClick={subirPorFtp}
                disabled={trabajando !== null || !config}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Súbelo tú por FTP
              </button>
            </div>
          </div>
        )}
      </div>

      <FormularioFtp
        config={config}
        abierto={verFormFtp}
        onAbrir={() => setVerFormFtp((v) => !v)}
        onGuardado={(c) => { setConfig(c); setVerFormFtp(false); }}
      />

      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setVerHistorico((v) => !v)}
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            <History className="h-4 w-4 text-zinc-400" /> Histórico de entregas
          </span>
          <span className="text-xs text-zinc-500">
            {entregas.length === 0 ? 'todavía ninguna' : `${num(entregas.length)} apuntadas`}
          </span>
        </button>
        {verHistorico && entregas.length > 0 && (
          <ul className="divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entregas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 p-3 text-sm">
                <span className="text-zinc-900 dark:text-zinc-100">
                  {new Date(e.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MODOS[e.modo].clase}`}>{MODOS[e.modo].texto}</span>
                {e.estado === 'error' && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">falló</span>
                )}
                <span className="text-xs text-zinc-500">
                  {num(e.alumnos)} alumnos · {num(e.clases)} clases · {num(e.matriculas)} matrículas
                  {e.quien && ` · ${e.quien}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Opcion({ activo, onClick, titulo, nota }: { activo: boolean; onClick: () => void; titulo: string; nota: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-xl border px-3 text-left text-sm transition-colors ${
        activo
          ? 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-500/10 dark:text-blue-200'
          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <span className="block font-medium">{titulo}</span>
      <span className="block text-[11px] opacity-70">{nota}</span>
    </button>
  );
}

/** Los datos del FTP se piden UNA vez y se guardan cifrados en Neon. */
function FormularioFtp({
  config,
  abierto,
  onAbrir,
  onGuardado,
}: {
  config: ConfigFtp | null;
  abierto: boolean;
  onAbrir: () => void;
  onGuardado: (c: ConfigFtp) => void;
}) {
  const [guardando, setGuardando] = useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const puerto = String(datos.get('puerto') ?? '').trim();
    setGuardando(true);
    try {
      const res = await fetch('/api/autoasm/admin/ftp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolo: datos.get('protocolo'),
          host: String(datos.get('host') ?? '').trim(),
          puerto: puerto ? Number(puerto) : null,
          usuario: String(datos.get('usuario') ?? '').trim(),
          password: String(datos.get('password') ?? ''),
          ruta: String(datos.get('ruta') ?? '/').trim() || '/',
        }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error ?? 'Error');
      onGuardado(cuerpo.config as ConfigFtp);
      haptic.success();
      toast.success('FTP guardado. La contraseña queda cifrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No he podido guardarlo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button type="button" onClick={onAbrir} className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          <Server className="h-4 w-4 text-zinc-400" /> FTP de Apple School Manager
        </span>
        <span className="text-xs text-zinc-500">
          {config ? `${config.protocolo.toUpperCase()} · ${config.host}${config.ruta}` : 'sin configurar'}
        </span>
      </button>

      {abierto && (
        <form onSubmit={enviar} className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Protocolo</span>
              <select name="protocolo" defaultValue={config?.protocolo ?? 'ftps'} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                <option value="ftps">FTPS (FTP sobre TLS)</option>
                <option value="ftp">FTP</option>
                <option value="sftp">SFTP (por SSH)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Servidor</span>
              <input name="host" required defaultValue={config?.host ?? ''} placeholder="ftp.escuela.com" className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Puerto <span className="opacity-60">(vacío = el de siempre)</span></span>
              <input name="puerto" type="number" min={1} max={65535} defaultValue={config?.puerto ?? ''} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Usuario</span>
              <input name="usuario" required defaultValue={config?.usuario ?? ''} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Contraseña {config && <span className="opacity-60">(vacía = no la cambies)</span>}
              </span>
              <input name="password" type="password" autoComplete="new-password" required={!config} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Carpeta remota</span>
              <input name="ruta" defaultValue={config?.ruta ?? '/'} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
            </label>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-zinc-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            La contraseña se guarda cifrada (AES-256-GCM) y no vuelve a salir de Neon: al editar, este campo siempre aparece vacío.
          </p>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar el FTP
          </button>
        </form>
      )}
    </div>
  );
}
