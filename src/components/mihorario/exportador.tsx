'use client';

// Configurar la plantilla del título, poner un emoji a cada materia/actividad, elegir
// calendario y exportar. Vista previa SIEMPRE antes de escribir, porque reexportar borra
// lo anterior de ese periodo (es una foto, no un diario) y eso no se hace a ciegas.
import { useEffect, useState } from 'react';
import { CalendarPlus, Check, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { haptic } from '@/lib/haptics';
import { COLORES_GOOGLE, PLANTILLA_TITULO_DEFECTO, RANGOS_CURSO, type RangoCurso } from '@/lib/mihorario';
import { SelectorEmoji } from '@/components/mihorario/selector-emoji';
import { cn } from '@/lib/utils';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Campo } from '@/components/ui/campo';
import { ConfirmarDialogo } from '@/components/ui/confirmar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmentado } from '@/components/ui/segmentado';
import { Selector } from '@/components/ui/selector';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';

interface Categoria {
  clave: string;
  etiqueta: string;
  emoji: string;
  abrev: string;
  color: string; // colorId de Google ('1'..'11') que le toca hoy
}

interface Previa {
  periodo: string;
  desde: string;
  hasta: string;
  totalEventos: number;
  ejemplos: { titulo: string; primeraFecha: string }[];
  calendarConfigurado: boolean;
}

/**
 * Color del evento en Google Calendar. Google solo admite estos 11 colores fijos; los
 * eventos creados se pueden recolorear luego a mano desde el propio calendario.
 */
function SelectorColor({ valor, onChange, etiqueta }: { valor: string; onChange: (id: string) => void; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false);
  const actual = COLORES_GOOGLE.find((c) => c.id === valor);
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        aria-label={`Color de ${etiqueta}: ${actual?.nombre ?? 'el del calendario'}`}
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-zinc-300 bg-white outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <span aria-hidden className="size-5 rounded-full border border-black/10" style={{ backgroundColor: actual?.hex ?? 'transparent' }} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {etiqueta}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{actual?.nombre ?? 'el del calendario'}</span>
        </p>
        <div role="group" aria-label={`Color de ${etiqueta}`} className="grid grid-cols-5 gap-1">
          {COLORES_GOOGLE.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.nombre}
              aria-pressed={c.id === valor}
              onClick={() => {
                haptic.tap();
                onChange(c.id);
                setAbierto(false);
              }}
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full border border-black/10 text-zinc-900',
                  c.id === valor && 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-900',
                )}
                style={{ backgroundColor: c.hex }}
              >
                {c.id === valor && <Check aria-hidden className="size-4" />}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Exportador({ periodoId }: { periodoId: string }) {
  const [cargando, setCargando] = useState(true);
  const [plantillaTitulo, setPlantillaTitulo] = useState(PLANTILLA_TITULO_DEFECTO);
  const [plantillaDescripcion, setPlantillaDescripcion] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [emojis, setEmojis] = useState<Record<string, string>>({});
  const [abreviaturas, setAbreviaturas] = useState<Record<string, string>>({});
  const [colores, setColores] = useState<Record<string, string>>({});
  const [rangoCurso, setRangoCurso] = useState<RangoCurso>('sep-jun');
  const [calendarios, setCalendarios] = useState<{ id: string; nombre: string; esPrincipal: boolean }[]>([]);
  const [calendarConfigurado, setCalendarConfigurado] = useState(false);
  const [calendarioElegido, setCalendarioElegido] = useState<string>('primary');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ultima, setUltima] = useState<{ eventosCreados: number; createdAt: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preguntarQuitar, setPreguntarQuitar] = useState(false);

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
          setAbreviaturas(pref.preferencias.abreviaturas ?? {});
          setColores(pref.preferencias.colores ?? {});
          if (pref.preferencias.rangoCurso === 'oct-may') setRangoCurso('oct-may');
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
      body: JSON.stringify({ plantillaTitulo, plantillaDescripcion, emojis, abreviaturas, colores, rangoCurso, calendarioGoogleId: calendarioElegido }),
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
    return (
      <SkeletonCard>
        <Skeleton className="h-4 w-52" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </SkeletonCard>
    );
  }

  return (
    <div className="space-y-4">
      {!calendarConfigurado && (
        <Aviso tono="aviso">
          Google Calendar todavía no está enchufado en el servidor (falta el scope o las
          credenciales). Puedes preparar la plantilla y los emojis; el botón de exportar se
          activará en cuanto esté listo.
        </Aviso>
      )}

      <Tarjeta>
        <TarjetaCabecera titulo="Cómo se llaman tus eventos" />
        <TarjetaCuerpo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Título" id="mh-titulo">
              <Input id="mh-titulo" value={plantillaTitulo} onChange={(e) => setPlantillaTitulo(e.target.value)} />
            </Campo>
            <Campo etiqueta="Descripción" id="mh-descripcion" opcional>
              <Input
                id="mh-descripcion"
                value={plantillaDescripcion}
                onChange={(e) => setPlantillaDescripcion(e.target.value)}
                placeholder="{profes} · {actividad}"
              />
            </Campo>
          </div>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Huecos disponibles:{' '}
            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs break-words text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {'{emoji} {abrev} {materia} {detalle} {clase} {clases} {aula} {profes} {actividad}'}
            </code>
            . Los que queden vacíos se recortan solos, con su separador.
          </p>
        </TarjetaCuerpo>
      </Tarjeta>

      {categorias.length > 0 && (
        <Tarjeta>
          <TarjetaCabecera titulo="Tus emojis, abreviaturas y colores" />
          <TarjetaCuerpo className="grid gap-1.5 sm:grid-cols-2">
            {categorias.map((c) => (
              <div key={c.clave} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-2 py-1.5 dark:bg-zinc-800/60">
                {/* El emoji lo elige cada profe: se respeta tal cual. */}
                <SelectorEmoji
                  valor={emojis[c.clave] ?? c.emoji}
                  onChange={(e) => setEmojis((prev) => ({ ...prev, [c.clave]: e }))}
                />
                <Input
                  value={abreviaturas[c.clave] ?? ''}
                  onChange={(e) => setAbreviaturas((prev) => ({ ...prev, [c.clave]: e.target.value }))}
                  placeholder={c.abrev}
                  aria-label={`Abreviatura de ${c.etiqueta}`}
                  maxLength={12}
                  className="h-10 w-20 shrink-0 px-2 text-center"
                />
                <SelectorColor
                  valor={colores[c.clave] ?? c.color}
                  onChange={(id) => setColores((prev) => ({ ...prev, [c.clave]: id }))}
                  etiqueta={c.etiqueta}
                />
                <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300">{c.etiqueta}</span>
              </div>
            ))}
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      <Tarjeta>
        <TarjetaCabecera
          titulo="¿Qué parte del curso?"
          descripcion="Los eventos empiezan y acaban dentro de ese tramo, sin salirse nunca de las fechas del periodo."
        />
        <TarjetaCuerpo>
          <Segmentado
            etiqueta="Parte del curso"
            className="w-full sm:w-auto"
            valor={rangoCurso}
            onChange={setRangoCurso}
            opciones={RANGOS_CURSO.map((r) => ({ valor: r.valor, etiqueta: r.etiqueta }))}
          />
        </TarjetaCuerpo>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera titulo="¿En qué calendario?" />
        <TarjetaCuerpo>
          {calendarios.length > 0 ? (
            <Selector
              aria-label="Calendario de Google"
              value={calendarioElegido}
              onChange={(e) => setCalendarioElegido(e.target.value)}
            >
              {calendarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.esPrincipal ? ' (principal)' : ''}
                </option>
              ))}
            </Selector>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Tu calendario principal (por defecto).</p>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      {previa && (
        <Tarjeta>
          <TarjetaCabecera
            titulo={`Esto es lo que va a entrar: ${previa.totalEventos} eventos recurrentes`}
            descripcion={`Del ${previa.desde} al ${previa.hasta}`}
          />
          <TarjetaCuerpo>
            <ul className="space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
              {previa.ejemplos.map((e, i) => (
                <li key={i}>
                  {e.titulo} <span className="text-zinc-500 tabular-nums dark:text-zinc-400">· desde {e.primeraFecha}</span>
                </li>
              ))}
            </ul>
            {previa.totalEventos > previa.ejemplos.length && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">y {previa.totalEventos - previa.ejemplos.length} más…</p>
            )}
            <Button className="mt-4 w-full sm:w-auto" cargando={enviando} disabled={!calendarConfigurado} onClick={confirmarExportacion}>
              {!enviando && <CheckCircle2 aria-hidden />}
              Crear {previa.totalEventos} eventos en tu calendario
            </Button>
          </TarjetaCuerpo>
        </Tarjeta>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={previa ? 'outline' : 'default'} cargando={enviando && !previa} disabled={enviando} onClick={pedirPrevia}>
          {!(enviando && !previa) && <CalendarPlus aria-hidden />}
          {previa ? 'Volver a ver la vista previa' : 'Ver vista previa'}
        </Button>
        {ultima && (
          <Button variant="destructive" disabled={enviando} onClick={() => setPreguntarQuitar(true)}>
            <RotateCcw aria-hidden />
            Quitar del calendario ({ultima.eventosCreados} eventos)
          </Button>
        )}
      </div>

      {ultima && (
        <ConfirmarDialogo
          abierto={preguntarQuitar}
          onCerrar={() => setPreguntarQuitar(false)}
          onConfirmar={deshacer}
          titulo={`¿Quitar ${ultima.eventosCreados} eventos de tu calendario?`}
          descripcion="Se borran de Google Calendar los eventos de este horario que creaste desde aquí. Lo que hayas puesto tú a mano en el calendario no se toca."
          boton={`Quitar ${ultima.eventosCreados} eventos`}
        />
      )}
    </div>
  );
}
