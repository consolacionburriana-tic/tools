'use client';

// La lista de todas las cuentas cruzadas con Educamos: filtros por lo que hay que hacer,
// selección en bloque y, al tocar una fila, su ficha con lo que se puede hacer con ella.
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderInput,
  KeyRound,
  Link2,
  Loader2,
  MailPlus,
  Search,
  ShieldCheck,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { compararClases } from '@/lib/cursos';
import {
  enlaceConsolaUsuario,
  MARCA_LABEL,
  uoArchivo,
  uoDentroDe,
  type AjustesCuentas,
  type EstadoFila,
  type FilaCuenta,
} from '@/lib/cuentas';
import type { EstadoCuentas, ResultadoAccion } from '@/lib/cuentas-server';
import {
  avisarResultado,
  BOTON,
  BOTON_PRIMARIO,
  BotonCopiar,
  CAMPO,
  ChipEstado,
  ChipUo,
  ConfirmarPalabra,
  enTandas,
  fecha,
  haceTiempo,
  post,
  Progreso,
  TARJETA,
} from './comun';
import { ContrasenaNueva, CrearCorreos, MarcarCuenta, MoverA } from './dialogos';

const API = '/api/cuentas/admin';

export type Filtro =
  | 'todas'
  | 'sin-correo'
  | 'parecidas'
  | 'fuera'
  | 'suspendidas'
  | 'bajas'
  | 'sueltas'
  | 'otras'
  | 'archivar'
  | 'archivadas';
export type Quien = 'todos' | 'alumno' | 'profe' | 'cuenta';

export const FILTROS: { clave: Filtro; etiqueta: string; pasa: (f: FilaCuenta) => boolean }[] = [
  { clave: 'todas', etiqueta: 'Todas', pasa: () => true },
  { clave: 'sin-correo', etiqueta: 'Sin correo', pasa: (f) => f.estado === 'sin-correo' || f.estado === 'no-le-toca' },
  { clave: 'parecidas', etiqueta: '¿Es su cuenta?', pasa: (f) => f.tipo !== 'cuenta' && f.parecidas.length > 0 },
  { clave: 'fuera', etiqueta: 'En otra unidad', pasa: (f) => f.estado === 'fuera' },
  { clave: 'suspendidas', etiqueta: 'Suspendidas y en Educamos', pasa: (f) => f.estado === 'suspendida' },
  { clave: 'bajas', etiqueta: 'Bajas', pasa: (f) => f.estado === 'baja' || f.estado === 'baja-espera' },
  { clave: 'sueltas', etiqueta: 'No están en Educamos', pasa: (f) => f.estado === 'suelta' && f.zona !== 'otras' },
  { clave: 'otras', etiqueta: 'Otras cuentas', pasa: (f) => (f.estado === 'suelta' && f.zona === 'otras') || f.estado === 'marcada' },
  { clave: 'archivar', etiqueta: 'Suspendidas sin archivar', pasa: (f) => f.estado === 'archivar' },
  { clave: 'archivadas', etiqueta: 'Archivadas', pasa: (f) => f.estado === 'archivada' },
];

const QUIEN: [Quien, string][] = [
  ['todos', 'Todos'],
  ['alumno', 'Alumnado'],
  ['profe', 'Profesorado'],
  ['cuenta', 'Sin Educamos'],
];

/** Qué se puede hacer en bloque con cada estado. */
const ACCION_DE: Partial<Record<EstadoFila, 'crear' | 'mover' | 'suspender' | 'archivar' | 'reactivar'>> = {
  'sin-correo': 'crear',
  fuera: 'mover',
  baja: 'suspender',
  'baja-espera': 'suspender',
  suelta: 'suspender',
  archivar: 'archivar',
  suspendida: 'reactivar',
};

const PAGINA = 150;

export interface VistaLista {
  filtro: Filtro;
  quien: Quien;
  clase: string | null;
  busqueda: string;
}

export function ListaCuentas({
  estado,
  puedeGestionar,
  vista,
  setVista,
  seleccion,
  setSeleccion,
  recargar,
}: {
  estado: EstadoCuentas;
  puedeGestionar: boolean;
  vista: VistaLista;
  setVista: (v: VistaLista) => void;
  seleccion: Set<string>;
  setSeleccion: (s: Set<string>) => void;
  recargar: () => Promise<void>;
}) {
  const { filas } = estado.cruce;
  const [abierta, setAbierta] = useState<string | null>(null);
  const [limite, setLimite] = useState(PAGINA);
  const [progreso, setProgreso] = useState<{ texto: string; hechos: number; total: number } | null>(null);
  const [dialogo, setDialogo] = useState<
    | { tipo: 'crear'; filas: FilaCuenta[] }
    | { tipo: 'mover-a'; filas: FilaCuenta[] }
    | { tipo: 'suspender'; filas: FilaCuenta[] }
    | { tipo: 'reactivar'; filas: FilaCuenta[] }
    | { tipo: 'contrasena'; fila: FilaCuenta }
    | { tipo: 'marcar'; fila: FilaCuenta }
    | null
  >(null);
  const [archivar, setArchivar] = useState(true);
  const [aSuSitio, setASuSitio] = useState(true);

  const filtro = FILTROS.find((f) => f.clave === vista.filtro) ?? FILTROS[0];
  const porQuien = (f: FilaCuenta) => vista.quien === 'todos' || f.tipo === vista.quien;
  const cuentaFiltro = (pasa: (f: FilaCuenta) => boolean) => filas.filter((f) => pasa(f) && porQuien(f)).length;

  const visibles = useMemo(() => {
    const q = vista.busqueda.trim().toLowerCase();
    const lista = filas.filter(
      (f) =>
        filtro.pasa(f) &&
        porQuien(f) &&
        (!vista.clase || f.claveClase === vista.clase) &&
        (!q ||
          `${f.nombre} ${f.cuenta?.email ?? ''} ${f.propuesta ?? ''} ${f.clase ?? ''} ${f.cuenta?.uo ?? ''} ${f.correoEducamos ?? ''}`
            .toLowerCase()
            .includes(q)),
    );
    // Alumnado por clase, luego profesorado, luego cuentas sueltas por unidad.
    const ordenTipo = { alumno: 0, profe: 1, cuenta: 2 } as const;
    return lista.sort((a, b) => {
      const t = ordenTipo[a.tipo] - ordenTipo[b.tipo];
      if (t !== 0) return t;
      if (a.tipo === 'alumno') {
        const [ca, la] = (a.claveClase ?? '|').split('|');
        const [cb, lb] = (b.claveClase ?? '|').split('|');
        const c = compararClases({ curso: ca || null, letra: la || null }, { curso: cb || null, letra: lb || null });
        if (c !== 0) return c;
      }
      if (a.tipo === 'cuenta') {
        const u = (a.cuenta?.uo ?? '').localeCompare(b.cuenta?.uo ?? '', 'es');
        if (u !== 0) return u;
      }
      return a.orden.localeCompare(b.orden, 'es');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, vista]);

  const seleccionables = visibles.filter((f) => ACCION_DE[f.estado] && !f.cuenta?.admin);
  const elegidas = filas.filter((f) => seleccion.has(f.clave));
  const porAccion = (a: string) => elegidas.filter((f) => ACCION_DE[f.estado] === a && !f.cuenta?.admin);

  function alternar(clave: string) {
    haptic.tap();
    const n = new Set(seleccion);
    if (n.has(clave)) n.delete(clave);
    else n.add(clave);
    setSeleccion(n);
  }
  function alternarTodas() {
    haptic.tap();
    const todas = seleccionables.length > 0 && seleccionables.every((f) => seleccion.has(f.clave));
    const n = new Set(seleccion);
    for (const f of seleccionables) {
      if (todas) n.delete(f.clave);
      else n.add(f.clave);
    }
    setSeleccion(n);
  }

  async function terminar(resultados: ResultadoAccion[], hecho: string) {
    avisarResultado(resultados.filter((r) => r.ok).length, resultados.filter((r) => !r.ok).length, hecho);
    const fallos = resultados.filter((r) => !r.ok);
    if (fallos.length > 0) {
      toast.error(fallos.slice(0, 3).map((r) => `${r.email ?? r.clave}: ${r.error}`).join(' · '), { duration: 10000 });
    }
    setSeleccion(new Set());
    await recargar();
  }

  async function enBloque(
    filasAccion: FilaCuenta[],
    texto: string,
    url: string,
    cuerpo: (t: FilaCuenta[]) => unknown,
    hecho: string,
  ) {
    setDialogo(null);
    try {
      const r = await enTandas(
        filasAccion,
        40,
        async (t) => (await post<{ resultados: ResultadoAccion[] }>(url, cuerpo(t))).resultados,
        (hechos, total) => setProgreso({ texto, hechos, total }),
      );
      await terminar(r, hecho);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Se ha cortado');
      await recargar();
    } finally {
      setProgreso(null);
    }
  }

  const moverASuSitio = (fs: FilaCuenta[]) =>
    enBloque(fs, 'Moviendo a su unidad…', `${API}/mover`, (t) => ({ cuentas: t.map((f) => ({ id: f.cuenta!.id })) }), 'movidas');
  const archivarYa = (fs: FilaCuenta[]) =>
    enBloque(fs, 'Archivando…', `${API}/mover`, (t) => ({ cuentas: t.map((f) => ({ id: f.cuenta!.id })) }), 'archivadas');

  /** `personaClave` es `a:…`/`p:…` y `cuentaClave`, `g:<id de Google>`. */
  async function vincular(personaClave: string, cuentaClave: string) {
    const persona = filas.find((f) => f.clave === personaClave);
    if (!persona || !cuentaClave.startsWith('g:')) return;
    try {
      await post(`${API}/vincular`, { tipo: persona.tipo, personaId: persona.personaId, googleId: cuentaClave.slice(2) });
      haptic.success();
      toast.success('Vinculada: su correo queda apuntado en la BBDD central');
      await recargar();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido vincular');
    }
  }

  const clases = estado.cruce.clases;
  const rotuloGrupo = (f: FilaCuenta) => (f.tipo === 'alumno' ? (f.clase ?? 'Sin clase') : f.tipo === 'profe' ? 'Profesorado' : (f.cuenta?.uo ?? '/'));

  return (
    <div className="space-y-4 pb-28">
      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const n = cuentaFiltro(f.pasa);
          if (f.clave !== 'todas' && n === 0 && vista.filtro !== f.clave) return null;
          return (
            <button
              key={f.clave}
              type="button"
              onClick={() => {
                setVista({ ...vista, filtro: f.clave });
                setLimite(PAGINA);
              }}
              className={cn(
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                vista.filtro === f.clave
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
              )}
            >
              {f.etiqueta} <span className="font-mono text-xs opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
          {QUIEN.map(([q, l]) => (
            <button
              key={q}
              type="button"
              onClick={() => setVista({ ...vista, quien: q, clase: q === 'alumno' || q === 'todos' ? vista.clase : null })}
              className={cn(
                'h-8 cursor-pointer rounded-lg px-3 text-sm',
                vista.quien === q ? 'bg-white font-semibold shadow-sm dark:bg-zinc-900' : 'text-zinc-600 dark:text-zinc-400',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {(vista.quien === 'alumno' || vista.quien === 'todos') && (
          <select
            value={vista.clase ?? ''}
            onChange={(e) => setVista({ ...vista, clase: e.target.value || null })}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Clase"
          >
            <option value="">Todas las clases</option>
            {clases.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={vista.busqueda}
            onChange={(e) => setVista({ ...vista, busqueda: e.target.value })}
            placeholder="Nombre, correo, clase o unidad"
            className={cn(CAMPO, 'pl-9')}
          />
        </div>
      </div>

      {vista.filtro === 'bajas' && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
          A quien termina 4º de ESO se le deja el correo {estado.ajustes.graciaGraduados} meses; a las demás bajas del alumnado,{' '}
          {estado.ajustes.graciaBajas}, y al profesorado, {estado.ajustes.graciaProfes}. Se cuenta desde la última vez que salían en
          Educamos (o su fecha de baja). Se cambia en Unidades.
        </p>
      )}
      {vista.filtro === 'sueltas' && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
          Cuentas de las unidades del alumnado y del profesorado que no casan con nadie de Educamos: casi siempre son de gente que
          ya se fue antes de que existiera la BBDD central. Antes de suspender, mira las que dicen «se parece a»: puede que sea de
          alguien que sigue y tenga otro correo apuntado.
        </p>
      )}

      {progreso && <Progreso texto={progreso.texto} hechos={progreso.hechos} total={progreso.total} />}

      {/* ── Lista ─────────────────────────────────────────────────────── */}
      <section className={cn(TARJETA, 'overflow-hidden')}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {puedeGestionar && seleccionables.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={seleccionables.every((f) => seleccion.has(f.clave))}
                onChange={alternarTodas}
              />
              Seleccionar {seleccionables.length === 1 ? 'la que tiene algo que hacer' : `las ${seleccionables.length} que tienen algo que hacer`}
            </label>
          ) : (
            <span>{visibles.length} en la lista</span>
          )}
          {vista.filtro === 'sueltas' && puedeGestionar && (
            <button
              type="button"
              className="cursor-pointer text-xs text-blue-700 underline dark:text-blue-300"
              onClick={() => {
                const meses = estado.ajustes.graciaGraduados;
                const viejas = seleccionables.filter(
                  (f) => !f.parecidas.length && haceMasDe(f.cuenta?.ultimoAccesoAt ?? f.cuenta?.creadaAt ?? null, meses),
                );
                setSeleccion(new Set([...seleccion, ...viejas.map((f) => f.clave)]));
              }}
            >
              Seleccionar las que llevan más de {estado.ajustes.graciaGraduados} meses sin entrar
            </button>
          )}
        </div>
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            {filas.length === 0 ? 'Todavía no se ha leído Google.' : 'Nada con estos filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.slice(0, limite).map((f, i, lista) => {
              const grupo = rotuloGrupo(f);
              const nuevoGrupo = i === 0 || rotuloGrupo(lista[i - 1]) !== grupo;
              return (
                <Fila
                  key={f.clave}
                  f={f}
                  rotulo={nuevoGrupo ? grupo : null}
                  abierta={abierta === f.clave}
                  marcada={seleccion.has(f.clave)}
                  seleccionable={puedeGestionar && !!ACCION_DE[f.estado] && !f.cuenta?.admin}
                  puedeGestionar={puedeGestionar}
                  onAlternar={() => alternar(f.clave)}
                  onAbrir={() => setAbierta(abierta === f.clave ? null : f.clave)}
                  onCrear={() => setDialogo({ tipo: 'crear', filas: [f] })}
                  onMoverASuSitio={() => moverASuSitio([f])}
                  onMoverA={() => setDialogo({ tipo: 'mover-a', filas: [f] })}
                  onSuspender={() => setDialogo({ tipo: 'suspender', filas: [f] })}
                  onReactivar={() => setDialogo({ tipo: 'reactivar', filas: [f] })}
                  onArchivar={() => archivarYa([f])}
                  onContrasena={() => setDialogo({ tipo: 'contrasena', fila: f })}
                  onMarcar={() => setDialogo({ tipo: 'marcar', fila: f })}
                  onVincular={(clave) => (f.tipo === 'cuenta' ? vincular(clave, f.clave) : vincular(f.clave, clave))}
                />
              );
            })}
          </ul>
        )}
        {visibles.length > limite && (
          <button
            type="button"
            onClick={() => setLimite(limite + PAGINA)}
            className="w-full cursor-pointer border-t border-zinc-100 py-3 text-sm font-medium text-blue-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-blue-300 dark:hover:bg-zinc-800"
          >
            Ver {Math.min(PAGINA, visibles.length - limite)} más (quedan {visibles.length - limite})
          </button>
        )}
      </section>

      {/* ── Barra de acciones ─────────────────────────────────────────── */}
      {puedeGestionar && seleccion.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 pr-14">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {seleccion.size} seleccionada{seleccion.size === 1 ? '' : 's'}
              <button type="button" onClick={() => setSeleccion(new Set())} className="ml-3 cursor-pointer text-xs text-zinc-500 underline">
                quitar selección
              </button>
            </p>
            <div className="flex flex-wrap gap-2">
              <BotonAccion n={porAccion('crear').length} onClick={() => setDialogo({ tipo: 'crear', filas: porAccion('crear') })} primario>
                <MailPlus className="h-4 w-4" /> Crear correos
              </BotonAccion>
              <BotonAccion n={porAccion('mover').length} onClick={() => moverASuSitio(porAccion('mover'))} primario>
                <FolderInput className="h-4 w-4" /> Llevar a su clase
              </BotonAccion>
              <BotonAccion n={porAccion('archivar').length} onClick={() => archivarYa(porAccion('archivar'))}>
                <FolderInput className="h-4 w-4" /> Archivar
              </BotonAccion>
              <BotonAccion n={porAccion('reactivar').length} onClick={() => setDialogo({ tipo: 'reactivar', filas: porAccion('reactivar') })}>
                <ArchiveRestore className="h-4 w-4" /> Reactivar
              </BotonAccion>
              <BotonAccion n={porAccion('suspender').length} onClick={() => setDialogo({ tipo: 'suspender', filas: porAccion('suspender') })} peligro>
                <UserX className="h-4 w-4" /> Suspender
              </BotonAccion>
            </div>
          </div>
        </div>
      )}

      {/* ── Diálogos ──────────────────────────────────────────────────── */}
      {dialogo?.tipo === 'crear' && (
        <CrearCorreos
          filas={dialogo.filas}
          unidades={estado.unidades}
          dominio={estado.dominio}
          uoPorDefecto={{ alumno: estado.ajustes.raizAlumnos ?? '/', profe: estado.ajustes.raizProfes ?? '/' }}
          onCerrar={() => setDialogo(null)}
          onHecho={async () => {
            setDialogo(null);
            setSeleccion(new Set());
            await recargar();
          }}
        />
      )}
      {dialogo?.tipo === 'mover-a' && (
        <MoverA
          filas={dialogo.filas}
          unidades={estado.unidades}
          onCerrar={() => setDialogo(null)}
          onHecho={async (r) => {
            setDialogo(null);
            await terminar(r, 'movidas');
          }}
        />
      )}
      {dialogo?.tipo === 'contrasena' && <ContrasenaNueva fila={dialogo.fila} onCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === 'marcar' && (
        <MarcarCuenta
          fila={dialogo.fila}
          onCerrar={() => setDialogo(null)}
          onHecho={async () => {
            setDialogo(null);
            await recargar();
          }}
        />
      )}
      <ConfirmarPalabra
        abierto={dialogo?.tipo === 'suspender'}
        titulo={`Suspender ${dialogo?.tipo === 'suspender' ? dialogo.filas.length : 0} cuenta(s)`}
        descripcion="Dejan de poder entrar en Google (correo, Drive, Classroom…). Sus datos se quedan y se puede reactivar cuando haga falta."
        palabra="SUSPENDER"
        boton="Suspender"
        onCerrar={() => setDialogo(null)}
        onConfirmar={() => {
          if (dialogo?.tipo !== 'suspender') return;
          const fs = dialogo.filas;
          enBloque(fs, 'Suspendiendo…', `${API}/suspender`, (t) => ({ ids: t.map((f) => f.cuenta!.id), archivar, confirmacion: 'SUSPENDER' }), 'suspendidas');
        }}
      >
        {dialogo?.tipo === 'suspender' && (
          <ResumenSuspender filas={dialogo.filas} ajustes={estado.ajustes} archivar={archivar} setArchivar={setArchivar} />
        )}
      </ConfirmarPalabra>
      <ConfirmarPalabra
        abierto={dialogo?.tipo === 'reactivar'}
        titulo={`Reactivar ${dialogo?.tipo === 'reactivar' ? dialogo.filas.length : 0} cuenta(s)`}
        descripcion="Vuelven a poder entrar con la contraseña que tenían."
        palabra="REACTIVAR"
        boton="Reactivar"
        peligro={false}
        onCerrar={() => setDialogo(null)}
        onConfirmar={() => {
          if (dialogo?.tipo !== 'reactivar') return;
          enBloque(dialogo.filas, 'Reactivando…', `${API}/reactivar`, (t) => ({ ids: t.map((f) => f.cuenta!.id), aSuSitio }), 'reactivadas');
        }}
      >
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={aSuSitio} onChange={(e) => setASuSitio(e.target.checked)} className="mt-0.5" />
          Devolverlas a la unidad de su clase (o de su etapa, si es profe)
        </label>
      </ConfirmarPalabra>
    </div>
  );
}

function haceMasDe(iso: string | null, meses: number): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > meses * 30.4 * 86_400_000;
}

function BotonAccion({
  n,
  onClick,
  children,
  primario,
  peligro,
}: {
  n: number;
  onClick: () => void;
  children: React.ReactNode;
  primario?: boolean;
  peligro?: boolean;
}) {
  if (n === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={cn(
        primario ? BOTON_PRIMARIO : BOTON,
        peligro && 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-500/10',
      )}
    >
      {children} <span className="font-mono text-xs opacity-80">{n}</span>
    </button>
  );
}

function ResumenSuspender({
  filas,
  ajustes,
  archivar,
  setArchivar,
}: {
  filas: FilaCuenta[];
  ajustes: AjustesCuentas;
  archivar: boolean;
  setArchivar: (v: boolean) => void;
}) {
  const enEspera = filas.filter((f) => f.estado === 'baja-espera').length;
  const siguen = filas.filter((f) => f.activo).length;
  const hoy = new Date().toISOString().slice(0, 10);
  const destinos = new Map<string, number>();
  for (const f of filas) {
    // Lo mismo que calcula el servidor: las bajas y sueltas traen su archivo; a quien sigue en
    // Educamos se le calcula como si se fuera hoy.
    const d = f.activo
      ? uoArchivo(ajustes, { zona: f.tipo === 'alumno' ? 'alumnado' : 'profesorado', salidaAt: hoy, graduado: false })
      : f.uoDestino;
    const texto = !d ? 'se quedan donde están (no hay unidad de archivo)' : uoDentroDe(f.cuenta?.uo, d) ? 'ya están en su archivo' : d;
    destinos.set(texto, (destinos.get(texto) ?? 0) + 1);
  }
  return (
    <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
      {enEspera > 0 && (
        <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {enEspera} todavía están en sus meses de espera.
        </p>
      )}
      {siguen > 0 && (
        <p className="flex items-start gap-1.5 text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {siguen === 1 ? 'Sigue en Educamos: es alumno o profe del centro.' : `${siguen} siguen en Educamos: son del centro.`}
        </p>
      )}
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={archivar} onChange={(e) => setArchivar(e.target.checked)} className="mt-0.5" />
        <span>
          Llevarlas a su unidad de archivo
          {archivar && (
            <span className="mt-1 block space-y-0.5 text-xs text-zinc-500">
              {[...destinos.entries()].map(([d, n]) => (
                <span key={d} className="block">
                  {n} → {d}
                </span>
              ))}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

function Fila({
  f,
  rotulo,
  abierta,
  marcada,
  seleccionable,
  puedeGestionar,
  onAlternar,
  onAbrir,
  onCrear,
  onMoverASuSitio,
  onMoverA,
  onSuspender,
  onReactivar,
  onArchivar,
  onContrasena,
  onMarcar,
  onVincular,
}: {
  f: FilaCuenta;
  rotulo: string | null;
  abierta: boolean;
  marcada: boolean;
  seleccionable: boolean;
  puedeGestionar: boolean;
  onAlternar: () => void;
  onAbrir: () => void;
  onCrear: () => void;
  onMoverASuSitio: () => void;
  onMoverA: () => void;
  onSuspender: () => void;
  onReactivar: () => void;
  onArchivar: () => void;
  onContrasena: () => void;
  onMarcar: () => void;
  onVincular: (clave: string) => void;
}) {
  const [vinculando, setVinculando] = useState<string | null>(null);
  const textoEstado =
    f.estado === 'baja-espera' && f.suspenderDesde
      ? `Baja · se suspende el ${fecha(f.suspenderDesde)}`
      : f.estado === 'marcada' && f.marca
        ? MARCA_LABEL[f.marca.tipo]
        : f.estado === 'marcada' && f.cuenta?.admin
          ? 'Administrador'
          : undefined;
  const tocable = puedeGestionar && f.cuenta && !f.cuenta.admin;
  return (
    <>
      {rotulo && (
        <li className="bg-zinc-50 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:bg-zinc-950">
          {rotulo}
        </li>
      )}
      <li className={cn(marcada && 'bg-blue-50/60 dark:bg-blue-500/5')}>
        <div className="flex items-start gap-3 px-4 py-3">
          {puedeGestionar && (
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={marcada}
              disabled={!seleccionable}
              onChange={onAlternar}
              aria-label={`Seleccionar ${f.nombre}`}
            />
          )}
          <button type="button" onClick={onAbrir} className="min-w-0 flex-1 cursor-pointer text-left">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{f.nombre}</span>
              {f.tipo === 'alumno' && f.clase && !f.activo && (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  era de {f.clase}
                </span>
              )}
              {f.tipo === 'profe' && (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  Profe
                </span>
              )}
              <ChipEstado estado={f.estado} texto={textoEstado} />
              {f.parecidas.length > 0 && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">
                  {f.tipo === 'cuenta' ? `¿De ${f.parecidas[0].nombre}?` : 'Se le parece una cuenta'}
                </span>
              )}
              {f.avisos.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Tiene avisos" />}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {f.cuenta ? (
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{f.cuenta.email}</span>
              ) : f.propuesta ? (
                <span className="font-mono">→ {f.propuesta}</span>
              ) : (
                <span>sin correo</span>
              )}
              {f.cuenta && <ChipUo ruta={f.cuenta.uo} />}
              {f.estado === 'fuera' && f.uoDestino && (
                <span className="inline-flex items-center gap-1">
                  → <ChipUo ruta={f.uoDestino} />
                </span>
              )}
              {f.cuenta && <span>entró {haceTiempo(f.cuenta.ultimoAccesoAt)}</span>}
            </p>
          </button>
          {abierta ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />}
        </div>

        {abierta && (
          <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {f.cuenta && (
                <>
                  <Dato etiqueta="Correo de Google">
                    <span className="font-mono">{f.cuenta.email}</span>
                  </Dato>
                  <Dato etiqueta="Unidad">
                    <span className="font-mono text-xs">{f.cuenta.uo}</span>
                  </Dato>
                  <Dato etiqueta="Último acceso">{f.cuenta.ultimoAccesoAt ? fecha(f.cuenta.ultimoAccesoAt) : 'Nunca'}</Dato>
                  <Dato etiqueta="Creada">{fecha(f.cuenta.creadaAt)}</Dato>
                </>
              )}
              {f.tipo !== 'cuenta' && <Dato etiqueta="En Educamos">{f.correoEducamos ?? 'Sin correo apuntado'}</Dato>}
              {f.uoDestino && f.activo && f.tipo === 'alumno' && (
                <Dato etiqueta="Unidad de su clase">
                  <span className="font-mono text-xs">{f.uoDestino}</span>
                </Dato>
              )}
              {f.salidaAt && <Dato etiqueta={f.tipo === 'profe' ? 'Fecha de baja' : 'Última vez en Educamos'}>{fecha(f.salidaAt)}</Dato>}
              {f.suspenderDesde && <Dato etiqueta="Se suspende desde">{fecha(f.suspenderDesde)}</Dato>}
              {f.marca && (
                <Dato etiqueta={MARCA_LABEL[f.marca.tipo]}>
                  {f.marca.nota ?? 'Sin nota'} · {f.marca.por} · {fecha(f.marca.at)}
                </Dato>
              )}
            </dl>

            {f.avisos.map((a) => (
              <p key={a} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
              </p>
            ))}

            {f.parecidas.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-orange-200 bg-orange-50/60 p-3 dark:border-orange-500/30 dark:bg-orange-500/5">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                  {f.tipo === 'cuenta' ? 'Se parece a alguien de Educamos sin correo' : 'Se le parece una cuenta que no es de nadie'}
                </p>
                {f.parecidas.map((p) => (
                  <div key={p.clave} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      <b>{p.nombre}</b>
                      {p.email && <span className="ml-2 font-mono text-xs">{p.email}</span>}
                      {p.detalle && <span className="ml-2 text-xs text-zinc-500">{p.detalle}</span>}
                    </span>
                    {puedeGestionar && (
                      <button
                        type="button"
                        className={cn(BOTON, 'h-9')}
                        disabled={vinculando !== null}
                        onClick={async () => {
                          setVinculando(p.clave);
                          await onVincular(p.clave);
                          setVinculando(null);
                        }}
                      >
                        {vinculando === p.clave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        {f.tipo === 'cuenta' ? 'Es suya' : 'Es su cuenta'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {puedeGestionar && f.estado === 'sin-correo' && (
                <button type="button" className={cn(BOTON_PRIMARIO, 'h-9')} onClick={onCrear}>
                  <MailPlus className="h-4 w-4" /> Crear su correo
                </button>
              )}
              {tocable && f.estado === 'fuera' && (
                <button type="button" className={cn(BOTON_PRIMARIO, 'h-9')} onClick={onMoverASuSitio}>
                  <FolderInput className="h-4 w-4" /> Llevar a su clase
                </button>
              )}
              {tocable && f.estado === 'archivar' && (
                <button type="button" className={cn(BOTON, 'h-9')} onClick={onArchivar}>
                  <FolderInput className="h-4 w-4" /> Archivar
                </button>
              )}
              {tocable && f.cuenta!.suspendida && (
                <button type="button" className={cn(BOTON, 'h-9')} onClick={onReactivar}>
                  <ArchiveRestore className="h-4 w-4" /> Reactivar
                </button>
              )}
              {tocable && (
                <button type="button" className={cn(BOTON, 'h-9')} onClick={onMoverA}>
                  <FolderInput className="h-4 w-4" /> Mover a…
                </button>
              )}
              {tocable && !f.cuenta!.suspendida && (
                <button type="button" className={cn(BOTON, 'h-9')} onClick={onContrasena}>
                  <KeyRound className="h-4 w-4" /> Contraseña nueva
                </button>
              )}
              {puedeGestionar && f.tipo === 'cuenta' && f.cuenta && !f.cuenta.admin && !f.cuenta.suspendida && (
                <button type="button" className={cn(BOTON, 'h-9')} onClick={onMarcar}>
                  <ShieldCheck className="h-4 w-4" /> {f.marca ? 'Cambiar la marca' : 'Se queda'}
                </button>
              )}
              {tocable && !f.cuenta!.suspendida && f.estado !== 'marcada' && (
                <button
                  type="button"
                  className={cn(BOTON, 'h-9 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300')}
                  onClick={onSuspender}
                >
                  <UserX className="h-4 w-4" /> Suspender
                </button>
              )}
              {f.cuenta && <BotonCopiar texto={f.cuenta.email} etiqueta="Copiar correo" />}
              {f.cuenta && (
                <a href={enlaceConsolaUsuario(f.cuenta.id)} target="_blank" rel="noreferrer" className={cn(BOTON, 'h-9')}>
                  <ExternalLink className="h-4 w-4" /> Abrir en la consola
                </a>
              )}
            </div>
          </div>
        )}
      </li>
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{etiqueta}</dt>
      <dd className="truncate text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  );
}
