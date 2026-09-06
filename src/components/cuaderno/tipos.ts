// Tipos compartidos entre las pantallas del Cuaderno de tutor. Son la forma en la que el
// server component pasa los datos al panel (fechas ya en string, nada de objetos Drizzle).
import type { EtiquetaAnalizada } from '@/lib/cuaderno/campos';

export interface AjustesUI {
  carpetaBaseId: string | null;
  carpetaBaseUrl: string | null;
  nombreCentro: string;
  permisoTutores: string;
}

export interface DriveUI {
  configurado: boolean;
  cuenta: string | null;
}

export interface PlantillaUI {
  id: string;
  nombre: string;
  googleDocId: string;
  repeticion: string;
  etapa: string | null;
  orden: number;
  generaPdf: boolean;
  saltoDePagina: boolean;
  activa: boolean;
  tieneFilas: boolean;
  analizadaAt: string | null;
  etiquetas: EtiquetaAnalizada[];
  hojasHechas: number;
}

export interface ClaseUI {
  curso: string;
  letra: string | null;
  clase: string;
  etapa: 'EI' | 'EP' | 'ESO' | null;
  numAlumnos: number;
  tutores: { nombre: string; corto: string; email: string | null }[];
  sinTutorPersonal: number;
}

export interface TiradaUI {
  id: string;
  numero: number;
  estado: string;
  academicYear: string;
  carpetaCursoUrl: string | null;
  lanzadaPor: string | null;
  createdAt: string;
  error: string | null;
  total: number;
  hechos: number;
  errores: number;
  pendientes: number;
  latidoAt: string | null;
  pases: number;
}

/** Una línea de la bitácora de una tirada (tabla `cuad_eventos`). */
export interface EventoUI {
  id: string;
  nivel: string;
  fase: string;
  mensaje: string;
  createdAt: string;
}

export interface FaltaUI {
  id: string;
  nombre: string;
  clase: string;
  plantillas: string[];
}

export interface ItemUI {
  id: string;
  curso: string;
  letra: string;
  plantillaId: string;
  indiceTutor: number;
  estado: string;
  docUrl: string | null;
  pdfUrl: string | null;
  carpetaUrl: string | null;
  alumnoIds: string[];
  error: string | null;
}

export const claseKey = (curso: string, letra: string | null): string => `${curso}|${letra ?? ''}`;

export const ETAPA_LABEL: Record<'EI' | 'EP' | 'ESO', string> = {
  EI: 'Infantil',
  EP: 'Primaria',
  ESO: 'Secundaria',
};

export const ETAPA_ORDEN: ('EI' | 'EP' | 'ESO')[] = ['EI', 'EP', 'ESO'];

/** ¿Le falta a esta plantilla algo para poder generar? */
export function plantillaLista(p: PlantillaUI): boolean {
  return Boolean(p.analizadaAt) && p.etiquetas.every((e) => e.tipo !== 'campo' || e.campo);
}

export function etiquetasSinMapear(p: PlantillaUI): EtiquetaAnalizada[] {
  return p.etiquetas.filter((e) => e.tipo === 'campo' && !e.campo);
}
