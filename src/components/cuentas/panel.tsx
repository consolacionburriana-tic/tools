'use client';

// /gestion/cuentas: Correos y grupos. Ficha: docs/30-cuentas.md
//
// La pantalla abre con la foto de Neon (rápido) y, si quien entra puede leer Google y la foto
// tiene más de unos minutos, la refresca sola por detrás.
import { useCallback, useEffect, useState } from 'react';
import { AtSign, ClipboardList, FolderTree, ListChecks, RefreshCw, ShieldCheck, Users, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import type { FilaCuenta } from '@/lib/cuentas';
import type { EstadoCuentas } from '@/lib/cuentas-server';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { EnCurso } from '@/components/ui/progreso';
import { Segmentado, type OpcionSegmentado } from '@/components/ui/segmentado';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { haceTiempo, pedir, post } from './comun';
import { Grupos } from './grupos';
import { ListaCuentas, type Filtro, type Quien, type VistaLista } from './lista';
import { PorHacer } from './por-hacer';
import { Registro } from './registro';
import { Unidades } from './unidades';

type Pestana = 'por-hacer' | 'cuentas' | 'grupos' | 'unidades' | 'registro';

const PESTANAS: OpcionSegmentado<Pestana>[] = [
  { valor: 'por-hacer', etiqueta: 'Por hacer', icono: <ListChecks /> },
  { valor: 'cuentas', etiqueta: 'Cuentas', icono: <Users /> },
  { valor: 'grupos', etiqueta: 'Grupos', icono: <UsersRound /> },
  { valor: 'unidades', etiqueta: 'Unidades', icono: <FolderTree /> },
  { valor: 'registro', etiqueta: 'Registro', icono: <ClipboardList /> },
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentado etiqueta="Qué ver" valor={pestana} onChange={setPestana} opciones={PESTANAS} />
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
            {leyendo ? 'Leyendo Google…' : estado.leidoAt ? `Google leído ${haceTiempo(estado.leidoAt)}` : 'Sin leer Google'}
          </span>
          {puedeGestionar && (
            <Button variant="ghost" size="sm" cargando={comprobando} onClick={comprobarPermisos}>
              {!comprobando && <ShieldCheck />} Permisos
            </Button>
          )}
          {puedeLeer && (
            <Button variant="outline" size="sm" cargando={leyendo} onClick={() => leerGoogle()}>
              {!leyendo && <RefreshCw />} Leer de Google
            </Button>
          )}
        </div>
      </div>

      {avisos.length > 0 && puedeGestionar && (
        <Aviso
          tono="aviso"
          accion={
            <Button variant="outline" size="sm" onClick={comprobarPermisos}>
              Ver qué falta
            </Button>
          }
        >
          {avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </Aviso>
      )}

      {permisos && <Permisos admin={permisos.admin} comprobaciones={permisos.comprobaciones} onCerrar={() => setPermisos(null)} />}

      {sinLeer && !leyendo ? (
        <Vacio icono={<AtSign />} titulo={puedeLeer ? 'Lee Google para empezar' : 'TIC todavía no ha leído las cuentas de Google'}>
          {puedeLeer
            ? '«Leer de Google» trae las cuentas, las unidades y los grupos del dominio para cruzarlos con Educamos.'
            : 'En cuanto lo haga, aquí salen las cuentas cruzadas con Educamos.'}
        </Vacio>
      ) : sinLeer ? (
        <EnCurso texto="Leyendo las cuentas de Google…" />
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
    <Tarjeta as="section" aria-labelledby="permisos-cuentas">
      <TarjetaCabecera
        id="permisos-cuentas"
        icono={<ShieldCheck />}
        titulo="Permisos de la cuenta de servicio"
        descripcion={
          <>
            Suplantando a <b className="font-semibold text-zinc-700 dark:text-zinc-200">{admin}</b> (tiene que ser administrador del
            dominio; se cambia con <code className="font-mono text-xs">GOOGLE_ADMIN_BUZON</code>).
          </>
        }
        accion={
          <Button variant="ghost" size="sm" onClick={onCerrar}>
            Cerrar
          </Button>
        }
      />
      <TarjetaCuerpo className="space-y-3 text-sm">
        <ul className="space-y-2">
          {comprobaciones.map((c) => (
            <li key={c.clave} className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <Estado tono={c.ok ? 'ok' : 'error'}>{c.ok ? 'Listo' : 'Falta'}</Estado>
              <span className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-300">
                <b className="font-semibold text-zinc-900 dark:text-zinc-100">{c.nombre}</b> · {c.detalle}
              </span>
            </li>
          ))}
        </ul>
        {faltan.length > 0 ? (
          <div className="space-y-1.5 rounded-xl bg-zinc-50 p-3 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">Qué hacer (una vez)</p>
            <p>
              Consola de admin → Seguridad → Control de API → Delegación de todo el dominio → el Client ID de la cuenta de servicio
              (el mismo de <code className="font-mono text-xs">gmail.send</code>) → Editar, y añadir a lo que ya tiene, sin quitar
              nada:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-white p-2 font-mono text-xs dark:bg-zinc-900">
              {faltan.map((c) => c.scope).join(',\n')}
            </pre>
            <p>La API (Admin SDK API) ya está habilitada: la usa Calendarios.</p>
          </div>
        ) : (
          <Aviso tono="ok">Todo listo.</Aviso>
        )}
      </TarjetaCuerpo>
    </Tarjeta>
  );
}
