// «Solicitar acceso» desde el escritorio: en un módulo que no tienes, el botón gris avisa a los
// SuperTIC para que te lo den. Puro, sin IO: el envío está en `/api/acceso/solicitar`.
import { huella } from '@/lib/huella';
import type { Module } from '@/lib/permissions';

/** Módulos que se pueden pedir desde el escritorio. Los demás se dan a mano desde Usuarios y roles. */
export const SOLICITABLES = ['evaluaciones'] as const satisfies readonly Module[];
export type Solicitable = (typeof SOLICITABLES)[number];

export function esSolicitable(m: string): m is Solicitable {
  return (SOLICITABLES as readonly string[]).includes(m);
}

/** Lo que se lee en la tarjeta gris: a quién va dirigido y para qué sirve. Se ve siempre (en el iPad no hay «pasar el ratón»). */
export const TEXTO_SOLICITAR: Record<Solicitable, string> = {
  evaluaciones:
    'Si tú o tu equipo necesitáis hacer alguna evaluación al alumnado o profesorado, podéis solicitar el acceso a este módulo.',
};

/** Cuánto recuerda el navegador que ya la mandaste, para no avisar dos veces por un doble toque. */
export const DIAS_SOLICITUD = 14;

export const cookieSolicitud = (email: string, modulo: Solicitable) => `solicitud-${modulo}-${huella(email.toLowerCase())}`;

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** El correo a los SuperTIC: quién lo pide, qué módulo y un botón a Usuarios y roles. */
export function correoSolicitudAcceso(datos: {
  nombre: string | null;
  email: string;
  rol: string;
  modulo: string;
  url: string;
}): { asunto: string; html: string } {
  const quien = datos.nombre?.trim() || datos.email;
  return {
    asunto: `${quien} pide acceso a ${datos.modulo}`,
    html: `<!doctype html><html><body style="margin:0;padding:0;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px;padding:8px 4px;">
    <p style="margin:0 0 10px;"><strong>${esc(quien)}</strong> (${esc(datos.email)}, ${esc(datos.rol)}) ha pulsado <em>Solicitar acceso</em> a <strong>${esc(datos.modulo)}</strong> desde su escritorio.</p>
    <p style="margin:0;">Si procede, se le da en Usuarios y roles. Puedes contestar a este correo para hablar con ${esc(quien)}.</p>
    <p style="margin:18px 0 0;"><a href="${esc(datos.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;">Abrir Usuarios y roles</a></p>
  </div>
</body></html>`,
  };
}
