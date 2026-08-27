import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ─── Recurso global (compartido entre todas las tools) ────────────────────────
export const teachers = pgTable('teachers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  stage: text('stage').notNull(), // EI | EP | ESO | PAS | Direccion | Orientacion
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Tool: Registro ABC (prefijo abc_) ────────────────────────────────────────
// Config del alumnado en el ABC: enlaza con la BBDD central y guarda los avisos.
// `destacado` = sale arriba en el formulario (lo configura el admin del módulo);
// al registrar sobre un alumno buscado en la BBDD central se autocrea su fila (destacado=false).
export const abcStudents = pgTable('abc_students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').references(() => eduStudents.id),
  fullName: text('full_name').notNull(),
  displayName: text('display_name').notNull(),
  className: text('class_name').notNull(),
  destacado: boolean('destacado').default(true).notNull(),
  active: boolean('active').default(true).notNull(),
  // Hasta 20 emails que reciben notificación cuando se guarda un registro de este alumno
  emailRecipients: jsonb('email_recipients').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const abcBehaviorReports = pgTable('abc_behavior_reports', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: uuid('student_id').notNull().references(() => abcStudents.id),
  teacherId: uuid('teacher_id').references(() => teachers.id), // legado (pre-login)
  eduTeacherId: uuid('edu_teacher_id').references(() => eduTeachers.id), // quién registró (por sesión)
  otherTeacherName: text('other_teacher_name'),
  reportDate: date('report_date').notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  context: text('context').notNull(),
  contextNote: text('context_note'),
  timeSlot: text('time_slot').notNull(),
  presentPeople: jsonb('present_people').$type<string[]>().notNull().default([]),
  presentNames: text('present_names'),
  behaviors: jsonb('behaviors').$type<string[]>().notNull().default([]),
  involvedWith: text('involved_with'),
  antecedents: text('antecedents'),
  consequences: text('consequences'),
  redirectActions: text('redirect_actions'),
  effectivenessRating: numeric('effectiveness_rating', { precision: 2, scale: 1 }),
  reasons: jsonb('reasons').$type<string[]>().default([]),
  reasonOther: text('reason_other'),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type Teacher = typeof teachers.$inferSelect;
export type NewTeacher = typeof teachers.$inferInsert;
export type AbcStudent = typeof abcStudents.$inferSelect;
export type NewAbcStudent = typeof abcStudents.$inferInsert;
export type AbcBehaviorReport = typeof abcBehaviorReports.$inferSelect;
export type NewAbcBehaviorReport = typeof abcBehaviorReports.$inferInsert;

// Aliases para no romper imports existentes en el resto del código
export const students = abcStudents;
export const behaviorReports = abcBehaviorReports;
export type Student = AbcStudent;
export type NewStudent = NewAbcStudent;
export type BehaviorReport = AbcBehaviorReport;
export type NewBehaviorReport = NewAbcBehaviorReport;

// ─── Tool: Licencias digitales (prefijo lic_) ─────────────────────────────────
export const licCampaigns = pgTable('lic_campaigns', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  academicYear: text('academic_year').notNull(),
  status: text('status').notNull().default('draft'), // draft | open | closed
  orderDeadline: date('order_deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const licStudents = pgTable('lic_students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: uuid('campaign_id').notNull().references(() => licCampaigns.id),
  studentCode: text('student_code').notNull(), // código interno, p.ej. 11SOLJOA
  educamosId: text('educamos_id'),
  eduStudentId: uuid('edu_student_id').references(() => eduStudents.id), // enlace a la BBDD central
  apellidos: text('apellidos').notNull(),
  apellido1: text('apellido1'),
  apellido2: text('apellido2'),
  nombre: text('nombre').notNull(),
  birthYear: integer('birth_year'),
  curso: text('curso').notNull(), // curso actual del alumno; se gestiona a mano en el origen (Sheet/BD), la app nunca lo avanza sola
  letra: text('letra'),
  email: text('email'),
  bancoLibros: boolean('banco_libros').notNull().default(false),
  lenguaBase: text('lengua_base'),
  active: boolean('active').notNull().default(true), // en rango del formulario
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('lic_students_campaign_code_uq').on(t.campaignId, t.studentCode),
  index('lic_students_search_idx').on(t.curso, t.birthYear, t.apellidos),
]);

export const licBooks = pgTable('lic_books', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: uuid('campaign_id').notNull().references(() => licCampaigns.id),
  cod: text('cod').notNull(),
  editorial: text('editorial'),
  curso: text('curso').notNull(),
  lengua: text('lengua'),
  asignatura: text('asignatura'),
  nombreLibro: text('nombre_libro'),
  isbn: text('isbn'),
  bancoLibros: boolean('banco_libros').notNull().default(false),
  precio: numeric('precio', { precision: 6, scale: 2 }),
  plataforma: text('plataforma'),
  textoFormulario: text('texto_formulario'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('lic_books_campaign_curso_cod_uq').on(t.campaignId, t.curso, t.cod),
]);

export const licPacks = pgTable('lic_packs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: uuid('campaign_id').notNull().references(() => licCampaigns.id),
  curso: text('curso').notNull(),
  name: text('name').notNull(),
  selectionMode: text('selection_mode').notNull().default('free'), // all | one | one_or_none | free
  bookCods: jsonb('book_cods').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const licOrders = pgTable('lic_orders', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: uuid('campaign_id').notNull().references(() => licCampaigns.id),
  studentId: uuid('student_id').notNull().references(() => licStudents.id),
  curso: text('curso'), // curso de catálogo seleccionado (3ESO vs 3PDC, etc.)
  email: text('email'), // correo de contacto de la familia
  bancoLibros: boolean('banco_libros').notNull().default(false),
  status: text('status').notNull().default('confirmado'), // confirmado | exportado | enviado | pagado
  totalPrice: numeric('total_price', { precision: 8, scale: 2 }).notNull().default('0'),
  editToken: text('edit_token').notNull().unique(),
  emailConfirmedAt: timestamp('email_confirmed_at'),
  confirmedAt: timestamp('confirmed_at'),
  // Estado tipo Excel (Q🧾/R📤/S💰): pedido a la editorial, pasado a plantillas de envío, pagado
  editorialProcessedAt: timestamp('editorial_processed_at'),
  sentToTemplateAt: timestamp('sent_to_template_at'),
  paidAt: timestamp('paid_at'),
  archived: boolean('archived').notNull().default(false), // soft-delete: se guarda como backup, no cuenta en stats
  archivedReason: text('archived_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('lic_orders_campaign_student_uq').on(t.campaignId, t.studentId),
]);

export const licOrderItems = pgTable('lic_order_items', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: uuid('order_id').notNull().references(() => licOrders.id, { onDelete: 'cascade' }),
  bookCod: text('book_cod').notNull(),
  asignatura: text('asignatura'),
  idiomaResuelto: text('idioma_resuelto'),
  precio: numeric('precio', { precision: 6, scale: 2 }),
  isBancoLibros: boolean('is_banco_libros').notNull().default(false),
  activationCode: text('activation_code'),
  emailStatus: text('email_status').notNull().default('pendiente'),
  emailSentAt: timestamp('email_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── BBDD central Educamos (prefijo edu_) ─────────────────────────────────────
export const eduStudents = pgTable('edu_students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  codigo: text('codigo').unique(), // 14PONROS — clave humana, la de Licencias
  educamosPersonaId: text('educamos_persona_id').unique(), // GUID 'ID PERSONA' del export
  nia: text('nia'),
  dni: text('dni'),
  matricula: text('matricula'),
  nombre: text('nombre'),
  apellido1: text('apellido1'),
  apellido2: text('apellido2'),
  sexo: text('sexo'),
  fechaNacimiento: date('fecha_nacimiento'),
  curso: text('curso'), // derivado de CLASE ('2ESOB' → '2ESO')
  letra: text('letra'), // '2ESOB' → 'B'; PDC = letra
  claseCodigo: text('clase_codigo'),
  tutorPersonal: text('tutor_personal'), // nombre del tutor/a de clase
  modeloLinguistico: text('modelo_linguistico'),
  deficit: text('deficit'),
  email: text('email'),
  emailGoogle: text('email_google'),
  movil1: text('movil1'),
  movil2: text('movil2'),
  telEmergencia: text('tel_emergencia'),
  familiaId: text('familia_id'), // GUID ID FAMILIA
  bancoLibros: boolean('banco_libros').notNull().default(true),
  active: boolean('active').notNull().default(true),
  extra: jsonb('extra').$type<Record<string, string>>(), // resto del export (SIN bloque pagadores)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
}, (t) => [
  index('edu_students_curso_letra_idx').on(t.curso, t.letra),
]);

export const eduGuardians = pgTable('edu_guardians', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  educamosPersonaId: text('educamos_persona_id').unique(), // GUID 'IDPERSONA TUTORn' — clave de dedupe
  nombre: text('nombre'),
  apellido1: text('apellido1'),
  apellido2: text('apellido2'),
  dni: text('dni'),
  sexo: text('sexo'),
  email: text('email'),
  emailGoogle: text('email_google'),
  telCasa: text('tel_casa'),
  telPersonal: text('tel_personal'),
  movilTrabajo: text('movil_trabajo'),
  direccion: text('direccion'),
  cp: text('cp'),
  localidad: text('localidad'),
  provincia: text('provincia'),
  extra: jsonb('extra').$type<Record<string, string>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const eduStudentGuardians = pgTable('edu_student_guardians', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: uuid('student_id').notNull().references(() => eduStudents.id),
  guardianId: uuid('guardian_id').notNull().references(() => eduGuardians.id),
  orden: integer('orden'), // 1 = TUTOR1, 2 = TUTOR2
  parentesco: text('parentesco'), // 'PADRE' | 'MADRE' | ...
  recibeInformacion: boolean('recibe_informacion'),
  guardaCustodia: boolean('guarda_custodia'),
}, (t) => [
  uniqueIndex('edu_student_guardians_uq').on(t.studentId, t.guardianId),
]);

export const eduTeachers = pgTable('edu_teachers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  alias: text('alias').unique(), // código humano del profe (columna ALIAS del export)
  educamosPersonaId: text('educamos_persona_id').unique(), // GUID 'ID PERSONA'
  nombre: text('nombre'),
  apellido1: text('apellido1'),
  apellido2: text('apellido2'),
  dni: text('dni'),
  sexo: text('sexo'),
  fechaNacimiento: date('fecha_nacimiento'),
  email: text('email'), // correo @consolacionburriana.com — casa con el login Google
  emailOtro: text('email_otro'), // el otro correo del export, si lo hay
  movilPersonal: text('movil_personal'),
  fechaAlta: date('fecha_alta'),
  fechaBaja: date('fecha_baja'),
  esTutor: boolean('es_tutor').notNull().default(false),
  claseTutor: text('clase_tutor'), // p. ej. '3º INFA'
  // Etapa a la que pertenece el profe: 'EI' | 'EP' | 'ESO' (o null si sin asignar).
  // En tutores se deriva de claseTutor; en no-tutores se asigna a mano (no está en Educamos).
  etapa: text('etapa'),
  active: boolean('active').notNull().default(true), // false si tiene fecha de baja
  extra: jsonb('extra').$type<Record<string, string>>(), // resto del export (SIN pagadores/bancos/SS/retribuciones)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
});

// Tutorías gestionadas a mano desde /gestion/profes (muchos-a-muchos: una clase puede
// tener varios tutores, un profe puede tutorizar varias clases). Se siembra una vez desde
// eduTeachers.esTutor/claseTutor pero a partir de ahí esta tabla es la fuente de verdad;
// el sync de Educamos ya NO la toca.
export const eduTutorias = pgTable('edu_tutorias', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  curso: text('curso').notNull(),
  letra: text('letra'),
  eduTeacherId: uuid('edu_teacher_id').notNull().references(() => eduTeachers.id),
  academicYear: text('academic_year').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('edu_tutorias_uq').on(t.curso, t.letra, t.eduTeacherId, t.academicYear),
]);

export type EduTutoria = typeof eduTutorias.$inferSelect;
export type NewEduTutoria = typeof eduTutorias.$inferInsert;

export const eduSyncRuns = pgTable('edu_sync_runs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  filename: text('filename'),
  formato: text('formato'), // 'csv' | 'xls' | 'xlsx'
  resumen: jsonb('resumen').$type<{
    altas: number;
    cambios: number;
    desactivados: number;
    conflictosResueltos: number;
    errores: string[];
  }>(),
  opciones: jsonb('opciones').$type<Record<string, unknown>>(), // { respetarCursoDe: 'bbdd'|'excel', ... }
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Acceso de familias (prefijo fam_) ────────────────────────────────────────
// Tokens de acceso para familias (magic links por email): un token = un correo de
// familia + los hijos que ese correo puede gestionar. Multiuso hasta que caduque o
// se revoque (una familia entra varias veces: un hijo, luego otro, luego a editar).
// Búsqueda/canje en `familias-server.ts`; generación y envío en `fam-tokens-server.ts`.
export const famAccessTokens = pgTable('fam_access_tokens', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text('token').unique().notNull(), // formato tok_<aleatorio>
  guardianId: uuid('guardian_id').references(() => eduGuardians.id), // acceso a todos sus hijos…
  studentId: uuid('student_id').references(() => eduStudents.id), // …o a un alumno concreto
  // …o a una lista explícita de hermanos, que es el caso normal de los magic links: un
  // mismo correo puede estar dado de alta como tutor DISTINTO en cada hijo (o incluso con
  // parentescos distintos), así que el token combina a mano a todos los hijos de ese
  // correo. Tiene prioridad sobre guardianId/studentId al resolver.
  studentIds: jsonb('student_ids').$type<string[]>(),
  email: text('email'), // destinatario al que se envió: clave de reutilización del token
  proposito: text('proposito'), // 'licencias' | 'salidas' | null (cualquiera)
  expiresAt: timestamp('expires_at'),
  usedAt: timestamp('used_at'), // primer uso (informativo: el token NO es de un solo uso)
  lastUsedAt: timestamp('last_used_at'),
  useCount: integer('use_count').notNull().default(0),
  sentAt: timestamp('sent_at'), // última vez que se envió por correo
  revokedAt: timestamp('revoked_at'), // anulado a mano desde el panel
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('fam_access_tokens_proposito_email_idx').on(t.proposito, t.email),
]);

export type FamAccessToken = typeof famAccessTokens.$inferSelect;
export type NewFamAccessToken = typeof famAccessTokens.$inferInsert;

// ─── Auth: usuarios y roles (prefijo auth_) ───────────────────────────────────
export const authUsers = pgTable('auth_users', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique().notNull(), // email Google del dominio
  nombre: text('nombre'),
  role: text('role').notNull(), // ver Role en src/lib/permissions.ts
  // Ajuste fino sobre lo que da el rol: el rol es el punto de partida de un clic y
  // estos dos arrays son la excepción persona a persona ("este tutor SÍ lleva las
  // evaluaciones"). Se guardan como diferencia, no como lista final, para que al
  // cambiar lo que da un rol el cambio llegue a todos menos a quien tenga excepción.
  modulosExtra: jsonb('modulos_extra').$type<string[]>().notNull().default([]),
  modulosBloqueados: jsonb('modulos_bloqueados').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type AuthUser = typeof authUsers.$inferSelect;
export type NewAuthUser = typeof authUsers.$inferInsert;

// ─── Types Educamos ───────────────────────────────────────────────────────────
export type EduTeacher = typeof eduTeachers.$inferSelect;
export type NewEduTeacher = typeof eduTeachers.$inferInsert;
export type EduStudent = typeof eduStudents.$inferSelect;
export type NewEduStudent = typeof eduStudents.$inferInsert;
export type EduGuardian = typeof eduGuardians.$inferSelect;
export type NewEduGuardian = typeof eduGuardians.$inferInsert;
export type EduStudentGuardian = typeof eduStudentGuardians.$inferSelect;
export type NewEduStudentGuardian = typeof eduStudentGuardians.$inferInsert;
export type EduSyncRun = typeof eduSyncRuns.$inferSelect;
export type NewEduSyncRun = typeof eduSyncRuns.$inferInsert;

// ─── Tool: Salidas y pagos (prefijo sal_) ─────────────────────────────────────
export const salTrips = pgTable('sal_trips', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  fecha: date('fecha'),
  importe: numeric('importe', { precision: 6, scale: 2 }),
  clases: jsonb('clases').$type<{ curso: string; letra: string | null }[]>().notNull().default([]),
  estado: text('estado').notNull().default('abierta'), // 'abierta' | 'cerrada'
  // 'transferencia' (defecto): las familias suben justificante · 'mano': el profe
  // recoge el dinero en mano y marca pagos desde el panel (no aparece en /salidas)
  tipoPago: text('tipo_pago').notNull().default('transferencia'),
  createdByEmail: text('created_by_email'), // email de sesión de quien la creó
  createdByTeacherId: uuid('created_by_teacher_id').references(() => eduTeachers.id),
  // Previsto para la futura API de Educamos (la salida y sus autorizaciones se
  // gestionan allí): id de la actividad en Educamos + resto de datos en extra.
  educamosActividadId: text('educamos_actividad_id'),
  extra: jsonb('extra').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Responsables de la salida: reciben las alertas por email cuando entra un justificante.
export const salTripManagers = pgTable('sal_trip_managers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tripId: uuid('trip_id').notNull().references(() => salTrips.id, { onDelete: 'cascade' }),
  eduTeacherId: uuid('edu_teacher_id').notNull().references(() => eduTeachers.id),
}, (t) => [
  uniqueIndex('sal_trip_managers_uq').on(t.tripId, t.eduTeacherId),
]);

export const salSignups = pgTable('sal_signups', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tripId: uuid('trip_id').notNull().references(() => salTrips.id),
  // null = entrada MANUAL: la familia no se encontró con DNI/NIA y tecleó los datos.
  // Sale muy marcada en el panel para arreglar el enlace (y el dato de origen).
  studentId: uuid('student_id').references(() => eduStudents.id),
  manualNombre: text('manual_nombre'),
  manualClase: text('manual_clase'),
  manualIdentificador: text('manual_identificador'), // lo que tecleó y no casó, para depurar
  estado: text('estado').notNull().default('apuntado'), // 'apuntado' | 'no_va' (sin fila = pendiente)
  justificanteUrl: text('justificante_url'), // Vercel Blob (privado)
  justificanteEstado: text('justificante_estado'), // null | 'subido' | 'validado' | 'rechazado'
  justificanteSubidoAt: timestamp('justificante_subido_at'),
  emailContacto: text('email_contacto'),
  // Previsto para la futura API de Educamos: autorización firmada allí.
  educamosAutorizado: boolean('educamos_autorizado'),
  educamosSyncedAt: timestamp('educamos_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('sal_signups_trip_student_uq').on(t.tripId, t.studentId),
]);

// ─── Tool: Banco de libros (prefijo bl_) ──────────────────────────────────────
// El lote físico es estable (nº dentro de una clase); cada curso académico se asigna
// a un alumno y se valora POR LIBRO (digitaliza el Word "Registro de valoración").
export const blLotes = pgTable('bl_lotes', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  curso: text('curso').notNull(),
  letra: text('letra'),
  numero: integer('numero').notNull(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('bl_lotes_clase_numero_uq').on(t.curso, t.letra, t.numero),
]);

export const blAsignaciones = pgTable('bl_asignaciones', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  loteId: uuid('lote_id').notNull().references(() => blLotes.id),
  academicYear: text('academic_year').notNull(), // '2025-26'
  studentId: uuid('student_id').notNull().references(() => eduStudents.id),
  entregado: boolean('entregado').notNull().default(false),
  docInicio: boolean('doc_inicio').notNull().default(false),
  docFin: boolean('doc_fin').notNull().default(false),
  notas: text('notas'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('bl_asignaciones_lote_year_uq').on(t.loteId, t.academicYear),
]);

export const blLibroRegistros = pgTable('bl_libro_registros', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  asignacionId: uuid('asignacion_id').notNull().references(() => blAsignaciones.id, { onDelete: 'cascade' }),
  bookCod: text('book_cod').notNull(), // COD de lic_books (banco_libros=true)
  estado: text('estado'), // 'nuevo'|'mb'|'b'|'r'|'m'|'mojado'
  borrado: boolean('borrado').notNull().default(true),
  forrado: boolean('forrado').notNull().default(true),
  notas: text('notas'),
  revisadoPorEmail: text('revisado_por_email'),
  revisadoAt: timestamp('revisado_at'),
}, (t) => [
  uniqueIndex('bl_libro_registros_uq').on(t.asignacionId, t.bookCod),
]);

export type BlLote = typeof blLotes.$inferSelect;
export type BlAsignacion = typeof blAsignaciones.$inferSelect;
export type BlLibroRegistro = typeof blLibroRegistros.$inferSelect;

// ─── Types Salidas ────────────────────────────────────────────────────────────
export type SalTrip = typeof salTrips.$inferSelect;
export type NewSalTrip = typeof salTrips.$inferInsert;
export type SalSignup = typeof salSignups.$inferSelect;
export type NewSalSignup = typeof salSignups.$inferInsert;

export const licEmailTemplates = pgTable('lic_email_templates', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  createdByEmail: text('created_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export type LicEmailTemplate = typeof licEmailTemplates.$inferSelect;

// ─── Types Licencias ──────────────────────────────────────────────────────────
export type LicCampaign = typeof licCampaigns.$inferSelect;
export type NewLicCampaign = typeof licCampaigns.$inferInsert;
export type LicStudent = typeof licStudents.$inferSelect;
export type NewLicStudent = typeof licStudents.$inferInsert;
export type LicBook = typeof licBooks.$inferSelect;
export type NewLicBook = typeof licBooks.$inferInsert;
export type LicPack = typeof licPacks.$inferSelect;
export type NewLicPack = typeof licPacks.$inferInsert;
export type LicOrder = typeof licOrders.$inferSelect;
export type NewLicOrder = typeof licOrders.$inferInsert;
export type LicOrderItem = typeof licOrderItems.$inferSelect;
export type NewLicOrderItem = typeof licOrderItems.$inferInsert;

// ─── Tool: Evaluaciones de actividades (prefijo eval_) ────────────────────────
//
// Modelo mental (ver docs/16-evaluaciones.md):
//
//   ACTIVIDAD (eval_activities) = lo que se evalúa. Vive fuera del formulario y está
//   atada a un curso académico. Se puede copiar del año anterior; las copias comparten
//   `serie_id`, que es lo que permite comparar "la Convivencia de Inicio" entre cursos.
//
//   FORMULARIO (eval_forms) = un envío concreto a UNA audiencia (alumnos, profesores o
//   familias). La misma actividad puede tener formulario de alumnos y de profesores con
//   preguntas distintas: son dos formularios que apuntan a la misma actividad.
//
//   BLOQUE (eval_blocks) = una actividad DENTRO de un formulario (un formulario puede
//   evaluar varias). Las preguntas cuelgan del bloque, no de la actividad, porque son
//   distintas según a quién se pregunte.
//
// Anonimato: los formularios son anónimos y así se les dice a quien responde. En los de
// alumnado, si el enlace llegó personalizado (`?a=<token de invitación>`) se guarda
// `edu_student_id` para poder investigar incidencias; en los de profesorado NO se guarda
// jamás identidad ni se marca quién ha respondido (100 % anónimo, decisión cerrada).
export const evalActivities = pgTable('eval_activities', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(), // '2025-26'
  nombre: text('nombre').notNull(),
  fecha: date('fecha'),
  lugar: text('lugar'),
  categoria: text('categoria').notNull().default('pastoral'), // pastoral | innovacion | general | otra
  // Puerta abierta a evaluar cosas que no son actividades (una asignatura y su profe,
  // una encuesta general a familias…). Hoy solo se crean 'actividad'.
  tipo: text('tipo').notNull().default('actividad'), // actividad | asignatura | general
  objetivo: text('objetivo'), // se muestra a PROFESORADO encima de las preguntas
  resumen: text('resumen'), // versión para ALUMNADO (explica sin "explicar el objetivo")
  notas: text('notas'), // recordatorio interno, no se muestra a quien responde
  // Misma actividad a lo largo de los años: al copiar del curso anterior se hereda.
  serieId: uuid('serie_id').notNull(),
  archivada: boolean('archivada').notNull().default(false),
  createdByEmail: text('created_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('eval_activities_year_idx').on(t.academicYear, t.categoria),
  index('eval_activities_serie_idx').on(t.serieId),
]);

export const evalForms = pgTable('eval_forms', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(),
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion'), // intro de la primera pantalla
  audiencia: text('audiencia').notNull().default('alumnos'), // alumnos | profesores | familias
  estado: text('estado').notNull().default('borrador'), // borrador | abierto | cerrado
  token: text('token').notNull().unique(), // enlace público: /evaluaciones/<token>
  anonimo: boolean('anonimo').notNull().default(true),
  // Solo alumnado: si el enlace es personalizado, se guarda de qué alumno viene.
  identificaAlumno: boolean('identifica_alumno').notNull().default(false),
  pedirClase: boolean('pedir_clase').notNull().default(false), // alumnado
  pedirEtapa: boolean('pedir_etapa').notNull().default(false), // profesorado
  requiereLogin: boolean('requiere_login').notNull().default(false),
  avisoAnonimato: text('aviso_anonimato'), // mini-indicador del pie del formulario
  mensajeFinal: text('mensaje_final'),
  clases: jsonb('clases').$type<{ curso: string; letra: string | null }[]>().notNull().default([]),
  createdByEmail: text('created_by_email'),
  abiertoAt: timestamp('abierto_at'),
  cerradoAt: timestamp('cerrado_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const evalBlocks = pgTable('eval_blocks', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  formId: uuid('form_id').notNull().references(() => evalForms.id, { onDelete: 'cascade' }),
  activityId: uuid('activity_id').references(() => evalActivities.id), // null = bloque libre
  titulo: text('titulo').notNull(),
  intro: text('intro'), // texto sobre las preguntas (objetivo si profes, resumen si alumnos)
  orden: integer('orden').notNull().default(0),
});

// Fila de una matriz de escala ("Duración", "Ambiente"…). `clave` es estable: es lo que
// permite comparar la misma fila entre formularios y entre cursos.
export interface EvalFila { clave: string; texto: string }
export interface EvalOpcion { clave: string; texto: string; correcta?: boolean }

export const evalQuestions = pgTable('eval_questions', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  blockId: uuid('block_id').notNull().references(() => evalBlocks.id, { onDelete: 'cascade' }),
  clave: text('clave').notNull(), // slug estable para comparar entre años/audiencias
  texto: text('texto').notNull(),
  ayuda: text('ayuda'),
  tipo: text('tipo').notNull().default('escala'), // escala | texto | opcion | varias | quiz
  escala: text('escala').notNull().default('nada_mucho'), // nada_mucho | 1_5 | si_no | estrellas_4 | estrellas_5
  // Solo para escalas de estrellas: con qué se pinta (estrella, corazón, fuego…).
  estilo: text('estilo'),
  filas: jsonb('filas').$type<EvalFila[]>().notNull().default([]),
  opciones: jsonb('opciones').$type<EvalOpcion[]>().notNull().default([]),
  permiteOtra: boolean('permite_otra').notNull().default(false),
  obligatoria: boolean('obligatoria').notNull().default(true),
  // Viene de un preset y hay que adaptar la frase: la ficha lo marca en ámbar hasta
  // que se toca ("aquí tienes que cambiar unas frases").
  revisar: boolean('revisar').notNull().default(false),
  feedbackAcierto: text('feedback_acierto'), // solo quiz
  feedbackFallo: text('feedback_fallo'),
  orden: integer('orden').notNull().default(0),
});

// Catálogo de preguntas guardadas para reutilizar en un clic. Las de fábrica viven en
// código (`src/lib/evaluaciones.ts`); aquí van las que el claustro guarda desde el editor.
export const evalQuestionTemplates = pgTable('eval_question_templates', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(),
  audiencia: text('audiencia').notNull().default('alumnos'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  activa: boolean('activa').notNull().default(true),
  createdByEmail: text('created_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Invitación personalizada: un enlace por destinatario (`/evaluaciones/<token>?a=<inv>`).
// En formularios de PROFESORADO existe solo para enviar el correo: nunca se marca
// respondida ni se enlaza con la respuesta.
export const evalInvites = pgTable('eval_invites', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  formId: uuid('form_id').notNull().references(() => evalForms.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  eduStudentId: uuid('edu_student_id').references(() => eduStudents.id),
  eduTeacherId: uuid('edu_teacher_id').references(() => eduTeachers.id),
  email: text('email'),
  sentAt: timestamp('sent_at'),
  respondedAt: timestamp('responded_at'), // solo alumnado/familias
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('eval_invites_form_idx').on(t.formId),
]);

export const evalResponses = pgTable('eval_responses', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  formId: uuid('form_id').notNull().references(() => evalForms.id, { onDelete: 'cascade' }),
  // Trazabilidad interna del alumnado (solo si el enlace era personalizado). NUNCA se
  // rellena en formularios de profesorado.
  eduStudentId: uuid('edu_student_id').references(() => eduStudents.id),
  curso: text('curso'),
  letra: text('letra'),
  etapa: text('etapa'),
  email: text('email'), // solo formularios nominales
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('eval_responses_form_idx').on(t.formId),
]);

export const evalAnswers = pgTable('eval_answers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  responseId: uuid('response_id').notNull().references(() => evalResponses.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => evalQuestions.id, { onDelete: 'cascade' }),
  filaClave: text('fila_clave'), // null si la pregunta no es matriz
  valorNum: integer('valor_num'), // escalas (1..4 / 1..5) y sí/no (1/0)
  opcionClave: text('opcion_clave'), // opcion | varias | quiz
  valorTexto: text('valor_texto'), // texto libre y "Otra"
}, (t) => [
  index('eval_answers_question_idx').on(t.questionId),
]);

export const evalEmailTemplates = pgTable('eval_email_templates', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(),
  audiencia: text('audiencia').notNull().default('alumnos'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  createdByEmail: text('created_by_email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Types Evaluaciones ───────────────────────────────────────────────────────
export type EvalActivity = typeof evalActivities.$inferSelect;
export type NewEvalActivity = typeof evalActivities.$inferInsert;
export type EvalForm = typeof evalForms.$inferSelect;
export type NewEvalForm = typeof evalForms.$inferInsert;
export type EvalBlock = typeof evalBlocks.$inferSelect;
export type NewEvalBlock = typeof evalBlocks.$inferInsert;
export type EvalQuestion = typeof evalQuestions.$inferSelect;
export type NewEvalQuestion = typeof evalQuestions.$inferInsert;
export type EvalInvite = typeof evalInvites.$inferSelect;
export type EvalResponse = typeof evalResponses.$inferSelect;
export type EvalAnswer = typeof evalAnswers.$inferSelect;
export type EvalQuestionTemplate = typeof evalQuestionTemplates.$inferSelect;
export type EvalEmailTemplate = typeof evalEmailTemplates.$inferSelect;
