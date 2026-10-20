'use client';

// /gestion/cuentas: Correos y grupos. Ficha: docs/30-cuentas.md
//
// La pantalla abre con la foto de Neon (rápido) y, si quien entra puede leer Google y la foto
// tiene más de unos minutos, la refresca sola por detrás.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, FolderTree, ListChecks, Loader2, RefreshCw, ShieldCheck, Users, UsersRound, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import type { FilaCuenta } from '@/lib/cuentas';
import type { EstadoCuentas } from '@/lib/cuentas-server';
import { BOTON, BOTON_PRIMARIO, haceTiempo, pedir, post } from './comun';
import { Grupos } from './grupos';
import { ListaCuentas, type Filtro, type Quien, type VistaLista } from './lista';
import { PorHacer } from './por-hacer';
import { Registro } from './registro';
import { Unidades } from './unidades';

type Pestana = 'por-hacer' | 'cuentas' | 'grupos' | 'unidades' | 'registro';

const PESTANAS: [Pestana, string, typeof Users][] = [
  ['por-hacer', 'Por hacer', ListChecks],
  ['cuentas', 'Cuentas', Users],
  ['grupos', 'Grupos', UsersRound],
  ['unidades', 'Unidades', FolderTree],
  ['registro', 'Registro', ClipboardList],
];

/** A partir de cuánto se vuelve a leer Google solo al abrir la pantalla. */
const FOTO_VIEJA_MS = 10 * 60_000;

interface Comprobacion {
  clave: string;
  nombre: string;
  scope: string;
  ok: boolean;
  detalle: string;
}

export function PanelCuentas({
  inicial,
  puedeGestionar,
  puedeLeer,
  personaInicial,
}: {
  inicial: EstadoCuentas;
  puedeGestionar: boolean;
  puedeLeer: boolean;
  /** `?persona=a:<id>`: abre la lista con esa persona (desde Nouvinguts). */
  personaInicial: string | null;
}) {
  const [estado, setEstado] = useState(inicial);
  const filaInicial = personaInicial ? inicial.cruce.filas.find((f) => f.clave === personaInicial) : undefined;
  const [pestana, setPestana] = useState<Pestana>(filaInicial ? 'cuentas' : 'por-hacer');
  const [vista, setVista] = useState<VistaLista>({
    filtro: 'todas',
    quien: 'todos',
    clase: null,
    busqueda: filaInicial ? filaInicial.nombre.split(',')[0] : '',
  });
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(filaInicial && filaInicial.estado === 'sin-correo' ? [filaInicial.clave] : []),
  );
  const [leyendo, setLeyendo] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [permisos, setPermisos] = useState<{ admin: string; comprobaciones: Comprobacion[] } | null>(null);
  const [comprobando, setComprobando] = useState(false);

  const recargar = useCallback(async () => {
    try {
      setEstado(await pedir<EstadoCuentas>('/api/cuentas/estado'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido recargar');
    }
  }, []);

  const leerGoogle = useCallback(
    async (silencioso = false) => {
      setLeyendo(true);
      try {
        const r = await post<{ avisos: string[]; estado: EstadoCuentas }>('/api/cuentas/leer', {});
        setEstado(r.estado);
        setAvisos(r.avisos);
        if (!silencioso) {
          haptic.success();
          toast.success('Leído de Google');
        }
      } catch (e) {
        if (!silencioso) haptic.warning();
        toast.error(e instanceof Error ? e.message : 'No se ha podido leer Google');
      } finally {
        setLeyendo(false);
      }
    },
    [],
  );

  // Si la foto es vieja, se refresca sola al entrar (sin esperar a que nadie pulse nada).
  useEffect(() => {
    if (!puedeLeer) return;
    const vieja = !inicial.leidoAt || Date.now() - new Date(inicial.leidoAt).getTime() > FOTO_VIEJA_MS;
    if (!vieja) return;
    const t = setTimeout(() => void leerGoogle(true), 0);
    return () => clearTimeout(t);
  }, [inicial.leidoAt, puedeLeer, leerGoogle]);

  async function comprobarPermisos() {
    setComprobando(true);
    try {
      setPermisos(await pedir('/api/cuentas/admin/permisos'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido comprobar');
    } finally {
      setComprobando(false);
    }
  }

  function ir(filtro: Filtro, opciones: { quien?: Quien; elegir?: (f: FilaCuenta) => boolean } = {}) {
    haptic.tap();
    setVista({ filtro, quien: opciones.quien ?? 'todos', clase: null, busqueda: '' });
    setSeleccion(
      new Set(puedeGestionar && opciones.elegir ? estado.cruce.filas.filter(opciones.elegir).map((f) => f.clave) : []),
    );
    setPestana('cuentas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const sinLeer = !estado.leidoAt;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Correos y grupos</h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Las cuentas de Google del colegio, cruzadas con Educamos: quién no tiene correo, quién está en la unidad de otra clase,
            qué bajas siguen con la cuenta abierta y qué grupos hay que poner al día.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">
            {leyendo ? 'Leyendo Google…' : estado.leidoAt ? `Google leído ${haceTiempo(estado.leidoAt)}` : 'Sin leer Google'}
          </span>
          {puedeGestionar && (
            <button type="button" className={BOTON} onClick={comprobarPermisos} disabled={comprobando}>
              {comprobando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Permisos
            </button>
          )}
          {puedeLeer && (
            <button type="button" className={BOTON_PRIMARIO} onClick={() => leerGoogle()} disabled={leyendo}>
              {leyendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Leer de Google
            </button>
          )}
        </div>
      </div>

      {!puedeGestionar && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          Lo ves para consultar: los cambios los hace TIC.
        </p>
      )}

      {avisos.length > 0 && puedeGestionar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
          <button type="button" className="mt-1 cursor-pointer text-xs font-semibold underline" onClick={comprobarPermisos}>
            Ver qué hay que dar en la consola
          </button>
        </div>
      )}

      {permisos && <Permisos admin={permisos.admin} comprobaciones={permisos.comprobaciones} onCerrar={() => setPermisos(null)} />}

      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {PESTANAS.map(([p, l, Icono]) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              haptic.tap();
              setPestana(p);
            }}
            className={cn(
              '-mb-px inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
              pestana === p
                ? 'border-blue-600 font-semibold text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
            )}
          >
            <Icono className="h-4 w-4" /> {l}
          </button>
        ))}
      </nav>

      {sinLeer && !leyendo ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {puedeLeer ? 'Lee Google para empezar.' : 'TIC todavía no ha leído las cuentas de Google.'}
        </div>
      ) : sinLeer ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Leyendo las cuentas de Google…
        </p>
      ) : (
        <>
          {pestana === 'por-hacer' && <PorHacer estado={estado} puedeGestionar={puedeGestionar} ir={ir} irA={setPestana} />}
          {pestana === 'cuentas' && (
            <ListaCuentas
              estado={estado}
              puedeGestionar={puedeGestionar}
              vista={vista}
              setVista={setVista}
              seleccion={seleccion}
              setSeleccion={setSeleccion}
              recargar={recargar}
            />
          )}
          {pestana === 'grupos' && (
            <Grupos estado={estado} puedeGestionar={puedeGestionar} recargar={recargar} verPermisos={comprobarPermisos} />
          )}
          {pestana === 'unidades' && <Unidades key={JSON.stringify(estado.guardados)} estado={estado} puedeGestionar={puedeGestionar} recargar={recargar} />}
          {pestana === 'registro' && <Registro />}
        </>
      )}
    </div>
  );
}

function Permisos({ admin, comprobaciones, onCerrar }: { admin: string; comprobaciones: Comprobacion[]; onCerrar: () => void }) {
  const faltan = comprobaciones.filter((c) => !c.ok);
  return (
    <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Suplantando a <b>{admin}</b> (tiene que ser administrador del dominio; se cambia con <code>GOOGLE_ADMIN_BUZON</code>)
        </p>
        <button type="button" onClick={onCerrar} className="cursor-pointer text-xs text-zinc-500 underline">
          cerrar
        </button>
      </div>
      <ul className="space-y-1.5">
        {comprobaciones.map((c) => (
          <li key={c.clave} className="flex items-start gap-2">
            {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <span>
              <b>{c.nombre}</b> — {c.detalle}
            </span>
          </li>
        ))}
      </ul>
      {faltan.length > 0 ? (
        <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          <p className="font-semibold">Qué hacer (una vez):</p>
          <p className="mt-1">
            Consola de admin → Seguridad → Control de API → Delegación de todo el dominio → el Client ID de la cuenta de servicio (el
            mismo de <code>gmail.send</code>) → Editar, y añadir a lo que ya tiene, sin quitar nada:
          </p>
          <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[11px] dark:bg-zinc-900">{faltan.map((c) => c.scope).join(',\n')}</pre>
          <p className="mt-1">La API (Admin SDK API) ya está habilitada: la usa Calendarios.</p>
        </div>
      ) : (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">Todo listo.</p>
      )}
    </section>
  );
}
