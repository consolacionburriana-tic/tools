'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PlugZap, Sparkles } from 'lucide-react';
import { MODELOS_IA, costeIA, type AjustesIA } from '@/lib/ajustes';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** Lo que cuesta un análisis típico de evaluación (~10.000 tokens de entrada, ~2.000 de salida). */
function costeTipico(modelo: string): string {
  const c = costeIA(modelo, 10_000, 2_000);
  return c < 0.01 ? 'menos de 1 céntimo' : `unos ${Math.round(c * 100)} céntimos`;
}

export function AjustesIAForm({
  inicial,
  hayClave,
  huella,
}: {
  inicial: AjustesIA;
  hayClave: boolean;
  /** Últimos 4 caracteres de la clave, para reconocerla sin enseñarla. */
  huella: string | null;
}) {
  const [ajustes, setAjustes] = useState(inicial);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardado, setGuardado] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const cambiado = JSON.stringify(ajustes) !== JSON.stringify(guardado);

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch('/api/ajustes/ia', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ajustes),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'No se ha podido guardar');
      toast.success('Ajustes de IA guardados');
      setGuardado(ajustes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setPrueba(null);
    try {
      const res = await fetch('/api/ajustes/ia/probar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo: ajustes.modelo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setPrueba({ ok: true, texto: `Funciona: ${data.modelo} ha contestado en ${(data.ms / 1000).toFixed(1)} s.` });
    } catch (e) {
      setPrueba({ ok: false, texto: e instanceof Error ? e.message : 'No se ha podido probar' });
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="space-y-5">
      <Aviso tono={hayClave ? 'ok' : 'aviso'}>
        {hayClave ? (
          <>
            La clave de la API de Anthropic está puesta{huella && <> (termina en <code className="text-xs">{huella}</code>)</>}.
          </>
        ) : (
          <>
            Falta la clave de la API de Anthropic. Es una <b>variable de entorno</b>, <code className="text-xs">ANTHROPIC_API_KEY</code>:
            se crea en platform.claude.com (API keys) y se pega en Vercel → Settings → Environment Variables. Luego, redesplegar.
          </>
        )}{' '}
        <span className="opacity-80">La clave es un secreto: nunca se guarda en la base de datos ni se enseña aquí.</span>
      </Aviso>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Análisis con IA activado</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">Apagado, el botón «Analizar con IA» no sale en ningún sitio.</span>
        </span>
        <input
          type="checkbox"
          checked={ajustes.activado}
          onChange={(e) => setAjustes({ ...ajustes, activado: e.target.checked })}
          className="h-5 w-5 accent-blue-600"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Modelo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODELOS_IA.map((m) => {
            const on = ajustes.modelo === m.id;
            return (
              <label
                key={m.id}
                className={`cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 ${
                  on
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-500/10'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                }`}
              >
                <input
                  type="radio"
                  name="modelo"
                  value={m.id}
                  checked={on}
                  onChange={() => setAjustes({ ...ajustes, modelo: m.id })}
                  className="sr-only"
                />
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {on && <Sparkles aria-hidden className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  {m.label}
                </span>
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{m.nota}</span>
                <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">Un análisis: {costeTipico(m.id)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Lo que la IA debería saber del colegio</span>
        <span className="mb-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
          Va en cada análisis. Por ejemplo: qué es un Godly Play o un oratorio, el lema y el rasgo carismático del curso, cómo se
          organiza la ESO… Sin nombres de alumnos.
        </span>
        <Textarea
          value={ajustes.contexto}
          onChange={(e) => setAjustes({ ...ajustes, contexto: e.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="Somos un colegio de las Hermanas de la Consolación en Burriana. El lema de este curso es «Sin rodeos»…"
        />
      </label>

      {prueba && <Aviso tono={prueba.ok ? 'ok' : 'error'}>{prueba.texto}</Aviso>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={probar}
          disabled={!hayClave}
          cargando={probando}
          title="Una llamada mínima a Claude con el modelo elegido (cuesta una fracción de céntimo)"
          className="mr-auto"
        >
          {!probando && <PlugZap aria-hidden />}
          {probando ? 'Probando…' : hayClave ? 'Probar conexión' : 'Probar conexión (falta la clave)'}
        </Button>
        {cambiado && <span className="text-xs text-amber-700 dark:text-amber-400">Cambios sin guardar</span>}
        <Button type="button" onClick={guardar} disabled={!cambiado} cargando={guardando}>
          Guardar ajustes de IA
        </Button>
      </div>
    </div>
  );
}
