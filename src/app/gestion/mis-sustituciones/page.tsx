import { redirect } from 'next/navigation';
import { CalendarPlus, CalendarX2, UserX } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { CONFIGURACION } from '@/lib/configuracion';
import { hoyEnEspana } from '@/lib/oratorios';
import { enlaceGoogleCalendar, fechaLarga, hora, lugarDe, mayuscula, rangoLargo } from '@/lib/sustituciones';
import { misSustituciones, type MiSustitucion } from '@/lib/sustituciones-server';
import { Aviso } from '@/components/ui/aviso';
import { buttonVariants } from '@/components/ui/button';
import { Estado } from '@/components/ui/estado';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis sustituciones · Consolación' };

function TarjetaHora({ s, pasada }: { s: MiSustitucion; pasada?: boolean }) {
  const lugar = lugarDe(s);
  return (
    <Tarjeta className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {hora(s.horaInicio)} – {hora(s.horaFin)}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{mayuscula(fechaLarga(s.fecha))}</p>
        </div>
        {s.enAula && <Estado tono="info">Ya estás en el aula</Estado>}
      </div>
      {lugar && <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">{lugar}</p>}
      <p className="text-sm text-zinc-600 dark:text-zinc-300">Cubres a {s.cubreA}</p>
      {s.indicaciones && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm whitespace-pre-line text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">{s.indicaciones}</p>}
      {!pasada && (
        <a
          href={enlaceGoogleCalendar({ titulo: `Sustitución · ${[s.grupos, s.materia].filter(Boolean).join(' · ') || s.cubreA}`, fecha: s.fecha, horaInicio: s.horaInicio, horaFin: s.horaFin, lugar: s.aula ? mayuscula(s.aula) : s.grupos, detalles: [`Cubres a ${s.cubreA}.`, s.indicaciones].filter(Boolean).join('\n\n') })}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <CalendarPlus aria-hidden /> Añadir a mi Google Calendar
        </a>
      )}
    </Tarjeta>
  );
}

export default async function MisSustitucionesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const hoy = hoyEnEspana();
  const datos = await misSustituciones(user.email, hoy);
  return (
    <div className="space-y-5">
      <h1 className="sr-only">Mis sustituciones</h1>
      {!CONFIGURACION.sustituciones.misSustitucionesParaTodos && (
        <Aviso tono="info" titulo="Prueba de concepto">
          De momento esta pantalla solo la ven Jefatura, Dirección, Secretaría y TIC. Para abrirla a todo el profesorado hay que cambiar{' '}
          <code className="font-mono text-xs">misSustitucionesParaTodos</code> en <code className="font-mono text-xs">src/lib/configuracion.ts</code> (docs/32, decisión 16).
        </Aviso>
      )}
      {!datos.profeId ? (
        <Vacio icono={<UserX />} titulo="Tu correo no está enlazado a ningún profe">
          {user.email} no aparece en la BBDD central. Habla con TIC para que lo revisen.
        </Vacio>
      ) : (
        <>
          {datos.teCubren.length > 0 && (
            <section className="space-y-2">
              <Rotulo>Te cubren</Rotulo>
              {datos.teCubren.map((t) => (
                <Tarjeta key={t.ausenciaId} className="p-4">
                  <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">{mayuscula(rangoLargo(t.desde, t.hasta))}</p>
                  <ul className="space-y-1.5">
                    {t.horas.map((h, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                          {t.desde !== t.hasta ? `${fechaLarga(h.fecha)} · ` : ''}
                          {hora(h.horaInicio)}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-300">{[h.grupos, h.materia].filter(Boolean).join(' · ')}</span>
                        <span className={h.quien || !h.hayQueCubrir ? 'text-zinc-900 dark:text-zinc-100' : 'text-amber-700 dark:text-amber-400'}>
                          {!h.hayQueCubrir ? '· no hace falta cubrirla' : h.quien ? `· entra ${h.quien}` : '· sin cubrir de momento'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              ))}
            </section>
          )}
          <section className="space-y-2">
            <Rotulo>Próximas</Rotulo>
            {datos.proximas.length === 0 ? (
              <Vacio icono={<CalendarX2 />} titulo="No tienes sustituciones a la vista" />
            ) : (
              datos.proximas.map((s) => <TarjetaHora key={s.id} s={s} />)
            )}
          </section>
          {datos.pasadas.length > 0 && (
            <section className="space-y-2">
              <Rotulo>Últimos 30 días</Rotulo>
              {datos.pasadas.map((s) => (
                <TarjetaHora key={s.id} s={s} pasada />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
