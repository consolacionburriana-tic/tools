'use client';

// Pestaña «Plantillas»: dar de alta una plantilla pegando su URL de Google Docs, releerla
// cuando cambie, y decirle a qué dato corresponde cada etiqueta nueva.
//
// La gracia está en el botón «Analizar»: David edita la plantilla en Docs, le da, y el
// panel le pregunta SOLO por las etiquetas que no conocía. Lo que se mapea se guarda en
// `cuad_alias` y no se vuelve a preguntar en ninguna otra plantilla.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, ChevronDown, ExternalLink, Eye, FileText, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { useConfirmar } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { etiquetasSinMapear, plantillaLista, type PlantillaUI } from '@/components/cuaderno/tipos';
import {
  AMBITO_LABELS,
  AMBITOS,
  CAMPOS,
  ETAPA_LABELS,
  ETAPAS,
  etiquetaEtapas,
  REPETICION_AYUDA,
  REPETICION_LABELS,
  REPETICIONES,
  type Ambito,
} from '@/lib/cuaderno/campos';
import { ETAPAS_VISIBLES, type Etapa } from '@/lib/cursos';
import { haptic } from '@/lib/haptics';

export function PlantillasPanel({ plantillas, cuenta }: { plantillas: PlantillaUI[]; cuenta: string | null }) {
  return (
    <div className="space-y-3">
      <Ayuda />
      {plantillas.length === 0 && (
        <Aviso tono="info">
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
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Eye aria-hidden className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <span className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Cómo se marcan los campos en una plantilla
        </span>
        <ChevronDown aria-hidden className={cn('h-4 w-4 text-zinc-500 transition-transform', abierto && 'rotate-180')} />
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-zinc-100 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <p>Tres marcas, y solo tres:</p>
          <ul className="space-y-2">
            <li>
              <Etiqueta mono>{'<<campo>>'}</Etiqueta> — se sustituye por el dato. Da igual mayúsculas, acentos o espacios:{' '}
              <code className="font-mono text-xs">{'<<Nom>>'}</code> y <code className="font-mono text-xs">{'<<nº clase>>'}</code> se
              reconocen igual.
            </li>
            <li>
              <Etiqueta mono>{'<<#alumnos>>'}</Etiqueta> — en cualquier celda de una fila de tabla, repite esa fila una vez
              por alumno. Es lo que convierte una plantilla de listado en la lista de los 30.
            </li>
            <li>
              <Etiqueta mono>{'<<?familiar2>>'}</Etiqueta> — en un párrafo: si esa familia solo tiene un tutor legal, el
              párrafo entero desaparece.
            </li>
          </ul>
          <p>
            Los <strong>campos de Word</strong> tipo <code className="font-mono text-xs">DOCPROPERTY</code> no se sustituyen
            (son un objeto, no texto): cámbialos por <code className="font-mono text-xs">{'<<curso_escolar>>'}</code>.
          </p>
          <details className="group">
            <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-xl font-medium text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
              Ver todos los campos disponibles
              <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-3">
              {AMBITOS.map((ambito) => (
                <div key={ambito}>
                  <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    {AMBITO_LABELS[ambito]}
                  </p>
                  <ul className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {CAMPOS.filter((c) => c.ambito === ambito).map((campo) => (
                      <li key={campo.id} className="flex min-w-0 items-baseline gap-2 text-xs">
                        <Etiqueta mono>{`<<${campo.id}>>`}</Etiqueta>
                        <span className="min-w-0 truncate text-zinc-500 dark:text-zinc-400">
                          {campo.label} · p. ej. {campo.ejemplo}
                        </span>
                      </li>
                    ))}
                  </ul>
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
  const { confirmar, dialogo } = useConfirmar();

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
          ? `Se borrará también su rastro en el historial: ${historial.documentos} documento(s) de tiradas y ${historial.hojas} hoja(s) marcada(s) como hechas. `
          : '';
      const si = await confirmar({
        titulo: `¿Quitar la plantilla «${plantilla.nombre}»?`,
        descripcion: `${arrastra}Los documentos ya generados en Drive no se tocan.`,
        boton: 'Quitar la plantilla',
      });
      if (!si) return;
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
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta className="tabular-nums">{plantilla.orden}</Etiqueta>
            <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{plantilla.nombre}</h3>
            {!plantilla.activa && <Estado tono="neutro">Desactivada</Estado>}
            {lista ? (
              <Estado tono="ok" icono={<Check />}>
                Lista
              </Estado>
            ) : (
              <Estado tono="aviso" icono={<TriangleAlert />}>
                {plantilla.analizadaAt ? `${sinMapear.length} sin mapear` : 'Sin analizar'}
              </Estado>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {REPETICION_LABELS[plantilla.repeticion as keyof typeof REPETICION_LABELS] ?? plantilla.repeticion}
            {` · ${etiquetaEtapas(plantilla)}`}
            {plantilla.tieneFilas ? ' · con tabla de alumnos' : ''}
            {plantilla.generaPdf ? ' · también en PDF' : ' · solo Google Doc'}
            {plantilla.hojasHechas > 0 ? ` · ${plantilla.hojasHechas} hojas hechas este curso` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`https://docs.google.com/document/d/${plantilla.googleDocId}/edit`}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir la plantilla en Google Docs"
            className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
          >
            <ExternalLink />
          </a>
          <Button variant="outline" size="sm" onClick={analizar} disabled={ocupado !== null} cargando={ocupado === 'analizar'}>
            {ocupado !== 'analizar' && <RefreshCw />}
            Analizar
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar los ajustes de la plantilla' : 'Ver los ajustes de la plantilla'}
            onClick={() => setAbierto((v) => !v)}
          >
            <ChevronDown className={cn('transition-transform', abierto && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {abierto && (
        <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre (sale en el nombre del archivo)" id={`pl-nombre-${plantilla.id}`}>
              <Input
                id={`pl-nombre-${plantilla.id}`}
                defaultValue={plantilla.nombre}
                onBlur={(e) => e.target.value !== plantilla.nombre && cambiar({ nombre: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Orden en la carpeta" id={`pl-orden-${plantilla.id}`}>
              <Input
                id={`pl-orden-${plantilla.id}`}
                type="number"
                min={1}
                max={99}
                defaultValue={plantilla.orden}
                onBlur={(e) => Number(e.target.value) !== plantilla.orden && cambiar({ orden: Number(e.target.value) })}
              />
            </Campo>
            <Campo
              etiqueta="Cuántas veces se repite"
              id={`pl-rep-${plantilla.id}`}
              ayuda={REPETICION_AYUDA[plantilla.repeticion as keyof typeof REPETICION_AYUDA]}
            >
              <Selector
                id={`pl-rep-${plantilla.id}`}
                defaultValue={plantilla.repeticion}
                onChange={(e) => cambiar({ repeticion: e.target.value })}
              >
                {REPETICIONES.map((r) => (
                  <option key={r} value={r}>
                    {REPETICION_LABELS[r]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Etapas a las que vale</p>
              <SelectorEtapas etapas={plantilla.etapas} onCambio={(etapas) => cambiar({ etapas })} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Interruptor
              activo={plantilla.generaPdf}
              disabled={ocupado !== null}
              onChange={(v) => cambiar({ generaPdf: v })}
              etiqueta="Generar también el PDF"
            />
            <Interruptor
              activo={plantilla.saltoDePagina}
              disabled={ocupado !== null}
              onChange={(v) => cambiar({ saltoDePagina: v })}
              etiqueta="Salto de página entre copias"
            />
            <Interruptor
              activo={plantilla.activa}
              disabled={ocupado !== null}
              onChange={(v) => cambiar({ activa: v })}
              etiqueta="Activa"
            />
          </div>

          {!plantilla.analizadaAt ? (
            <Aviso tono="aviso">Dale a «Analizar» para leer qué etiquetas tiene esta plantilla.</Aviso>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {sinMapear.length > 0
                    ? `${sinMapear.length} etiqueta(s) por mapear`
                    : `${plantilla.etiquetas.length} etiqueta(s), todas reconocidas`}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setVerTodas((v) => !v)}>
                  {verTodas ? 'Ver solo las que faltan' : 'Ver todas'}
                </Button>
              </div>
              {etiquetasVisibles.length === 0 ? (
                <Aviso tono="ok">Todo mapeado. Esta plantilla ya se puede generar.</Aviso>
              ) : (
                <div className="space-y-2">
                  {etiquetasVisibles.map((etiqueta) => (
                    <div key={etiqueta.clave} className="flex flex-wrap items-center gap-2">
                      <Etiqueta mono>{`<<${etiqueta.cruda}>>`}</Etiqueta>
                      <span aria-hidden className="text-zinc-400">
                        →
                      </span>
                      <Selector
                        aria-label={`Campo para <<${etiqueta.cruda}>>`}
                        value={mapeoLocal[etiqueta.cruda] ?? etiqueta.campo ?? ''}
                        onChange={(e) => setMapeoLocal((m) => ({ ...m, [etiqueta.cruda]: e.target.value }))}
                        className="min-w-48 flex-1"
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
                      </Selector>
                    </div>
                  ))}
                  <Button
                    onClick={guardarMapeo}
                    disabled={ocupado !== null || Object.keys(mapeoLocal).length === 0}
                    cargando={ocupado === 'guardar'}
                  >
                    {ocupado !== 'guardar' && <Check />}
                    Guardar el mapeo
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Button variant="destructive" size="sm" onClick={borrar} disabled={ocupado !== null} cargando={ocupado === 'borrar'}>
              {ocupado !== 'borrar' && <Trash2 />}
              Quitar la plantilla
            </Button>
          </div>
        </div>
      )}
      {dialogo}
    </Tarjeta>
  );
}

/**
 * Qué etapas usan una plantilla. Se marcan las que sean —una, dos o las tres—, y «Todas»
 * es la lista vacía: así una plantilla que valga para todo el colegio no hay que repasarla
 * si algún día aparece una etapa nueva.
 */
function SelectorEtapas({ etapas, onCambio }: { etapas: Etapa[]; onCambio: (etapas: Etapa[]) => void }) {
  const alternar = (etapa: Etapa) => {
    const siguiente = etapas.includes(etapa) ? etapas.filter((e) => e !== etapa) : [...etapas, etapa];
    // Con las tres marcadas, «todas» es lo mismo y se lee mejor.
    onCambio(siguiente.length === ETAPAS_VISIBLES.length ? [] : ETAPAS.filter((e) => siguiente.includes(e)));
  };
  return (
    <Filtros etiqueta="Etapas">
      <Filtro activo={etapas.length === 0} onClick={() => onCambio([])}>
        Todas
      </Filtro>
      {ETAPAS_VISIBLES.map((etapa) => (
        <Filtro key={etapa} activo={etapas.includes(etapa)} onClick={() => alternar(etapa)}>
          {ETAPA_LABELS[etapa]}
        </Filtro>
      ))}
    </Filtros>
  );
}

function NuevaPlantilla({ cuenta }: { cuenta: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [nombre, setNombre] = useState('');
  const [repeticion, setRepeticion] = useState<string>('alumno');
  const [etapas, setEtapas] = useState<Etapa[]>(['ESO']);
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
          etapas,
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
      <TarjetaCabecera icono={<FileText />} titulo="Añadir una plantilla" />
      <TarjetaCuerpo className="space-y-3">
        <Campo etiqueta="Dirección del documento de Google Docs" id="pl-nueva-url">
          <Input
            id="pl-nueva-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
          />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre" id="pl-nueva-nombre" opcional>
            <Input
              id="pl-nueva-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="El del documento"
            />
          </Campo>
          <Campo etiqueta="Cuántas veces se repite" id="pl-nueva-rep">
            <Selector id="pl-nueva-rep" value={repeticion} onChange={(e) => setRepeticion(e.target.value)}>
              {REPETICIONES.map((r) => (
                <option key={r} value={r}>
                  {REPETICION_LABELS[r]}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Etapas a las que vale</p>
          <SelectorEtapas etapas={etapas} onCambio={setEtapas} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={anadir} disabled={url.trim().length < 10} cargando={guardando}>
            {!guardando && <Plus />} Añadir y analizar
          </Button>
          {cuenta && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Antes, comparte el documento con <code className="font-mono text-xs break-all">{cuenta}</code>.
            </p>
          )}
        </div>
      </TarjetaCuerpo>
    </Tarjeta>
  );
}
