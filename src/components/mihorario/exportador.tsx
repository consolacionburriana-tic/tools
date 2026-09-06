'use client';

// Configurar la plantilla del título, poner un emoji a cada materia/actividad, elegir
// calendario y exportar. Vista previa SIEMPRE antes de escribir, porque reexportar borra
// lo anterior de ese periodo (es una foto, no un diario) y eso no se hace a ciegas.
import { useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { haptic } from '@/lib/haptics';
import { PLANTILLA_TITULO_DEFECTO } from '@/lib/mihorario';
import { cn } from '@/lib/utils';

interface Categoria {
  clave: string;
  etiqueta: string;
  emoji: string;
}

interface Previa {
  periodo: string;
  totalEventos: number;
  ejemplos: { titulo: string; primeraFecha: string }[];
  calendarConfigurado: boolean;
}

const ESTILO_CAMPO =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

export function Exportador({ periodoId }: { periodoId: string }) {
  const [cargando, setCargando] = useState(true);
  const [plantillaTitulo, setPlantillaTitulo] = useState(PLANTILLA_TITULO_DEFECTO);
  const [plantillaDescripcion, setPlantillaDescripcion] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [emojis, setEmojis] = useState<Record<string, string>>({});
  const [calendarios, setCalendarios] = useState<{ id: string; nombre: string; esPrincipal: boolean }[]>([]);
  const [calendarConfigurado, setCalendarConfigurado] = useState(false);
  const [calendarioElegido, setCalendarioElegido] = useState<string>('primary');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ultima, setUltima] = useState<{ eventosCreados: number; createdAt: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rPref, rCal, rUlt] = await Promise.all([
          fetch('/api/mi-horario/preferencias'),
          fetch('/api/mi-horario/calendarios'),
          fetch(`/api/mi-horario/exportar?periodoId=${periodoId}`),
        ]);
        const pref = await rPref.json();
        if (rPref.ok) {
          setPlantillaTitulo(pref.preferencias.plantillaTitulo);
          setPlantillaDescripcion(pref.preferencias.plantillaDescripcion ?? '');
          setEmojis(pref.preferencias.emojis ?? {});
          setCategorias(pref.categorias ?? []);
          if (pref.preferencias.calendarioGoogleId) setCalendarioElegido(pref.preferencias.calendarioGoogleId);
        }
        const cal = await rCal.json();
        setCalendarConfigurado(cal.configurado);
        setCalendarios(cal.calendarios ?? []);
        const ult = await rUlt.json();
        if (ult.ultima) setUltima(ult.ultima);
      } catch {
        toast.error('No se ha podido cargar tu configuración');
      } finally {
        setCargando(false);
      }
    })();
  }, [periodoId]);

  async function guardarPreferencias() {
    await fetch('/api/mi-horario/preferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantillaTitulo, plantillaDescripcion, emojis, calendarioGoogleId: calendarioElegido }),
    });
  }

  async function pedirPrevia() {
    setEnviando(true);
    try {
      await guardarPreferencias();
      const res = await fetch('/api/mi-horario/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoId, confirmar: false }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'Error');
      setPrevia(datos.previa);
    } catch (e) {
      haptic.warning();
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarExportacion() {
    setEnviando(true);
    try {
      const res = await fetch('/api/mi-horario/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoId, confirmar: true, calendarioGoogleId: calendarioElegido }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'Error');
      haptic.success();
      toast.success(`${datos.resumen.creados} eventos creados en tu calendario`);
      setUltima({ eventosCreados: datos.resumen.creados, createdAt: new Date().toISOString() });
      setPrevia(null);
    } catch (e) {
      haptic.warning();
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function deshacer() {
    setEnviando(true);
    try {
      const res = await fetch('/api/mi-horario/deshacer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoId }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? 'Error');
      haptic.success();
      toast.success(`${datos.borrados} eventos quitados de tu calendario`);
      setUltima(null);
    } catch (e) {
      haptic.warning();
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900" />;
  }

  return (
    <div className="space-y-4">
      {!calendarConfigurado && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Google Calendar todavía no está enchufado en el servidor (falta el scope o las
          credenciales). Puedes preparar la plantilla y los emojis; el botón de exportar se
          activará en cuanto esté listo.
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cómo se llaman tus eventos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Título</span>
            <input value={plantillaTitulo} onChange={(e) => setPlantillaTitulo(e.target.value)} className={ESTILO_CAMPO} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Descripción (opcional)</span>
            <input value={plantillaDescripcion} onChange={(e) => setPlantillaDescripcion(e.target.value)} className={ESTILO_CAMPO} placeholder="{profes} · {actividad}" />
          </label>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Huecos disponibles: <code>{'{emoji} {abrev} {materia} {clase} {clases} {aula} {profes} {actividad}'}</code>. Los que
          queden vacíos se recortan solos, con su separador.
        </p>
      </div>

      {categorias.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tus emojis</h2>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map((c) => (
              <div key={c.clave} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 dark:bg-zinc-800/60">
                <input
                  value={emojis[c.clave] ?? c.emoji}
                  onChange={(e) => setEmojis((prev) => ({ ...prev, [c.clave]: e.target.value }))}
                  className="w-10 rounded border border-zinc-200 bg-white text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  maxLength={4}
                />
                <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">{c.etiqueta}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿En qué calendario?</h2>
        {calendarios.length > 0 ? (
          <select value={calendarioElegido} onChange={(e) => setCalendarioElegido(e.target.value)} className={ESTILO_CAMPO}>
            {calendarios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.esPrincipal ? ' (principal)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Tu calendario principal (por defecto).</p>
        )}
      </div>

      {previa && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <h2 className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            Esto es lo que va a entrar: {previa.totalEventos} eventos recurrentes
          </h2>
          <ul className="space-y-0.5 text-sm text-indigo-800 dark:text-indigo-300">
            {previa.ejemplos.map((e, i) => (
              <li key={i}>
                {e.titulo} <span className="text-xs text-indigo-500 dark:text-indigo-400">· desde {e.primeraFecha}</span>
              </li>
            ))}
          </ul>
          {previa.totalEventos > previa.ejemplos.length && (
            <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">y {previa.totalEventos - previa.ejemplos.length} más…</p>
          )}
          <button
            type="button"
            disabled={enviando || !calendarConfigurado}
            onClick={confirmarExportacion}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirmar y crear los eventos
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={enviando}
          onClick={pedirPrevia}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            'bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900',
          )}
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Ver vista previa
        </button>
        {ultima && (
          <button
            type="button"
            disabled={enviando}
            onClick={deshacer}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-4 w-4" />
            Quitar del calendario ({ultima.eventosCreados} eventos)
          </button>
        )}
      </div>
    </div>
  );
}
