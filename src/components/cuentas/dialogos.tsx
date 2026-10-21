'use client';

// Los diálogos de Correos y grupos: crear correos (con las contraseñas, que se enseñan una vez),
// mover a una unidad, contraseña nueva y marcar una cuenta como «se queda».
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, KeyRound, Loader2, RotateCcw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  MARCA_AYUDA,
  MARCA_LABEL,
  motivoCorreoNoValido,
  sugerenciaTildes,
  TIPOS_MARCA,
  usuariosDesdeNombre,
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
  /** Lo que va antes de la arroba: el dominio no se toca. */
  usuario: string;
  /** Se ha escrito el correo a mano: ya no se recalcula al cambiar el nombre. */
  usuarioAMano: boolean;
  nombre: string;
  apellidos: string;
  uo: string;
}

const antesDeLaArroba = (email: string | null | undefined) => (email ?? '').split('@')[0] ?? '';

type ModoContrasena = 'aleatoria' | 'comun';

export function CrearCorreos({
  filas,
  unidades,
  enGoogle,
  dominio,
  uoPorDefecto,
  onCerrar,
  onHecho,
}: {
  filas: FilaCuenta[];
  unidades: UnidadFila[];
  /** Correos y alias que ya existen en Google. */
  enGoogle: readonly string[];
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
      usuario: antesDeLaArroba(f.propuesta),
      usuarioAMano: false,
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

  const existentes = useMemo(() => new Set(enGoogle.map((e) => e.toLowerCase())), [enGoogle]);
  const correoDe = (b: Borrador) => `${b.usuario.trim().toLowerCase()}@${dominio}`;
  const elegidos = borradores.filter((b) => b.incluir);
  const errores = useMemo(() => {
    const vistos = new Map<string, number>();
    for (const b of elegidos) vistos.set(correoDe(b), (vistos.get(correoDe(b)) ?? 0) + 1);
    return borradores.map((b) => {
      if (!b.incluir) return null;
      const email = correoDe(b);
      if (!b.usuario.trim()) return { campo: 'correo' as const, texto: 'Falta el correo' };
      const correo =
        motivoCorreoNoValido(email, dominio) ??
        (existentes.has(email) ? 'Ese correo ya existe en Google' : null) ??
        ((vistos.get(email) ?? 0) > 1 ? 'Repetido en esta tanda' : null);
      if (correo) return { campo: 'correo' as const, texto: correo };
      if (!b.nombre.trim() || !b.apellidos.trim()) return { campo: 'nombre' as const, texto: 'Falta nombre o apellidos' };
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradores, elegidos, dominio, existentes]);
  const hayErrores = errores.some(Boolean);
  const comunMal = modo === 'comun' && comun.length < 8;

  function cambiar(i: number, campo: Partial<Borrador>) {
    setBorradores((bs) => bs.map((b, j) => (j === i ? { ...b, ...campo } : b)));
  }

  /**
   * Al corregir el nombre, el correo le sigue mientras no se haya escrito a mano, con la
   * misma norma que la propuesta: primer apellido, luego el segundo, y si no, un número.
   */
  function cambiarNombre(i: number, campo: { nombre?: string; apellidos?: string }) {
    setBorradores((bs) => {
      const otros = new Set(bs.filter((_, j) => j !== i && bs[j].incluir).map((x) => `${x.usuario}@${dominio}`));
      return bs.map((b, j) => {
        if (j !== i) return b;
        const nuevo = { ...b, ...campo };
        if (b.usuarioAMano) return nuevo;
        const candidatos = usuariosDesdeNombre(nuevo.nombre, nuevo.apellidos);
        if (candidatos.length === 0) return nuevo;
        const libre = (u: string) => !existentes.has(`${u}@${dominio}`) && !otros.has(`${u}@${dominio}`);
        let usuario = candidatos.find(libre);
        for (let n = 2; !usuario && n < 100; n++) if (libre(`${candidatos[0]}${n}`)) usuario = `${candidatos[0]}${n}`;
        return usuario ? { ...nuevo, usuario } : nuevo;
      });
    });
  }

  function volverAPropuesta(i: number) {
    const f = borradores[i].fila;
    cambiar(i, {
      usuario: antesDeLaArroba(f.propuesta),
      usuarioAMano: false,
      nombre: f.paraGoogle?.nombre ?? '',
      apellidos: f.paraGoogle?.apellidos ?? '',
    });
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
                email: correoDe(b),
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
            Todo se puede cambiar antes de crear: el correo, el nombre y los apellidos con los que sale en Google, y la unidad. El
            correo sigue la norma del cole (nombre y primer apellido; si ya existe, con el segundo) y, si corriges el nombre, se
            vuelve a proponer solo, mientras no lo hayas escrito a mano.
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
                  {errores[i] && <span className="text-xs font-medium text-red-600">{errores[i]!.texto}</span>}
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
                <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1.2fr_0.9fr]">
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-zinc-500">Correo</span>
                    <span
                      className={cn(
                        CAMPO,
                        'flex items-center gap-0 px-0 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20',
                        errores[i]?.campo === 'correo' && 'border-red-400',
                        !b.incluir && 'opacity-60',
                      )}
                    >
                      <input
                        value={b.usuario}
                        onChange={(e) => cambiar(i, { usuario: e.target.value.replace(/@.*$/, '').toLowerCase(), usuarioAMano: true })}
                        className="h-full min-w-0 flex-1 bg-transparent pl-3 font-mono text-[13px] outline-none"
                        aria-label={`Correo de ${b.fila.nombre}`}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={!b.incluir}
                      />
                      <span className="shrink-0 truncate pr-3 font-mono text-[12px] text-zinc-400">@{dominio}</span>
                    </span>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-zinc-500">Nombre en Google</span>
                    <input
                      value={b.nombre}
                      onChange={(e) => cambiarNombre(i, { nombre: e.target.value })}
                      className={cn(CAMPO, errores[i]?.campo === 'nombre' && !b.nombre.trim() && 'border-red-400')}
                      disabled={!b.incluir}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-zinc-500">Apellidos en Google</span>
                    <input
                      value={b.apellidos}
                      onChange={(e) => cambiarNombre(i, { apellidos: e.target.value })}
                      className={cn(CAMPO, errores[i]?.campo === 'nombre' && !b.apellidos.trim() && 'border-red-400')}
                      disabled={!b.incluir}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-0.5 block text-[11px] font-medium text-zinc-500">Unidad</span>
                    <button
                      type="button"
                      disabled={!b.incluir}
                      onClick={() => setEligiendoUo(i)}
                      className={cn(CAMPO, 'cursor-pointer truncate text-left font-mono text-[12px]')}
                      title={b.uo}
                    >
                      {b.uo.split('/').filter(Boolean).at(-1) ?? '/'}
                    </button>
                  </label>
                </div>
                {b.incluir && <AyudasFila b={b} dominio={dominio} existentes={existentes} onCambiar={(c) => cambiar(i, c)} onNombre={(c) => cambiarNombre(i, c)} onVolver={() => volverAPropuesta(i)} />}
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

/** Debajo de cada fila: otros correos libres, las tildes que faltan y volver a lo propuesto. */
function AyudasFila({
  b,
  dominio,
  existentes,
  onCambiar,
  onNombre,
  onVolver,
}: {
  b: Borrador;
  dominio: string;
  existentes: ReadonlySet<string>;
  onCambiar: (c: Partial<Borrador>) => void;
  onNombre: (c: { nombre: string; apellidos: string }) => void;
  onVolver: () => void;
}) {
  const actual = `${b.usuario}@${dominio}`;
  const otros = [b.fila.propuesta, ...b.fila.alternativas].filter(
    (e): e is string => !!e && e !== actual && !existentes.has(e),
  );
  const tildes = sugerenciaTildes({ nombre: b.nombre, apellidos: b.apellidos });
  const cambiado =
    b.usuario !== antesDeLaArroba(b.fila.propuesta) ||
    b.nombre !== (b.fila.paraGoogle?.nombre ?? '') ||
    b.apellidos !== (b.fila.paraGoogle?.apellidos ?? '');
  if (otros.length === 0 && !tildes && !cambiado) return null;
  const chip =
    'inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 px-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {otros.length > 0 && <span className="text-[11px] text-zinc-500">También libres:</span>}
      {otros.map((e) => (
        <button key={e} type="button" className={cn(chip, 'font-mono')} onClick={() => onCambiar({ usuario: antesDeLaArroba(e), usuarioAMano: true })}>
          {antesDeLaArroba(e)}
        </button>
      ))}
      {tildes && (
        <button
          type="button"
          className={cn(chip, 'border-blue-200 text-blue-800 dark:border-blue-500/30 dark:text-blue-200')}
          onClick={() => onNombre(tildes)}
          title="Educamos solo trae las tildes que escribió la familia"
        >
          ¿Con tildes? {tildes.nombre} {tildes.apellidos}
        </button>
      )}
      {cambiado && (
        <button type="button" className={chip} onClick={onVolver}>
          <RotateCcw className="h-3 w-3" /> Lo propuesto
        </button>
      )}
    </div>
  );
}
