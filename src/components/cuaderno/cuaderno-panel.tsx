'use client';

// Panel del Cuaderno de tutor: cinco pestañas (Generar · Vista previa · Plantillas ·
// Asignaturas · Historial) y, arriba,
// la carpeta base de Drive. Si la carpeta base falta, el aviso va primero y bien grande:
// sin ella no se puede generar nada, y es lo único que hay que configurar una vez.

import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ExternalLink,
  Eye,
  FolderOpen,
  History,
  Loader2,
  Play,
  Settings2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AsignaturasPanel } from '@/components/cuaderno/asignaturas-panel';
import { GenerarPanel } from '@/components/cuaderno/generar-panel';
import { PlantillasPanel } from '@/components/cuaderno/plantillas-panel';
import { HistorialPanel } from '@/components/cuaderno/historial-panel';
import { VistaPreviaPanel } from '@/components/cuaderno/vista-previa-panel';
import type { AjustesUI, ClaseUI, DriveUI, FaltaUI, PlantillaUI, TiradaUI } from '@/components/cuaderno/tipos';
import { haptic } from '@/lib/haptics';

const TABS = [
  { k: 'generar' as const, label: 'Generar', icon: Play },
  { k: 'vista' as const, label: 'Vista previa', icon: Eye },
  { k: 'plantillas' as const, label: 'Plantillas', icon: Wand2 },
  { k: 'asignaturas' as const, label: 'Asignaturas', icon: BookOpen },
  { k: 'historial' as const, label: 'Historial', icon: History },
];

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
  const [tab, setTab] = useState<'generar' | 'vista' | 'plantillas' | 'asignaturas' | 'historial'>('generar');
  const [ajustes, setAjustes] = useState(props.ajustes);
  const [abiertoAjustes, setAbiertoAjustes] = useState(!props.ajustes.carpetaBaseId);

  return (
    <div className="space-y-4">
      {!props.drive.configurado && (
        <Aviso tono="rojo">
          Falta la cuenta de servicio de Google en el entorno (<code>GOOGLE_SA_CLIENT_EMAIL</code> y{' '}
          <code>GOOGLE_SA_PRIVATE_KEY</code>). Sin ella no se puede tocar Drive.
        </Aviso>
      )}

      <AjustesCard
        ajustes={ajustes}
        drive={props.drive}
        abierto={abiertoAjustes}
        onToggle={() => setAbiertoAjustes((v) => !v)}
        onGuardado={setAjustes}
      />

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => {
              haptic.tap();
              setTab(t.k);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.k
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
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
      {tab === 'vista' && <VistaPreviaPanel plantillas={props.plantillas} clases={props.clases} />}
      {tab === 'plantillas' && <PlantillasPanel plantillas={props.plantillas} cuenta={props.drive.cuenta} />}
      {tab === 'asignaturas' && <AsignaturasPanel cursoEscolar={props.cursoEscolar} />}
      {tab === 'historial' && <HistorialPanel tiradas={props.tiradas} plantillas={props.plantillas} />}
    </div>
  );
}

// ─── Piezas compartidas ───────────────────────────────────────────────────────

export function Aviso({
  tono,
  children,
}: {
  tono: 'rojo' | 'ambar' | 'azul' | 'verde';
  children: React.ReactNode;
}) {
  const estilos = {
    rojo: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    ambar: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    azul: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    verde:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  }[tono];
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${estilos}`}>{children}</div>;
}

export function Tarjeta({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
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
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Carpeta de Drive</span>
          {ajustes.carpetaBaseId ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Check className="h-3 w-3" /> configurada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> falta configurar
            </span>
          )}
        </div>
        <Settings2 className="h-4 w-4 text-zinc-400" />
      </button>

      {abierto && (
        <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Carpeta base (una subcarpeta de una <strong>unidad compartida</strong>)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={carpeta}
                onChange={(e) => setCarpeta(e.target.value)}
                placeholder={ajustes.carpetaBaseUrl ?? 'https://drive.google.com/drive/folders/…'}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="button"
                disabled={guardando || carpeta.trim() === ''}
                onClick={() => guardar({ carpetaBase: carpeta.trim() })}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Comprobar y
                guardar
              </button>
            </div>
            {ajustes.carpetaBaseUrl && (
              <a
                href={ajustes.carpetaBaseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Abrir la carpeta actual <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Qué permiso reciben los tutores sobre su carpeta
            </label>
            <div className="flex gap-1.5">
              {[
                { v: 'writer', label: 'Editor (pueden retocar y rellenar)' },
                { v: 'reader', label: 'Solo lectura (solo imprimir)' },
              ].map((opcion) => (
                <button
                  key={opcion.v}
                  type="button"
                  onClick={() => {
                    setPermiso(opcion.v);
                    void guardar({ permisoTutores: opcion.v });
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                    permiso === opcion.v
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {opcion.label}
                </button>
              ))}
            </div>
          </div>

          {drive.cuenta && (
            <Aviso tono="azul">
              Da de alta a <code className="break-all">{drive.cuenta}</code> como{' '}
              <strong>Administrador de contenido</strong> de esa unidad compartida, y comparte con ese mismo correo cada
              plantilla de Google Docs (basta lector). No hace falta nada más.
            </Aviso>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
