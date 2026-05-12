import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BEHAVIORS, CONTEXTS, TIME_SLOTS, PRESENT_PEOPLE, REASONS,
  type BehaviorValue, type ContextValue, type TimeSlotValue,
} from './constants';

interface ReportEmailData {
  studentDisplayName: string;
  studentFullName: string;
  studentClassName: string;
  teacherName: string;
  reportDate: string;
  context: string;
  contextNote?: string | null;
  timeSlot: string;
  presentPeople: string[];
  behaviors: string[];
  involvedWith?: string | null;
  reasons: string[];
  reasonOther?: string | null;
  antecedents?: string | null;
  consequences?: string | null;
  redirectActions?: string | null;
  effectivenessRating?: string | null;
  comments?: string | null;
}

function label<T extends { value: string; label: string }>(arr: readonly T[], val: string): string {
  return arr.find((x) => x.value === val)?.label ?? val;
}

function pill(text: string, color: 'teal' | 'rose' | 'zinc' = 'zinc') {
  const colors = {
    teal: 'background:#d1fae5;color:#065f46;',
    rose: 'background:#fee2e2;color:#991b1b;',
    zinc: 'background:#f4f4f5;color:#3f3f46;',
  };
  return `<span style="display:inline-block;${colors[color]}font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;margin:2px 2px 2px 0;">${text}</span>`;
}

function section(title: string, content: string, accent = false) {
  const border = accent ? 'border-left:3px solid #0d9488;padding-left:12px;' : '';
  return `
    <div style="margin-bottom:20px;${border}">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">${title}</p>
      <div style="font-size:14px;color:#374151;line-height:1.6;">${content}</div>
    </div>`;
}

export function buildReportEmail(data: ReportEmailData): { subject: string; html: string } {
  const dateStr = format(parseISO(data.reportDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const contextLabel = label(CONTEXTS, data.context);
  const timeLabel = label(TIME_SLOTS, data.timeSlot);

  const behaviorPills = data.behaviors
    .map((b) => pill(label(BEHAVIORS, b as BehaviorValue), 'rose'))
    .join('');

  const peoplePills = data.presentPeople
    .map((p) => pill(label(PRESENT_PEOPLE, p as any), 'zinc'))
    .join('');

  const reasonPills = data.reasons.length
    ? data.reasons.map((r) => pill(label(REASONS, r as any), 'teal')).join('') +
      (data.reasonOther ? `<br><span style="font-size:13px;color:#6b7280;margin-top:4px;display:inline-block;">${data.reasonOther}</span>` : '')
    : '<span style="color:#9ca3af;font-style:italic;">No indicado</span>';

  const subject = `📋 Registro ABC · ${data.studentDisplayName} · ${format(parseISO(data.reportDate), 'd MMM', { locale: es })}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#99f6e4;opacity:.9;">Colegio Consolación · Burriana</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Nuevo Registro ABC</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#99f6e4;">${dateStr}</p>
    </div>

    <!-- Alumno highlight -->
    <div style="background:#f0fdfa;border-bottom:1px solid #ccfbf1;padding:16px 32px;display:flex;align-items:center;gap:12px;">
      <div style="width:42px;height:42px;border-radius:50%;background:#0d9488;color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${data.studentDisplayName.charAt(0).toUpperCase()}
      </div>
      <div>
        <p style="margin:0;font-size:16px;font-weight:700;color:#134e4a;">${data.studentDisplayName}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#0d9488;">${data.studentClassName} · ${data.studentFullName}</p>
      </div>
    </div>

    <!-- Cuerpo -->
    <div style="padding:28px 32px;">

      ${section('Registrado por', `<strong>${data.teacherName}</strong>`)}

      ${section('Contexto', `
        <strong>${contextLabel}</strong> · ${timeLabel}
        ${data.contextNote ? `<br><span style="color:#6b7280;font-size:13px;">${data.contextNote}</span>` : ''}
      `)}

      ${section('Personas presentes', peoplePills || '<span style="color:#9ca3af;">—</span>')}

      <!-- Conductas — más destacadas -->
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#be123c;">⚠ Conductas observadas</p>
        <div>${behaviorPills}</div>
        ${data.involvedWith ? `<p style="margin:10px 0 0;font-size:13px;color:#7f1d1d;"><strong>Con:</strong> ${data.involvedWith}</p>` : ''}
      </div>

      ${section('Hipótesis · ¿Por qué?', reasonPills, true)}

      ${data.antecedents ? section('Antecedentes', `<span style="color:#374151;">${data.antecedents}</span>`) : ''}
      ${data.consequences ? section('Consecuencias', `<span style="color:#374151;">${data.consequences}</span>`) : ''}
      ${data.redirectActions ? section('Acciones de reconducción', `<span style="color:#374151;">${data.redirectActions}</span>`) : ''}

      ${data.effectivenessRating != null ? section('Efectividad de reconducción',
        `<span style="font-size:28px;font-weight:700;color:#0d9488;font-family:monospace;">${parseFloat(data.effectivenessRating).toFixed(1)}</span><span style="font-size:12px;color:#9ca3af;"> / 5.0</span>`
      ) : ''}

      ${data.comments ? section('Comentarios adicionales', `<span style="color:#374151;font-style:italic;">"${data.comments}"</span>`) : ''}

    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Este mensaje es automático generado por <strong>Tools Consolación</strong>.<br>
        Para ver todos los registros, accede al panel de administración.
      </p>
    </div>

  </div>
</body>
</html>`;

  return { subject, html };
}
