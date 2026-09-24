// Envío de la evaluación por correo. Acciones sobre el mismo cálculo de destinatarios:
// `preview` (recuento antes de disparar), `test` (una prueba a mi dirección), `enviar`
// (ya) y `programar` (a una hora). Más `envios` (historial) y `cancelar` (un programado).
//
// Programar NO usa cron: el lote se entrega a Resend con `scheduled_at` y lo dispara Resend
// (hasta 30 días vista). Los destinatarios se calculan AL PROGRAMAR — "solo a quien falta"
// es quien falta en ese momento —, y si la evaluación sigue en borrador puede abrirse sola
// a esa hora (`eval_forms.abrir_en`, perezoso: ver `hidratarForm`).
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
import { remitente } from '@/lib/email';
import { enviarEvaluacion, type DestinatarioCorreo } from '@/lib/evaluaciones-email';
import {
  actualizarForm,
  cancelarEnvio,
  ensureInvitacionesAlumnos,
  getEnvios,
  getHuecosPendientes,
  registrarEnvio,
  getDestinatariosProfes,
  getFormCompleto,
  marcarInvitacionesEnviadas,
} from '@/lib/evaluaciones-server';
import { db } from '@/db';
import { eduStudents } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

const schema = z.object({
  formId: z.string().uuid(),
  accion: z.enum(['preview', 'test', 'enviar', 'programar', 'envios', 'cancelar']),
  programadoPara: z.string().datetime({ offset: true }).nullable().default(null),
  /** Si sigue en borrador, abrirla sola a la hora del envío. */
  abrirSola: z.boolean().default(true),
  envioId: z.string().uuid().nullable().default(null),
  subject: z.string().default(''),
  body: z.string().default(''),
  testEmail: z.string().email().nullable().default(null),
  soloPendientes: z.boolean().default(true),
  etapas: z.array(z.string()).default([]),
});

// Resend admite hasta 30 días; se deja margen para que no rebote por segundos.
const MAX_PROGRAMAR_MS = 29.5 * 24 * 60 * 60 * 1000;
const MIN_PROGRAMAR_MS = 60 * 1000;

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

    if (input.accion === 'envios') {
      return NextResponse.json({ envios: await getEnvios(form.id), abrirEn: form.abrirEn });
    }
    if (input.accion === 'cancelar') {
      if (!input.envioId) return NextResponse.json({ error: 'Falta el envío' }, { status: 400 });
      const r = await cancelarEnvio(input.envioId);
      if (!r.ok) return NextResponse.json({ error: r.motivo }, { status: 409 });
      return NextResponse.json({ ok: true, cancelados: r.cancelados, noCancelables: r.noCancelables });
    }

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
        replyTo: guard.email,
      });
      if (res.skipped) return NextResponse.json({ error: 'No hay transporte de correo configurado (Gmail/Workspace o Resend)' }, { status: 500 });
      return NextResponse.json({ ok: true, enviados: res.sent, destino });
    }

    let programadoPara: Date | null = null;
    let abrirEn: Date | null = null;
    if (input.accion === 'programar') {
      if (!input.programadoPara) return NextResponse.json({ error: 'Elige cuándo se envía' }, { status: 400 });
      programadoPara = new Date(input.programadoPara);
      const falta = programadoPara.getTime() - Date.now();
      if (falta < MIN_PROGRAMAR_MS) return NextResponse.json({ error: 'Esa hora ya ha pasado (o es ya mismo): envíalo ahora' }, { status: 400 });
      if (falta > MAX_PROGRAMAR_MS) return NextResponse.json({ error: 'Se puede programar como mucho a 30 días vista' }, { status: 400 });
      if (remitente('evaluaciones').transporte !== 'resend') {
        return NextResponse.json({ error: 'Programar envíos solo funciona con Resend' }, { status: 409 });
      }
      if (form.estado === 'cerrado') {
        return NextResponse.json({ error: 'La evaluación está cerrada: ábrela o no se podrá responder' }, { status: 409 });
      }
      if (form.estado === 'borrador') {
        // Si va a abrirse sola, no puede quedar ninguna frase a medias: es el mismo guardián
        // que el botón de "abierto", y más importante aquí porque nadie estará mirando.
        const huecos = await getHuecosPendientes(form.id);
        if (huecos.length > 0) {
          return NextResponse.json({ error: 'Termina antes las frases que quedan a medias' }, { status: 409 });
        }
        if (!input.abrirSola) {
          return NextResponse.json({ error: 'Sigue en borrador: marca que se abra sola o ábrela ya' }, { status: 409 });
        }
        abrirEn = programadoPara;
      }
    } else if (form.estado !== 'abierto') {
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
      replyTo: guard.email, // quien manda la evaluación recibe las respuestas
      programadoPara: programadoPara ?? undefined,
    });
    if (res.skipped) return NextResponse.json({ error: 'No hay transporte de correo configurado (Gmail/Workspace o Resend)' }, { status: 500 });
    if (res.sent === 0 && res.errors > 0) {
      return NextResponse.json({ error: 'El servicio de correo ha rechazado el envío' }, { status: 502 });
    }
    if (calculo.tokensInvitacion.length > 0) await marcarInvitacionesEnviadas(calculo.tokensInvitacion);
    if (abrirEn) await actualizarForm(form.id, { abrirEn });
    await registrarEnvio({
      formId: form.id,
      asunto: input.subject,
      total: res.sent,
      errores: res.errors,
      resendIds: res.ids,
      programadoPara,
      soloPendientes: form.audiencia === 'alumnos' && input.soloPendientes,
      createdByEmail: guard.email,
    });

    return NextResponse.json({
      ok: true,
      enviados: res.sent,
      errores: res.errors,
      sinCorreo: calculo.sinCorreo.length,
      programadoPara,
    });
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
