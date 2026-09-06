'use client';

// Pestaña «Plantillas»: dar de alta una plantilla pegando su URL de Google Docs, releerla
// cuando cambie, y decirle a qué dato corresponde cada etiqueta nueva.
//
// La gracia está en el botón «Analizar»: David edita la plantilla en Docs, le da, y el
// panel le pregunta SOLO por las etiquetas que no conocía. Lo que se mapea se guarda en
// `cuad_alias` y no se vuelve a preguntar en ninguna otra plantilla.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Aviso, Tarjeta } from '@/components/cuaderno/cuaderno-panel';
import { etiquetasSinMapear, plantillaLista, type PlantillaUI } from '@/components/cuaderno/tipos';
import {
  AMBITO_LABELS,
  AMBITOS,
  CAMPOS,
  REPETICION_AYUDA,
  REPETICION_LABELS,
  REPETICIONES,
  type Ambito,
} from '@/lib/cuaderno/campos';
import { haptic } from '@/lib/haptics';

const ETAPAS = [
  { v: '', label: 'Todas' },
  { v: 'ESO', label: 'Secundaria' },
  { v: 'EP', label: 'Primaria' },
  { v: 'EI', label: 'Infantil' },
];

export function PlantillasPanel({ plantillas, cuenta }: { plantillas: PlantillaUI[]; cuenta: string | null }) {
  return (
    <div className="space-y-3">
      <Ayuda />
      {plantillas.length === 0 && (
        <Aviso tono="azul">
          Todavía no hay plantillas. Pega abajo la URL de la primera (un documento de Google Docs con etiquetas
          <code> {'<<...>>'}</code>) y dale a añadir.
        </Aviso>
      )}
      {plantillas.map((plantilla) => (
        <FilaPlantilla key={plantilla.id} plantilla={plantilla} />
      ))}
      <NuevaPlantilla cuenta={cuenta} />
    </div>
  );
}

function Ayuda() {
  const [abierto, setAbierto] = useState(false);
  return (
    <Tarjeta>
      <button type="button" onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <Eye className="h-4 w-4 text-zinc-400" />
        <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Cómo se marcan los campos en una plantilla
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <p>Tres marcas, y solo tres:</p>
          <ul className="space-y-2">
            <li>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{'<<campo>>'}</code> — se
              sustituye por el dato. Da igual mayúsculas, acentos o espacios: <code>{'<<Nom>>'}</code> y{' '}
              <code>{'<<nº clase>>'}</code> se reconocen igual.
            </li>
            <li>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{'<<#alumnos>>'}</code> — en
              cualquier celda de una fila de tabla, repite esa fila una vez por alumno. Es lo que convierte una
              plantilla de listado en la lista de los 30.
            </li>
            <li>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{'<<?familiar2>>'}</code> —
              en un párrafo: si esa familia solo tiene un tutor legal, el párrafo entero desaparece.
            </li>
          </ul>
          <p className="text-xs">
            Los <strong>campos de Word</strong> tipo <code>DOCPROPERTY</code> no se sustituyen (son un objeto, no
            texto): cámbialos por <code>{'<<curso_escolar>>'}</code>.
          </p>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-zinc-500">Ver todos los campos disponibles</summary>
            <div className="mt-2 space-y-2">
              {AMBITOS.map((ambito) => (
                <div key={ambito}>
                  <p className="text-xs font-semibold text-zinc-500">{AMBITO_LABELS[ambito]}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {CAMPOS.filter((c) => c.ambito === ambito).map((campo) => (
                      <code
                        key={campo.id}
                        title={`${campo.label} · p. ej. ${campo.ejemplo}`}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800"
                      >
                        {`<<${campo.id}>>`}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </Tarjeta>
  );
}

function FilaPlantilla({ plantilla }: { plantilla: PlantillaUI }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<'analizar' | 'guardar' | 'borrar' | null>(null);
  const [mapeoLocal, setMapeoLocal] = useState<Record<string, string>>({});
  const [verTodas, setVerTodas] = useState(false);

  const sinMapear = etiquetasSinMapear(plantilla);
  const lista = plantillaLista(plantilla);

  async function analizar() {
    setOcupado('analizar');
    try {
      const res = await fetch(`/api/cuaderno/admin/plantillas/${plantilla.id}/analizar`, { method: 'POST' });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo analizar');
      haptic.success();
      const cuantas = datos.etiquetas?.length ?? 0;
      toast.success(`${cuantas} etiqueta(s) encontradas`);
      setAbierto(true);
      router.refresh();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo analizar');
    } finally {
      setOcupado(null);
    }
  }

  async function guardarMapeo() {
    const alias = Object.entries(mapeoLocal)
      .filter(([, campo]) => campo !== '')
      .map(([etiqueta, campo]) => ({ etiqueta, campo }));
    if (alias.length === 0) return;
    setOcupado('guardar');
    try {
      const res = await fetch('/api/cuaderno/admin/alias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ alias }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      haptic.success();
      toast.success('Aprendido');
      setMapeoLocal({});
      router.refresh();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setOcupado(null);
    }
  }

  async function cambiar(cambios: Record<string, unknown>) {
    setOcupado('guardar');
    try {
      const res = await fetch(`/api/cuaderno/admin/plantillas/${plantilla.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Quitar una plantilla. Primero se pregunta cuánto historial arrastra, para que la
   * confirmación diga la verdad; y sobre todo se mira la respuesta del borrado, que es lo
   * que antes faltaba: decía «quitada» aunque la base de datos lo hubiera rechazado.
   */
  async function borrar() {
    setOcupado('borrar');
    try {
      const previo = await fetch(`/api/cuaderno/admin/plantillas/${plantilla.id}`, { cache: 'no-store' });
      const historial = previo.ok ? await previo.json() : { documentos: 0, hojas: 0 };
      const arrastra =
        historial.documentos > 0
          ? `\n\nSe borrará también su rastro en el historial: ${historial.documentos} documento(s) de tiradas y ${historial.hojas} hoja(s) marcada(s) como hechas.`
          : '';
      if (
        !confirm(
          `¿Quitar la plantilla «${plantilla.nombre}»?${arrastra}\n\nLos documentos ya generados en Drive no se tocan.`,
        )
      ) {
        return;
      }
      const res = await fetch(`/api/cuaderno/admin/plantillas/${plantilla.id}`, { method: 'DELETE' });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error ?? 'No se pudo quitar la plantilla');
      toast.success('Plantilla quitada');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo quitar la plantilla');
    } finally {
      setOcupado(null);
    }
  }

  const etiquetasVisibles = verTodas ? plantilla.etiquetas.filter((e) => e.tipo === 'campo') : sinMapear;

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-lg bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800">
              {plantilla.orden}
            </span>
            <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{plantilla.nombre}</h3>
            {!plantilla.activa && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                desactivada
              </span>
            )}
            {lista ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <Check className="h-3 w-3" /> lista
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {plantilla.analizadaAt ? `${sinMapear.length} sin mapear` : 'sin analizar'}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {REPETICION_LABELS[plantilla.repeticion as keyof typeof REPETICION_LABELS] ?? plantilla.repeticion}
            {plantilla.etapa ? ` · ${plantilla.etapa}` : ' · todas las etapas'}
            {plantilla.tieneFilas ? ' · con tabla de alumnos' : ''}
            {plantilla.generaPdf ? ' · también en PDF' : ' · solo Google Doc'}
            {plantilla.hojasHechas > 0 ? ` · ${plantilla.hojasHechas} hojas hechas este curso` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`https://docs.google.com/document/d/${plantilla.googleDocId}/edit`}
            target="_blank"
            rel="noreferrer"
            title="Abrir la plantilla en Google Docs"
            className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={analizar}
            disabled={ocupado !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {ocupado === 'analizar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Analizar
          </button>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {abierto && (
        <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nombre (sale en el nombre del archivo)">
              <input
                defaultValue={plantilla.nombre}
                onBlur={(e) => e.target.value !== plantilla.nombre && cambiar({ nombre: e.target.value })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </Campo>
            <Campo label="Orden en la carpeta">
              <input
                type="number"
                min={1}
                max={99}
                defaultValue={plantilla.orden}
                onBlur={(e) => Number(e.target.value) !== plantilla.orden && cambiar({ orden: Number(e.target.value) })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </Campo>
            <Campo label="Cuántas veces se repite">
              <select
                defaultValue={plantilla.repeticion}
                onChange={(e) => cambiar({ repeticion: e.target.value })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
              >
                {REPETICIONES.map((r) => (
                  <option key={r} value={r}>
                    {REPETICION_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                {REPETICION_AYUDA[plantilla.repeticion as keyof typeof REPETICION_AYUDA]}
              </p>
            </Campo>
            <Campo label="Etapa">
              <select
                defaultValue={plantilla.etapa ?? ''}
                onChange={(e) => cambiar({ etapa: e.target.value === '' ? null : e.target.value })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
              >
                {ETAPAS.map((e) => (
                  <option key={e.v} value={e.v}>
                    {e.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Interruptor activo={plantilla.generaPdf} onClick={() => cambiar({ generaPdf: !plantilla.generaPdf })}>
              Generar también el PDF
            </Interruptor>
            <Interruptor
              activo={plantilla.saltoDePagina}
              onClick={() => cambiar({ saltoDePagina: !plantilla.saltoDePagina })}
            >
              Salto de página entre copias
            </Interruptor>
            <Interruptor activo={plantilla.activa} onClick={() => cambiar({ activa: !plantilla.activa })}>
              Activa
            </Interruptor>
            <button
              type="button"
              onClick={borrar}
              disabled={ocupado !== null}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar
            </button>
          </div>

          {!plantilla.analizadaAt ? (
            <Aviso tono="ambar">Dale a «Analizar» para leer qué etiquetas tiene esta plantilla.</Aviso>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {sinMapear.length > 0
                    ? `${sinMapear.length} etiqueta(s) por mapear`
                    : `${plantilla.etiquetas.length} etiqueta(s), todas reconocidas`}
                </p>
                <button
                  type="button"
                  onClick={() => setVerTodas((v) => !v)}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {verTodas ? 'Ver solo las que faltan' : 'Ver todas'}
                </button>
              </div>
              {etiquetasVisibles.length === 0 ? (
                <Aviso tono="verde">Todo mapeado. Esta plantilla ya se puede generar.</Aviso>
              ) : (
                <div className="space-y-1.5">
                  {etiquetasVisibles.map((etiqueta) => (
                    <div key={etiqueta.clave} className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                        {`<<${etiqueta.cruda}>>`}
                      </code>
                      <span className="text-zinc-300">→</span>
                      <select
                        value={mapeoLocal[etiqueta.cruda] ?? etiqueta.campo ?? ''}
                        onChange={(e) => setMapeoLocal((m) => ({ ...m, [etiqueta.cruda]: e.target.value }))}
                        className="min-w-48 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="">— sin asignar —</option>
                        {AMBITOS.map((ambito: Ambito) => (
                          <optgroup key={ambito} label={AMBITO_LABELS[ambito]}>
                            {CAMPOS.filter((c) => c.ambito === ambito).map((campo) => (
                              <option key={campo.id} value={campo.id}>
                                {campo.label} ({campo.ejemplo})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={guardarMapeo}
                    disabled={ocupado !== null || Object.keys(mapeoLocal).length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {ocupado === 'guardar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Guardar el mapeo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

function Interruptor({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
        activo
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
      }`}
    >
      {activo && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

function NuevaPlantilla({ cuenta }: { cuenta: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [nombre, setNombre] = useState('');
  const [repeticion, setRepeticion] = useState<string>('alumno');
  const [etapa, setEtapa] = useState('ESO');
  const [guardando, setGuardando] = useState(false);

  async function anadir() {
    setGuardando(true);
    try {
      const res = await fetch('/api/cuaderno/admin/plantillas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          nombre: nombre.trim() || undefined,
          repeticion,
          etapa: etapa === '' ? null : etapa,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo añadir');
      // Se analiza al momento: así se ve enseguida si el mapeo está completo.
      await fetch(`/api/cuaderno/admin/plantillas/${datos.plantilla.id}/analizar`, { method: 'POST' });
      haptic.success();
      toast.success('Plantilla añadida y analizada');
      setUrl('');
      setNombre('');
      router.refresh();
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo añadir');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta className="border-dashed">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Añadir una plantilla</h3>
      </div>
      <div className="mt-3 space-y-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/document/d/…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (o el del documento)"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            value={repeticion}
            onChange={(e) => setRepeticion(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
          >
            {REPETICIONES.map((r) => (
              <option key={r} value={r}>
                {REPETICION_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            value={etapa}
            onChange={(e) => setEtapa(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ETAPAS.map((e) => (
              <option key={e.v} value={e.v}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={anadir}
            disabled={guardando || url.trim().length < 10}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir y analizar
          </button>
          {cuenta && (
            <p className="text-xs text-zinc-500">
              Antes, comparte el documento con <code className="break-all">{cuenta}</code>.
            </p>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}
