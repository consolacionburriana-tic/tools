// Portada pública (`/`) · qué se le enseña a quien entra sin sesión.
//
// La portada NO es una lista de módulos ni un tablón de avisos: es **un botón por trámite
// abierto**, para mandar a cada uno a donde tiene que ir. Si hay campaña de licencias, sale
// Licencias; si hay salidas cobrando, sale Salidas; si no hay nada, se dice en una línea.
// Los detalles (el plazo, qué salida, cuánto cuesta) los cuenta la pantalla de destino, que
// además sabe quién está mirando: aquí solo se decide a dónde mandar a la gente.
//
// Este fichero es client-safe (sin IO): las consultas están en `portada-server.ts` y el
// pintado, en `src/components/home/home-landing.tsx`.
//
// **Para añadir un módulo a la portada** hacen falta tres cosas y ninguna más:
//   1. su nombre en `MODULOS_PORTADA` (el tema visual va en `home-landing.tsx`);
//   2. un `accesoX()` aquí, puro, que devuelva `null` cuando el módulo no esté activo;
//   3. la consulta que lo alimenta en `portada-server.ts`.
// Requisito para entrar: que sea una pantalla **pública y auto-explicativa**. Evaluaciones,
// por ejemplo, no está porque solo se entra por un enlace con token de un solo uso: sin
// token no hay nada que enseñar.

import { campaignAbierta } from '@/lib/licencias';

export const MODULOS_PORTADA = ['licencias', 'salidas'] as const;
export type ModuloPortada = (typeof MODULOS_PORTADA)[number];

export interface AccesoPortada {
  modulo: ModuloPortada;
  /** Lo que la familia viene a hacer, en su idioma. Es todo el texto del botón. */
  titulo: string;
  href: string;
  /** Segunda entrada del mismo módulo, para consultar lo ya hecho. */
  secundario: { titulo: string; href: string } | null;
}

/** Campaña de licencias: solo cuenta si está abierta y dentro de plazo. */
export function accesoLicencias(
  campaign: { status: string; orderDeadline: string | null } | null,
  now?: Date,
): AccesoPortada | null {
  if (!campaign || !campaignAbierta(campaign, now)) return null;
  return {
    modulo: 'licencias',
    titulo: 'Solicitar licencias digitales',
    href: '/licencias',
    secundario: { titulo: '¿He hecho ya mi pedido?', href: '/licencias' },
  };
}

/** Salidas con el pago abierto. Cuáles son y de quién, lo resuelve ya `/salidas`. */
export function accesoSalidas(salidas: unknown[]): AccesoPortada | null {
  if (salidas.length === 0) return null;
  return {
    modulo: 'salidas',
    titulo: 'Subir el justificante de una salida',
    href: '/salidas',
    secundario: null,
  };
}

/**
 * Los accesos que se enseñan hoy, en orden. Licencias va primero cuando está abierta
 * porque es lo único con fecha límite y va dirigido a todo el colegio a la vez; las
 * salidas afectan a una clase y suelen llegar por un correo con enlace directo.
 */
export function accesosPortada(
  datos: {
    campaign: { status: string; orderDeadline: string | null } | null;
    salidas: unknown[];
  },
  now?: Date,
): AccesoPortada[] {
  return [accesoLicencias(datos.campaign, now), accesoSalidas(datos.salidas)].filter(
    (a): a is AccesoPortada => a !== null,
  );
}
