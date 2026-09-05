'use client';

// El proyecto de AUTOASM vive en el NAVEGADOR, no en Neon. A propósito:
//
//  - Lo que se manipula aquí son los datos personales de todo el alumnado del centro en
//    su forma más exportable. Cuanto menos viaje y menos se guarde, mejor: entra una vez
//    desde `/api/autoasm/admin/centro`, se trabaja, se descarga el ZIP y se olvida.
//  - Un borrador a medias (con los profes ya asignados a sus clases) sí hace falta que
//    sobreviva a cerrar la pestaña, y para eso basta `localStorage` del iPad/portátil de
//    quien lo esté preparando.
//
// El precio: si se cambia de dispositivo, se empieza de nuevo (o se sube el ZIP que uno
// mismo se descargó, que es justo lo que el módulo sabe leer).
//
// Se lee con `useSyncExternalStore` y no con estado propio para que las dos pantallas
// (portada y explorador) y las dos pestañas que se tengan abiertas vean siempre lo mismo.

import { useSyncExternalStore } from 'react';
import type { ProyectoAsm } from '@/lib/autoasm-construir';

const CLAVE = 'autoasm-proyecto-v1';
const EVENTO = 'autoasm:proyecto';

// Cachés a nivel de módulo: `getSnapshot` tiene que devolver SIEMPRE la misma referencia
// mientras el contenido no cambie, o React entra en bucle de renders.
let cacheCrudo: string | null = null;
let cacheValor: ProyectoAsm | null = null;
// Si localStorage no acepta el proyecto (sin espacio, modo privado), se sigue en memoria:
// perder el trabajo al recargar es malo, pero perderlo al pulsar un botón es peor.
let soloMemoria = false;
let memoria: ProyectoAsm | null = null;

function parsear(crudo: string | null): ProyectoAsm | null {
  if (!crudo) return null;
  try {
    const p = JSON.parse(crudo) as ProyectoAsm;
    return p?.version === 1 && p.archivos ? p : null;
  } catch {
    return null;
  }
}

export function leerProyecto(): ProyectoAsm | null {
  if (typeof window === 'undefined') return null;
  if (soloMemoria) return memoria;
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {
    return memoria;
  }
  if (crudo !== cacheCrudo) {
    cacheCrudo = crudo;
    cacheValor = parsear(crudo);
  }
  return cacheValor;
}

export function escribirProyecto(proyecto: ProyectoAsm | null): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: false };
  memoria = proyecto;
  let resultado: { ok: boolean; error?: string } = { ok: true };
  try {
    if (proyecto === null) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, JSON.stringify(proyecto));
    soloMemoria = false;
  } catch {
    soloMemoria = true;
    resultado = { ok: false, error: 'No se ha podido guardar el borrador en este navegador (sin espacio o modo privado): si recargas, lo pierdes.' };
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
  return resultado;
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener('storage', avisar); // otra pestaña del mismo navegador
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener('storage', avisar);
  };
}

const noSuscribir = () => () => {};

/**
 * Proyecto actual con persistencia. `cargando` es "todavía estoy en el render del
 * servidor": sin él, la portada enseñaría el estado vacío durante un frame en cada
 * navegación, aunque haya un borrador guardado.
 */
export function useProyecto(): {
  proyecto: ProyectoAsm | null;
  cargando: boolean;
  guardar: (p: ProyectoAsm | null) => { ok: boolean; error?: string };
} {
  const proyecto = useSyncExternalStore(suscribir, leerProyecto, () => null);
  const cargando = useSyncExternalStore(noSuscribir, () => false, () => true);
  return { proyecto, cargando, guardar: escribirProyecto };
}
