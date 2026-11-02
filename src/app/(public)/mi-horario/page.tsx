import { redirect } from 'next/navigation';
import { CalendarDays, UserX } from 'lucide-react';

import { getSessionUser } from '@/lib/auth-guards';
import { canAccess } from '@/lib/permissions';
import { getProfePorEmail } from '@/lib/mihorario-server';
import { getCeldas, getFranjasDeProfe, getPeriodos, getPeriodoVigente } from '@/lib/horarios-server';
import { Navegador } from '@/components/horarios/navegador';
import { SelectorPeriodo } from '@/components/horarios/selector-periodo';
import { Exportador } from '@/components/mihorario/exportador';
import { SelectorDe } from '@/components/mihorario/selector-de';
import { Aviso } from '@/components/ui/aviso';
import { Vacio } from '@/components/ui/vacio';
import { titularesCubiertosPor } from '@/lib/sustituciones-server';

export const dynamic = 'force-dynamic';

function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}/${a}`;
}

export const metadata = {
  title: 'Mi horario · Consolación',
  description: 'Tu horario, y llevártelo a Google Calendar',
};

export default async function MiHorarioPage({ searchParams }: { searchParams: Promise<{ periodo?: string; de?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login?volver=/mi-horario');
  if (!canAccess(user, 'mi-horario')) redirect('/gestion/sin-acceso');

  const profe = await getProfePorEmail(user.email);

  // Quién soy, los periodos, el vigente y a quién estoy sustituyendo: cuatro cosas que no
  // dependen unas de otras.
  const [periodos, vigente, titulares] = await Promise.all([
    getPeriodos(),
    getPeriodoVigente(),
    profe ? titularesCubiertosPor(profe.id) : Promise.resolve([]),
  ]);
  const periodo = periodos.find((p) => p.id === sp.periodo) ?? vigente;

  // Las franjas (recreo y horas sin clase) van en paralelo a las celdas: son consultas
  // independientes y un viaje a Neon cuesta ~127 ms. También las de a quien sustituyo.
  const [celdas, franjas, deTitulares] =
    profe && periodo
      ? await Promise.all([
          getCeldas(periodo.id, 'profe', profe.id),
          getFranjasDeProfe(periodo.id, profe.id),
          Promise.all(
            titulares.map(async (t) => {
              const [suyas, franjasT] = await Promise.all([getCeldas(periodo.id, 'profe', t.id), getFranjasDeProfe(periodo.id, t.id)]);
              // Lo que el titular se haya anotado a mano en sus huecos es suyo: se ve el horario importado.
              return { id: t.id, celdas: suyas.filter((c) => c.origen !== 'manual'), franjas: franjasT };
            }),
          ),
        ])
      : [[], [], []];

  // Qué horario se ve: el que se pide con `?de=`; si no, el mío — salvo que no tenga clases
  // propias y sustituya a alguien (quien llega a cubrir una baja suele no tener horario aún).
  const pedido = titulares.find((t) => t.id === sp.de);
  const sinHorarioPropio = celdas.length === 0 && franjas.length === 0;
  const viendo = sp.de === 'yo' ? undefined : (pedido ?? (sinHorarioPropio ? titulares[0] : undefined));
  const delViendo = viendo ? deTitulares.find((d) => d.id === viendo.id) : undefined;
  const celdasVistas = delViendo?.celdas ?? celdas;
  const franjasVistas = delViendo?.franjas ?? franjas;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Mi horario</h1>
      {!profe ? (
        <Vacio icono={<UserX />} titulo="Tu correo no está enlazado a ningún profesor">
          {user.email} no aparece en la BBDD central. Habla con TIC para que lo revisen.
        </Vacio>
      ) : !periodo ? (
        <Vacio icono={<CalendarDays />} titulo="Todavía no hay ningún horario importado" />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {viendo ? viendo.nombre : [profe.nombre, profe.apellido1].filter(Boolean).join(' ')}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {periodo.nombre} · curso {periodo.academicYear}
              </p>
            </div>
            {periodos.length > 1 && <SelectorPeriodo periodos={periodos} actual={periodo.id} basePath="/mi-horario" />}
          </div>

          {titulares.length > 0 && (
            <SelectorDe
              actual={viendo?.id ?? 'yo'}
              opciones={[
                { id: 'yo', etiqueta: 'Mi horario' },
                ...titulares.map((t) => ({ id: t.id, etiqueta: `El de ${t.nombre.split(' ')[0]} (sustituyes)` })),
              ]}
            />
          )}

          {viendo ? (
            <>
              <Aviso tono="info">
                Estás viendo el horario de <strong>{viendo.nombre}</strong>, a quien sustituyes
                {viendo.hasta ? ` hasta el ${fechaCorta(viendo.hasta)}` : ''}. Es solo para consultarlo: no se anota
                ni se exporta desde aquí.
              </Aviso>
              <Navegador celdas={celdasVistas} franjas={franjasVistas} titulo={viendo.nombre} />
            </>
          ) : (
            <>
              <Navegador celdas={celdasVistas} franjas={franjasVistas} titulo="tu horario" editable={{ periodoId: periodo.id }} />

              <Exportador periodoId={periodo.id} />
            </>
          )}
        </>
      )}
    </div>
  );
}
