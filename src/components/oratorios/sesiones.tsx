'use client';

// 📋 Sesiones: la lista del curso con sus estados, y los avisos en bloque (enviar todos los
// pendientes, programarlos a 7 días). Las acciones en bloque van sobre lo que se ve con el
// filtro puesto: sin casillas que marcar una a una.
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { chipAviso, chipEstado, diaCorto, diaSemana, estaActiva, fechaCorta, horaBonita, nombreMesCorto, profesDe, trimestreDe, type SesionOra } from '@/lib/oratorios';
import { nombreClase } from '@/lib/cursos';
import { Accion, ChipVista, Pastilla } from './comun';
import type { Estado } from './panel';

type Filtro = 'vivas' | 'borrador' | 'avisar' | 'reprogramar' | 'anulado' | 'hechas' | 'todas';
const FILTROS: [Filtro, string][] = [
  ['vivas', '📅 Próximas'],
  ['avisar', '✉️ Por avisar'],
  ['borrador', '📝'],
  ['reprogramar', '🔁'],
  ['hechas', '✔️'],
  ['anulado', '✖️'],
  ['todas', 'Todas'],
];

function pasa(s: SesionOra, f: Filtro, hoy: string): boolean {
  switch (f) {
    case 'vivas':
      return estaActiva(s) && s.fecha >= hoy;
    case 'avisar':
      return (s.estado === 'confirmado' && s.avisoEstado === 'pendiente') || (s.estado === 'anulado' && s.avisoEstado === 'pendiente');
    case 'hechas':
      return s.estado === 'confirmado' && s.fecha < hoy;
    case 'todas':
      return true;
    default:
      return s.estado === f;
  }
}

export function ListaSesiones({ e }: { e: Estado }) {
  const hoy = e.datos.hoy;
  const [tipo, setTipo] = useState<string>('*');
  const [filtro, setFiltro] = useState<Filtro>('vivas');
  const [tri, setTri] = useState<number>(-1);
  const [soloMias, setSoloMias] = useState(false);

  const visibles = useMemo(
    () =>
      e.sesiones.filter(
        (s) =>
          (tipo === '*' || s.tipoId === tipo) &&
          pasa(s, filtro, hoy) &&
          (tri < 0 || trimestreDe(s.fecha, e.ajustes.trimestres) === tri) &&
          (!soloMias || s.responsableEmail === e.datos.yo.email),
      ),
    [e.sesiones, tipo, filtro, hoy, tri, soloMias, e.ajustes.trimestres, e.datos.yo.email],
  );

  const porAvisar = visibles.filter((s) => (s.estado === 'confirmado' && (s.avisoEstado === 'pendiente' || s.avisoEstado === 'programado')) || (s.estado === 'anulado' && s.avisoEstado === 'pendiente'));
  const sinProgramar = visibles.filter((s) => s.estado === 'confirmado' && s.avisoEstado === 'pendiente' && s.fecha > hoy);
  const borradores = visibles.filter((s) => s.estado === 'borrador');
  const cuenta = (f: Filtro) => e.sesiones.filter((s) => (tipo === '*' || s.tipoId === tipo) && pasa(s, f, hoy)).length;

  // Agrupadas por mes, que es como se piensa en esto.
  const porMes = new Map<string, SesionOra[]>();
  for (const s of visibles) porMes.set(s.fecha.slice(0, 7), [...(porMes.get(s.fecha.slice(0, 7)) ?? []), s]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Pastilla activa={tipo === '*'} onClick={() => setTipo('*')}>
          Todos
        </Pastilla>
        {e.tipos.map((t) => (
          <Pastilla key={t.id} activa={tipo === t.id} onClick={() => setTipo(t.id)}>
            {t.emoji} {t.nombre}
          </Pastilla>
        ))}
        <Pastilla activa={soloMias} onClick={() => setSoloMias(!soloMias)} title="Solo las que llevo yo">
          👤 Mías
        </Pastilla>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map(([f, t]) => {
          const n = cuenta(f);
          return (
            <Pastilla key={f} activa={filtro === f} onClick={() => setFiltro(f)}>
              {t} {f !== 'todas' && <span className="tabular-nums opacity-70">{n}</span>}
            </Pastilla>
          );
        })}
        <span className="mx-1 border-l border-zinc-200 dark:border-zinc-700" />
        {e.ajustes.trimestres.map((_, i) => (
          <Pastilla key={i} activa={tri === i} onClick={() => setTri(tri === i ? -1 : i)}>
            T{i + 1}
          </Pastilla>
        ))}
      </div>

      {(porAvisar.length > 0 || borradores.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {porAvisar.length > 0 && (
            <Accion
              tono="azul"
              disabled={e.ocupado}
              onClick={() => {
                if (window.confirm(`¿Enviar ya ${porAvisar.length} avisos? Un correo por profe, desde el buzón de quien lo lleva.`)) void e.lote('enviar', porAvisar.map((s) => s.id));
              }}
            >
              📨 Enviar ({porAvisar.length})
            </Accion>
          )}
          {sinProgramar.length > 0 && (
            <Accion disabled={e.ocupado} onClick={() => void e.lote('programar', sinProgramar.map((s) => s.id), 7)} title="Programar los pendientes 7 días antes">
              ⏰ 7d ({sinProgramar.length})
            </Accion>
          )}
          {borradores.length > 0 && (
            <Accion
              tono="verde"
              disabled={e.ocupado}
              onClick={() => {
                if (window.confirm(`¿Confirmar ${borradores.length}? Se crean los eventos y se invita a los profes.`)) void e.lote('confirmar', borradores.map((s) => s.id));
              }}
            >
              ✅ ({borradores.length})
            </Accion>
          )}
        </div>
      )}

      {visibles.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">Nada por aquí.</p>}

      {[...porMes].map(([mes, lista]) => (
        <section key={mes} className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {nombreMesCorto(Number(mes.slice(5, 7)))} {mes.slice(0, 4)} · {lista.length}
          </h3>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {lista.map((s) => {
              const t = e.tipos.find((x) => x.id === s.tipoId);
              const aviso = chipAviso(s);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => e.abrir(s.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <span className="w-16 shrink-0 text-sm tabular-nums">
                      <b>
                        <span className="font-normal text-zinc-400">{diaCorto(diaSemana(s.fecha))}</span> {fechaCorta(s.fecha)}
                      </b>
                      <span className="block text-[11px] text-zinc-500">{horaBonita(s.horaInicio)}</span>
                    </span>
                    <span aria-hidden>{t?.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {nombreClase(s.curso, s.letra)} <span className="text-zinc-400">· S{s.numero}</span>
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {profesDe(s).map((p) => p.nombre).join(', ') || '—'}
                        {s.responsableEmail !== e.datos.yo.email && ` · 👤 ${s.responsableNombre ?? s.responsableEmail}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <ChipVista chip={chipEstado(s, hoy)} corto />
                      {aviso && <ChipVista chip={aviso} />}
                    </span>
                    {(s.calendarioError || s.avisoError) && (
                      <span className={cn('text-amber-600')} title={s.calendarioError ?? s.avisoError ?? ''}>
                        ⚠️
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
