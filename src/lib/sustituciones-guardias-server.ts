import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { authUsers, eduTeachers, horActividades, horAsignacionGrupos, horAsignacionProfes, horAsignaciones, horMaterias, horPeriodos, horSesiones, horTramos, sustAusencias, sustReportesMensuales, sustSesiones } from '@/db/schema';
import { academicYearActual, appBaseUrl } from '@/lib/constants';
import { diaSemanaDeFecha } from '@/lib/horarios';
import { nombreProfe } from '@/lib/profes';
import { enviar, type Mensaje } from '@/lib/email';
import { MOTIVOS_SUSTITUCION } from '@/lib/sustituciones-diarias';

const PRIORIDADES = ['Codocencia', 'Tut. indiv.', 'J.E.', 'A.L.', 'P.T.', 'Godly', 'TIC', 'Pastoral', 'Gabinete', 'Dirección'] as const;
export type SesionPropuesta = { horSesionId: string; orden: number; inicio: string; fin: string; materia: string; aula: string; grupo: string; candidatos: { id: string; nombre: string; email: string; prioridad: string }[] };
const n = (p: { nombre: string | null; apellido1: string | null; apellido2: string | null; nombreMostrado?: string | null }) => nombreProfe(p);
const rank = (actividad: string, label: string | null, rol: string | null): string | null => {
  const s = `${actividad} ${label ?? ''}`.toLocaleLowerCase('es');
  if (actividad === 'clase' && rol === 'apoyo') return 'Codocencia';
  if (/tut\.?\s*indiv|tutor[ií]a individual/.test(s)) return 'Tut. indiv.';
  if (/jefatura|\bj\.?e\.?\b/.test(s)) return 'J.E.';
  if (actividad === 'apoyo_al' || /\b(a\.l\.|al apoyo|audici[oó]n y lenguaje)\b/.test(s)) return 'A.L.';
  if (actividad === 'apoyo_pt' || /\b(p\.t\.|pedagog[ií]a terap[eé]utica)\b/.test(s)) return 'P.T.';
  if (/godly/.test(s)) return 'Godly';
  if (/\btic\b|inform[aá]tica/.test(s)) return 'TIC';
  if (/pastoral/.test(s)) return 'Pastoral';
  if (/gabinete/.test(s)) return 'Gabinete';
  if (/direcci[oó]n/.test(s)) return 'Dirección';
  return null;
};
const priority = (p: string) => PRIORIDADES.indexOf(p as (typeof PRIORIDADES)[number]);

export async function listaProfes() {
  const filas = await db.select({ id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado, etapa: eduTeachers.etapa, etapas: eduTeachers.etapas, email: eduTeachers.email })
    .from(eduTeachers).where(eq(eduTeachers.active, true)).orderBy(asc(eduTeachers.apellido1), asc(eduTeachers.nombre));
  return filas.filter(p => [p.etapa, ...(p.etapas ?? [])].some(e => e === 'EI' || e === 'EP')).map(p => ({ id: p.id, nombre: n(p), email: p.email ?? '' }));
}

export async function propuesta(fecha: string, ausenteId: string) {
  const dow = diaSemanaDeFecha(fecha);
  if (!dow) throw new Error('Elige un día lectivo entre lunes y viernes.');
  const [ausente] = await db.select({ id: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado, email: eduTeachers.email, etapa: eduTeachers.etapa, etapas: eduTeachers.etapas }).from(eduTeachers).where(eq(eduTeachers.id, ausenteId)).limit(1);
  if (!ausente || ![ausente.etapa, ...(ausente.etapas ?? [])].some(e => e === 'EI' || e === 'EP')) throw new Error('El profesor debe pertenecer a Infantil o Primaria.');
  const [periodo] = await db.select().from(horPeriodos).where(and(eq(horPeriodos.active, true), lte(horPeriodos.fechaInicio, fecha), gte(horPeriodos.fechaFin, fecha))).orderBy(sql`${horPeriodos.prioridad} desc`).limit(1);
  if (!periodo) throw new Error('No hay un horario vigente para esa fecha.');
  const sesiones = await db.select({ sesionId: horSesiones.id, orden: horTramos.orden, inicio: horTramos.horaInicio, fin: horTramos.horaFin, materia: horMaterias.nombre, actividad: horActividades.codigo, etiqueta: horAsignaciones.etiqueta, aula: sql<string | null>`coalesce(${horSesiones.aula}, ${horAsignaciones.aula})`, asignacion: horAsignaciones.id })
    .from(horSesiones).innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId)).innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId)).innerJoin(horActividades, eq(horActividades.id, horAsignaciones.actividadId)).leftJoin(horMaterias, eq(horMaterias.id, horAsignaciones.materiaId)).innerJoin(horAsignacionProfes, eq(horAsignacionProfes.asignacionId, horAsignaciones.id))
    .where(and(eq(horAsignaciones.periodoId, periodo.id), eq(horTramos.diaSemana, dow), eq(horAsignacionProfes.eduTeacherId, ausenteId), eq(horAsignaciones.active, true))).orderBy(asc(horTramos.orden));
  const candidateRows = await db.select({ sesionId: horSesiones.id, asignacionId: horAsignaciones.id, orden: horTramos.orden, inicio: horTramos.horaInicio, fin: horTramos.horaFin, actividad: horActividades.codigo, etiqueta: horAsignaciones.etiqueta, rol: horAsignacionProfes.rol, teacherId: eduTeachers.id, nombre: eduTeachers.nombre, apellido1: eduTeachers.apellido1, apellido2: eduTeachers.apellido2, nombreMostrado: eduTeachers.nombreMostrado, email: eduTeachers.email })
    .from(horSesiones).innerJoin(horTramos, eq(horTramos.id, horSesiones.tramoId)).innerJoin(horAsignaciones, eq(horAsignaciones.id, horSesiones.asignacionId)).innerJoin(horActividades, eq(horActividades.id, horAsignaciones.actividadId)).innerJoin(horAsignacionProfes, eq(horAsignacionProfes.asignacionId, horAsignaciones.id)).innerJoin(eduTeachers, eq(eduTeachers.id, horAsignacionProfes.eduTeacherId))
    .where(and(eq(horAsignaciones.periodoId, periodo.id), eq(horTramos.diaSemana, dow), eq(horAsignaciones.active, true), eq(eduTeachers.active, true), or(eq(eduTeachers.etapa, 'EI'), eq(eduTeachers.etapa, 'EP'), sql`${eduTeachers.etapas} ? 'EI'`, sql`${eduTeachers.etapas} ? 'EP'`)));
  const groupRows = sesiones.length
    ? await db.select({ asignacion: horAsignacionGrupos.asignacionId, curso: horAsignacionGrupos.curso, letra: horAsignacionGrupos.letra }).from(horAsignacionGrupos).where(inArray(horAsignacionGrupos.asignacionId, [...new Set(sesiones.map(s=>s.asignacion))]))
    : [];
  const groupsByAssignment = new Map<string, string[]>();
  for (const g of groupRows) groupsByAssignment.set(g.asignacion, [...(groupsByAssignment.get(g.asignacion) ?? []), [g.curso, g.letra].filter(Boolean).join(' ')]);
  const out: SesionPropuesta[] = [];
  for (const s of sesiones) {
    const picks = candidateRows.filter(c => c.teacherId !== ausenteId && c.inicio === s.inicio && c.fin === s.fin).map(c => ({ ...c, prioridad: rank(c.actividad, c.etiqueta, c.rol) })).filter(c => c.prioridad);
    const available = picks.filter(c => !candidateRows.some(x => x.teacherId === c.teacherId && x.asignacionId !== c.asignacionId && (x.inicio < s.fin && x.fin > s.inicio)));
    const best = Math.min(...available.map(c => priority(c.prioridad!)));
    const candidates = available.filter(c => priority(c.prioridad!) === best && !!c.email).sort((a,b)=>n(a).localeCompare(n(b),'es')).map(c=>({ id:c.teacherId, nombre:n(c), email:c.email!, prioridad:c.prioridad! }));
    out.push({ horSesionId:s.sesionId, orden:s.orden, inicio:s.inicio, fin:s.fin, materia:s.materia ?? s.etiqueta ?? 'Sesión', aula:s.aula ?? 'Sin aula indicada', grupo: groupsByAssignment.get(s.asignacion)?.join(', ') ?? '', candidatos:candidates });
  }
  return { ausente: { id: ausente.id, nombre: n(ausente), email: ausente.email ?? '' }, sesiones: out, academicYear: periodo.academicYear || academicYearActual(new Date(`${fecha}T12:00:00`)) };
}

function esc(s: string) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export async function confirmar(input: { fecha: string; motivo: string; ausenteId: string; sesiones: { horSesionId: string; sustitutoId: string }[]; autor: string }) {
  if (!(MOTIVOS_SUSTITUCION as readonly string[]).includes(input.motivo)) throw new Error('Motivo no válido.');
  if (!input.sesiones.length) throw new Error('Selecciona al menos una sesión.');
  const p = await propuesta(input.fecha, input.ausenteId);
  if (!p.ausente.email) throw new Error('El profesor ausente no tiene correo registrado; no se puede enviarle la confirmación.');
  const seleccionadas = input.sesiones.map(x => {
    const s = p.sesiones.find(y => y.horSesionId === x.horSesionId);
    const c = s?.candidatos.find(y => y.id === x.sustitutoId);
    if (!s || !c) throw new Error('La propuesta ha cambiado. Vuelve a buscar y revisa las coberturas.');
    if (!c.email) throw new Error(`Falta el correo de ${c.nombre}; elige otra persona o actualiza su ficha.`);
    return { s, c };
  });
  for (let i = 0; i < seleccionadas.length; i++) for (let j = i + 1; j < seleccionadas.length; j++) {
    const a = seleccionadas[i], b = seleccionadas[j];
    if (a.c.id === b.c.id && a.s.inicio < b.s.fin && b.s.inicio < a.s.fin) throw new Error(`${a.c.nombre} aparece en dos sesiones simultáneas. Elige otra persona para una de ellas.`);
  }
  const aid = crypto.randomUUID();
  const batch = [db.insert(sustAusencias).values({ id: aid, fecha: input.fecha, academicYear: p.academicYear, motivo: input.motivo, ausenteId: p.ausente.id, ausenteNombre: p.ausente.nombre, creadaPor: input.autor }), ...seleccionadas.map(({s,c})=>db.insert(sustSesiones).values({ ausenciaId: aid, horSesionId: s.horSesionId, tramoOrden: s.orden, horaInicio: s.inicio, horaFin: s.fin, materia: s.materia, aula: s.aula, grupo: s.grupo, ausenteId: p.ausente.id, ausenteNombre: p.ausente.nombre, sustitutoId: c.id, sustitutoNombre: c.nombre, sustitutoEmail: c.email, prioridad: c.prioridad }))];
  await db.batch(batch as never);
  const porSustituto = new Map<string, typeof seleccionadas>();
  for (const x of seleccionadas) porSustituto.set(x.c.id, [...(porSustituto.get(x.c.id) ?? []), x]);
  const fechaBonita = new Date(`${input.fecha}T12:00:00`).toLocaleDateString('es-ES', { dateStyle:'long' });
  const emails: Mensaje[] = [];
  for (const [,items] of porSustituto) {
    const c=items[0].c;
    if (!c.email) continue;
    const rows=items.map(({s})=>`<li>${esc(s.inicio)}–${esc(s.fin)} · ${esc(s.materia)} · ${esc(s.aula)}${s.grupo ? ` · ${esc(s.grupo)}`:''}</li>`).join('');
    emails.push({to:c.email, subject:`Sustitución de ${fechaBonita}`, html:`<p>Hola ${esc(c.nombre)},</p><p>Te confirmamos que sustituirás a ${esc(p.ausente.nombre)} el ${esc(fechaBonita)}:</p><ul>${rows}</ul><p>Muchas gracias por tu ayuda y disponibilidad.</p>`});
  }
  if (p.ausente.email) emails.push({to:p.ausente.email,subject:`Cobertura de tus sesiones · ${fechaBonita}`,html:`<p>Hola ${esc(p.ausente.nombre)},</p><p>Estas son las personas que cubrirán tus sesiones el ${esc(fechaBonita)}:</p><ul>${seleccionadas.map(({s,c})=>`<li>${esc(s.inicio)}–${esc(s.fin)} · ${esc(s.materia)} · ${esc(s.aula)}: ${esc(c.nombre)}</li>`).join('')}</ul><p>Puedes enviarles las tareas correspondientes.</p>`});
  const results = await Promise.allSettled(emails.map(m=>enviar('sustituciones',m)));
  return { id: aid, emailsEnviados: results.filter(x=>x.status==='fulfilled').length, emailsFallidos: results.filter(x=>x.status==='rejected').length };
}

export async function historial() {
  return db.select({ fecha:sustAusencias.fecha, motivo:sustAusencias.motivo, academicYear:sustAusencias.academicYear, ausente:sustAusencias.ausenteNombre, materia:sustSesiones.materia, aula:sustSesiones.aula, inicio:sustSesiones.horaInicio, fin:sustSesiones.horaFin, sustituto:sustSesiones.sustitutoNombre }).from(sustSesiones).innerJoin(sustAusencias,eq(sustAusencias.id,sustSesiones.ausenciaId)).orderBy(sql`${sustAusencias.fecha} desc`,asc(sustSesiones.tramoOrden)).limit(500);
}
export async function totales() {
  return db.select({ academicYear:sustAusencias.academicYear, fecha:sustAusencias.fecha, ausente:sustAusencias.ausenteNombre, motivo:sustAusencias.motivo, sesiones:sql<number>`count(${sustSesiones.id})::int` }).from(sustAusencias).innerJoin(sustSesiones,eq(sustSesiones.ausenciaId,sustAusencias.id)).groupBy(sustAusencias.academicYear,sustAusencias.fecha,sustAusencias.ausenteNombre,sustAusencias.motivo).orderBy(sql`${sustAusencias.fecha} desc`);
}

export async function enviarInformeMensual(ahora = new Date()) {
  if (ahora.getDate() !== 1) return { omitido: true, razon: 'No es día 1.' };
  const director = process.env.SUSTITUCIONES_EMAIL_DIRECCION_TITULAR?.trim();
  if (!director) throw new Error('Falta configurar SUSTITUCIONES_EMAIL_DIRECCION_TITULAR.');
  const prev = new Date(ahora.getFullYear(), ahora.getMonth()-1, 1);
  const mes = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
  let [report] = await db.insert(sustReportesMensuales).values({ mes }).onConflictDoNothing({target:sustReportesMensuales.mes}).returning();
  if (!report) {
    [report] = await db.select().from(sustReportesMensuales).where(eq(sustReportesMensuales.mes,mes)).limit(1);
    if (!report || report.estado === 'enviado') return { omitido:true, razon:'Informe ya enviado para este mes.' };
  }
  const desde=`${mes}-01`, hasta=`${mes}-${String(new Date(prev.getFullYear(),prev.getMonth()+1,0).getDate()).padStart(2,'0')}`;
  const rows=await db.select({ ausente:sustAusencias.ausenteNombre,motivo:sustAusencias.motivo, fecha:sustAusencias.fecha, sesiones:sql<number>`count(${sustSesiones.id})::int` }).from(sustAusencias).innerJoin(sustSesiones,eq(sustAusencias.id,sustSesiones.ausenciaId)).where(and(gte(sustAusencias.fecha,desde),lte(sustAusencias.fecha,hasta))).groupBy(sustAusencias.ausenteNombre,sustAusencias.motivo,sustAusencias.fecha);
  const by=new Map<string,{actividad:number;personal:number}>(); for(const r of rows){const x=by.get(r.ausente)??{actividad:0,personal:0}; x[r.motivo==='Actividad escolar'?'actividad':'personal']+=r.sesiones; by.set(r.ausente,x);}
  const table=[...by].sort((a,b)=>a[0].localeCompare(b[0],'es')).map(([name,v])=>`<tr><td>${esc(name)}</td><td>${v.actividad}</td><td>${v.personal}</td><td>${v.actividad+v.personal}</td></tr>`).join('');
  const html=`<p>Resumen de sustituciones de ${prev.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}.</p><table border="1" cellpadding="6"><thead><tr><th>Profesor/a</th><th>Actividad escolar</th><th>Motivos personales</th><th>Total</th></tr></thead><tbody>${table||'<tr><td colspan="4">Sin sesiones registradas</td></tr>'}</tbody></table><p><a href="${appBaseUrl()}/gestion/sustituciones">Abrir Sustituciones</a></p>`;
  const jefatura=await db.select({email:authUsers.email}).from(authUsers).where(and(eq(authUsers.role,'jefe'),eq(authUsers.active,true)));
  const to=[...new Set([...jefatura.map(x=>x.email),director])];
  const enviados = new Set(report.enviadosA);
  for (const email of to) {
    if (enviados.has(email)) continue;
    await enviar('sustituciones',{to:email,subject:`Sustituciones · ${prev.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}`,html});
    enviados.add(email);
    await db.update(sustReportesMensuales).set({estado:'pendiente',enviadosA:[...enviados]}).where(eq(sustReportesMensuales.id,report.id));
  }
  await db.update(sustReportesMensuales).set({estado:'enviado',enviadosA:[...enviados],enviadoAt:new Date()}).where(eq(sustReportesMensuales.id,report.id));
  return { mes, destinatarios:to.length, sesiones:rows.reduce((n,r)=>n+r.sesiones,0) };
}
