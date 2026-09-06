import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth-guards';
import { emojiDeCelda } from '@/lib/mihorario';
import { getPreferencias, getProfePorEmail, guardarPreferencias } from '@/lib/mihorario-server';
import { getCeldas, getPeriodoVigente } from '@/lib/horarios-server';

async function profeDeLaSesion() {
  const user = await getSessionUser();
  if (!user) return null;
  return getProfePorEmail(user.email);
}

/**
 * Las preferencias de quien tiene sesión, y lo que hace falta para pintar la pantalla:
 * qué materias/actividades tiene REALMENTE en su horario (para no pedirle emoji de cosas
 * que no le tocan) con el emoji que le tocaría hoy (suyo, o el del centro).
 */
export async function GET() {
  const profe = await profeDeLaSesion();
  if (!profe) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const preferencias = await getPreferencias(profe.id);
  const periodo = await getPeriodoVigente();
  const celdas = periodo ? await getCeldas(periodo.id, 'profe', profe.id) : [];

  const claves = new Map<string, { clave: string; etiqueta: string; emoji: string }>();
  for (const c of celdas) {
    const clave = c.materiaId ? `materia:${c.materiaId}` : `actividad:${c.actividad}`;
    if (!claves.has(clave)) {
      claves.set(clave, { clave, etiqueta: c.titulo, emoji: emojiDeCelda(c, preferencias.emojis) });
    }
  }

  return NextResponse.json({
    preferencias: {
      plantillaTitulo: preferencias.plantillaTitulo,
      plantillaDescripcion: preferencias.plantillaDescripcion,
      emojis: preferencias.emojis,
      calendarioGoogleId: preferencias.calendarioGoogleId,
    },
    categorias: [...claves.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
  });
}

export async function POST(req: Request) {
  const profe = await profeDeLaSesion();
  if (!profe) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  if (typeof body.plantillaTitulo !== 'string' || !body.plantillaTitulo.trim()) {
    return NextResponse.json({ error: 'Falta la plantilla del título' }, { status: 400 });
  }
  await guardarPreferencias(profe.id, {
    plantillaTitulo: body.plantillaTitulo,
    plantillaDescripcion: body.plantillaDescripcion ?? null,
    emojis: body.emojis ?? {},
    calendarioGoogleId: body.calendarioGoogleId ?? null,
  });
  return NextResponse.json({ ok: true });
}
