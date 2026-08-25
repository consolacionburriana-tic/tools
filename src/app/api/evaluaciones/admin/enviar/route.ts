// Envío de la evaluación por correo. Tres acciones sobre el mismo cálculo de
// destinatarios: `preview` (recuento antes de disparar), `test` (una prueba a mi
// dirección) y `enviar`.
//
// Alumnado → un enlace PERSONALIZADO por alumno (`?a=…`, ver la ficha del módulo).
// Profesorado → el MISMO enlace para todos, a propósito: la evaluación es 100 %
// anónima y no queremos poder correlacionar quién ha respondido.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuardResponse, requireModule } from '@/lib/auth-guards';
import { appBaseUrl } from '@/lib/constants';
import { getFamiliasDeAlumnos } from '@/lib/fam-tokens-server';
import { claseLabel, varsDeDestinatario } from '@/lib/evaluaciones';
import { enviarEvaluacion, type DestinatarioCorreo } from '@/lib/evaluaciones-email';
import {
  ensureInvitacionesAlumnos,
  getDestinatariosProfes,
  getFormCompleto,
  marcarInvitacionesEnviadas,
} from '@/lib/evaluaciones-server';
import { db } from '@/db';
import { eduStudents } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

const schema = z.object({
  formId: z.string().uuid(),
  accion: z.enum(['preview', 'test', 'enviar']),
  subject: z.string().default(''),
  body: z.string().default(''),
  testEmail: z.string().email().nullable().default(null),
  soloPendientes: z.boolean().default(true),
  etapas: z.array(z.string()).default([]),
});

interface Calculo {
  destinatarios: DestinatarioCorreo[];
  tokensInvitacion: string[];
  sinCorreo: string[];
  yaRespondieron: number;
}

export async function POST(request: Request) {
  const guard = await requireModule('evaluaciones');
  if (isGuardResponse(guard)) return guard;
  try {
    const input = schema.parse(await request.json());
    const form = await getFormCompleto(input.formId);
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 });

    const base = appBaseUrl();
    const enlaceComun = `${base}/evaluaciones/${form.token}`;
    const calculo = await calcularDestinatarios(form, enlaceComun, input.soloPendientes, input.etapas);

    if (input.accion === 'preview') {
      return NextResponse.json({
        total: calculo.destinatarios.length,
        sinCorreo: calculo.sinCorreo,
        yaRespondieron: calculo.yaRespondieron,
        personalizado: form.audiencia === 'alumnos' && form.identificaAlumno,
        ejemplo: calculo.destinatarios[0]
          ? varsDeDestinatario({
              nombre: calculo.destinatarios[0].nombre,
              curso: calculo.destinatarios[0].curso,
              titulo: form.titulo,
              enlace: calculo.destinatarios[0].enlace,
              academicYear: form.academicYear,
            })
          : varsDeDestinatario({ nombre: 'María', curso: '1ESO', titulo: form.titulo, enlace: enlaceComun, academicYear: form.academicYear }),
      });
    }

    if (!input.subject.trim() || !input.body.trim()) {
      return NextResponse.json({ error: 'Falta el asunto o el cuerpo del correo' }, { status: 400 });
    }

    if (input.accion === 'test') {
      const destino = input.testEmail ?? guard.email;
      const res = await enviarEvaluacion({
        destinatarios: [{ email: destino, nombre: 'Prueba', curso: calculo.destinatarios[0]?.curso ?? null, enlace: enlaceComun }],
        subject: input.subject,
        body: input.body,
        titulo: form.titulo,
        academicYear: form.academicYear,
      });
      if (res.skipped) return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 });
      return NextResponse.json({ ok: true, enviados: res.sent, destino });
    }

    if (form.estado !== 'abierto') {
      return NextResponse.json({ error: 'Abre la evaluación antes de enviarla' }, { status: 409 });
    }
    if (calculo.destinatarios.length === 0) {
      return NextResponse.json({ error: 'No hay destinatarios con correo' }, { status: 400 });
    }

    const res = await enviarEvaluacion({
      destinatarios: calculo.destinatarios,
      subject: input.subject,
      body: input.body,
      titulo: form.titulo,
      academicYear: form.academicYear,
    });
    if (res.skipped) return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 });
    if (calculo.tokensInvitacion.length > 0) await marcarInvitacionesEnviadas(calculo.tokensInvitacion);

    return NextResponse.json({ ok: true, enviados: res.sent, errores: res.errors, sinCorreo: calculo.sinCorreo.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function calcularDestinatarios(
  form: NonNullable<Awaited<ReturnType<typeof getFormCompleto>>>,
  enlaceComun: string,
  soloPendientes: boolean,
  etapas: string[],
): Promise<Calculo> {
  if (form.audiencia === 'profesores') {
    const profes = await getDestinatariosProfes(etapas);
    return {
      destinatarios: profes
        .filter((p) => p.email)
        .map((p) => ({ email: p.email!, nombre: p.nombre, curso: null, enlace: enlaceComun })),
      tokensInvitacion: [],
      sinCorreo: profes.filter((p) => !p.email).map((p) => p.nombre),
      yaRespondieron: 0,
    };
  }

  if (form.audiencia === 'familias') {
    const candidatos = (form.clases ?? []).length
      ? await db
          .select({ id: eduStudents.id, curso: eduStudents.curso, letra: eduStudents.letra })
          .from(eduStudents)
          .where(and(eq(eduStudents.active, true), inArray(eduStudents.curso, [...new Set(form.clases.map((c) => c.curso))])))
      : [];
    // La consulta filtra por curso (lo que sabe hacer el índice); la letra se afina aquí.
    const idsClase = candidatos
      .filter((a) => form.clases.some((c) => c.curso === a.curso && (c.letra ?? null) === (a.letra ?? null)))
      .map((a) => a.id);
    const { familias, alumnosSinCorreo } = await getFamiliasDeAlumnos(idsClase);
    return {
      destinatarios: familias.map((f) => ({ email: f.email, nombre: f.tutorNombre ?? 'familia', curso: null, enlace: enlaceComun })),
      tokensInvitacion: [],
      sinCorreo: alumnosSinCorreo.map(() => 'alumno/a sin correo de familia'),
      yaRespondieron: 0,
    };
  }

  const invitados = await ensureInvitacionesAlumnos(form.id, form.clases ?? []);
  const pendientes = soloPendientes ? invitados.filter((i) => !i.yaRespondio) : invitados;
  const conCorreo = pendientes.filter((i) => i.email);
  return {
    destinatarios: conCorreo.map((i) => ({
      email: i.email!,
      nombre: i.nombre,
      curso: i.curso ? claseLabel({ curso: i.curso, letra: i.letra }) : null,
      // El enlace personalizado es lo que permite guardar de qué alumno viene la
      // respuesta sin pedirle ningún dato en pantalla.
      enlace: form.identificaAlumno ? `${enlaceComun}?a=${i.token}` : enlaceComun,
    })),
    tokensInvitacion: form.identificaAlumno ? conCorreo.map((i) => i.token) : [],
    sinCorreo: pendientes.filter((i) => !i.email).map((i) => i.nombre),
    yaRespondieron: invitados.filter((i) => i.yaRespondio).length,
  };
}
