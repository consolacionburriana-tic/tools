'use client';

// Lo que ve el claustro con `oratorios-ver` (si quien lo lleva ha encendido el acceso común):
// solo las sesiones confirmadas que le quitan una hora, o que lleva. De solo lectura.
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Segmentado } from '@/components/ui/segmentado';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { cn } from '@/lib/utils';
import { nombreClase } from '@/lib/cursos';
import { chipEstado, fechaLarga, horaBonita, profesDe, type SesionOra } from '@/lib/oratorios';
import type { DatosMios } from '@/lib/oratorios-server';
import { capital, EstadoChip } from './comun';

export function MisOratorios({ datos, email }: { datos: DatosMios; email: string }) {
  const [pasadas, setPasadas] = useState(false);
  const proximas = datos.sesiones.filter((s) => s.fecha >= datos.hoy);
  const hechas = datos.sesiones.filter((s) => s.fecha < datos.hoy);
  const lista = pasadas ? [...hechas].reverse() : proximas;

  return (
    <div className="space-y-3">
      <Segmentado
        etiqueta="Qué sesiones ver"
        valor={pasadas ? 'pasadas' : 'proximas'}
        onChange={(v) => setPasadas(v === 'pasadas')}
        opciones={[
          { valor: 'proximas', etiqueta: 'Próximas', cuenta: proximas.length },
          { valor: 'pasadas', etiqueta: 'Pasadas', cuenta: hechas.length },
        ]}
      />
      {lista.length === 0 && <Vacio icono={<CalendarDays />} titulo={pasadas ? 'Todavía no hay sesiones pasadas' : 'No tienes sesiones próximas'} />}
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
    <li className={cn(claseTarjeta, 'p-4', s.estado === 'anulado' && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="text-xl">{tipo?.emoji}</span>
        <b>{nombreClase(s.curso, s.letra)}</b>
        <span className="text-zinc-500">{tipo?.nombre}</span>
        <EstadoChip chip={chipEstado(s, datos.hoy)} className="ml-auto" />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm">
        <CalendarDays className="h-4 w-4 text-zinc-400" aria-hidden /> {capital(fechaLarga(s.fecha))} · {horaBonita(s.horaInicio)}–{horaBonita(s.horaFin)}
      </p>
      <p className="text-sm text-zinc-500">
        {lleva ? profesDe(s).map((p) => `${p.materia ?? '—'} · ${p.nombre}`).join(', ') || '—' : `Lo lleva ${s.responsableNombre ?? s.responsableEmail}`}
      </p>
    </li>
  );
}
