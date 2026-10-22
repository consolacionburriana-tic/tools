'use client';

// /gestion/nouvinguts/[id]: los pasos de un alumno nuevo, de arriba abajo en el orden del
// proceso. Cada paso se despliega con lo que se puede hacer desde aquí (sin ir a la pantalla
// del módulo dueño del dato) y sus notas. A la derecha, cuánto falta y el botón de cerrar.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, ChevronDown, Loader2, Mail, MessageSquare, Search, Trash2, Undo2 } from 'lucide-react';
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
  PASOS_A_MANO,
  RESPONSABLE_LABEL,
  type AccionPaso,
  type ClavePaso,
  type EstadoMaterialNou,
  type ResultadoPaso,
} from '@/lib/nouvinguts';
import type { Candidato, FichaNouvingut, NotaVista } from '@/lib/nouvinguts-server';
import { ChipResponsable, COLOR_TEXTO, NodoPaso, pedir, pedirFicha, textoDias } from './comun';
import { SelectorRapido } from '@/components/dispositivos/selector-rapido';
import { Button, buttonVariants } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Rotulo } from '@/components/ui/rotulo';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { Tarjeta } from '@/components/ui/tarjeta';

export interface PuedeFicha {
  /** Crear su correo de Google en Correos y grupos (TIC). */
  correo: boolean;
  proteccion: boolean;
  participantes: boolean;
  materiales: boolean;
  /** Comedor y complementarias (secretaría, dirección y TIC). */
  servicios: boolean;
  /** Tiene Dispositivos 1:1: el paso «iPad» se resuelve aquí mismo. */
  dispositivos: boolean;
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
      <TituloPagina
        className="mb-0"
        antes={<EnlaceVolver href="/gestion/nouvinguts">Todos los nouvinguts</EnlaceVolver>}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <Etiqueta>{ficha.clase}</Etiqueta>
            {ficha.estado === 'cerrado' ? (
              <Estado tono="ok">Ciclo cerrado</Estado>
            ) : (
              <Estado tono={ficha.atascado ? 'aviso' : 'neutro'}>{textoDias(ficha.dias)} en nouvinguts</Estado>
            )}
            <span>{ficha.origen === 'sync' ? 'Entró con la sincronización de Educamos' : 'Apuntado a mano'}</span>
          </span>
        }
        acciones={
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            Fecha de matrícula
            <Input
              type="date"
              defaultValue={ficha.fechaMatricula}
              disabled={ocupado === 'ficha'}
              onChange={(e) => e.target.value && patch({ accion: 'datos', fechaMatricula: e.target.value })}
              className="w-auto"
            />
          </label>
        }
      >
        {ficha.nombre}
      </TituloPagina>

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
          <Tarjeta className="mt-2 space-y-3 p-4">
            <Rotulo>Notas generales</Rotulo>
            <Notas paso={null} notas={notasDe(null)} ctx={ctx} />
          </Tarjeta>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Tarjeta className="space-y-4 p-5">
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
                  <p className="font-medium text-amber-700 dark:text-amber-400">
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
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={ocupado === 'ficha'}
                  onClick={() => patch({ accion: 'reabrir' }, 'Vuelve a nouvinguts')}
                >
                  <Undo2 /> Reabrir su ciclo
                </Button>
              </div>
            ) : r.listo ? (
              <Button
                className="w-full"
                disabled={ocupado === 'ficha'}
                onClick={() => patch({ accion: 'cerrar' }, `${ficha.nombre} sale de nouvinguts`)}
              >
                {ocupado === 'ficha' ? <Loader2 className="animate-spin" /> : <Check />} Cerrar ciclo: sale de nouvinguts
              </Button>
            ) : (
              <div className="space-y-2">
                <Button variant="outline" className="w-full border-dashed" disabled>
                  Cerrar ciclo de nouvingut
                </Button>
                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">Se activa cuando no quede nada pendiente.</p>
                <ConfirmarEnLinea
                  etiqueta="Cerrar aunque falte algo"
                  pregunta="Le quedan pasos sin hacer. ¿Cerrar su ciclo igualmente?"
                  confirmar="Sí, cerrar"
                  variante="ghost"
                  peligro={false}
                  className="w-full"
                  onConfirmar={() => patch({ accion: 'cerrar' }, `${ficha.nombre} sale de nouvinguts`)}
                />
              </div>
            )}
          </Tarjeta>

          <Tarjeta className="space-y-3 p-5">
            <Rotulo>Datos</Rotulo>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Dato k="Clase" v={ficha.clase} />
              <Dato k="NIA" v={ficha.nia ?? '—'} />
              <Dato k="Tutor/a" v={ficha.tutor ?? '—'} />
              <Dato k="Matrícula" v={ficha.fechaMatricula.split('-').reverse().join('/')} />
            </dl>
            {ficha.eduStudentId && (
              <Link
                href={`/gestion/alumnado?alumno=${ficha.eduStudentId}`}
                className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                Ficha completa en Alumnado <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </Tarjeta>

          {ficha.notasLista.length > 0 && (
            <Tarjeta className="space-y-3 p-5">
              <Rotulo>Últimas notas</Rotulo>
              {[...ficha.notasLista]
                .reverse()
                .slice(0, 4)
                .map((n) => (
                  <div key={n.id} className="border-b border-zinc-100 pb-2.5 text-sm last:border-0 last:pb-0 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {n.paso ? ficha.pasos.find((p) => p.clave === n.paso)?.titulo ?? 'General' : 'General'}
                      </span>{' '}
                      · {n.autor} · {fechaHora(n.at)}
                    </p>
                    <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">{n.texto}</p>
                  </div>
                ))}
            </Tarjeta>
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
          paso.estado === 'aviso' ? 'border-amber-300 dark:border-amber-500/40' : 'border-zinc-200 dark:border-zinc-800',
          paso.estado === 'no_aplica' && 'opacity-70',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={abierto}
          className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <span className="min-w-0 flex-[1_1_16rem]">
            <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-100">{paso.titulo}</span>
            <span className={cn('block text-sm break-words', COLOR_TEXTO[paso.estado])}>{paso.texto}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <ChipResponsable responsable={paso.responsable} />
            <Etiqueta>{paso.fuente}</Etiqueta>
            {notas.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <MessageSquare className="h-3 w-3" /> {notas.length}
              </span>
            )}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', abierto && 'rotate-180')} />
        </button>
        {!abierto && ultima && (
          <p className="truncate px-4 pb-3 text-xs text-zinc-600 dark:text-zinc-400">
            «{ultima.texto}» <span className="text-zinc-500 dark:text-zinc-400">· {ultima.autor}, {fechaHora(ultima.at)}</span>
          </p>
        )}
        {abierto && (
          <div className="space-y-4 border-t border-zinc-100 px-4 pt-3.5 pb-4 dark:border-zinc-800">
            <AccionDelPaso paso={paso} ctx={ctx} />
            <div className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <Rotulo as="h3">Notas de este paso</Rotulo>
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
      return paso.estado === 'hecho' ? null : (
        <CampoYBoton
          placeholder="Ej. 2026/0412"
          boton="Guardar y resolver"
          mono
          ocupado={enCurso}
          onGuardar={(v) => accion({ paso: 'matricula', numero: v }, d.vinculado ? 'Número de matrícula guardado en su ficha' : 'Apuntado')}
          ayuda={
            d.vinculado
              ? 'Se guarda en su ficha central. Que no se olvide meterlo también en Educamos.'
              : 'Queda apuntado y pasa a su ficha al sincronizar Educamos (si Educamos no trae otro).'
          }
        />
      );

    case 'ipad':
      if (d.vinculado && puede.dispositivos) {
        return (
          <SelectorRapido
            eduStudentId={ficha.eduStudentId!}
            actual={d.dispositivo}
            onGuardado={async () => ctx.setFicha((await pedir<{ ficha: FichaNouvingut }>(`/api/nouvinguts/${ficha.id}`)).ficha)}
          />
        );
      }
      // Sin el módulo de dispositivos, se puede seguir marcando a mano.
      return (
        <div className="flex flex-wrap items-center gap-2">
          {paso.estado === 'hecho' ? (
            d.dispositivo ? null : (
              <Boton variante="secundario" ocupado={enCurso} onClick={() => accion({ paso: 'ipad', hecho: false })}>
                <Undo2 /> Deshacer
              </Boton>
            )
          ) : (
            <Boton variante="primario" ocupado={enCurso} onClick={() => accion({ paso: 'ipad', hecho: true })}>
              <Check /> Marcar hecho
            </Boton>
          )}
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Cómo lo tiene se apunta en Dispositivos 1:1 (TIC, secretaría y dirección).</span>
        </div>
      );

    case 'claves':
    case 'foto':
    case 'vinculo_correo': {
      const clave = paso.clave;
      return (
        <div className="flex flex-wrap items-center gap-2">
          {paso.estado === 'hecho' ? (
            <Boton variante="secundario" ocupado={enCurso} onClick={() => accion({ paso: clave, hecho: false })}>
              <Undo2 /> Deshacer
            </Boton>
          ) : (
            <Boton variante="primario" ocupado={enCurso} onClick={() => accion({ paso: clave, hecho: true })}>
              <Check /> Marcar hecho
            </Boton>
          )}
        </div>
      );
    }

    case 'proteccion':
      if (!d.proteccion) return null;
      return <Proteccion key={d.proteccion.actualizadoAt ?? 'sin'} ctx={ctx} />;

    case 'banco':
    case 'ampa':
    case 'comedor':
    case 'complementarias': {
      const clave = paso.clave;
      const valor = { banco: d.bancoLibros, ampa: d.ampa, comedor: d.comedor, complementarias: d.complementarias }[clave];
      const decidido = paso.estado === 'hecho';
      const pregunta = {
        banco: '¿Entra en el banco de libros?',
        ampa: '¿Es del AMPA?',
        comedor: '¿Se queda a comer?',
        complementarias: '¿Va a complementarias?',
      }[clave];
      const si = { banco: 'Sí, entra en el banco', ampa: 'Sí, es del AMPA', comedor: 'Sí, se queda', complementarias: 'Sí, va' }[clave];
      const servicio = clave === 'comedor' || clave === 'complementarias';
      if (!(servicio ? puede.servicios : puede.participantes)) {
        return <p className="text-sm text-zinc-500 dark:text-zinc-400">Esto lo deciden secretaría, dirección o TIC.</p>;
      }
      return (
        <div className="space-y-2">
          {!decidido && d.vinculado && valor !== null && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">En su ficha pone ahora «{valor ? 'sí' : 'no'}», sin confirmar. ¿Qué ha dicho la familia?</p>
          )}
          {!d.vinculado && <p className="text-sm text-zinc-600 dark:text-zinc-400">Queda apuntado y pasa a su ficha al sincronizar Educamos.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Segmentado
              etiqueta={pregunta}
              opciones={[
                { valor: 'si', etiqueta: si },
                { valor: 'no', etiqueta: 'No' },
              ]}
              valor={decidido ? (valor ? 'si' : 'no') : null}
              disabled={enCurso}
              onChange={(v) => accion({ paso: clave, valor: v === 'si' })}
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
      if (!d.vinculado) return <AMano paso={paso} ctx={ctx} ayuda="Qué materiales le tocan se sabrá cuando esté en Educamos." />;
      if (!puede.materiales) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Los pagos los marcan secretaría, dirección o TIC.</p>;
      return (
        <div className="space-y-2">
          {d.materiales.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{m.nombre}</span>
              <Segmentado
                etiqueta={m.nombre}
                opciones={OPCIONES_MATERIAL}
                valor={m.estado}
                disabled={enCurso}
                onChange={(v) => accion({ paso: 'materiales', materialId: m.id, estado: v === m.estado ? null : v })}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Enlace href={`/gestion/alumnado`}>Venta de materiales en Alumnado</Enlace>
            <AMano paso={paso} ctx={ctx} />
          </div>
        </div>
      );

    case 'correo':
      return (
        <div className="space-y-3">
          {paso.estado !== 'hecho' && (
            <CampoYBoton
              tipo="email"
              placeholder="nombre.apellido@…"
              boton={d.vinculado ? 'Guardar en su ficha' : 'Apuntar'}
              ocupado={enCurso}
              onGuardar={(v) => accion({ paso: 'correo', email: v }, d.vinculado ? 'Correo guardado en su ficha' : 'Apuntado')}
              ayuda={d.vinculado ? undefined : 'Pasa a su ficha al sincronizar Educamos (si Educamos no trae otro).'}
            />
          )}
          <AMano paso={paso} ctx={ctx} />
          {d.vinculado && paso.estado !== 'hecho' && puede.correo && (
            <Enlace href={`/gestion/cuentas?persona=a:${ficha.eduStudentId}`} boton>
              Crear su correo en Correos y grupos
            </Enlace>
          )}
        </div>
      );

    case 'asm':
      return (
        <div className="space-y-2">
          {paso.estado !== 'hecho' && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.vinculado
                ? 'Ninguna subida a Apple School Manager le incluye todavía: prepara los CSV con él y súbelos.'
                : 'Si ya lo has metido en Apple School Manager a mano, márcalo.'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {d.vinculado && paso.estado !== 'hecho' && (
              <Enlace href="/gestion/autoasm" boton>
                Preparar en AUTOASM
              </Enlace>
            )}
            <AMano paso={paso} ctx={ctx} />
          </div>
        </div>
      );

    case 'licencias': {
      if (!d.vinculado) {
        const noPedira = paso.estado === 'hecho';
        return (
          <Boton variante="secundario" ocupado={enCurso} onClick={() => accion({ paso: 'licencias', noPedira: !noPedira })}>
            {noPedira ? 'Deshacer «no pedirá licencias»' : 'No pedirá licencias'}
          </Boton>
        );
      }
      const l = d.licencias;
      if (l.pedidoAt) return <Enlace href="/gestion/licencias">Ver en Licencias</Enlace>;
      const noPedira = paso.estado === 'hecho';
      return (
        <div className="space-y-2">
          {l.campania && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
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

const OPCIONES_MATERIAL: { valor: EstadoMaterialNou; etiqueta: string }[] = [
  { valor: 'pagado', etiqueta: 'Pagado' },
  { valor: 'no', etiqueta: 'No' },
  { valor: 'becado', etiqueta: 'Beca' },
  { valor: 'no_aplica', etiqueta: 'No le toca' },
];

function Proteccion({ ctx }: { ctx: Ctx }) {
  const pd = ctx.ficha.datos.proteccion!;
  const [v, setV] = useState({ imagen: pd.imagen, redes: pd.redes, ampa: pd.ampa, ong: pd.ong });
  if (!ctx.puede.proteccion) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">La protección de datos la guardan secretaría, dirección o TIC.</p>;
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
          <Segmentado
            etiqueta={texto}
            opciones={[
              { valor: 'si', etiqueta: 'Sí' },
              { valor: 'no', etiqueta: 'No' },
            ]}
            valor={v[k] === true ? 'si' : v[k] === false ? 'no' : null}
            onChange={(x) => setV((prev) => ({ ...prev, [k]: x === 'si' }))}
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
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{resultados ? 'Resultados' : 'Se le parecen'}</p>
          {lista.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">{c.nombre}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {c.clase} · alta en la BBDD el {new Date(c.alta).toLocaleDateString('es-ES', { timeZone: CONFIGURACION.calendario.zonaHoraria })}
                </span>
              </span>
              <ConfirmarEnLinea
                etiqueta="Es este"
                variante="default"
                pregunta={`¿${ficha.nombre} es ${c.nombre} (${c.clase})?`}
                confirmar="Sí, vincular"
                peligro={false}
                disabled={vinculando !== null}
                onConfirmar={() => vincular(c)}
              />
            </div>
          ))}
        </div>
      )}
      {resultados && resultados.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nadie con ese nombre en la BBDD central.</p>}
      <form onSubmit={buscar} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el alumnado para vincular a mano" aria-label="Buscar en el alumnado" />
        <Button type="submit" variant="outline" size="icon" disabled={buscando || q.trim().length < 2} aria-label="Buscar">
          {buscando ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
      </form>

      <details className="group rounded-xl border border-zinc-200 dark:border-zinc-700">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
          Corregir lo apuntado
          <ChevronDown aria-hidden className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input aria-label="Nombre" className="uppercase" value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} />
            <Input aria-label="Apellidos" className="uppercase" value={apellidos} onChange={(e) => setApellidos(e.target.value.toUpperCase())} />
            <Selector aria-label="Curso" value={curso} onChange={(e) => setCurso(e.target.value)}>
              {cursos.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {etiquetaCurso(c.codigo)}
                </option>
              ))}
            </Selector>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" disabled={!cambiado} onClick={guardarDatos}>
              Guardar
            </Button>
            <ConfirmarEnLinea
              etiqueta="Quitar: lo apunté por error"
              icono={<Trash2 />}
              pregunta={`¿Quitar a ${ficha.nombre} de nouvinguts? No se puede deshacer.`}
              confirmar="Sí, quitar"
              onConfirmar={quitar}
            />
          </div>
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
        <div key={n.id} className="rounded-xl border border-zinc-100 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{n.texto}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500 dark:text-zinc-400">
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
          <Input
            className="flex-[1_1_14rem]"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={paso ? 'Apunta algo de este paso…' : 'Algo que hay que saber de este alumno…'}
            aria-label="Nota"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-pressed={porCorreo}
            onClick={() => setPorCorreo((v) => !v)}
            aria-label="Mandar también por correo"
            className={cn(porCorreo && 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200')}
          >
            <Mail />
          </Button>
          <Button type="submit" variant={porCorreo ? 'default' : 'outline'} cargando={guardando} disabled={!texto.trim()}>
            {porCorreo ? 'Guardar y mandar' : 'Guardar nota'}
          </Button>
        </div>
        {porCorreo && (
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="text-sm text-zinc-600 dark:text-zinc-300">
                Mandar a
              </span>
              <Filtros etiqueta="Mandar a">
                {GRUPOS_AVISO.map((g) => {
                  const on = grupos.includes(g);
                  return (
                    <Filtro key={g} activo={on} onClick={() => setGrupos((prev) => (on ? prev.filter((x) => x !== g) : [...prev, g]))}>
                      {GRUPO_AVISO_LABEL[g]}
                    </Filtro>
                  );
                })}
              </Filtros>
            </div>
            <Input
              value={otros}
              onChange={(e) => setOtros(e.target.value)}
              placeholder={`y/o correos del colegio: nombre@${COLEGIO.dominio}`}
              aria-label="Otros correos"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Sale desde tu correo: si contestan, te llega a ti.</p>
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

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{k}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{v}</dd>
    </div>
  );
}

/**
 * «Marcar hecho a mano» para los pasos que sabe otro módulo (materiales, correo, ASM, iPad): todos
 * los pasos son libres y se pueden dar por hechos sin esperar a Educamos ni a ese módulo.
 */
function AMano({ paso, ctx, ayuda }: { paso: ResultadoPaso; ctx: Ctx; ayuda?: string }) {
  if (!(PASOS_A_MANO as readonly string[]).includes(paso.clave)) return null;
  const clave = paso.clave as (typeof PASOS_A_MANO)[number];
  const aMano = paso.marca?.valor === 'hecho';
  if (paso.estado === 'hecho' && !aMano) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {aMano ? (
        <Boton variante="enlace" ocupado={ctx.ocupado === clave} onClick={() => ctx.accion({ paso: clave, hecho: false })}>
          Deshacer lo marcado a mano
        </Boton>
      ) : (
        <Boton variante="secundario" ocupado={ctx.ocupado === clave} onClick={() => ctx.accion({ paso: clave, hecho: true })}>
          <Check /> Marcar hecho a mano
        </Boton>
      )}
      {ayuda && <span className="text-sm text-zinc-500 dark:text-zinc-400">{ayuda}</span>}
    </div>
  );
}


function Enlace({ href, children, boton = false }: { href: string; children: React.ReactNode; boton?: boolean }) {
  return (
    <Link
      href={href}
      className={
        boton
          ? buttonVariants({ variant: 'outline', size: 'sm' })
          : 'inline-flex min-h-10 items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-400'
      }
    >
      {children} <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

/** Los botones de dentro de cada paso: 40 px, con la ruedecita mientras se guarda. */
function Boton({
  children,
  onClick,
  ocupado,
  variante,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ocupado: boolean;
  variante: 'primario' | 'secundario' | 'enlace';
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variante === 'primario' ? 'default' : variante === 'secundario' ? 'outline' : 'ghost'}
      cargando={ocupado}
      onClick={onClick}
    >
      {children}
    </Button>
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
        <Input
          type={tipo}
          aria-label={placeholder}
          className={cn('max-w-xs flex-[1_1_12rem]', mono && 'font-mono')}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
        />
        <Button type="submit" cargando={ocupado} disabled={!v.trim()}>
          {boton}
        </Button>
      </div>
      {ayuda && <p className="text-xs text-zinc-500 dark:text-zinc-400">{ayuda}</p>}
    </form>
  );
}
