import { redirect } from 'next/navigation';

// Apuntar se hace en el panel del calendario (tocar un hueco, la cabecera de un día, o ⌘K).
export default async function NuevaAusenciaPage({ searchParams }: { searchParams: Promise<{ profe?: string; fecha?: string }> }) {
  const sp = await searchParams;
  const p = new URLSearchParams({ nueva: '1' });
  if (sp.profe) p.set('profe', sp.profe);
  if (sp.fecha) {
    p.set('desde', sp.fecha);
    p.set('semana', sp.fecha);
  }
  redirect(`/gestion/sustituciones?${p.toString()}`);
}
