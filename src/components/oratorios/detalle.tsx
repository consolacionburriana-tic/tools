'use client';

// Una sesión: qué es, en qué estado está y todo lo que se le puede hacer, con iconos.
import { AlarmClock, ArrowRightLeft, Ban, BellOff, BookOpen, BookOpenText, CalendarCheck, CalendarClock, CalendarDays, CheckCheck, ExternalLink, Hand, Mail, RefreshCw, Send, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Aviso } from '@/components/ui/aviso';
import { Button } from '@/components/ui/button';
import { ConfirmarEnLinea } from '@/components/ui/confirmar';
import { Estado as EstadoPastilla } from '@/components/ui/estado';
import { Selector } from '@/components/ui/selector';
import { Textarea } from '@/components/ui/textarea';
import { haptic } from '@/lib/haptics';
import { chipAviso, chipEstado, describirUsos, esEnlaceSeguro, etiquetaClase, fechaLarga, horaBonita, opcionesSesion, ordenarOpciones, profesDe, type AccionSesion } from '@/lib/oratorios';
import { api, capital, EstadoChip } from './comun';
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

  async function accion(a: AccionSesion) {
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
      <DialogContent variante="hoja" className="sm:max-w-md">
        <DialogTitle className="flex flex-wrap items-center gap-2 pr-10">
          <span aria-hidden>{tipo?.emoji}</span>
          <span>[{etiquetaClase(s)}]</span>
          <span>{tipo?.nombre}</span>
          <span className="text-zinc-500">· S{s.numero}</span>
        </DialogTitle>

        <div className="flex flex-wrap gap-1.5">
          <EstadoChip chip={chipEstado(s, e.datos.hoy)} />
          {aviso && <EstadoChip chip={aviso} />}
          {s.googleEventId && (
            <EstadoPastilla tono="ok" icono={<CalendarCheck aria-hidden />}>
              En Calendar
            </EstadoPastilla>
          )}
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-zinc-400" aria-hidden /> {capital(fechaLarga(s.fecha))} · {horaBonita(s.horaInicio)}–{horaBonita(s.horaFin)}
          </div>
          {profesDe(s).map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-zinc-400" aria-hidden /> {p.materia ?? '—'} · <b>{p.nombre}</b>
            </div>
          ))}
          {profesDe(s).length === 0 && <div className="text-amber-700 dark:text-amber-300">Sin profe: no se invitará a nadie</div>}
          <div className="flex items-center gap-1.5 text-zinc-500">
            <User className="h-4 w-4" /> {s.responsableNombre ?? s.responsableEmail}
          </div>
        </dl>

        {abanico.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <BookOpenText className="h-4 w-4" aria-hidden />
              <label htmlFor="ora-detalle-sesion">Sesión</label>
              {delAbanico?.enlace && esEnlaceSeguro(delAbanico.enlace) && (
                <a href={delAbanico.enlace} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-10 items-center gap-1 text-blue-700 hover:underline dark:text-blue-400">
                  Abrir <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
            <Selector
              id="ora-detalle-sesion"
              value={s.catalogoId ?? ''}
              disabled={ocupado}
              onChange={(ev) => void accion({ accion: 'catalogo', catalogoId: ev.target.value || null })}
            >
              <option value="">— sin elegir —</option>
              {opciones.map((o) => (
                <option key={o.sesion.id} value={o.sesion.id}>
                  {o.sesion.nombre}
                  {!o.aplicable ? ' · no es de este nivel' : o.choques.length ? ` · ya la vieron: ${describirUsos(o.choques)}` : ''}
                </option>
              ))}
            </Selector>
          </div>
        )}

        {s.calendarioError && <Aviso tono="aviso">Calendar: {s.calendarioError}</Aviso>}
        {s.avisoError && <Aviso tono="aviso">Correo: {s.avisoError}</Aviso>}

        {/* Estado */}
        <div className="flex flex-wrap gap-2">
          {s.estado === 'borrador' && (
            <Button size="sm" disabled={ocupado} onClick={() => lote('confirmar')} title="Crea el evento e invita">
              <CheckCheck /> Confirmar
            </Button>
          )}
          {s.estado === 'confirmado' && (s.calendarioError || !s.googleEventId) && (
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => lote('calendario')} title="Reintentar el evento de Google Calendar">
              <RefreshCw /> Reintentar
            </Button>
          )}
          {s.estado !== 'anulado' && (
            <Button variant="outline" size="sm" disabled={ocupado} onClick={() => e.mover(s.id)} title="El siguiente hueco que toques es su sitio nuevo">
              <ArrowRightLeft /> Mover
            </Button>
          )}
          {s.estado === 'confirmado' && (
            <ConfirmarEnLinea
              etiqueta="Reprogramar"
              icono={<CalendarClock />}
              variante="outline"
              peligro={false}
              pregunta="Se quita del calendario y queda «por recolocar»."
              confirmar="Sí, reprogramar"
              disabled={ocupado}
              onConfirmar={() => accion({ accion: 'reprogramar' })}
            />
          )}
          {s.estado !== 'anulado' && s.estado !== 'borrador' && (
            <ConfirmarEnLinea
              etiqueta="Anular"
              icono={<Ban />}
              pregunta="¿Anular? Se quita del calendario."
              confirmar="Sí, anular"
              disabled={ocupado}
              onConfirmar={() => accion({ accion: 'anular' })}
            />
          )}
          {s.estado === 'borrador' && (
            <ConfirmarEnLinea
              etiqueta="Borrar"
              icono={<Trash2 />}
              pregunta="¿Borrar este borrador?"
              disabled={ocupado}
              onConfirmar={borrar}
            />
          )}
        </div>

        {/* Aviso por correo */}
        {avisable && (
          <div className="space-y-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="flex items-center gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Mail className="h-4 w-4" aria-hidden /> Aviso{s.avisoTipo === 'cambio' ? ' de cambio' : s.avisoTipo === 'anulacion' ? ' de anulación' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={ocupado} onClick={() => lote('enviar')}>
                <Send /> Enviar ya
              </Button>
              {s.estado === 'confirmado' && (
                <>
                  <Button variant="outline" size="sm" disabled={ocupado} onClick={() => lote('programar', 7)}>
                    <AlarmClock /> 7 días antes
                  </Button>
                  <Button variant="outline" size="sm" disabled={ocupado} onClick={() => lote('programar', 10)}>
                    <AlarmClock /> 10 días antes
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" disabled={ocupado} onClick={() => lote('manual')} title="Ya se lo he dicho en persona">
                <Hand /> Dicho
              </Button>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => lote('no_avisar')}>
                <BellOff /> No avisar
              </Button>
            </div>
          </div>
        )}

        <Textarea
          defaultValue={s.notas ?? ''}
          placeholder="Notas"
          aria-label="Notas"
          rows={2}
          onBlur={(ev) => {
            if ((ev.target.value.trim() || null) !== (s.notas ?? null)) void accion({ accion: 'notas', notas: ev.target.value });
          }}
        />

        {s.historial.length > 0 && (
          <details className="text-xs text-zinc-500">
            <summary className="flex min-h-10 cursor-pointer items-center">Historial · {s.historial.length}</summary>
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
