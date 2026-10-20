'use client';

// «Grupos»: los grupos de Google del dominio. Uno «gestionado» tiene reglas (todo el claustro,
// los profes de Primaria, el alumnado de 3ESO A, una unidad…) y desde aquí se deja como dicen:
// primero se ve qué cambia, luego se aplica. Idea de asistente-grupos (pfelipm), con las
// personas sacadas de Educamos en vez de una hoja.
import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Minus, Plus, RefreshCw, Settings2, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ETAPA_LABEL, ETAPAS, type Etapa } from '@/lib/cursos';
import {
  describirFuente,
  enlaceConsolaGrupo,
  enlaceGrupo,
  MODO_GRUPO_AYUDA,
  MODO_GRUPO_LABEL,
  MODOS_GRUPO,
  motivoCorreoNoValido,
  REGLAS_VACIAS,
  type FuenteGrupo,
  type ReglasGrupo,
} from '@/lib/cuentas';
import type { EstadoCuentas, GrupoFila, PreviaGrupo } from '@/lib/cuentas-server';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BOTON, BOTON_PRIMARIO, BotonCopiar, CAMPO, ConfirmarPalabra, haceTiempo, post, Progreso, TARJETA } from './comun';
import { SelectorUo } from './dialogos';

const API = '/api/cuentas/admin/grupos';

export function Grupos({
  estado,
  puedeGestionar,
  recargar,
  verPermisos,
}: {
  estado: EstadoCuentas;
  puedeGestionar: boolean;
  recargar: () => Promise<void>;
  verPermisos: () => void;
}) {
  const [editando, setEditando] = useState<GrupoFila | 'nuevo' | null>(null);
  const [previas, setPrevias] = useState<Record<string, PreviaGrupo | { error: string }>>({});
  const [revisando, setRevisando] = useState<string | null>(null);
  const [viendo, setViendo] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const gestionados = estado.grupos.filter((g) => g.gestionado);
  const otros = estado.grupos.filter((g) => !g.gestionado && (!q || `${g.email} ${g.nombre ?? ''}`.toLowerCase().includes(q.toLowerCase())));

  async function revisar(email: string) {
    setRevisando(email);
    try {
      const p = await post<PreviaGrupo>(`${API}/previa`, { email });
      setPrevias((x) => ({ ...x, [email]: p }));
      return p;
    } catch (e) {
      setPrevias((x) => ({ ...x, [email]: { error: e instanceof Error ? e.message : 'No se ha podido revisar' } }));
      return null;
    } finally {
      setRevisando(null);
    }
  }

  async function revisarTodos() {
    for (const g of gestionados) await revisar(g.email);
  }

  if (estado.grupos.length === 0) {
    return (
      <div className={cn(TARJETA, 'space-y-3 p-6 text-center')}>
        <UsersRound className="mx-auto h-8 w-8 text-zinc-400" />
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Todavía no se han leído los grupos</p>
        <p className="mx-auto max-w-lg text-sm text-zinc-500">
          Hace falta que la cuenta de servicio tenga el permiso de grupos en la delegación del dominio. Cuando lo tenga, «Leer de
          Google» los trae todos.
        </p>
        {puedeGestionar && (
          <button type="button" className={BOTON} onClick={verPermisos}>
            Ver qué permisos faltan
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Un grupo gestionado se rellena con sus reglas a partir de Educamos. Cuando llega un profe nuevo o se va alguien, «Revisar»
          dice quién entra y quién sale, y «Aplicar» lo deja así. Propietarios y gestores no se tocan nunca.
        </p>
        {puedeGestionar && (
          <div className="flex flex-wrap gap-2">
            {gestionados.length > 0 && (
              <button type="button" className={BOTON} onClick={revisarTodos} disabled={revisando !== null}>
                {revisando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Revisar todos
              </button>
            )}
            <button type="button" className={BOTON_PRIMARIO} onClick={() => setEditando('nuevo')}>
              <Plus className="h-4 w-4" /> Grupo nuevo
            </button>
          </div>
        )}
      </div>

      {gestionados.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-2">
          {gestionados.map((g) => {
            const p = previas[g.email];
            return (
              <article key={g.email} className={cn(TARJETA, 'flex flex-col gap-3 p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{g.nombre ?? g.email}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">{g.email}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-zinc-600 dark:text-zinc-300">{g.miembros ?? '—'} miembros</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.fuentes.map((f) => (
                    <span key={f} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-500/15 dark:text-blue-200">
                      {f}
                    </span>
                  ))}
                  {g.reglas.extra.length > 0 && (
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      + {g.reglas.extra.length} a mano
                    </span>
                  )}
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {MODO_GRUPO_LABEL[g.reglas.modo]}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {!g.enGoogle
                    ? 'No ha salido en la última lectura de Google: ¿se ha borrado?'
                    : g.ultimaSyncAt
                      ? `Aplicado ${haceTiempo(g.ultimaSyncAt)} por ${g.ultimaSyncPor} (+${g.ultimaSync?.anadidos ?? 0} −${g.ultimaSync?.quitados ?? 0})`
                      : 'Todavía no se ha aplicado desde aquí'}
                </p>
                {p && 'error' in p && <p className="text-xs text-red-600">{p.error}</p>}
                {p && !('error' in p) && (
                  <p className="text-sm">
                    {p.plan.anadir.length + p.plan.quitar.length === 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400">Al día con sus reglas</span>
                    ) : (
                      <>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">+{p.plan.anadir.length} entran</span>
                        {' · '}
                        <span className="font-semibold text-red-700 dark:text-red-400">−{p.plan.quitar.length} salen</span>
                      </>
                    )}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {puedeGestionar && (
                    <button
                      type="button"
                      className={cn(BOTON_PRIMARIO, 'h-9')}
                      disabled={revisando !== null || !g.enGoogle}
                      onClick={async () => {
                        const r = await revisar(g.email);
                        if (r) setViendo(g.email);
                      }}
                    >
                      {revisando === g.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Revisar
                    </button>
                  )}
                  {p && !('error' in p) && p.plan.anadir.length + p.plan.quitar.length > 0 && (
                    <button type="button" className={cn(BOTON, 'h-9')} onClick={() => setViendo(g.email)}>
                      Ver cambios
                    </button>
                  )}
                  {puedeGestionar && (
                    <button type="button" className={cn(BOTON, 'h-9')} onClick={() => setEditando(g)}>
                      <Settings2 className="h-4 w-4" /> Reglas
                    </button>
                  )}
                  <EnlacesGrupo g={g} />
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className={cn(TARJETA, 'overflow-hidden')}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Los demás grupos del dominio</h2>
            <p className="text-sm text-zinc-500">Se ven, pero no se tocan hasta que se les ponen reglas.</p>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo" className={cn(CAMPO, 'max-w-60')} />
        </header>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {otros.map((g) => (
            <li key={g.email} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{g.nombre ?? g.email}</p>
                <p className="truncate font-mono text-xs text-zinc-500">{g.email}</p>
              </div>
              <span className="font-mono text-xs text-zinc-500">{g.miembros ?? '—'}</span>
              <EnlacesGrupo g={g} />
              {puedeGestionar && (
                <button type="button" className={cn(BOTON, 'h-9')} onClick={() => setEditando(g)}>
                  <Settings2 className="h-4 w-4" /> Ponerle reglas
                </button>
              )}
            </li>
          ))}
          {otros.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-500">Ninguno</li>}
        </ul>
      </section>

      {editando && (
        <EditorReglas
          grupo={editando === 'nuevo' ? null : editando}
          estado={estado}
          onCerrar={() => setEditando(null)}
          onHecho={async () => {
            setEditando(null);
            await recargar();
          }}
        />
      )}
      {viendo && previas[viendo] && !('error' in previas[viendo]) && (
        <VerCambios
          grupo={estado.grupos.find((g) => g.email === viendo)!}
          previa={previas[viendo] as PreviaGrupo}
          onCerrar={() => setViendo(null)}
          onAplicado={async () => {
            setViendo(null);
            await recargar();
            await revisar(viendo);
          }}
        />
      )}
    </div>
  );
}

function EnlacesGrupo({ g }: { g: GrupoFila }) {
  return (
    <>
      <BotonCopiar texto={g.email} etiqueta="Copiar" />
      <a href={enlaceGrupo(g.email)} target="_blank" rel="noreferrer" className={cn(BOTON, 'h-9')} title="Abrir en Google Groups">
        <ExternalLink className="h-4 w-4" /> Groups
      </a>
      {g.googleId && (
        <a href={enlaceConsolaGrupo(g.googleId)} target="_blank" rel="noreferrer" className={cn(BOTON, 'h-9')} title="Abrir en la consola">
          <ExternalLink className="h-4 w-4" /> Consola
        </a>
      )}
    </>
  );
}

// ─── Ver cambios y aplicar ───────────────────────────────────────────────────

function VerCambios({
  grupo,
  previa,
  onCerrar,
  onAplicado,
}: {
  grupo: GrupoFila;
  previa: PreviaGrupo;
  onCerrar: () => void;
  onAplicado: () => void;
}) {
  const { plan } = previa;
  const [aplicando, setAplicando] = useState<{ hechos: number; total: number } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const total = plan.anadir.length + plan.quitar.length;

  async function aplicar(confirmacion: string | null) {
    setConfirmar(false);
    setAplicando({ hechos: 0, total });
    let anadidos = 0;
    let quitados = 0;
    const errores: { email: string; error: string }[] = [];
    try {
      for (let vuelta = 0; vuelta < 20; vuelta++) {
        const r = await post<{ anadidos: number; quitados: number; errores: { email: string; error: string }[]; quedan: number }>(`${API}/aplicar`, {
          email: grupo.email,
          confirmacion,
        });
        anadidos += r.anadidos;
        quitados += r.quitados;
        errores.push(...r.errores);
        setAplicando({ hechos: Math.min(total, anadidos + quitados + errores.length), total });
        if (r.quedan === 0) break;
      }
      if (errores.length === 0) {
        haptic.success();
        toast.success(`${grupo.email}: +${anadidos} −${quitados}`);
      } else {
        haptic.warning();
        toast.warning(`${grupo.email}: +${anadidos} −${quitados} · ${errores.length} no se han podido`, {
          description: errores.slice(0, 3).map((e) => `${e.email}: ${e.error}`).join(' · '),
          duration: 10000,
        });
      }
      onAplicado();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'Se ha cortado');
    } finally {
      setAplicando(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !aplicando && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{grupo.nombre ?? grupo.email}</DialogTitle>
          <DialogDescription>
            Ahora tiene {previa.actuales} miembros directos; según sus reglas tendrían que ser {previa.deseados}
            {plan.gestores > 0 ? ` (más ${plan.gestores} propietario${plan.gestores === 1 ? '' : 's'} o gestor${plan.gestores === 1 ? '' : 'es'}, que no se tocan)` : ''}.
          </DialogDescription>
        </DialogHeader>
        {plan.avisos.map((a) => (
          <p key={a} className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {a}
          </p>
        ))}
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <ListaCambio
            titulo={`Entran (${plan.anadir.length})`}
            tono="verde"
            items={plan.anadir.map((m) => ({ clave: m.email, texto: m.nombre ?? m.email, sub: `${m.email} · ${m.motivo}` }))}
          />
          <ListaCambio
            titulo={`Salen (${plan.quitar.length})`}
            tono="rojo"
            items={plan.quitar.map((m) => ({ clave: m.email, texto: m.email, sub: m.motivo }))}
          />
        </div>
        {previa.sinCorreo.length > 0 && (
          <details className="text-sm text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer">{previa.sinCorreo.length} de las reglas no tienen cuenta activa (no entran)</summary>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {previa.sinCorreo.map((s) => (
                <li key={`${s.nombre}-${s.motivo}`}>
                  {s.nombre} · {s.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}
        {aplicando && <Progreso texto="Aplicando en Google…" hechos={aplicando.hechos} total={aplicando.total} />}
        <DialogFooter>
          <button type="button" className={BOTON} onClick={onCerrar} disabled={!!aplicando}>
            Cerrar
          </button>
          {total > 0 && (
            <button
              type="button"
              className={BOTON_PRIMARIO}
              disabled={!!aplicando}
              onClick={() => (plan.muchasBajas ? setConfirmar(true) : aplicar(null))}
            >
              {aplicando && <Loader2 className="h-4 w-4 animate-spin" />} Aplicar {total} cambio{total === 1 ? '' : 's'}
            </button>
          )}
        </DialogFooter>
        <ConfirmarPalabra
          abierto={confirmar}
          titulo={`Salen ${plan.quitar.length} del grupo`}
          descripcion="Son muchas bajas de golpe. Si las reglas están bien, adelante; si no, revísalas antes."
          palabra="QUITAR"
          boton="Aplicar"
          onCerrar={() => setConfirmar(false)}
          onConfirmar={() => aplicar('QUITAR')}
        />
      </DialogContent>
    </Dialog>
  );
}

function ListaCambio({
  titulo,
  tono,
  items,
}: {
  titulo: string;
  tono: 'verde' | 'rojo';
  items: { clave: string; texto: string; sub: string }[];
}) {
  const Icono = tono === 'verde' ? Plus : Minus;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <p
        className={cn(
          'border-b border-zinc-100 px-3 py-2 text-sm font-semibold dark:border-zinc-800',
          tono === 'verde' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
        )}
      >
        {titulo}
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-zinc-500">Nadie</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((i) => (
            <li key={i.clave} className="flex items-start gap-2 px-3 py-1.5">
              <Icono className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tono === 'verde' ? 'text-emerald-600' : 'text-red-600')} />
              <span className="min-w-0">
                <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{i.texto}</span>
                <span className="block truncate text-xs text-zinc-500">{i.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Reglas ──────────────────────────────────────────────────────────────────

type TipoNueva = FuenteGrupo['tipo'];
const TIPO_FUENTE_LABEL: Record<TipoNueva, string> = {
  profes: 'Profesorado',
  tutores: 'Tutores',
  alumnos: 'Alumnado',
  uo: 'Cuentas de una unidad',
};

function EditorReglas({
  grupo,
  estado,
  onCerrar,
  onHecho,
}: {
  grupo: GrupoFila | null;
  estado: EstadoCuentas;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [reglas, setReglas] = useState<ReglasGrupo>(grupo?.reglas ?? { ...REGLAS_VACIAS });
  // Abrir las reglas de un grupo es para gestionarlo: sale marcado (se desmarca para soltarlo).
  const [gestionado, setGestionado] = useState(true);
  const [nuevo, setNuevo] = useState({ email: '', nombre: '', descripcion: '' });
  const [extraTexto, setExtraTexto] = useState((grupo?.reglas.extra ?? []).join('\n'));
  const [excluidosTexto, setExcluidosTexto] = useState((grupo?.reglas.excluidos ?? []).join('\n'));
  const [tipo, setTipo] = useState<TipoNueva>('profes');
  const [etapa, setEtapa] = useState<Etapa | ''>('');
  const [curso, setCurso] = useState('');
  const [clase, setClase] = useState('');
  const [ruta, setRuta] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cursos = useMemo(() => [...new Set(estado.cruce.clases.map((c) => c.curso))], [estado.cruce.clases]);
  const lista = (t: string) =>
    t
      .split(/[\s,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  const malos = [...lista(extraTexto), ...lista(excluidosTexto)].filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const correoNuevoMal = grupo === null && nuevo.email ? motivoCorreoNoValido(nuevo.email, estado.dominio) : null;

  function anadirFuente() {
    let f: FuenteGrupo | null = null;
    const et = etapa || null;
    if (tipo === 'profes' || tipo === 'tutores') f = { tipo, etapa: et };
    else if (tipo === 'alumnos') f = { tipo, etapa: clase || curso ? null : et, curso: clase ? null : curso || null, clase: clase || null };
    else if (ruta) f = { tipo: 'uo', ruta };
    if (!f) return;
    const texto = describirFuente(f);
    if (reglas.fuentes.some((x) => describirFuente(x) === texto)) return;
    haptic.tap();
    setReglas({ ...reglas, fuentes: [...reglas.fuentes, f] });
  }

  async function guardar() {
    setGuardando(true);
    const final: ReglasGrupo = { ...reglas, extra: lista(extraTexto), excluidos: lista(excluidosTexto) };
    try {
      if (grupo) {
        await post(`${API}/reglas`, { email: grupo.email, gestionado, reglas: final }, 'PUT');
        toast.success(gestionado ? 'Reglas guardadas: «Revisar» dice qué cambia' : 'Deja de gestionarse desde aquí');
      } else {
        await post(API, { ...nuevo, email: nuevo.email.trim().toLowerCase(), reglas: final });
        toast.success('Grupo creado en Google: «Revisar» lo rellena');
      }
      haptic.success();
      onHecho();
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !guardando && onCerrar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{grupo ? (grupo.nombre ?? grupo.email) : 'Grupo nuevo'}</DialogTitle>
          <DialogDescription>
            {grupo ? grupo.email : 'Se crea en Google con estas reglas. Los ajustes de quién puede escribir son los del dominio.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {grupo === null && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                Correo del grupo
                <input
                  value={nuevo.email}
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                  placeholder={`claustro@${estado.dominio}`}
                  className={cn(CAMPO, 'mt-1 font-mono')}
                />
                {correoNuevoMal && <span className="text-xs text-red-600">{correoNuevoMal}</span>}
              </label>
              <label className="text-sm">
                Nombre
                <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={cn(CAMPO, 'mt-1')} />
              </label>
              <label className="text-sm sm:col-span-2">
                Descripción (opcional)
                <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} className={cn(CAMPO, 'mt-1')} />
              </label>
            </div>
          )}

          {grupo && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={gestionado} onChange={(e) => setGestionado(e.target.checked)} className="mt-0.5" />
              <span>
                Mantener este grupo desde aquí
                <span className="block text-xs text-zinc-500">Si lo quitas, se queda como está en Google y deja de revisarse.</span>
              </span>
            </label>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Quién está</p>
            {reglas.fuentes.length === 0 ? (
              <p className="text-xs text-zinc-500">Todavía nadie: añade una fuente.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {reglas.fuentes.map((f, i) => (
                  <li
                    key={describirFuente(f)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 py-1 pr-1 pl-2.5 text-sm text-blue-800 dark:bg-blue-500/15 dark:text-blue-200"
                  >
                    {describirFuente(f)}
                    <button
                      type="button"
                      onClick={() => setReglas({ ...reglas, fuentes: reglas.fuentes.filter((_, j) => j !== i) })}
                      className="cursor-pointer rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <label className="text-xs">
                Añadir
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoNueva)} className={cn(CAMPO, 'mt-1 w-44')}>
                  {(Object.keys(TIPO_FUENTE_LABEL) as TipoNueva[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_FUENTE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              {tipo !== 'uo' && (
                <label className="text-xs">
                  Etapa
                  <select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa | '')} className={cn(CAMPO, 'mt-1 w-36')}>
                    <option value="">Todas</option>
                    {ETAPAS.map((e) => (
                      <option key={e} value={e}>
                        {ETAPA_LABEL[e]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {tipo === 'alumnos' && (
                <>
                  <label className="text-xs">
                    Curso
                    <select value={curso} onChange={(e) => setCurso(e.target.value)} className={cn(CAMPO, 'mt-1 w-28')}>
                      <option value="">Todos</option>
                      {cursos.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    Clase
                    <select value={clase} onChange={(e) => setClase(e.target.value)} className={cn(CAMPO, 'mt-1 w-32')}>
                      <option value="">Todas</option>
                      {estado.cruce.clases.map((c) => (
                        <option key={c.clave} value={c.clave}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {tipo === 'uo' && (
                <div className="w-full">
                  <SelectorUo unidades={estado.unidades} valor={ruta} onElegir={setRuta} alto="max-h-40" />
                </div>
              )}
              <button type="button" className={cn(BOTON, 'h-10')} onClick={anadirFuente} disabled={tipo === 'uo' && !ruta}>
                <Plus className="h-4 w-4" /> Añadir
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Siempre están (uno por línea)
              <textarea
                value={extraTexto}
                onChange={(e) => setExtraTexto(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="externo@gmail.com"
              />
            </label>
            <label className="text-sm">
              Nunca están (uno por línea)
              <textarea
                value={excluidosTexto}
                onChange={(e) => setExcluidosTexto(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
          {malos.length > 0 && <p className="text-xs text-red-600">Revisa: {malos.join(', ')}</p>}

          <fieldset className="space-y-1.5 text-sm">
            <legend className="mb-1 font-semibold text-zinc-800 dark:text-zinc-200">Al aplicar</legend>
            {MODOS_GRUPO.map((m) => (
              <label key={m} className="flex items-start gap-2">
                <input type="radio" checked={reglas.modo === m} onChange={() => setReglas({ ...reglas, modo: m })} className="mt-0.5" />
                <span>
                  {MODO_GRUPO_LABEL[m]}
                  <span className="block text-xs text-zinc-500">{MODO_GRUPO_AYUDA[m]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <DialogFooter>
          <button type="button" className={BOTON} onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="button"
            className={BOTON_PRIMARIO}
            disabled={guardando || malos.length > 0 || (grupo === null && (!nuevo.email || !!correoNuevoMal || !nuevo.nombre.trim()))}
            onClick={guardar}
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} {grupo ? 'Guardar' : 'Crear el grupo'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
