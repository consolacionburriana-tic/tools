'use client';

// Una sesión: qué es, en qué estado está y todo lo que se le puede hacer, con iconos.
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { chipAviso, chipEstado, etiquetaClase, fechaLarga, horaBonita, profesDe, type AccionSesion } from '@/lib/oratorios';
import { Accion, api, capital, ChipVista } from './comun';
import type { Estado } from './panel';

export function DetalleSesion({ e, id, onClose }: { e: Estado; id: string | null; onClose: () => void }) {
  const s = id ? e.sesiones.find((x) => x.id === id) : null;
  const [trabajando, setTrabajando] = useState(false);
  if (!s) return null;
  const tipo = e.tipos.find((t) => t.id === s.tipoId);
  const aviso = chipAviso(s);
  const avisable = (s.estado === 'confirmado' && s.avisoEstado !== 'enviado') || (s.estado === 'anulado' && s.avisoEstado === 'pendiente');

  async function accion(a: AccionSesion, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setTrabajando(true);
    try {
      const nueva = await api.accion(s!.id, a);
      e.guardarSesiones([nueva]);
      haptic.success();
      if (nueva.calendarioError) toast.warning(`⚠️ ${nueva.calendarioError}`);
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  async function borrar() {
    if (!window.confirm('¿Borrar este borrador?')) return;
    setTrabajando(true);
    try {
      await api.borrar(s!.id);
      e.guardarSesiones([], [s!.id]);
      haptic.success();
      onClose();
    } catch (err) {
      haptic.warning();
      toast.error(err instanceof Error ? err.message : 'No se ha podido');
    } finally {
      setTrabajando(false);
    }
  }

  const ocupado = trabajando || e.ocupado;
  const lote = (a: Parameters<typeof e.lote>[0], dias?: number) => void e.lote(a, [s.id], dias);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
          <span>{tipo?.emoji}</span>
          <span>[{etiquetaClase(s)}]</span>
          <span>{tipo?.nombre}</span>
          <span className="text-zinc-500">· S{s.numero}</span>
        </DialogTitle>

        <div className="flex flex-wrap gap-1.5">
          <ChipVista chip={chipEstado(s, e.datos.hoy)} />
          {aviso && <ChipVista chip={aviso} />}
          {s.googleEventId && <ChipVista chip={{ emoji: '📆', texto: 'En Calendar', tono: 'emerald' }} />}
        </div>

        <dl className="space-y-1 text-sm">
          <div>
            📅 {capital(fechaLarga(s.fecha))} · 🕘 {horaBonita(s.horaInicio)}–{horaBonita(s.horaFin)}
          </div>
          {profesDe(s).map((p) => (
            <div key={p.id}>
              📘 {p.materia ?? '—'} · <b>{p.nombre}</b>
            </div>
          ))}
          {profesDe(s).length === 0 && <div className="text-amber-700 dark:text-amber-300">👤? Sin profe: no se invitará a nadie</div>}
          <div className="text-zinc-500">👤 {s.responsableNombre ?? s.responsableEmail}</div>
        </dl>

        {s.calendarioError && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">⚠️ 📆 {s.calendarioError}</p>
        )}
        {s.avisoError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">⚠️ ✉️ {s.avisoError}</p>}

        {/* Estado */}
        <div className="flex flex-wrap gap-2">
          {s.estado === 'borrador' && (
            <Accion tono="verde" disabled={ocupado} onClick={() => lote('confirmar')} title="Crea el evento e invita">
              ✅ Confirmar
            </Accion>
          )}
          {s.estado === 'confirmado' && (s.calendarioError || !s.googleEventId) && (
            <Accion disabled={ocupado} onClick={() => lote('calendario')} title="Reintentar el evento de Google Calendar">
              📆 Reintentar
            </Accion>
          )}
          {s.estado !== 'anulado' && (
            <Accion disabled={ocupado} onClick={() => e.mover(s.id)} title="El siguiente hueco que toques es su sitio nuevo">
              🔁 Mover
            </Accion>
          )}
          {s.estado === 'confirmado' && (
            <Accion disabled={ocupado} onClick={() => accion({ accion: 'reprogramar' }, 'Se quita del calendario y queda «por recolocar». ¿Seguimos?')} title="Buscarle otro hueco más tarde">
              ⏸️ Reprogramar
            </Accion>
          )}
          {s.estado !== 'anulado' && s.estado !== 'borrador' && (
            <Accion tono="rojo" disabled={ocupado} onClick={() => accion({ accion: 'anular' }, '¿Anular? Se quita del calendario.')}>
              ✖️ Anular
            </Accion>
          )}
          {s.estado === 'borrador' && (
            <Accion tono="rojo" disabled={ocupado} onClick={borrar}>
              🗑️ Borrar
            </Accion>
          )}
        </div>

        {/* Aviso por correo */}
        {avisable && (
          <div className="space-y-1.5 rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
            <p className="text-xs text-zinc-500">✉️ Aviso{s.avisoTipo === 'cambio' ? ' de cambio' : s.avisoTipo === 'anulacion' ? ' de anulación' : ''}</p>
            <div className="flex flex-wrap gap-1.5">
              <Accion tono="azul" disabled={ocupado} onClick={() => lote('enviar')}>
                📨 Ya
              </Accion>
              {s.estado === 'confirmado' && (
                <>
                  <Accion disabled={ocupado} onClick={() => lote('programar', 7)} title="7 días antes">
                    ⏰ 7d
                  </Accion>
                  <Accion disabled={ocupado} onClick={() => lote('programar', 10)} title="10 días antes">
                    ⏰ 10d
                  </Accion>
                </>
              )}
              <Accion disabled={ocupado} onClick={() => lote('manual')} title="Ya se lo he dicho en persona">
                ✋ Dicho
              </Accion>
              <Accion disabled={ocupado} onClick={() => lote('no_avisar')} title="No hace falta avisar">
                🚫
              </Accion>
            </div>
          </div>
        )}

        <textarea
          defaultValue={s.notas ?? ''}
          placeholder="📝 Notas"
          rows={2}
          onBlur={(ev) => {
            if ((ev.target.value.trim() || null) !== (s.notas ?? null)) void accion({ accion: 'notas', notas: ev.target.value });
          }}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        {s.historial.length > 0 && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer">🕓 {s.historial.length}</summary>
            <ul className="mt-1 space-y-0.5">
              {[...s.historial].reverse().map((h, i) => (
                <li key={i}>
                  {new Date(h.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {h.que} · {h.por}
                </li>
              ))}
            </ul>
          </details>
        )}
      </DialogContent>
    </Dialog>
  );
}
