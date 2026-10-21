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
  CheckCheck,
  ExternalLink,
  FileWarning,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Square,
  TriangleAlert,
  UserPlus,
  X,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  claseKey,
  ETAPA_LABEL,
  ETAPA_ORDEN,
  plantillaLista,
  type ClaseUI,
  type EventoUI,
  type FaltaUI,
  type ItemUI,
  type PlantillaUI,
} from '@/components/cuaderno/tipos';
import { etiquetaEtapas } from '@/lib/cuaderno/campos';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { Etapa } from '@/lib/cursos';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { EnCurso, Progreso } from '@/components/ui/progreso';
import { Rotulo } from '@/components/ui/rotulo';
import { Estado } from '@/components/ui/estado';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Casilla } from './casilla';

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
  tirada: {
    id: string;
    estado: string;
    numero: number;
    carpetaCursoUrl: string | null;
    error: string | null;
    createdAt: string;
    latidoAt: string | null;
    pases: number;
  };
  items: ItemUI[];
  eventos: EventoUI[];
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
  const documentos = plan?.previsto.length ?? 0;

  return (
    <div className="space-y-3">
      {!listoParaGenerar && (
        <Aviso tono="aviso">Antes de generar hace falta la carpeta base de Drive (arriba, en «Carpeta de Drive»).</Aviso>
      )}

      {faltas.length > 0 && (
        <Aviso
          tono="aviso"
          icono={<UserPlus />}
          titulo={`${faltas.length} ${faltas.length === 1 ? 'alumno' : 'alumnos'} sin todas sus hojas de ${cursoEscolar}`}
        >
          <p>
            {faltas
              .slice(0, 8)
              .map((f) => `${f.clase} · ${f.nombre}`)
              .join(' · ')}
            {faltas.length > 8 ? ` y ${faltas.length - 8} más` : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              haptic.tap();
              setSoloSinHoja(true);
              setSeleccionClases(new Set(faltas.map((f) => f.clase).flatMap((clase) => clasesDe(clases, clase))));
            }}
          >
            Preparar tirada solo para ellos
          </Button>
        </Aviso>
      )}

      {/* Clases */}
      <SelectorClases clases={clases} seleccion={seleccionClases} onCambio={setSeleccionClases} conProblemas />

      {/* Plantillas */}
      <Tarjeta>
        <TarjetaCabecera titulo="Documentos a generar" descripcion="Las que están listas salen ya marcadas." />
        <TarjetaCuerpo className="space-y-1 py-2">
          {activas.length === 0 && (
            <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400">
              No hay plantillas activas. Añádelas en «Plantillas».
            </p>
          )}
          {activas.map((plantilla) => {
            const lista = plantillaLista(plantilla);
            return (
              <Casilla
                key={plantilla.id}
                marcada={seleccionPlantillas.has(plantilla.id)}
                disabled={!lista}
                onCambio={() =>
                  setSeleccionPlantillas((s) => {
                    const nueva = new Set(s);
                    if (nueva.has(plantilla.id)) nueva.delete(plantilla.id);
                    else nueva.add(plantilla.id);
                    return nueva;
                  })
                }
                detalle={
                  <>
                    {etiquetaEtapas(plantilla)}
                    {!lista && (
                      <span className="ml-1 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        · <FileWarning aria-hidden className="h-3.5 w-3.5" /> le faltan etiquetas por mapear
                      </span>
                    )}
                  </>
                }
              >
                <span className="font-medium">
                  {plantilla.orden} · {plantilla.nombre}
                </span>
              </Casilla>
            );
          })}
        </TarjetaCuerpo>
      </Tarjeta>

      {/* Opciones */}
      <Tarjeta>
        <TarjetaCabecera titulo="Opciones" />
        <TarjetaCuerpo className="grid gap-x-6 py-2 sm:grid-cols-2">
          <Casilla marcada={conPdf} onCambio={setConPdf}>
            Generar también el PDF
          </Casilla>
          <Casilla marcada={conPdf && cuadernoCompletoPdf} disabled={!conPdf} onCambio={setCuadernoCompletoPdf}>
            Un PDF con todo el cuaderno de cada tutor
          </Casilla>
          <Casilla marcada={compartir} onCambio={setCompartir}>
            Compartir la carpeta con sus tutores
          </Casilla>
          <Casilla marcada={compartir && avisarPorCorreo} disabled={!compartir} onCambio={setAvisarPorCorreo}>
            Avisarles por correo
          </Casilla>
          <Casilla
            marcada={soloSinHoja}
            onCambio={setSoloSinHoja}
            detalle={
              soloSinHoja
                ? 'Los documentos irán a una subcarpeta propia dentro de la carpeta de cada clase, que ya está compartida.'
                : undefined
            }
          >
            Solo el alumnado sin hoja
          </Casilla>
        </TarjetaCuerpo>
      </Tarjeta>

      {/* Vista previa */}
      {(cargandoPlan || plan) && (
        <Tarjeta>
          <TarjetaCabecera
            titulo="Lo que va a salir"
            accion={cargandoPlan ? <Loader2 aria-label="Calculando" className="h-4 w-4 animate-spin text-zinc-500" /> : undefined}
          />
          {plan && (
            <TarjetaCuerpo className="space-y-2">
              {plan.bloqueos.map((b) => (
                <Aviso key={b} tono="error">
                  {b}
                </Aviso>
              ))}
              {plan.avisos.map((a) => (
                <Aviso key={a} tono="aviso">
                  {a}
                </Aviso>
              ))}
              {plan.previsto.length > 0 && (
                <>
                  <p className="text-sm text-zinc-700 tabular-nums dark:text-zinc-200">
                    <strong>{plan.previsto.length}</strong> {plan.previsto.length === 1 ? 'documento' : 'documentos'} ·{' '}
                    {new Set(plan.previsto.map((p) => p.clase)).size} clase(s) ·{' '}
                    {plan.previsto.reduce((s, p) => s + p.numAlumnos, 0)} hojas de alumno
                  </p>
                  <details className="group text-sm text-zinc-600 dark:text-zinc-400">
                    <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-xl font-medium text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
                      Ver la lista
                      <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {plan.previsto.map((p) => (
                        <li key={p.nombre} className="truncate">
                          {p.nombre} <span className="text-zinc-500">· {p.numAlumnos} alumnos</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </TarjetaCuerpo>
          )}
        </Tarjeta>
      )}

      <BarraAcciones
        resumen={
          seleccionClases.size === 0 || seleccionPlantillas.size === 0
            ? 'Elige clases y documentos'
            : documentos > 0
              ? `${documentos} ${documentos === 1 ? 'documento' : 'documentos'} · ${seleccionClases.size} ${seleccionClases.size === 1 ? 'clase' : 'clases'}`
              : undefined
        }
      >
        <Button onClick={lanzar} disabled={bloqueado} cargando={lanzando}>
          {!lanzando && <Play />}
          Generar {documentos ? `${documentos} documentos` : 'el cuaderno'}
        </Button>
      </BarraAcciones>
    </div>
  );
}

function clasesDe(clases: ClaseUI[], etiqueta: string): string[] {
  return clases.filter((c) => c.clase === etiqueta).map((c) => claseKey(c.curso, c.letra));
}

/**
 * Elegir clases por etapa, con sus tutores al lado. Lo usan «Generar» y «Listas». Con
 * `conProblemas`, debajo de cada etapa se dice qué clases no tienen tutor (o tienen alumnado
 * sin tutor personal), que es lo que antes solo contaba el `title` de cada pastilla.
 */
export function SelectorClases({
  clases,
  seleccion,
  onCambio,
  conProblemas = false,
}: {
  clases: ClaseUI[];
  seleccion: Set<string>;
  onCambio: (s: Set<string>) => void;
  conProblemas?: boolean;
}) {
  const porEtapa = useMemo(() => {
    const mapa = new Map<string, ClaseUI[]>();
    for (const clase of clases) {
      const k = clase.etapa ?? 'otras';
      mapa.set(k, [...(mapa.get(k) ?? []), clase]);
    }
    return mapa;
  }, [clases]);

  function alternar(k: string) {
    const nueva = new Set(seleccion);
    if (nueva.has(k)) nueva.delete(k);
    else nueva.add(k);
    onCambio(nueva);
  }

  return (
    <Tarjeta>
      <TarjetaCabecera
        titulo="Clases"
        descripcion={seleccion.size === 0 ? 'Toca las que quieras' : seleccion.size === 1 ? '1 elegida' : `${seleccion.size} elegidas`}
        accion={
          <>
            <Button variant="outline" size="sm" onClick={() => onCambio(new Set(clases.map((c) => claseKey(c.curso, c.letra))))}>
              Todas
            </Button>
            <Button variant="outline" size="sm" onClick={() => onCambio(new Set())}>
              Ninguna
            </Button>
          </>
        }
      />
      <TarjetaCuerpo className="space-y-4">
        {[...ETAPA_ORDEN, 'otras'].map((etapa) => {
          const deLaEtapa = porEtapa.get(etapa);
          if (!deLaEtapa || deLaEtapa.length === 0) return null;
          const todasPuestas = deLaEtapa.every((c) => seleccion.has(claseKey(c.curso, c.letra)));
          const problemas = deLaEtapa.filter((c) => c.tutores.length === 0 || (conProblemas && c.sinTutorPersonal > 0));
          return (
            <div key={etapa} className="space-y-2">
              <Rotulo
                as="h3"
                accion={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nueva = new Set(seleccion);
                      for (const c of deLaEtapa) {
                        const k = claseKey(c.curso, c.letra);
                        if (todasPuestas) nueva.delete(k);
                        else nueva.add(k);
                      }
                      onCambio(nueva);
                    }}
                  >
                    {todasPuestas ? 'Quitar todas' : 'Todas'}
                  </Button>
                }
              >
                {ETAPA_LABEL[etapa as Etapa] ?? 'Sin etapa'}
              </Rotulo>
              <Filtros etiqueta={`Clases de ${ETAPA_LABEL[etapa as Etapa] ?? 'otras etapas'}`}>
                {deLaEtapa.map((clase) => {
                  const k = claseKey(clase.curso, clase.letra);
                  const problema = clase.tutores.length === 0 || (conProblemas && clase.sinTutorPersonal > 0);
                  return (
                    <Filtro
                      key={k}
                      activo={seleccion.has(k)}
                      onClick={() => alternar(k)}
                      cuenta={clase.numAlumnos}
                      icono={problema ? <TriangleAlert aria-label="Con aviso" className="text-amber-500" /> : undefined}
                    >
                      {clase.clase}
                      {clase.tutores.length > 0 && (
                        <span className="font-normal opacity-70">· {clase.tutores.map((t) => t.corto).join(' + ')}</span>
                      )}
                    </Filtro>
                  );
                })}
              </Filtros>
              {problemas.length > 0 && (
                <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {problemas.map((c) => (
                    <li key={claseKey(c.curso, c.letra)}>
                      {c.clase}:{' '}
                      {c.tutores.length === 0
                        ? conProblemas
                          ? 'sin tutor asignado este curso'
                          : 'sin tutor asignado: la lista se genera igual, pero no hay con quién compartirla'
                        : `${c.sinTutorPersonal} ${c.sinTutorPersonal === 1 ? 'alumno' : 'alumnos'} sin tutor personal: se quedarían fuera`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </TarjetaCuerpo>
    </Tarjeta>
  );
}

// ─── Progreso en vivo ─────────────────────────────────────────────────────────

/**
 * El progreso de una tirada. Lee el estado de la BBDD cada 3 segundos; el trabajo lo hace el
 * worker en el servidor, así que se puede cerrar esta pantalla sin parar nada.
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

  if (!progreso) return <EnCurso texto="Preparando la tirada…" />;

  const { total, hechos, errores, tirada } = progreso;
  const enMarcha = tirada.estado === 'pendiente' || tirada.estado === 'ejecutando';
  // Lo que le faltaba al panel: decir POR QUÉ no pasa nada. Con el latido y los pases del
  // worker se distingue «va lento» de «no ha arrancado nunca», que es lo que pasó de verdad.
  const desdeLatido = tirada.latidoAt ? Date.now() - new Date(tirada.latidoAt).getTime() : null;
  const desdeCreada = Date.now() - new Date(tirada.createdAt).getTime();
  const diagnostico =
    !enMarcha
      ? null
      : tirada.pases === 0 && desdeCreada > 20_000
        ? 'Lleva encolada más de 20 segundos y el worker todavía no ha pasado por ella.'
        : desdeLatido !== null && desdeLatido > 150_000
          ? `Sin señales del worker desde hace ${Math.round(desdeLatido / 60_000)} min.`
          : null;

  return (
    <div className="space-y-3">
      <Tarjeta>
        <TarjetaCabecera
          titulo={`Ejecución ${tirada.numero}`}
          descripcion={
            <>
              {hechos} de {total} {total === 1 ? 'documento' : 'documentos'}
              {errores > 0 ? ` · ${errores} con error` : ''}
            </>
          }
          accion={<EstadoTirada estado={tirada.estado} />}
        />
        <TarjetaCuerpo className="space-y-3">
          {enMarcha ? (
            <EnCurso
              texto={diagnostico ?? 'Lo está haciendo el servidor: puedes cerrar esta pantalla (o el portátil) y volver luego.'}
              hechos={hechos}
              total={total}
            />
          ) : (
            <Progreso hechos={hechos} total={total} etiqueta={`Documentos de la ejecución ${tirada.numero}`} cuenta />
          )}
          {tirada.error && <Aviso tono="aviso">{tirada.error}</Aviso>}
          {enMarcha && diagnostico && (
            <Aviso tono="aviso">
              El worker no ha dado señales de vida. Pulsa «Seguir ahora» para empujarla desde aquí; si vuelve a quedarse
              parada, mira la bitácora de abajo.
            </Aviso>
          )}
          <div className="flex flex-wrap gap-2">
            {enMarcha && (
              <Button size="sm" onClick={() => accion('seguir')} disabled={ocupado}>
                <RefreshCw className={cn(ocupado && 'animate-spin')} /> Seguir ahora
              </Button>
            )}
            {errores > 0 && (
              <Button size="sm" variant={enMarcha ? 'outline' : 'default'} onClick={() => accion('reintentar')} disabled={ocupado}>
                <RotateCcw /> Reintentar los fallidos
              </Button>
            )}
            {tirada.carpetaCursoUrl && (
              <a
                href={tirada.carpetaCursoUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Abrir en Drive <ExternalLink aria-hidden />
              </a>
            )}
            {enMarcha && (
              <Button size="sm" variant="destructive" onClick={() => accion('cancelar')} disabled={ocupado}>
                <Square /> Parar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onCerrar}>
              <X /> Cerrar
            </Button>
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Bitacora eventos={progreso.eventos ?? []} />

      <Tarjeta>
        <TarjetaCabecera titulo="Documentos" descripcion={`${progreso.items.length} en esta ejecución`} />
        <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {progreso.items.map((item) => (
            <li key={item.id} className="flex min-h-11 items-center gap-2 px-4 py-1 text-sm">
              <IconoItem estado={item.estado} />
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                {item.indiceTutor}. {nombrePlantilla.get(item.plantillaId) ?? 'Plantilla'} — {item.curso}
                {item.letra}{' '}
                <span className="text-zinc-500 dark:text-zinc-400">· {item.alumnoIds.length} alumnos</span>
              </span>
              {item.error && (
                <span className="max-w-56 truncate text-xs text-amber-700 dark:text-amber-400">{item.error}</span>
              )}
              {item.docUrl && (
                <a
                  href={item.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir el documento"
                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm', className: 'text-blue-700 dark:text-blue-400' })}
                >
                  <ExternalLink />
                </a>
              )}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}

const ESTADO_TIRADA: Record<string, { texto: string; tono: 'ok' | 'aviso' | 'error' | 'info' | 'neutro' }> = {
  pendiente: { texto: 'En cola', tono: 'neutro' },
  ejecutando: { texto: 'En marcha', tono: 'info' },
  hecha: { texto: 'Terminada', tono: 'ok' },
  error: { texto: 'Con errores', tono: 'error' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
};

/** El estado de una tirada en su pastilla (también lo usa el historial). */
export function EstadoTirada({ estado }: { estado: string }) {
  const e = ESTADO_TIRADA[estado] ?? { texto: estado, tono: 'neutro' as const };
  return <Estado tono={e.tono}>{e.texto}</Estado>;
}

/**
 * La bitácora de la tirada, tal cual la escribió el servidor. Es la respuesta a «no me
 * dice nada»: cada pase del worker, cada documento y cada fallo de Drive deja su línea.
 */
function Bitacora({ eventos }: { eventos: EventoUI[] }) {
  const [abierta, setAbierta] = useState(true);
  if (eventos.length === 0) return null;
  const color = (nivel: string) =>
    nivel === 'error'
      ? 'text-red-700 dark:text-red-400'
      : nivel === 'aviso'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-zinc-700 dark:text-zinc-300';
  return (
    <Tarjeta>
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => {
          haptic.tap();
          setAbierta((a) => !a);
        }}
        className="flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ScrollText aria-hidden className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <span className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Bitácora <span className="font-normal text-zinc-500 dark:text-zinc-400">· {eventos.length} líneas</span>
        </span>
        <ChevronDown aria-hidden className={cn('h-4 w-4 text-zinc-500 transition-transform', abierta && 'rotate-180')} />
      </button>
      {abierta && (
        <div className="max-h-72 space-y-0.5 overflow-y-auto border-t border-zinc-100 px-4 py-3 font-mono text-xs leading-relaxed dark:border-zinc-800">
          {eventos.map((evento) => (
            <div key={evento.id} className="flex gap-2">
              <span className="shrink-0 text-zinc-500 tabular-nums dark:text-zinc-400">
                {new Date(evento.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{evento.fase}</span>
              <span className={cn('min-w-0 flex-1', color(evento.nivel))}>{evento.mensaje}</span>
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

const TEXTO_ITEM: Record<string, string> = {
  hecho: 'Hecho',
  haciendo: 'Haciéndose',
  error: 'Con error',
  omitido: 'Omitido',
};

/** Icono del estado de un documento, con su nombre para el lector de pantalla. */
function IconoItem({ estado }: { estado: string }) {
  const texto = <span className="sr-only">{TEXTO_ITEM[estado] ?? 'Pendiente'}:</span>;
  if (estado === 'hecho') return <>{texto}<CheckCheck aria-hidden className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /></>;
  if (estado === 'haciendo') return <>{texto}<Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" /></>;
  if (estado === 'error') return <>{texto}<TriangleAlert aria-hidden className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" /></>;
  if (estado === 'omitido') return <>{texto}<X aria-hidden className="h-4 w-4 shrink-0 text-zinc-500" /></>;
  return <>{texto}<span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600" /></>;
}
