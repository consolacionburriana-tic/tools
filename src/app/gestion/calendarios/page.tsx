export const dynamic = 'force-dynamic';

import { listarCalendarios } from '@/lib/calendarios-server';
import { PanelCalendarios } from '@/components/calendarios/panel';

export const metadata = { title: 'Calendarios del dominio · Tools Consolación' };

// Ficha: docs/25-calendarios.md. El inventario sale de Neon (lo que dejó el último escaneo);
// escanear, contar eventos y borrar lo hace la pantalla contra /api/calendarios/admin/*.
export default async function CalendariosPage() {
  let iniciales = null;
  let error: string | null = null;
  try {
    iniciales = await listarCalendarios();
  } catch (e) {
    console.error('Calendarios: error leyendo el inventario:', e instanceof Error ? e.message : e);
    error = 'No se puede leer el inventario. ¿Está aplicado `calendarios.sql` en Neon? (pnpm db:sql --pendientes)';
  }
  return <PanelCalendarios iniciales={iniciales ?? []} errorInicial={error} />;
}
