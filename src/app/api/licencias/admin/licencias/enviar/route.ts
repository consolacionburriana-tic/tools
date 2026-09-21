import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, hasModule } from '@/lib/auth-guards';
import { applyVars } from '@/lib/correos';
import { getCurrentCampaign } from '@/lib/licencias-server';
import { enviarCorreoLicencia, htmlLicencia, varsDeLicencia } from '@/lib/licencias-email';
import { emailConfigurado } from '@/lib/email';
import {
  agruparEnvios,
  contextoParaEnvio,
  marcarEnviadas,
  registrarEnvio,
  sellarPedidosCompletos,
} from '@/lib/licencias-envios-server';

export const maxDuration = 60;

// Tope por petición. Gmail va de uno en uno a ~2,5 correos/segundo (cuota de Workspace), así
// que 80 correos son ~32 s y caben de sobra en el `maxDuration` de 60. La pantalla manda tandas
// seguidas con su barra de progreso: si una se corta, lo enviado ya está marcado y se reanuda.
const TOPE = 80;

const schema = z.object({
  accion: z.enum(['previsualizar', 'prueba', 'enviar']),
  tipo: z.enum(['pago', 'banco']),
  ids: z.array(z.string().uuid()).min(1).max(TOPE),
  asunto: z.string().min(2).max(300),
  cuerpo: z.string().min(2).max(20000),
  fusionar: z.boolean().default(false),
  destino: z.enum(['alumno', 'familia']).default('alumno'),
  /** Solo en `prueba`: a dónde se manda el correo de muestra. */
  pruebaPara: z.string().email().optional(),
});

export async function POST(request: Request) {
  if (!(await hasModule('licencias'))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const campaign = await getCurrentCampaign();
  if (!campaign) return NextResponse.json({ error: 'Sin campaña activa' }, { status: 404 });

  let datos: z.infer<typeof schema>;
  try {
    datos = schema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Datos no válidos' }, { status: 400 });
  }

  const licencias = await contextoParaEnvio(campaign.id, datos.ids, datos.destino);
  if (!licencias.length) {
    return NextResponse.json(
      { error: 'Ninguna de esas licencias se puede enviar (sin código, ya enviada o descartada)' },
      { status: 409 },
    );
  }
  const grupos = agruparEnvios(licencias, datos.fusionar);
  const sinCorreo = licencias.filter((l) => !l.destinatario).length;

  const pintar = (g: (typeof grupos)[number]) => {
    const d = {
      alumno: g.licencias[0].alumno,
      nombre: g.licencias[0].nombre,
      apellidos: g.licencias[0].apellidos,
      curso: g.licencias[0].curso,
      clase: g.licencias[0].clase,
      academicYear: campaign.academicYear,
      licencias: g.licencias.map((l) => ({
        asignatura: l.asignatura,
        libro: l.libro,
        plataforma: l.plataforma,
        codigo: l.codigo,
      })),
    };
    return { asunto: applyVars(datos.asunto, varsDeLicencia(d)), html: htmlLicencia(datos.cuerpo, d) };
  };

  // Vista previa: el primer correo tal y como saldría, sin tocar nada.
  if (datos.accion === 'previsualizar') {
    const primero = grupos[0];
    const { asunto, html } = pintar(primero);
    return NextResponse.json({
      ok: true,
      asunto,
      html,
      para: primero.para,
      correos: grupos.length,
      licencias: licencias.length,
      sinCorreo,
    });
  }

  if (!emailConfigurado()) {
    return NextResponse.json({ error: 'No hay transporte de correo configurado' }, { status: 503 });
  }
  const user = await getSessionUser();

  // Prueba: el mismo correo, pero a quien lo pide y sin marcar ninguna licencia como enviada.
  if (datos.accion === 'prueba') {
    const para = datos.pruebaPara ?? user?.email;
    if (!para) return NextResponse.json({ error: 'Falta a dónde mandar la prueba' }, { status: 400 });
    const { asunto, html } = pintar(grupos[0]);
    try {
      await enviarCorreoLicencia(para, `[PRUEBA] ${asunto}`, html);
      return NextResponse.json({ ok: true, para });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de envío';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Envío real. De uno en uno a propósito: cada correo marca SUS licencias en cuanto sale, así
  // que si la petición se corta a medias no se reenvía nada de lo ya entregado.
  let enviados = 0;
  let fallidos = 0;
  const errores: string[] = [];
  const alumnosTocados = new Set<string>();

  for (const g of grupos) {
    const { asunto, html } = pintar(g);
    const ids = g.licencias.map((l) => l.id);
    try {
      await enviarCorreoLicencia(g.para, asunto, html);
      const envioId = await registrarEnvio({
        campaignId: campaign.id,
        tipo: datos.tipo,
        studentId: g.studentId,
        para: g.para,
        asunto,
        numLicencias: ids.length,
        ok: true,
        porEmail: user?.email ?? null,
      });
      await marcarEnviadas(ids, envioId, g.para, true);
      alumnosTocados.add(g.studentId);
      enviados++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de envío';
      const envioId = await registrarEnvio({
        campaignId: campaign.id,
        tipo: datos.tipo,
        studentId: g.studentId,
        para: g.para,
        asunto,
        numLicencias: ids.length,
        ok: false,
        error: message,
        porEmail: user?.email ?? null,
      });
      await marcarEnviadas(ids, envioId, g.para, false, message);
      fallidos++;
      if (errores.length < 5) errores.push(message);
    }
  }

  // El sello 📤 de los pedidos de pago lo pone ahora el envío, no un botón aparte.
  const sellados =
    datos.tipo === 'pago' ? await sellarPedidosCompletos(campaign.id, [...alumnosTocados]) : 0;

  return NextResponse.json({ ok: true, enviados, fallidos, errores, sinCorreo, sellados });
}
