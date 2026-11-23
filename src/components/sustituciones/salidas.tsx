'use client';

// Salidas (docs/32, decisión 25): «4º ESO A no está este día». Pantalla sencilla: la lista y un panel
// para apuntar una. Al guardar, sus profes quedan libres esas horas y a cada acompañante se le prepara
// una ausencia en borrador con quién entra en sus clases; aquí se ve qué ha pasado y qué queda.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Ban, Bus, CircleOff, Plus, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { ETAPA_LABEL, type Etapa } from '@/lib/cursos';
import { sinAcentos } from '@/lib/sustituciones-interpretar';
import { fechaLarga, hora, mayuscula } from '@/lib/sustituciones';
import type { GrupoHorario, ResultadoSalida, SalidaLista, YaNoHaceFalta } from '@/lib/sustituciones-salidas-server';
import type { ProfeSelector } from '@/lib/sustituciones-server';
import { Aviso } from '@/components/ui/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Estado } from '@/components/ui/estado';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Filtro } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Interruptor } from '@/components/ui/interruptor';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { pedir } from './comun';

const enlaceFicha = (fecha: string, id: string) => `/gestion/sustituciones?semana=${fecha}&ausencia=${id}`;

export function Salidas({
  proximas,
  pasadas,
  sobrantes,
  grupos,
  profes,
  etapas,
  hoy,
}: {
  proximas: SalidaLista[];
  pasadas: SalidaLista[];
  sobrantes: Record<string, YaNoHaceFalta[]>;
  grupos: GrupoHorario[];
  profes: ProfeSelector[];
  etapas: Etapa[];
  hoy: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSalida | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Apunta aquí cuando un grupo no está (una excursión, una convivencia). Quien les da clase a esas horas queda libre para sustituir, y a quien va con ellos se le prepara la sustitución de sus clases.
        </p>
        <Button
          onClick={() => {
            setResultado(null);
            setAbierto(true);
          }}
        >
          <Plus aria-hidden /> Nueva salida
        </Button>
      </div>

      <section className="space-y-2">
        <Rotulo>Próximas</Rotulo>
        {proximas.length === 0 ? (
          <Vacio icono={<Bus />} titulo="No hay salidas apuntadas" />
        ) : (
          proximas.map((s) => <TarjetaSalida key={s.id} s={s} sobran={sobrantes[s.id] ?? []} onCambio={() => router.refresh()} />)
        )}
      </section>

      {pasadas.length > 0 && (
        <details className="group">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-medium text-zinc-600 [&::-webkit-details-marker]:hidden dark:text-zinc-400">
            <ArrowRight aria-hidden className="size-4 transition-transform group-open:rotate-90" /> Últimos 30 días ({pasadas.length})
          </summary>
          <div className="mt-2 space-y-2">
            {pasadas.map((s) => (
              <TarjetaSalida key={s.id} s={s} sobran={[]} pasada onCambio={() => router.refresh()} />
            ))}
          </div>
        </details>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent variante="lateral" aria-describedby={undefined}>
          <DialogTitle className="pr-10 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{resultado ? 'Salida apuntada' : 'Nueva salida'}</DialogTitle>
          {resultado ? (
            <ResumenSalida r={resultado} onCerrar={() => setAbierto(false)} fecha={proximas.find((x) => x.id === resultado.id)?.fecha ?? hoy} />
          ) : (
            <FormularioSalida
              grupos={grupos}
              profes={profes}
              etapas={etapas}
              hoy={hoy}
              onHecho={(r) => {
                setResultado(r);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TarjetaSalida({ s, sobran, pasada, onCambio }: { s: SalidaLista; sobran: YaNoHaceFalta[]; pasada?: boolean; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  async function noHaceFalta(x: YaNoHaceFalta) {
    setOcupado(x.sesionId);
    try {
      await pedir(`/api/sustituciones/admin/ausencias/${x.ausenciaId}`, { method: 'PATCH', body: { accion: 'no_hace_falta', sesionId: x.sesionId, avisar: true } });
      haptic.success();
      toast.success(x.sustituto ? `Hecho. Se avisa a ${x.sustituto} de que ya no hace falta.` : 'Hecho');
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido');
    } finally {
      setOcupado(null);
    }
  }
  async function anular() {
    try {
      const r = await pedir<{ anuladas: number }>(`/api/sustituciones/admin/salidas/${s.id}`, { method: 'DELETE' });
      toast.success(r.anuladas ? `Salida anulada, y ${r.anuladas === 1 ? 'la ausencia de su acompañante' : `las ${r.anuladas} ausencias de sus acompañantes`}` : 'Salida anulada');
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido anular');
    }
  }
  return (
    <Tarjeta className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{s.descripcion}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {mayuscula(fechaLarga(s.fecha))} · {s.horaInicio && s.horaFin ? `de ${hora(s.horaInicio)} a ${hora(s.horaFin)}` : 'todo el día'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {s.grupos.map((g) => (
              <Etiqueta key={g.etiqueta}>{g.etiqueta}</Etiqueta>
            ))}
          </div>
        </div>
        {!pasada && (
          <ConfirmarEnLinea
            etiqueta="Anular"
            icono={<Ban aria-hidden />}
            tamano="sm"
            variante="ghost"
            pregunta={s.ausencias.length ? `Se anulan también ${s.ausencias.length === 1 ? 'la ausencia de su acompañante' : `las ${s.ausencias.length} ausencias de sus acompañantes`}` : '¿Anular la salida?'}
            confirmar="Anular"
            onConfirmar={anular}
          />
        )}
      </div>
      {s.acompanantes.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <Users aria-hidden className="size-4" /> Van {s.acompanantes.map((a) => a.nombre).join(', ')}
          </p>
          {s.ausencias.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {s.ausencias.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-100">{a.profe}</span>
                  <span className="text-zinc-500 tabular-nums dark:text-zinc-400">{a.aCubrir === 1 ? '1 clase' : `${a.aCubrir} clases`}</span>
                  {a.sinCubrir > 0 && <Estado tono="aviso">{a.sinCubrir} sin cubrir</Estado>}
                  {a.borrador > 0 && <Estado tono="neutro">{a.borrador === 1 ? '1 borrador' : `${a.borrador} en borrador`}</Estado>}
                  {a.sinCubrir === 0 && a.borrador === 0 && a.aCubrir > 0 && <Estado tono="info">Cubierta</Estado>}
                  <Link href={enlaceFicha(s.fecha, a.id)} className={buttonVariants({ variant: 'suave', size: 'sm' })}>
                    Revisar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {sobran.length > 0 && (
        <Aviso tono="aviso" titulo={sobran.length === 1 ? 'Una sustitución ya no hace falta' : `${sobran.length} sustituciones ya no hacen falta`}>
          <ul className="mt-1 space-y-1.5">
            {sobran.map((x) => (
              <li key={x.sesionId} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  {x.cuando} · {x.grupos} · falta {x.ausente}
                  {x.sustituto ? `, entraba ${x.sustituto}` : ''}
                </span>
                <Button variant="outline" size="sm" cargando={ocupado === x.sesionId} disabled={ocupado !== null} onClick={() => void noHaceFalta(x)}>
                  <CircleOff aria-hidden /> Ya no hace falta
                </Button>
              </li>
            ))}
          </ul>
        </Aviso>
      )}
    </Tarjeta>
  );
}

function ResumenSalida({ r, fecha, onCerrar }: { r: ResultadoSalida; fecha: string; onCerrar: () => void }) {
  return (
    <div className="space-y-4 pb-6">
      {r.preparadas.length > 0 ? (
        <section className="space-y-2">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Te he dejado preparadas en <strong>borrador</strong> las clases de quien va. Revísalas y avisa desde su ficha:</p>
          <ul className="space-y-2">
            {r.preparadas.map((p) => (
              <li key={p.ausenciaId} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-100">{p.profe}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{p.horas === 1 ? '1 hora' : `${p.horas} horas`}</span>
                {p.sinCubrir > 0 && <Estado tono="aviso">{p.sinCubrir} sin cubrir</Estado>}
                <Link href={enlaceFicha(fecha, p.ausenciaId)} className={buttonVariants({ variant: 'suave', size: 'sm' })}>
                  Revisar <ArrowRight aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Nadie que vaya tiene clase a esas horas: no hay que cubrir nada.</p>
      )}
      {r.sinHoras.length > 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin clases que cubrir a esas horas: {r.sinHoras.join(', ')}.</p>}
      {r.liberadas.length > 0 && (
        <Aviso tono="aviso" titulo="Se han quedado sin cubrir">
          Quien va cubría estas horas: {r.liberadas.map((l) => `${l.profe}, ${l.cuando}`).join('; ')}. Búscales a otra persona en la semana.
        </Aviso>
      )}
      {r.yaNoHacenFalta.length > 0 && (
        <Aviso tono="aviso" titulo={r.yaNoHacenFalta.length === 1 ? 'Una sustitución ya no hace falta' : `${r.yaNoHacenFalta.length} sustituciones ya no hacen falta`}>
          Su grupo está de salida: {r.yaNoHacenFalta.map((x) => `${x.cuando} ${x.grupos} (falta ${x.ausente})`).join('; ')}. Quítalas desde la lista de salidas con «Ya no hace falta».
        </Aviso>
      )}
      <Button variant="outline" onClick={onCerrar}>
        Hecho
      </Button>
    </div>
  );
}

function FormularioSalida({ grupos, profes, etapas, hoy, onHecho }: { grupos: GrupoHorario[]; profes: ProfeSelector[]; etapas: Etapa[]; hoy: string; onHecho: (r: ResultadoSalida) => void }) {
  const [fecha, setFecha] = useState(hoy);
  const [todoElDia, setTodoElDia] = useState(true);
  const [hi, setHi] = useState('09:00');
  const [hf, setHf] = useState('13:00');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [descripcion, setDescripcion] = useState('');
  const [van, setVan] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [verOtras, setVerOtras] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const clave = (g: GrupoHorario) => `${g.curso}|${g.letra ?? ''}`;
  const mias = new Set<string>(etapas);
  const visibles = grupos.filter((g) => verOtras || mias.size === 0 || mias.has(g.etapa));
  const porEtapa = useMemo(() => {
    const m = new Map<Etapa, GrupoHorario[]>();
    for (const g of visibles) m.set(g.etapa, [...(m.get(g.etapa) ?? []), g]);
    return [...m];
  }, [visibles]);
  const t = sinAcentos(q.trim());
  const candidatos = t.length >= 1 ? profes.filter((p) => !van.includes(p.id) && sinAcentos(p.nombre).split(/\s+/).some((w) => w.startsWith(t))).slice(0, 6) : [];
  const listo = Boolean(fecha) && elegidos.size > 0 && descripcion.trim().length >= 2 && (todoElDia || hi < hf);

  async function guardar() {
    setGuardando(true);
    try {
      const r = await pedir<ResultadoSalida>('/api/sustituciones/admin/salidas', {
        body: {
          fecha,
          horaInicio: todoElDia ? null : hi,
          horaFin: todoElDia ? null : hf,
          grupos: grupos.filter((g) => elegidos.has(clave(g))).map((g) => ({ curso: g.curso, letra: g.letra })),
          descripcion,
          acompanantes: van,
        },
      });
      haptic.success();
      onHecho(r);
    } catch (e) {
      haptic.warning();
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 pb-4">
        <Campo etiqueta="Adónde van" id="s-desc">
          <Input id="s-desc" autoFocus value={descripcion} maxLength={200} placeholder="Museo de Bellas Artes, convivencia en Benicàssim…" onChange={(e) => setDescripcion(e.target.value)} />
        </Campo>
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Día" id="s-fecha" className="w-[11rem]">
            <Input id="s-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
          <Interruptor activo={todoElDia} onChange={setTodoElDia} etiqueta="Todo el día" className="w-auto" />
          {!todoElDia && (
            <div className="flex items-end gap-2">
              <Campo etiqueta="Salen" id="s-hi" className="w-28">
                <Input id="s-hi" type="time" value={hi} onChange={(e) => setHi(e.target.value)} />
              </Campo>
              <Campo etiqueta="Vuelven" id="s-hf" className="w-28">
                <Input id="s-hf" type="time" value={hf} onChange={(e) => setHf(e.target.value)} />
              </Campo>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Qué grupos se van</p>
          {porEtapa.map(([etapa, lista]) => (
            <div key={etapa} className="space-y-1.5">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{ETAPA_LABEL[etapa]}</p>
              <div className="flex flex-wrap gap-1.5">
                {lista.map((g) => (
                  <Filtro
                    key={clave(g)}
                    activo={elegidos.has(clave(g))}
                    onClick={() =>
                      setElegidos((prev) => {
                        const sig = new Set(prev);
                        if (sig.has(clave(g))) sig.delete(clave(g));
                        else sig.add(clave(g));
                        return sig;
                      })
                    }
                    className="px-3"
                  >
                    {g.etiqueta}
                  </Filtro>
                ))}
              </div>
            </div>
          ))}
          {mias.size > 0 && grupos.some((g) => !mias.has(g.etapa)) && (
            <Button variant="link" size="sm" onClick={() => setVerOtras((v) => !v)}>
              {verOtras ? 'Solo los de mi etapa' : 'Ver grupos de otras etapas'}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Quién va con ellos <span className="font-normal text-zinc-500 dark:text-zinc-400">· no estarán libres y se cubren sus clases</span>
          </p>
          {van.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {van.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVan((v) => v.filter((x) => x !== id))}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-300 bg-white pr-2 pl-3 text-sm font-medium text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {profes.find((p) => p.id === id)?.nombre ?? '—'}
                  <X aria-hidden className="size-4 text-zinc-500" />
                  <span className="sr-only">Quitar</span>
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              aria-label="Añadir acompañante"
              placeholder="Añadir a alguien…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && candidatos[0]) {
                  e.preventDefault();
                  setVan((v) => [...v, candidatos[0].id]);
                  setQ('');
                }
              }}
            />
          </div>
          {candidatos.length > 0 && (
            <ul className="rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
              {candidatos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setVan((v) => [...v, p.id]);
                      setQ('');
                    }}
                    className={cn('flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm outline-none hover:bg-blue-50 focus-visible:bg-blue-50 dark:hover:bg-blue-500/15 dark:focus-visible:bg-blue-500/15')}
                  >
                    {p.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:-mx-6 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/95">
        <span className="mr-auto text-sm text-zinc-600 dark:text-zinc-400">
          {elegidos.size === 0 ? 'Elige al menos un grupo' : `${elegidos.size === 1 ? '1 grupo' : `${elegidos.size} grupos`}${van.length ? ` · van ${van.length}` : ''}`}
        </span>
        <Button onClick={() => void guardar()} cargando={guardando} disabled={!listo}>
          <Bus aria-hidden /> Guardar salida
        </Button>
      </div>
    </div>
  );
}
