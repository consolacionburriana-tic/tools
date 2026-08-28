export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { eduStudents, evalInvites } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { claseLabel } from '@/lib/evaluaciones';
import { getClasesDisponibles, getFormPorToken } from '@/lib/evaluaciones-server';
import { ResponderForm } from '@/components/evaluaciones/responder-form';

export const metadata = {
  title: 'Evaluación · Consolación',
  description: 'Formulario de evaluación de actividades',
};

const ACENTO_POR_DEFECTO = '#2563eb';

/**
 * Manchas de color de fondo, muy suaves: es el "elemento decorativo por el fondito"
 * para que la pantalla no sea un formulario a secas. `fixed` para que acompañen al
 * hacer scroll; hermanas de `<main>` (no dentro de `.anim-stagger`) para no arrastrar
 * el problema de contexto de apilamiento de las tarjetas animadas — ver
 * `docs/16-evaluaciones.md`. Se mueven muy despacio y solo si no se ha pedido
 * reducir el movimiento (`motion-safe:`).
 */
function FondoDecorativo({ color }: { color: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        style={{ background: color }}
        className="absolute -left-24 -top-28 h-72 w-72 rounded-full opacity-[0.14] blur-3xl motion-safe:animate-[eval-blob-flotar_22s_ease-in-out_infinite] dark:opacity-[0.22]"
      />
      <div
        style={{ background: color }}
        className="absolute -right-24 top-1/3 h-80 w-80 rounded-full opacity-[0.10] blur-3xl motion-safe:animate-[eval-blob-flotar_27s_ease-in-out_infinite_reverse] dark:opacity-[0.18]"
      />
      <div
        style={{ background: color }}
        className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full opacity-[0.09] blur-3xl motion-safe:animate-[eval-blob-flotar_19s_ease-in-out_infinite] dark:opacity-[0.16]"
      />
    </div>
  );
}

/**
 * Formulario público de evaluación. Dos llaves posibles en la URL:
 *   /evaluaciones/<token>          → enlace común (profesorado, o alumnado sin envío)
 *   /evaluaciones/<token>?a=<inv>  → enlace personalizado del alumnado: ya sabemos su
 *                                    clase (un toque menos) y la respuesta queda ligada
 *                                    internamente a su ficha.
 */
export default async function ResponderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { token } = await params;
  const { a } = await searchParams;
  const form = await getFormPorToken(token);
  if (!form) notFound();

  const cerrado = form.estado === 'cerrado';
  const vistaPrevia = form.estado === 'borrador';

  // El enlace personalizado solo se resuelve si el formulario lo tiene activado y no es
  // de profesorado (esas evaluaciones son 100 % anónimas, sin excepción).
  let claseConocida: string | null = null;
  let invite: string | null = null;
  if (a && form.identificaAlumno && form.audiencia !== 'profesores') {
    const [inv] = await db
      .select({ id: evalInvites.id, eduStudentId: evalInvites.eduStudentId })
      .from(evalInvites)
      .where(and(eq(evalInvites.token, a), eq(evalInvites.formId, form.id)))
      .limit(1);
    if (inv?.eduStudentId) {
      invite = a;
      const [al] = await db
        .select({ curso: eduStudents.curso, letra: eduStudents.letra })
        .from(eduStudents)
        .where(eq(eduStudents.id, inv.eduStudentId))
        .limit(1);
      if (al?.curso) claseConocida = claseLabel({ curso: al.curso, letra: al.letra });
    }
  }

  const clases = form.pedirClase && !claseConocida ? await getClasesDisponibles() : [];
  const disponibles = (form.clases ?? []).length > 0 ? (form.clases ?? []) : clases;
  const acento = form.color ?? ACENTO_POR_DEFECTO;

  return (
    <div
      className="min-h-screen bg-[var(--eval-fondo-claro)] dark:bg-[var(--eval-fondo-oscuro)]"
      style={
        {
          // Fondo "muy clarito de ese color" (claro) y un tinte discreto en oscuro:
          // color-mix nativo del navegador, mismo patrón que ya usa el dashboard de
          // resultados para la rampa de escalas (ver resultados-panel.tsx).
          '--eval-fondo-claro': `color-mix(in oklab, ${acento} 6%, white)`,
          '--eval-fondo-oscuro': `color-mix(in oklab, ${acento} 16%, #09090b)`,
        } as React.CSSProperties
      }
    >
      <FondoDecorativo color={acento} />
      <main className="anim-stagger relative mx-auto w-full max-w-xl px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
            <Image
              src="/logobur.png"
              alt="Colegio Consolación · Burriana"
              width={250}
              height={125}
              priority
              className="h-auto w-[210px] sm:w-[250px]"
            />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{form.titulo}</h1>
          {claseConocida && <p className="mt-1 text-sm text-zinc-500">{claseConocida}</p>}
        </div>

        {cerrado ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-semibold text-zinc-800 dark:text-zinc-100">Esta evaluación ya está cerrada</p>
            <p className="mt-1 text-sm text-zinc-500">Gracias de todas formas por pasarte 🙂</p>
          </div>
        ) : (
          <ResponderForm
            token={form.token}
            invite={invite}
            audiencia={form.audiencia}
            colorForm={acento}
            descripcion={form.descripcion}
            avisoAnonimato={form.avisoAnonimato}
            pedirClase={form.pedirClase}
            pedirEtapa={form.pedirEtapa}
            clases={disponibles}
            claseConocida={claseConocida}
            soloVistaPrevia={vistaPrevia}
            bloques={form.bloques.map((b) => ({
              id: b.id,
              titulo: b.titulo,
              intro: b.intro,
              color: b.actividad?.color ?? null,
              preguntas: b.preguntas.map((q) => ({
                id: q.id,
                texto: q.texto,
                ayuda: q.ayuda,
                tipo: q.tipo,
                escala: q.escala,
                estilo: q.estilo,
                filas: q.filas,
                // Las respuestas correctas de un quiz NO viajan al navegador: se corrigen
                // en el servidor al enviar.
                opciones: q.opciones.map((o) => ({ clave: o.clave, texto: o.texto })),
                permiteOtra: q.permiteOtra,
                obligatoria: q.obligatoria,
              })),
            }))}
          />
        )}
      </main>
    </div>
  );
}
