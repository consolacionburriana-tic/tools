'use client';

// Navegador de alumnado: clases → lista → ficha.
//
// Tres decisiones que son las que hacen que vaya rápido:
//
//  1. **La lista entera viaja en el HTML de la página** (639 alumnos, ~90 KB de texto). Así
//     buscar y cambiar de clase NO cuesta ni una petición: se filtra en memoria y se pinta
//     en el mismo frame. La ficha, que sí es cara, se pide al abrirla.
//  2. **Las clases son un carril fijo, no un desplegable.** Son 28 y son las mismas todos
//     los años (dicho por David), así que caben a la vista: dos toques menos que un select
//     y se ve de un golpe dónde estás. Va **a lo ancho y arriba**, no en la columna de la
//     lista: en la columna ocupaba diez filas y dejaba la lista por debajo del pliegue.
//     Sin clase elegida se ve el centro entero, para que la pantalla nunca esté muerta.
//  3. **Las fichas ya abiertas se quedan en una caché** del cliente. Ir y venir entre dos
//     hermanos, o volver a un alumno que acabas de mirar, es instantáneo.
//
// El alumno abierto vive en la URL (`?alumno=<id>`), así que la pantalla se puede recargar,
// compartir o volver atrás con el botón del navegador y sigue donde estaba.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookMarked, Library, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { FichaAlumnoPanel, useEscape } from '@/components/alumnado/ficha-alumno';
import { casaBusqueda, colorAvatar, iniciales } from '@/lib/alumnado';
import type { AlumnoLista, ClaseListado, FichaAlumno } from '@/lib/alumnado-server';
import { haptic } from '@/lib/haptics';

const ETAPA_ORDEN = ['EI', 'EP', 'ESO'] as const;
const ETAPA_LABEL: Record<string, string> = { EI: 'Infantil', EP: 'Primaria', ESO: 'Secundaria', otras: 'Otras' };

const claveClase = (c: { curso: string; letra: string | null }) => `${c.curso}|${c.letra ?? ''}`;

export function AlumnadoPanel({
  alumnos,
  clases,
  soloMisClases,
  fichaInicial,
}: {
  alumnos: AlumnoLista[];
  clases: ClaseListado[];
  soloMisClases: boolean;
  /** La ficha de `?alumno=…`, ya resuelta en el servidor. Ver el comentario de arriba. */
  fichaInicial: FichaAlumno | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const abiertoId = params.get('alumno');

  // Con una sola clase (un tutor) no hay nada que elegir: se entra ya dentro de la suya.
  // Con varias, `null` = todas, que es una lista útil y no una pantalla en blanco.
  const [clase, setClase] = useState<string | null>(clases.length === 1 ? claveClase(clases[0]) : null);
  const [termino, setTermino] = useState('');
  // La caché arranca con la ficha que ya trae el servidor, si se ha entrado por enlace.
  const [fichas, setFichas] = useState<Record<string, FichaAlumno>>(() =>
    fichaInicial ? { [fichaInicial.id]: fichaInicial } : {},
  );
  const [fallidas, setFallidas] = useState<Record<string, true>>({});
  // Ids ya pedidos (o en vuelo), para no pedir dos veces lo mismo. Solo se toca dentro de
  // manejadores y efectos, nunca durante el render.
  const pedidas = useRef<Set<string>>(new Set(fichaInicial ? [fichaInicial.id] : []));
  const buscador = useRef<HTMLInputElement>(null);

  const porEtapa = useMemo(() => {
    const mapa = new Map<string, ClaseListado[]>();
    for (const c of clases) {
      const k = c.etapa ?? 'otras';
      mapa.set(k, [...(mapa.get(k) ?? []), c]);
    }
    return mapa;
  }, [clases]);

  // Buscar manda sobre la clase elegida: si escribes «roldan», quieres encontrarlo esté
  // donde esté, no que te digan que en 2ºA no hay ningún Roldán.
  const buscando = termino.trim().length >= 2;
  const visibles = useMemo(() => {
    if (buscando) return alumnos.filter((a) => casaBusqueda(a.busca, termino)).slice(0, 60);
    if (!clase) return alumnos;
    return alumnos.filter((a) => claveClase(a) === clase);
  }, [alumnos, buscando, termino, clase]);

  /** Trae la ficha y la guarda en la caché. Idempotente: un id solo se pide una vez. */
  const cargarFicha = useCallback(async (id: string) => {
    if (pedidas.current.has(id)) return;
    pedidas.current.add(id);
    try {
      const res = await fetch(`/api/alumnado/${id}`);
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'No se pudo abrir la ficha');
      setFichas((f) => ({ ...f, [id]: datos.ficha as FichaAlumno }));
    } catch (error) {
      // Sin esto, un id que falla deja el panel girando para siempre. Y se saca de
      // `pedidas` para que reintentarlo (volver a tocar el alumno) vuelva a probar.
      pedidas.current.delete(id);
      setFallidas((f) => ({ ...f, [id]: true }));
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir la ficha');
    }
  }, []);

  const abrir = useCallback(
    (id: string) => {
      haptic.tap();
      const url = new URL(window.location.href);
      url.searchParams.set('alumno', id);
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
      void cargarFicha(id);
    },
    [cargarFicha, router],
  );

  const cerrar = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('alumno');
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [router]);

  // La ficha de la primera carga viene del servidor, así que aquí NO se busca nada al
  // montar. Lo único que hay que atender es el botón «atrás»/«adelante» del navegador:
  // cambia la URL sin pasar por `abrir`, y la ficha de destino puede no estar en caché.
  useEffect(() => {
    const alVolver = () => {
      const id = new URLSearchParams(window.location.search).get('alumno');
      if (id) void cargarFicha(id);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [cargarFicha]);

  useEscape(Boolean(abiertoId), cerrar);

  // `/` enfoca el buscador, como en todas partes. No se roba la tecla si ya se está
  // escribiendo en un campo.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      if (destino && /^(INPUT|TEXTAREA|SELECT)$/.test(destino.tagName)) return;
      if (e.key === '/') {
        e.preventDefault();
        buscador.current?.focus();
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  const ficha = abiertoId ? (fichas[abiertoId] ?? null) : null;
  // Derivado, no estado: está cargando si hay alguien abierto, no tenemos su ficha y no ha
  // fallado. Una verdad menos que mantener sincronizada a mano.
  const cargando = Boolean(abiertoId) && !ficha && !(abiertoId && fallidas[abiertoId]);
  const claseActual = clases.find((c) => claveClase(c) === clase);

  return (
    <div className="space-y-3">
      {/* ── Carril de clases, a lo ancho: se ve el centro entero de un golpe ── */}
      {clases.length > 1 && (
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {[...ETAPA_ORDEN, 'otras'].map((etapa) => {
            const deLaEtapa = porEtapa.get(etapa);
            if (!deLaEtapa || deLaEtapa.length === 0) return null;
            return (
              <div key={etapa} className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {ETAPA_LABEL[etapa]}
                </p>
                <div className="flex flex-wrap gap-1">
                  {deLaEtapa.map((c) => {
                    const k = claveClase(c);
                    const puesta = clase === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          haptic.tap();
                          setClase(puesta ? null : k);
                        }}
                        title={c.tutores.length > 0 ? c.tutores.join(' + ') : 'Sin tutor asignado'}
                        className={`inline-flex items-baseline gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          puesta
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {c.clase}
                        <span className={puesta ? 'opacity-60' : 'text-zinc-400'}>{c.alumnos}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {clase && (
            <button
              type="button"
              onClick={() => {
                haptic.tap();
                setClase(null);
              }}
              className="mt-4 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            >
              ver todas
            </button>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-5">
      {/* ── Columna izquierda: buscador + lista ─────────────────────── */}
      <div className={`space-y-3 ${abiertoId ? 'hidden lg:block' : ''}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            ref={buscador}
            type="search"
            inputMode="search"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="Buscar por nombre, NIA o DNI…"
            aria-label="Buscar alumnado"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-blue-900/40"
          />
          {termino && (
            <button
              type="button"
              onClick={() => setTermino('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Limpiar la búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500">
              {buscando
                ? `${visibles.length} resultado(s)`
                : claseActual
                  ? `${claseActual.clase} · ${visibles.length} alumnos`
                  : `Todo el centro · ${visibles.length} alumnos`}
            </p>
            {claseActual && claseActual.tutores.length > 0 && !buscando && (
              <p className="truncate text-xs text-zinc-400">{claseActual.tutores.join(' + ')}</p>
            )}
          </div>

          {visibles.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-400">
              {buscando ? 'Nadie con ese nombre, NIA ni DNI.' : 'No hay alumnado activo aquí.'}
            </p>
          ) : (
            <ul className="max-h-[calc(100vh-16rem)] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
              {visibles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => abrir(a.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      abiertoId === a.id
                        ? 'bg-blue-50 dark:bg-blue-950/30'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold ${colorAvatar(a.id)}`}
                    >
                      {iniciales(a.nombre, a.apellidos)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {a.numero !== null && <span className="mr-1.5 text-xs text-zinc-400">{a.numero}</span>}
                        {a.completo}
                      </span>
                      {(buscando || !clase) && (
                        <span className="block truncate text-xs text-zinc-400">{a.clase}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {a.bancoLibros && (
                        <span title="Banco de libros" aria-label="Banco de libros">
                          <Library className="h-3.5 w-3.5 text-emerald-500" />
                        </span>
                      )}
                      {a.pedidoHecho === false && (
                        <span title="Licencias pendientes" aria-label="Licencias pendientes">
                          <BookMarked className="h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {soloMisClases && (
          <p className="px-1 text-xs text-zinc-400">Ves solo el alumnado de las clases que tutorizas.</p>
        )}
      </div>

      {/* ── Columna derecha: la ficha ────────────────────────────────── */}
      <div className={abiertoId ? 'block' : 'hidden lg:block'}>
        <div className="lg:sticky lg:top-20">
          <FichaAlumnoPanel ficha={ficha} cargando={cargando} onCerrar={cerrar} onIrA={abrir} />
        </div>
      </div>
      </div>
    </div>
  );
}

/** Cabecera con el recuento, para la página. */
export function ResumenAlumnado({ total, clases }: { total: number; clases: number }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <Users className="h-3.5 w-3.5" /> {total} {total === 1 ? 'alumno' : 'alumnos'} activos en {clases}{' '}
      {clases === 1 ? 'clase' : 'clases'}
    </p>
  );
}
