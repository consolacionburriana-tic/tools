'use client';

// La lista de todas las cuentas cruzadas con Educamos: filtros por lo que hay que hacer,
// selección en bloque y, al tocar una fila, su ficha con lo que se puede hacer con ella.
import { useMemo, useState } from 'react';
import {
  ArchiveRestore,
  ChevronRight,
  ExternalLink,
  FolderInput,
  KeyRound,
  Link2,
  MailPlus,
  Search,
  SearchX,
  ShieldCheck,
  TriangleAlert,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { compararClases } from '@/lib/cursos';
import {
  enlaceConsolaUsuario,
  MARCA_LABEL,
  nombreUo,
  uoArchivo,
  uoDentroDe,
  type AjustesCuentas,
  type EstadoFila,
  type FilaCuenta,
} from '@/lib/cuentas';
import type { EstadoCuentas, ResultadoAccion } from '@/lib/cuentas-server';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Dato } from '@/components/ui/copiable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro as Pastilla, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { EnCurso } from '@/components/ui/progreso';
import { Rotulo } from '@/components/ui/rotulo';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { avisarResultado, enTandas, EstadoCuenta, fecha, haceTiempo, post } from './comun';
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

/** «1 cuenta», «12 cuentas». */
const cuentas = (n: number) => `${n} cuenta${n === 1 ? '' : 's'}`;

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
  const fichaAbierta = abierta ? filas.find((f) => f.clave === abierta) : undefined;

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

  /** Desde la ficha: se cierra y sigue la acción (su diálogo, o la tanda con su progreso). */
  const desdeFicha = (accion: () => void) => () => {
    setAbierta(null);
    accion();
  };

  /** En la barra de abajo, el botón azul es el de la primera acción que haya (por este orden). */
  const nCrear = porAccion('crear').length;
  const nMover = porAccion('mover').length;
  const nArchivar = porAccion('archivar').length;
  const nReactivar = porAccion('reactivar').length;
  const nSuspender = porAccion('suspender').length;
  const principal = nCrear ? 'crear' : nMover ? 'mover' : nArchivar ? 'archivar' : nReactivar ? 'reactivar' : null;
  const variante = (a: typeof principal) => (principal === a ? 'default' : 'outline');
  const tocar = (accion: () => void) => () => {
    haptic.tap();
    accion();
  };

  const clases = estado.cruce.clases;
  const rotuloGrupo = (f: FilaCuenta) => (f.tipo === 'alumno' ? (f.clase ?? 'Sin clase') : f.tipo === 'profe' ? 'Profesorado' : (f.cuenta?.uo ?? '/'));
  const nSusp = dialogo?.tipo === 'suspender' ? dialogo.filas.length : 0;
  const nReac = dialogo?.tipo === 'reactivar' ? dialogo.filas.length : 0;

  return (
    <div className="space-y-4">
      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <Filtros etiqueta="Mostrar">
        {FILTROS.map((f) => {
          const n = cuentaFiltro(f.pasa);
          if (f.clave !== 'todas' && n === 0 && vista.filtro !== f.clave) return null;
          return (
            <Pastilla
              key={f.clave}
              activo={vista.filtro === f.clave}
              cuenta={n}
              onClick={() => {
                setVista({ ...vista, filtro: f.clave });
                setLimite(PAGINA);
              }}
            >
              {f.etiqueta}
            </Pastilla>
          );
        })}
      </Filtros>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="text-sm text-zinc-500 dark:text-zinc-400">
            De quién
          </span>
          <Filtros etiqueta="De quién">
            {QUIEN.map(([q, l]) => (
              <Pastilla
                key={q}
                activo={vista.quien === q}
                onClick={() => setVista({ ...vista, quien: q, clase: q === 'alumno' || q === 'todos' ? vista.clase : null })}
              >
                {l}
              </Pastilla>
            ))}
          </Filtros>
        </div>
        <div className="flex min-w-0 flex-[1_1_28rem] flex-wrap gap-2">
          {(vista.quien === 'alumno' || vista.quien === 'todos') && (
            <Selector
              aria-label="Clase"
              value={vista.clase ?? ''}
              onChange={(e) => setVista({ ...vista, clase: e.target.value || null })}
              className="sm:w-52"
            >
              <option value="">Todas las clases</option>
              {clases.map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          )}
          <div className="relative min-w-52 flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={vista.busqueda}
              onChange={(e) => setVista({ ...vista, busqueda: e.target.value })}
              placeholder="Nombre, correo, clase o unidad"
              aria-label="Buscar"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {vista.filtro === 'bajas' && (
        <Aviso tono="info">
          A quien termina 4º de ESO se le deja el correo {estado.ajustes.graciaGraduados} meses; a las demás bajas del alumnado,{' '}
          {estado.ajustes.graciaBajas}, y al profesorado, {estado.ajustes.graciaProfes}. Se cuenta desde la última vez que salían en
          Educamos (o su fecha de baja). Se cambia en Unidades.
        </Aviso>
      )}
      {vista.filtro === 'sueltas' && (
        <Aviso tono="info">
          Cuentas de las unidades del alumnado y del profesorado que no casan con nadie de Educamos: casi siempre son de gente que
          ya se fue antes de que existiera la BBDD central. Antes de suspender, mira las que dicen «se parece a»: puede que sea de
          alguien que sigue y tenga otro correo apuntado.
        </Aviso>
      )}

      {progreso && <EnCurso texto={progreso.texto} hechos={progreso.hechos} total={progreso.total} />}

      {/* ── Lista ─────────────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <Vacio
          icono={<SearchX />}
          titulo={filas.length === 0 ? 'Todavía no se ha leído Google' : 'Nada con estos filtros'}
          accion={
            filas.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setVista({ filtro: 'todas', quien: 'todos', clase: null, busqueda: '' })}>
                Ver todas las cuentas
              </Button>
            )
          }
        >
          {filas.length > 0 && 'Prueba con otro filtro, otra clase o menos letras en la búsqueda.'}
        </Vacio>
      ) : (
        <Tarjeta as="section" aria-label="Cuentas" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-zinc-100 px-2 py-1 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            {puedeGestionar && seleccionables.length > 0 ? (
              <label className="flex min-h-10 cursor-pointer items-center">
                <span className="flex size-10 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-blue-600"
                    checked={seleccionables.every((f) => seleccion.has(f.clave))}
                    onChange={alternarTodas}
                  />
                </span>
                Seleccionar {seleccionables.length === 1 ? 'la que tiene algo que hacer' : `las ${seleccionables.length} que tienen algo que hacer`}
              </label>
            ) : (
              <span className="px-2 py-2.5 tabular-nums">{visibles.length} en la lista</span>
            )}
            {vista.filtro === 'sueltas' && puedeGestionar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-10 text-left whitespace-normal"
                onClick={() => {
                  const meses = estado.ajustes.graciaGraduados;
                  const viejas = seleccionables.filter(
                    (f) => !f.parecidas.length && haceMasDe(f.cuenta?.ultimoAccesoAt ?? f.cuenta?.creadaAt ?? null, meses),
                  );
                  setSeleccion(new Set([...seleccion, ...viejas.map((f) => f.clave)]));
                }}
              >
                Seleccionar las que llevan más de {estado.ajustes.graciaGraduados} meses sin entrar
              </Button>
            )}
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {visibles.slice(0, limite).map((f, i, lista) => {
              const grupo = rotuloGrupo(f);
              const nuevoGrupo = i === 0 || rotuloGrupo(lista[i - 1]) !== grupo;
              return (
                <Fila
                  key={f.clave}
                  f={f}
                  rotulo={nuevoGrupo ? grupo : null}
                  marcada={seleccion.has(f.clave)}
                  seleccionable={puedeGestionar && !!ACCION_DE[f.estado] && !f.cuenta?.admin}
                  puedeGestionar={puedeGestionar}
                  onAlternar={() => alternar(f.clave)}
                  onAbrir={() => {
                    haptic.tap();
                    setAbierta(f.clave);
                  }}
                />
              );
            })}
          </ul>
          {visibles.length > limite && (
            <Button
              variant="ghost"
              className="w-full rounded-none border-t border-zinc-100 dark:border-zinc-800"
              onClick={() => setLimite(limite + PAGINA)}
            >
              Ver {Math.min(PAGINA, visibles.length - limite)} más (quedan {visibles.length - limite})
            </Button>
          )}
        </Tarjeta>
      )}

      {/* ── Barra de acciones ─────────────────────────────────────────── */}
      {/* Sin `resumen`: así el texto y los botones pueden bajar de línea en el móvil. */}
      <BarraAcciones visible={puedeGestionar && seleccion.size > 0} ancho="ancho">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="flex items-center gap-1 text-sm text-zinc-600 tabular-nums dark:text-zinc-300">
            {seleccion.size} seleccionada{seleccion.size === 1 ? '' : 's'}
            <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())}>
              Quitar selección
            </Button>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {nCrear > 0 && (
              <Button variant={variante('crear')} onClick={tocar(() => setDialogo({ tipo: 'crear', filas: porAccion('crear') }))}>
                <MailPlus /> Crear {nCrear === 1 ? '1 correo' : `${nCrear} correos`}
              </Button>
            )}
            {nMover > 0 && (
              <Button variant={variante('mover')} onClick={tocar(() => moverASuSitio(porAccion('mover')))}>
                <FolderInput /> Llevar {nMover} a su clase
              </Button>
            )}
            {nArchivar > 0 && (
              <Button variant={variante('archivar')} onClick={tocar(() => archivarYa(porAccion('archivar')))}>
                <FolderInput /> Archivar {nArchivar}
              </Button>
            )}
            {nReactivar > 0 && (
              <Button variant={variante('reactivar')} onClick={tocar(() => setDialogo({ tipo: 'reactivar', filas: porAccion('reactivar') }))}>
                <ArchiveRestore /> Reactivar {nReactivar}
              </Button>
            )}
            {nSuspender > 0 && (
              <Button variant="destructive" onClick={tocar(() => setDialogo({ tipo: 'suspender', filas: porAccion('suspender') }))}>
                <UserX /> Suspender {nSuspender}
              </Button>
            )}
          </div>
        </div>
      </BarraAcciones>

      {/* ── La ficha de una cuenta ────────────────────────────────────── */}
      {fichaAbierta && (
        <FichaCuenta
          f={fichaAbierta}
          puedeGestionar={puedeGestionar}
          onCerrar={() => setAbierta(null)}
          onCrear={desdeFicha(() => setDialogo({ tipo: 'crear', filas: [fichaAbierta] }))}
          onMoverASuSitio={desdeFicha(() => void moverASuSitio([fichaAbierta]))}
          onMoverA={desdeFicha(() => setDialogo({ tipo: 'mover-a', filas: [fichaAbierta] }))}
          onSuspender={desdeFicha(() => setDialogo({ tipo: 'suspender', filas: [fichaAbierta] }))}
          onReactivar={desdeFicha(() => setDialogo({ tipo: 'reactivar', filas: [fichaAbierta] }))}
          onArchivar={desdeFicha(() => void archivarYa([fichaAbierta]))}
          onContrasena={desdeFicha(() => setDialogo({ tipo: 'contrasena', fila: fichaAbierta }))}
          onMarcar={desdeFicha(() => setDialogo({ tipo: 'marcar', fila: fichaAbierta }))}
          onVincular={(clave) => (fichaAbierta.tipo === 'cuenta' ? vincular(clave, fichaAbierta.clave) : vincular(fichaAbierta.clave, clave))}
        />
      )}

      {/* ── Diálogos ──────────────────────────────────────────────────── */}
      {dialogo?.tipo === 'crear' && (
        <CrearCorreos
          filas={dialogo.filas}
          unidades={estado.unidades}
          enGoogle={estado.cruce.enGoogle}
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
      <ConfirmarDialogo
        abierto={dialogo?.tipo === 'suspender'}
        titulo={`Suspender ${cuentas(nSusp)}`}
        descripcion="Dejan de poder entrar en Google (correo, Drive, Classroom…). Sus datos se quedan y se puede reactivar cuando haga falta."
        palabra="SUSPENDER"
        boton={`Suspender ${cuentas(nSusp)}`}
        onCerrar={() => setDialogo(null)}
        onConfirmar={() => {
          if (dialogo?.tipo !== 'suspender') return;
          const fs = dialogo.filas;
          void enBloque(fs, 'Suspendiendo…', `${API}/suspender`, (t) => ({ ids: t.map((f) => f.cuenta!.id), archivar, confirmacion: 'SUSPENDER' }), 'suspendidas');
        }}
      >
        {dialogo?.tipo === 'suspender' && (
          <ResumenSuspender filas={dialogo.filas} ajustes={estado.ajustes} archivar={archivar} setArchivar={setArchivar} />
        )}
      </ConfirmarDialogo>
      <ConfirmarDialogo
        abierto={dialogo?.tipo === 'reactivar'}
        titulo={`Reactivar ${cuentas(nReac)}`}
        descripcion="Vuelven a poder entrar con la contraseña que tenían."
        palabra="REACTIVAR"
        boton={`Reactivar ${cuentas(nReac)}`}
        peligro={false}
        onCerrar={() => setDialogo(null)}
        onConfirmar={() => {
          if (dialogo?.tipo !== 'reactivar') return;
          void enBloque(dialogo.filas, 'Reactivando…', `${API}/reactivar`, (t) => ({ ids: t.map((f) => f.cuenta!.id), aSuSitio }), 'reactivadas');
        }}
      >
        <Casilla marcada={aSuSitio} onCambiar={setASuSitio}>
          Devolverlas a la unidad de su clase (o de su etapa, si es profe)
        </Casilla>
      </ConfirmarDialogo>
    </div>
  );
}

function haceMasDe(iso: string | null, meses: number): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > meses * 30.4 * 86_400_000;
}

/** Lo que dice el estado de una fila cuando el de siempre se queda corto. */
function textoEstado(f: FilaCuenta): string | undefined {
  if (f.estado === 'baja-espera' && f.suspenderDesde) return `Baja · se suspende el ${fecha(f.suspenderDesde)}`;
  if (f.estado === 'marcada' && f.marca) return MARCA_LABEL[f.marca.tipo];
  if (f.estado === 'marcada' && f.cuenta?.admin) return 'Administrador';
  return undefined;
}

/** Una casilla con su texto: toda la fila se toca (40 px como mínimo). */
function Casilla({
  marcada,
  onCambiar,
  ayuda,
  children,
}: {
  marcada: boolean;
  onCambiar: (v: boolean) => void;
  ayuda?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-start gap-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
      <input type="checkbox" checked={marcada} onChange={(e) => onCambiar(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-blue-600" />
      <span>
        {children}
        {ayuda && <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{ayuda}</span>}
      </span>
    </label>
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
    <div className="space-y-2">
      {enEspera > 0 && <Aviso tono="aviso">{enEspera} todavía están en sus meses de espera.</Aviso>}
      {siguen > 0 && (
        <Aviso tono="error">{siguen === 1 ? 'Sigue en Educamos: es alumno o profe del centro.' : `${siguen} siguen en Educamos: son del centro.`}</Aviso>
      )}
      <Casilla
        marcada={archivar}
        onCambiar={setArchivar}
        ayuda={
          archivar &&
          [...destinos.entries()].map(([d, n]) => (
            <span key={d} className="block">
              {n} → {d}
            </span>
          ))
        }
      >
        Llevarlas a su unidad de archivo
      </Casilla>
    </div>
  );
}

function Fila({
  f,
  rotulo,
  marcada,
  seleccionable,
  puedeGestionar,
  onAlternar,
  onAbrir,
}: {
  f: FilaCuenta;
  rotulo: string | null;
  marcada: boolean;
  seleccionable: boolean;
  puedeGestionar: boolean;
  onAlternar: () => void;
  onAbrir: () => void;
}) {
  return (
    <>
      {rotulo && (
        <li className="bg-zinc-50 px-4 py-2 dark:bg-zinc-950/60">
          <Rotulo as="h3">{rotulo}</Rotulo>
        </li>
      )}
      <li className={cn('flex items-center gap-1 px-2', marcada && 'bg-blue-50/70 dark:bg-blue-500/10')}>
        {puedeGestionar && (
          <label className={cn('flex size-10 shrink-0 items-center justify-center', seleccionable && 'cursor-pointer')}>
            <input
              type="checkbox"
              className="size-4 accent-blue-600"
              checked={marcada}
              disabled={!seleccionable}
              onChange={onAlternar}
              aria-label={`Seleccionar ${f.nombre}`}
            />
          </label>
        )}
        <button
          type="button"
          onClick={onAbrir}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-left outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800/50"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{f.nombre}</span>
              {f.tipo === 'alumno' && f.clase && !f.activo && <Etiqueta>era de {f.clase}</Etiqueta>}
              {f.tipo === 'profe' && <Etiqueta>Profe</Etiqueta>}
              <EstadoCuenta estado={f.estado} texto={textoEstado(f)} />
              {f.parecidas.length > 0 && (
                <Estado tono="aviso">{f.tipo === 'cuenta' ? `¿De ${f.parecidas[0].nombre}?` : 'Se le parece una cuenta'}</Estado>
              )}
              {f.avisos.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <TriangleAlert aria-hidden className="size-3.5" />
                  {f.avisos.length === 1 ? '1 aviso' : `${f.avisos.length} avisos`}
                </span>
              )}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {f.cuenta ? (
                <span className="min-w-0 font-mono break-all text-zinc-700 dark:text-zinc-300">{f.cuenta.email}</span>
              ) : f.propuesta ? (
                <span className="min-w-0 font-mono break-all">→ {f.propuesta}</span>
              ) : (
                <span>sin correo</span>
              )}
              {f.cuenta && (
                <Etiqueta mono title={f.cuenta.uo} className="max-w-56">
                  {nombreUo(f.cuenta.uo)}
                </Etiqueta>
              )}
              {f.estado === 'fuera' && f.uoDestino && (
                <span className="inline-flex max-w-full items-center gap-1">
                  →
                  <Etiqueta mono title={f.uoDestino} className="max-w-56">
                    {nombreUo(f.uoDestino)}
                  </Etiqueta>
                </span>
              )}
              {f.cuenta && <span>entró {haceTiempo(f.cuenta.ultimoAccesoAt)}</span>}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-zinc-400" />
        </button>
      </li>
    </>
  );
}

/** La ficha de una cuenta: sus datos, lo que se le parece y lo que se puede hacer con ella. */
function FichaCuenta({
  f,
  puedeGestionar,
  onCerrar,
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
  puedeGestionar: boolean;
  onCerrar: () => void;
  onCrear: () => void;
  onMoverASuSitio: () => void;
  onMoverA: () => void;
  onSuspender: () => void;
  onReactivar: () => void;
  onArchivar: () => void;
  onContrasena: () => void;
  onMarcar: () => void;
  onVincular: (clave: string) => Promise<void>;
}) {
  const [vinculando, setVinculando] = useState<string | null>(null);
  const tocable = puedeGestionar && f.cuenta && !f.cuenta.admin;
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent variante="hoja" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.nombre}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <EstadoCuenta estado={f.estado} texto={textoEstado(f)} />
            {f.tipo === 'alumno' && f.clase && <Etiqueta>{f.activo ? f.clase : `era de ${f.clase}`}</Etiqueta>}
            {f.tipo === 'profe' && <Etiqueta>Profesorado</Etiqueta>}
            {f.tipo === 'cuenta' && <span>Cuenta que no casa con nadie de Educamos</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-0.5">
          {f.cuenta && (
            <>
              <Dato etiqueta="Correo de Google" valor={f.cuenta.email} mono />
              <Dato etiqueta="Unidad" valor={f.cuenta.uo} mono />
              <Linea etiqueta="Último acceso">{f.cuenta.ultimoAccesoAt ? fecha(f.cuenta.ultimoAccesoAt) : 'Nunca'}</Linea>
              <Linea etiqueta="Creada">{fecha(f.cuenta.creadaAt)}</Linea>
            </>
          )}
          {!f.cuenta && f.propuesta && <Linea etiqueta="Correo que se le crearía">{f.propuesta}</Linea>}
          {f.tipo !== 'cuenta' &&
            (f.correoEducamos ? (
              <Dato etiqueta="En Educamos" valor={f.correoEducamos} mono />
            ) : (
              <Linea etiqueta="En Educamos">Sin correo apuntado</Linea>
            ))}
          {f.uoDestino && f.activo && f.tipo === 'alumno' && <Dato etiqueta="Unidad de su clase" valor={f.uoDestino} mono />}
          {f.salidaAt && <Linea etiqueta={f.tipo === 'profe' ? 'Fecha de baja' : 'Última vez en Educamos'}>{fecha(f.salidaAt)}</Linea>}
          {f.suspenderDesde && <Linea etiqueta="Se suspende desde">{fecha(f.suspenderDesde)}</Linea>}
          {f.marca && (
            <Linea etiqueta={MARCA_LABEL[f.marca.tipo]}>
              {f.marca.nota ?? 'Sin nota'} · {f.marca.por} · {fecha(f.marca.at)}
            </Linea>
          )}
        </div>

        {f.avisos.length > 0 && (
          <Aviso tono="aviso">
            {f.avisos.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </Aviso>
        )}

        {f.parecidas.length > 0 && (
          <Aviso
            tono="aviso"
            icono={<Link2 />}
            titulo={f.tipo === 'cuenta' ? 'Se parece a alguien de Educamos sin correo' : 'Se le parece una cuenta que no es de nadie'}
          >
            <ul className="mt-2 space-y-2">
              {f.parecidas.map((p) => (
                <li key={p.clave} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <b className="font-semibold">{p.nombre}</b>
                    {p.email && <span className="block font-mono text-xs break-all">{p.email}</span>}
                    {p.detalle && <span className="block text-xs">{p.detalle}</span>}
                  </span>
                  {puedeGestionar && (
                    <Button
                      variant="outline"
                      size="sm"
                      cargando={vinculando === p.clave}
                      disabled={vinculando !== null}
                      onClick={async () => {
                        setVinculando(p.clave);
                        await onVincular(p.clave);
                        setVinculando(null);
                      }}
                    >
                      {vinculando !== p.clave && <Link2 />}
                      {f.tipo === 'cuenta' ? 'Es suya' : 'Es su cuenta'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Aviso>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {puedeGestionar && f.estado === 'sin-correo' && (
            <Button onClick={onCrear}>
              <MailPlus /> Crear su correo
            </Button>
          )}
          {tocable && f.estado === 'fuera' && (
            <Button onClick={onMoverASuSitio}>
              <FolderInput /> Llevar a su clase
            </Button>
          )}
          {tocable && f.estado === 'archivar' && (
            <Button variant="outline" onClick={onArchivar}>
              <FolderInput /> Archivar
            </Button>
          )}
          {tocable && f.cuenta!.suspendida && (
            <Button variant="outline" onClick={onReactivar}>
              <ArchiveRestore /> Reactivar
            </Button>
          )}
          {tocable && (
            <Button variant="outline" onClick={onMoverA}>
              <FolderInput /> Mover a…
            </Button>
          )}
          {tocable && !f.cuenta!.suspendida && (
            <Button variant="outline" onClick={onContrasena}>
              <KeyRound /> Contraseña nueva
            </Button>
          )}
          {puedeGestionar && f.tipo === 'cuenta' && f.cuenta && !f.cuenta.admin && !f.cuenta.suspendida && (
            <Button variant="outline" onClick={onMarcar}>
              <ShieldCheck /> {f.marca ? 'Cambiar la marca' : 'Se queda'}
            </Button>
          )}
          {tocable && !f.cuenta!.suspendida && f.estado !== 'marcada' && (
            <Button variant="destructive" onClick={onSuspender}>
              <UserX /> Suspender
            </Button>
          )}
          {f.cuenta && (
            <a href={enlaceConsolaUsuario(f.cuenta.id)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'ghost' })}>
              <ExternalLink /> Abrir en la consola
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Una fila «etiqueta · valor» de la ficha, para lo que no se copia (fechas, notas). */
function Linea({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 py-0.5">
      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{etiqueta}</span>
      <span className="min-w-0 truncate px-1.5 py-1 text-right text-sm text-zinc-800 dark:text-zinc-100">{children}</span>
    </div>
  );
}
