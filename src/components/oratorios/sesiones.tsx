'use client';

// Agenda: la lista de momentos del curso con sus estados, y los avisos en bloque (enviar todos los
// pendientes, programarlos a 7 días). Las acciones en bloque van sobre lo que se ve con el
// filtro puesto: sin casillas que marcar una a una.
import { AlarmClock, CalendarSearch, CheckCheck, Send, TriangleAlert, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirmar } from '@/components/ui/confirmar';
import { Estado as EstadoPastilla } from '@/components/ui/estado';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Rotulo } from '@/components/ui/rotulo';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { cn } from '@/lib/utils';
import { chipAviso, chipEstado, diaCorto, diaSemana, estaActiva, fechaCorta, horaBonita, nombreMesCorto, profesDe, trimestreDe, type SesionOra } from '@/lib/oratorios';
import { nombreClase } from '@/lib/cursos';
import { EstadoChip } from './comun';
import type { Estado } from './panel';

type FiltroLista = 'vivas' | 'borrador' | 'avisar' | 'reprogramar' | 'anulado' | 'hechas' | 'todas';
const FILTROS: [FiltroLista, string][] = [
  ['vivas', 'Próximas'],
  ['avisar', 'Por avisar'],
  ['borrador', 'Borradores'],
  ['reprogramar', 'Reprogramar'],
  ['hechas', 'Hechas'],
  ['anulado', 'Anuladas'],
  ['todas', 'Todas'],
];

function pasa(s: SesionOra, f: FiltroLista, hoy: string): boolean {
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
  const [filtro, setFiltro] = useState<FiltroLista>('vivas');
  const { confirmar, dialogo } = useConfirmar();
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
  const cuenta = (f: FiltroLista) => e.sesiones.filter((s) => (tipo === '*' || s.tipoId === tipo) && pasa(s, f, hoy)).length;

  // Agrupadas por mes, que es como se piensa en esto.
  const porMes = new Map<string, SesionOra[]>();
  for (const s of visibles) porMes.set(s.fecha.slice(0, 7), [...(porMes.get(s.fecha.slice(0, 7)) ?? []), s]);

  return (
    <div className="space-y-3">
      <Filtros etiqueta="Tipo de momento">
        <Filtro activo={tipo === '*'} onClick={() => setTipo('*')}>
          Todos
        </Filtro>
        {e.tipos.map((t) => (
          <Filtro key={t.id} activo={tipo === t.id} onClick={() => setTipo(t.id)}>
            <span aria-hidden>{t.emoji}</span> {t.nombre}
          </Filtro>
        ))}
        <Filtro activo={soloMias} onClick={() => setSoloMias(!soloMias)} icono={<User />}>
          Solo las mías
        </Filtro>
      </Filtros>
      <div className="flex flex-wrap items-center gap-2">
        <Filtros etiqueta="Estado">
          {FILTROS.map(([f, t]) => (
            <Filtro key={f} activo={filtro === f} onClick={() => setFiltro(f)} cuenta={f !== 'todas' ? cuenta(f) : undefined}>
              {t}
            </Filtro>
          ))}
        </Filtros>
        <span aria-hidden className="mx-1 h-6 border-l border-zinc-200 dark:border-zinc-700" />
        <Filtros etiqueta="Trimestre">
          {e.ajustes.trimestres.map((_, i) => (
            <Filtro key={i} activo={tri === i} onClick={() => setTri(tri === i ? -1 : i)}>
              T{i + 1}
            </Filtro>
          ))}
        </Filtros>
      </div>

      {(porAvisar.length > 0 || borradores.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {porAvisar.length > 0 && (
            <Button
              disabled={e.ocupado}
              onClick={async () => {
                const si = await confirmar({
                  titulo: `¿Enviar ya ${porAvisar.length} ${porAvisar.length === 1 ? 'aviso' : 'avisos'}?`,
                  descripcion: 'Un correo por profe, desde el buzón de quien lo lleva.',
                  boton: `Enviar ${porAvisar.length}`,
                  peligro: false,
                });
                if (si) void e.lote('enviar', porAvisar.map((s) => s.id));
              }}
            >
              <Send /> Enviar avisos ({porAvisar.length})
            </Button>
          )}
          {sinProgramar.length > 0 && (
            <Button variant="outline" disabled={e.ocupado} onClick={() => void e.lote('programar', sinProgramar.map((s) => s.id), 7)}>
              <AlarmClock /> Programar 7 días antes ({sinProgramar.length})
            </Button>
          )}
          {borradores.length > 0 && (
            <Button
              variant="outline"
              disabled={e.ocupado}
              onClick={async () => {
                const si = await confirmar({
                  titulo: `¿Confirmar ${borradores.length} ${borradores.length === 1 ? 'sesión' : 'sesiones'}?`,
                  descripcion: 'Se crean los eventos en Google Calendar y se invita a los profes.',
                  boton: `Confirmar ${borradores.length}`,
                  peligro: false,
                });
                if (si) void e.lote('confirmar', borradores.map((s) => s.id));
              }}
            >
              <CheckCheck /> Confirmar ({borradores.length})
            </Button>
          )}
        </div>
      )}

      {visibles.length === 0 && <Vacio icono={<CalendarSearch />} titulo="Nada por aquí">Prueba con otro filtro.</Vacio>}

      {[...porMes].map(([mes, lista]) => (
        <section key={mes} className="space-y-1">
          <Rotulo as="h3">
            {nombreMesCorto(Number(mes.slice(5, 7)))} {mes.slice(0, 4)} · {lista.length}
          </Rotulo>
          <ul className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
            {lista.map((s) => {
              const t = e.tipos.find((x) => x.id === s.tipoId);
              const aviso = chipAviso(s);
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => e.abrir(s.id)} className="flex min-h-14 w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset dark:hover:bg-zinc-800">
                    <span className="w-16 shrink-0 text-sm tabular-nums">
                      <b>
                        <span className="font-normal text-zinc-500">{diaCorto(diaSemana(s.fecha))}</span> {fechaCorta(s.fecha)}
                      </b>
                      <span className="block text-xs text-zinc-500">{horaBonita(s.horaInicio)}</span>
                    </span>
                    <span aria-hidden>{t?.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {nombreClase(s.curso, s.letra)} <span className="text-zinc-500">· S{s.numero}</span>
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {profesDe(s).map((p) => p.nombre).join(', ') || '—'}
                        {s.responsableEmail !== e.datos.yo.email && ` · lo lleva ${s.responsableNombre ?? s.responsableEmail}`}
                        {s.catalogoId && ` · ${e.catalogo.find((c) => c.id === s.catalogoId)?.nombre ?? ''}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <EstadoChip chip={chipEstado(s, hoy)} />
                      {aviso && <EstadoChip chip={aviso} />}
                      {(s.calendarioError || s.avisoError) && (
                        <EstadoPastilla tono="error" icono={<TriangleAlert aria-hidden />} title={s.calendarioError ?? s.avisoError ?? ''}>
                          {s.calendarioError ? 'Fallo en Calendar' : 'Fallo en el correo'}
                        </EstadoPastilla>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {dialogo}
    </div>
  );
}
