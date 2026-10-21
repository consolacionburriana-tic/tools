'use client';

// Pestaña «Clases de Classroom» de /gestion/calendarios. Ficha: docs/25-calendarios.md
//
// Dos usos (David, 30-sep-2026):
//   A) «Colarse» en clases ajenas: meter a alguien como PROFE (p. ej. las tutorías, para
//      poder publicar ahí las evaluaciones). Se filtra por texto libre y fecha de creación.
//   B) Revisar las viejas y borrarlas (por defecto, las de 3 años o más).
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, GraduationCap, Search, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  ANIOS_POR_DEFECTO,
  ESTADO_CLASE_LABELS,
  cursoAcademicoActualClassroom,
  cursoLimite,
  type ClaseFila,
} from '@/lib/calendarios';
import { COLEGIO } from '@/lib/colegio';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { EnCurso } from '@/components/ui/progreso';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Casilla, CasillaFila } from './casilla';

type FiltroEstado = 'todas' | 'ARCHIVED' | 'ACTIVE' | 'otras';
const FILTROS_ESTADO: [FiltroEstado, string][] = [
  ['todas', 'Cualquier estado'],
  ['ARCHIVED', 'Archivadas'],
  ['ACTIVE', 'Activas'],
  ['otras', 'Sin aceptar / otras'],
];

const API = '/api/calendarios/admin/clases';

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const clases = (n: number) => (n === 1 ? '1 clase' : `${n} clases`);

/** 1 de julio del curso en vigor, en formato de <input type="date">. */
function inicioCursoActual(): string {
  return `${cursoAcademicoActualClassroom().slice(0, 4)}-07-01`;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

interface Resultado {
  id: string;
  ok: boolean;
  mensaje: string;
}

export function PanelClases({ iniciales }: { iniciales: ClaseFila[] }) {
  const [lista, setClases] = useState(iniciales);
  const [soloViejas, setSoloViejas] = useState(true);
  const [anios, setAnios] = useState(ANIOS_POR_DEFECTO);
  const [estado, setEstado] = useState<FiltroEstado>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [verBorradas, setVerBorradas] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<'profe' | 'borrar' | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Map<string, Resultado>>(new Map());

  async function recargar() {
    const r = await fetch(API);
    const j = (await r.json().catch(() => null)) as { clases?: ClaseFila[] } | null;
    if (j?.clases) setClases(j.clases);
  }

  // Al entrar en la pestaña, lo último (puede venir de un escaneo recién hecho).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
    recargar().catch(() => null);
  }, []);

  const vivas = lista.filter((c) => !c.borradoAt && c.estado !== 'DESAPARECIDA');
  const borradas = lista.filter((c) => c.borradoAt);
  const viejas = vivas.filter((c) => c.antiguedad !== null && c.antiguedad >= anios);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const d = desde ? new Date(`${desde}T00:00:00`) : null;
    const h = hasta ? new Date(`${hasta}T23:59:59`) : null;
    const base = verBorradas ? borradas : soloViejas ? viejas : vivas;
    return base
      .filter((c) => {
        if (estado === 'todas') return true;
        if (estado === 'otras') return c.estado !== 'ACTIVE' && c.estado !== 'ARCHIVED';
        return c.estado === estado;
      })
      .filter((c) => {
        if (!d && !h) return true;
        if (!c.creadaAt) return false;
        const creada = new Date(c.creadaAt);
        return (!d || creada >= d) && (!h || creada <= h);
      })
      .filter((c) => !q || `${c.nombre ?? ''} ${c.seccion ?? ''} ${c.ownerEmail ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.curso ?? '').localeCompare(b.curso ?? '') || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  }, [vivas, viejas, borradas, verBorradas, soloViejas, estado, busqueda, desde, hasta]);

  const seleccionables = verBorradas ? [] : visibles;
  const elegidas = lista.filter((c) => seleccion.has(c.id));

  function alternar(id: string) {
    haptic.tap();
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodas() {
    haptic.tap();
    const todas = seleccionables.every((c) => seleccion.has(c.id));
    setSeleccion((s) => {
      const n = new Set(s);
      for (const c of seleccionables) {
        if (todas) n.delete(c.id);
        else n.add(c.id);
      }
      return n;
    });
  }

  /** Lanza una acción por tandas, apunta el resultado de cada clase y recarga. */
  async function porTandas(
    etiqueta: string,
    tamano: number,
    llamar: (ids: string[]) => Promise<{ resultados: Resultado[] }>,
  ): Promise<void> {
    const ids = [...seleccion];
    const nuevos = new Map(resultados);
    let ok = 0;
    let fallos = 0;
    try {
      for (let i = 0; i < ids.length; i += tamano) {
        setProgreso(`${etiqueta}… ${i} de ${ids.length}`);
        const { resultados: rs } = await llamar(ids.slice(i, i + tamano));
        for (const r of rs) {
          nuevos.set(r.id, r);
          if (r.ok) ok++;
          else fallos++;
        }
        setResultados(new Map(nuevos));
      }
      if (fallos) {
        haptic.warning();
        toast.warning(`${ok} hechas · ${fallos} con error (el motivo sale en cada clase)`);
      } else {
        haptic.success();
        toast.success(`${ok} hechas`);
      }
      setSeleccion(new Set());
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Se ha cortado');
    } finally {
      await recargar().catch(() => null);
      setProgreso(null);
    }
  }

  const ocupado = progreso !== null;

  return (
    <div className="space-y-5">
      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <Tarjeta as="section" aria-label="Qué clases ver" className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Casilla marcada={soloViejas} disabled={verBorradas} onCambio={setSoloViejas}>
            Solo las de
          </Casilla>
          <Input
            type="number"
            min={1}
            max={20}
            value={anios}
            onChange={(e) => setAnios(Math.max(1, Math.min(20, Number(e.target.value) || ANIOS_POR_DEFECTO)))}
            aria-label="Años de antigüedad"
            className="w-20 text-center tabular-nums"
          />
          <span className="text-sm text-zinc-800 dark:text-zinc-200">
            años o más <span className="text-zinc-500 dark:text-zinc-400">(del {cursoLimite(anios)} hacia atrás)</span>
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Campo etiqueta="Creadas desde" id="cal-clases-desde" className="min-w-40 flex-1 sm:w-48 sm:flex-none">
            <Input id="cal-clases-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta" id="cal-clases-hasta" className="min-w-40 flex-1 sm:w-48 sm:flex-none">
            <Input id="cal-clases-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
          {/* Las clases del curso se crean a partir del 1 de julio, casi siempre antes de noviembre */}
          <Button
            variant="outline"
            onClick={() => {
              haptic.tap();
              setDesde(inicioCursoActual());
              setHasta('');
              setSoloViejas(false);
            }}
          >
            Las de este curso
          </Button>
          {(desde || hasta) && (
            <Button
              variant="ghost"
              onClick={() => {
                setDesde('');
                setHasta('');
              }}
            >
              Quitar fechas
            </Button>
          )}
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {vivas.length === 0
            ? 'Todavía no hay clases: escanea el dominio en «Calendarios».'
            : `${clases(visibles.length)} con estos filtros · ${viejas.length} de ${vivas.length} tienen ${anios} años o más`}
        </p>
      </Tarjeta>

      <div className="flex flex-wrap items-center gap-2">
        <Selector
          aria-label="Estado de la clase"
          value={estado}
          onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          className="sm:w-56"
        >
          {FILTROS_ESTADO.map(([v, l]) => (
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
            placeholder="Texto libre: «tutoría», «matemáticas», «3ESO», un profe…"
            aria-label="Buscar clases"
            className="pl-9"
          />
        </div>
        {borradas.length > 0 && (
          <Filtros etiqueta="Mostrar">
            <Filtro
              activo={verBorradas}
              cuenta={borradas.length}
              onClick={() => {
                setVerBorradas((v) => !v);
                setSeleccion(new Set());
              }}
            >
              Borradas
            </Filtro>
          </Filtros>
        )}
      </div>

      {progreso && <EnCurso texto={progreso} />}

      {/* ── Lista ──────────────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <Vacio icono={<GraduationCap />} titulo="No hay clases con estos filtros">
          {vivas.length === 0 ? 'Escanea el dominio en «Calendarios» y saldrán aquí.' : 'Prueba a quitar algún filtro.'}
        </Vacio>
      ) : (
        <Tarjeta as="section" aria-label="Clases" className="overflow-hidden">
          {seleccionables.length > 0 && (
            <div className="border-b border-zinc-100 px-4 py-1 dark:border-zinc-800">
              <Casilla marcada={seleccionables.every((c) => seleccion.has(c.id))} onCambio={alternarTodas}>
                Elegir las {seleccionables.length} que se ven
              </Casilla>
            </div>
          )}
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.map((c) => (
              <FilaClase
                key={c.id}
                c={c}
                marcada={seleccion.has(c.id)}
                resultado={resultados.get(c.id)}
                onAlternar={verBorradas ? undefined : () => alternar(c.id)}
              />
            ))}
          </ul>
        </Tarjeta>
      )}

      {/* ── Barra de acciones ──────────────────────────────────────────── */}
      <BarraAcciones
        visible={seleccion.size > 0}
        ancho="ancho"
        resumen={
          <span className="hidden sm:inline">
            {clases(seleccion.size)} {seleccion.size === 1 ? 'elegida' : 'elegidas'}
          </span>
        }
      >
        <Button variant="ghost" onClick={() => setSeleccion(new Set())}>
          <X aria-hidden />
          <span className="sr-only sm:not-sr-only">Quitar selección</span>
        </Button>
        <Button
          disabled={ocupado}
          onClick={() => {
            haptic.tap();
            setDialogo('profe');
          }}
        >
          <UserPlus />
          {/* En el móvil no caben los tres botones con el texto entero (y el hueco de Tareas) */}
          <span className="sm:hidden">Profe</span>
          <span className="hidden sm:inline">Añadir profe</span>
        </Button>
        <Button
          variant="destructive"
          disabled={ocupado}
          onClick={() => {
            haptic.tap();
            setDialogo('borrar');
          }}
        >
          <Trash2 /> Borrar {seleccion.size}
          <span className="sr-only sm:not-sr-only">{seleccion.size === 1 ? 'clase' : 'clases'}</span>
        </Button>
      </BarraAcciones>

      <DialogoProfe
        abierto={dialogo === 'profe'}
        n={elegidas.length}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(email) => {
          setDialogo(null);
          void porTandas(`Añadiendo a ${email}`, 30, (ids) => post(`${API}/profe`, { ids, email }));
        }}
      />
      <DialogoBorrar
        abierto={dialogo === 'borrar'}
        n={elegidas.length}
        activas={elegidas.filter((c) => c.estado === 'ACTIVE').length}
        deEsteCurso={elegidas.filter((c) => c.antiguedad === 0).length}
        onCerrar={() => setDialogo(null)}
        onConfirmar={(conCalendario) => {
          setDialogo(null);
          void porTandas('Borrando clases', 15, (ids) =>
            post(`${API}/borrar`, { ids, conCalendario, confirmacion: 'BORRAR' }),
          );
        }}
      />
    </div>
  );
}

function FilaClase({
  c,
  marcada,
  resultado,
  onAlternar,
}: {
  c: ClaseFila;
  marcada: boolean;
  resultado: Resultado | undefined;
  onAlternar?: () => void;
}) {
  const nombre = c.nombre ?? '(sin nombre)';
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', marcada && 'bg-blue-50/70 dark:bg-blue-500/10')}>
      {onAlternar && <CasillaFila marcada={marcada} onCambio={onAlternar} etiqueta={`Elegir ${nombre}`} />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-zinc-900 dark:text-zinc-100">
          <span className="truncate">{nombre}</span>
          {c.seccion && <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{c.seccion}</span>}
          {c.curso && <Etiqueta>{c.curso}</Etiqueta>}
          {c.estado && (
            <Estado tono={c.estado === 'ACTIVE' ? 'ok' : 'neutro'}>{ESTADO_CLASE_LABELS[c.estado] ?? c.estado}</Estado>
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {c.ownerEmail ?? 'Propietario desconocido'} · creada el {fecha(c.creadaAt)} · último cambio {fecha(c.actualizadaAt)}
          {c.calendarioVivo && ' · su calendario sigue vivo'}
        </p>
        {c.borradoAt && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Borrada el {fecha(c.borradoAt)} por {c.borradoPor}
          </p>
        )}
        {!c.borradoAt && c.borradoError && !resultado && (
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">No se pudo borrar: {c.borradoError}</p>
        )}
        {resultado && (
          <p className={cn('mt-0.5 text-xs', resultado.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
            {resultado.mensaje}
          </p>
        )}
      </div>
      {c.enlace && !c.borradoAt && (
        <a
          href={c.enlace}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'sm', className: '-my-1 shrink-0' })}
        >
          <ExternalLink aria-hidden /> Classroom
        </a>
      )}
    </li>
  );
}

function DialogoProfe({
  abierto,
  n,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  n: number;
  onCerrar: () => void;
  onConfirmar: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const valido = new RegExp(`^[^\\s@]+@${COLEGIO.dominio.replace(/\./g, '\\.')}$`, 'i').test(email.trim());
  const enviar = () => {
    if (!valido) return;
    onConfirmar(email.trim().toLowerCase());
    setEmail('');
  };
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir un profe a {clases(n)}</DialogTitle>
          <DialogDescription>
            Entra directamente como profesor/a, sin invitación: la verá en su Classroom y podrá publicar en ella. Si ya era
            profe de alguna, se deja como está.
          </DialogDescription>
        </DialogHeader>
        <Campo etiqueta="Cuenta del colegio" id="cal-profe-email">
          <Input
            id="cal-profe-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
            placeholder={`alguien@${COLEGIO.dominio}`}
          />
        </Campo>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button disabled={!valido} onClick={enviar}>
            <UserPlus /> Añadir a {clases(n)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Borrar clases es lo más gordo del módulo: se escribe BORRAR, como con los calendarios. */
function DialogoBorrar({
  abierto,
  n,
  activas,
  deEsteCurso,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  n: number;
  activas: number;
  deEsteCurso: number;
  onCerrar: () => void;
  onConfirmar: (conCalendario: boolean) => void;
}) {
  const [conCalendario, setConCalendario] = useState(true);
  return (
    <ConfirmarDialogo
      abierto={abierto}
      onCerrar={onCerrar}
      onConfirmar={() => onConfirmar(conCalendario)}
      titulo={`¿Borrar ${clases(n)} de Classroom?`}
      descripcion="Se eliminan para todo el mundo, con sus tareas, comentarios y notas. Esto no se deshace. Las que no estén archivadas se archivan antes (Classroom lo exige). Su carpeta de Drive no se toca."
      boton={`Borrar ${clases(n)}`}
      palabra="BORRAR"
    >
      {(activas > 0 || deEsteCurso > 0) && (
        <Aviso tono="aviso">
          <ul className="list-disc space-y-0.5 pl-4">
            {activas > 0 && <li>{activas === 1 ? '1 sigue activa' : `${activas} siguen activas`}</li>}
            {deEsteCurso > 0 && <li>{deEsteCurso === 1 ? '1 es de este curso' : `${deEsteCurso} son de este curso`}</li>}
          </ul>
        </Aviso>
      )}
      <Casilla marcada={conCalendario} onCambio={setConCalendario}>
        Borrar también su calendario
      </Casilla>
    </ConfirmarDialogo>
  );
}
