'use client';

// Los diálogos de Correos y grupos: crear correos (con las contraseñas, que se enseñan una vez),
// mover a una unidad, contraseña nueva y marcar una cuenta como «se queda».
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, KeyRound, Loader2, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  MARCA_AYUDA,
  MARCA_LABEL,
  motivoCorreoNoValido,
  TIPOS_MARCA,
  type FilaCuenta,
  type TipoMarca,
} from '@/lib/cuentas';
import type { ResultadoAccion, UnidadFila } from '@/lib/cuentas-server';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BOTON, BOTON_PRIMARIO, BotonCopiar, CAMPO, descargarCsv, enTandas, post, Progreso } from './comun';

const API = '/api/cuentas/admin';

// ─── Elegir unidad ───────────────────────────────────────────────────────────

export function SelectorUo({
  unidades,
  valor,
  onElegir,
  alto = 'max-h-64',
}: {
  unidades: UnidadFila[];
  valor: string | null;
  onElegir: (ruta: string) => void;
  alto?: string;
}) {
  const [q, setQ] = useState('');
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return unidades.filter((u) => !t || u.ruta.toLowerCase().includes(t));
  }, [unidades, q]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad" className={cn(CAMPO, 'pl-9')} />
      </div>
      <ul className={cn('overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700', alto)}>
        {visibles.map((u) => {
          const nivel = u.ruta === '/' ? 0 : u.ruta.split('/').filter(Boolean).length;
          return (
            <li key={u.ruta}>
              <button
                type="button"
                onClick={() => onElegir(u.ruta)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800',
                  valor === u.ruta && 'bg-blue-50 font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
                )}
                style={{ paddingLeft: `${0.75 + (q ? 0 : nivel) * 0.9}rem` }}
                title={u.ruta}
              >
                <span className="truncate">{q ? u.ruta : u.nombre}</span>
                {u.activas > 0 && <span className="shrink-0 font-mono text-[11px] text-zinc-400">{u.activas}</span>}
              </button>
            </li>
          );
        })}
        {visibles.length === 0 && <li className="px-3 py-4 text-center text-xs text-zinc-500">Ninguna unidad se llama así</li>}
      </ul>
    </div>
  );
}

// ─── Crear correos ───────────────────────────────────────────────────────────

interface Borrador {
  fila: FilaCuenta;
  incluir: boolean;
  email: string;
  nombre: string;
  apellidos: string;
  uo: string;
}

type ModoContrasena = 'aleatoria' | 'comun';

export function CrearCorreos({
  filas,
  unidades,
  dominio,
  uoPorDefecto,
  onCerrar,
  onHecho,
}: {
  filas: FilaCuenta[];
  unidades: UnidadFila[];
  dominio: string;
  /** Si una persona no tiene unidad calculada: la raíz del alumnado o del profesorado. */
  uoPorDefecto: { alumno: string; profe: string };
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [borradores, setBorradores] = useState<Borrador[]>(() =>
    filas.map((f) => ({
      fila: f,
      // Si se le parece una cuenta, casi seguro que ya la tiene: no se crea sin mirarlo.
      incluir: f.parecidas.length === 0,
      email: f.propuesta ?? '',
      nombre: f.paraGoogle?.nombre ?? '',
      apellidos: f.paraGoogle?.apellidos ?? '',
      uo: f.uoDestino ?? (f.tipo === 'profe' ? uoPorDefecto.profe : uoPorDefecto.alumno),
    })),
  );
  const [modo, setModo] = useState<ModoContrasena>('aleatoria');
  const [comun, setComun] = useState('');
  const [cambiarAlEntrar, setCambiarAlEntrar] = useState(() => filas.every((f) => f.tipo === 'profe'));
  const [eligiendoUo, setEligiendoUo] = useState<number | null>(null);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoAccion[] | null>(null);

  const elegidos = borradores.filter((b) => b.incluir);
  const errores = useMemo(() => {
    const vistos = new Map<string, number>();
    for (const b of elegidos) vistos.set(b.email.trim().toLowerCase(), (vistos.get(b.email.trim().toLowerCase()) ?? 0) + 1);
    return borradores.map((b) => {
      if (!b.incluir) return null;
      const email = b.email.trim().toLowerCase();
      return (
        motivoCorreoNoValido(email, dominio) ??
        ((vistos.get(email) ?? 0) > 1 ? 'Repetido' : null) ??
        (!b.nombre.trim() || !b.apellidos.trim() ? 'Falta nombre o apellidos' : null)
      );
    });
  }, [borradores, elegidos, dominio]);
  const hayErrores = errores.some(Boolean);
  const comunMal = modo === 'comun' && comun.length < 8;

  function cambiar(i: number, campo: Partial<Borrador>) {
    setBorradores((bs) => bs.map((b, j) => (j === i ? { ...b, ...campo } : b)));
  }

  async function crear() {
    const lista = borradores.filter((b) => b.incluir);
    setProgreso({ hechos: 0, total: lista.length });
    try {
      const r = await enTandas(
        lista,
        8,
        async (tanda) =>
          (
            await post<{ resultados: ResultadoAccion[] }>(`${API}/crear`, {
              cuentas: tanda.map((b) => ({
                tipo: b.fila.tipo,
                id: b.fila.personaId,
                email: b.email.trim().toLowerCase(),
                nombre: b.nombre.trim(),
                apellidos: b.apellidos.trim(),
                uo: b.uo,
              })),
              contrasena: modo === 'comun' ? { modo, valor: comun } : { modo },
              cambiarAlEntrar,
            })
          ).resultados,
        (hechos, total) => setProgreso({ hechos, total }),
      );
      setResultados(r);
      const ok = r.filter((x) => x.ok).length;
      if (ok === r.length) haptic.success();
      else haptic.warning();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se han podido crear');
    } finally {
      setProgreso(null);
    }
  }

  const nombrePorClave = new Map(filas.map((f) => [f.clave, f]));

  if (resultados) {
    const bien = resultados.filter((r) => r.ok);
    const tabla = bien.map((r) => {
      const f = nombrePorClave.get(r.clave);
      return [f?.nombre ?? '', f?.clase ?? (f?.tipo === 'profe' ? 'Profesorado' : ''), r.email ?? '', r.contrasena ?? ''];
    });
    return (
      <Dialog open onOpenChange={(o) => !o && onHecho()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {bien.length} correo{bien.length === 1 ? '' : 's'} creado{bien.length === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Las contraseñas no se guardan en ningún sitio: cópialas o descárgalas ahora. Si alguna se pierde, se pone otra desde
              la cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {resultados.map((r) => {
                  const f = nombrePorClave.get(r.clave);
                  return (
                    <tr key={r.clave}>
                      <td className="px-3 py-2">
                        {r.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{f?.nombre}</p>
                        <p className="text-xs text-zinc-500">{f?.clase ?? 'Profesorado'}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                      <td className="px-3 py-2 font-mono text-sm font-semibold">
                        {r.ok ? r.contrasena : <span className="font-sans text-xs font-normal text-red-600">{r.error}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {bien.length > 0 && (
              <>
                <BotonCopiar
                  texto={['Nombre\tClase\tCorreo\tContraseña', ...tabla.map((f) => f.join('\t'))].join('\n')}
                  etiqueta="Copiar para pegar en una hoja"
                />
                <button
                  type="button"
                  className={cn(BOTON, 'h-9')}
                  onClick={() =>
                    descargarCsv(`correos-nuevos-${new Date().toISOString().slice(0, 10)}.csv`, [
                      ['Nombre', 'Clase', 'Correo', 'Contraseña'],
                      ...tabla,
                    ])
                  }
                >
                  <Download className="h-4 w-4" /> Descargar CSV
                </button>
              </>
            )}
            <button type="button" className={BOTON_PRIMARIO} onClick={onHecho}>
              Hecho
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !progreso && onCerrar()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Crear correos</DialogTitle>
          <DialogDescription>
            Revisa el correo y la unidad de cada uno antes de crear. El correo sigue la norma del cole: nombre y primer apellido, y
            si ya existe, con el segundo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[48vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {borradores.map((b, i) => (
              <li key={b.fila.clave} className={cn('space-y-2 px-3 py-3', !b.incluir && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={b.incluir}
                    onChange={(e) => cambiar(i, { incluir: e.target.checked })}
                    className="h-4 w-4"
                    aria-label={`Crear el correo de ${b.fila.nombre}`}
                  />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{b.fila.nombre}</span>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {b.fila.clase ?? 'Profe'}
                  </span>
                  {errores[i] && <span className="text-xs font-medium text-red-600">{errores[i]}</span>}
                </div>
                {b.fila.parecidas.length > 0 && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Se parece a {b.fila.parecidas.map((p) => p.email).join(', ')}. Si es suya, vincúlala en vez de crear otra.
                  </p>
                )}
                {b.fila.avisos.map((a) => (
                  <p key={a} className="text-xs text-amber-700 dark:text-amber-300">
                    {a}
                  </p>
                ))}
                <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1.2fr_1fr]">
                  <input
                    value={b.email}
                    onChange={(e) => cambiar(i, { email: e.target.value })}
                    className={cn(CAMPO, 'font-mono text-[13px]', errores[i]?.match(/correo|@|Repetido|letras/) && 'border-red-400')}
                    aria-label="Correo"
                    disabled={!b.incluir}
                  />
                  <input value={b.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} className={CAMPO} aria-label="Nombre" disabled={!b.incluir} />
                  <input
                    value={b.apellidos}
                    onChange={(e) => cambiar(i, { apellidos: e.target.value })}
                    className={CAMPO}
                    aria-label="Apellidos"
                    disabled={!b.incluir}
                  />
                  <button
                    type="button"
                    disabled={!b.incluir}
                    onClick={() => setEligiendoUo(i)}
                    className={cn(CAMPO, 'cursor-pointer truncate text-left font-mono text-[12px]')}
                    title={b.uo}
                  >
                    {b.uo.split('/').filter(Boolean).at(-1) ?? '/'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50 sm:grid-cols-2">
          <fieldset className="space-y-1.5">
            <legend className="mb-1 flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
              <KeyRound className="h-4 w-4" /> Contraseña
            </legend>
            <label className="flex items-center gap-2">
              <input type="radio" checked={modo === 'aleatoria'} onChange={() => setModo('aleatoria')} />
              Una distinta para cada uno
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={modo === 'comun'} onChange={() => setModo('comun')} />
              La misma para todos
            </label>
            {modo === 'comun' && (
              <input
                value={comun}
                onChange={(e) => setComun(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={cn(CAMPO, 'font-mono')}
                autoComplete="off"
              />
            )}
          </fieldset>
          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={cambiarAlEntrar} onChange={(e) => setCambiarAlEntrar(e.target.checked)} className="mt-0.5" />
              <span>
                Que la cambien la primera vez que entren
                <span className="block text-xs text-zinc-500">Para el profesorado sí. A los peques se la gestiona el cole.</span>
              </span>
            </label>
            <p className="text-xs text-zinc-500">
              Al terminar salen las contraseñas para copiarlas o descargarlas. No se guardan en ningún sitio.
            </p>
          </div>
        </div>

        {progreso && <Progreso texto="Creando en Google…" hechos={progreso.hechos} total={progreso.total} />}

        <DialogFooter>
          <button type="button" className={BOTON} onClick={onCerrar} disabled={!!progreso}>
            Cancelar
          </button>
          <button
            type="button"
            className={BOTON_PRIMARIO}
            disabled={!!progreso || elegidos.length === 0 || hayErrores || comunMal}
            onClick={crear}
          >
            {progreso && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear {elegidos.length} correo{elegidos.length === 1 ? '' : 's'}
          </button>
        </DialogFooter>

        {eligiendoUo !== null && (
          <Dialog open onOpenChange={(o) => !o && setEligiendoUo(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Unidad de {borradores[eligiendoUo].fila.nombre}</DialogTitle>
              </DialogHeader>
              <SelectorUo
                unidades={unidades}
                valor={borradores[eligiendoUo].uo}
                onElegir={(ruta) => {
                  cambiar(eligiendoUo, { uo: ruta });
                  setEligiendoUo(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Mover a una unidad ──────────────────────────────────────────────────────

export function MoverA({
  filas,
  unidades,
  onCerrar,
  onHecho,
}: {
  filas: FilaCuenta[];
  unidades: UnidadFila[];
  onCerrar: () => void;
  onHecho: (r: ResultadoAccion[]) => void;
}) {
  const [destino, setDestino] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  async function mover() {
    if (!destino) return;
    setEnCurso(true);
    try {
      const r = await enTandas(
        filas.filter((f) => f.cuenta),
        40,
        async (t) => (await post<{ resultados: ResultadoAccion[] }>(`${API}/mover`, { cuentas: t.map((f) => ({ id: f.cuenta!.id, uo: destino })) })).resultados,
        () => {},
      );
      onHecho(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido mover');
    } finally {
      setEnCurso(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !enCurso && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover {filas.length === 1 ? filas[0].cuenta?.email : `${filas.length} cuentas`}</DialogTitle>
          <DialogDescription>Elige la unidad organizativa de destino.</DialogDescription>
        </DialogHeader>
        <SelectorUo unidades={unidades} valor={destino} onElegir={setDestino} />
        <DialogFooter>
          <button type="button" className={BOTON} onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </button>
          <button type="button" className={BOTON_PRIMARIO} disabled={!destino || enCurso} onClick={mover}>
            {enCurso && <Loader2 className="h-4 w-4 animate-spin" />} Mover
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contraseña nueva ────────────────────────────────────────────────────────

export function ContrasenaNueva({ fila, onCerrar }: { fila: FilaCuenta; onCerrar: () => void }) {
  const [modo, setModo] = useState<ModoContrasena>('aleatoria');
  const [valor, setValor] = useState('');
  const [cambiarAlEntrar, setCambiarAlEntrar] = useState(fila.tipo === 'profe');
  const [enCurso, setEnCurso] = useState(false);
  const [nueva, setNueva] = useState<string | null>(null);
  async function poner() {
    setEnCurso(true);
    try {
      const r = await post<ResultadoAccion>(`${API}/contrasena`, {
        id: fila.cuenta!.id,
        contrasena: modo === 'comun' ? { modo, valor } : { modo },
        cambiarAlEntrar,
      });
      haptic.success();
      setNueva(r.contrasena ?? null);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido cambiar');
    } finally {
      setEnCurso(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !enCurso && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contraseña nueva</DialogTitle>
          <DialogDescription>
            {fila.nombre} · {fila.cuenta?.email}
          </DialogDescription>
        </DialogHeader>
        {nueva ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-zinc-50 p-4 text-center font-mono text-2xl font-semibold tracking-wide text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              {nueva}
            </p>
            <p className="text-xs text-zinc-500">No se guarda: apúntala o cópiala ahora.</p>
            <DialogFooter>
              <BotonCopiar texto={nueva} />
              <button type="button" className={BOTON_PRIMARIO} onClick={onCerrar}>
                Hecho
              </button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={modo === 'aleatoria'} onChange={() => setModo('aleatoria')} /> Una nueva al azar
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={modo === 'comun'} onChange={() => setModo('comun')} /> Escribirla yo
              </label>
              {modo === 'comun' && (
                <input value={valor} onChange={(e) => setValor(e.target.value)} className={cn(CAMPO, 'font-mono')} placeholder="Mínimo 8 caracteres" autoComplete="off" />
              )}
              <label className="flex items-center gap-2 pt-2">
                <input type="checkbox" checked={cambiarAlEntrar} onChange={(e) => setCambiarAlEntrar(e.target.checked)} /> Que la cambie al
                entrar
              </label>
            </div>
            <DialogFooter>
              <button type="button" className={BOTON} onClick={onCerrar} disabled={enCurso}>
                Cancelar
              </button>
              <button type="button" className={BOTON_PRIMARIO} disabled={enCurso || (modo === 'comun' && valor.length < 8)} onClick={poner}>
                {enCurso && <Loader2 className="h-4 w-4 animate-spin" />} Poner contraseña
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Marcar una cuenta que se queda ──────────────────────────────────────────

export function MarcarCuenta({ fila, onCerrar, onHecho }: { fila: FilaCuenta; onCerrar: () => void; onHecho: () => void }) {
  const [tipo, setTipo] = useState<TipoMarca>(fila.marca?.tipo ?? 'centro');
  const [nota, setNota] = useState(fila.marca?.nota ?? '');
  const [enCurso, setEnCurso] = useState(false);
  async function guardar(quitar: boolean) {
    setEnCurso(true);
    try {
      await post(`${API}/marcar`, { googleId: fila.cuenta!.id, tipo: quitar ? null : tipo, nota: quitar ? null : nota.trim() || null });
      haptic.success();
      toast.success(quitar ? 'Marca quitada' : 'Marcada: ya no sale como pendiente');
      onHecho();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido marcar');
    } finally {
      setEnCurso(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !enCurso && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fila.cuenta?.email}</DialogTitle>
          <DialogDescription>No sale en Educamos. Si se tiene que quedar, márcala y deja de salir como pendiente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {TIPOS_MARCA.map((t) => (
            <label key={t} className="flex items-start gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
              <input type="radio" checked={tipo === t} onChange={() => setTipo(t)} className="mt-0.5" />
              <span>
                <b>{MARCA_LABEL[t]}</b>
                <span className="block text-xs text-zinc-500">{MARCA_AYUDA[t]}</span>
              </span>
            </label>
          ))}
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional): de quién es, para qué…" className={CAMPO} maxLength={300} />
        </div>
        <DialogFooter>
          {fila.marca && (
            <button type="button" className={cn(BOTON, 'mr-auto')} onClick={() => guardar(true)} disabled={enCurso}>
              Quitar la marca
            </button>
          )}
          <button type="button" className={BOTON} onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </button>
          <button type="button" className={BOTON_PRIMARIO} onClick={() => guardar(false)} disabled={enCurso}>
            {enCurso && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
