'use client';

// «Guardar en mi Drive»: el botón (y su ventanita) para cualquier lista o informe que ya se
// pueda descargar. Se elige el formato —Google Sheets o Excel—, el servidor crea el archivo en
// el Drive de QUIEN pulsa (`src/lib/drive-usuario.ts`) y la ventana dice dónde ha quedado y
// recuerda lo importante: que está suelto en «Mi unidad» y hay que moverlo donde corresponda.
//
// Cómo se usa, desde cualquier módulo:
//
//   <GuardarEnDrive
//     que="Lista de clase · 2º ESO B"
//     guardar={(formato) => pedirGuardadoEnDrive('/api/alumnado/lista', { tipo, clases, formato })}
//     tambienDescargar={() => descargarExcel()}
//   />
//
// `guardar` hace el POST (la ruta devuelve `ArchivoEnDrive`) y lanza `Error` con un mensaje
// que se pueda leer en voz alta si algo falla. `antes` deja validar el formulario ANTES de
// abrir la ventana (devuelve el aviso, o `null` si todo va bien). `tambienDescargar`, si se
// pasa, se ejecuta al elegir **Excel**: se queda en Drive Y se baja al dispositivo (David,
// 2-nov-2026: «si te hace el excel que te lo descargue también»). Con Hoja de Google no, que
// no hay fichero que bajar. Si la descarga falla, el archivo de Drive ya está creado: no se
// cuenta como fallo del guardado.

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CloudCheck,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Folder,
  FolderInput,
  Loader2,
  ShieldAlert,
  Sheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { copiarTexto } from '@/components/ui/copiable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';

export type FormatoDrive = 'sheet' | 'xlsx';

export interface ArchivoEnDrive {
  id: string;
  nombre: string;
  url: string;
  formato: FormatoDrive;
}

/** El POST de siempre: lo que devuelva la ruta es el archivo creado, o un `{ error }` legible. */
export async function pedirGuardadoEnDrive(url: string, cuerpo: Record<string, unknown>): Promise<ArchivoEnDrive> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Mira tu internet y vuelve a probar.');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof datos.error === 'string' ? datos.error : 'No se pudo guardar en tu Drive');
  return datos as ArchivoEnDrive;
}

const FORMATOS: Record<FormatoDrive, { titulo: string; tipo: string; ayuda: string; Icono: typeof Sheet }> = {
  sheet: {
    titulo: 'Hoja de Google',
    tipo: 'Hoja de cálculo de Google',
    ayuda: 'Se abre en Google Sheets: la editas al momento y es fácil de compartir.',
    Icono: Sheet,
  },
  xlsx: {
    titulo: 'Excel (.xlsx)',
    tipo: 'Archivo de Excel',
    ayuda: 'Un archivo de Excel guardado en Drive, igual que si lo descargaras.',
    Icono: FileSpreadsheet,
  },
};

type Fase =
  | { tipo: 'elegir' }
  | { tipo: 'guardando'; formato: FormatoDrive }
  | { tipo: 'hecho'; archivo: ArchivoEnDrive; descargado: boolean }
  | { tipo: 'error'; formato: FormatoDrive; mensaje: string };

/** El icono redondeado de la cabecera de la ventana. */
function Insignia({ children, animar }: { children: React.ReactNode; animar?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 [&_svg]:size-6',
        animar && 'animate-in zoom-in-50 fade-in duration-300 motion-reduce:animate-none',
      )}
    >
      {children}
    </span>
  );
}

export function GuardarEnDrive({
  guardar,
  tambienDescargar,
  que,
  antes,
  etiqueta = 'Guardar en mi Drive',
  variant = 'outline',
  size = 'default',
  disabled,
  className,
}: {
  guardar: (formato: FormatoDrive) => Promise<ArchivoEnDrive>;
  /** Al elegir Excel, además de guardarlo en Drive se baja al dispositivo con esto. Devuelve `true` si bajó; si falla, avisa él mismo. */
  tambienDescargar?: () => Promise<boolean>;
  /** Qué se va a guardar, en una línea («Lista de clase · 2º ESO B»). */
  que?: string;
  /** Si devuelve un texto, se avisa con él y no se abre nada. */
  antes?: () => string | null;
  etiqueta?: string;
  variant?: 'default' | 'outline' | 'suave' | 'secondary' | 'ghost';
  size?: 'default' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fase, setFase] = useState<Fase>({ tipo: 'elegir' });
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  function abrir() {
    const problema = antes?.();
    if (problema) {
      haptic.warning();
      toast.error(problema);
      return;
    }
    haptic.tap();
    setFase({ tipo: 'elegir' });
    setCopiado(false);
    setAbierto(true);
  }

  async function crear(formato: FormatoDrive) {
    haptic.tap();
    setFase({ tipo: 'guardando', formato });
    const bajar = formato === 'xlsx' && tambienDescargar ? tambienDescargar : null;
    try {
      // A la vez: son dos cosas independientes y la descarga no debe esperar a Drive.
      const [archivo, descargado] = await Promise.all([
        guardar(formato),
        bajar ? bajar().catch(() => false) : Promise.resolve(false),
      ]);
      haptic.success();
      setFase({ tipo: 'hecho', archivo, descargado });
    } catch (e) {
      haptic.warning();
      setFase({
        tipo: 'error',
        formato,
        mensaje: e instanceof Error && e.message ? e.message : 'No se ha podido guardar en tu Drive.',
      });
    }
  }

  async function copiarEnlace(url: string) {
    if (!(await copiarTexto(url))) return toast.error('No se pudo copiar el enlace');
    haptic.tap();
    setCopiado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={disabled} className={className} onClick={abrir}>
        <CloudUpload aria-hidden /> {etiqueta}
      </Button>

      <Dialog
        open={abierto}
        // Mientras se crea no se cierra: el archivo se va a crear igual y la persona se quedaría sin saber dónde.
        onOpenChange={(v) => {
          if (!v && fase.tipo === 'guardando') return;
          setAbierto(v);
        }}
      >
        {/* `minmax(0,1fr)`: sin esto, un nombre de archivo largo ensancha la ventana en vez de partirse. */}
        <DialogContent variante="hoja" showCloseButton={fase.tipo !== 'guardando'} className="grid-cols-[minmax(0,1fr)]">
          {fase.tipo === 'elegir' && (
            <>
              <DialogHeader className="flex-row items-center gap-3.5">
                <Insignia>
                  <CloudUpload />
                </Insignia>
                <div className="min-w-0">
                  <DialogTitle>Guardar en tu Drive</DialogTitle>
                  <DialogDescription>{que ?? 'Se crea una copia en tu cuenta del colegio.'}</DialogDescription>
                </div>
              </DialogHeader>

              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(FORMATOS) as FormatoDrive[]).map((f) => {
                  const { titulo, Icono } = FORMATOS[f];
                  const ayuda = f === 'xlsx' && tambienDescargar ? 'Un archivo de Excel en Drive y, además, se descarga en este dispositivo.' : FORMATOS[f].ayuda;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => void crear(f)}
                      className="flex min-h-11 flex-col items-start gap-2 rounded-xl bg-zinc-50 p-3.5 text-left ring-1 ring-zinc-200 transition-colors outline-none hover:bg-blue-50 hover:ring-blue-200 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-zinc-800/50 dark:ring-zinc-700 dark:hover:bg-blue-950/40 dark:hover:ring-blue-900"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        <span className="text-blue-600 dark:text-blue-400">
                          <Icono className="size-5" aria-hidden />
                        </span>
                        {titulo}
                      </span>
                      <span className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">{ayuda}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Se crea en tu «Mi unidad», con tu cuenta del colegio. Es tuyo y de nadie más hasta que lo compartas tú.
              </p>
            </>
          )}

          {fase.tipo === 'guardando' && (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6 text-center">
              <Insignia>
                <Loader2 className="animate-spin" />
              </Insignia>
              <DialogTitle className="pr-0">Creando tu archivo…</DialogTitle>
              <DialogDescription>
                Lo estamos dejando en tu Drive como {FORMATOS[fase.formato].tipo.toLowerCase()}. Tarda unos segundos.
              </DialogDescription>
            </div>
          )}

          {fase.tipo === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle>No se ha podido guardar</DialogTitle>
                <DialogDescription className="sr-only">Ha fallado el guardado en tu Drive</DialogDescription>
              </DialogHeader>
              <Aviso tono="error">{fase.mensaje}</Aviso>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                  Cerrar
                </Button>
                <Button type="button" onClick={() => void crear(fase.formato)}>
                  Reintentar
                </Button>
              </DialogFooter>
            </>
          )}

          {fase.tipo === 'hecho' && (
            <Hecho
              archivo={fase.archivo}
              descargado={fase.descargado}
              copiado={copiado}
              onCopiar={() => void copiarEnlace(fase.archivo.url)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** La pantalla de «ya está»: dónde ha quedado, cómo abrirlo y que hay que moverlo. */
function Hecho({
  archivo,
  descargado,
  copiado,
  onCopiar,
}: {
  archivo: ArchivoEnDrive;
  descargado: boolean;
  copiado: boolean;
  onCopiar: () => void;
}) {
  const { tipo, Icono } = FORMATOS[archivo.formato];
  return (
    <>
      <DialogHeader className="flex-row items-center gap-3.5">
        <Insignia animar>
          <CloudCheck />
        </Insignia>
        <div className="min-w-0 space-y-1.5">
          <DialogTitle>Listo, ya está en tu Drive</DialogTitle>
          <div className="flex flex-wrap gap-1.5">
            <Estado tono="ok" icono={<Check aria-hidden />}>
              Guardado en Mi unidad
            </Estado>
            {descargado && (
              <Estado tono="ok" icono={<Download aria-hidden />}>
                Descargado
              </Estado>
            )}
          </div>
        </div>
      </DialogHeader>
      <DialogDescription className="sr-only">El archivo se ha creado en tu Mi unidad de Drive</DialogDescription>

      {/* El archivo */}
      <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200 dark:bg-zinc-800/50 dark:ring-zinc-700">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-blue-300 dark:ring-zinc-700"
        >
          <Icono className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words text-zinc-900 dark:text-zinc-100">{archivo.nombre}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{tipo}</p>
        </div>
      </div>

      {/* El recordatorio: moverlo */}
      <Aviso tono="info" icono={<FolderInput />} titulo="Muévelo a donde quieras">
        <p className="mt-0.5">
          Ahora mismo está suelto en la raíz de tu «Mi unidad». Arrástralo a la carpeta que prefieras o, en Drive, clic
          derecho sobre el archivo → <strong className="font-semibold">Organizar → Mover a</strong>.
        </p>
        <div aria-hidden className="mt-3 flex items-center gap-2 text-xs font-medium">
          <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-blue-900 ring-1 ring-blue-200 dark:bg-zinc-900 dark:text-blue-100 dark:ring-blue-500/30">
            <Icono className="size-4 shrink-0 text-blue-600 dark:text-blue-300" />
            <span className="truncate">{archivo.nombre}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-blue-600 motion-safe:animate-pulse dark:text-blue-300" />
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-2.5 py-1.5 text-blue-700 dark:border-blue-500/40 dark:text-blue-200">
            <Folder className="size-4" />
            Tu carpeta
          </span>
        </div>
      </Aviso>

      <p className="flex gap-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-zinc-400" />
        <span>
          Es una foto de hoy: no se actualiza sola. Lleva datos de alumnado, así que déjala solo donde corresponda y
          bórrala cuando ya no la necesites.
        </span>
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCopiar}>
          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />} {copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
        <a href={archivo.url} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
          <ExternalLink aria-hidden /> Abrir en Drive
        </a>
      </DialogFooter>
    </>
  );
}
