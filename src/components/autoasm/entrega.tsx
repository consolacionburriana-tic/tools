'use client';

// Paso 4 del estudio: generar el ZIP y **cerrar el círculo** — porque un fichero
// descargado no es una entrega. De aquí sale el histórico ("este día se hizo y no se
// llegó a subir", "este otro se subió por FTP") y la subida al FTP de Apple School
// Manager, que hoy David hace a mano y aquí es un paso opcional.

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, CircleCheck, Download, History, Lock, Send, Server, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';
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

const MODOS: Record<EntregaApi['modo'], { texto: string; tono: TonoEstado }> = {
  ftp: { texto: 'Subido por FTP', tono: 'ok' },
  manual: { texto: 'Subido a mano', tono: 'ok' },
  descargado: { texto: 'Solo descargado', tono: 'aviso' },
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
      <Tarjeta className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Separador</p>
            <Segmentado
              etiqueta="Separador de los CSV"
              valor={csv?.delimitador ?? null}
              disabled={!csv}
              onChange={(v) => csv && onOpciones({ ...csv, delimitador: v })}
              opciones={[
                { valor: ',', etiqueta: 'Comas' },
                { valor: ';', etiqueta: 'Puntos y coma' },
              ]}
            />
          </div>
          <Interruptor
            activo={csv?.bom === true}
            disabled={!csv}
            onChange={(v) => csv && onOpciones({ ...csv, bom: v })}
            etiqueta="Con BOM"
            descripcion="Tildes correctas al abrir en Excel"
            className="self-end"
          />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Para subir a Apple School Manager, comas y sin BOM (lo que pide Apple). El punto y coma y el BOM, solo si vas a
          revisarlo antes en Excel en español.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={descargar} disabled={!proyecto || trabajando !== null || totalFilas === 0} cargando={trabajando === 'zip'}>
            {trabajando !== 'zip' && <Download />}
            Descargar el ZIP {totalFilas > 0 && `· ${num(totalFilas)} filas`}
          </Button>
          <Button
            variant="outline"
            onClick={subirPorFtp}
            disabled={!proyecto || trabajando !== null || totalFilas === 0 || !config}
            cargando={trabajando === 'ftp'}
          >
            {trabajando !== 'ftp' && <Send />}
            {config ? `Subir por FTP a ${config.host}` : 'Subir por FTP'}
          </Button>
          {!config && <span className="text-sm text-zinc-500 dark:text-zinc-400">Configura antes el FTP (abajo).</span>}
        </div>

        {errores > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
            <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" /> Puedes descargarlo igual, pero con {errores}{' '}
            {errores === 1 ? 'error' : 'errores'} ASM lo rechazará.
          </p>
        )}

        {pendiente && (
          <Aviso tono="info" titulo="¿Y este fichero, quién lo sube?">
            <p>Queda apuntado como «solo descargado» hasta que se suba. Dilo aquí y el histórico dirá la verdad.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={subirPorFtp} disabled={trabajando !== null || !config}>
                <Send /> Súbelo tú por FTP
              </Button>
              <Button size="sm" variant="outline" onClick={marcarManual} disabled={trabajando !== null} cargando={trabajando === 'manual'}>
                {trabajando !== 'manual' && <CircleCheck />}
                Lo subo yo a mano
              </Button>
            </div>
          </Aviso>
        )}
      </Tarjeta>

      <FormularioFtp
        config={config}
        abierto={verFormFtp}
        onAbrir={() => setVerFormFtp((v) => !v)}
        onGuardado={(c) => { setConfig(c); setVerFormFtp(false); }}
      />

      <Tarjeta>
        <Plegable
          abierto={verHistorico}
          onClick={() => setVerHistorico((v) => !v)}
          icono={<History />}
          titulo="Histórico de entregas"
          resumen={entregas.length === 0 ? 'Todavía ninguna' : `${num(entregas.length)} apuntadas`}
        />
        {verHistorico && entregas.length > 0 && (
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            {entregas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="text-zinc-900 tabular-nums dark:text-zinc-100">
                  {new Date(e.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <Estado tono={MODOS[e.modo].tono}>{MODOS[e.modo].texto}</Estado>
                {e.estado === 'error' && <Estado tono="error">Falló</Estado>}
                <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                  {num(e.alumnos)} alumnos · {num(e.clases)} clases · {num(e.matriculas)} matrículas
                  {e.quien && ` · ${e.quien}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

/** La cabecera de una tarjeta que se abre y se cierra (FTP, histórico, iPads compartidos). */
export function Plegable({
  abierto,
  onClick,
  icono,
  titulo,
  resumen,
}: {
  abierto: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  titulo: string;
  resumen: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span aria-hidden className="text-zinc-500 dark:text-zinc-400 [&_svg]:size-4">
        {icono}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titulo}</span>
      <span className="min-w-0 truncate text-right text-sm text-zinc-500 dark:text-zinc-400">{resumen}</span>
      <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform', abierto && 'rotate-180')} />
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
    <Tarjeta>
      <Plegable
        abierto={abierto}
        onClick={onAbrir}
        icono={<Server />}
        titulo="FTP de Apple School Manager"
        resumen={config ? `${config.protocolo.toUpperCase()} · ${config.host}${config.ruta}` : 'Sin configurar'}
      />

      {abierto && (
        <form onSubmit={enviar} className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Protocolo" id="ftp-protocolo">
              <Selector id="ftp-protocolo" name="protocolo" defaultValue={config?.protocolo ?? 'ftps'}>
                <option value="ftps">FTPS (FTP sobre TLS)</option>
                <option value="ftp">FTP</option>
                <option value="sftp">SFTP (por SSH)</option>
              </Selector>
            </Campo>
            <Campo etiqueta="Servidor" id="ftp-host">
              <Input id="ftp-host" name="host" required defaultValue={config?.host ?? ''} placeholder="ftp.escuela.com" />
            </Campo>
            <Campo etiqueta="Puerto" id="ftp-puerto" ayuda="Vacío = el de siempre.">
              <Input id="ftp-puerto" name="puerto" type="number" min={1} max={65535} defaultValue={config?.puerto ?? ''} />
            </Campo>
            <Campo etiqueta="Usuario" id="ftp-usuario">
              <Input id="ftp-usuario" name="usuario" required defaultValue={config?.usuario ?? ''} autoCapitalize="none" />
            </Campo>
            <Campo etiqueta="Contraseña" id="ftp-password" ayuda={config ? 'Vacía = no la cambies.' : undefined}>
              <Input id="ftp-password" name="password" type="password" autoComplete="new-password" required={!config} />
            </Campo>
            <Campo etiqueta="Carpeta remota" id="ftp-ruta">
              <Input id="ftp-ruta" name="ruta" defaultValue={config?.ruta ?? '/'} />
            </Campo>
          </div>
          <p className="flex items-start gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            La contraseña se guarda cifrada (AES-256-GCM) y no vuelve a salir de Neon: al editar, este campo siempre aparece vacío.
          </p>
          <Button type="submit" cargando={guardando}>
            Guardar el FTP
          </Button>
        </form>
      )}
    </Tarjeta>
  );
}
