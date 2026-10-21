export const dynamic = 'force-dynamic';

import { Code2, Cloud, MousePointerClick, Palette, Sparkles } from 'lucide-react';
import { getAjustesIA, hayClaveIA } from '@/lib/ajustes-server';
import { inventarioCentro, inventarioEntorno, type OrigenAjuste } from '@/lib/ajustes-inventario';
import { AjustesIAForm } from '@/components/ajustes/ia-form';
import { huellaClaveIA } from '@/lib/evaluaciones-ia-server';
import { Rotulo } from '@/components/ui/rotulo';
import { Estado, type TonoEstado } from '@/components/ui/estado';
import { Tarjeta, TarjetaCuerpo, TarjetaEnlace } from '@/components/ui/tarjeta';

export const metadata = { title: 'Ajustes del colegio · Tools Consolación' };

const ORIGEN: Record<OrigenAjuste, { label: string; tono: TonoEstado; icono: React.ReactNode }> = {
  app: { label: 'Se cambia aquí', tono: 'info', icono: <MousePointerClick aria-hidden /> },
  entorno: { label: 'Variable de entorno', tono: 'neutro', icono: <Cloud aria-hidden /> },
  codigo: { label: 'En el código', tono: 'neutro', icono: <Code2 aria-hidden /> },
};

function Origen({ origen }: { origen: OrigenAjuste }) {
  const o = ORIGEN[origen];
  return (
    <Estado tono={o.tono} icono={o.icono}>
      {o.label}
    </Estado>
  );
}

export default async function AjustesPage() {
  const ia = await getAjustesIA();
  const secciones = inventarioCentro();
  const entorno = inventarioEntorno();

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Ajustes del colegio: qué se puede ajustar y dónde vive cada cosa</h1>
      <div className="flex flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:flex-wrap dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <Origen origen="app" /> se guarda al momento
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Origen origen="entorno" /> Vercel → Settings → Environment Variables, y redesplegar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Origen origen="codigo" /> con un cambio en el repo (por ahora)
        </span>
      </div>

      <section className="space-y-2">
        <Rotulo className="flex items-center gap-1.5">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> Inteligencia artificial (Claude)
        </Rotulo>
        <Tarjeta>
          <TarjetaCuerpo>
            <AjustesIAForm inicial={{ activado: ia.activado, modelo: ia.modelo, contexto: ia.contexto }} hayClave={hayClaveIA()} huella={huellaClaveIA()} />
            {ia.updatedAt && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Último cambio: {ia.updatedAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
                {ia.updatedByEmail && ` · ${ia.updatedByEmail}`}
              </p>
            )}
          </TarjetaCuerpo>
        </Tarjeta>
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          Se usa en Evaluaciones → Resultados («Lo que ve la IA»). Se mandan las cifras y los comentarios escritos, sin nombres ni
          correos (en profesorado la base de datos ni siquiera los tiene). Cada análisis se guarda y no se repite solo.
        </p>
      </section>

      {secciones.map((s) => (
        <section key={s.titulo} className="space-y-2">
          <Rotulo>{s.titulo}</Rotulo>
          <Tarjeta className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {s.ajustes.map((a) => (
              <div key={a.nombre} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{a.nombre}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{a.valor}</p>
                  {a.nota && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{a.nota}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <Origen origen={a.origen} />
                  <code className="text-xs break-all text-zinc-500 dark:text-zinc-400">{a.donde}</code>
                </div>
              </div>
            ))}
          </Tarjeta>
        </section>
      ))}

      <section className="space-y-2">
        <Rotulo>Variables de entorno</Rotulo>
        <Tarjeta className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {entorno.map((v) => (
            <div key={v.nombre} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <code className="text-xs font-semibold break-all text-zinc-800 dark:text-zinc-200">{v.nombre}</code>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{v.para}</p>
                {v.valor && <p className="mt-0.5 text-xs break-all text-zinc-500 dark:text-zinc-400">{v.valor}</p>}
              </div>
              <Estado tono={v.puesta ? 'ok' : v.obligatoria ? 'error' : 'neutro'}>
                {v.puesta ? 'Puesta' : v.obligatoria ? 'Falta' : 'Sin fijar'}
              </Estado>
            </div>
          ))}
        </Tarjeta>
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          De las secretas solo se dice si están puestas. Qué es cada una y cómo se consigue: <code>docs/04-convenciones-tecnicas.md</code> y{' '}
          <code>docs/08-despliegue-y-fork.md</code>. Lo que todavía vive en el código y podría pasar aquí está en{' '}
          <code>docs/09-parametros-del-centro.md</code>.
        </p>
      </section>

      <section className="space-y-2">
        <Rotulo>Para construir pantallas</Rotulo>
        <TarjetaEnlace
          href="/gestion/diseno"
          icono={<Palette aria-hidden />}
          titulo="Piezas de diseño"
          descripcion="El escaparate de botones, campos, tarjetas y demás piezas comunes, con su línea de import."
        />
      </section>
    </div>
  );
}
