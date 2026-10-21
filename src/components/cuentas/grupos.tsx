'use client';

// «Grupos»: los grupos de Google del dominio. Uno «gestionado» tiene reglas (todo el claustro,
// los profes de Primaria, el alumnado de 3ESO A, una unidad…) y desde aquí se deja como dicen:
// primero se ve qué cambia, luego se aplica. Idea de asistente-grupos (pfelipm), con las
// personas sacadas de Educamos en vez de una hoja.
import { useMemo, useState } from 'react';
import { ExternalLink, Minus, Plus, RefreshCw, Search, Settings2, UsersRound, X } from 'lucide-react';
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
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Copiable } from '@/components/ui/copiable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Input } from '@/components/ui/input';
import { EnCurso } from '@/components/ui/progreso';
import { Selector } from '@/components/ui/selector';
import { Tarjeta, TarjetaCabecera } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { Vacio } from '@/components/ui/vacio';
import { haceTiempo, post } from './comun';
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
      <Vacio
        icono={<UsersRound />}
        titulo="Todavía no se han leído los grupos"
        accion={
          puedeGestionar && (
            <Button size="sm" onClick={verPermisos}>
              Ver qué permisos faltan
            </Button>
          )
        }
      >
        Hace falta que la cuenta de servicio tenga el permiso de grupos en la delegación del dominio. Cuando lo tenga, «Leer de
        Google» los trae todos.
      </Vacio>
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
              <Button variant="outline" size="sm" cargando={revisando !== null} onClick={revisarTodos}>
                {revisando === null && <RefreshCw />} Revisar todos
              </Button>
            )}
            <Button size="sm" onClick={() => setEditando('nuevo')}>
              <Plus /> Grupo nuevo
            </Button>
          </div>
        )}
      </div>

      {gestionados.length > 0 && (
        <section aria-label="Grupos gestionados desde aquí" className="grid gap-3 lg:grid-cols-2">
          {gestionados.map((g) => {
            const p = previas[g.email];
            return (
              <Tarjeta as="article" key={g.email} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{g.nombre ?? g.email}</h2>
                    <Copiable valor={g.email} etiqueta="Correo del grupo" mono className="-ml-1.5 max-w-full text-xs text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <span className="shrink-0 text-sm text-zinc-600 tabular-nums dark:text-zinc-300">{g.miembros ?? '—'} miembros</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.fuentes.map((f) => (
                    <Etiqueta key={f}>{f}</Etiqueta>
                  ))}
                  {g.reglas.extra.length > 0 && <Etiqueta>+ {g.reglas.extra.length} a mano</Etiqueta>}
                  <Etiqueta>{MODO_GRUPO_LABEL[g.reglas.modo]}</Etiqueta>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {!g.enGoogle
                    ? 'No ha salido en la última lectura de Google: ¿se ha borrado?'
                    : g.ultimaSyncAt
                      ? `Aplicado ${haceTiempo(g.ultimaSyncAt)} por ${g.ultimaSyncPor} (+${g.ultimaSync?.anadidos ?? 0} −${g.ultimaSync?.quitados ?? 0})`
                      : 'Todavía no se ha aplicado desde aquí'}
                </p>
                {p && 'error' in p && <p className="text-sm text-red-700 dark:text-red-400">{p.error}</p>}
                {p && !('error' in p) && (
                  <p>
                    {p.plan.anadir.length + p.plan.quitar.length === 0 ? (
                      <Estado tono="ok">Al día con sus reglas</Estado>
                    ) : (
                      <Estado tono="aviso">
                        +{p.plan.anadir.length} entran · −{p.plan.quitar.length} salen
                      </Estado>
                    )}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  {puedeGestionar && (
                    <Button
                      size="sm"
                      cargando={revisando === g.email}
                      disabled={revisando !== null || !g.enGoogle}
                      onClick={async () => {
                        const r = await revisar(g.email);
                        if (r) setViendo(g.email);
                      }}
                    >
                      {revisando !== g.email && <RefreshCw />} Revisar
                    </Button>
                  )}
                  {p && !('error' in p) && p.plan.anadir.length + p.plan.quitar.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setViendo(g.email)}>
                      Ver cambios
                    </Button>
                  )}
                  {puedeGestionar && (
                    <Button variant="outline" size="sm" onClick={() => setEditando(g)}>
                      <Settings2 /> Reglas
                    </Button>
                  )}
                  <EnlacesGrupo g={g} />
                </div>
              </Tarjeta>
            );
          })}
        </section>
      )}

      <Tarjeta as="section" aria-labelledby="otros-grupos" className="overflow-hidden">
        <TarjetaCabecera
          id="otros-grupos"
          titulo="Los demás grupos del dominio"
          descripcion="Se ven, pero no se tocan hasta que se les ponen reglas."
          accion={
            <div className="relative w-full sm:w-60">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo" aria-label="Buscar grupo" className="pl-9" />
            </div>
          }
        />
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {otros.map((g) => (
            <li key={g.email} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{g.nombre ?? g.email}</p>
                <Copiable valor={g.email} etiqueta="Correo del grupo" mono className="-ml-1.5 max-w-full text-xs text-zinc-500 dark:text-zinc-400" />
              </div>
              <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{g.miembros ?? '—'} miembros</span>
              <div className="flex flex-wrap gap-2">
                <EnlacesGrupo g={g} />
                {puedeGestionar && (
                  <Button variant="outline" size="sm" onClick={() => setEditando(g)}>
                    <Settings2 /> Ponerle reglas
                  </Button>
                )}
              </div>
            </li>
          ))}
          {otros.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{q ? 'Ningún grupo se llama así' : 'Ninguno'}</li>
          )}
        </ul>
      </Tarjeta>

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
      <a
        href={enlaceGrupo(g.email)}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir en Google Groups"
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        <ExternalLink /> Groups
      </a>
      {g.googleId && (
        <a
          href={enlaceConsolaGrupo(g.googleId)}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir en la consola"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ExternalLink /> Consola
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
        {plan.avisos.length > 0 && (
          <Aviso tono="aviso">
            {plan.avisos.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </Aviso>
        )}
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-2">
          <ListaCambio
            titulo={`Entran (${plan.anadir.length})`}
            tono="entra"
            items={plan.anadir.map((m) => ({ clave: m.email, texto: m.nombre ?? m.email, sub: `${m.email} · ${m.motivo}` }))}
          />
          <ListaCambio
            titulo={`Salen (${plan.quitar.length})`}
            tono="sale"
            items={plan.quitar.map((m) => ({ clave: m.email, texto: m.email, sub: m.motivo }))}
          />
        </div>
        {previa.sinCorreo.length > 0 && (
          <details className="group rounded-xl border border-zinc-200 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              {previa.sinCorreo.length} de las reglas no tienen cuenta activa (no entran)
            </summary>
            <ul className="list-disc px-3 pb-3 pl-8 text-xs">
              {previa.sinCorreo.map((s) => (
                <li key={`${s.nombre}-${s.motivo}`}>
                  {s.nombre} · {s.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}
        {aplicando && <EnCurso texto="Aplicando en Google…" hechos={aplicando.hechos} total={aplicando.total} />}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={!!aplicando}>
            Cerrar
          </Button>
          {total > 0 && (
            <Button cargando={!!aplicando} onClick={() => (plan.muchasBajas ? setConfirmar(true) : aplicar(null))}>
              Aplicar {total} cambio{total === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
        <ConfirmarDialogo
          abierto={confirmar}
          titulo={`Salen ${plan.quitar.length} del grupo`}
          descripcion="Son muchas bajas de golpe. Si las reglas están bien, adelante; si no, revísalas antes."
          palabra="QUITAR"
          boton={`Aplicar ${total} cambio${total === 1 ? '' : 's'}`}
          onCerrar={() => setConfirmar(false)}
          onConfirmar={() => void aplicar('QUITAR')}
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
  tono: 'entra' | 'sale';
  items: { clave: string; texto: string; sub: string }[];
}) {
  // Entrar y salir de un grupo: el «+» en verde y el «−» en rojo, como en cualquier diferencia.
  const Icono = tono === 'entra' ? Plus : Minus;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <p className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
        <Icono aria-hidden className={cn('size-4', tono === 'entra' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} />
        {titulo}
      </p>
      {items.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Nadie</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((i) => (
            <li key={i.clave} className="flex items-start gap-2 px-3 py-1.5">
              <Icono aria-hidden className={cn('mt-0.5 size-3.5 shrink-0', tono === 'entra' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')} />
              <span className="min-w-0">
                <span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">{i.texto}</span>
                <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{i.sub}</span>
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
          <DialogDescription className="break-all">
            {grupo ? grupo.email : 'Se crea en Google con estas reglas. Los ajustes de quién puede escribir son los del dominio.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {grupo === null && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Correo del grupo" id="grupo-email" error={correoNuevoMal}>
                <Input
                  id="grupo-email"
                  value={nuevo.email}
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                  placeholder={`claustro@${estado.dominio}`}
                  aria-invalid={!!correoNuevoMal || undefined}
                  className="font-mono"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </Campo>
              <Campo etiqueta="Nombre" id="grupo-nombre">
                <Input id="grupo-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              </Campo>
              <Campo etiqueta="Descripción" id="grupo-descripcion" opcional className="sm:col-span-2">
                <Input
                  id="grupo-descripcion"
                  value={nuevo.descripcion}
                  onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
                />
              </Campo>
            </div>
          )}

          {grupo && (
            <label className="flex min-h-10 cursor-pointer items-start gap-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={gestionado}
                onChange={(e) => setGestionado(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-blue-600"
              />
              <span>
                Mantener este grupo desde aquí
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                  Si lo quitas, se queda como está en Google y deja de revisarse.
                </span>
              </span>
            </label>
          )}

          <section aria-labelledby="quien-esta" className="space-y-2">
            <h3 id="quien-esta" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Quién está
            </h3>
            {reglas.fuentes.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Todavía nadie: añade una fuente.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {reglas.fuentes.map((f, i) => (
                  <li
                    key={describirFuente(f)}
                    className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white pl-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    {describirFuente(f)}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-l-none text-zinc-500"
                      onClick={() => setReglas({ ...reglas, fuentes: reglas.fuentes.filter((_, j) => j !== i) })}
                      aria-label={`Quitar «${describirFuente(f)}»`}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <Campo etiqueta="Añadir" id="fuente-tipo" className="w-full sm:w-48">
                <Selector id="fuente-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoNueva)}>
                  {(Object.keys(TIPO_FUENTE_LABEL) as TipoNueva[]).map((t) => (
                    <option key={t} value={t}>
                      {TIPO_FUENTE_LABEL[t]}
                    </option>
                  ))}
                </Selector>
              </Campo>
              {tipo !== 'uo' && (
                <Campo etiqueta="Etapa" id="fuente-etapa" className="w-[calc(50%-0.25rem)] sm:w-40">
                  <Selector id="fuente-etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa | '')}>
                    <option value="">Todas</option>
                    {ETAPAS.map((e) => (
                      <option key={e} value={e}>
                        {ETAPA_LABEL[e]}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              )}
              {tipo === 'alumnos' && (
                <>
                  <Campo etiqueta="Curso" id="fuente-curso" className="w-[calc(50%-0.25rem)] sm:w-32">
                    <Selector id="fuente-curso" value={curso} onChange={(e) => setCurso(e.target.value)}>
                      <option value="">Todos</option>
                      {cursos.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Clase" id="fuente-clase" className="w-[calc(50%-0.25rem)] sm:w-36">
                    <Selector id="fuente-clase" value={clase} onChange={(e) => setClase(e.target.value)}>
                      <option value="">Todas</option>
                      {estado.cruce.clases.map((c) => (
                        <option key={c.clave} value={c.clave}>
                          {c.nombre}
                        </option>
                      ))}
                    </Selector>
                  </Campo>
                </>
              )}
              {tipo === 'uo' && (
                <div className="w-full">
                  <SelectorUo unidades={estado.unidades} valor={ruta} onElegir={setRuta} alto="max-h-40" />
                </div>
              )}
              <Button variant="outline" onClick={anadirFuente} disabled={tipo === 'uo' && !ruta}>
                <Plus /> Añadir
              </Button>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Siempre están (uno por línea)" id="grupo-extra">
              <Textarea
                id="grupo-extra"
                value={extraTexto}
                onChange={(e) => setExtraTexto(e.target.value)}
                className="font-mono text-sm sm:text-sm"
                placeholder="externo@gmail.com"
              />
            </Campo>
            <Campo etiqueta="Nunca están (uno por línea)" id="grupo-excluidos">
              <Textarea
                id="grupo-excluidos"
                value={excluidosTexto}
                onChange={(e) => setExcluidosTexto(e.target.value)}
                className="font-mono text-sm sm:text-sm"
              />
            </Campo>
          </div>
          {malos.length > 0 && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              Revisa: {malos.join(', ')}
            </p>
          )}

          <fieldset>
            <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Al aplicar</legend>
            {MODOS_GRUPO.map((m) => (
              <label key={m} className="flex min-h-10 cursor-pointer items-start gap-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="modo-grupo"
                  checked={reglas.modo === m}
                  onChange={() => setReglas({ ...reglas, modo: m })}
                  className="mt-0.5 size-4 shrink-0 accent-blue-600"
                />
                <span>
                  {MODO_GRUPO_LABEL[m]}
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{MODO_GRUPO_AYUDA[m]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            cargando={guardando}
            disabled={malos.length > 0 || (grupo === null && (!nuevo.email || !!correoNuevoMal || !nuevo.nombre.trim()))}
            onClick={guardar}
          >
            {grupo ? 'Guardar las reglas' : 'Crear el grupo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
