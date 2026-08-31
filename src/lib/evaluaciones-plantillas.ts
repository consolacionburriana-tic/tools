// Plantillas de fábrica de Evaluaciones: datos puros, SIN dependencias de envío, para que el
// panel (componente de cliente) pueda importarlas sin arrastrarse el motor de correo —y con él
// el SDK de Google— al bundle del navegador. El envío vive en `evaluaciones-email.ts`.
import type { Audiencia } from '@/lib/evaluaciones';

export interface PlantillaFabrica {
  nombre: string;
  audiencia: Audiencia;
  subject: string;
  body: string;
}

/**
 * Plantillas de fábrica: se cargan de un clic, se editan y se pueden guardar como
 * propias (quedan disponibles para el resto del claustro, igual que en Licencias).
 */
export const PLANTILLAS_FABRICA: PlantillaFabrica[] = [
  {
    audiencia: 'alumnos',
    nombre: '🤙🏼 Evaluación de la actividad (alumnado)',
    subject: '{titulo} — cuéntanos qué te ha parecido',
    body:
      'Hola {nombre}:\n\n' +
      'Para seguir mejorando queremos saber tu opinión sobre {titulo}. Son un par de minutos y tus respuestas son anónimas: nadie ve quién ha contestado qué.\n\n' +
      'Entra con el botón de aquí abajo (el enlace es tuyo, no hace falta contraseña).\n\n' +
      '¡Gracias!',
  },
  {
    audiencia: 'alumnos',
    nombre: '🔔 Recordatorio (alumnado)',
    subject: 'Todavía puedes contarnos qué te pareció {titulo}',
    body:
      'Hola {nombre}:\n\n' +
      'Aún estás a tiempo de evaluar {titulo}. Se hace en dos minutos y nos ayuda mucho a preparar lo siguiente.\n\n' +
      'Si ya lo has hecho estos días, ignora este correo.\n\n' +
      '¡Gracias!',
  },
  {
    audiencia: 'profesores',
    nombre: '📋 Evaluación (profesorado)',
    subject: 'Evaluación · {titulo}',
    body:
      'Hola:\n\n' +
      'Os pasamos la evaluación de {titulo}. Es 100 % anónima: no se guarda quién responde.\n\n' +
      'Se contesta en un par de minutos desde el botón de abajo.\n\n' +
      'Gracias por vuestro tiempo,',
  },
  {
    audiencia: 'profesores',
    nombre: '🔔 Recordatorio (profesorado)',
    subject: '⏰ Últimos días · evaluación de {titulo}',
    body:
      'Hola:\n\n' +
      'Seguimos recogiendo valoraciones de {titulo}. Como es anónima no sabemos quién falta, así que va a todo el claustro: si ya la has rellenado, ignora este correo.\n\n' +
      'Gracias,',
  },
  {
    audiencia: 'familias',
    nombre: '👨‍👩‍👧 Evaluación (familias)',
    subject: '{titulo} — nos gustaría conocer vuestra opinión',
    body:
      'Hola:\n\n' +
      'Nos gustaría conocer vuestra opinión sobre {titulo}. Son dos minutos y las respuestas son anónimas.\n\n' +
      'Gracias,',
  },
];
