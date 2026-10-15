'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react';
import { MODELOS_IA, costeIA, type AjustesIA } from '@/lib/ajustes';

/** Lo que cuesta un análisis típico de evaluación (~10.000 tokens de entrada, ~2.000 de salida). */
function costeTipico(modelo: string): string {
  const c = costeIA(modelo, 10_000, 2_000);
  return c < 0.01 ? 'menos de 1 céntimo' : `unos ${Math.round(c * 100)} céntimos`;
}

export function AjustesIAForm({ inicial, hayClave }: { inicial: AjustesIA; hayClave: boolean }) {
  const [ajustes, setAjustes] = useState(inicial);
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

  return (
    <div className="space-y-5">
      <div
        className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
          hayClave
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'
        }`}
      >
        {hayClave ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {hayClave ? (
            <>La clave de la API de Anthropic está puesta.</>
          ) : (
            <>
              Falta la clave de la API de Anthropic. Es una <b>variable de entorno</b>, <code className="text-xs">ANTHROPIC_API_KEY</code>:
              se crea en platform.claude.com (API keys) y se pega en Vercel → Settings → Environment Variables. Luego, redesplegar.
            </>
          )}{' '}
          <span className="opacity-80">La clave es un secreto: nunca se guarda en la base de datos ni se enseña aquí.</span>
        </span>
      </div>

      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Análisis con IA activado</span>
          <span className="block text-xs text-zinc-500">Apagado, el botón «Analizar con IA» no sale en ningún sitio.</span>
        </span>
        <input
          type="checkbox"
          checked={ajustes.activado}
          onChange={(e) => setAjustes({ ...ajustes, activado: e.target.checked })}
          className="h-5 w-5 accent-violet-600"
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
                className={`cursor-pointer rounded-xl p-3 ring-1 transition-colors ${
                  on
                    ? 'bg-violet-50 ring-2 ring-violet-500 dark:bg-violet-500/10'
                    : 'bg-white ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800'
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
                  {on && <Sparkles className="h-3.5 w-3.5 text-violet-600" />}
                  {m.label}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">{m.nota}</span>
                <span className="mt-1.5 block text-[11px] text-zinc-400">Un análisis: {costeTipico(m.id)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Lo que la IA debería saber del colegio</span>
        <span className="mb-1.5 block text-xs text-zinc-500">
          Va en cada análisis. Por ejemplo: qué es un Godly Play o un oratorio, el lema y el rasgo carismático del curso, cómo se
          organiza la ESO… Sin nombres de alumnos.
        </span>
        <textarea
          value={ajustes.contexto}
          onChange={(e) => setAjustes({ ...ajustes, contexto: e.target.value })}
          rows={5}
          maxLength={4000}
          placeholder="Somos un colegio de las Hermanas de la Consolación en Burriana. El lema de este curso es «Sin rodeos»…"
          className="w-full rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 dark:bg-zinc-800/40 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:bg-zinc-800"
        />
      </label>

      <div className="flex items-center justify-end gap-3">
        {cambiado && <span className="text-xs text-amber-600">Cambios sin guardar</span>}
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !cambiado}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
