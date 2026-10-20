'use client';

// «Unidades»: a qué unidad organizativa va cada clase, dónde se archivan las cuentas que se
// suspenden y cuánto se espera, y el árbol de unidades con sus cuentas. TIC lo cambia;
// secretaría lo ve.
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FolderPlus, Loader2, Save, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ETAPA_LABEL, ETAPAS, type Etapa } from '@/lib/cursos';
import { ENLACE_CONSOLA_UNIDADES, nombreUo, type AjustesCuentas } from '@/lib/cuentas';
import type { EstadoCuentas } from '@/lib/cuentas-server';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BOTON, BOTON_PRIMARIO, CAMPO, post, TARJETA } from './comun';
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
    <div className="space-y-5 pb-24">
      {!estado.unidadesDeGoogle && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Las unidades se están deduciendo de dónde están las cuentas, así que no salen las vacías (como una clase nueva que todavía
          no tiene a nadie). Con el permiso de unidades organizativas salen todas y se pueden crear desde aquí.
        </p>
      )}

      {/* ── Clase → unidad ───────────────────────────────────────────── */}
      <section className={cn(TARJETA, 'overflow-hidden')}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">A qué unidad va cada clase</h2>
            <p className="text-sm text-zinc-500">
              Con esto se sabe quién está fuera de su sitio. Las propuestas salen del nombre de las unidades; hasta que no se
              confirman, no se mueve a nadie.
            </p>
          </div>
          {puedeGestionar && propuestasSinAceptar.length > 0 && (
            <button
              type="button"
              className={BOTON}
              onClick={() => {
                haptic.tap();
                setBorrador((b) => ({
                  ...b,
                  clases: { ...b.clases, ...Object.fromEntries(propuestasSinAceptar.map((c) => [c.clave, c.uo!])) },
                }));
              }}
            >
              <Wand2 className="h-4 w-4" /> Aceptar las {propuestasSinAceptar.length} propuestas
            </button>
          )}
        </header>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2">Clase</th>
              <th className="px-4 py-2">Unidad</th>
              <th className="hidden px-4 py-2 text-right sm:table-cell">En su sitio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {clases.map((c) => {
              const confirmada = borrador.clases[c.clave] ?? null;
              const ruta = confirmada ?? (c.confirmada ? null : c.uo);
              return (
                <tr key={c.clave}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.nombre}</p>
                    <p className="text-xs text-zinc-500">
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
                            'max-w-full truncate rounded-lg border px-2.5 py-1 text-left font-mono text-xs',
                            confirmada
                              ? 'border-zinc-200 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200'
                              : 'border-dashed border-blue-300 text-blue-800 dark:border-blue-500/40 dark:text-blue-200',
                            puedeGestionar && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800',
                          )}
                          title={ruta}
                        >
                          {ruta}
                        </button>
                      ) : (
                        puedeGestionar && (
                          <button
                            type="button"
                            onClick={() => setEligiendo({ tipo: 'clase', clave: c.clave, nombre: c.nombre })}
                            className="cursor-pointer rounded-lg border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Elegir unidad
                          </button>
                        )
                      )}
                      {confirmada ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Confirmada" />
                      ) : ruta ? (
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">propuesta</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">sin unidad</span>
                      )}
                      {puedeGestionar && !ruta && estado.unidadesDeGoogle && (
                        <button
                          type="button"
                          className="cursor-pointer text-xs text-blue-700 underline dark:text-blue-300"
                          onClick={() => setCreando({ nombre: c.nombre, padre: estado.ajustes.raizAlumnos ?? '/', paraClase: c.clave })}
                        >
                          crear una
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-right font-mono text-xs text-zinc-600 sm:table-cell dark:text-zinc-300">
                    {c.confirmada && c.uo ? `${c.enSuSitio} / ${c.conCuenta}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ── Archivo, raíces y esperas ────────────────────────────────── */}
      <section className={cn(TARJETA, 'space-y-4 p-4')}>
        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Bajas y archivo</h2>
          <p className="text-sm text-zinc-500">Dónde van las cuentas que se suspenden y cuánto se espera desde que alguien se va.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoRuta
            titulo="Archivo del alumnado"
            ruta={valor('archivoAlumnos')}
            propuesta={esPropuesta('archivoAlumnos')}
            puede={puedeGestionar}
            onElegir={() => setEligiendo({ tipo: 'campo', campo: 'archivoAlumnos', titulo: 'Archivo del alumnado' })}
            onQuitar={() => setBorrador({ ...borrador, archivoAlumnos: null })}
          />
          <CampoRuta
            titulo="Archivo del profesorado"
            ruta={valor('archivoProfes')}
            propuesta={esPropuesta('archivoProfes')}
            vacio="Sin archivo: se suspenden sin moverlas"
            puede={puedeGestionar}
            onElegir={() => setEligiendo({ tipo: 'campo', campo: 'archivoProfes', titulo: 'Archivo del profesorado' })}
            onQuitar={() => setBorrador({ ...borrador, archivoProfes: null })}
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            disabled={!puedeGestionar}
            checked={borrador.archivoPorCurso}
            onChange={(e) => setBorrador({ ...borrador, archivoPorCurso: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            Una subunidad por curso dentro del archivo
            <span className="block text-xs text-zinc-500">
              «Promoción 2025-26» para los de 4º de ESO y «Bajas 2026-27» para el resto. Así, el día que se borren las de hace
              años, están juntas. Se crean solas.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Meses
            titulo="4º de ESO, al terminar"
            valor={borrador.graciaGraduados}
            puede={puedeGestionar}
            onCambiar={(n) => setBorrador({ ...borrador, graciaGraduados: n })}
          />
          <Meses titulo="Otras bajas del alumnado" valor={borrador.graciaBajas} puede={puedeGestionar} onCambiar={(n) => setBorrador({ ...borrador, graciaBajas: n })} />
          <Meses titulo="Bajas del profesorado" valor={borrador.graciaProfes} puede={puedeGestionar} onCambiar={(n) => setBorrador({ ...borrador, graciaProfes: n })} />
        </div>
      </section>

      <section className={cn(TARJETA, 'space-y-4 p-4')}>
        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Raíces y profesorado</h2>
          <p className="text-sm text-zinc-500">
            De qué unidad cuelga el alumnado y el profesorado (para saber de quién es una cuenta suelta) y dónde se crea la cuenta de
            un profe nuevo según su etapa.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoRuta
            titulo="Raíz del alumnado"
            ruta={valor('raizAlumnos')}
            propuesta={esPropuesta('raizAlumnos')}
            puede={puedeGestionar}
            onElegir={() => setEligiendo({ tipo: 'campo', campo: 'raizAlumnos', titulo: 'Raíz del alumnado' })}
            onQuitar={() => setBorrador({ ...borrador, raizAlumnos: null })}
          />
          <CampoRuta
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
        </div>
      </section>

      {/* ── El árbol ──────────────────────────────────────────────────── */}
      <Arbol estado={estado} puedeGestionar={puedeGestionar} onCrear={(padre) => setCreando({ nombre: '', padre, paraClase: null })} />

      {/* ── Guardar ───────────────────────────────────────────────────── */}
      {puedeGestionar && cambiado && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="container mx-auto flex max-w-7xl items-center justify-between gap-3 pr-14">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Hay cambios sin guardar.</p>
            <div className="flex gap-2">
              <button type="button" className={BOTON} onClick={() => setBorrador(estado.guardados)} disabled={guardando}>
                Descartar
              </button>
              <button type="button" className={BOTON_PRIMARIO} onClick={guardar} disabled={guardando}>
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

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
                <button
                  type="button"
                  className={BOTON}
                  onClick={() => {
                    ponerClase(eligiendo.clave, null);
                    setEligiendo(null);
                  }}
                >
                  Quitar la unidad de esta clase
                </button>
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
            <label className="text-sm text-zinc-700 dark:text-zinc-300">
              Nombre
              <input
                value={creando.nombre}
                onChange={(e) => setCreando({ ...creando, nombre: e.target.value })}
                className={cn(CAMPO, 'mt-1')}
                placeholder="5ºA"
                autoFocus
              />
            </label>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Dentro de</p>
            <SelectorUo unidades={estado.unidades} valor={creando.padre} onElegir={(padre) => setCreando({ ...creando, padre })} alto="max-h-48" />
            <DialogFooter>
              <button type="button" className={BOTON} onClick={() => setCreando(null)}>
                Cancelar
              </button>
              <button type="button" className={BOTON_PRIMARIO} disabled={!creando.nombre.trim()} onClick={crearUnidad}>
                <FolderPlus className="h-4 w-4" /> Crear {creando.nombre.trim() ? `«${creando.nombre.trim()}»` : ''}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CampoRuta({
  titulo,
  ruta,
  propuesta,
  vacio = 'Sin elegir',
  puede,
  onElegir,
  onQuitar,
}: {
  titulo: string;
  ruta: string | null;
  propuesta: boolean;
  vacio?: string;
  puede: boolean;
  onElegir: () => void;
  onQuitar: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{titulo}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!puede}
          onClick={onElegir}
          className={cn(
            'min-w-0 flex-1 truncate rounded-xl border px-3 py-2 text-left font-mono text-xs',
            propuesta ? 'border-dashed border-blue-300 text-blue-800 dark:border-blue-500/40 dark:text-blue-200' : 'border-zinc-200 dark:border-zinc-700',
            puede && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800',
          )}
          title={ruta ?? undefined}
        >
          {ruta ?? <span className="font-sans text-zinc-500">{vacio}</span>}
        </button>
        {propuesta && <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">propuesta</span>}
        {puede && ruta && !propuesta && (
          <button type="button" onClick={onQuitar} className="cursor-pointer text-xs text-zinc-500 underline">
            quitar
          </button>
        )}
      </div>
    </div>
  );
}

function Meses({ titulo, valor, puede, onCambiar }: { titulo: string; valor: number; puede: boolean; onCambiar: (n: number) => void }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="block text-xs font-semibold tracking-wide text-zinc-500 uppercase">{titulo}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={36}
          value={valor}
          disabled={!puede}
          onChange={(e) => onCambiar(Math.max(0, Math.min(36, Number(e.target.value) || 0)))}
          className={cn(CAMPO, 'w-20 text-center font-mono')}
        />
        <span className="text-zinc-600 dark:text-zinc-400">{valor === 1 ? 'mes' : 'meses'}</span>
      </span>
    </label>
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
    return (
      <li key={ruta}>
        <div className="flex items-center gap-2 py-1.5 pr-4 text-sm" style={{ paddingLeft: `${1 + nivel * 1.25}rem` }}>
          <button
            type="button"
            disabled={!tieneHijas}
            onClick={() => {
              const n = new Set(abiertas);
              if (abierta) n.delete(ruta);
              else n.add(ruta);
              setAbiertas(n);
            }}
            className={cn('w-4 text-zinc-400', tieneHijas && 'cursor-pointer')}
            aria-label={abierta ? 'Plegar' : 'Desplegar'}
          >
            {tieneHijas ? (abierta ? '▾' : '▸') : ''}
          </button>
          <span className={cn('min-w-0 flex-1 truncate', ruta === '/' ? 'font-semibold' : 'text-zinc-800 dark:text-zinc-200')}>
            {ruta === '/' ? estado.dominio : nombreUo(ruta)}
          </span>
          <span className="shrink-0 font-mono text-xs text-zinc-500" title="Activas · suspendidas (contando las de dentro)">
            {t.activas}
            {t.cuentas - t.activas > 0 && <span className="text-zinc-400"> · {t.cuentas - t.activas} susp.</span>}
          </span>
          {puedeGestionar && estado.unidadesDeGoogle && (
            <button
              type="button"
              onClick={() => onCrear(ruta)}
              title="Crear una unidad dentro"
              className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          )}
          {u && !u.deGoogle && ruta !== '/' && <span className="sr-only">deducida</span>}
        </div>
        {tieneHijas && abierta && <ul>{hijas.get(ruta)!.map((h) => nodo(h, nivel + 1))}</ul>}
      </li>
    );
  }

  return (
    <section className={cn(TARJETA, 'overflow-hidden')}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Las unidades</h2>
          <p className="text-sm text-zinc-500">Cuentas activas en cada una, contando las de dentro.</p>
        </div>
        <a href={ENLACE_CONSOLA_UNIDADES} target="_blank" rel="noreferrer" className={BOTON}>
          <ExternalLink className="h-4 w-4" /> Abrir en la consola
        </a>
      </header>
      <ul className="py-1">{nodo('/', 0)}</ul>
    </section>
  );
}
