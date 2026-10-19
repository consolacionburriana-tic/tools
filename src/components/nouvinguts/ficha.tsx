'use client';

// /gestion/nouvinguts/[id]: los pasos de un alumno nuevo, de arriba abajo en el orden del
// proceso. Cada paso se despliega con lo que se puede hacer desde aquí (sin ir a la pantalla
// del módulo dueño del dato) y sus notas. A la derecha, cuánto falta y el botón de cerrar.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ChevronDown, ChevronLeft, Loader2, Mail, MessageSquare, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { COLEGIO } from '@/lib/colegio';
import { CONFIGURACION } from '@/lib/configuracion';
import {
  correosSueltos,
  cursosOfrecidos,
  GRUPO_AVISO_LABEL,
  GRUPOS_AVISO,
  type GrupoAviso,
  etiquetaCurso,
  RESPONSABLE_LABEL,
  type AccionPaso,
  type ClavePaso,
  type EstadoMaterialNou,
  type ResultadoPaso,
} from '@/lib/nouvinguts';
import type { Candidato, FichaNouvingut, NotaVista } from '@/lib/nouvinguts-server';
import { ChipResponsable, COLOR_TEXTO, ESTILO_CAMPO, NodoPaso, pedir, pedirFicha, textoDias } from './comun';

export interface PuedeFicha {
  proteccion: boolean;
  participantes: boolean;
  materiales: boolean;
}

type Ctx = {
  ficha: FichaNouvingut;
  puede: PuedeFicha;
  ocupado: string | null;
  accion: (cuerpo: AccionPaso, ok?: string) => Promise<boolean>;
  setFicha: (f: FichaNouvingut) => void;
};

export function FichaNouvinguts({ inicial, puede }: { inicial: FichaNouvingut; puede: PuedeFicha }) {
  const router = useRouter();
  const [ficha, setFicha] = useState(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<ClavePaso>>(() => {
    const avisos = inicial.pasos.filter((p) => p.estado === 'aviso').map((p) => p.clave);
    const primero = inicial.resumen.siguiente?.clave;
    return new Set(primero ? [...avisos, primero] : avisos);
  });

  const url = `/api/nouvinguts/${ficha.id}`;

  async function accion(cuerpo: AccionPaso, ok?: string): Promise<boolean> {
    setOcupado(cuerpo.paso);
    try {
      const nueva = await pedirFicha(`${url}/paso`, 'POST', cuerpo);
      setFicha(nueva);
      haptic.success();
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
      return false;
    } finally {
      setOcupado(null);
    }
  }

  async function patch(cuerpo: unknown, ok?: string) {
    setOcupado('ficha');
    try {
      setFicha(await pedirFicha(url, 'PATCH', cuerpo));
      haptic.success();
      if (ok) toast.success(ok);
      router.refresh();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    } finally {
      setOcupado(null);
    }
  }

  const ctx: Ctx = { ficha, puede, ocupado, accion, setFicha };
  const notasDe = (paso: ClavePaso | null) => ficha.notasLista.filter((n) => n.paso === paso);
  const r = ficha.resumen;
  const grados = r.total ? Math.round((r.hechos / r.total) * 360) : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/gestion/nouvinguts"
        className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        <ChevronLeft className="h-4 w-4" /> Nouvinguts
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {ficha.nombre
              .split(' ')
              .slice(0, 2)
              .map((p) => p[0])
              .join('')}
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{ficha.nombre}</h1>
            <div className="flex flex-wrap gap-2 text-xs">
              <Chip>{ficha.clase}</Chip>
              <Chip>{ficha.origen === 'sync' ? 'Entró con la sincronización de Educamos' : 'Apuntado a mano'}</Chip>
              {ficha.estado === 'cerrado' ? (
                <Chip tono="verde">Ciclo cerrado</Chip>
              ) : (
                <Chip tono={ficha.atascado ? 'naranja' : undefined}>{textoDias(ficha.dias)} en nouvinguts</Chip>
              )}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white py-1.5 pr-1.5 pl-3 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha de matrícula</span>
          <input
            type="date"
            defaultValue={ficha.fechaMatricula}
            disabled={ocupado === 'ficha'}
            onChange={(e) => e.target.value && patch({ accion: 'datos', fechaMatricula: e.target.value })}
            className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {ficha.pasos.map((p, i) => (
            <PasoFila
              key={p.clave}
              paso={p}
              siguiente={ficha.pasos[i + 1]}
              abierto={abiertos.has(p.clave)}
              onToggle={() =>
                setAbiertos((prev) => {
                  const s = new Set(prev);
                  if (s.has(p.clave)) s.delete(p.clave);
                  else s.add(p.clave);
                  return s;
                })
              }
              notas={notasDe(p.clave)}
              ctx={ctx}
            />
          ))}
          <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-3 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Notas generales</p>
            <Notas paso={null} notas={notasDe(null)} ctx={ctx} />
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-4">
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(rgb(5 150 105) ${grados}deg, rgb(228 228 231 / 0.7) 0)` }}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white font-mono text-base font-medium dark:bg-zinc-900">
                  {r.hechos}/{r.total}
                </span>
              </span>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {r.listo ? 'Todo hecho' : `Faltan ${r.total - r.hechos} paso${r.total - r.hechos === 1 ? '' : 's'}`}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {RESPONSABLE_LABEL.secretaria}: {r.pendientes.secretaria || 'nada'} · {RESPONSABLE_LABEL.tic}: {r.pendientes.tic || 'nada'}
                </p>
                {r.avisos > 0 && (
                  <p className="font-medium text-orange-700 dark:text-orange-400">
                    {r.avisos} aviso{r.avisos === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
            {ficha.estado === 'cerrado' ? (
              <div className="space-y-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Cerrado {ficha.cerradoAt ? `el ${new Date(ficha.cerradoAt).toLocaleDateString('es-ES', { timeZone: CONFIGURACION.calendario.zonaHoraria })}` : ''}
                  {ficha.cerradoPor ? ` por ${ficha.cerradoPor}` : ''}.
                </p>
                <button
                  type="button"
                  disabled={ocupado === 'ficha'}
                  onClick={() => patch({ accion: 'reabrir' }, 'Vuelve a nouvinguts')}
                  className="h-11 w-full cursor-pointer rounded-xl border border-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Reabrir su ciclo
                </button>
              </div>
            ) : r.listo ? (
              <button
                type="button"
                disabled={ocupado === 'ficha'}
                onClick={() => patch({ accion: 'cerrar' }, `${ficha.nombre} sale de nouvinguts`)}
                className="h-11 w-full cursor-pointer rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Cerrar ciclo: sale de nouvinguts
              </button>
            ) : (
              <div className="space-y-2 text-center">
                <button
                  type="button"
                  disabled
                  className="h-11 w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  Cerrar ciclo de nouvingut
                </button>
                <p className="text-xs text-zinc-500">Se activa cuando no quede nada pendiente.</p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Le quedan pasos sin hacer. ¿Cerrar su ciclo igualmente?')) patch({ accion: 'cerrar' }, `${ficha.nombre} sale de nouvinguts`);
                  }}
                  className="cursor-pointer text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
                >
                  Cerrar aunque falte algo
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Datos</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Dato k="Clase" v={ficha.clase} />
              <Dato k="NIA" v={ficha.nia ?? '—'} />
              <Dato k="Tutor/a" v={ficha.tutor ?? '—'} />
              <Dato k="Matrícula" v={ficha.fechaMatricula.split('-').reverse().join('/')} />
            </dl>
            {ficha.eduStudentId && (
              <Link
                href={`/gestion/alumnado?alumno=${ficha.eduStudentId}`}
                className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                Ficha completa en Alumnado <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {ficha.notasLista.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Últimas notas</p>
              {[...ficha.notasLista]
                .reverse()
                .slice(0, 4)
                .map((n) => (
                  <div key={n.id} className="border-b border-zinc-100 pb-2.5 text-sm last:border-0 last:pb-0 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {n.paso ? ficha.pasos.find((p) => p.clave === n.paso)?.titulo ?? 'General' : 'General'}
                      </span>{' '}
                      · {n.autor} · {fechaHora(n.at)}
                    </p>
                    <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">{n.texto}</p>
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Un paso ─────────────────────────────────────────────────────────────────

function PasoFila({
  paso,
  siguiente,
  abierto,
  onToggle,
  notas,
  ctx,
}: {
  paso: ResultadoPaso;
  siguiente?: ResultadoPaso;
  abierto: boolean;
  onToggle: () => void;
  notas: NotaVista[];
  ctx: Ctx;
}) {
  const verde = paso.estado === 'hecho' && siguiente?.estado === 'hecho';
  const ultima = notas[notas.length - 1];
  return (
    <div className="flex gap-3">
      <div className="relative flex w-7 shrink-0 justify-center">
        {siguiente && (
          <span className={cn('absolute top-11 -bottom-1 left-1/2 w-0.5 -translate-x-1/2', verde ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-700')} />
        )}
        <span className="relative mt-4">
          <NodoPaso estado={paso.estado} grande />
        </span>
      </div>
      <div
        className={cn(
          'mb-2.5 min-w-0 flex-1 overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900',
          paso.estado === 'aviso' ? 'border-orange-200 dark:border-orange-500/30' : 'border-zinc-200 dark:border-zinc-800',
          paso.estado === 'no_aplica' && 'opacity-70',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={abierto}
          className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 text-left"
        >
          <span className="min-w-0 flex-[1_1_16rem]">
            <span className="block text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{paso.titulo}</span>
            <span className={cn('block text-sm break-words', COLOR_TEXTO[paso.estado])}>{paso.texto}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <ChipResponsable responsable={paso.responsable} />
            <span className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">{paso.fuente}</span>
            {notas.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                <MessageSquare className="h-3 w-3" /> {notas.length}
              </span>
            )}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', abierto && 'rotate-180')} />
        </button>
        {!abierto && ultima && (
          <p className="truncate px-4 pb-3 text-xs text-zinc-600 dark:text-zinc-400">
            «{ultima.texto}» <span className="text-zinc-400">· {ultima.autor}, {fechaHora(ultima.at)}</span>
          </p>
        )}
        {abierto && (
          <div className="space-y-4 border-t border-zinc-100 px-4 pt-3.5 pb-4 dark:border-zinc-800">
            <AccionDelPaso paso={paso} ctx={ctx} />
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Notas de este paso</p>
              <Notas paso={paso.clave} notas={notas} ctx={ctx} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AccionDelPaso({ paso, ctx }: { paso: ResultadoPaso; ctx: Ctx }) {
  const { ficha, puede, ocupado, accion } = ctx;
  const d = ficha.datos;
  const enCurso = ocupado === paso.clave;
  if (paso.estado === 'no_aplica') return <p className="text-sm text-zinc-500">{paso.texto}. Este paso no cuenta para él.</p>;

  switch (paso.clave) {
    case 'educamos':
      return d.vinculado ? (
        <Enlace href={`/gestion/alumnado?alumno=${ficha.eduStudentId}`}>Ver su ficha en Alumnado</Enlace>
      ) : (
        <EsperandoEducamos ctx={ctx} />
      );

    case 'matricula':
      if (!d.vinculado) return <Espera />;
      return paso.estado === 'hecho' ? null : <CampoYBoton placeholder="Ej. 2026/0412" boton="Guardar y resolver" mono ocupado={enCurso} onGuardar={(v) => accion({ paso: 'matricula', numero: v }, 'Número de matrícula guardado en su ficha')} ayuda="Se guarda en su ficha central. Que no se olvide meterlo también en Educamos." />;

    case 'claves':
    case 'foto':
    case 'vinculo_correo':
    case 'ipad': {
      const clave = paso.clave;
      return (
        <div className="flex flex-wrap items-center gap-2">
          {paso.estado === 'hecho' ? (
            <Boton variante="secundario" ocupado={enCurso} onClick={() => accion({ paso: clave, hecho: false })}>
              Deshacer
            </Boton>
          ) : (
            <Boton variante="verde" ocupado={enCurso} onClick={() => accion({ paso: clave, hecho: true })}>
              Marcar hecho
            </Boton>
          )}
          {clave === 'ipad' && <Pronto>Asignar iPad · llega con el módulo de iPads</Pronto>}
        </div>
      );
    }

    case 'proteccion':
      if (!d.vinculado || !d.proteccion) return <Espera />;
      return <Proteccion key={d.proteccion.actualizadoAt ?? 'sin'} ctx={ctx} />;

    case 'banco':
    case 'ampa': {
      if (!d.vinculado) return <Espera />;
      const clave = paso.clave;
      const valor = clave === 'banco' ? d.bancoLibros : d.ampa;
      const decidido = paso.estado === 'hecho';
      if (!puede.participantes) return <p className="text-sm text-zinc-500">Esto lo deciden secretaría, dirección o TIC.</p>;
      return (
        <div className="space-y-2">
          {!decidido && <p className="text-sm text-zinc-600 dark:text-zinc-400">En su ficha pone ahora «{valor ? 'sí' : 'no'}», sin confirmar. ¿Qué ha dicho la familia?</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Segmento
              opciones={[
                ['si', clave === 'banco' ? 'Sí, entra en el banco' : 'Sí, es del AMPA'],
                ['no', clave === 'banco' ? 'No' : 'No'],
              ]}
              valor={decidido ? (valor ? 'si' : 'no') : null}
              ocupado={enCurso}
              onElegir={(v) => accion({ paso: clave, valor: v === 'si' })}
            />
            {decidido && (
              <Boton variante="enlace" ocupado={false} onClick={() => accion({ paso: clave, valor: null })}>
                Deshacer la decisión
              </Boton>
            )}
          </div>
        </div>
      );
    }

    case 'materiales':
      if (!d.vinculado) return <Espera />;
      if (!puede.materiales) return <p className="text-sm text-zinc-500">Los pagos los marcan secretaría, dirección o TIC.</p>;
      return (
        <div className="space-y-2">
          {d.materiales.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{m.nombre}</span>
              <Segmento
                opciones={OPCIONES_MATERIAL}
                valor={m.estado}
                ocupado={enCurso}
                onElegir={(v) => accion({ paso: 'materiales', materialId: m.id, estado: v === m.estado ? null : (v as EstadoMaterialNou) })}
              />
            </div>
          ))}
          <Enlace href={`/gestion/alumnado`}>Venta de materiales en Alumnado</Enlace>
        </div>
      );

    case 'correo':
      return (
        <div className="space-y-3">
          {d.vinculado && paso.estado !== 'hecho' && (
            <CampoYBoton
              tipo="email"
              placeholder="nombre.apellido@…"
              boton="Guardar en su ficha"
              ocupado={enCurso}
              onGuardar={(v) => accion({ paso: 'correo', email: v }, 'Correo guardado en su ficha')}
            />
          )}
          {!d.vinculado && <Espera />}
          <Pronto>Crear el correo desde aquí · llega con el módulo de correos</Pronto>
        </div>
      );

    case 'asm':
      if (!d.vinculado) return <Espera />;
      return paso.estado === 'hecho' ? null : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Ninguna subida a Apple School Manager le incluye todavía: prepara los CSV con él y súbelos.</p>
          <Enlace href="/gestion/autoasm" boton>
            Preparar en AUTOASM
          </Enlace>
        </div>
      );

    case 'licencias': {
      if (!d.vinculado) return <Espera />;
      const l = d.licencias;
      if (l.pedidoAt) return <Enlace href="/gestion/licencias">Ver en Licencias</Enlace>;
      const noPedira = paso.estado === 'hecho';
      return (
        <div className="space-y-2">
          {l.campania && (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
              Pedidos de su familia en «{l.campania}»: <strong className="text-zinc-900 dark:text-zinc-100">ninguno</strong>
              {!l.enCampania && '. Además no está en el alumnado de la campaña: falta pasar el sync de alumnado en Licencias.'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="secundario" ocupado={enCurso} onClick={() => accion({ paso: 'licencias', noPedira: !noPedira })}>
              {noPedira ? 'Deshacer «no pedirá licencias»' : 'No pedirá licencias'}
            </Boton>
            <Enlace href="/gestion/licencias">Ir a Licencias</Enlace>
          </div>
        </div>
      );
    }
  }
}

const OPCIONES_MATERIAL: [string, string][] = [
  ['pagado', 'Pagado'],
  ['no', 'No'],
  ['becado', 'Beca'],
  ['no_aplica', 'N/A'],
];

function Proteccion({ ctx }: { ctx: Ctx }) {
  const pd = ctx.ficha.datos.proteccion!;
  const [v, setV] = useState({ imagen: pd.imagen, redes: pd.redes, ampa: pd.ampa, ong: pd.ong });
  if (!ctx.puede.proteccion) {
    return <p className="text-sm text-zinc-500">La protección de datos la guardan secretaría, dirección o TIC.</p>;
  }
  const filas: [keyof typeof v, string][] = [
    ['imagen', 'Imagen y voz (fotos y vídeos del colegio)'],
    ['redes', 'Publicarlas en la web y redes del colegio'],
    ['ampa', 'Que el AMPA publique fotos suyas'],
    ['ong', 'Cesión a la ONG (MCM)'],
  ];
  return (
    <div className="space-y-3">
      {filas.map(([k, texto]) => (
        <div key={k} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-zinc-800 dark:text-zinc-200">{texto}</span>
          <Segmento
            opciones={[
              ['si', 'Sí'],
              ['no', 'No'],
            ]}
            valor={v[k] === true ? 'si' : v[k] === false ? 'no' : null}
            ocupado={false}
            onElegir={(x) => setV((prev) => ({ ...prev, [k]: x === 'si' }))}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Boton
          variante="primario"
          ocupado={ctx.ocupado === 'proteccion'}
          onClick={() => ctx.accion({ paso: 'proteccion', ...v }, 'Protección de datos guardada')}
        >
          {pd.actualizadoAt ? 'Guardar cambios' : 'Guardar: ya está decidida'}
        </Boton>
        <Enlace href={`/gestion/alumnado?alumno=${ctx.ficha.eduStudentId}`}>Más detalle en Alumnado</Enlace>
      </div>
    </div>
  );
}

function EsperandoEducamos({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const { ficha, setFicha } = ctx;
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Candidato[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [nombre, setNombre] = useState(ficha.apuntado.nombre ?? '');
  const [apellidos, setApellidos] = useState(ficha.apuntado.apellidos ?? '');
  const [curso, setCurso] = useState(ficha.apuntado.curso ?? '');
  const cursos = useMemo(() => cursosOfrecidos(), []);
  const cambiado = nombre !== (ficha.apuntado.nombre ?? '') || apellidos !== (ficha.apuntado.apellidos ?? '') || curso !== (ficha.apuntado.curso ?? '');

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setBuscando(true);
    try {
      const r = await pedir<{ alumnos: Candidato[] }>(`/api/nouvinguts/${ficha.id}/vincular?q=${encodeURIComponent(q)}`);
      setResultados(r.alumnos);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido buscar');
    } finally {
      setBuscando(false);
    }
  }

  async function vincular(c: Candidato) {
    if (!window.confirm(`¿${ficha.nombre} es ${c.nombre} (${c.clase})?`)) return;
    setVinculando(c.id);
    try {
      const nueva = await pedirFicha(`/api/nouvinguts/${ficha.id}/vincular`, 'POST', { eduStudentId: c.id });
      haptic.success();
      toast.success('Vinculado con su ficha de Educamos');
      if (nueva.id !== ficha.id) router.replace(`/gestion/nouvinguts/${nueva.id}`);
      else setFicha(nueva);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido vincular');
    } finally {
      setVinculando(null);
    }
  }

  async function guardarDatos() {
    try {
      setFicha(await pedirFicha(`/api/nouvinguts/${ficha.id}`, 'PATCH', { accion: 'datos', nombre, apellidos, curso }));
      haptic.success();
      toast.success('Guardado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar');
    }
  }

  async function quitar() {
    if (!window.confirm(`¿Quitar a ${ficha.nombre} de nouvinguts? Es para lo apuntado por error; no se puede deshacer.`)) return;
    try {
      await pedir(`/api/nouvinguts/${ficha.id}`, { method: 'DELETE' });
      toast.success('Quitado');
      router.push('/gestion/nouvinguts');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se ha podido quitar');
    }
  }

  const lista = resultados ?? ficha.candidatos;
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Cuando aparezca en la sincronización de Educamos, se vincula solo por nombre y apellidos. Si el sistema no puede
        estar seguro, te deja elegir aquí.
      </p>
      {lista.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">{resultados ? 'Resultados' : 'Se le parecen'}</p>
          {lista.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c.nombre}</span>
                <span className="text-xs text-zinc-500">
                  {c.clase} · alta en la BBDD el {new Date(c.alta).toLocaleDateString('es-ES', { timeZone: CONFIGURACION.calendario.zonaHoraria })}
                </span>
              </span>
              <Boton variante="primario" ocupado={vinculando === c.id} onClick={() => vincular(c)}>
                Es este
              </Boton>
            </div>
          ))}
        </div>
      )}
      {resultados && resultados.length === 0 && <p className="text-sm text-zinc-500">Nadie con ese nombre en la BBDD central.</p>}
      <form onSubmit={buscar} className="flex gap-2">
        <input className={ESTILO_CAMPO} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el alumnado para vincular a mano" />
        <button type="submit" disabled={buscando || q.trim().length < 2} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 disabled:opacity-50 dark:border-zinc-700" aria-label="Buscar">
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </form>

      <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">Corregir lo apuntado</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input aria-label="Nombre" className={`${ESTILO_CAMPO} uppercase`} value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} />
          <input aria-label="Apellidos" className={`${ESTILO_CAMPO} uppercase`} value={apellidos} onChange={(e) => setApellidos(e.target.value.toUpperCase())} />
          <select aria-label="Curso" className={ESTILO_CAMPO} value={curso} onChange={(e) => setCurso(e.target.value)}>
            {cursos.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {etiquetaCurso(c.codigo)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Boton variante="primario" ocupado={false} desactivado={!cambiado} onClick={guardarDatos}>
            Guardar
          </Boton>
          <button type="button" onClick={quitar} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-red-700 hover:underline dark:text-red-400">
            <Trash2 className="h-4 w-4" /> Quitar: lo apunté por error
          </button>
        </div>
      </details>
    </div>
  );
}

// ─── Notas ───────────────────────────────────────────────────────────────────

function Notas({ paso, notas, ctx }: { paso: ClavePaso | null; notas: NotaVista[]; ctx: Ctx }) {
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  // «Mandar también por correo»: a grupos (por rol) y/o a correos sueltos del colegio.
  const [porCorreo, setPorCorreo] = useState(false);
  const [grupos, setGrupos] = useState<GrupoAviso[]>([]);
  const [otros, setOtros] = useState('');

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    let correo: { grupos: GrupoAviso[]; otros: string[] } | undefined;
    if (porCorreo) {
      const { validos, malos } = correosSueltos(otros, COLEGIO.dominio);
      if (malos.length) {
        haptic.warning();
        toast.error(`Solo correos del colegio (@${COLEGIO.dominio}): ${malos.join(', ')}`);
        return;
      }
      if (grupos.length + validos.length === 0) {
        haptic.warning();
        toast.error('Elige a quién mandarla');
        return;
      }
      correo = { grupos, otros: validos };
    }
    setGuardando(true);
    try {
      ctx.setFicha(await pedirFicha(`/api/nouvinguts/${ctx.ficha.id}/notas`, 'POST', { paso, texto, correo }));
      setTexto('');
      haptic.success();
      if (correo) {
        toast.success('Nota guardada y enviada por correo');
        setPorCorreo(false);
        setGrupos([]);
        setOtros('');
      }
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido guardar la nota');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2">
      {notas.map((n) => (
        <div key={n.id} className="rounded-lg border border-zinc-100 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{n.texto}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
            {n.autor} · {fechaHora(n.at)}
            {n.enviadaA && (
              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400">
                · <Mail className="h-3 w-3" /> enviada a {n.enviadaA}
              </span>
            )}
          </p>
        </div>
      ))}
      <form onSubmit={guardar} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            className={cn(ESTILO_CAMPO, 'flex-[1_1_14rem]')}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={paso ? 'Apunta algo de este paso…' : 'Algo que hay que saber de este alumno…'}
            aria-label="Nota"
          />
          <button
            type="button"
            aria-pressed={porCorreo}
            onClick={() => setPorCorreo((v) => !v)}
            title="Mandar también por correo"
            aria-label="Mandar también por correo"
            className={cn(
              'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border',
              porCorreo
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
            )}
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={guardando || !texto.trim()}
            className={cn(
              'inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium disabled:opacity-50',
              porCorreo
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900',
            )}
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} {porCorreo ? 'Guardar y mandar' : 'Guardar nota'}
          </button>
        </div>
        {porCorreo && (
          <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Mandar a</span>
              {GRUPOS_AVISO.map((g) => {
                const on = grupos.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGrupos((prev) => (on ? prev.filter((x) => x !== g) : [...prev, g]))}
                    className={cn(
                      'h-8 cursor-pointer rounded-full border px-3 text-sm',
                      on
                        ? 'border-blue-600 bg-blue-600 font-medium text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                    )}
                  >
                    {GRUPO_AVISO_LABEL[g]}
                  </button>
                );
              })}
            </div>
            <input
              className={cn(ESTILO_CAMPO, 'h-10 text-sm')}
              value={otros}
              onChange={(e) => setOtros(e.target.value)}
              placeholder={`y/o correos del colegio: nombre@${COLEGIO.dominio}`}
              aria-label="Otros correos"
            />
            <p className="text-xs text-zinc-500">Sale desde tu correo: si contestan, te llega a ti.</p>
          </div>
        )}
      </form>
    </div>
  );
}

// ─── Piezas pequeñas ─────────────────────────────────────────────────────────

function fechaHora(iso: string): string {
  // Con la zona del colegio: así el servidor (UTC) y el iPad pintan lo mismo y no hay desajuste al hidratar.
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: CONFIGURACION.calendario.zonaHoraria });
}

function Chip({ children, tono }: { children: React.ReactNode; tono?: 'naranja' | 'verde' }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 font-medium',
        tono === 'naranja'
          ? 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300'
          : tono === 'verde'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
      )}
    >
      {children}
    </span>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{v}</dd>
    </div>
  );
}

function Espera() {
  return <p className="text-sm text-zinc-500">Se podrá hacer en cuanto esté en Educamos.</p>;
}

function Pronto({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-10 items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40">
      {children} · pronto
    </span>
  );
}

function Enlace({ href, children, boton = false }: { href: string; children: React.ReactNode; boton?: boolean }) {
  return (
    <Link
      href={href}
      className={
        boton
          ? 'inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900'
          : 'inline-flex min-h-10 items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400'
      }
    >
      {children} <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function Boton({
  children,
  onClick,
  ocupado,
  desactivado = false,
  variante,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ocupado: boolean;
  desactivado?: boolean;
  variante: 'primario' | 'secundario' | 'verde' | 'enlace';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado || desactivado}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 text-sm font-medium disabled:cursor-default disabled:opacity-60',
        variante === 'primario' && 'h-10 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700',
        variante === 'verde' && 'h-10 rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700',
        variante === 'secundario' && 'h-10 rounded-xl border border-zinc-300 bg-white px-4 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200',
        variante === 'enlace' && 'h-10 px-1 text-zinc-500 underline underline-offset-2 hover:text-zinc-800',
      )}
    >
      {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function Segmento({
  opciones,
  valor,
  ocupado,
  onElegir,
}: {
  opciones: [string, string][];
  valor: string | null;
  ocupado: boolean;
  onElegir: (v: string) => void;
}) {
  return (
    <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800" role="group">
      {opciones.map(([v, etiqueta]) => (
        <button
          key={v}
          type="button"
          disabled={ocupado}
          aria-pressed={valor === v}
          onClick={() => onElegir(v)}
          className={cn(
            'h-9 cursor-pointer rounded-lg px-3 text-sm transition-colors disabled:opacity-60',
            valor === v ? 'bg-white font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400',
          )}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

function CampoYBoton({
  placeholder,
  boton,
  onGuardar,
  ocupado,
  ayuda,
  mono = false,
  tipo = 'text',
}: {
  placeholder: string;
  boton: string;
  onGuardar: (v: string) => Promise<boolean>;
  ocupado: boolean;
  ayuda?: string;
  mono?: boolean;
  tipo?: 'text' | 'email';
}) {
  const [v, setV] = useState('');
  return (
    <form
      className="space-y-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (v.trim() && (await onGuardar(v.trim()))) setV('');
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input type={tipo} className={cn(ESTILO_CAMPO, 'max-w-xs flex-[1_1_12rem]', mono && 'font-mono')} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
        <button type="submit" disabled={ocupado || !v.trim()} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} {boton}
        </button>
      </div>
      {ayuda && <p className="text-xs text-zinc-500">{ayuda}</p>}
    </form>
  );
}
