'use client';

// Clases de cada aula: qué clase va detrás de cada puerta en un curso. Al empezar el curso se
// cambian los carteles y aquí se apunta; sale ya rellenado con una propuesta (la clase que tendrá
// su tutor/a, o la regla de cada etapa) que solo hay que repasar y guardar.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  cartelClase,
  claveClase,
  clasesRepetidas,
  cursoAnterior,
  cursoPosterior,
  deClave,
  ordenarClaves,
  sugerirOcupacion,
  type ClaseEnAula,
  type Sugerencia,
} from '@/lib/inventario';
import { cursoSiguiente } from '@/lib/cursos';
import type { Inventario } from '@/lib/inventario-server';
import { guardarOcupacion } from '@/app/gestion/inventario/acciones';
import { Button } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { Input } from '@/components/ui/input';
import { Estado } from '@/components/ui/estado';
import { Aviso } from '@/components/ui/aviso';
import { Tarjeta } from '@/components/ui/tarjeta';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { useAccion, useIndice } from './comun';

/** Lo que hay elegido en una fila: una clase ('c:3PRI|B'), otra cosa (texto) o vacía. */
interface Eleccion {
  valor: string; // '' | 'c:<clave>' | 'otra'
  etiqueta: string;
}

const FUENTE: Record<Sugerencia['fuente'], { texto: string; tono: 'ok' | 'info' | 'aviso' | 'neutro' }> = {
  tutor: { texto: 'Sigue su tutor/a', tono: 'ok' },
  regla: { texto: 'Por ciclo', tono: 'info' },
  revisar: { texto: 'Revisar', tono: 'aviso' },
  mantener: { texto: 'Igual', tono: 'neutro' },
};

export function AjusteClases({ inv, curso, opciones }: { inv: Inventario; curso: string; opciones: string[] }) {
  const router = useRouter();
  const filas = useIndice(inv);
  const origen = cursoAnterior(curso);
  const { correr, ocupado } = useAccion();

  const delCurso = (year: string) => new Map(inv.ocupacion.filter((o) => o.academicYear === year).map((o) => [o.aulaId, o]));
  const ocupOrigen = delCurso(origen);
  const ocupDestino = delCurso(curso);
  const yaHecho = ocupDestino.size > 0;

  const tutorias = inv.tutorias;
  const nombres = new Map(tutorias.map((t) => [t.profeId, t.nombre]));
  const sugerencias = sugerirOcupacion(
    filas.map((f) => {
      const o = ocupOrigen.get(f.aula.id);
      return {
        id: f.aula.id,
        actual: o ? { curso: o.curso, letra: o.letra, etiqueta: o.etiqueta } : null,
      };
    }),
    (c) => tutorias.filter((t) => t.academicYear === origen && t.curso === c.curso && (t.letra ?? null) === (c.letra ?? null)).map((t) => t.profeId),
    (profe) => tutorias.filter((t) => t.academicYear === curso && t.profeId === profe).map((t) => ({ curso: t.curso, letra: t.letra })),
    (profe) => nombres.get(profe) ?? '',
  );
  const sugerenciaDe = new Map(sugerencias.map((s) => [s.aulaId, s]));

  const deSugerencia = (s: Sugerencia | undefined): Eleccion =>
    s?.clase
      ? { valor: `c:${claveClase(s.clase.curso, s.clase.letra)}`, etiqueta: '' }
      : s?.etiqueta
        ? { valor: 'otra', etiqueta: s.etiqueta }
        : { valor: '', etiqueta: '' };

  const inicial = (): Record<string, Eleccion> =>
    Object.fromEntries(
      filas.map((f) => {
        const o = ocupDestino.get(f.aula.id);
        if (yaHecho) {
          const e: Eleccion = o?.curso
            ? { valor: `c:${claveClase(o.curso, o.letra)}`, etiqueta: '' }
            : o?.etiqueta
              ? { valor: 'otra', etiqueta: o.etiqueta }
              : { valor: '', etiqueta: '' };
          return [f.aula.id, e];
        }
        return [f.aula.id, deSugerencia(sugerenciaDe.get(f.aula.id))];
      }),
    );
  const [guardado] = useState<Record<string, Eleccion>>(inicial);
  const [eleccion, setEleccion] = useState<Record<string, Eleccion>>(guardado);

  // Las clases que se pueden elegir: las de este curso en Educamos, a dónde promocionan, las
  // tutorías del curso elegido y lo que ya hubiera apuntado.
  const claves = (() => {
    const set = new Set<string>(opciones);
    for (const t of inv.tutorias) if (t.academicYear === curso) set.add(claveClase(t.curso, t.letra));
    for (const o of inv.ocupacion) if (o.curso && (o.academicYear === curso || o.academicYear === origen)) set.add(claveClase(o.curso, o.letra));
    for (const k of [...set]) {
      const { curso: c, letra } = deClave(k);
      const sig = cursoSiguiente(c);
      if (sig) set.add(claveClase(sig, letra));
    }
    return ordenarClaves(set);
  })();

  const reparto = filas.map((f) => {
    const e = eleccion[f.aula.id];
    const clase: ClaseEnAula | null = e?.valor.startsWith('c:') ? deClave(e.valor.slice(2)) : null;
    return {
      aulaId: f.aula.id,
      clase,
      etiqueta: e?.valor === 'otra' ? e.etiqueta : null,
    };
  });
  const repes = clasesRepetidas(reparto);
  const usadas = new Set(reparto.filter((r) => r.clase).map((r) => claveClase(r.clase!.curso, r.clase!.letra)));
  // Clases que existirán y no tienen aula: las de este curso en Educamos (si se ajusta el actual)
  // o las de las tutorías del curso elegido.
  const esperadas = new Set<string>(
    curso === inv.cursoActual ? opciones : inv.tutorias.filter((t) => t.academicYear === curso).map((t) => claveClase(t.curso, t.letra)),
  );
  const sinAula = ordenarClaves([...esperadas].filter((k) => !usadas.has(k)));

  const cambiar = (aulaId: string, e: Partial<Eleccion>) => setEleccion((x) => ({ ...x, [aulaId]: { ...x[aulaId], ...e } }));

  async function guardar() {
    const r = await correr(
      () =>
        guardarOcupacion({
          academicYear: curso,
          reparto: reparto.map((r) => ({
            aulaId: r.aulaId,
            curso: r.clase?.curso ?? null,
            letra: r.clase?.letra ?? null,
            etiqueta: r.etiqueta,
          })),
        }),
      `Clases de ${curso} guardadas`,
    );
    if (r !== false) router.push('/gestion/inventario');
  }

  const cursos = [...new Set([inv.cursoActual, cursoPosterior(inv.cursoActual), curso])].sort();

  return (
    <div className="space-y-5">
      <div>
        <EnlaceVolver href="/gestion/inventario">Todas las aulas</EnlaceVolver>
        <TituloPagina
          descripcion={
            yaHecho
              ? 'Ya está apuntado. Cambia lo que haga falta y guarda.'
              : `Viene relleno con lo que tocaría desde ${origen}: repásalo, cambia lo que no cuadre y guarda.`
          }
          acciones={
            <Segmentado
              etiqueta="Curso"
              opciones={cursos.map((c) => ({ valor: c, etiqueta: c }))}
              valor={curso}
              onChange={(c) => router.push(`/gestion/inventario/clases?curso=${c}`)}
            />
          }
        >
          Clases de cada aula · {curso}
        </TituloPagina>
      </div>

      {repes.size > 0 && (
        <Aviso tono="error" titulo="Hay clases en dos aulas">
          {ordenarClaves(repes)
            .map((k) => cartelClase(deClave(k).curso, deClave(k).letra))
            .join(', ')}
          . Cada clase solo puede estar en un aula.
        </Aviso>
      )}
      {sinAula.length > 0 && (
        <Aviso tono="aviso" titulo={sinAula.length === 1 ? 'Una clase sin aula' : `${sinAula.length} clases sin aula`}>
          {sinAula.map((k) => cartelClase(deClave(k).curso, deClave(k).letra)).join(', ')}
        </Aviso>
      )}

      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Aula
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {origen}
              </th>
              <th scope="col" className="w-6" />
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {curso}
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Por qué
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filas.map((f) => {
              const o = ocupOrigen.get(f.aula.id);
              const e = eleccion[f.aula.id] ?? { valor: '', etiqueta: '' };
              const s = sugerenciaDe.get(f.aula.id);
              const k = e.valor.startsWith('c:') ? e.valor.slice(2) : null;
              const repe = k !== null && repes.has(k);
              const comoSugerido = e.valor === deSugerencia(s).valor;
              const comoGuardado = yaHecho && e.valor === guardado[f.aula.id]?.valor;
              return (
                <tr key={f.aula.id} className={cn('align-middle', repe && 'bg-red-50 dark:bg-red-500/10')}>
                  <td className="px-3 py-2">
                    <span className="font-bold tabular-nums">{f.aula.numero ?? ''}</span>
                    {f.aula.nombre && <span className="ml-1.5 text-zinc-600 dark:text-zinc-400">{f.aula.nombre}</span>}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{o?.curso ? cartelClase(o.curso, o.letra) : (o?.etiqueta ?? '—')}</td>
                  <td>
                    <ArrowRight aria-hidden className="size-4 text-zinc-400" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-48 flex-col gap-1.5 sm:flex-row">
                      <Selector
                        aria-label={`Clase del aula ${f.aula.numero ?? f.aula.nombre} en ${curso}`}
                        value={e.valor}
                        onChange={(ev) => cambiar(f.aula.id, { valor: ev.target.value })}
                        aria-invalid={repe || undefined}
                      >
                        <option value="">{f.aula.nombre ? 'Sala (sin clase)' : 'Sin clase'}</option>
                        {claves.map((c) => (
                          <option key={c} value={`c:${c}`}>
                            {cartelClase(deClave(c).curso, deClave(c).letra)}
                          </option>
                        ))}
                        <option value="otra">Otra cosa…</option>
                      </Selector>
                      {e.valor === 'otra' && (
                        <Input
                          aria-label="Qué hay en el aula"
                          value={e.etiqueta}
                          onChange={(ev) => cambiar(f.aula.id, { etiqueta: ev.target.value })}
                          placeholder="Desdobles, apoyo…"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {s && comoSugerido && s.fuente !== 'mantener' ? (
                      <span className="flex flex-col gap-1">
                        <Estado tono={FUENTE[s.fuente].tono}>{FUENTE[s.fuente].texto}</Estado>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{s.motivo}</span>
                      </span>
                    ) : !comoSugerido && !comoGuardado ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Cambiado a mano</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Tarjeta>

      <BarraAcciones ancho="ancho" resumen={`${usadas.size} clases en ${filas.length} aulas y salas`}>
        <Button
          variant="outline"
          onClick={() => setEleccion(Object.fromEntries(filas.map((f) => [f.aula.id, deSugerencia(sugerenciaDe.get(f.aula.id))])))}
        >
          <RotateCcw aria-hidden /> <span className="sr-only sm:not-sr-only">Volver a la propuesta</span>
        </Button>
        <Button onClick={guardar} cargando={ocupado} disabled={repes.size > 0}>
          <Save aria-hidden /> Guardar {curso}
        </Button>
      </BarraAcciones>
    </div>
  );
}
