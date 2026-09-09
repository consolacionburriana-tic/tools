'use client';

// Pestaña «Listas»: la lista de clase en Excel, la de toda la vida, pero generada sola.
//
// Es la hermana sencilla de «Generar»: aquí no hay plantillas ni cola ni worker — se eligen
// las clases, se pulsa, y en unos segundos hay una Google Sheet en la carpeta de cada tutor.
// Por eso el progreso es un simple «trabajando» y no una barra: si tardara lo bastante como
// para necesitar barra, tocaría cola, y no la necesita.

import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, FileSpreadsheet, Loader2, Table2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Aviso, Tarjeta } from '@/components/cuaderno/cuaderno-panel';
import { claseKey, ETAPA_LABEL, ETAPA_ORDEN, type ClaseUI } from '@/components/cuaderno/tipos';
import { haptic } from '@/lib/haptics';

interface ListaGenerada {
  clase: string;
  nombre: string;
  url: string;
  alumnos: number;
  reemplazado: boolean;
  compartidoCon: string[];
  avisados: string[];
}

interface Resultado {
  listas: ListaGenerada[];
  avisos: string[];
  errores: string[];
}

export function ListasPanel({
  clases,
  cursoEscolar,
  carpetaBaseLista,
}: {
  clases: ClaseUI[];
  cursoEscolar: string;
  carpetaBaseLista: boolean;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [unSoloArchivo, setUnSoloArchivo] = useState(false);
  const [compartir, setCompartir] = useState(true);
  const [avisarPorCorreo, setAvisarPorCorreo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const elegidas = useMemo(() => clases.filter((c) => seleccion.has(claseKey(c.curso, c.letra))), [clases, seleccion]);
  const totalAlumnos = elegidas.reduce((n, c) => n + c.numAlumnos, 0);

  const porEtapa = useMemo(() => {
    const mapa = new Map<string, ClaseUI[]>();
    for (const clase of clases) {
      const k = clase.etapa ?? 'otras';
      mapa.set(k, [...(mapa.get(k) ?? []), clase]);
    }
    return mapa;
  }, [clases]);

  async function generar() {
    if (elegidas.length === 0) return;
    haptic.tap();
    setTrabajando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/cuaderno/admin/listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clases: elegidas.map((c) => ({ curso: c.curso, letra: c.letra })),
          unSoloArchivo,
          compartir,
          avisarPorCorreo,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo generar');
      setResultado(datos as Resultado);
      const hechas = (datos as Resultado).listas.length;
      if ((datos as Resultado).errores.length > 0) {
        haptic.warning();
        toast.warning(`${hechas} lista(s) hechas, ${(datos as Resultado).errores.length} con error`);
      } else {
        haptic.success();
        toast.success(hechas === 1 ? 'Lista generada' : `${hechas} listas generadas`);
      }
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo generar');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <div className="flex items-start gap-3">
          <Table2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">La lista de clase, en Google Sheets</p>
            <p className="text-[13px] leading-relaxed">
              Una hoja de cálculo por clase con las mismas 18 columnas de siempre —nº de lista, nombre y apellidos,
              clase, tutor, correo, NIA, nacimiento y los dos familiares con teléfono y correo—, con los números de
              lista congelados del cuaderno de {cursoEscolar}. Cae en la carpeta de Drive de la clase, la misma que
              los dossieres, así que si ya estaba compartida el tutor la ve sin hacer nada.
            </p>
          </div>
        </div>
      </Tarjeta>

      {!carpetaBaseLista && (
        <Aviso tono="rojo">Antes hay que fijar la carpeta base de Drive en los ajustes de arriba.</Aviso>
      )}

      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Clases {seleccion.size > 0 && <span className="text-zinc-400">· {seleccion.size}</span>}
          </h3>
          <div className="flex gap-1.5">
            <BotonMini onClick={() => setSeleccion(new Set(clases.map((c) => claseKey(c.curso, c.letra))))}>
              Todas
            </BotonMini>
            <BotonMini onClick={() => setSeleccion(new Set())}>Ninguna</BotonMini>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {[...ETAPA_ORDEN, 'otras'].map((etapa) => {
            const deLaEtapa = porEtapa.get(etapa);
            if (!deLaEtapa || deLaEtapa.length === 0) return null;
            const todasPuestas = deLaEtapa.every((c) => seleccion.has(claseKey(c.curso, c.letra)));
            return (
              <div key={etapa}>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {ETAPA_LABEL[etapa as 'EI' | 'EP' | 'ESO'] ?? 'Sin etapa'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSeleccion((s) => {
                        const nueva = new Set(s);
                        for (const c of deLaEtapa) {
                          const k = claseKey(c.curso, c.letra);
                          if (todasPuestas) nueva.delete(k);
                          else nueva.add(k);
                        }
                        return nueva;
                      })
                    }
                    className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {todasPuestas ? 'quitar' : 'todas'}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {deLaEtapa.map((clase) => {
                    const elegida = seleccion.has(claseKey(clase.curso, clase.letra));
                    return (
                      <button
                        key={claseKey(clase.curso, clase.letra)}
                        type="button"
                        onClick={() => {
                          haptic.tap();
                          setSeleccion((s) => {
                            const nueva = new Set(s);
                            const k = claseKey(clase.curso, clase.letra);
                            if (nueva.has(k)) nueva.delete(k);
                            else nueva.add(k);
                            return nueva;
                          });
                        }}
                        title={
                          clase.tutores.length === 0
                            ? 'Sin tutor asignado este curso: la lista se genera igual, pero no hay con quién compartirla'
                            : clase.tutores.map((t) => t.nombre).join(' · ')
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                          elegida
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {clase.tutores.length === 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        <span>{clase.clase}</span>
                        <span className={elegida ? 'opacity-60' : 'text-zinc-400'}>{clase.numAlumnos}</span>
                        {clase.tutores.length > 0 && (
                          <span className={elegida ? 'opacity-60' : 'text-zinc-400'}>
                            · {clase.tutores.map((t) => t.corto).join(' + ')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Cómo se entrega</h3>
        <div className="mt-2 space-y-1">
          <Interruptor
            puesto={unSoloArchivo}
            onChange={setUnSoloArchivo}
            titulo="Un único archivo con todas las clases"
            detalle="Una pestaña por clase, en la carpeta del curso escolar. No se comparte con nadie: lleva alumnado de clases que no son de un solo tutor, así que lo repartes tú."
          />
          <Interruptor
            puesto={compartir && !unSoloArchivo}
            onChange={setCompartir}
            desactivado={unSoloArchivo}
            titulo="Compartir la carpeta con los tutores"
            detalle="Permiso nominal sobre la carpeta de la clase (nunca por enlace). Si ya la tenían, no se toca nada."
          />
          <Interruptor
            puesto={avisarPorCorreo && compartir && !unSoloArchivo}
            onChange={setAvisarPorCorreo}
            desactivado={unSoloArchivo || !compartir}
            titulo="Avisarles por correo"
            detalle="Un correo por tutor con el enlace a su lista. Sin datos de alumnado dentro."
          />
        </div>
      </Tarjeta>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            {elegidas.length === 0 ? (
              'Elige al menos una clase'
            ) : (
              <>
                <Users className="mr-1 inline h-3.5 w-3.5" />
                {unSoloArchivo ? '1 archivo' : `${elegidas.length} archivo(s)`} · {elegidas.length} clase(s) ·{' '}
                {totalAlumnos} alumnos
              </>
            )}
          </p>
          <button
            type="button"
            onClick={generar}
            disabled={trabajando || elegidas.length === 0 || !carpetaBaseLista}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            {trabajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {trabajando ? 'Generando…' : 'Generar las listas'}
          </button>
        </div>
      </div>

      {resultado && (
        <Tarjeta>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Resultado <span className="text-zinc-400">· {resultado.listas.length} archivo(s)</span>
          </h3>
          {resultado.errores.length > 0 && (
            <div className="mt-2 space-y-1">
              {resultado.errores.map((e) => (
                <Aviso key={e} tono="rojo">
                  {e}
                </Aviso>
              ))}
            </div>
          )}
          {resultado.avisos.length > 0 && (
            <div className="mt-2 space-y-1">
              {resultado.avisos.map((a) => (
                <Aviso key={a} tono="ambar">
                  {a}
                </Aviso>
              ))}
            </div>
          )}
          <div className="mt-2 space-y-1">
            {resultado.listas.map((lista) => (
              <a
                key={lista.url}
                href={lista.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{lista.nombre}</span>
                <span className="shrink-0 text-zinc-400">
                  {lista.alumnos} alumnos
                  {lista.reemplazado && ' · actualizada'}
                  {lista.compartidoCon.length > 0 && ` · compartida con ${lista.compartidoCon.length}`}
                  {lista.avisados.length > 0 && ` · avisado(s) ${lista.avisados.length}`}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
              </a>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

function BotonMini({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function Interruptor({
  puesto,
  onChange,
  titulo,
  detalle,
  desactivado,
}: {
  puesto: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  detalle: string;
  desactivado?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={desactivado}
      onClick={() => {
        haptic.tap();
        onChange(!puesto);
      }}
      className={`flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
        desactivado ? 'opacity-40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          puesto ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition-transform ${puesto ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{titulo}</span>
        <span className="block text-[12px] leading-relaxed text-zinc-500">{detalle}</span>
      </span>
    </button>
  );
}
