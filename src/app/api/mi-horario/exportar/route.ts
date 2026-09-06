import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth-guards';
import { construirEventoGoogle, emojiDeCelda } from '@/lib/mihorario';
import { getCeldas, getPeriodos } from '@/lib/horarios-server';
import { calendarConfigurado, crearEventos, borrarEventosDeOrigen } from '@/lib/mihorario-google';
import { getFestivos, getPreferencias, getProfePorEmail, getUltimaExportacion, registrarExportacion } from '@/lib/mihorario-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Exportar mi horario a Google Calendar. Con `confirmar: false` (por defecto) SOLO
 * devuelve la vista previa: los títulos que saldrían y cuántos eventos, nada se escribe.
 * Importar sobrescribe el periodo entero (se borra lo que ya se hubiera exportado de ESE
 * periodo antes de crear lo nuevo), así que ver antes de escribir no es un adorno — es lo
 * mismo que ya hace el importador de horarios.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const profe = await getProfePorEmail(user.email);
  if (!profe) {
    return NextResponse.json(
      { error: `Tu correo (${user.email}) no está enlazado a ningún profesor en la BBDD central. Habla con TIC.` },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const periodoId = String(body.periodoId ?? '');
  if (!periodoId) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });

  const periodos = await getPeriodos();
  const periodo = periodos.find((p) => p.id === periodoId);
  if (!periodo) return NextResponse.json({ error: 'Ese periodo no existe' }, { status: 404 });

  const [celdas, preferencias, festivos] = await Promise.all([
    getCeldas(periodoId, 'profe', profe.id),
    getPreferencias(profe.id),
    getFestivos(periodo.academicYear),
  ]);

  // "Todo lo que tenga el profesor": lectivas y no lectivas, guardias, reuniones,
  // atención a familias... El recreo y el comedor no aparecen aquí porque no son
  // sesiones de nadie, son huecos de la rejilla — ya quedan fuera sin filtrar nada.
  const rangoFestivos = festivos.map((f) => ({ fechaInicio: f.fechaInicio, fechaFin: f.fechaFin }));
  const construidos = celdas
    .map((c) =>
      construirEventoGoogle(c, {
        plantillaTitulo: preferencias.plantillaTitulo,
        plantillaDescripcion: preferencias.plantillaDescripcion ?? undefined,
        emoji: emojiDeCelda(c, preferencias.emojis),
        periodo: { fechaInicio: periodo.fechaInicio, fechaFin: periodo.fechaFin },
        festivos: rangoFestivos,
        periodoId,
      }),
    )
    .filter((r) => r.primeraFecha !== null);

  const previa = {
    periodo: `${periodo.nombre} · ${periodo.academicYear}`,
    totalEventos: construidos.length,
    ejemplos: construidos.slice(0, 8).map((r) => ({
      titulo: (r.evento as { summary: string }).summary,
      primeraFecha: r.primeraFecha,
    })),
    calendarConfigurado: calendarConfigurado(),
  };

  if (body.confirmar !== true) return NextResponse.json({ previa });

  if (!calendarConfigurado()) {
    return NextResponse.json({ error: 'Google Calendar no está configurado todavía en el servidor (falta el scope o las credenciales).' }, { status: 503 });
  }
  const buzon = profe.email;
  if (!buzon) {
    return NextResponse.json({ error: 'No tienes correo guardado en la BBDD central: no se puede escribir en tu calendario.' }, { status: 400 });
  }
  const calendarioGoogleId = String(body.calendarioGoogleId ?? preferencias.calendarioGoogleId ?? 'primary');

  // Reexportar = borrar lo de este periodo y volver a crear, igual que el importador de
  // horarios: es una foto completa, no un diario de cambios.
  await borrarEventosDeOrigen(buzon, calendarioGoogleId, periodoId);
  const { creados, errores } = await crearEventos(buzon, calendarioGoogleId, construidos.map((r) => r.evento));
  await registrarExportacion({ eduTeacherId: profe.id, periodoId, calendarioGoogleId, eventosCreados: creados });

  return NextResponse.json({ previa, resumen: { creados, errores, calendarioGoogleId } });
}

/** Última exportación de esta persona para un periodo (para el botón de deshacer). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const profe = await getProfePorEmail(user.email);
  if (!profe) return NextResponse.json({ error: 'No enlazado' }, { status: 404 });

  const periodoId = new URL(req.url).searchParams.get('periodoId');
  if (!periodoId) return NextResponse.json({ error: 'Falta el periodo' }, { status: 400 });

  const ultima = await getUltimaExportacion(profe.id, periodoId);
  return NextResponse.json({ ultima });
}
