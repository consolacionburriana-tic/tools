'use client';

// Ajustes de los correos (docs/32, decisión 17): las cinco plantillas. Se edita el asunto y el texto
// de antes y de después de los bloques; el cuándo y el dónde los pone siempre el código. Vista previa
// en vivo (el mismo HTML que sale), «Enviarme una prueba» y «Volver al texto de fábrica».
import { useMemo, useRef, useState } from 'react';
import { RotateCcw, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PLANTILLA_NOMBRE, PLANTILLAS_DE_FABRICA, TIPOS_PLANTILLA, VARIABLE_AYUDA, VARIABLES_PLANTILLA, type Plantillas, type TipoPlantilla } from '@/lib/sustituciones';
import { ejemploAviso } from '@/lib/sustituciones-email';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Button } from '@/components/ui/button';
import { EnlaceVolver, TituloPagina } from '@/components/ui/cabecera-modulo';
import { Campo } from '@/components/ui/campo';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Input } from '@/components/ui/input';
import { Tarjeta, TarjetaCabecera, TarjetaCuerpo } from '@/components/ui/tarjeta';
import { Textarea } from '@/components/ui/textarea';
import { pedir } from './comun';

type Campo = 'asunto' | 'antes' | 'despues';

export function AjustesCorreos({ inicial, quien, hoy, actualizado }: { inicial: Plantillas; quien: string; hoy: string; actualizado: string | null }) {
  const [guardadas, setGuardadas] = useState(inicial);
  const [plantillas, setPlantillas] = useState(inicial);
  const [tipo, setTipo] = useState<TipoPlantilla>('sustituto');
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const foco = useRef<{ campo: Campo; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const p = plantillas[tipo];
  const cambiadas = TIPOS_PLANTILLA.filter((t) => JSON.stringify(plantillas[t]) !== JSON.stringify(guardadas[t]));
  const deFabrica = JSON.stringify(p) === JSON.stringify(PLANTILLAS_DE_FABRICA[tipo]);
  const vista = useMemo(() => ejemploAviso(tipo, p, quien, hoy), [tipo, p, quien, hoy]);

  function poner(campo: Campo, valor: string) {
    setPlantillas((x) => ({ ...x, [tipo]: { ...x[tipo], [campo]: valor } }));
  }

  /** Mete `{variable}` donde está el cursor del último campo tocado (o al final del texto de antes). */
  function insertar(v: string) {
    const f = foco.current;
    const campo = f?.campo ?? 'antes';
    const actual = p[campo];
    const ini = f?.el.selectionStart ?? actual.length;
    const fin = f?.el.selectionEnd ?? actual.length;
    poner(campo, `${actual.slice(0, ini)}{${v}}${actual.slice(fin)}`);
    requestAnimationFrame(() => {
      if (!f) return;
      f.el.focus();
      const pos = ini + v.length + 2;
      f.el.setSelectionRange(pos, pos);
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      const r = await pedir<Plantillas>('/api/sustituciones/admin/plantillas', { method: 'PUT', body: plantillas });
      const limpias = Object.fromEntries(TIPOS_PLANTILLA.map((t) => [t, r[t]])) as Plantillas;
      setGuardadas(limpias);
      setPlantillas(limpias);
      toast.success('Plantillas guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se han podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function prueba() {
    setProbando(true);
    try {
      const r = await pedir<{ a: string }>('/api/sustituciones/admin/plantillas/prueba', { body: { tipo, plantillas } });
      toast.success(`Prueba enviada a ${r.a}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido mandar');
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <EnlaceVolver href="/gestion/sustituciones">Sustituciones</EnlaceVolver>
        <TituloPagina descripcion={actualizado ? `Última vez guardadas: ${actualizado}` : 'Ahora mismo, los textos de fábrica.'}>Correos</TituloPagina>
      </div>

      <Filtros etiqueta="Plantilla">
        {TIPOS_PLANTILLA.map((t) => (
          <Filtro key={t} activo={tipo === t} onClick={() => setTipo(t)}>
            {PLANTILLA_NOMBRE[t]}
            {cambiadas.includes(t) ? ' ·' : ''}
          </Filtro>
        ))}
      </Filtros>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta>
          <TarjetaCabecera titulo={PLANTILLA_NOMBRE[tipo]} descripcion="Detrás del asunto va siempre el cuándo y el dónde. Entre los dos textos, un bloque por hora." />
          <TarjetaCuerpo className="space-y-4">
            <Campo etiqueta="Asunto" id="asunto">
              <Input id="asunto" value={p.asunto} maxLength={200} onChange={(e) => poner('asunto', e.target.value)} onFocus={(e) => { foco.current = { campo: 'asunto', el: e.currentTarget }; }} />
            </Campo>
            <Campo etiqueta="Antes de las horas" id="antes">
              <Textarea id="antes" rows={5} value={p.antes} maxLength={2000} onChange={(e) => poner('antes', e.target.value)} onFocus={(e) => { foco.current = { campo: 'antes', el: e.currentTarget }; }} />
            </Campo>
            <Campo etiqueta="Después de las horas" id="despues">
              <Textarea id="despues" rows={4} value={p.despues} maxLength={2000} onChange={(e) => poner('despues', e.target.value)} onFocus={(e) => { foco.current = { campo: 'despues', el: e.currentTarget }; }} />
            </Campo>
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Insertar</p>
              <div className="flex flex-wrap gap-2">
                {VARIABLES_PLANTILLA.map((v) => (
                  <Button key={v} variant="outline" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => insertar(v)} title={VARIABLE_AYUDA[v]}>
                    {`{${v}}`}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {VARIABLES_PLANTILLA.map((v) => `{${v}}: ${VARIABLE_AYUDA[v].toLowerCase()}`).join(' · ')}. El motivo no se puede poner: es un dato de salud.
              </p>
            </div>
          </TarjetaCuerpo>
        </Tarjeta>
        <Tarjeta>
          <TarjetaCabecera titulo="Así llega" descripcion={vista.subject} />
          <iframe title="Vista previa del correo" srcDoc={vista.html} sandbox="" className="h-[32rem] w-full rounded-b-2xl bg-white" />
        </Tarjeta>
      </div>

      <BarraAcciones ancho="normal" resumen={cambiadas.length > 0 ? `${cambiadas.length === 1 ? '1 plantilla cambiada' : `${cambiadas.length} plantillas cambiadas`} sin guardar` : undefined}>
        <Button variant="ghost" disabled={deFabrica} onClick={() => setPlantillas((x) => ({ ...x, [tipo]: PLANTILLAS_DE_FABRICA[tipo] }))}>
          <RotateCcw aria-hidden /> <span className="hidden sm:inline">Volver al de fábrica</span><span className="sm:hidden">Fábrica</span>
        </Button>
        <Button variant="outline" cargando={probando} onClick={() => void prueba()}>
          <Send aria-hidden /> <span className="hidden sm:inline">Enviarme una prueba</span><span className="sm:hidden">Prueba</span>
        </Button>
        <Button cargando={guardando} disabled={cambiadas.length === 0} onClick={() => void guardar()}>
          <Save aria-hidden /> Guardar
        </Button>
      </BarraAcciones>
    </div>
  );
}
