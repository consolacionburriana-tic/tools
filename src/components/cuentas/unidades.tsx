'use client';

// «Unidades»: a qué unidad organizativa va cada clase, dónde se archivan las cuentas que se
// suspenden y cuánto se espera, y el árbol de unidades con sus cuentas. TIC lo cambia;
// secretaría lo ve.
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, FolderPlus, Save, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ETAPA_LABEL, ETAPAS, type Etapa } from '@/lib/cursos';
import { ENLACE_CONSOLA_UNIDADES, nombreUo, type AjustesCuentas } from '@/lib/cuentas';
import type { EstadoCuentas } from '@/lib/cuentas-server';
import { Aviso } from '@/components/ui/aviso';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';
import { claseCampo, Input } from '@/components/ui/input';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { post } from './comun';
import { SelectorUo } from './dialogos';

const API = '/api/cuentas/admin';

type CampoUo = 'raizAlumnos' | 'raizProfes' | 'archivoAlumnos' | 'archivoProfes';

export function Unidades({
  estado,
  puedeGestionar,
  recargar,
}: {
  estado: EstadoCuentas;
  puedeGestionar: boolean;
  recargar: () => Promise<void>;
}) {
  const [borrador, setBorrador] = useState<AjustesCuentas>(estado.guardados);
  const [guardando, setGuardando] = useState(false);
  const [eligiendo, setEligiendo] = useState<
    { tipo: 'clase'; clave: string; nombre: string } | { tipo: 'campo'; campo: CampoUo; titulo: string } | { tipo: 'etapa'; etapa: Etapa } | null
  >(null);
  const [creando, setCreando] = useState<{ nombre: string; padre: string; paraClase: string | null } | null>(null);

  const cambiado = JSON.stringify(borrador) !== JSON.stringify(estado.guardados);
  const { clases } = estado.cruce;
  const propuestasSinAceptar = clases.filter((c) => !borrador.clases[c.clave] && !c.confirmada && c.uo);

  function ponerClase(clave: string, ruta: string | null) {
    setBorrador((b) => {
      const clasesNuevas = { ...b.clases };
      if (ruta) clasesNuevas[clave] = ruta;
      else delete clasesNuevas[clave];
      return { ...b, clases: clasesNuevas };
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      await post(`${API}/ajustes`, borrador, 'PUT');
      haptic.success();
      toast.success('Guardado');
      await recargar();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function crearUnidad() {
    if (!creando) return;
    try {
      const r = await post<{ ruta: string }>(`${API}/unidades`, { nombre: creando.nombre.trim(), padre: creando.padre });
      haptic.success();
      toast.success(`Creada ${r.ruta}`);
      if (creando.paraClase) ponerClase(creando.paraClase, r.ruta);
      setCreando(null);
      await recargar();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido crear');
    }
  }

  const valor = (campo: CampoUo) => borrador[campo] ?? estado.ajustes[campo];
  const esPropuesta = (campo: CampoUo) => !borrador[campo] && !!estado.ajustes[campo];

  return (
    <div className="space-y-5">
      {!estado.unidadesDeGoogle && (
        <Aviso tono="aviso">
          Las unidades se están deduciendo de dónde están las cuentas, así que no salen las vacías (como una clase nueva que todavía
          no tiene a nadie). Con el permiso de unidades organizativas salen todas y se pueden crear desde aquí.
        </Aviso>
      )}

      {/* ── Clase → unidad ───────────────────────────────────────────── */}
      <Tarjeta as="section" aria-labelledby="unidad-clase" className="overflow-hidden">
        <TarjetaCabecera
          id="unidad-clase"
          titulo="A qué unidad va cada clase"
          descripcion="Con esto se sabe quién está fuera de su sitio. Las propuestas salen del nombre de las unidades; hasta que no se confirman, no se mueve a nadie."
        />
        {/* El botón va aparte y no en la cabecera: así no estrecha la frase en el móvil. */}
        {puedeGestionar && propuestasSinAceptar.length > 0 && (
          <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                haptic.tap();
                setBorrador((b) => ({
                  ...b,
                  clases: { ...b.clases, ...Object.fromEntries(propuestasSinAceptar.map((c) => [c.clave, c.uo!])) },
                }));
              }}
            >
              <Wand2 /> {propuestasSinAceptar.length === 1 ? 'Aceptar la propuesta' : `Aceptar las ${propuestasSinAceptar.length} propuestas`}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50/70 text-left text-xs font-medium text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Clase</th>
                <th className="px-4 py-2 font-medium">Unidad</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">En su sitio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {clases.map((c) => {
                const confirmada = borrador.clases[c.clave] ?? null;
                const ruta = confirmada ?? (c.confirmada ? null : c.uo);
                return (
                  <tr key={c.clave}>
                    <td className="px-4 py-2.5 align-top">
                      <p className="font-medium whitespace-nowrap text-zinc-900 dark:text-zinc-100">{c.nombre}</p>
                      <p className="text-xs whitespace-nowrap text-zinc-500 tabular-nums dark:text-zinc-400">
                        {c.alumnos} alumnos · {c.conCuenta} con correo
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {ruta ? (
                          <button
                            type="button"
                            disabled={!puedeGestionar}
                            onClick={() => setEligiendo({ tipo: 'clase', clave: c.clave, nombre: c.nombre })}
                            className={cn(
                              'inline-flex min-h-10 max-w-full items-center truncate rounded-xl border px-3 text-left font-mono text-xs text-zinc-800 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-200',
                              confirmada ? 'border-zinc-200 dark:border-zinc-700' : 'border-dashed border-zinc-400 dark:border-zinc-500',
                              puedeGestionar && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800',
                            )}
                            title={ruta}
                          >
                            <span className="truncate">{ruta}</span>
                          </button>
                        ) : (
                          puedeGestionar && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-dashed"
                              onClick={() => setEligiendo({ tipo: 'clase', clave: c.clave, nombre: c.nombre })}
                            >
                              Elegir unidad
                            </Button>
                          )
                        )}
                        {confirmada ? (
                          <Estado tono="ok">Confirmada</Estado>
                        ) : ruta ? (
                          <Estado tono="info">Propuesta</Estado>
                        ) : (
                          <Estado tono="aviso">Sin unidad</Estado>
                        )}
                        {puedeGestionar && !ruta && estado.unidadesDeGoogle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCreando({ nombre: c.nombre, padre: estado.ajustes.raizAlumnos ?? '/', paraClase: c.clave })}
                          >
                            <FolderPlus /> Crear una
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-right font-mono text-xs text-zinc-600 tabular-nums sm:table-cell dark:text-zinc-300">
                      {c.confirmada && c.uo ? `${c.enSuSitio} / ${c.conCuenta}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* ── Archivo, raíces y esperas ────────────────────────────────── */}
      <Tarjeta as="section" aria-labelledby="unidad-archivo">
        <TarjetaCabecera
          id="unidad-archivo"
          titulo="Bajas y archivo"
          descripcion="Dónde van las cuentas que se suspenden y cuánto se espera desde que alguien se va."
        />
        <TarjetaCuerpo className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoRuta
              id="ruta-archivo-alumnos"
              titulo="Archivo del alumnado"
              ruta={valor('archivoAlumnos')}
              propuesta={esPropuesta('archivoAlumnos')}
              puede={puedeGestionar}
              onElegir={() => setEligiendo({ tipo: 'campo', campo: 'archivoAlumnos', titulo: 'Archivo del alumnado' })}
              onQuitar={() => setBorrador({ ...borrador, archivoAlumnos: null })}
            />
            <CampoRuta
              id="ruta-archivo-profes"
              titulo="Archivo del profesorado"
              ruta={valor('archivoProfes')}
              propuesta={esPropuesta('archivoProfes')}
              vacio="Sin archivo: se suspenden sin moverlas"
              puede={puedeGestionar}
              onElegir={() => setEligiendo({ tipo: 'campo', campo: 'archivoProfes', titulo: 'Archivo del profesorado' })}
              onQuitar={() => setBorrador({ ...borrador, archivoProfes: null })}
            />
          </div>
          <label className={cn('flex min-h-10 items-start gap-3 py-2 text-sm text-zinc-700 dark:text-zinc-300', puedeGestionar && 'cursor-pointer')}>
            <input
              type="checkbox"
              disabled={!puedeGestionar}
              checked={borrador.archivoPorCurso}
              onChange={(e) => setBorrador({ ...borrador, archivoPorCurso: e.target.checked })}
              className="mt-0.5 size-4 shrink-0 accent-blue-600"
            />
            <span>
              Una subunidad por curso dentro del archivo
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                «Promoción 2025-26» para los de 4º de ESO y «Bajas 2026-27» para el resto. Así, el día que se borren las de hace
                años, están juntas. Se crean solas.
              </span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Meses
              id="meses-graduados"
              titulo="4º de ESO, al terminar"
              valor={borrador.graciaGraduados}
              puede={puedeGestionar}
              onCambiar={(n) => setBorrador({ ...borrador, graciaGraduados: n })}
            />
            <Meses
              id="meses-bajas"
              titulo="Otras bajas del alumnado"
              valor={borrador.graciaBajas}
              puede={puedeGestionar}
              onCambiar={(n) => setBorrador({ ...borrador, graciaBajas: n })}
            />
            <Meses
              id="meses-profes"
              titulo="Bajas del profesorado"
              valor={borrador.graciaProfes}
              puede={puedeGestionar}
              onCambiar={(n) => setBorrador({ ...borrador, graciaProfes: n })}
            />
          </div>
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta as="section" aria-labelledby="unidad-raices">
        <TarjetaCabecera
          id="unidad-raices"
          titulo="Raíces y profesorado"
          descripcion="De qué unidad cuelga el alumnado y el profesorado (para saber de quién es una cuenta suelta) y dónde se crea la cuenta de un profe nuevo según su etapa."
        />
        <TarjetaCuerpo className="grid gap-3 sm:grid-cols-2">
          <CampoRuta
            id="ruta-raiz-alumnos"
            titulo="Raíz del alumnado"
            ruta={valor('raizAlumnos')}
            propuesta={esPropuesta('raizAlumnos')}
            puede={puedeGestionar}
            onElegir={() => setEligiendo({ tipo: 'campo', campo: 'raizAlumnos', titulo: 'Raíz del alumnado' })}
            onQuitar={() => setBorrador({ ...borrador, raizAlumnos: null })}
          />
          <CampoRuta
            id="ruta-raiz-profes"
            titulo="Raíz del profesorado"
            ruta={valor('raizProfes')}
            propuesta={esPropuesta('raizProfes')}
            puede={puedeGestionar}
            onElegir={() => setEligiendo({ tipo: 'campo', campo: 'raizProfes', titulo: 'Raíz del profesorado' })}
            onQuitar={() => setBorrador({ ...borrador, raizProfes: null })}
          />
          {ETAPAS.filter((e) => estado.ajustes.profes[e] || borrador.profes[e] || e !== 'BACH').map((e) => (
            <CampoRuta
              key={e}
              id={`ruta-profes-${e}`}
              titulo={`Profes nuevos de ${ETAPA_LABEL[e]}`}
              ruta={borrador.profes[e] ?? estado.ajustes.profes[e] ?? null}
              propuesta={!borrador.profes[e] && !!estado.ajustes.profes[e]}
              vacio="En la raíz del profesorado"
              puede={puedeGestionar}
              onElegir={() => setEligiendo({ tipo: 'etapa', etapa: e })}
              onQuitar={() => {
                const profes = { ...borrador.profes };
                delete profes[e];
                setBorrador({ ...borrador, profes });
              }}
            />
          ))}
        </TarjetaCuerpo>
      </Tarjeta>

      {/* ── El árbol ──────────────────────────────────────────────────── */}
      <Arbol estado={estado} puedeGestionar={puedeGestionar} onCrear={(padre) => setCreando({ nombre: '', padre, paraClase: null })} />

      {/* ── Guardar ───────────────────────────────────────────────────── */}
      <BarraAcciones visible={puedeGestionar && cambiado} resumen="Cambios sin guardar" ancho="ancho">
        <Button variant="ghost" onClick={() => setBorrador(estado.guardados)} disabled={guardando}>
          Descartar
        </Button>
        <Button cargando={guardando} onClick={guardar}>
          {!guardando && <Save />} Guardar
        </Button>
      </BarraAcciones>

      {eligiendo && (
        <Dialog open onOpenChange={(o) => !o && setEligiendo(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {eligiendo.tipo === 'clase'
                  ? `Unidad de ${eligiendo.nombre}`
                  : eligiendo.tipo === 'campo'
                    ? eligiendo.titulo
                    : `Profes nuevos de ${ETAPA_LABEL[eligiendo.etapa]}`}
              </DialogTitle>
            </DialogHeader>
            <SelectorUo
              unidades={estado.unidades}
              valor={
                eligiendo.tipo === 'clase'
                  ? (borrador.clases[eligiendo.clave] ?? null)
                  : eligiendo.tipo === 'campo'
                    ? valor(eligiendo.campo)
                    : (borrador.profes[eligiendo.etapa] ?? null)
              }
              onElegir={(ruta) => {
                if (eligiendo.tipo === 'clase') ponerClase(eligiendo.clave, ruta);
                else if (eligiendo.tipo === 'campo') setBorrador({ ...borrador, [eligiendo.campo]: ruta });
                else setBorrador({ ...borrador, profes: { ...borrador.profes, [eligiendo.etapa]: ruta } });
                setEligiendo(null);
              }}
            />
            {eligiendo.tipo === 'clase' && borrador.clases[eligiendo.clave] && (
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => {
                    ponerClase(eligiendo.clave, null);
                    setEligiendo(null);
                  }}
                >
                  Quitar la unidad de esta clase
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {creando && (
        <Dialog open onOpenChange={(o) => !o && setCreando(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear una unidad organizativa</DialogTitle>
              <DialogDescription>Se crea en Google ahora mismo, dentro de la que elijas.</DialogDescription>
            </DialogHeader>
            <Campo etiqueta="Nombre" id="unidad-nueva">
              <Input
                id="unidad-nueva"
                value={creando.nombre}
                onChange={(e) => setCreando({ ...creando, nombre: e.target.value })}
                placeholder="5ºA"
                autoFocus
              />
            </Campo>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Dentro de</p>
              <SelectorUo unidades={estado.unidades} valor={creando.padre} onElegir={(padre) => setCreando({ ...creando, padre })} alto="max-h-48" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreando(null)}>
                Cancelar
              </Button>
              <Button disabled={!creando.nombre.trim()} onClick={crearUnidad}>
                <FolderPlus /> Crear {creando.nombre.trim() ? `«${creando.nombre.trim()}»` : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CampoRuta({
  id,
  titulo,
  ruta,
  propuesta,
  vacio = 'Sin elegir',
  puede,
  onElegir,
  onQuitar,
}: {
  id: string;
  titulo: string;
  ruta: string | null;
  propuesta: boolean;
  vacio?: string;
  puede: boolean;
  onElegir: () => void;
  onQuitar: () => void;
}) {
  return (
    <Campo etiqueta={titulo} id={id}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          id={id}
          type="button"
          disabled={!puede}
          onClick={onElegir}
          className={cn(
            claseCampo,
            'min-w-0 flex-1 truncate text-left font-mono text-sm sm:text-sm disabled:opacity-100',
            propuesta && 'border-dashed',
            puede && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900',
          )}
          title={ruta ?? undefined}
        >
          {ruta ?? <span className="font-sans text-zinc-500 dark:text-zinc-400">{vacio}</span>}
        </button>
        {propuesta && <Estado tono="info">Propuesta</Estado>}
        {puede && ruta && !propuesta && (
          <Button variant="ghost" size="sm" onClick={onQuitar}>
            Quitar
          </Button>
        )}
      </div>
    </Campo>
  );
}

function Meses({
  id,
  titulo,
  valor,
  puede,
  onCambiar,
}: {
  id: string;
  titulo: string;
  valor: number;
  puede: boolean;
  onCambiar: (n: number) => void;
}) {
  return (
    <Campo etiqueta={titulo} id={id}>
      <span className="flex items-center gap-2 text-sm">
        <Input
          id={id}
          type="number"
          min={0}
          max={36}
          value={valor}
          disabled={!puede}
          onChange={(e) => onCambiar(Math.max(0, Math.min(36, Number(e.target.value) || 0)))}
          className="w-24 text-center tabular-nums"
        />
        <span className="text-zinc-600 dark:text-zinc-400">{valor === 1 ? 'mes' : 'meses'}</span>
      </span>
    </Campo>
  );
}

function Arbol({ estado, puedeGestionar, onCrear }: { estado: EstadoCuentas; puedeGestionar: boolean; onCrear: (padre: string) => void }) {
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(['/']));
  const hijas = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const u of estado.unidades) {
      if (u.ruta === '/') continue;
      const partes = u.ruta.split('/').filter(Boolean);
      const padre = partes.length === 1 ? '/' : `/${partes.slice(0, -1).join('/')}`;
      m.set(padre, [...(m.get(padre) ?? []), u.ruta]);
    }
    return m;
  }, [estado.unidades]);
  const porRuta = new Map(estado.unidades.map((u) => [u.ruta, u]));
  const total = (ruta: string): { cuentas: number; activas: number } => {
    const u = porRuta.get(ruta);
    const base = { cuentas: u?.cuentas ?? 0, activas: u?.activas ?? 0 };
    for (const h of hijas.get(ruta) ?? []) {
      const t = total(h);
      base.cuentas += t.cuentas;
      base.activas += t.activas;
    }
    return base;
  };

  function nodo(ruta: string, nivel: number): React.ReactNode {
    const u = porRuta.get(ruta);
    const t = total(ruta);
    const tieneHijas = (hijas.get(ruta)?.length ?? 0) > 0;
    const abierta = abiertas.has(ruta);
    const nombre = ruta === '/' ? estado.dominio : nombreUo(ruta);
    return (
      <li key={ruta}>
        <div className="flex min-h-10 items-center gap-1 pr-2 text-sm" style={{ paddingLeft: `${0.5 + nivel * 1.25}rem` }}>
          {tieneHijas ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-500"
              aria-label={`${abierta ? 'Plegar' : 'Desplegar'} ${nombre}`}
              onClick={() => {
                const n = new Set(abiertas);
                if (abierta) n.delete(ruta);
                else n.add(ruta);
                setAbiertas(n);
              }}
            >
              {abierta ? <ChevronDown /> : <ChevronRight />}
            </Button>
          ) : (
            <span aria-hidden className="size-10 shrink-0" />
          )}
          <span className={cn('min-w-0 flex-1 truncate', ruta === '/' ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-200')}>
            {nombre}
          </span>
          <span className="shrink-0 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {t.activas}
            {t.cuentas - t.activas > 0 && <span> · {t.cuentas - t.activas} susp.</span>}
          </span>
          {puedeGestionar && estado.unidadesDeGoogle && (
            <Button variant="ghost" size="icon-sm" className="text-zinc-500" onClick={() => onCrear(ruta)} aria-label={`Crear una unidad dentro de ${nombre}`}>
              <FolderPlus />
            </Button>
          )}
          {u && !u.deGoogle && ruta !== '/' && <span className="sr-only">deducida</span>}
        </div>
        {tieneHijas && abierta && <ul>{hijas.get(ruta)!.map((h) => nodo(h, nivel + 1))}</ul>}
      </li>
    );
  }

  return (
    <Tarjeta as="section" aria-labelledby="unidad-arbol" className="overflow-hidden">
      <TarjetaCabecera
        id="unidad-arbol"
        titulo="Las unidades"
        descripcion="Cuentas activas en cada una y las suspendidas («susp.»), contando las de dentro."
        accion={
          <a href={ENLACE_CONSOLA_UNIDADES} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ExternalLink /> Abrir en la consola
          </a>
        }
      />
      <ul className="py-1">{nodo('/', 0)}</ul>
    </Tarjeta>
  );
}
