'use client';

// /gestion/calendarios: el inventario de calendarios secundarios del dominio, para ver qué
// dejó cada clase de Classroom y borrarlo en bloque. Ficha: docs/25-calendarios.md
import { useMemo, useState } from 'react';
import { CalendarX2, Check, CircleCheck, CircleX, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  ESTADO_CLASE_LABELS,
  motivoNoBorrable,
  type CalendarioFila,
  type GrupoCalendario,
} from '@/lib/calendarios';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button } from '@/components/ui/button';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { EnCurso } from '@/components/ui/progreso';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Casilla, CasillaFila } from './casilla';

type Pestana = GrupoCalendario | 'borrados';
const PESTANAS: Pestana[] = ['anteriores', 'huerfano', 'este', 'otro', 'limbo', 'borrados'];
const PESTANA_LABELS: Record<Pestana, string> = {
  anteriores: 'Cursos anteriores',
  huerfano: 'Clase ya borrada',
  este: 'Este curso',
  otro: 'Otros',
  limbo: 'Inborrables',
  borrados: 'Borrados',
};
/** Qué hay en cada grupo, a la vista (los que no tienen ya su aviso debajo). */
const PESTANA_AYUDA: Partial<Record<Pestana, string>> = {
  anteriores: 'Calendarios de clases de Classroom de cursos anteriores.',
  huerfano: 'Calendarios de clases de Classroom que ya no existen: se quedaron en la lista de todos.',
  este: 'Calendarios de clases de Classroom de este curso.',
  otro: 'Calendarios secundarios que no son de Classroom.',
};

type FiltroEventos = 'todos' | 'sin' | 'con' | 'futuros';
const FILTROS_EVENTOS: [FiltroEventos, string][] = [
  ['todos', 'Con o sin eventos'],
  ['sin', 'Sin eventos'],
  ['con', 'Con eventos'],
  ['futuros', 'Con eventos futuros'],
];

interface Comprobacion {
  clave: string;
  nombre: string;
  scope: string;
  api: string;
  ok: boolean;
  detalle: string;
}

const API = '/api/calendarios/admin';

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}
const post = <T,>(url: string, body: unknown) =>
  pedir<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const calendarios = (n: number) => (n === 1 ? '1 calendario' : `${n} calendarios`);

export function PanelCalendarios({ iniciales, errorInicial }: { iniciales: CalendarioFila[]; errorInicial: string | null }) {
  const [calendariosLista, setCalendarios] = useState(iniciales);
  const [pestana, setPestana] = useState<Pestana>('anteriores');
  const [filtroEventos, setFiltroEventos] = useState<FiltroEventos>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [permisos, setPermisos] = useState<{ admin: string; comprobaciones: Comprobacion[] } | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [barridoCompleto, setBarridoCompleto] = useState(true);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [vaciarAbierto, setVaciarAbierto] = useState(false);

  const vivos = calendariosLista.filter((c) => !c.borradoAt);
  const cuenta = (p: Pestana) =>
    p === 'borrados' ? calendariosLista.length - vivos.length : vivos.filter((c) => c.grupo === p).length;
  const ultimoEscaneo = calendariosLista.reduce<string | null>((m, c) => (!m || c.vistoAt > m ? c.vistoAt : m), null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return calendariosLista
      .filter((c) => (pestana === 'borrados' ? c.borradoAt : !c.borradoAt && c.grupo === pestana))
      .filter((c) => {
        if (filtroEventos === 'sin') return c.eventos === 0;
        if (filtroEventos === 'con') return (c.eventos ?? 0) > 0;
        if (filtroEventos === 'futuros') return (c.eventosFuturos ?? 0) > 0;
        return true;
      })
      .filter(
        (c) =>
          !q ||
          `${c.nombre ?? ''} ${c.courseNombre ?? ''} ${c.courseSeccion ?? ''} ${c.courseOwnerEmail ?? ''} ${c.propietarios.join(' ')}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => (a.curso ?? '').localeCompare(b.curso ?? '') || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }, [calendariosLista, pestana, filtroEventos, busqueda]);

  const borrables = visibles.filter((c) => motivoNoBorrable(c) === null);
  const elegidos = calendariosLista.filter((c) => seleccion.has(c.id));

  function alternar(id: string) {
    haptic.tap();
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodos() {
    haptic.tap();
    const todos = borrables.every((c) => seleccion.has(c.id));
    setSeleccion((s) => {
      const n = new Set(s);
      for (const c of borrables) {
        if (todos) n.delete(c.id);
        else n.add(c.id);
      }
      return n;
    });
  }

  async function comprobarPermisos() {
    setComprobando(true);
    try {
      setPermisos(await pedir(`${API}/permisos`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido comprobar');
    } finally {
      setComprobando(false);
    }
  }

  async function vaciar() {
    try {
      const r = await post<{ calendarios: number; clases: number; seQuedan: number }>(`${API}/vaciar`, { confirmacion: 'VACIAR' });
      haptic.success();
      toast.success(
        `Registro vaciado: ${r.calendarios} calendarios y ${r.clases} clases` +
          (r.seQuedan ? ` · se quedan ${r.seQuedan} de clases que siguen en Classroom` : ''),
      );
      await recargar();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido vaciar');
    }
  }

  async function recargar() {
    const { calendarios: nuevos } = await pedir<{ calendarios: CalendarioFila[] }>(`${API}/lista`);
    setCalendarios(nuevos);
  }

  async function escanear() {
    const inicio = new Date().toISOString();
    try {
      // 1. Classroom
      let cursor: string | null = null;
      let clases = 0;
      do {
        setProgreso(`Leyendo las clases de Classroom… (${clases})`);
        const r: { siguiente: string | null; clases: number } = await post(`${API}/escanear`, { paso: 'classroom', cursor, inicio });
        clases += r.clases;
        cursor = r.siguiente;
      } while (cursor);

      // 2. Usuarios (opcional)
      if (barridoCompleto) {
        let usuarios = 0;
        let errores = 0;
        cursor = null;
        do {
          setProgreso(`Mirando los calendarios de cada usuario… (${usuarios} usuarios${errores ? `, ${errores} sin poder leer` : ''})`);
          const r: { siguiente: string | null; usuarios: number; errores: number } = await post(`${API}/escanear`, {
            paso: 'usuarios',
            cursor,
            inicio,
          });
          usuarios += r.usuarios;
          errores += r.errores;
          cursor = r.siguiente;
        } while (cursor);
      }

      // 3. Eventos
      let hechos = 0;
      for (;;) {
        const r: { hechos: number; quedan: number } = await post(`${API}/escanear`, { paso: 'eventos', inicio });
        hechos += r.hechos;
        setProgreso(`Contando eventos… (${hechos} hechos, quedan ${r.quedan})`);
        if (r.quedan === 0 || r.hechos === 0) break;
      }

      await recargar();
      haptic.success();
      toast.success(`Escaneo terminado: ${clases} clases de Classroom`);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'El escaneo se ha cortado');
      await recargar().catch(() => null);
    } finally {
      setProgreso(null);
    }
  }

  async function borrar() {
    const ids = [...seleccion];
    setConfirmar(false);
    let ok = 0;
    let fallos = 0;
    try {
      for (let i = 0; i < ids.length; i += 10) {
        setProgreso(`Borrando… ${Math.min(i, ids.length)} de ${ids.length}`);
        const { resultados } = await post<{ resultados: { id: string; ok: boolean }[] }>(`${API}/borrar`, {
          ids: ids.slice(i, i + 10),
          confirmacion: 'BORRAR',
        });
        ok += resultados.filter((r) => r.ok).length;
        fallos += resultados.filter((r) => !r.ok).length;
      }
      if (fallos) {
        haptic.warning();
        toast.warning(`${ok} borrados · ${fallos} no se han podido (mira el motivo en cada uno)`);
      } else {
        haptic.success();
        toast.success(`${calendarios(ok)} ${ok === 1 ? 'borrado' : 'borrados'}`);
      }
      setSeleccion(new Set());
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Error borrando');
    } finally {
      await recargar().catch(() => null);
      setProgreso(null);
    }
  }

  const ocupado = progreso !== null;
  const elegidosConEventos = elegidos.filter((c) => (c.eventos ?? 0) > 0).length;
  const elegidosConFuturos = elegidos.filter((c) => (c.eventosFuturos ?? 0) > 0).length;
  const elegidosActivos = elegidos.filter((c) => c.clasePresente && c.courseEstado === 'ACTIVE').length;
  const ayuda = PESTANA_AYUDA[pestana];

  return (
    <div className="space-y-5">
      {errorInicial && <Aviso tono="error">{errorInicial}</Aviso>}

      {/* ── Escanear ───────────────────────────────────────────────────── */}
      <Tarjeta as="section" aria-labelledby="cal-inventario">
        <TarjetaCabecera
          id="cal-inventario"
          titulo="Inventario"
          descripcion={
            ultimoEscaneo
              ? `${calendarios(vivos.length)} ${vivos.length === 1 ? 'vivo' : 'vivos'} · último escaneo ${fecha(ultimoEscaneo)}`
              : 'Todavía no se ha escaneado el dominio'
          }
        />
        <TarjetaCuerpo className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={escanear} cargando={ocupado}>
              {!ocupado && <RefreshCw />}
              {ultimoEscaneo ? 'Volver a escanear' : 'Escanear el dominio'}
            </Button>
            <Button variant="outline" size="sm" onClick={comprobarPermisos} cargando={comprobando} disabled={ocupado}>
              {!comprobando && <ShieldCheck />}
              Comprobar permisos
            </Button>
          </div>
          <Casilla
            marcada={barridoCompleto}
            onCambio={setBarridoCompleto}
            disabled={ocupado}
            detalle="Mira la lista de calendarios de cada cuenta: es lo único que encuentra los de clases ya borradas y dice a cuánta gente le sale cada uno. Tarda más."
          >
            Barrido completo por usuarios
          </Casilla>
          {progreso && <EnCurso texto={progreso} />}
          {permisos && <Permisos admin={permisos.admin} comprobaciones={permisos.comprobaciones} />}
        </TarjetaCuerpo>
      </Tarjeta>

      {/* ── Grupos y filtros ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <Filtros etiqueta="Grupo de calendarios">
          {PESTANAS.map((p) => (
            <Filtro key={p} activo={pestana === p} onClick={() => setPestana(p)} cuenta={cuenta(p)}>
              {PESTANA_LABELS[p]}
            </Filtro>
          ))}
        </Filtros>
        <div className="flex flex-wrap items-center gap-2">
          <Selector
            aria-label="Eventos"
            value={filtroEventos}
            onChange={(e) => setFiltroEventos(e.target.value as FiltroEventos)}
            className="sm:w-60"
          >
            {FILTROS_EVENTOS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Selector>
          <div className="relative min-w-48 flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, sección o profe"
              aria-label="Buscar calendarios"
              className="pl-9"
            />
          </div>
        </div>
        {ayuda && <p className="text-sm text-zinc-500 dark:text-zinc-400">{ayuda}</p>}
      </div>

      {pestana === 'limbo' && (
        <Aviso tono="info" titulo="Por qué no se pueden borrar">
          No hay ninguna cuenta activa del dominio a la que suplantar para borrarlos: o se intentó y su dueño no es nadie
          activo, o directamente no se sabe de quién son. Casi siempre son calendarios de clases viejas cuyo creador ya no
          está en el centro (cuenta suspendida o borrada), y Google solo deja borrarlos a su dueño. Aquí se quedan apartados
          para que no estorben. Si alguno molesta de verdad, se puede reactivar esa cuenta un momento, o transferir la
          clase, y volver a escanear.
        </Aviso>
      )}

      {pestana === 'borrados' && cuenta('borrados') > 0 && (
        <Aviso tono="info">
          <p>
            El registro de lo ya borrado. Vaciarlo lo quita de aquí (en Google no toca nada). Se quedan los de clases que
            siguen en Classroom: si no, el próximo escaneo los traería otra vez como vivos.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-3"
            disabled={ocupado}
            onClick={() => {
              haptic.warning();
              setVaciarAbierto(true);
            }}
          >
            <Trash2 /> Vaciar el registro
          </Button>
        </Aviso>
      )}

      {pestana === 'este' && vivos.some((c) => c.grupo === 'este') && (
        <Aviso tono="aviso">
          Son de clases de este curso. Si se borra el calendario de una clase activa, Classroom deja de enseñar ahí las
          fechas de entrega (las tareas no se tocan).
        </Aviso>
      )}

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <Vacio
          icono={<CalendarX2 />}
          titulo={calendariosLista.length === 0 ? 'Todavía no hay inventario' : 'No hay calendarios con estos filtros'}
        >
          {calendariosLista.length === 0
            ? 'Escanea el dominio para empezar: el botón está arriba, en «Inventario».'
            : 'Prueba con otro grupo o quita la búsqueda.'}
        </Vacio>
      ) : (
        <Tarjeta as="section" aria-label="Calendarios" className="overflow-hidden">
          {pestana !== 'borrados' && borrables.length > 0 && (
            <div className="border-b border-zinc-100 px-4 py-1 dark:border-zinc-800">
              <Casilla marcada={borrables.every((c) => seleccion.has(c.id))} onCambio={alternarTodos}>
                Elegir los {borrables.length} que se ven
              </Casilla>
            </div>
          )}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((c) => (
              <Fila key={c.id} c={c} marcado={seleccion.has(c.id)} onAlternar={() => alternar(c.id)} />
            ))}
          </ul>
        </Tarjeta>
      )}

      {/* ── Barra de borrado ───────────────────────────────────────────── */}
      <BarraAcciones
        visible={seleccion.size > 0}
        ancho="ancho"
        resumen={
          <span className="hidden sm:inline">
            {calendarios(seleccion.size)} {seleccion.size === 1 ? 'elegido' : 'elegidos'}
          </span>
        }
      >
        <Button variant="ghost" onClick={() => setSeleccion(new Set())}>
          <X aria-hidden />
          <span className="sr-only sm:not-sr-only">Quitar selección</span>
        </Button>
        <Button
          variant="destructive-solid"
          disabled={ocupado}
          onClick={() => {
            haptic.tap();
            setConfirmar(true);
          }}
        >
          <Trash2 /> Borrar {calendarios(seleccion.size)}
        </Button>
      </BarraAcciones>

      <ConfirmarDialogo
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        onConfirmar={() => {
          void borrar();
        }}
        titulo={`¿Borrar ${calendarios(elegidos.length)}?`}
        descripcion="Se borran de Google Calendar para todo el mundo, con sus eventos. Esto no se deshace desde aquí."
        boton={`Borrar ${calendarios(elegidos.length)}`}
        palabra="BORRAR"
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>{elegidosConEventos} tienen eventos</li>
          {elegidosConFuturos > 0 && (
            <li className="text-amber-700 dark:text-amber-400">{elegidosConFuturos} tienen eventos por venir</li>
          )}
          {elegidosActivos > 0 && (
            <li className="text-amber-700 dark:text-amber-400">
              {elegidosActivos} son de clases que siguen activas en Classroom
            </li>
          )}
        </ul>
      </ConfirmarDialogo>

      <ConfirmarDialogo
        abierto={vaciarAbierto}
        onCerrar={() => setVaciarAbierto(false)}
        onConfirmar={vaciar}
        titulo="¿Vaciar el registro de lo ya borrado?"
        descripcion={`Se quitan de esta lista los ${calendarios(cuenta('borrados'))} ya borrados y las clases borradas. En Google no se toca nada.`}
        boton="Vaciar el registro"
      />
    </div>
  );
}

function Fila({ c, marcado, onAlternar }: { c: CalendarioFila; marcado: boolean; onAlternar: () => void }) {
  const noBorrable = motivoNoBorrable(c);
  const propietario = c.propietarios[0] ?? c.courseOwnerEmail;
  const nombre = c.nombre ?? c.courseNombre ?? '(sin nombre)';
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', marcado && 'bg-red-50/70 dark:bg-red-500/10')}>
      {c.borradoAt ? (
        <CalendarX2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
      ) : (
        <CasillaFila marcada={marcado} onCambio={onAlternar} disabled={noBorrable !== null} etiqueta={`Elegir ${nombre}`} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-zinc-900 dark:text-zinc-100">
          <span className="truncate">{nombre}</span>
          {c.courseSeccion && <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{c.courseSeccion}</span>}
          {c.curso && <Etiqueta>{c.curso}</Etiqueta>}
          {c.esClassroom && c.courseEstado && (
            <Estado tono={c.clasePresente && c.courseEstado === 'ACTIVE' ? 'ok' : 'neutro'}>
              {c.clasePresente ? (ESTADO_CLASE_LABELS[c.courseEstado] ?? c.courseEstado) : 'Clase borrada'}
            </Estado>
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {propietario ?? 'Propietario desconocido'}
          {c.suscriptores > 0 && ` · le sale a ${c.suscriptores} ${c.suscriptores === 1 ? 'persona' : 'personas'}`}
          {c.courseCreadoAt && ` · clase creada el ${fecha(c.courseCreadoAt)}`}
        </p>
        {c.borradoAt && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Borrado el {fecha(c.borradoAt)} por {c.borradoPor}
          </p>
        )}
        {!c.borradoAt && c.borradoError && (
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">No se pudo borrar: {c.borradoError}</p>
        )}
        {noBorrable && !c.borradoAt && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{noBorrable}</p>}
        {c.eventos === null && c.eventosError && (
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">No se pudieron contar los eventos: {c.eventosError}</p>
        )}
      </div>
      <Eventos c={c} />
    </li>
  );
}

function Eventos({ c }: { c: CalendarioFila }) {
  if (c.eventos === null) {
    return (
      <span className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
        {c.eventosError ? 'No se pudo leer' : 'Sin contar'}
      </span>
    );
  }
  if (c.eventos === 0) return <span className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">Vacío</span>;
  return (
    <span className="shrink-0 text-right text-xs tabular-nums">
      <span className="block font-semibold text-zinc-800 dark:text-zinc-200">
        {c.eventos} {c.eventos === 1 ? 'evento' : 'eventos'}
      </span>
      {(c.eventosFuturos ?? 0) > 0 ? (
        <span className="block text-amber-700 dark:text-amber-400">{c.eventosFuturos} por venir</span>
      ) : (
        <span className="block text-zinc-500 dark:text-zinc-400">último {fecha(c.ultimoEventoAt)}</span>
      )}
    </span>
  );
}

function Permisos({ admin, comprobaciones }: { admin: string; comprobaciones: Comprobacion[] }) {
  const faltan = comprobaciones.filter((c) => !c.ok);
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Suplantando a <b className="font-semibold text-zinc-800 dark:text-zinc-200">{admin}</b> (tiene que ser
        administrador del dominio; se cambia con <code className="font-mono text-xs">GOOGLE_ADMIN_BUZON</code>)
      </p>
      <ul className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
        {comprobaciones.map((c) => (
          <li key={c.clave} className="flex items-start gap-2">
            {c.ok ? (
              <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CircleX aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <span>
              <b className="font-semibold">{c.nombre}</b> <span className="sr-only">{c.ok ? '(bien)' : '(falta)'}</span>—{' '}
              {c.detalle}
            </span>
          </li>
        ))}
      </ul>
      {faltan.length > 0 && (
        <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          <p className="font-semibold">Qué hacer (una vez):</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              Consola de admin → Seguridad → Control de API → Delegación de todo el dominio → el Client ID de la cuenta de
              servicio (el mismo de <code className="font-mono text-xs">gmail.send</code>) → Editar, y añadir:
              <pre className="mt-1 overflow-x-auto rounded-md bg-white p-2 font-mono text-xs dark:bg-zinc-900">
                {faltan.map((c) => c.scope).join(',\n')}
              </pre>
            </li>
            <li>
              En Google Cloud (proyecto de la cuenta de servicio) → APIs y servicios → habilitar:{' '}
              {faltan.map((c) => c.api).join(', ')}.
            </li>
          </ol>
        </div>
      )}
      {faltan.length === 0 && (
        <Estado tono="ok" icono={<Check />}>
          Todo listo para escanear
        </Estado>
      )}
    </div>
  );
}
