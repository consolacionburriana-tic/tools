'use client';

// Pestaña «Alumnado»: la clase en tabla y cómo tiene el iPad cada uno, de un toque.
//
// Lo que se repite cien veces (elegir la modalidad, el curso de compra, a casa o en el cole) se
// hace en la propia fila, sin abrir nada. Lo que se hace de vez en cuando (qué iPad del cole,
// de qué hermano viene, notas, historial) va a la ficha, que se abre tocando el nombre.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { toast } from 'sonner';
import {
  cuotaDe,
  cursosDeCompra,
  llevaCompra,
  MODALIDAD_LABEL,
  MODALIDADES,
  seguroDe,
  TEXTO_SEGURO,
  type Modalidad,
} from '@/lib/dispositivos';
import type { AlumnoDis, AparatoDis, EstadoDis, PanelDispositivos } from '@/lib/dispositivos-server';
import type { Acciones } from './panel';
import { COLOR_MODALIDAD, COLOR_SEGURO, normalizar, pedir } from './comun';
import { buttonVariants } from '@/components/ui/button';
import { claseCampo } from '@/components/ui/input';

export type FiltroAlumnado = 'todos' | 'sin' | Modalidad | 'vencido' | 'falta';

const FILTRO_LABEL: Record<FiltroAlumnado, string> = {
  todos: 'Todos',
  sin: 'Sin informar',
  comprado: 'Comprado',
  casa: 'De casa',
  prestado: 'Prestado',
  hermano: 'De hermano',
  vencido: 'Seguro vencido',
  falta: 'Falta un dato',
};

const CLAVE_CLASE = 'dispositivos.clase';

function claveDe(a: { curso: string; letra: string | null }) {
  return `${a.curso}|${a.letra ?? ''}`;
}

/** ¿Le falta algo para saber qué paga o qué iPad tiene? */
function faltaDato(a: AlumnoDis, delCole: AparatoDis | undefined): boolean {
  const e = a.estado;
  if (!e) return false;
  if (llevaCompra(e.modalidad) && !e.cursoCompra) return true;
  return e.modalidad === 'prestado' && !delCole;
}

export function TablaAlumnado({
  panel,
  acciones,
  filtro,
  setFiltro,
}: {
  panel: PanelDispositivos;
  acciones: Acciones;
  filtro: FiltroAlumnado;
  setFiltro: (f: FiltroAlumnado) => void;
}) {
  const { cursoActual } = panel;
  const [clase, setClase] = useState<string>('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(CLAVE_CLASE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee una vez al montar: sessionStorage no existe en el servidor
      if (guardada) setClase(guardada);
    } catch {
      /* sin almacenamiento: se empieza por «Todas» */
    }
  }, []);

  function elegirClase(c: string) {
    haptic.tap();
    setClase(c);
    try {
      sessionStorage.setItem(CLAVE_CLASE, c);
    } catch {
      /* da igual */
    }
  }

  const clases = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const a of panel.alumnos) if (!vistas.has(claveDe(a))) vistas.set(claveDe(a), a.clase);
    return [...vistas];
  }, [panel.alumnos]);

  // El iPad del cole que tiene cada uno (de sustitución): prestado para el curso si el alumno
  // es «Prestado», o dejado mientras arreglan el suyo si no.
  const delColeDe = useMemo(
    () => new Map(panel.aparatos.filter((a) => a.uso === 'sustitucion' && a.titular?.tipo === 'alumno').map((a) => [a.titular!.id, a])),
    [panel.aparatos],
  );

  const q = normalizar(busca.trim());
  const deLaClase = panel.alumnos.filter((a) => (q ? normalizar(a.nombre).includes(q) : !clase || claveDe(a) === clase));

  const pasa = (a: AlumnoDis, f: FiltroAlumnado) => {
    const e = a.estado;
    switch (f) {
      case 'todos':
        return true;
      case 'sin':
        return !e;
      case 'vencido':
        return Boolean(e && llevaCompra(e.modalidad) && seguroDe(e.cursoCompra, cursoActual).estado === 'vencido');
      case 'falta':
        return faltaDato(a, delColeDe.get(a.id));
      default:
        return e?.modalidad === f;
    }
  };
  const filas = deLaClase.filter((a) => pasa(a, filtro));
  const cuenta = (f: FiltroAlumnado) => deLaClase.filter((a) => pasa(a, f)).length;
  const sinInformar = deLaClase.filter((a) => !a.estado);
  const nombreClase = q ? 'la búsqueda' : clase ? clases.find(([k]) => k === clase)?.[1] ?? '' : 'todo el alcance';

  return (
    <div className="space-y-4">
      {/* Clases: un carril fijo, como en Alumnado. */}
      <div className="flex flex-wrap gap-1.5">
        <BotonClase activo={!clase} onClick={() => elegirClase('')}>
          Todas
        </BotonClase>
        {clases.map(([k, label]) => (
          <BotonClase key={k} activo={clase === k} onClick={() => elegirClase(k)}>
            {label}
          </BotonClase>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <span className="sr-only">Buscar alumno</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar en todo el alcance…"
            className={cn(claseCampo, 'pl-9')}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTRO_LABEL) as FiltroAlumnado[]).map((f) => {
            const n = cuenta(f);
            if (n === 0 && f !== 'todos' && f !== filtro) return null;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  haptic.tap();
                  setFiltro(f);
                }}
                className={cn(
                  'h-10 cursor-pointer rounded-full border px-3.5 text-sm transition-colors',
                  filtro === f
                    ? 'border-zinc-900 bg-zinc-100 font-semibold text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100'
                    : f === 'sin' || f === 'falta' || f === 'vencido'
                      ? 'border-dashed border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                )}
              >
                {FILTRO_LABEL[f]} <span className="ml-1 font-semibold">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {sinInformar.length > 0 && (filtro === 'sin' || filtro === 'todos') && (
        <EnBloque
          alumnos={sinInformar}
          donde={nombreClase}
          cursoActual={cursoActual}
          onHecho={(estados, aparatos) => {
            acciones.mezclarEstados(estados);
            acciones.mezclarAparatos(aparatos);
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {filas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">Nadie con ese filtro aquí.</p>
        ) : (
          filas.map((a) => (
            <Fila
              key={a.id}
              alumno={a}
              delCole={delColeDe.get(a.id)}
              cursoActual={cursoActual}
              conClase={!clase || Boolean(q)}
              acciones={acciones}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BotonClase({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-10 cursor-pointer rounded-lg border px-3 text-sm whitespace-nowrap transition-colors',
        activo
          ? 'border-zinc-900 bg-zinc-900 font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
      )}
    >
      {children}
    </button>
  );
}

function Fila({
  alumno: a,
  delCole,
  cursoActual,
  conClase,
  acciones,
}: {
  alumno: AlumnoDis;
  delCole?: AparatoDis;
  cursoActual: string;
  conClase: boolean;
  acciones: Acciones;
}) {
  const e = a.estado;
  const ocupado = acciones.guardando === a.id;
  const cuota = e ? cuotaDe(e, cursoActual) : null;

  function elegir(m: Modalidad) {
    if (e?.modalidad === m) return acciones.abrirFicha(a.id);
    haptic.tap();
    void acciones.guardar({ eduStudentId: a.id, modalidad: m }).then((ok) => {
      // Prestado sin iPad todavía: se abre la ficha para elegir cuál.
      if (ok && m === 'prestado') acciones.abrirFicha(a.id);
    });
  }

  return (
    <div className="flex flex-col gap-2.5 border-b border-zinc-100 px-4 py-3 last:border-b-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_84px] lg:items-center lg:gap-4 dark:border-zinc-800">
      <button type="button" onClick={() => acciones.abrirFicha(a.id)} className="min-w-0 cursor-pointer text-left">
        <span className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100">{a.nombre}</span>
        <span className="block truncate text-xs text-zinc-500">
          {conClase ? `${a.clase} · ` : ''}iPad
          {delCole && e?.modalidad !== 'prestado' ? ` · con el ${delCole.codigo} mientras arreglan el suyo` : ''}
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Cómo tiene el iPad ${a.nombre}`}>
        {MODALIDADES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={ocupado}
            onClick={() => elegir(m)}
            aria-pressed={e?.modalidad === m}
            className={cn(
              'h-11 cursor-pointer rounded-lg border px-3 text-sm transition-colors disabled:cursor-wait',
              e?.modalidad === m
                ? cn(COLOR_MODALIDAD[m], 'font-semibold')
                : e
                  ? 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  : 'border-dashed border-amber-500 bg-amber-50/60 text-zinc-700 hover:bg-amber-50 dark:bg-amber-500/5 dark:text-zinc-300',
            )}
          >
            {MODALIDAD_LABEL[m]}
          </button>
        ))}
        {ocupado && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>

      <Detalle alumno={a} estado={e} delCole={delCole} cursoActual={cursoActual} acciones={acciones} />

      <div className="text-sm lg:text-right">
        {cuota?.aviso ? (
          <span className="font-semibold text-amber-700 dark:text-amber-300">¿?</span>
        ) : cuota?.concepto ? (
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {cuota.importe} €/{cuota.concepto === 'mensual' ? 'mes' : 'año'}
          </span>
        ) : (
          <span className="text-zinc-400">{e ? '—' : ''}</span>
        )}
      </div>
    </div>
  );
}

function Detalle({
  alumno: a,
  estado: e,
  delCole,
  cursoActual,
  acciones,
}: {
  alumno: AlumnoDis;
  estado: EstadoDis | null;
  delCole?: AparatoDis;
  cursoActual: string;
  acciones: Acciones;
}) {
  if (!e) return <span className="text-sm text-amber-700 italic dark:text-amber-300">Sin informar</span>;

  if (e.modalidad === 'casa') return <span className="text-sm text-zinc-500">Comprado fuera del cole</span>;

  if (e.modalidad === 'prestado') {
    const boton = (aCasa: boolean, label: string) => (
      <button
        type="button"
        onClick={() => {
          if (Boolean(e.aCasa) === aCasa) return;
          haptic.tap();
          void acciones.guardar({ eduStudentId: a.id, modalidad: 'prestado', aCasa });
        }}
        aria-pressed={Boolean(e.aCasa) === aCasa}
        className={cn(
          'h-10 cursor-pointer rounded-md px-3 text-sm transition-colors',
          Boolean(e.aCasa) === aCasa
            ? 'bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
        )}
      >
        {label}
      </button>
    );
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {boton(true, 'A casa')}
          {boton(false, 'En el cole')}
        </div>
        <button
          type="button"
          onClick={() => acciones.abrirFicha(a.id)}
          className={cn(
            'h-10 cursor-pointer rounded-lg px-3 text-sm font-semibold',
            delCole
              ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200'
              : 'border border-dashed border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
          )}
        >
          {delCole ? delCole.codigo : '¿Qué iPad?'}
        </button>
      </div>
    );
  }

  // Comprado o de hermano: el curso de compra, en la propia fila.
  const seguro = seguroDe(e.cursoCompra, cursoActual);
  const hermano = e.modalidad === 'hermano' ? a.hermanos.find((h) => h.id === e.hermanoId) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`compra-${a.id}`}>
        Curso de compra de {a.nombre}
      </label>
      <select
        id={`compra-${a.id}`}
        value={e.cursoCompra ?? ''}
        onChange={(ev) => {
          haptic.tap();
          void acciones.guardar({ eduStudentId: a.id, modalidad: e.modalidad, cursoCompra: ev.target.value || null });
        }}
        className={cn(
          'h-10 cursor-pointer rounded-lg border bg-white px-2 text-sm dark:bg-zinc-950',
          e.cursoCompra ? 'border-zinc-300 dark:border-zinc-700' : 'border-dashed border-amber-500 text-amber-900 dark:text-amber-200',
        )}
      >
        <option value="">¿Curso de compra?</option>
        {cursosDeCompra(cursoActual, 8).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {seguro.estado !== 'sin_dato' && (
        <span className={cn('rounded-md px-2 py-1 text-xs', COLOR_SEGURO[seguro.estado])}>
          {seguro.estado === 'vigente' ? `seguro hasta ${seguro.hasta}` : TEXTO_SEGURO[seguro.estado]}
        </span>
      )}
      {e.modalidad === 'hermano' && (
        <button type="button" onClick={() => acciones.abrirFicha(a.id)} className="cursor-pointer text-xs text-teal-700 underline dark:text-teal-300">
          {hermano ? `de ${hermano.nombre.split(' ')[0]}` : '¿de quién?'}
        </button>
      )}
    </div>
  );
}

/** «A todos los sin informar»: el primer volcado de una clase, en un toque y con confirmación. */
function EnBloque({
  alumnos,
  donde,
  cursoActual,
  onHecho,
}: {
  alumnos: AlumnoDis[];
  donde: string;
  cursoActual: string;
  onHecho: (estados: Record<string, EstadoDis>, aparatos: AparatoDis[]) => void;
}) {
  const [modalidad, setModalidad] = useState<Modalidad | ''>('');
  const [curso, setCurso] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const n = alumnos.length;

  async function aplicar() {
    if (!modalidad) return;
    setOcupado(true);
    try {
      const r = await pedir<{ estados: Record<string, EstadoDis>; aparatos: AparatoDis[] }>('/api/dispositivos/alumnos/masivo', 'POST', {
        eduStudentIds: alumnos.map((a) => a.id),
        modalidad,
        cursoCompra: llevaCompra(modalidad) ? curso || null : null,
        aCasa: false,
      });
      onHecho(r.estados, r.aparatos);
      haptic.success();
      toast.success(`${Object.keys(r.estados).length} alumnos actualizados`);
      setConfirmar(false);
      setModalidad('');
    } catch (error) {
      haptic.warning();
      toast.error(error instanceof Error ? error.message : 'No se ha podido guardar');
    } finally {
      setOcupado(false);
    }
  }

  const texto = modalidad ? `${MODALIDAD_LABEL[modalidad]}${llevaCompra(modalidad) && curso ? ` ${curso}` : ''}` : '';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-amber-400 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/5">
      {confirmar ? (
        <>
          <span className="font-medium text-amber-950 dark:text-amber-100">
            ¿{texto} a los {n} sin informar de {donde}?
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" className={buttonVariants({ variant: 'outline' })} onClick={() => setConfirmar(false)} disabled={ocupado}>
              Cancelar
            </button>
            <button type="button" className={buttonVariants()} onClick={() => void aplicar()} disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Sí, a los {n}
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="text-amber-950 dark:text-amber-100">
            <strong>{n}</strong> sin informar en {donde}. A todos:
          </span>
          <select
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as Modalidad | '')}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
            aria-label="Modalidad para todos"
          >
            <option value="">Elige…</option>
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>
                {MODALIDAD_LABEL[m]}
              </option>
            ))}
          </select>
          {modalidad && llevaCompra(modalidad) && (
            <select
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
              aria-label="Curso de compra para todos"
            >
              <option value="">Curso de compra…</option>
              {cursosDeCompra(cursoActual, 8).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto h-10')}
            disabled={!modalidad}
            onClick={() => {
              haptic.tap();
              setConfirmar(true);
            }}
          >
            Aplicar…
          </button>
        </>
      )}
    </div>
  );
}
