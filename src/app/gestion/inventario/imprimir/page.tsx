export const dynamic = 'force-dynamic';

// Informes de Inventario y aulas para imprimir (o guardar en PDF desde el diálogo de imprimir):
// estilo «papel oficial», blanco y negro, con columnas en blanco para escribir encima a boli
// durante la ronda. Uno por sección, con el mismo orden que se tenía en pantalla.
import { notFound } from 'next/navigation';
import { cargarInventario, type ArregloInv } from '@/lib/inventario-server';
import { indexar, etiquetaAula, type FilaAula } from '@/lib/inventario-indice';
import {
  ACCION_AV_LABEL,
  AREA_LABEL,
  AUDIO_LABEL,
  CATEGORIAS_ROB,
  CATEGORIA_ROB_LABEL,
  ESTADO_KIT_LABEL,
  NIVEL_LABEL,
  PANTALLA_LABEL,
  PRIORIDADES,
  PRIORIDAD_LABEL,
  PRIORIDAD_PESO,
  antenaPorRenombrar,
  cuadreMobiliario,
  etiquetaPiso,
  pesoAtencion,
  textoCuadre,
  type AccionAv,
  type Area,
  type Audio,
  type EstadoKit,
  type Pantalla,
  type Prioridad,
} from '@/lib/inventario';
import { EnlaceVolver } from '@/components/ui/cabecera-modulo';
import { PrintButton } from '@/components/bancolibros/print-button';

export const metadata = { title: 'Imprimir · Inventario y aulas' };

const TH = 'border border-zinc-400 bg-zinc-100 px-2 py-1 text-left font-semibold print:bg-zinc-100';
const TD = 'border border-zinc-400 px-2 py-1 align-top';
const HUECO = 'border border-zinc-400 px-2 py-1 min-w-32';

function Hoja({ titulo, subtitulo, volver, apaisado, children }: { titulo: string; subtitulo: string; volver: string; apaisado?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-4 bg-white text-black dark:bg-white dark:text-black print:space-y-2">
      {apaisado && <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>}
      {!apaisado && <style>{'@page { size: A4 portrait; margin: 12mm; }'}</style>}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <EnlaceVolver href={volver}>Volver</EnlaceVolver>
        <PrintButton />
      </div>
      <div className="border-b-2 border-black pb-1">
        <h1 className="text-lg font-bold tracking-wide uppercase">{titulo}</h1>
        <p className="text-xs">{subtitulo}</p>
      </div>
      {children}
    </div>
  );
}

function hoyTexto(): string {
  return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
}

export default async function ImprimirPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [inv, sp] = await Promise.all([cargarInventario(), searchParams]);
  const filas = indexar(inv);
  const informe = sp.informe ?? 'aulas';
  const fecha = `Colegio Consolación Burriana · curso ${inv.cursoActual} · ${hoyTexto()}`;
  const kits = new Map(inv.kits.map((k) => [k.id, k]));
  const aulas = new Map(filas.map((f) => [f.aula.id, f]));

  if (informe === 'av') {
    const orden = sp.orden ?? 'prioridad';
    const lista = filas
      .filter((f) => f.av || !f.aula.nombre)
      .sort((a, b) =>
        orden === 'prioridad'
          ? pesoAtencion(a.atencionAv, a.av?.valoracion ?? null) - pesoAtencion(b.atencionAv, b.av?.valoracion ?? null) || a.aula.orden - b.aula.orden
          : orden === 'valoracion'
            ? (a.av?.valoracion ?? 6) - (b.av?.valoracion ?? 6) || a.aula.orden - b.aula.orden
            : a.aula.orden - b.aula.orden,
      );
    return (
      <Hoja titulo="Audiovisual de las aulas" subtitulo={`${fecha} · ordenado por ${orden === 'prioridad' ? 'prioridad' : orden === 'valoracion' ? 'valoración' : 'número de aula'}`} volver="/gestion/inventario/audiovisual" apaisado>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Aula', 'Clase', 'Pantalla', 'Marca', 'Audio', 'ATV', 'Nota', 'Qué hacer', 'Prioridad', 'Pendiente'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
              <th className={TH}>Hecho / notas</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.aula.id} className="break-inside-avoid">
                <td className={`${TD} font-bold`}>{f.aula.numero}</td>
                <td className={TD}>{f.aula.nombre ?? f.cartel}</td>
                <td className={TD}>{f.av?.pantalla ? PANTALLA_LABEL[f.av.pantalla as Pantalla] : ''}</td>
                <td className={TD}>{f.av?.marca}</td>
                <td className={TD}>{f.av?.audio ? AUDIO_LABEL[f.av.audio as Audio] : ''}</td>
                <td className={TD}>{f.av ? (f.av.appleTv ? 'Sí' : 'No') : ''}</td>
                <td className={TD}>{f.av?.valoracion ?? '–'}/5</td>
                <td className={TD}>{f.av ? ACCION_AV_LABEL[f.av.accion as AccionAv] : ''}</td>
                <td className={`${TD} font-semibold`}>{NIVEL_LABEL[f.atencionAv]}</td>
                <td className={TD}>
                  {f.pendientes
                    .filter((a) => a.area === 'av' || a.area === 'red')
                    .map((a) => (
                      <div key={a.id}>☐ {a.texto}</div>
                    ))}
                </td>
                <td className={HUECO} />
              </tr>
            ))}
          </tbody>
        </table>
      </Hoja>
    );
  }

  if (informe === 'mobiliario') {
    const lista = filas.filter((f) => f.ocupacion?.curso || f.mob);
    if (sp.orden === 'faltan') {
      const peor = (f: FilaAula) => {
        const c = cuadreMobiliario(f.mob, f.alumnos, f.ocupacion?.curso ?? null);
        return Math.min(c.sillas ?? 99, c.mesas ?? 99);
      };
      lista.sort((a, b) => peor(a) - peor(b) || a.aula.orden - b.aula.orden);
    }
    return (
      <Hoja titulo="Mesas y sillas" subtitulo={`${fecha} · para contar: apunta en las columnas en blanco`} volver="/gestion/inventario/mobiliario">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Aula', 'Clase', 'Alumnos', 'Sillas', 'Mesas', 'Cuadre', 'Sillas hoy', 'Mesas hoy', 'Notas'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => {
              const c = cuadreMobiliario(f.mob, f.alumnos, f.ocupacion?.curso ?? null);
              return (
                <tr key={f.aula.id} className="break-inside-avoid">
                  <td className={`${TD} font-bold`}>{f.aula.numero}</td>
                  <td className={TD}>{f.aula.nombre ?? f.cartel}</td>
                  <td className={`${TD} text-right`}>{f.alumnos ?? ''}</td>
                  <td className={`${TD} text-right`}>{f.mob?.sillas ?? ''}</td>
                  <td className={`${TD} text-right`}>{f.mob?.mesas ?? ''}</td>
                  <td className={TD}>
                    {[c.sillas !== null ? `Sillas: ${textoCuadre(c.sillas)}` : null, c.mesas !== null ? `Mesas: ${textoCuadre(c.mesas)}` : null].filter(Boolean).join(' · ')}
                  </td>
                  <td className={`${HUECO} min-w-16`} />
                  <td className={`${HUECO} min-w-16`} />
                  <td className={TD}>{f.mob?.notas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Hoja>
    );
  }

  if (informe === 'antenas') {
    const lista = [...inv.antenas].sort((a, b) => (a.piso ?? 'Z').localeCompare(b.piso ?? 'Z') || a.nombreActual.localeCompare(b.nombreActual, 'es', { numeric: true }));
    return (
      <Hoja titulo="Antenas wifi" subtitulo={`${fecha} · ${inv.antenas.filter(antenaPorRenombrar).length} por renombrar`} volver="/gestion/inventario/antenas">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Piso', 'Nombre actual', 'Nombre nuevo', 'Dónde', 'Renombrada'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => {
              const f = a.aulaId ? aulas.get(a.aulaId) : null;
              return (
                <tr key={a.id}>
                  <td className={TD}>{a.piso}</td>
                  <td className={`${TD} font-mono`}>{a.nombreActual}</td>
                  <td className={`${TD} font-mono font-bold`}>{antenaPorRenombrar(a) ? a.nombreNuevo : '='}</td>
                  <td className={TD}>{f ? etiquetaAula(f) : a.ubicacion}</td>
                  <td className={TD}>{antenaPorRenombrar(a) ? '☐' : 'Sí'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Hoja>
    );
  }

  if (informe === 'arreglos') {
    const area = sp.area as Area | undefined;
    const pend = inv.arreglos.filter((a) => !a.hechoAt && (!area || a.area === area));
    const aulaDe = (a: ArregloInv) => (a.aulaId ? aulas.get(a.aulaId) : a.kitId ? aulas.get(kits.get(a.kitId)?.aulaId ?? '') : undefined);
    const donde = (a: ArregloInv) => {
      const f = aulaDe(a);
      const k = a.kitId ? kits.get(a.kitId) : null;
      return [k ? `Kit ${k.codigo}` : null, f ? etiquetaAula(f) : null].filter(Boolean).join(' · ') || 'General';
    };
    const porPiso = sp.agrupar === 'piso';
    const grupos = porPiso
      ? ['PB', 'P1', 'P2', 'P3', ''].map((p) => ({ titulo: p ? etiquetaPiso(p) : 'Sin aula', lista: pend.filter((a) => (aulaDe(a)?.aula.piso ?? '') === p) }))
      : PRIORIDADES.map((p) => ({ titulo: PRIORIDAD_LABEL[p], lista: pend.filter((a) => a.prioridad === p) }));
    const ordenar = (l: ArregloInv[]) =>
      [...l].sort(
        (a, b) =>
          (porPiso ? PRIORIDAD_PESO[a.prioridad as Prioridad] - PRIORIDAD_PESO[b.prioridad as Prioridad] : 0) ||
          (aulaDe(a)?.aula.orden ?? 999) - (aulaDe(b)?.aula.orden ?? 999),
      );
    return (
      <Hoja titulo={`Arreglos pendientes${area ? ` · ${AREA_LABEL[area]}` : ''}`} subtitulo={`${fecha} · ${pend.length} pendientes`} volver="/gestion/inventario/arreglos">
        {grupos
          .filter((g) => g.lista.length)
          .map((g) => (
            <section key={g.titulo} className="break-inside-avoid-page space-y-1">
              <h2 className="text-sm font-bold uppercase">
                {g.titulo} · {g.lista.length}
              </h2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={`${TH} w-8`}>✓</th>
                    <th className={TH}>Dónde</th>
                    <th className={TH}>Qué hay que hacer</th>
                    <th className={TH}>{porPiso ? 'Prioridad' : 'De qué'}</th>
                    <th className={TH}>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenar(g.lista).map((a) => (
                    <tr key={a.id} className="break-inside-avoid">
                      <td className={`${TD} text-center text-base`}>☐</td>
                      <td className={`${TD} whitespace-nowrap`}>{donde(a)}</td>
                      <td className={TD}>{a.texto}</td>
                      <td className={TD}>{porPiso ? PRIORIDAD_LABEL[a.prioridad as Prioridad] : AREA_LABEL[a.area as Area]}</td>
                      <td className={HUECO} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
      </Hoja>
    );
  }

  if (informe === 'robotica') {
    return (
      <Hoja titulo="Inventario de robótica" subtitulo={`${fecha} · material pedido y kits numerados`} volver="/gestion/inventario/robotica">
        {CATEGORIAS_ROB.map((c) => {
          const modelos = inv.modelos.filter((m) => m.categoria === c && ((m.pedidas ?? 0) > 0 || inv.kits.some((k) => k.modeloId === m.id)));
          if (!modelos.length) return null;
          return (
            <section key={c} className="space-y-1">
              <h2 className="text-sm font-bold uppercase">{CATEGORIA_ROB_LABEL[c]}</h2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {['Material', 'Pedidas', 'Llegadas', 'Kits (dónde · estado)', 'Revisado'].map((h) => (
                      <th key={h} className={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modelos.map((m) => {
                    const ks = inv.kits.filter((k) => k.modeloId === m.id);
                    return (
                      <tr key={m.id} className="break-inside-avoid">
                        <td className={`${TD} font-semibold`}>{m.nombre}</td>
                        <td className={`${TD} text-right`}>{m.pedidas ?? ''}</td>
                        <td className={`${TD} text-right`}>{ks.length}</td>
                        <td className={TD}>
                          {ks
                            .map((k) => {
                              const f = k.aulaId ? aulas.get(k.aulaId) : null;
                              return `${k.codigo}${f ? ` (${f.aula.nombre ?? f.aula.numero})` : ''}${k.estado !== 'ok' ? ` · ${ESTADO_KIT_LABEL[k.estado as EstadoKit]}` : ''}`;
                            })
                            .join(', ')}
                        </td>
                        <td className={`${HUECO} min-w-16`} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </Hoja>
    );
  }

  if (informe === 'aula') {
    const f = sp.id ? aulas.get(sp.id) : null;
    if (!f) notFound();
    return (
      <Hoja titulo={`${f.nombre}${f.cartel && !f.aula.nombre ? ` · ${f.cartel}` : ''}`} subtitulo={`${fecha} · ${etiquetaPiso(f.aula.piso)}`} volver={`/gestion/inventario/aulas/${f.aula.id}`}>
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">Tutor/a</dt>
          <dd>{f.tutores.join(' y ') || '—'}</dd>
          <dt className="font-semibold">Alumnos</dt>
          <dd>{f.alumnos ?? '—'}</dd>
          <dt className="font-semibold">Pantalla</dt>
          <dd>{[f.av?.pantalla ? PANTALLA_LABEL[f.av.pantalla as Pantalla] : null, f.av?.marca].filter(Boolean).join(' · ') || '—'}</dd>
          <dt className="font-semibold">Audio</dt>
          <dd>{f.av?.audio ? AUDIO_LABEL[f.av.audio as Audio] : '—'}</dd>
          <dt className="font-semibold">Apple TV</dt>
          <dd>{f.av ? (f.av.appleTv ? 'Sí' : 'No') : '—'}</dd>
          <dt className="font-semibold">Valoración</dt>
          <dd>{f.av?.valoracion ?? '–'}/5 · {f.av ? ACCION_AV_LABEL[f.av.accion as AccionAv] : ''}</dd>
          <dt className="font-semibold">Mesas y sillas</dt>
          <dd>
            {f.mob?.sillas ?? '—'} sillas · {f.mob?.mesas ?? '—'} mesas {f.mob?.notas ? `· ${f.mob.notas}` : ''}
          </dd>
          <dt className="font-semibold">Antena</dt>
          <dd>{f.antenas.map((a) => (antenaPorRenombrar(a) ? `${a.nombreActual} → ${a.nombreNuevo}` : a.nombreActual)).join(', ') || '—'}</dd>
          <dt className="font-semibold">Robótica</dt>
          <dd>{f.kits.map((k) => k.codigo).join(', ') || '—'}</dd>
        </dl>
        {f.av?.notas && <p className="text-sm whitespace-pre-line">Notas: {f.av.notas}</p>}
        <h2 className="pt-2 text-sm font-bold uppercase">Arreglos pendientes</h2>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {f.pendientes.map((a) => (
              <tr key={a.id}>
                <td className={`${TD} w-8 text-center text-base`}>☐</td>
                <td className={TD}>{a.texto}</td>
                <td className={TD}>{PRIORIDAD_LABEL[a.prioridad as Prioridad]}</td>
                <td className={HUECO} />
              </tr>
            ))}
            {[0, 1, 2, 3].map((i) => (
              <tr key={`v${i}`}>
                <td className={`${TD} w-8 text-center text-base`}>☐</td>
                <td className={`${TD} h-7`} />
                <td className={TD} />
                <td className={HUECO} />
              </tr>
            ))}
          </tbody>
        </table>
      </Hoja>
    );
  }

  // Por defecto: todas las aulas en una hoja.
  return (
    <Hoja titulo="Aulas del colegio" subtitulo={fecha} volver="/gestion/inventario" apaisado>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {['Aula', 'Piso', 'Clase', 'Tutor/a', 'Alum.', 'Pantalla', 'Nota', 'Sillas', 'Mesas', 'Antena', 'Arreglos'].map((h) => (
              <th key={h} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.aula.id} className="break-inside-avoid">
              <td className={`${TD} font-bold`}>{f.aula.numero ?? ''}</td>
              <td className={TD}>{f.aula.piso}</td>
              <td className={TD}>{f.aula.nombre ?? f.cartel}</td>
              <td className={TD}>{f.tutores.join(', ')}</td>
              <td className={`${TD} text-right`}>{f.alumnos ?? ''}</td>
              <td className={TD}>{[f.av?.pantalla ? PANTALLA_LABEL[f.av.pantalla as Pantalla] : null, f.av?.marca].filter(Boolean).join(' ')}</td>
              <td className={TD}>{f.av ? `${f.av.valoracion ?? '–'}/5` : ''}</td>
              <td className={`${TD} text-right`}>{f.mob?.sillas ?? ''}</td>
              <td className={`${TD} text-right`}>{f.mob?.mesas ?? ''}</td>
              <td className={`${TD} font-mono`}>{f.antenas.map((a) => a.nombreActual).join(', ')}</td>
              <td className={TD}>{f.pendientes.length ? `${f.pendientes.length}${f.urgentes ? ` (${f.urgentes} urg.)` : ''}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Hoja>
  );
}
