'use client';

// Pestaña «Listas»: la lista de clase en Excel, la de toda la vida, pero generada sola.
//
// Es la hermana sencilla de «Generar»: aquí no hay plantillas ni cola ni worker — se eligen
// las clases, se pulsa, y en unos segundos hay una Google Sheet en la carpeta de cada tutor.
// Por eso el progreso es un simple «trabajando» y no una barra: si tardara lo bastante como
// para necesitar barra, tocaría cola, y no la necesita.

import { useMemo, useState } from 'react';
import { ExternalLink, FileSpreadsheet, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { claseKey, type ClaseUI } from '@/components/cuaderno/tipos';
import { SelectorClases } from '@/components/cuaderno/generar-panel';
import { haptic } from '@/lib/haptics';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button } from '@/components/ui/button';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Casilla } from './casilla';

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
      <Tarjeta className="flex items-start gap-3 p-4">
        <Table2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">La lista de clase, en Google Sheets</h2>
          <p className="leading-relaxed">
            Una hoja de cálculo por clase con las mismas 18 columnas de siempre —nº de lista, nombre y apellidos, clase,
            tutor, correo, NIA, nacimiento y los dos familiares con teléfono y correo—, con los números de lista congelados
            del cuaderno de {cursoEscolar}. Cae en la carpeta de Drive de la clase, la misma que los dossieres, así que si ya
            estaba compartida el tutor la ve sin hacer nada.
          </p>
        </div>
      </Tarjeta>

      {!carpetaBaseLista && <Aviso tono="error">Antes hay que fijar la carpeta base de Drive en los ajustes de arriba.</Aviso>}

      <SelectorClases clases={clases} seleccion={seleccion} onCambio={setSeleccion} />

      <Tarjeta>
        <TarjetaCabecera titulo="Cómo se entrega" />
        <TarjetaCuerpo className="space-y-1 py-2">
          <Casilla
            marcada={unSoloArchivo}
            onCambio={setUnSoloArchivo}
            detalle="Una pestaña por clase, en la carpeta del curso escolar. No se comparte con nadie: lleva alumnado de clases que no son de un solo tutor, así que lo repartes tú."
          >
            Un único archivo con todas las clases
          </Casilla>
          <Casilla
            marcada={compartir && !unSoloArchivo}
            onCambio={setCompartir}
            disabled={unSoloArchivo}
            detalle="Permiso nominal sobre la carpeta de la clase (nunca por enlace). Si ya la tenían, no se toca nada."
          >
            Compartir la carpeta con los tutores
          </Casilla>
          <Casilla
            marcada={avisarPorCorreo && compartir && !unSoloArchivo}
            onCambio={setAvisarPorCorreo}
            disabled={unSoloArchivo || !compartir}
            detalle="Un correo por tutor con el enlace a su lista. Sin datos de alumnado dentro."
          >
            Avisarles por correo
          </Casilla>
        </TarjetaCuerpo>
      </Tarjeta>

      {resultado && (
        <Tarjeta>
          <TarjetaCabecera
            titulo="Resultado"
            descripcion={`${resultado.listas.length} ${resultado.listas.length === 1 ? 'archivo' : 'archivos'}`}
          />
          <TarjetaCuerpo className="space-y-2">
            {resultado.errores.map((e) => (
              <Aviso key={e} tono="error">
                {e}
              </Aviso>
            ))}
            {resultado.avisos.map((a) => (
              <Aviso key={a} tono="aviso">
                {a}
              </Aviso>
            ))}
            <ul className="-mx-2">
              {resultado.listas.map((lista) => (
                <li key={lista.url}>
                  <a
                    href={lista.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 flex-wrap items-center gap-x-2 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <FileSpreadsheet aria-hidden className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">{lista.nombre}</span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {lista.alumnos} alumnos
                      {lista.reemplazado && ' · actualizada'}
                      {lista.compartidoCon.length > 0 && ` · compartida con ${lista.compartidoCon.length}`}
                      {lista.avisados.length > 0 && ` · ${lista.avisados.length} avisados`}
                    </span>
                    <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                  </a>
                </li>
              ))}
            </ul>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      <BarraAcciones
        resumen={
          elegidas.length === 0
            ? 'Elige al menos una clase'
            : `${unSoloArchivo ? '1 archivo' : `${elegidas.length} archivos`} · ${totalAlumnos} alumnos`
        }
      >
        <Button onClick={generar} disabled={elegidas.length === 0 || !carpetaBaseLista} cargando={trabajando}>
          {!trabajando && <FileSpreadsheet />}
          {trabajando ? 'Generando…' : 'Generar las listas'}
        </Button>
      </BarraAcciones>
    </div>
  );
}
