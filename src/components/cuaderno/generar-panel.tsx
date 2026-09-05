'use client';

// Pestaña «Generar»: elegir clases y plantillas, ver qué va a salir, y lanzar.
//
// Dos cosas importantes de esta pantalla:
//  1. La **vista previa** es obligatoria en la práctica: enseña los bloqueos (una etiqueta
//     sin mapear, una clase sin repartir) ANTES de disparar 125 documentos.
//  2. El **progreso** se lee de la BBDD por polling. El trabajo lo hace el servidor: se
//     puede cerrar el portátil y volver mañana, y la barra sigue donde tenga que estar.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  ExternalLink,
  FileWarning,
  Loader2,
  Play,
  RotateCcw,
  Square,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Aviso, Tarjeta } from '@/components/cuaderno/cuaderno-panel';
import {
  claseKey,
  ETAPA_LABEL,
  ETAPA_ORDEN,
  plantillaLista,
  type ClaseUI,
  type FaltaUI,
  type ItemUI,
  type PlantillaUI,
} from '@/components/cuaderno/tipos';
import { haptic } from '@/lib/haptics';

interface DocumentoPrevisto {
  plantillaNombre: string;
  clase: string;
  tutorNombre: string;
  numAlumnos: number;
  nombre: string;
}

interface Plan {
  previsto: DocumentoPrevisto[];
  bloqueos: string[];
  avisos: string[];
}

interface Progreso {
  total: number;
  hechos: number;
  errores: number;
  pendientes: number;
  haciendo: number;
  tirada: { id: string; estado: string; numero: number; carpetaCursoUrl: string | null; error: string | null };
  items: ItemUI[];
}

export function GenerarPanel({
  cursoEscolar,
  plantillas,
  clases,
  faltas,
  listoParaGenerar,
}: {
  cursoEscolar: string;
  plantillas: PlantillaUI[];
  clases: ClaseUI[];
  faltas: FaltaUI[];
  listoParaGenerar: boolean;
}) {
  const router = useRouter();
  const activas = useMemo(() => plantillas.filter((p) => p.activa), [plantillas]);

  const [seleccionClases, setSeleccionClases] = useState<Set<string>>(new Set());
  const [seleccionPlantillas, setSeleccionPlantillas] = useState<Set<string>>(
    () => new Set(activas.filter(plantillaLista).map((p) => p.id)),
  );
  const [conPdf, setConPdf] = useState(true);
  const [cuadernoCompletoPdf, setCuadernoCompletoPdf] = useState(false);
  const [compartir, setCompartir] = useState(true);
  const [avisarPorCorreo, setAvisarPorCorreo] = useState(false);
  const [soloSinHoja, setSoloSinHoja] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cargandoPlan, setCargandoPlan] = useState(false);
  const [lanzando, setLanzando] = useState(false);
  const [tiradaId, setTiradaId] = useState<string | null>(null);

  const clasesElegidas = useMemo(
    () => clases.filter((c) => seleccionClases.has(claseKey(c.curso, c.letra))),
    [clases, seleccionClases],
  );

  const porEtapa = useMemo(() => {
    const mapa = new Map<string, ClaseUI[]>();
    for (const clase of clases) {
      const k = clase.etapa ?? 'otras';
      mapa.set(k, [...(mapa.get(k) ?? []), clase]);
    }
    return mapa;
  }, [clases]);

  const cuerpoPeticion = useCallback(
    () => ({
      clases: clasesElegidas.map((c) => ({ curso: c.curso, letra: c.letra })),
      plantillaIds: [...seleccionPlantillas],
      soloSinHoja,
    }),
    [clasesElegidas, seleccionPlantillas, soloSinHoja],
  );

  // La vista previa se recalcula sola al cambiar la selección: al llegar al botón de
  // generar ya se sabe si hay algo que impida lanzarlo.
  useEffect(() => {
    if (tiradaId) return;
    const controlador = new AbortController();
    const temporizador = setTimeout(async () => {
      if (clasesElegidas.length === 0 || seleccionPlantillas.size === 0) {
        setPlan(null);
        return;
      }
      setCargandoPlan(true);
      try {
        const res = await fetch('/api/cuaderno/admin/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(cuerpoPeticion()),
          signal: controlador.signal,
        });
        const datos = await res.json();
        if (!res.ok) throw new Error(datos.error ?? 'No se pudo calcular');
        setPlan({ previsto: datos.previsto ?? [], bloqueos: datos.bloqueos ?? [], avisos: datos.avisos ?? [] });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setPlan(null);
      } finally {
        setCargandoPlan(false);
      }
    }, 350);
    return () => {
      controlador.abort();
      clearTimeout(temporizador);
    };
  }, [cuerpoPeticion, clasesElegidas.length, seleccionPlantillas.size, tiradaId]);

  function alternarClase(clase: ClaseUI) {
    haptic.tap();
    const k = claseKey(clase.curso, clase.letra);
    setSeleccionClases((s) => {
      const nueva = new Set(s);
      if (nueva.has(k)) nueva.delete(k);
      else nueva.add(k);
      return nueva;
    });
  }

  async function lanzar() {
    setLanzando(true);
    try {
      const res = await fetch('/api/cuaderno/admin/tiradas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...cuerpoPeticion(),
          formatos: conPdf ? ['doc', 'pdf'] : ['doc'],
          cuadernoCompletoPdf: conPdf && cuadernoCompletoPdf,
          compartir,
          avisarPorCorreo,
          subcarpetaPropia: soloSinHoja,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo lanzar');
      haptic.success();
      toast.success(`En marcha: ${datos.total} documento(s)`);
      setTiradaId(datos.tirada.id);
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo lanzar');
    } finally {
      setLanzando(false);
    }
  }

  if (tiradaId) {
    return (
      <TiradaEnMarcha
        tiradaId={tiradaId}
        plantillas={plantillas}
        onCerrar={() => {
          setTiradaId(null);
          setPlan(null);
          router.refresh();
        }}
      />
    );
  }

  const bloqueado = !listoParaGenerar || (plan?.bloqueos.length ?? 0) > 0 || (plan?.previsto.length ?? 0) === 0;

  return (
    <div className="space-y-3">
      {!listoParaGenerar && (
        <Aviso tono="ambar">
          Antes de generar hace falta la carpeta base de Drive (arriba, en «Carpeta de Drive»).
        </Aviso>
      )}

      {faltas.length > 0 && (
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                <strong>{faltas.length}</strong> alumno(s) sin todas sus hojas de {cursoEscolar}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic.tap();
                setSoloSinHoja(true);
                setSeleccionClases(new Set(faltas.map((f) => f.clase).flatMap((clase) => clasesDe(clases, clase))));
              }}
              className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Preparar tirada solo para ellos
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {faltas
              .slice(0, 8)
              .map((f) => `${f.clase} · ${f.nombre}`)
              .join(' · ')}
            {faltas.length > 8 ? ` y ${faltas.length - 8} más` : ''}
          </p>
        </Tarjeta>
      )}

      {/* Clases */}
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Clases {seleccionClases.size > 0 && <span className="text-zinc-400">· {seleccionClases.size}</span>}
          </h3>
          <div className="flex gap-1.5">
            <BotonMini onClick={() => setSeleccionClases(new Set(clases.map((c) => claseKey(c.curso, c.letra))))}>
              Todas
            </BotonMini>
            <BotonMini onClick={() => setSeleccionClases(new Set())}>Ninguna</BotonMini>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {[...ETAPA_ORDEN, 'otras'].map((etapa) => {
            const deLaEtapa = porEtapa.get(etapa);
            if (!deLaEtapa || deLaEtapa.length === 0) return null;
            const todasPuestas = deLaEtapa.every((c) => seleccionClases.has(claseKey(c.curso, c.letra)));
            return (
              <div key={etapa}>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {ETAPA_LABEL[etapa as 'EI' | 'EP' | 'ESO'] ?? 'Sin etapa'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSeleccionClases((s) => {
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
                    const elegida = seleccionClases.has(claseKey(clase.curso, clase.letra));
                    const problema = clase.tutores.length === 0 || clase.sinTutorPersonal > 0;
                    return (
                      <button
                        key={claseKey(clase.curso, clase.letra)}
                        type="button"
                        onClick={() => alternarClase(clase)}
                        title={
                          clase.tutores.length === 0
                            ? 'Sin tutor asignado este curso'
                            : clase.sinTutorPersonal > 0
                              ? `${clase.sinTutorPersonal} alumno(s) sin tutor personal: se quedarían fuera`
                              : clase.tutores.map((t) => t.nombre).join(' · ')
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                          elegida
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {problema && <AlertTriangle className="h-3 w-3 text-amber-500" />}
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

      {/* Plantillas */}
      <Tarjeta>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Documentos a generar</h3>
        <div className="mt-3 space-y-1.5">
          {activas.length === 0 && (
            <p className="text-sm text-zinc-500">No hay plantillas activas. Añádelas en la pestaña «Plantillas».</p>
          )}
          {activas.map((plantilla) => {
            const lista = plantillaLista(plantilla);
            const elegida = seleccionPlantillas.has(plantilla.id);
            return (
              <button
                key={plantilla.id}
                type="button"
                disabled={!lista}
                onClick={() => {
                  haptic.tap();
                  setSeleccionPlantillas((s) => {
                    const nueva = new Set(s);
                    if (nueva.has(plantilla.id)) nueva.delete(plantilla.id);
                    else nueva.add(plantilla.id);
                    return nueva;
                  });
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  !lista
                    ? 'cursor-not-allowed bg-zinc-50 opacity-60 dark:bg-zinc-800/50'
                    : elegida
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                    elegida ? 'border-current' : 'border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {elegida ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {plantilla.orden} · {plantilla.nombre}
                  </span>
                  <span className={`block text-xs ${elegida ? 'opacity-70' : 'text-zinc-500'}`}>
                    {plantilla.etapa ?? 'todas las etapas'}
                    {!lista && ' · le faltan etiquetas por mapear'}
                  </span>
                </span>
                {!lista && <FileWarning className="h-4 w-4 shrink-0 text-amber-500" />}
              </button>
            );
          })}
        </div>
      </Tarjeta>

      {/* Opciones */}
      <Tarjeta>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Opciones</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Opcion activo={conPdf} onClick={() => setConPdf((v) => !v)}>
            Generar también el PDF
          </Opcion>
          <Opcion activo={conPdf && cuadernoCompletoPdf} onClick={() => setCuadernoCompletoPdf((v) => !v)}>
            Un PDF con todo el cuaderno de cada tutor
          </Opcion>
          <Opcion activo={compartir} onClick={() => setCompartir((v) => !v)}>
            Compartir la carpeta con sus tutores
          </Opcion>
          <Opcion activo={compartir && avisarPorCorreo} onClick={() => setAvisarPorCorreo((v) => !v)}>
            Avisarles por correo
          </Opcion>
          <Opcion activo={soloSinHoja} onClick={() => setSoloSinHoja((v) => !v)}>
            Solo el alumnado sin hoja
          </Opcion>
        </div>
        {soloSinHoja && (
          <p className="mt-2 text-xs text-zinc-500">
            Los documentos irán a una subcarpeta propia dentro de la carpeta de cada clase, que ya está compartida.
          </p>
        )}
      </Tarjeta>

      {/* Vista previa */}
      {(cargandoPlan || plan) && (
        <Tarjeta>
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">Lo que va a salir</h3>
            {cargandoPlan && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
          </div>
          {plan && (
            <div className="mt-3 space-y-2">
              {plan.bloqueos.map((b) => (
                <Aviso key={b} tono="rojo">
                  {b}
                </Aviso>
              ))}
              {plan.avisos.map((a) => (
                <Aviso key={a} tono="ambar">
                  {a}
                </Aviso>
              ))}
              {plan.previsto.length > 0 && (
                <>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">
                    <strong>{plan.previsto.length}</strong> documento(s) ·{' '}
                    {new Set(plan.previsto.map((p) => p.clase)).size} clase(s) ·{' '}
                    {plan.previsto.reduce((s, p) => s + p.numAlumnos, 0)} hojas de alumno
                  </p>
                  <details className="text-xs text-zinc-500">
                    <summary className="cursor-pointer font-medium">Ver la lista</summary>
                    <ul className="mt-2 space-y-0.5">
                      {plan.previsto.map((p) => (
                        <li key={p.nombre} className="truncate">
                          {p.nombre} <span className="text-zinc-400">· {p.numAlumnos} alumnos</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </div>
          )}
        </Tarjeta>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={lanzar}
          disabled={bloqueado || lanzando}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {lanzando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Generar {plan?.previsto.length ? `${plan.previsto.length} documentos` : 'el cuaderno'}
        </button>
      </div>
    </div>
  );
}

function clasesDe(clases: ClaseUI[], etiqueta: string): string[] {
  return clases.filter((c) => c.clase === etiqueta).map((c) => claseKey(c.curso, c.letra));
}

function BotonMini({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
    >
      {children}
    </button>
  );
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
        activo
          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
      }`}
    >
      {activo && <CheckCheck className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

// ─── Progreso en vivo ─────────────────────────────────────────────────────────

/**
 * Barra de progreso de una tirada. Lee el estado de la BBDD cada 3 segundos; el trabajo lo
 * hace el worker en el servidor, así que se puede cerrar esta pantalla sin parar nada.
 */
export function TiradaEnMarcha({
  tiradaId,
  plantillas,
  onCerrar,
}: {
  tiradaId: string;
  plantillas: PlantillaUI[];
  onCerrar: () => void;
}) {
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const nombrePlantilla = useMemo(() => new Map(plantillas.map((p) => [p.id, p.nombre])), [plantillas]);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    let temporizador: ReturnType<typeof setTimeout>;
    const consultar = async () => {
      try {
        const res = await fetch(`/api/cuaderno/admin/tiradas/${tiradaId}`, { cache: 'no-store' });
        const datos = await res.json();
        if (res.ok && vivo.current) setProgreso(datos);
        const enMarcha = datos?.tirada?.estado === 'pendiente' || datos?.tirada?.estado === 'ejecutando';
        if (vivo.current && enMarcha) temporizador = setTimeout(consultar, 3000);
      } catch {
        if (vivo.current) temporizador = setTimeout(consultar, 6000);
      }
    };
    void consultar();
    return () => {
      vivo.current = false;
      clearTimeout(temporizador);
    };
  }, [tiradaId]);

  async function accion(accion: 'cancelar' | 'reintentar' | 'seguir') {
    setOcupado(true);
    try {
      const res = await fetch(`/api/cuaderno/admin/tiradas/${tiradaId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo');
      toast.success(accion === 'cancelar' ? 'Tirada cancelada' : 'En marcha');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo');
    } finally {
      setOcupado(false);
    }
  }

  if (!progreso) {
    return (
      <Tarjeta>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando la tirada…
        </div>
      </Tarjeta>
    );
  }

  const { total, hechos, errores, tirada } = progreso;
  const porcentaje = total > 0 ? Math.round((hechos / total) * 100) : 0;
  const enMarcha = tirada.estado === 'pendiente' || tirada.estado === 'ejecutando';

  return (
    <div className="space-y-3">
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Ejecución {tirada.numero} ·{' '}
              {enMarcha ? 'en marcha' : tirada.estado === 'hecha' ? 'terminada' : tirada.estado}
            </h3>
            <p className="text-xs text-zinc-500">
              {hechos} de {total} documento(s)
              {errores > 0 ? ` · ${errores} con error` : ''}
            </p>
          </div>
          <div className="flex gap-1.5">
            {tirada.carpetaCursoUrl && (
              <a
                href={tirada.carpetaCursoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Abrir en Drive <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {enMarcha && (
              <button
                type="button"
                onClick={() => accion('cancelar')}
                disabled={ocupado}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400"
              >
                <Square className="h-3.5 w-3.5" /> Parar
              </button>
            )}
            {errores > 0 && (
              <button
                type="button"
                onClick={() => accion('reintentar')}
                disabled={ocupado}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reintentar los fallidos
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" /> Cerrar
            </button>
          </div>
        </div>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${errores > 0 ? 'bg-amber-500' : 'bg-blue-600'}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        {enMarcha && (
          <p className="mt-2 text-xs text-zinc-500">
            Lo está haciendo el servidor: puedes cerrar esta pantalla (o el portátil) y volver luego.
          </p>
        )}
        {tirada.error && <div className="mt-2">{<Aviso tono="ambar">{tirada.error}</Aviso>}</div>}
      </Tarjeta>

      <Tarjeta>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {progreso.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
              <Estado estado={item.estado} />
              <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                {item.indiceTutor}.{' '}
                {nombrePlantilla.get(item.plantillaId) ?? 'Plantilla'} — {item.curso}
                {item.letra} <span className="text-zinc-400">· {item.alumnoIds.length} alumnos</span>
              </span>
              {item.error && <span className="max-w-56 truncate text-amber-600 dark:text-amber-400">{item.error}</span>}
              {item.docUrl && (
                <a href={item.docUrl} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

function Estado({ estado }: { estado: string }) {
  if (estado === 'hecho') return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  if (estado === 'haciendo') return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />;
  if (estado === 'error') return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  if (estado === 'omitido') return <X className="h-3.5 w-3.5 shrink-0 text-zinc-400" />;
  return <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600" />;
}
