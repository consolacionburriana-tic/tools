import { redirect } from 'next/navigation';
import { CalendarCheck2, UserX } from 'lucide-react';
import { getSessionUser } from '@/lib/auth-guards';
import { hoyEnEspana, sumarDias } from '@/lib/oratorios';
import { fechaLarga, hora, mayuscula, rangoLargo } from '@/lib/sustituciones';
import { misSustituciones, type MiSustitucion } from '@/lib/sustituciones-server';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { rotuloDiaMio, TarjetaMia } from '@/components/sustituciones/mis-sustituciones';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis sustituciones · Consolación' };

export default async function MisSustitucionesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/gestion/login');
  const hoy = hoyEnEspana();
  const manana = sumarDias(hoy, 1);
  const datos = await misSustituciones(user.email, hoy);
  const porDia = new Map<string, MiSustitucion[]>();
  for (const s of datos.proximas) porDia.set(s.fecha, [...(porDia.get(s.fecha) ?? []), s]);
  return (
    <div className="space-y-6">
      <h1 className="sr-only">Mis sustituciones</h1>
      {!datos.profeId ? (
        <Vacio icono={<UserX />} titulo="Tu correo no está enlazado a ningún profe">
          {user.email} no aparece en la BBDD central. Habla con TIC para que lo revisen.
        </Vacio>
      ) : (
        <>
          {porDia.size === 0 ? (
            <Vacio icono={<CalendarCheck2 />} titulo="No tienes sustituciones a la vista">
              Cuando te toque cubrir una hora te llegará un correo, y aparecerá aquí.
            </Vacio>
          ) : (
            [...porDia].map(([fecha, lista]) => (
              <section key={fecha} className="space-y-2">
                <Rotulo>{rotuloDiaMio(fecha, hoy, manana)}</Rotulo>
                {lista.map((s) => (
                  <TarjetaMia key={s.id} s={s} hoy={hoy} />
                ))}
              </section>
            ))
          )}
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
        </>
      )}
    </div>
  );
}
