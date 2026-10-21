'use client';

// Los diálogos de Correos y grupos: crear correos (con las contraseñas, que se enseñan una vez),
// mover a una unidad, contraseña nueva y marcar una cuenta como «se queda».
import { useMemo, useState } from 'react';
import { Check, CheckCircle2, Download, KeyRound, RotateCcw, Search, XCircle } from 'lucide-react';
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
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Etiqueta } from '@/components/ui/etiqueta';
import { claseCampo, Input } from '@/components/ui/input';
import { EnCurso } from '@/components/ui/progreso';
import { BotonCopiar, descargarCsv, enTandas, post } from './comun';

const API = '/api/cuentas/admin';

/** Una opción con su casilla o su botón redondo: toda la fila se toca (40 px como mínimo). */
function Opcion({
  tipo,
  marcada,
  onElegir,
  nombre,
  ayuda,
  className,
  children,
}: {
  tipo: 'radio' | 'checkbox';
  marcada: boolean;
  onElegir: (v: boolean) => void;
  nombre?: string;
  ayuda?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('flex min-h-10 cursor-pointer items-start gap-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300', className)}>
      <input
        type={tipo}
        name={nombre}
        checked={marcada}
        onChange={(e) => onElegir(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-blue-600"
      />
      <span>
        {children}
        {ayuda && <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{ayuda}</span>}
      </span>
    </label>
  );
}

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
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidad" aria-label="Buscar unidad" className="pl-9" />
      </div>
      <ul className={cn('overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700', alto)}>
        {visibles.map((u) => {
          const nivel = u.ruta === '/' ? 0 : u.ruta.split('/').filter(Boolean).length;
          const elegida = valor === u.ruta;
          return (
            <li key={u.ruta}>
              <button
                type="button"
                aria-pressed={elegida}
                onClick={() => onElegir(u.ruta)}
                className={cn(
                  'flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 pr-3 text-left text-sm text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:text-zinc-200 dark:hover:bg-zinc-800',
                  elegida && 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
                )}
                style={{ paddingLeft: `${0.75 + (q ? 0 : nivel) * 0.9}rem` }}
                title={u.ruta}
              >
                <span className="truncate">{q ? u.ruta : u.nombre}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {u.activas > 0 && <span className="font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{u.activas}</span>}
                  {elegida && <Check aria-hidden className="size-4" />}
                </span>
              </button>
            </li>
          );
        })}
        {visibles.length === 0 && <li className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Ninguna unidad se llama así</li>}
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

/** El rótulo pequeño de cada campo de una fila de «Crear correos». */
const ROTULO_CAMPO = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400';

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
          <div className="max-h-[55vh] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {resultados.map((r) => {
                  const f = nombrePorClave.get(r.clave);
                  return (
                    <tr key={r.clave}>
                      <td className="px-3 py-2">
                        {r.ok ? (
                          <CheckCircle2 aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle aria-hidden className="size-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className="sr-only">{r.ok ? 'Creado' : 'No se ha podido crear'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{f?.nombre}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{f?.clase ?? 'Profesorado'}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.email}</td>
                      <td className="px-3 py-2 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.ok ? r.contrasena : <span className="font-sans text-xs font-normal text-red-700 dark:text-red-400">{r.error}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            {bien.length > 0 && (
              <>
                <BotonCopiar
                  texto={['Nombre\tClase\tCorreo\tContraseña', ...tabla.map((f) => f.join('\t'))].join('\n')}
                  etiqueta="Copiar para pegar en una hoja"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    descargarCsv(`correos-nuevos-${new Date().toISOString().slice(0, 10)}.csv`, [
                      ['Nombre', 'Clase', 'Correo', 'Contraseña'],
                      ...tabla,
                    ])
                  }
                >
                  <Download /> Descargar CSV
                </Button>
              </>
            )}
            <Button onClick={onHecho}>Hecho</Button>
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
              <li key={b.fila.clave} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <label className="-my-1 -ml-2 flex size-10 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={b.incluir}
                      onChange={(e) => cambiar(i, { incluir: e.target.checked })}
                      className="size-4 accent-blue-600"
                      aria-label={`Crear el correo de ${b.fila.nombre}`}
                    />
                  </label>
                  <span className={cn('font-medium text-zinc-900 dark:text-zinc-100', !b.incluir && 'opacity-60')}>{b.fila.nombre}</span>
                  <Etiqueta>{b.fila.clase ?? 'Profe'}</Etiqueta>
                  {errores[i] && <span className="text-xs font-medium text-red-700 dark:text-red-400">{errores[i]!.texto}</span>}
                </div>
                {b.fila.parecidas.length > 0 && (
                  <Aviso tono="aviso" className="px-3 py-2">
                    Se parece a {b.fila.parecidas.map((p) => p.email).join(', ')}. Si es suya, vincúlala en vez de crear otra.
                  </Aviso>
                )}
                {b.fila.avisos.map((a) => (
                  <p key={a} className="text-xs text-amber-700 dark:text-amber-400">
                    {a}
                  </p>
                ))}
                <div className={cn('grid gap-2 sm:grid-cols-[1.5fr_1fr_1.2fr_0.9fr]', !b.incluir && 'opacity-60')}>
                  <label className="block min-w-0">
                    <span className={ROTULO_CAMPO}>Correo</span>
                    <span
                      className={cn(
                        claseCampo,
                        'flex items-center px-0 focus-within:border-blue-500 focus-within:ring-3 focus-within:ring-blue-500/20',
                        errores[i]?.campo === 'correo' && 'border-red-500 dark:border-red-500',
                      )}
                    >
                      <input
                        value={b.usuario}
                        onChange={(e) => cambiar(i, { usuario: e.target.value.replace(/@.*$/, '').toLowerCase(), usuarioAMano: true })}
                        className="h-full min-w-0 flex-1 bg-transparent pl-3 font-mono text-sm outline-none"
                        aria-label={`Correo de ${b.fila.nombre}`}
                        aria-invalid={errores[i]?.campo === 'correo' || undefined}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={!b.incluir}
                      />
                      <span className="shrink-0 truncate pr-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">@{dominio}</span>
                    </span>
                  </label>
                  <label className="block min-w-0">
                    <span className={ROTULO_CAMPO}>Nombre en Google</span>
                    <Input
                      value={b.nombre}
                      onChange={(e) => cambiarNombre(i, { nombre: e.target.value })}
                      aria-invalid={(errores[i]?.campo === 'nombre' && !b.nombre.trim()) || undefined}
                      disabled={!b.incluir}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={ROTULO_CAMPO}>Apellidos en Google</span>
                    <Input
                      value={b.apellidos}
                      onChange={(e) => cambiarNombre(i, { apellidos: e.target.value })}
                      aria-invalid={(errores[i]?.campo === 'nombre' && !b.apellidos.trim()) || undefined}
                      disabled={!b.incluir}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={ROTULO_CAMPO}>Unidad</span>
                    <button
                      type="button"
                      disabled={!b.incluir}
                      onClick={() => setEligiendoUo(i)}
                      className={cn(claseCampo, 'cursor-pointer truncate text-left font-mono text-sm sm:text-sm')}
                      title={b.uo}
                    >
                      {b.uo.split('/').filter(Boolean).at(-1) ?? '/'}
                    </button>
                  </label>
                </div>
                {b.incluir && (
                  <AyudasFila
                    b={b}
                    dominio={dominio}
                    existentes={existentes}
                    onCambiar={(c) => cambiar(i, c)}
                    onNombre={(c) => cambiarNombre(i, c)}
                    onVolver={() => volverAPropuesta(i)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 rounded-xl bg-zinc-50 px-3 py-2 sm:grid-cols-2 dark:bg-zinc-800/50">
          <fieldset>
            <legend className="flex items-center gap-1.5 pt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <KeyRound aria-hidden className="size-4" /> Contraseña
            </legend>
            <Opcion tipo="radio" nombre="contrasena-crear" marcada={modo === 'aleatoria'} onElegir={() => setModo('aleatoria')}>
              Una distinta para cada uno
            </Opcion>
            <Opcion tipo="radio" nombre="contrasena-crear" marcada={modo === 'comun'} onElegir={() => setModo('comun')}>
              La misma para todos
            </Opcion>
            {modo === 'comun' && (
              <Input
                value={comun}
                onChange={(e) => setComun(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                aria-label="La contraseña para todos"
                className="mb-2 font-mono"
                autoComplete="off"
              />
            )}
          </fieldset>
          <div>
            <Opcion
              tipo="checkbox"
              marcada={cambiarAlEntrar}
              onElegir={setCambiarAlEntrar}
              ayuda="Para el profesorado sí. A los peques se la gestiona el cole."
            >
              Que la cambien la primera vez que entren
            </Opcion>
            <p className="pb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Al terminar salen las contraseñas para copiarlas o descargarlas. No se guardan en ningún sitio.
            </p>
          </div>
        </div>

        {progreso && <EnCurso texto="Creando en Google…" hechos={progreso.hechos} total={progreso.total} />}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={!!progreso}>
            Cancelar
          </Button>
          <Button cargando={!!progreso} disabled={elegidos.length === 0 || hayErrores || comunMal} onClick={crear}>
            Crear {elegidos.length} correo{elegidos.length === 1 ? '' : 's'}
          </Button>
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
          <DialogTitle className="break-all">Mover {filas.length === 1 ? filas[0].cuenta?.email : `${filas.length} cuentas`}</DialogTitle>
          <DialogDescription>Elige la unidad organizativa de destino.</DialogDescription>
        </DialogHeader>
        <SelectorUo unidades={unidades} valor={destino} onElegir={setDestino} />
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </Button>
          <Button disabled={!destino} cargando={enCurso} onClick={mover}>
            {filas.length === 1 ? 'Mover aquí' : `Mover las ${filas.length} aquí`}
          </Button>
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
          <DialogDescription className="break-all">
            {fila.nombre} · {fila.cuenta?.email}
          </DialogDescription>
        </DialogHeader>
        {nueva ? (
          <>
            <p className="rounded-xl bg-zinc-50 p-4 text-center font-mono text-2xl font-semibold tracking-wide break-all text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
              {nueva}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No se guarda: apúntala o cópiala ahora.</p>
            <DialogFooter>
              <BotonCopiar texto={nueva} etiqueta="Copiar la contraseña" />
              <Button onClick={onCerrar}>Hecho</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <fieldset>
              <legend className="sr-only">Cómo es la contraseña</legend>
              <Opcion tipo="radio" nombre="contrasena-nueva" marcada={modo === 'aleatoria'} onElegir={() => setModo('aleatoria')}>
                Una nueva al azar
              </Opcion>
              <Opcion tipo="radio" nombre="contrasena-nueva" marcada={modo === 'comun'} onElegir={() => setModo('comun')}>
                Escribirla yo
              </Opcion>
              {modo === 'comun' && (
                <Input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="font-mono"
                  placeholder="Mínimo 8 caracteres"
                  aria-label="La contraseña"
                  autoComplete="off"
                />
              )}
              <Opcion tipo="checkbox" marcada={cambiarAlEntrar} onElegir={setCambiarAlEntrar} className="mt-1">
                Que la cambie al entrar
              </Opcion>
            </fieldset>
            <DialogFooter>
              <Button variant="outline" onClick={onCerrar} disabled={enCurso}>
                Cancelar
              </Button>
              <Button cargando={enCurso} disabled={modo === 'comun' && valor.length < 8} onClick={poner}>
                Poner contraseña
              </Button>
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
          <DialogTitle className="break-all">{fila.cuenta?.email}</DialogTitle>
          <DialogDescription>No sale en Educamos. Si se tiene que quedar, márcala y deja de salir como pendiente.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Por qué se queda</legend>
          {TIPOS_MARCA.map((t) => (
            <Opcion
              key={t}
              tipo="radio"
              nombre="marca"
              marcada={tipo === t}
              onElegir={() => setTipo(t)}
              ayuda={MARCA_AYUDA[t]}
              className="rounded-xl border border-zinc-200 px-3 dark:border-zinc-700"
            >
              <b className="font-semibold text-zinc-900 dark:text-zinc-100">{MARCA_LABEL[t]}</b>
            </Opcion>
          ))}
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional): de quién es, para qué…"
            aria-label="Nota"
            maxLength={300}
          />
        </fieldset>
        <DialogFooter>
          {fila.marca && (
            <Button variant="destructive" className="sm:mr-auto" onClick={() => guardar(true)} disabled={enCurso}>
              Quitar la marca
            </Button>
          )}
          <Button variant="outline" onClick={onCerrar} disabled={enCurso}>
            Cancelar
          </Button>
          <Button cargando={enCurso} onClick={() => guardar(false)}>
            Guardar
          </Button>
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {otros.length > 0 && <span className="text-xs text-zinc-500 dark:text-zinc-400">También libres:</span>}
      {otros.map((e) => (
        <Button key={e} variant="outline" size="sm" className="font-mono font-normal" onClick={() => onCambiar({ usuario: antesDeLaArroba(e), usuarioAMano: true })}>
          {antesDeLaArroba(e)}
        </Button>
      ))}
      {tildes && (
        <Button variant="outline" size="sm" onClick={() => onNombre(tildes)}>
          ¿Con tildes? {tildes.nombre} {tildes.apellidos}
        </Button>
      )}
      {cambiado && (
        <Button variant="ghost" size="sm" onClick={onVolver}>
          <RotateCcw /> Lo propuesto
        </Button>
      )}
    </div>
  );
}
