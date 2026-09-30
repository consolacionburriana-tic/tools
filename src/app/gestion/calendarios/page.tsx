export const dynamic = 'force-dynamic';

import { listarCalendarios, listarClases } from '@/lib/calendarios-server';
import { VistaCalendarios } from '@/components/calendarios/vista';
import type { CalendarioFila, ClaseFila } from '@/lib/calendarios';

export const metadata = { title: 'Classrooms y calendarios · Tools Consolación' };

// Ficha: docs/25-calendarios.md. El inventario sale de Neon (lo que dejó el último escaneo);
// escanear, contar eventos y borrar lo hace la pantalla contra /api/calendarios/admin/*.
export default async function CalendariosPage() {
  let calendarios: CalendarioFila[] = [];
  let clases: ClaseFila[] = [];
  let error: string | null = null;
  try {
    [calendarios, clases] = await Promise.all([listarCalendarios(), listarClases()]);
  } catch (e) {
    console.error('Calendarios: error leyendo el inventario:', e instanceof Error ? e.message : e);
    error = 'No se puede leer el inventario. ¿Está aplicado el SQL de calendarios en Neon? (pnpm db:sql --pendientes)';
  }
  return <VistaCalendarios calendarios={calendarios} clases={clases} errorInicial={error} />;
}
