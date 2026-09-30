// Identidad del colegio: el ÚNICO sitio del código donde viven el dominio, la URL y los buzones.
//
// Para desplegar esto en otro colegio, cambia estos valores (y nada más de este fichero).
// Guía completa: docs/08-despliegue-y-fork.md. Lo que NO está aquí y hay que cambiar a mano
// (logo, iconos, `public/manifest.json`, los títulos de `layout.tsx`, la portada y el login)
// está listado en el §6 de esa guía.
//
// Sin imports a propósito: lo usan servidor y cliente (componentes `'use client'`).

/** Dominio de Google Workspace del colegio, sin arroba: el login, los buzones y la importación de profes. */
const dominio = 'consolacionburriana.com';

/** Host público de la app. Solo es el valor por defecto: en producción manda `APP_BASE_URL`. */
const host = `tools.${dominio}`;

export const COLEGIO = {
  /** Cómo se nombra el colegio en remitentes y correos. */
  nombre: 'Colegio Consolación',
  /** Nombre corto, para pies de correo. */
  nombreCorto: 'Consolación Burriana',
  dominio,
  host,
  /** URL por defecto de la app (sin barra final). Ver `appBaseUrl()` en `constants.ts`. */
  web: `https://${host}`,
  /** Buzón de Licencias: sale y contesta ahí (tiene que existir de verdad en el dominio). */
  correoLicencias: `licencias@${dominio}`,
  /** Buzón genérico desde el que salen el resto de módulos. */
  correoNoResponder: `no-responder@${dominio}`,
  /** Buzón de soporte que ven las familias en pantalla. */
  correoTic: `tic@${dominio}`,
} as const;
