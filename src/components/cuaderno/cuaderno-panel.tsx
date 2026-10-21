'use client';

// Panel del Cuaderno de tutor: seis vistas (Generar · Listas · Vista previa · Plantillas ·
// Asignaturas · Historial) y, arriba, la carpeta base de Drive. Si la carpeta base falta, el
// ajuste sale abierto: sin ella no se puede generar nada, y es lo único que hay que
// configurar una vez.

import { useState } from 'react';
import { BookOpen, Check, ChevronDown, ExternalLink, Eye, FolderOpen, History, Play, Table2, TriangleAlert, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { AsignaturasPanel } from '@/components/cuaderno/asignaturas-panel';
import { GenerarPanel } from '@/components/cuaderno/generar-panel';
import { PlantillasPanel } from '@/components/cuaderno/plantillas-panel';
import { HistorialPanel } from '@/components/cuaderno/historial-panel';
import { ListasPanel } from '@/components/cuaderno/listas-panel';
import { VistaPreviaPanel } from '@/components/cuaderno/vista-previa-panel';
import type { AjustesUI, ClaseUI, DriveUI, FaltaUI, PlantillaUI, TiradaUI } from '@/components/cuaderno/tipos';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Estado } from '@/components/ui/estado';
import { Input } from '@/components/ui/input';
import { Segmentado } from '@/components/ui/segmentado';
import { Tarjeta } from '@/components/ui/tarjeta';

type Vista = 'generar' | 'listas' | 'vista' | 'plantillas' | 'asignaturas' | 'historial';

const VISTAS = [
  { valor: 'generar', etiqueta: 'Generar', icono: <Play /> },
  { valor: 'listas', etiqueta: 'Listas', icono: <Table2 /> },
  { valor: 'vista', etiqueta: 'Vista previa', icono: <Eye /> },
  { valor: 'plantillas', etiqueta: 'Plantillas', icono: <Wand2 /> },
  { valor: 'asignaturas', etiqueta: 'Asignaturas', icono: <BookOpen /> },
  { valor: 'historial', etiqueta: 'Historial', icono: <History /> },
] as const;

interface Props {
  academicYear: string;
  cursoEscolar: string;
  ajustes: AjustesUI;
  drive: DriveUI;
  plantillas: PlantillaUI[];
  clases: ClaseUI[];
  tiradas: TiradaUI[];
  faltas: FaltaUI[];
}

export function CuadernoPanel(props: Props) {
  const [tab, setTab] = useState<Vista>('generar');
  const [ajustes, setAjustes] = useState(props.ajustes);
  const [abiertoAjustes, setAbiertoAjustes] = useState(!props.ajustes.carpetaBaseId);

  return (
    <div className="space-y-4">
      {!props.drive.configurado && (
        <Aviso tono="error">
          Falta la cuenta de servicio de Google en el entorno (<code className="font-mono text-xs">GOOGLE_SA_CLIENT_EMAIL</code> y{' '}
          <code className="font-mono text-xs">GOOGLE_SA_PRIVATE_KEY</code>). Sin ella no se puede tocar Drive.
        </Aviso>
      )}

      <AjustesCard
        ajustes={ajustes}
        drive={props.drive}
        abierto={abiertoAjustes}
        onToggle={() => setAbiertoAjustes((v) => !v)}
        onGuardado={setAjustes}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmentado etiqueta="Qué hacer" valor={tab} onChange={setTab} opciones={VISTAS} />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Curso {props.cursoEscolar}</p>
      </div>

      {tab === 'generar' && (
        <GenerarPanel
          cursoEscolar={props.cursoEscolar}
          plantillas={props.plantillas}
          clases={props.clases}
          faltas={props.faltas}
          listoParaGenerar={props.drive.configurado && Boolean(ajustes.carpetaBaseId)}
        />
      )}
      {tab === 'listas' && (
        <ListasPanel clases={props.clases} cursoEscolar={props.cursoEscolar} carpetaBaseLista={Boolean(ajustes.carpetaBaseId)} />
      )}
      {tab === 'vista' && <VistaPreviaPanel plantillas={props.plantillas} clases={props.clases} />}
      {tab === 'plantillas' && <PlantillasPanel plantillas={props.plantillas} cuenta={props.drive.cuenta} />}
      {tab === 'asignaturas' && <AsignaturasPanel cursoEscolar={props.cursoEscolar} />}
      {tab === 'historial' && <HistorialPanel tiradas={props.tiradas} plantillas={props.plantillas} />}
    </div>
  );
}

// ─── Ajustes de Drive ─────────────────────────────────────────────────────────

function AjustesCard({
  ajustes,
  drive,
  abierto,
  onToggle,
  onGuardado,
}: {
  ajustes: AjustesUI;
  drive: DriveUI;
  abierto: boolean;
  onToggle: () => void;
  onGuardado: (a: AjustesUI) => void;
}) {
  const [carpeta, setCarpeta] = useState('');
  const [permiso, setPermiso] = useState(ajustes.permisoTutores);
  const [guardando, setGuardando] = useState(false);

  async function guardar(cuerpo: Record<string, unknown>) {
    setGuardando(true);
    try {
      const res = await fetch('/api/cuaderno/admin/ajustes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      onGuardado(datos.ajustes);
      setCarpeta('');
      haptic.success();
      toast.success('Ajustes guardados');
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FolderOpen aria-hidden className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Carpeta de Drive</span>
        {ajustes.carpetaBaseId ? (
          <Estado tono="ok" icono={<Check />}>
            Configurada
          </Estado>
        ) : (
          <Estado tono="aviso" icono={<TriangleAlert />}>
            Falta configurarla
          </Estado>
        )}
        <ChevronDown
          aria-hidden
          className={cn('ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <Campo
            etiqueta={
              <>
                Carpeta base (una subcarpeta de una <strong>unidad compartida</strong>)
              </>
            }
            id="cuaderno-carpeta"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="cuaderno-carpeta"
                value={carpeta}
                onChange={(e) => setCarpeta(e.target.value)}
                placeholder={ajustes.carpetaBaseUrl ?? 'https://drive.google.com/drive/folders/…'}
                className="flex-1"
              />
              <Button
                disabled={carpeta.trim() === ''}
                cargando={guardando}
                onClick={() => guardar({ carpetaBase: carpeta.trim() })}
              >
                {!guardando && <Check />} Comprobar y guardar
              </Button>
            </div>
          </Campo>
          {ajustes.carpetaBaseUrl && (
            <a
              href={ajustes.carpetaBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              Abrir la carpeta actual <ExternalLink aria-hidden className="h-4 w-4" />
            </a>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Qué permiso reciben los tutores sobre su carpeta</p>
            <Segmentado
              etiqueta="Permiso de los tutores"
              valor={permiso === 'writer' || permiso === 'reader' ? permiso : null}
              disabled={guardando}
              onChange={(v) => {
                if (v === permiso) return;
                setPermiso(v);
                void guardar({ permisoTutores: v });
              }}
              opciones={[
                { valor: 'writer', etiqueta: 'Editor' },
                { valor: 'reader', etiqueta: 'Solo lectura' },
              ]}
            />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Editor: pueden retocar y rellenar. Solo lectura: solo imprimir.
            </p>
          </div>

          {drive.cuenta && (
            <Aviso tono="info">
              Da de alta a <code className="font-mono text-xs break-all">{drive.cuenta}</code> como{' '}
              <strong>Administrador de contenido</strong> de esa unidad compartida, y comparte con ese mismo correo cada
              plantilla de Google Docs (basta lector). No hace falta nada más.
            </Aviso>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
