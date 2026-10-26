'use client';

const DRAFT_KEY = 'registro-abc-draft';
// Un borrador de ayer ya no sirve (otra fecha, otra clase, otro momento): pasadas 12 horas se descarta.
const CADUCA_EN_MS = 12 * 60 * 60 * 1000;

export function saveDraft(data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, _guardadoEl: Date.now() }));
  } catch {
    // localStorage no disponible
  }
}

export function loadDraft(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { _guardadoEl, ...datos } = JSON.parse(raw) as Record<string, unknown>;
    // Los borradores antiguos no traen fecha: se respetan una última vez.
    if (typeof _guardadoEl === 'number' && Date.now() - _guardadoEl > CADUCA_EN_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return datos;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sin efecto
  }
}
