// El evento de Google Calendar de cada sesión de Oratorios / Godly Play. Ficha:
// docs/26-oratorios.md
//
// Mismo cliente que Mi horario (cuenta de servicio con delegación de dominio): se escribe
// SUPLANTANDO a la persona responsable, en el calendario compartido del tipo. Así Google
// manda la invitación en su nombre y ella necesita poder editar ese calendario.
//
// ⚠️ Sin probar en vivo: el 30-sep-2026 la API de Calendar no estaba habilitada en el proyecto
// de Google Cloud de la cuenta de servicio (ver la ficha). Los errores se devuelven como texto
// para guardarlos en la sesión, nunca rompen la confirmación.
import type { calendar_v3 } from 'googleapis';

import { calendarConfigurado, conReintentos, getCalendar } from '@/lib/mihorario-google';
import { etiquetaClase, profesDe, tituloEvento, type SesionOra, type TipoMomento } from '@/lib/oratorios';
import { CONFIGURACION } from '@/lib/configuracion';

const ZONA = CONFIGURACION.calendario.zonaHoraria;
export const ORIGEN = 'tools-oratorios';

export interface DestinoEvento {
  tipo: Pick<TipoMomento, 'nombre' | 'calendarioId'>;
  sesion: SesionOra;
  /** Correos de los profes afectados, por id (el que no tenga, no se invita). */
  correos: Map<string, string>;
}

function hhmmss(h: string): string {
  const [hh, mm] = h.split(':');
  return `${hh.padStart(2, '0')}:${mm}:00`;
}

/** El cuerpo del evento, puro (se prueba sin Google delante). */
export function cuerpoEvento(d: DestinoEvento): calendar_v3.Schema$Event {
  const s = d.sesion;
  const profes = profesDe(s);
  const invitados = new Map<string, calendar_v3.Schema$EventAttendee>();
  for (const p of profes) {
    const correo = d.correos.get(p.id);
    if (correo) invitados.set(correo.toLowerCase(), { email: correo });
  }
  // La persona responsable también: el evento vive en el calendario compartido y así le sale
  // en el suyo.
  invitados.set(s.responsableEmail.toLowerCase(), { email: s.responsableEmail, responseStatus: 'accepted' });
  const materias = [...new Set(profes.map((p) => p.materia).filter(Boolean))].join(' / ');
  const lineas = [
    `${d.tipo.nombre} · Sesión ${s.numero}`,
    `Clase: ${etiquetaClase(s)}${materias ? ` · ${materias}` : ''}`,
    profes.length ? `Profe: ${profes.map((p) => p.nombre).join(', ')}` : null,
    `Lo lleva: ${s.responsableNombre ?? s.responsableEmail}`,
    s.notas ? `\n${s.notas}` : null,
  ].filter((l): l is string => l !== null);
  return {
    summary: tituloEvento(d.tipo, s),
    description: lineas.join('\n'),
    start: { dateTime: `${s.fecha}T${hhmmss(s.horaInicio)}`, timeZone: ZONA },
    end: { dateTime: `${s.fecha}T${hhmmss(s.horaFin)}`, timeZone: ZONA },
    attendees: [...invitados.values()],
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    reminders: { useDefault: true },
    extendedProperties: { private: { origen: ORIGEN, sesionId: s.id } },
  };
}

function mensajeError(e: unknown): string {
  const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
  const texto = e instanceof Error ? e.message : String(e);
  if (/has not been used in project|is disabled/i.test(texto)) return 'La API de Google Calendar no está habilitada en el proyecto de la cuenta de servicio';
  if (/unauthorized_client/i.test(texto)) return 'Falta el scope de Calendar en la delegación de dominio';
  if (status === 404) return 'No se encuentra el calendario (o la persona responsable no tiene acceso)';
  if (status === 403) return 'La persona responsable no puede editar ese calendario';
  return texto.slice(0, 300);
}

export type ResultadoCalendario = { ok: true; eventId: string; calendarId: string } | { ok: false; error: string };

/** Crea el evento, o lo actualiza si la sesión ya tenía uno (mover = un solo aviso de cambio). */
export async function guardarEvento(d: DestinoEvento): Promise<ResultadoCalendario> {
  if (!calendarConfigurado()) return { ok: false, error: 'Faltan las credenciales de la cuenta de servicio' };
  const calendarId = d.tipo.calendarioId;
  if (!calendarId) return { ok: false, error: 'Este tipo no tiene calendario en Ajustes' };
  try {
    const cal = getCalendar(d.sesion.responsableEmail);
    const requestBody = cuerpoEvento(d);
    if (d.sesion.googleEventId) {
      try {
        const { data } = await conReintentos(() =>
          cal.events.patch({ calendarId, eventId: d.sesion.googleEventId!, requestBody, sendUpdates: 'all' }),
        );
        return { ok: true, eventId: data.id ?? d.sesion.googleEventId, calendarId };
      } catch (e) {
        // Si lo borraron a mano en el calendario, se vuelve a crear.
        const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
        if (status !== 404 && status !== 410) throw e;
      }
    }
    const { data } = await conReintentos(() => cal.events.insert({ calendarId, requestBody, sendUpdates: 'all' }));
    if (!data.id) return { ok: false, error: 'Google no ha devuelto el id del evento' };
    return { ok: true, eventId: data.id, calendarId };
  } catch (e) {
    console.error('Oratorios · Google Calendar:', e instanceof Error ? e.message : e);
    return { ok: false, error: mensajeError(e) };
  }
}

/** Quita el evento (anular o reprogramar sin fecha). Google avisa de la cancelación. */
export async function borrarEvento(sesion: Pick<SesionOra, 'googleEventId' | 'responsableEmail'>, calendarId: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!sesion.googleEventId || !calendarId) return { ok: true };
  if (!calendarConfigurado()) return { ok: false, error: 'Faltan las credenciales de la cuenta de servicio' };
  try {
    const cal = getCalendar(sesion.responsableEmail);
    await conReintentos(() => cal.events.delete({ calendarId, eventId: sesion.googleEventId!, sendUpdates: 'all' }));
    return { ok: true };
  } catch (e) {
    const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
    if (status === 404 || status === 410) return { ok: true }; // ya no estaba
    console.error('Oratorios · Google Calendar (borrar):', e instanceof Error ? e.message : e);
    return { ok: false, error: mensajeError(e) };
  }
}
