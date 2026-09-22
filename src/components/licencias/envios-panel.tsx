'use client';

// La pantalla de envío de licencias. El flujo real que sostiene: «me llega un Excel, filtro lo
// que me han mandado, pego los códigos, miro que cuadre y envío» — así que todo el filtrado y
// el orden pasan EN EL NAVEGADOR sobre las ~2.000 filas de la campaña, cargadas de una vez. Un
// viaje a Neon por cada clic de filtro haría de esto un formulario, y esto es una hoja de
// cálculo.
//
// Las de pago y las gratis del banco NO se mezclan nunca: llegan en Excel distintos, de
// editoriales distintas y por vías distintas (ver Fase 3 de la ficha). Por eso son dos
// pestañas con su propio recuento, no un filtro más.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  EyeOff,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { cursoLabel } from '@/lib/licencias';
import { ordenCurso } from '@/lib/cursos';
import {
  FILTROS_INICIALES,
  compararLicencias,
  filtrarLicencias,
  librosDe,
  ordenNatural,
  type CampoOrden,
  type Destino,
  type EstadoFiltro,
  type Filtros,
  type LicenciaFila,
  type ResumenLicencias,
  type TipoLicencia,
} from '@/lib/licencias-envios';
import { EnviosAsignar } from '@/components/licencias/envios-asignar';
import { EnviosEnviar } from '@/components/licencias/envios-enviar';
import { EnviosSobrantes } from '@/components/licencias/envios-sobrantes';

interface Preset {
  clave: string;
  nombre: string;
  subject: string;
  body: string;
}

interface EnvioRegistro {
  id: string;
  tipo: string;
  para: string;
  asunto: string;
  numLicencias: number;
  ok: boolean;
  error: string | null;
  enviadoAt: string;
  alumno: string;
}

type Vista = 'licencias' | 'sobrantes' | 'enviadas';

const ESTADOS: { valor: EstadoFiltro; label: string }[] = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'sin-codigo', label: 'Sin código (faltan por asignar)' },
  { valor: 'listas', label: 'Listas para enviar' },
  { valor: 'enviadas', label: 'Ya enviadas' },
  { valor: 'error', label: 'Con error de envío' },
  { valor: 'sin-correo', label: 'Sin correo de destino' },
  { valor: 'descartadas', label: 'Descartadas («no le toca»)' },
];

function fecha(d: string | null) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
}

function Kpi({ label, valor, nota, tono }: { label: string; valor: string; nota?: string; tono?: 'ok' | 'aviso' }) {
  const color =
    tono === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tono === 'aviso'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{valor}</p>
      {nota && <p className="text-[11px] text-zinc-400">{nota}</p>}
    </div>
  );
}

export function EnviosPanel({ presets }: { presets: Preset[] }) {
  const [filas, setFilas] = useState<LicenciaFila[]>([]);
  const [resumen, setResumen] = useState<Record<TipoLicencia, ResumenLicencias> | null>(null);
  // Arrancan en `true` porque al montar ya se está sincronizando: así el primer `cargar()` no
  // tiene que tocar estado antes de su primer `await` (y no dispara re-render en cascada).
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(true);
  const [tipo, setTipo] = useState<TipoLicencia>('pago');
  const [destino, setDestino] = useState<Destino>('alumno');
  const [vista, setVista] = useState<Vista>('licencias');
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_INICIALES, tipo: 'pago' });
  const [orden, setOrden] = useState<{ campo: CampoOrden; asc: boolean }>({ campo: 'curso', asc: true });
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  /** La celda de código que se está editando a mano, y lo que se lleva tecleado. */
  const [editando, setEditando] = useState<{ id: string; valor: string } | null>(null);
  const [guardandoCodigo, setGuardandoCodigo] = useState(false);
  const [abrirAsignar, setAbrirAsignar] = useState(false);
  const [abrirEnviar, setAbrirEnviar] = useState(false);
  const [envios, setEnvios] = useState<EnvioRegistro[]>([]);

  const cargar = useCallback(
    async (sync = false) => {
      try {
        const res = await fetch(
          `/api/licencias/admin/licencias?destino=${destino}${sync ? '&sync=1' : ''}`,
        );
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? 'No se han podido cargar las licencias');
          return;
        }
        setFilas(data.filas ?? []);
        setResumen(data.resumen ?? null);
        if (sync && data.sync) {
          const s = data.sync;
          const nuevas = (s.creadasPago ?? 0) + (s.creadasBanco ?? 0);
          const partes = [];
          if (nuevas) partes.push(`${nuevas} licencia(s) nuevas`);
          if (s.descartadas) partes.push(`${s.descartadas} fuera del censo`);
          if (s.sellados) partes.push(`${s.sellados} pedido(s) marcados 📤`);
          toast.success(partes.length ? partes.join(' · ') : 'Todo al día');
        }
      } finally {
        setCargando(false);
        setSincronizando(false);
      }
    },
    [destino],
  );

  // Al entrar se sincroniza una vez: así aparecen los pedidos nuevos y los alumnos que han
  // entrado desde la última visita sin tener que acordarse de pulsar nada.
  useEffect(() => {
    void cargar(true);
    // Solo al montar; los cambios de `destino` recargan sin sincronizar (efecto de abajo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambiar de destinatario recarga (el correo de destino se resuelve en el servidor), pero no
  // en el primer render: de eso ya se encarga el efecto de arriba, y si no saldrían dos viajes.
  const yaMontado = useRef(false);
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    void cargar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino]);

  useEffect(() => {
    if (vista !== 'enviadas') return;
    fetch('/api/licencias/admin/licencias/enviados')
      .then((r) => r.json())
      .then((d) => setEnvios(d.envios ?? []))
      .catch(() => setEnvios([]));
  }, [vista]);

  function cambiarTipo(nuevo: TipoLicencia) {
    setTipo(nuevo);
    setFiltros({ ...FILTROS_INICIALES, tipo: nuevo });
    setSeleccion(new Set());
  }

  function ordenarPor(campo: CampoOrden) {
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: true }));
  }

  const delTipo = useMemo(() => filas.filter((f) => f.tipo === tipo && f.studentId), [filas, tipo]);
  const visibles = useMemo(() => {
    const lista = filtrarLicencias(filas, { ...filtros, tipo });
    return [...lista].sort((a, b) => (orden.asc ? 1 : -1) * compararLicencias(a, b, orden.campo));
  }, [filas, filtros, tipo, orden]);

  const cursos = useMemo(
    () => [...new Set(delTipo.map((f) => f.curso))].sort((a, b) => ordenCurso(a) - ordenCurso(b)),
    [delTipo],
  );
  const clases = useMemo(
    () => [...new Set(delTipo.map((f) => f.letra ?? '').filter(Boolean))].sort(),
    [delTipo],
  );
  const editoriales = useMemo(
    () => [...new Set(delTipo.map((f) => f.editorial).filter(Boolean))].sort(),
    [delTipo],
  );
  // Los libros que se ofrecen respetan el curso ya filtrado: si estoy en 1ºESO no quiero ver
  // el Inglés de 4º en el desplegable.
  const libros = useMemo(
    () => librosDe(delTipo.filter((f) => filtros.curso === 'todos' || f.curso === filtros.curso)),
    [delTipo, filtros.curso],
  );

  // Lo que se lleva cada botón. La asignación va contra lo VISIBLE y pendiente, en el orden de
  // la tabla; el envío, contra lo seleccionado (o lo visible que esté listo si no hay nada).
  const candidatasAsignar = useMemo(
    () => visibles.filter((f) => !f.codigo && !f.descartadoAt).sort(ordenNatural),
    [visibles],
  );
  const listasVisibles = useMemo(
    () => visibles.filter((f) => f.codigo && f.estado !== 'enviado' && f.destinatario),
    [visibles],
  );
  const paraEnviar = useMemo(() => {
    const elegidas = listasVisibles.filter((f) => seleccion.has(f.id));
    return elegidas.length ? elegidas : listasVisibles;
  }, [listasVisibles, seleccion]);

  const r = resumen?.[tipo];
  const pct = r && r.total ? Math.round((r.enviadas / r.total) * 100) : 0;
  // El contador de sobrantes suma los dos tipos: su pestaña los enseña todos juntos.
  const totalSobrantes = (resumen?.pago.sobrantes ?? 0) + (resumen?.banco.sobrantes ?? 0);

  async function accionSobreSeleccion(
    url: string,
    body: unknown,
    okMsg: string,
    metodo: 'POST' | 'DELETE' = 'POST',
  ) {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? 'No se ha podido');
      return;
    }
    haptic.success();
    toast.success(okMsg);
    setSeleccion(new Set());
    await cargar(false);
  }

  const seleccionadas = useMemo(() => visibles.filter((f) => seleccion.has(f.id)), [visibles, seleccion]);

  /**
   * Guarda el código tecleado en una celda. Vía de escape para lo que el pegado en bloque no
   * cubre: la licencia suelta que manda la editorial por correo, un código mal copiado, el
   * alumno que llega tarde.
   */
  async function guardarCodigo(fila: LicenciaFila, valor: string) {
    const codigo = valor.trim();
    if (!codigo || codigo === fila.codigo) {
      setEditando(null);
      return;
    }
    // Cambiar el código de una ya enviada la devuelve a la cola, porque el alumno tiene el
    // viejo. Se dice antes, que no es evidente.
    if (
      fila.estado === 'enviado' &&
      !confirm(
        `${fila.alumno} ya recibió el código ${fila.codigo}.\n\nAl cambiarlo, esta licencia vuelve a «pendiente» para que se le mande el nuevo. ¿Seguimos?`,
      )
    ) {
      setEditando(null);
      return;
    }
    setGuardandoCodigo(true);
    try {
      const res = await fetch('/api/licencias/admin/licencias/codigo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fila.id, codigo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'No se ha podido guardar');
        return;
      }
      haptic.success();
      toast.success(data.reenviar ? 'Código cambiado · vuelve a estar pendiente de enviar' : 'Código guardado');
      setEditando(null);
      await cargar(false);
    } finally {
      setGuardandoCodigo(false);
    }
  }

  if (cargando) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando licencias…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pago / Banco: dos mundos, nunca mezclados */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-zinc-200 p-0.5 dark:border-zinc-700">
          {(['pago', 'banco'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cambiarTipo(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tipo === t
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {t === 'pago' ? 'De pago' : 'Banco de libros (gratis)'}
              <span className="ml-1.5 text-xs opacity-70">{resumen?.[t].total ?? 0}</span>
            </button>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
          Enviar a
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value as Destino)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="alumno">correo del alumno</option>
            <option value="familia">correo de la familia</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setSincronizando(true);
            void cargar(true);
          }}
          disabled={sincronizando}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
        >
          <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {r && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Kpi label="Licencias" valor={String(r.total)} nota={r.descartadas ? `${r.descartadas} descartadas` : undefined} />
          <Kpi label="Falta el código" valor={String(r.sinCodigo)} tono={r.sinCodigo ? 'aviso' : undefined} />
          <Kpi label="Listas para enviar" valor={String(r.listasParaEnviar)} tono={r.listasParaEnviar ? 'ok' : undefined} />
          <Kpi label="Enviadas" valor={`${r.enviadas}`} nota={`${pct}% del total`} />
          <Kpi
            label="Incidencias"
            valor={String(r.conError + r.sinCorreo)}
            nota={r.sinCorreo ? `${r.sinCorreo} sin correo` : r.conError ? `${r.conError} con error` : 'ninguna'}
            tono={r.conError + r.sinCorreo ? 'aviso' : undefined}
          />
        </div>
      )}

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ['licencias', 'Licencias'],
            ['sobrantes', `Sobrantes${totalSobrantes ? ` (${totalSobrantes})` : ''}`],
            ['enviadas', 'Registro de envíos'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v as Vista)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              vista === v
                ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Los sobrantes NO se filtran por pestaña: se cruzan de pago a banco y al revés. */}
      {vista === 'sobrantes' && <EnviosSobrantes filas={filas} onCambio={() => cargar(false)} />}

      {vista === 'enviadas' && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {envios.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">Todavía no se ha enviado nada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2">Cuándo</th>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">A</th>
                  <th className="px-3 py-2">Asunto</th>
                  <th className="px-3 py-2 text-right">Licencias</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id} className="border-t dark:border-zinc-800">
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-zinc-500">
                      {new Date(e.enviadoAt).toLocaleString('es-ES')}
                    </td>
                    <td className="px-3 py-1.5">{e.alumno}</td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">{e.para}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {e.ok ? (
                        e.asunto
                      ) : (
                        <span className="text-red-600 dark:text-red-400">
                          {e.asunto} — {e.error}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">{e.numLicencias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {vista === 'licencias' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filtros.q}
              onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value }))}
              placeholder="Buscar alumno o código…"
              className="min-w-40 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={filtros.curso}
              onChange={(e) => setFiltros((f) => ({ ...f, curso: e.target.value, libro: 'todos' }))}
              className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="todos">Todos los cursos</option>
              {cursos.map((c) => (
                <option key={c} value={c}>
                  {cursoLabel(c)}
                </option>
              ))}
            </select>
            <select
              value={filtros.clase}
              onChange={(e) => setFiltros((f) => ({ ...f, clase: e.target.value }))}
              className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="todas">Todas las clases</option>
              {clases.map((c) => (
                <option key={c} value={c}>
                  Clase {c}
                </option>
              ))}
            </select>
            <select
              value={filtros.libro}
              onChange={(e) => setFiltros((f) => ({ ...f, libro: e.target.value }))}
              className="max-w-64 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="todos">Todos los libros</option>
              {libros.map((l) => (
                <option key={l.clave} value={l.clave}>
                  {l.asignatura} · {cursoLabel(l.curso)} ({l.pendientes} sin código)
                </option>
              ))}
            </select>
            <select
              value={filtros.editorial}
              onChange={(e) => setFiltros((f) => ({ ...f, editorial: e.target.value }))}
              className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="todas">Todas las editoriales</option>
              {editoriales.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value as EstadoFiltro }))}
              className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Las dos acciones del día: pegar lo que ha llegado y mandar lo que ya está */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <button
              type="button"
              onClick={() => setAbrirAsignar(true)}
              disabled={candidatasAsignar.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <ClipboardPaste className="h-4 w-4" />
              Pegar códigos ({candidatasAsignar.length} sin asignar)
            </button>
            <button
              type="button"
              onClick={() => setAbrirEnviar(true)}
              disabled={paraEnviar.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              Enviar {paraEnviar.length}
              {seleccionadas.length ? ' seleccionadas' : ' listas'}
            </button>

            {seleccionadas.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-500">{seleccionadas.length} marcadas:</span>
                <button
                  type="button"
                  onClick={() =>
                    accionSobreSeleccion(
                      '/api/licencias/admin/licencias/descartar',
                      { ids: [...seleccion], motivo: 'no le toca' },
                      'Descartadas',
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <EyeOff className="h-3.5 w-3.5" /> No le toca
                </button>
                <button
                  type="button"
                  onClick={() =>
                    accionSobreSeleccion(
                      '/api/licencias/admin/licencias/descartar',
                      { ids: [...seleccion], motivo: null },
                      'Descarte deshecho',
                    )
                  }
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Deshacer descarte
                </button>
                {seleccionadas.length === 1 && seleccionadas[0].codigo && seleccionadas[0].estado !== 'enviado' && (
                  <button
                    type="button"
                    onClick={() =>
                      accionSobreSeleccion(
                        '/api/licencias/admin/licencias/codigo',
                        { id: seleccionadas[0].id },
                        'Código quitado',
                        'DELETE',
                      )
                    }
                    className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Quitar código
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/50">
                <tr>
                  <th className="w-9 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={visibles.length > 0 && seleccion.size === visibles.length}
                      onChange={(e) =>
                        setSeleccion(e.target.checked ? new Set(visibles.map((v) => v.id)) : new Set())
                      }
                    />
                  </th>
                  {(
                    [
                      ['alumno', 'Alumno'],
                      ['curso', 'Curso'],
                      ['asignatura', 'Asignatura'],
                      ['codigo', 'Código'],
                      ['estado', 'Estado'],
                      ['enviado', 'Enviada'],
                    ] as const
                  ).map(([campo, label]) => (
                    <th key={campo} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => ordenarPor(campo as CampoOrden)}
                        className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200"
                      >
                        {label}
                        {orden.campo === campo &&
                          (orden.asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2">Destino</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-sm text-zinc-500">
                      Nada con estos filtros.
                    </td>
                  </tr>
                )}
                {visibles.map((f) => (
                  <tr
                    key={f.id}
                    className={`border-t dark:border-zinc-800 ${
                      f.descartadoAt ? 'opacity-45' : ''
                    } ${seleccion.has(f.id) ? 'bg-blue-50/60 dark:bg-blue-500/5' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={seleccion.has(f.id)}
                        onChange={() =>
                          setSeleccion((prev) => {
                            const s = new Set(prev);
                            if (s.has(f.id)) s.delete(f.id);
                            else s.add(f.id);
                            return s;
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5">{f.alumno}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">
                      {cursoLabel(f.curso)}
                      {f.letra ? ` ${f.letra}` : ''}
                    </td>
                    <td className="px-3 py-1.5">
                      {f.asignatura}
                      <span className="ml-1 text-xs text-zinc-400">{f.editorial}</span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[13px]">
                      {editando?.id === f.id ? (
                        <input
                          autoFocus
                          value={editando.valor}
                          disabled={guardandoCodigo}
                          onChange={(e) => setEditando({ id: f.id, valor: e.target.value })}
                          onBlur={() => guardarCodigo(f, editando.valor)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardarCodigo(f, editando.valor);
                            if (e.key === 'Escape') setEditando(null);
                          }}
                          placeholder="pega o teclea el código"
                          className="w-44 rounded-lg border border-blue-400 bg-white px-2 py-1 font-mono text-[13px] outline-none dark:bg-zinc-900"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditando({ id: f.id, valor: f.codigo ?? '' })}
                          title="Clic para poner o corregir el código a mano"
                          className="rounded px-1 py-0.5 text-left hover:bg-blue-50 dark:hover:bg-blue-500/10"
                        >
                          {f.codigo ?? <span className="text-zinc-300 dark:text-zinc-600">— poner —</span>}
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {f.descartadoAt ? (
                        <span className="text-xs text-zinc-400">no le toca</span>
                      ) : f.estado === 'enviado' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <BadgeCheck className="h-3.5 w-3.5" /> enviada
                        </span>
                      ) : f.estado === 'error' ? (
                        <span className="text-xs text-red-600 dark:text-red-400" title={f.error ?? ''}>
                          error
                        </span>
                      ) : f.codigo ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <Mail className="h-3.5 w-3.5" /> lista
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditando({ id: f.id, valor: '' })}
                          title="Clic para poner el código a mano"
                          className="rounded px-1 text-xs text-zinc-400 underline decoration-dotted hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          falta código
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-zinc-500">{fecha(f.enviadoAt)}</td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">
                      {f.destinatario ?? <span className="text-amber-600 dark:text-amber-400">sin correo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-zinc-400">
            {visibles.length} fila(s) a la vista de {delTipo.length}. Los sobrantes están en su pestaña.{' '}
            <Link href="/gestion/licencias/proceso" className="underline">
              Ver el proceso completo
            </Link>
            .
          </p>
        </>
      )}

      <EnviosAsignar
        abierto={abrirAsignar}
        onCerrar={() => setAbrirAsignar(false)}
        tipo={tipo}
        candidatas={candidatasAsignar}
        onHecho={() => cargar(false)}
      />
      <EnviosEnviar
        key={tipo}
        abierto={abrirEnviar}
        onCerrar={() => setAbrirEnviar(false)}
        tipo={tipo}
        destino={destino}
        seleccionadas={paraEnviar}
        aLaVista={visibles.length}
        listasALaVista={listasVisibles.length}
        porSeleccion={listasVisibles.some((f) => seleccion.has(f.id))}
        presets={presets}
        onHecho={() => cargar(false)}
      />
    </div>
  );
}
