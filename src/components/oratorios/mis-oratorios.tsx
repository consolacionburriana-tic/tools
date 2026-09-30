'use client';

// Lo que ve el claustro con `oratorios-ver` (si quien lo lleva ha encendido el acceso común):
// solo las sesiones confirmadas que le quitan una hora, o que lleva. De solo lectura.
import { useState } from 'react';
import { nombreClase } from '@/lib/cursos';
import { chipEstado, fechaLarga, horaBonita, profesDe, type SesionOra } from '@/lib/oratorios';
import type { DatosMios } from '@/lib/oratorios-server';
import { capital, ChipVista, Pastilla } from './comun';

export function MisOratorios({ datos, email }: { datos: DatosMios; email: string }) {
  const [pasadas, setPasadas] = useState(false);
  const proximas = datos.sesiones.filter((s) => s.fecha >= datos.hoy);
  const hechas = datos.sesiones.filter((s) => s.fecha < datos.hoy);
  const lista = pasadas ? [...hechas].reverse() : proximas;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <Pastilla activa={!pasadas} onClick={() => setPasadas(false)}>
          📅 Próximas <span className="opacity-70">{proximas.length}</span>
        </Pastilla>
        <Pastilla activa={pasadas} onClick={() => setPasadas(true)}>
          ✔️ Pasadas <span className="opacity-70">{hechas.length}</span>
        </Pastilla>
      </div>
      {lista.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">Nada por aquí 🙂</p>}
      <ul className="space-y-2">
        {lista.map((s) => (
          <Fila key={s.id} s={s} datos={datos} email={email} />
        ))}
      </ul>
    </div>
  );
}

function Fila({ s, datos, email }: { s: SesionOra; datos: DatosMios; email: string }) {
  const tipo = datos.tipos.find((t) => t.id === s.tipoId);
  const lleva = s.responsableEmail === email;
  return (
    <li className={`rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${s.estado === 'anulado' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{tipo?.emoji}</span>
        <b>{nombreClase(s.curso, s.letra)}</b>
        <span className="text-zinc-500">{tipo?.nombre}</span>
        <ChipVista chip={chipEstado(s, datos.hoy)} className="ml-auto" />
      </div>
      <p className="mt-1 text-sm">
        📅 {capital(fechaLarga(s.fecha))} · 🕘 {horaBonita(s.horaInicio)}–{horaBonita(s.horaFin)}
      </p>
      <p className="text-sm text-zinc-500">
        {lleva ? `📘 ${profesDe(s).map((p) => `${p.materia ?? '—'} · ${p.nombre}`).join(', ') || '—'}` : `👤 ${s.responsableNombre ?? s.responsableEmail}`}
      </p>
    </li>
  );
}
