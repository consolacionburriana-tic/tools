'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, BookOpen, Check, ChevronDown, ChevronLeft, Loader2, NotebookPen, Plus, Printer, Users, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ETAPA_LABEL, ETAPAS, type Etapa } from '@/lib/cursos';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Aviso } from '@/components/ui/aviso';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Segmentado } from '@/components/ui/segmentado';
import { Interruptor } from '@/components/ui/interruptor';
import { Progreso } from '@/components/ui/progreso';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta, TarjetaCabecera, claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Etiqueta } from '@/components/ui/etiqueta';
import { ConfirmarDialogo } from '@/components/ui/confirmar';

interface ClaseOpt {
  curso: string;
  letra: string | null;
  label: string;
  etapa: Etapa | null;
}
interface ResumenClase {
  curso: string;
  letra: string | null;
  total: number;
  banco: number;
  ampa: number;
}

function claseKey(curso: string, letra: string | null): string {
  return `${curso}|${letra ?? ''}`;
}

const ETAPA_ORDEN = ETAPAS;
interface AlumnoRow {
  eduStudentId: string;
  nombre: string;
  numeroLista: number;
  banco: boolean;
  ampa: boolean;
  asignacionId: string | null;
  lote: number | null;
  entregado: boolean;
  docInicio: boolean;
  docFin: boolean;
}
interface LibroCard {
  cod: string;
  nombre: string;
  asignatura: string | null;
  valorados: number;
  total: number;
}
interface LibroManual {
  id: string;
  asignatura: string | null;
  nombre: string;
  activo: boolean;
}
interface FilaLista {
  asignacionId: string;
  numeroLista: number;
  lote: number;
  alumno: string;
  estado: string | null;
  borrado: boolean;
  forrado: boolean;
  notas: string | null;
}

// Estado de conservación del libro, de mejor a peor: el color es el de los estados de la app
// (azul nuevo, verde bien, ámbar regular, rojo mal) y el texto lo dice siempre.
const ESTADOS: { valor: string; label: string; activo: string }[] = [
  { valor: 'nuevo', label: 'Nuevo', activo: 'bg-blue-600 text-white' },
  { valor: 'mb', label: 'MB', activo: 'bg-emerald-700 text-white' },
  { valor: 'b', label: 'B', activo: 'bg-emerald-500 text-white dark:bg-emerald-600' },
  { valor: 'r', label: 'R', activo: 'bg-amber-500 text-zinc-950' },
  { valor: 'm', label: 'M', activo: 'bg-red-600 text-white' },
  { valor: 'mojado', label: 'Moj', activo: 'bg-red-800 text-white' },
];

/** Sí/no de una fila (entregado, borrado…): dice su estado con el texto y el tachado. */
function Toggle({ activo, onTap, label }: { activo: boolean; onTap: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onTap}
      className={cn(
        'inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        activo
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-400',
      )}
    >
      {activo && <Check aria-hidden className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

type Masivo =
  | { tipo: 'check'; campo: 'entregado' | 'docInicio' | 'docFin' }
  | { tipo: 'registro'; campos: { estado?: string; borrado?: boolean; forrado?: boolean } };

const TEXTO_CHECK = { entregado: 'el lote entregado', docInicio: 'el documento de inicio', docFin: 'el documento de fin' };

export function BancoPanel({
  clases,
  resumenInicial,
  fueraDeCampania,
  puedeGestionarParticipantes,
  curso,
}: {
  clases: ClaseOpt[];
  resumenInicial: ResumenClase[];
  /** Alumnado activo de cursos con Licencias que aún no está en la campaña vigente: hasta que
   *  se sincronice, su familia teclea el NIA en el formulario público y no lo encuentra. */
  fueraDeCampania: { nombre: string; curso: string; letra: string | null }[];
  /** Marcar banco sí-no es cosa de dirección/TIC (de momento, no tutores). El AMPA ya no vive
   *  aquí: desde el 23-sep-2026 solo se lleva desde Alumnado (pestaña «AMPA»). El resto del
   *  módulo (lotes, checks, pasar lista) sigue abierto a cualquier rol con acceso. */
  puedeGestionarParticipantes: boolean;
  /** El curso académico de la campaña («2026-27»), para el resumen. */
  curso?: string;
}) {
  const [clase, setClase] = useState<ClaseOpt | null>(null);
  const [tab, setTab] = useState<'alumnado' | 'libros'>('alumnado');
  const [alumnado, setAlumnado] = useState<AlumnoRow[] | null>(null);
  const [libros, setLibros] = useState<LibroCard[] | null>(null);
  const [libro, setLibro] = useState<LibroCard | null>(null);
  const [filas, setFilas] = useState<FilaLista[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [notasAbiertas, setNotasAbiertas] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenClase[]>(resumenInicial);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const [librosManuales, setLibrosManuales] = useState<LibroManual[] | null>(null);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [nuevoManual, setNuevoManual] = useState({ asignatura: '', nombre: '' });
  const [guardandoManual, setGuardandoManual] = useState(false);
  /** Marcar a toda la clase de golpe: se pregunta antes, diciendo a cuántos. */
  const [masivo, setMasivo] = useState<Masivo | null>(null);
  /** Valor del campo "lote" al entrar en el input: el onChange ya deja `a.lote` igual al
   *  tecleado, así que en el onBlur no sirve comparar contra el estado (siempre coincidiría
   *  y nunca se guardaría). Se compara contra esto. */
  const loteAlEnfocar = useRef(new Map<string, number | null>());

  const resumenMap = useMemo(() => new Map(resumen.map((r) => [claseKey(r.curso, r.letra), r])), [resumen]);

  /** Ajusta en local el contador agregado de la clase activa (sin esperar a refrescar). */
  const bumpResumen = useCallback(
    (campo: 'banco', delta: 1 | -1) => {
      if (!clase) return;
      const key = claseKey(clase.curso, clase.letra);
      setResumen((prev) => prev.map((r) => (claseKey(r.curso, r.letra) === key ? { ...r, [campo]: Math.max(0, r[campo] + delta) } : r)));
    },
    [clase],
  );

  const qs = useCallback(
    (extra = '') => `curso=${encodeURIComponent(clase!.curso)}&letra=${encodeURIComponent(clase!.letra ?? '')}${extra}`,
    [clase],
  );

  // Cargas por pestaña
  useEffect(() => {
    if (!clase) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setAlumnado(null);
      setLibros(null);
      setLibro(null);
      setLibrosManuales(null);
      setManualAbierto(false);
      try {
        const [rc, rl] = await Promise.all([
          fetch(`/api/bancolibros/admin/clase?${qs()}`),
          fetch(`/api/bancolibros/admin/libros?${qs()}`),
        ]);
        const [dc, dl] = await Promise.all([rc.json(), rl.json()]);
        if (!vivo) return;
        setAlumnado(dc.alumnado ?? []);
        setLibros(dl.libros ?? []);
      } catch {
        if (!vivo) return;
        setAlumnado([]);
        setLibros([]);
      }
    }, 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [clase, qs]);

  useEffect(() => {
    if (!clase || !libro) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setFilas(null);
      try {
        const r = await fetch(`/api/bancolibros/admin/registros?${qs(`&cod=${encodeURIComponent(libro.cod)}`)}`);
        const d = await r.json();
        if (vivo) setFilas(d.filas ?? []);
      } catch {
        if (vivo) setFilas([]);
      }
    }, 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [clase, libro, qs]);

  useEffect(() => {
    if (!clase || !manualAbierto) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/bancolibros/admin/libros-manual?curso=${encodeURIComponent(clase.curso)}`);
        const d = await r.json();
        if (vivo) setLibrosManuales(d.libros ?? []);
      } catch {
        if (vivo) setLibrosManuales([]);
      }
    })();
    return () => { vivo = false; };
  }, [clase, manualAbierto]);

  async function post(url: string, body: unknown): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      haptic.tap();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
      return false;
    }
  }

  /**
   * Vuelve a traer del servidor lo que se ve, para usar cuando un guardado falla.
   * En los bulks no se puede revertir "a mano" (el estado anterior era distinto para cada
   * alumno), y dejar la pantalla pintada como si hubiera ido bien es lo peor que puede pasar
   * aquí: David marcaba una clase entera, se iba tranquilo, y al volver estaba como antes.
   */
  async function recargarAlumnado() {
    try {
      const r = await fetch(`/api/bancolibros/admin/clase?${qs()}`);
      setAlumnado((await r.json()).alumnado ?? []);
    } catch {
      /* si tampoco se puede leer, el toast del guardado ya avisó */
    }
    await recargarResumen();
  }

  async function recargarFilas() {
    if (!libro) return;
    try {
      const r = await fetch(`/api/bancolibros/admin/registros?${qs(`&cod=${encodeURIComponent(libro.cod)}`)}`);
      setFilas((await r.json()).filas ?? []);
    } catch {
      /* idem */
    }
  }

  async function recargarResumen() {
    try {
      const r = await fetch('/api/bancolibros/admin/resumen');
      const d = await r.json();
      if (Array.isArray(d.resumen)) setResumen(d.resumen);
    } catch {
      /* el resumen es informativo: si falla, se arregla al recargar la página */
    }
  }

  // ── Alumnado ──
  async function toggleBanco(a: AlumnoRow) {
    setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, banco: !a.banco } : x)));
    bumpResumen('banco', a.banco ? -1 : 1);
    if (!(await post('/api/bancolibros/admin/banco', { eduStudentId: a.eduStudentId, banco: !a.banco }))) {
      setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, banco: a.banco } : x)));
      bumpResumen('banco', a.banco ? 1 : -1);
    }
  }

  async function ponerLote(a: AlumnoRow, numero: number | 'auto' | null) {
    setOcupado(a.eduStudentId);
    try {
      const res = await fetch('/api/bancolibros/admin/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: clase!.curso, letra: clase!.letra, eduStudentId: a.eduStudentId, numero }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // recargar para obtener asignacionId nuevo
      const r2 = await fetch(`/api/bancolibros/admin/clase?${qs()}`);
      setAlumnado((await r2.json()).alumnado ?? []);
      haptic.tap();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
      haptic.warning();
    } finally {
      setOcupado(null);
    }
  }

  async function toggleCheck(a: AlumnoRow, campo: 'entregado' | 'docInicio' | 'docFin') {
    if (!a.asignacionId) return;
    const valor = !a[campo];
    setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, [campo]: valor } : x)));
    if (!(await post('/api/bancolibros/admin/checks', { asignacionIds: [a.asignacionId], campos: { [campo]: valor } }))) {
      setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, [campo]: !valor } : x)));
    }
  }

  async function bulkCheck(campo: 'entregado' | 'docInicio' | 'docFin') {
    const ids = alumnado!.filter((a) => a.asignacionId).map((a) => a.asignacionId!);
    if (!ids.length) return void toast.info('Nadie tiene lote asignado todavía');
    setAlumnado((prev) => prev!.map((x) => (x.asignacionId ? { ...x, [campo]: true } : x)));
    if (!(await post('/api/bancolibros/admin/checks', { asignacionIds: ids, campos: { [campo]: true } }))) {
      await recargarAlumnado();
    }
  }

  // ── Pasar lista de un libro ──
  async function setRegistro(f: FilaLista, campos: Partial<Pick<FilaLista, 'estado' | 'borrado' | 'forrado' | 'notas'>>) {
    const antes = { estado: f.estado, borrado: f.borrado, forrado: f.forrado, notas: f.notas };
    setFilas((prev) => prev!.map((x) => (x.asignacionId === f.asignacionId ? { ...x, ...campos } : x)));
    if (!(await post('/api/bancolibros/admin/registro', { asignacionIds: [f.asignacionId], bookCod: libro!.cod, campos }))) {
      setFilas((prev) => prev!.map((x) => (x.asignacionId === f.asignacionId ? { ...x, ...antes } : x)));
    }
  }

  async function bulkRegistro(campos: { estado?: string; borrado?: boolean; forrado?: boolean }) {
    const ids = filas!.map((f) => f.asignacionId);
    if (!ids.length) return;
    setFilas((prev) => prev!.map((x) => ({ ...x, ...campos })));
    if (!(await post('/api/bancolibros/admin/registro', { asignacionIds: ids, bookCod: libro!.cod, campos }))) {
      return void recargarFilas();
    }
    haptic.success();
  }

  // ── Libros manuales (dirección/TIC): catálogo a mano por curso, sin depender de Licencias ──
  async function refrescarLibros() {
    if (!clase) return;
    const r = await fetch(`/api/bancolibros/admin/libros?${qs()}`);
    setLibros((await r.json()).libros ?? []);
  }

  async function anadirLibroManual() {
    if (!clase || !nuevoManual.nombre.trim()) return;
    setGuardandoManual(true);
    try {
      const res = await fetch('/api/bancolibros/admin/libros-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso: clase.curso, asignatura: nuevoManual.asignatura.trim() || null, nombre: nuevoManual.nombre.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNuevoManual({ asignatura: '', nombre: '' });
      const r2 = await fetch(`/api/bancolibros/admin/libros-manual?curso=${encodeURIComponent(clase.curso)}`);
      setLibrosManuales((await r2.json()).libros ?? []);
      await refrescarLibros();
      haptic.success();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo añadir');
      haptic.warning();
    } finally {
      setGuardandoManual(false);
    }
  }

  async function toggleActivoManual(lm: LibroManual) {
    setLibrosManuales((prev) => prev!.map((x) => (x.id === lm.id ? { ...x, activo: !lm.activo } : x)));
    try {
      const res = await fetch('/api/bancolibros/admin/libros-manual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lm.id, campos: { activo: !lm.activo } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refrescarLibros();
      haptic.tap();
    } catch (e) {
      setLibrosManuales((prev) => prev!.map((x) => (x.id === lm.id ? { ...x, activo: lm.activo } : x)));
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      haptic.warning();
    }
  }

  const enBanco = useMemo(() => alumnado?.filter((a) => a.banco).length ?? 0, [alumnado]);

  // Cursos en el orden en que aparecen en `clases` (ya vienen por etapa → curso), para las
  // filas de subtotal del resumen agregado.
  const cursosOrden = useMemo(() => [...new Set(clases.map((c) => c.curso))], [clases]);
  const totalGeneral = useMemo(
    () => resumen.reduce((acc, r) => ({ total: acc.total + r.total, banco: acc.banco + r.banco }), { total: 0, banco: 0 }),
    [resumen],
  );

  const conLote = alumnado?.filter((a) => a.asignacionId).length ?? 0;
  const urlFicha = (modo: 'datos' | 'blanco') =>
    clase && libro
      ? `/gestion/bancolibros/ficha?curso=${encodeURIComponent(clase.curso)}&letra=${encodeURIComponent(clase.letra ?? '')}&cod=${encodeURIComponent(libro.cod)}&modo=${modo}`
      : '#';

  function pedirMasivo(m: Masivo) {
    if (m.tipo === 'check' && conLote === 0) return void toast.info('Nadie tiene lote asignado todavía');
    setMasivo(m);
  }

  const textoMasivo = (() => {
    if (!masivo || !clase) return null;
    if (masivo.tipo === 'check') {
      return {
        titulo: `¿Marcar ${TEXTO_CHECK[masivo.campo]} a ${conLote} ${conLote === 1 ? 'alumno' : 'alumnos'}?`,
        descripcion: `Se marca a todo el alumnado de ${clase.label} que tiene lote. Si a alguien no le toca, desmárcalo luego en su fila.`,
        boton: `Marcar a ${conLote}`,
      };
    }
    const n = filas?.length ?? 0;
    const que = masivo.campos.estado
      ? 'el estado MB (muy bien)'
      : masivo.campos.borrado
        ? 'el libro como borrado'
        : 'el libro como forrado';
    return {
      titulo: `¿Marcar ${que} a ${n} ${n === 1 ? 'alumno' : 'alumnos'}?`,
      descripcion: `Se cambia en ${libro?.asignatura ?? libro?.nombre ?? 'este libro'} para toda la clase, también a quien ya tenía otro valor. Las excepciones se tocan luego en su fila.`,
      boton: `Marcar a ${n}`,
    };
  })();

  // ── Render ──
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Banco de libros{curso ? `, curso ${curso}` : ''}</h1>

      {/* Aviso de descuadre con Licencias: alumnos que están en la BBDD central pero no en la
          campaña, así que su familia no se puede identificar en el formulario público. */}
      {puedeGestionarParticipantes && fueraDeCampania.length > 0 && (
        <Aviso tono="aviso">
          <details>
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <strong>
                {fueraDeCampania.length} {fueraDeCampania.length === 1 ? 'alumno' : 'alumnos'}
              </strong>{' '}
              {fueraDeCampania.length === 1 ? 'está' : 'están'} en la BBDD central pero no en la campaña de
              Licencias: su familia teclea el NIA en el formulario y no lo encuentra.{' '}
              <Link href="/gestion/licencias/sincronizar" className="font-medium underline underline-offset-2">
                Sincronizar alumnado de Licencias
              </Link>
              . <span className="underline underline-offset-2">Ver quiénes</span>
            </summary>
            <ul className="mt-2 space-y-0.5">
              {fueraDeCampania.map((a) => (
                <li key={`${a.curso}|${a.letra ?? ''}|${a.nombre}`}>
                  {a.nombre} · {a.curso}
                  {a.letra ?? ''}
                </li>
              ))}
            </ul>
          </details>
        </Aviso>
      )}

      {/* Resumen agregado: cerrado enseña los totales de un vistazo, abierto el detalle x clase/curso */}
      <details
        className={cn(claseTarjeta, 'anim-up open:pb-1')}
        open={resumenAbierto}
        onToggle={(e) => setResumenAbierto((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <BarChart3 aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">Resumen</span>
          <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
            {totalGeneral.banco}/{totalGeneral.total} en banco
          </span>
          {curso && <Etiqueta className="ml-1">Curso {curso}</Etiqueta>}
          <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 text-zinc-400 transition-transform [details[open]_&]:rotate-180" />
        </summary>
        <div className="overflow-x-auto border-t border-zinc-100 px-1 dark:border-zinc-800">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Clase</th>
                <th className="px-3 py-2 text-right font-medium">Alumnos</th>
                <th className="px-3 py-2 text-right font-medium">Banco</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {cursosOrden.map((curso) => {
                const filas = clases.filter((c) => c.curso === curso);
                const sub = filas.reduce(
                  (acc, c) => {
                    const r = resumenMap.get(claseKey(c.curso, c.letra));
                    return { total: acc.total + (r?.total ?? 0), banco: acc.banco + (r?.banco ?? 0) };
                  },
                  { total: 0, banco: 0 },
                );
                return (
                  <Fragment key={curso}>
                    <tr className="bg-zinc-50 font-semibold text-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-200">
                      <td className="px-3 py-1.5">{curso}</td>
                      <td className="px-3 py-1.5 text-right">{sub.total}</td>
                      <td className="px-3 py-1.5 text-right">{sub.banco}</td>
                    </tr>
                    {filas.map((c) => {
                      const r = resumenMap.get(claseKey(c.curso, c.letra));
                      return (
                        <tr key={c.label} className="text-zinc-600 dark:text-zinc-400">
                          <td className="py-1.5 pr-3 pl-7">{c.label}</td>
                          <td className="px-3 py-1.5 text-right">{r?.total ?? 0}</td>
                          <td className="px-3 py-1.5 text-right">{r?.banco ?? 0}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {/* Selector de clase, agrupado por etapa (primaria → secundaria) */}
      <div className="anim-up space-y-3">
        {ETAPA_ORDEN.filter((et) => clases.some((c) => c.etapa === et)).map((et) => (
          <div key={et}>
            <Rotulo as="h2" className="mb-1.5">
              {ETAPA_LABEL[et]}
            </Rotulo>
            <Filtros etiqueta={`Clases de ${ETAPA_LABEL[et]}`}>
              {clases
                .filter((c) => c.etapa === et)
                .map((c) => {
                  const r = resumenMap.get(claseKey(c.curso, c.letra));
                  return (
                    <Filtro key={c.label} activo={clase?.label === c.label} onClick={() => setClase(c)}>
                      {c.label}
                      {r && (
                        <span className="font-mono text-xs tabular-nums opacity-70">
                          {r.banco}/{r.total}
                        </span>
                      )}
                    </Filtro>
                  );
                })}
            </Filtros>
          </div>
        ))}
      </div>

      {!clase && <Vacio titulo="Elige una clase para empezar">Verás su alumnado, los lotes y los libros que valorar.</Vacio>}

      {clase && !libro && (
        <>
          <Segmentado
            etiqueta="Ver"
            valor={tab}
            onChange={setTab}
            opciones={[
              {
                valor: 'alumnado',
                etiqueta: `Alumnado${alumnado ? ` · ${enBanco}/${alumnado.length} en banco` : ''}`,
                icono: <Users aria-hidden />,
              },
              { valor: 'libros', etiqueta: 'Libros', icono: <BookOpen aria-hidden />, cuenta: libros?.length },
            ]}
          />

          {/* ── Pestaña Alumnado ── */}
          {tab === 'alumnado' && (
            <Tarjeta className="anim-up">
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800">
                <span className="mr-1 text-sm text-zinc-500 dark:text-zinc-400">Marcar a toda la clase:</span>
                <Button variant="outline" size="sm" onClick={() => pedirMasivo({ tipo: 'check', campo: 'entregado' })}>
                  <Check aria-hidden /> Lote entregado
                </Button>
                <Button variant="outline" size="sm" onClick={() => pedirMasivo({ tipo: 'check', campo: 'docInicio' })}>
                  <Check aria-hidden /> Doc. inicio
                </Button>
                <Button variant="outline" size="sm" onClick={() => pedirMasivo({ tipo: 'check', campo: 'docFin' })}>
                  <Check aria-hidden /> Doc. fin
                </Button>
              </div>
              {!puedeGestionarParticipantes && (
                <p className="border-b border-zinc-100 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Solo dirección y TIC pueden cambiar quién está en el banco.
                </p>
              )}
              {alumnado === null ? (
                <p className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : alumnado.length === 0 ? (
                <p className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Esta clase no tiene alumnado.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {alumnado.map((a) => (
                    <li key={a.eduStudentId} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                      {puedeGestionarParticipantes ? (
                        <Interruptor
                          etiquetaOculta
                          activo={a.banco}
                          onChange={() => void toggleBanco(a)}
                          etiqueta={`${a.nombre} en el banco`}
                        />
                      ) : (
                        <span className="w-11 shrink-0 text-center">
                          <span className="sr-only">{a.banco ? 'En el banco' : 'Fuera del banco'}</span>
                          <span
                            aria-hidden
                            className={cn('inline-block h-2.5 w-2.5 rounded-full', a.banco ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600')}
                          />
                        </span>
                      )}
                      <span className="w-6 shrink-0 text-right text-xs font-bold text-zinc-500 tabular-nums dark:text-zinc-400">
                        {a.numeroLista}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm font-medium',
                          a.banco ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400',
                        )}
                      >
                        {a.nombre}
                      </span>
                      {a.banco && (
                        <>
                          <span className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              value={a.lote ?? ''}
                              placeholder="lote"
                              aria-label={`Lote de ${a.nombre}`}
                              onFocus={() => {
                                if (!loteAlEnfocar.current.has(a.eduStudentId)) loteAlEnfocar.current.set(a.eduStudentId, a.lote);
                              }}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAlumnado((prev) => prev!.map((x) => (x.eduStudentId === a.eduStudentId ? { ...x, lote: v ? Number(v) : null } : x)));
                              }}
                              onBlur={(e) => {
                                const v = e.target.value ? Number(e.target.value) : null;
                                const antes = loteAlEnfocar.current.get(a.eduStudentId) ?? a.lote;
                                loteAlEnfocar.current.delete(a.eduStudentId);
                                if (v !== antes) void ponerLote(a, v);
                              }}
                              className="h-10 w-20 px-2 text-center tabular-nums"
                            />
                            {!a.lote && (
                              <Button
                                variant="outline"
                                size="sm"
                                cargando={ocupado === a.eduStudentId}
                                onClick={() => void ponerLote(a, 'auto')}
                                aria-label={`Dar a ${a.nombre} el siguiente lote libre`}
                                className="px-2.5"
                              >
                                {ocupado !== a.eduStudentId && <Wand2 aria-hidden />}
                                Siguiente
                              </Button>
                            )}
                          </span>
                          {a.asignacionId && (
                            <span className="flex gap-1">
                              <Toggle activo={a.entregado} onTap={() => void toggleCheck(a, 'entregado')} label="Entregado" />
                              <Toggle activo={a.docInicio} onTap={() => void toggleCheck(a, 'docInicio')} label="Doc ini" />
                              <Toggle activo={a.docFin} onTap={() => void toggleCheck(a, 'docFin')} label="Doc fin" />
                            </span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          )}

          {/* ── Pestaña Libros ── */}
          {tab === 'libros' && (
            <div className="anim-stagger grid gap-3 sm:grid-cols-2">
              {puedeGestionarParticipantes && (
                <details
                  className="rounded-2xl border border-dashed border-zinc-300 bg-white text-sm sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900"
                  open={manualAbierto}
                  onToggle={(e) => setManualAbierto((e.target as HTMLDetailsElement).open)}
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-2.5 font-medium text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
                    Configurar libros a mano de {clase.curso}
                    <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 text-zinc-400 transition-transform [details[open]_&]:rotate-180" />
                  </summary>
                  <div className="space-y-3 px-4 pb-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Para cuando el catálogo de Licencias no esté listo, o una asignatura tenga varios libros. Se
                      guardan solo en este módulo.{' '}
                      <Link
                        href="/gestion/bancolibros/sincronizar"
                        className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-400"
                      >
                        Importar desde el Excel de libros
                      </Link>{' '}
                      en vez de teclearlos uno a uno.
                    </p>
                    {librosManuales === null ? (
                      <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Cargando…
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {librosManuales.length === 0 && (
                          <li className="text-sm text-zinc-500 dark:text-zinc-400">Ningún libro manual todavía.</li>
                        )}
                        {librosManuales.map((lm) => (
                          <li key={lm.id} className="flex items-center gap-2 text-sm">
                            <Toggle activo={lm.activo} onTap={() => void toggleActivoManual(lm)} label={lm.activo ? 'Activo' : 'Inactivo'} />
                            <span className="text-zinc-700 dark:text-zinc-300">
                              {lm.asignatura ? `${lm.asignatura} · ` : ''}
                              {lm.nombre}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Input
                        value={nuevoManual.asignatura}
                        onChange={(e) => setNuevoManual((s) => ({ ...s, asignatura: e.target.value }))}
                        placeholder="Asignatura (opcional)"
                        aria-label="Asignatura (opcional)"
                        className="w-44"
                      />
                      <Input
                        value={nuevoManual.nombre}
                        onChange={(e) => setNuevoManual((s) => ({ ...s, nombre: e.target.value }))}
                        placeholder="Nombre del libro"
                        aria-label="Nombre del libro"
                        className="w-auto min-w-40 flex-1"
                      />
                      <Button
                        cargando={guardandoManual}
                        disabled={!nuevoManual.nombre.trim()}
                        onClick={() => void anadirLibroManual()}
                      >
                        {!guardandoManual && <Plus aria-hidden />}
                        Añadir libro
                      </Button>
                    </div>
                  </div>
                </details>
              )}
              {libros === null ? (
                <p className="flex items-center gap-2 p-6 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Cargando…
                </p>
              ) : libros.length === 0 ? (
                <Vacio titulo={`No hay libros del banco para ${clase.curso}`} className="sm:col-span-2">
                  No están en el catálogo de Licencias{puedeGestionarParticipantes ? ': añade uno a mano arriba.' : '.'}
                </Vacio>
              ) : (
                libros.map((b) => (
                  <button
                    key={b.cod}
                    type="button"
                    onClick={() => setLibro(b)}
                    className={cn(
                      claseTarjeta,
                      'p-4 text-left transition-colors outline-none hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:border-zinc-700',
                    )}
                  >
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{b.asignatura ?? b.nombre}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {b.nombre} · {b.cod}
                    </span>
                    <Progreso hechos={b.valorados} total={b.total} etiqueta={`Valorados de ${b.nombre}`} className="mt-3" />
                    <span className="mt-1 block text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                      {b.valorados}/{b.total} valorados{b.total > 0 && b.valorados >= b.total && ' · completo'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ── Pasar lista de un libro ── */}
      {clase && libro && (
        <div className="anim-up space-y-3">
          <Button variant="ghost" size="sm" className="-ml-3 px-3 text-zinc-600 dark:text-zinc-400" onClick={() => setLibro(null)}>
            <ChevronLeft aria-hidden /> Libros de {clase.label}
          </Button>
          <Tarjeta>
            <TarjetaCabecera
              titulo={libro.asignatura ?? libro.nombre}
              descripcion={`${libro.nombre} · ${clase.label} · registro de valoración`}
              accion={
                <>
                  <a href={urlFicha('datos')} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Printer aria-hidden /> Ficha con datos
                  </a>
                  <a href={urlFicha('blanco')} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <Printer aria-hidden /> En blanco
                  </a>
                </>
              }
            />
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <span className="mr-1 text-sm text-zinc-500 dark:text-zinc-400">Toda la clase:</span>
              <Button variant="outline" size="sm" disabled={!filas?.length} onClick={() => pedirMasivo({ tipo: 'registro', campos: { estado: 'mb' } })}>
                Todos MB
              </Button>
              <Button variant="outline" size="sm" disabled={!filas?.length} onClick={() => pedirMasivo({ tipo: 'registro', campos: { borrado: true } })}>
                Todos borrados
              </Button>
              <Button variant="outline" size="sm" disabled={!filas?.length} onClick={() => pedirMasivo({ tipo: 'registro', campos: { forrado: true } })}>
                Todos forrados
              </Button>
            </div>
            {filas === null ? (
              <p className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            ) : filas.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nadie tiene lote asignado en {clase.label} este curso. Asigna lotes en la vista Alumnado.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filas.map((f) => (
                  <li key={f.asignacionId} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs font-bold text-zinc-600 tabular-nums dark:bg-zinc-800 dark:text-zinc-300">
                        {f.numeroLista}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="block truncate">{f.alumno}</span>
                        <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          lote {f.lote}
                          {f.notas && notasAbiertas !== f.asignacionId ? ` · ${f.notas}` : ''}
                        </span>
                      </span>
                      <span className="flex gap-1" role="group" aria-label={`Estado del libro de ${f.alumno}`}>
                        {ESTADOS.map((e) => (
                          <button
                            key={e.valor}
                            type="button"
                            aria-pressed={f.estado === e.valor}
                            onClick={() => void setRegistro(f, { estado: f.estado === e.valor ? null : e.valor })}
                            className={cn(
                              'h-10 min-w-10 rounded-xl px-2 text-xs font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                              f.estado === e.valor
                                ? e.activo
                                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                            )}
                          >
                            {e.label}
                          </button>
                        ))}
                      </span>
                      <span className="flex gap-1">
                        <Toggle activo={f.borrado} onTap={() => void setRegistro(f, { borrado: !f.borrado })} label="Borrado" />
                        <Toggle activo={f.forrado} onTap={() => void setRegistro(f, { forrado: !f.forrado })} label="Forrado" />
                      </span>
                      <Button
                        variant={f.notas ? 'outline' : 'ghost'}
                        size="icon-sm"
                        aria-label={f.notas ? `Editar la nota de ${f.alumno}` : `Añadir una nota a ${f.alumno}`}
                        aria-expanded={notasAbiertas === f.asignacionId}
                        onClick={() => setNotasAbiertas(notasAbiertas === f.asignacionId ? null : f.asignacionId)}
                      >
                        <NotebookPen aria-hidden />
                      </Button>
                    </div>
                    {notasAbiertas === f.asignacionId && (
                      <Input
                        autoFocus
                        defaultValue={f.notas ?? ''}
                        placeholder="Nota (ej. «le faltan las páginas 12-14»)"
                        aria-label={`Nota de ${f.alumno}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== f.notas) void setRegistro(f, { notas: v });
                          setNotasAbiertas(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className="mt-2"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Todo se guarda al toque. Borrado y forrado vienen marcados por defecto: toca solo las excepciones.
            </p>
          </Tarjeta>
        </div>
      )}

      {textoMasivo && (
        <ConfirmarDialogo
          abierto
          peligro={false}
          onCerrar={() => setMasivo(null)}
          titulo={textoMasivo.titulo}
          descripcion={textoMasivo.descripcion}
          boton={textoMasivo.boton}
          onConfirmar={async () => {
            const m = masivo!;
            if (m.tipo === 'check') await bulkCheck(m.campo);
            else await bulkRegistro(m.campos);
          }}
        />
      )}
    </div>
  );
}
