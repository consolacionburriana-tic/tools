// Correo del Cuaderno de tutor: un único aviso, al tutor/a, cuando su carpeta de Drive ya
// está lista y compartida con él. Sale por `enviar` de `src/lib/email.ts` con el perfil
// `cuaderno` (nunca instanciando un cliente aquí, ver docs/04-convenciones-tecnicas.md).
//
// No lleva ningún dato personal de alumnado ni de familias: solo la clase, el número de
// documentos y el enlace a la carpeta, que ya está protegida por el permiso de Drive.
import { enviar, emailConfigurado } from '@/lib/email';

const AZUL = '#1d4ed8';

function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function envoltorio(titulo: string, cuerpo: string): string {
  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#27272a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:${AZUL};padding:16px 24px;color:#fff;font-size:13px;font-weight:600;letter-spacing:.02em;">
      Consolación Burriana · Cuaderno de tutor
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.3;color:#18181b;">${escapar(titulo)}</h1>
      ${cuerpo}
    </div>
    <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #f4f4f5;color:#a1a1aa;font-size:11px;">
      Correo automático del generador del cuaderno de tutor · no hace falta contestar.
    </div>
  </div>
</body></html>`;
}

export interface AvisoCuaderno {
  email: string;
  nombre: string;
  clase: string;
  cursoEscolar: string;
  carpetaUrl: string;
  documentos: number;
}

/**
 * Aviso de "ya tienes tu cuaderno". Se manda solo cuando la carpeta se comparte por
 * primera vez con esa persona, así que una regeneración no vuelve a molestar a nadie.
 */
export async function avisarTutorDelCuaderno(aviso: AvisoCuaderno): Promise<boolean> {
  if (!emailConfigurado()) return false;
  const pila = aviso.nombre.split(' ')[0] || 'hola';
  const cuerpo = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
      Hola ${escapar(pila)}: ya tienes preparado el cuaderno de tutoría de
      <strong>${escapar(aviso.clase)}</strong> del curso ${escapar(aviso.cursoEscolar)},
      con los datos del alumnado y de las familias ya rellenados.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">
      Son ${aviso.documentos} documento(s) en tu carpeta de Drive. Puedes revisarlos, retocar lo
      que quieras y mandarlos a imprimir.
    </p>
    <p style="margin:0 0 20px;">
      <a href="${escapar(aviso.carpetaUrl)}"
         style="display:inline-block;background:${AZUL};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;">
        Abrir mi carpeta
      </a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
      Llevan datos personales de alumnado y familias: no los compartas fuera del claustro.
    </p>`;
  await enviar('cuaderno', {
    to: aviso.email,
    subject: `Tu cuaderno de tutoría de ${aviso.clase} ya está listo`,
    html: envoltorio(`Cuaderno de tutoría · ${aviso.clase}`, cuerpo),
  });
  return true;
}

export interface AvisoLista {
  email: string;
  nombre: string;
  clase: string;
  academicYear: string;
  hojaUrl: string;
  alumnos: number;
}

/**
 * Aviso de «ya tienes la lista de tu clase en Excel». Igual que el del cuaderno, no lleva
 * ningún dato de alumnado: solo la clase, cuántos son y el enlace, que ya está protegido
 * por el permiso de Drive.
 */
export async function avisarTutorDeLaLista(aviso: AvisoLista): Promise<boolean> {
  if (!emailConfigurado()) return false;
  const pila = aviso.nombre.split(' ')[0] || 'hola';
  const cuerpo = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
      Hola ${escapar(pila)}: ya tienes la <strong>lista de ${escapar(aviso.clase)}</strong> como hoja
      de cálculo, con los ${aviso.alumnos} alumnos numerados y los datos de contacto de sus familias.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;">
      Es una Google Sheet normal y corriente: puedes ordenarla, filtrarla, añadir columnas tuyas
      (notas, asistencia, lo que necesites) o usarla como origen de un combinado de correspondencia.
      Los números de lista son los mismos que los del cuaderno impreso.
    </p>
    <p style="margin:0 0 20px;">
      <a href="${escapar(aviso.hojaUrl)}"
         style="display:inline-block;background:${AZUL};color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;">
        Abrir la lista
      </a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;">
      Lleva datos personales de alumnado y familias: no la compartas fuera del claustro.
    </p>`;
  await enviar('cuaderno', {
    to: aviso.email,
    subject: `La lista de ${aviso.clase} ya está en tu Drive`,
    html: envoltorio(`Lista de clase · ${aviso.clase}`, cuerpo),
  });
  return true;
}
