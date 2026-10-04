'use client';

// Una sesión: qué es, en qué estado está y todo lo que se le puede hacer, con iconos.
import { AlarmClock, ArrowRightLeft, Ban, BellOff, BookOpen, BookOpenText, CalendarCheck, CalendarClock, CalendarDays, CheckCheck, ExternalLink, Hand, Mail, RefreshCw, Send, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { haptic } from '@/lib/haptics';
import { chipAviso, chipEstado, describirUsos, esEnlaceSeguro, etiquetaClase, fechaLarga, horaBonita, opcionesSesion, ordenarOpciones, profesDe, type AccionSesion } from '@/lib/oratorios';
import { Accion, api, capital, ChipVista } from './comun';
import type { Estado } from './panel';

export function DetalleSesion({ e, id, onClose }: { e: Estado; id: string | null; onClose: () => void }) {
  const s = id ? e.sesiones.find((x) => x.id === id) : null;
  const [trabajando, setTrabajando] = useState(false);
  if (!s) return null;
  const tipo = e.tipos.find((t) => t.id === s.tipoId);
  const aviso = chipAviso(s);
  const abanico = e.catalogo.filter((c) => c.tipoId === s.tipoId && (c.activo || c.id === s.catalogoId));
  const delAbanico = s.catalogoId ? e.catalogo.find((c) => c.id === s.catalogoId) : null;
  // Las del abanico, con las que esta clase no ha visto primero y las ya vistas avisadas.
  const opciones = tipo && abanico.length > 0 ? ordenarOpciones(opcionesSesion(e.ctx, tipo, { curso: s.curso, letra: s.letra }, s.fecha, s.id)) : [];
  const avisable = (s.estado === 'confirmado' && s.avisoEstado !== 'enviado') || (s.estado === 'anulado' && s.avisoEstado === 'pendiente');

  async function accion(a: AccionSesion, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setTrabajando(true);
    try {
      const nueva = await api.accion(s!.id, a);
      e.guardarSesiones([nueva]);
      haptic.success();
      if (nueva.calendarioError) toast.warning(nueva.calendarioError);
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
          {s.googleEventId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CalendarCheck className="h-3 w-3" /> En Calendar
            </span>
          )}
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-zinc-400" /> {capital(fechaLarga(s.fecha))} · {horaBonita(s.horaInicio)}–{horaBonita(s.horaFin)}
          </div>
          {profesDe(s).map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-zinc-400" /> {p.materia ?? '—'} · <b>{p.nombre}</b>
            </div>
          ))}
          {profesDe(s).length === 0 && <div className="text-amber-700 dark:text-amber-300">Sin profe: no se invitará a nadie</div>}
          <div className="flex items-center gap-1.5 text-zinc-500">
            <User className="h-4 w-4" /> {s.responsableNombre ?? s.responsableEmail}
          </div>
        </dl>

        {abanico.length > 0 && (
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              <BookOpenText className="h-4 w-4" aria-hidden /> Sesión
              {delAbanico?.enlace && esEnlaceSeguro(delAbanico.enlace) && (
                <a href={delAbanico.enlace} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </label>
            <select
              value={s.catalogoId ?? ''}
              disabled={ocupado}
              onChange={(ev) => void accion({ accion: 'catalogo', catalogoId: ev.target.value || null })}
              className="min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">— sin elegir —</option>
              {opciones.map((o) => (
                <option key={o.sesion.id} value={o.sesion.id}>
                  {o.sesion.nombre}
                  {!o.aplicable ? ' · no es de este nivel' : o.choques.length ? ` · ⚠️ ya la vieron: ${describirUsos(o.choques)}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {s.calendarioError && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Calendar: {s.calendarioError}</p>
        )}
        {s.avisoError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Correo: {s.avisoError}</p>}

        {/* Estado */}
        <div className="flex flex-wrap gap-2">
          {s.estado === 'borrador' && (
            <Accion tono="verde" disabled={ocupado} onClick={() => lote('confirmar')} title="Crea el evento e invita">
              <CheckCheck className="h-4 w-4" /> Confirmar
            </Accion>
          )}
          {s.estado === 'confirmado' && (s.calendarioError || !s.googleEventId) && (
            <Accion disabled={ocupado} onClick={() => lote('calendario')} title="Reintentar el evento de Google Calendar">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Accion>
          )}
          {s.estado !== 'anulado' && (
            <Accion disabled={ocupado} onClick={() => e.mover(s.id)} title="El siguiente hueco que toques es su sitio nuevo">
              <ArrowRightLeft className="h-4 w-4" /> Mover
            </Accion>
          )}
          {s.estado === 'confirmado' && (
            <Accion disabled={ocupado} onClick={() => accion({ accion: 'reprogramar' }, 'Se quita del calendario y queda «por recolocar». ¿Seguimos?')} title="Buscarle otro hueco más tarde">
              <CalendarClock className="h-4 w-4" /> Reprogramar
            </Accion>
          )}
          {s.estado !== 'anulado' && s.estado !== 'borrador' && (
            <Accion tono="rojo" disabled={ocupado} onClick={() => accion({ accion: 'anular' }, '¿Anular? Se quita del calendario.')}>
              <Ban className="h-4 w-4" /> Anular
            </Accion>
          )}
          {s.estado === 'borrador' && (
            <Accion tono="rojo" disabled={ocupado} onClick={borrar}>
              <Trash2 className="h-4 w-4" /> Borrar
            </Accion>
          )}
        </div>

        {/* Aviso por correo */}
        {avisable && (
          <div className="space-y-1.5 rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
            <p className="flex items-center gap-1 text-xs text-zinc-500"><Mail className="h-3.5 w-3.5" /> Aviso{s.avisoTipo === 'cambio' ? ' de cambio' : s.avisoTipo === 'anulacion' ? ' de anulación' : ''}</p>
            <div className="flex flex-wrap gap-1.5">
              <Accion tono="azul" disabled={ocupado} onClick={() => lote('enviar')}>
                <Send className="h-4 w-4" /> Ya
              </Accion>
              {s.estado === 'confirmado' && (
                <>
                  <Accion disabled={ocupado} onClick={() => lote('programar', 7)} title="7 días antes">
                    <AlarmClock className="h-4 w-4" /> 7d
                  </Accion>
                  <Accion disabled={ocupado} onClick={() => lote('programar', 10)} title="10 días antes">
                    <AlarmClock className="h-4 w-4" /> 10d
                  </Accion>
                </>
              )}
              <Accion disabled={ocupado} onClick={() => lote('manual')} title="Ya se lo he dicho en persona">
                <Hand className="h-4 w-4" /> Dicho
              </Accion>
              <Accion disabled={ocupado} onClick={() => lote('no_avisar')} title="No hace falta avisar">
                <BellOff className="h-4 w-4" />
              </Accion>
            </div>
          </div>
        )}

        <textarea
          defaultValue={s.notas ?? ''}
          placeholder="Notas"
          rows={2}
          onBlur={(ev) => {
            if ((ev.target.value.trim() || null) !== (s.notas ?? null)) void accion({ accion: 'notas', notas: ev.target.value });
          }}
          className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        {s.historial.length > 0 && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer">Historial · {s.historial.length}</summary>
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
