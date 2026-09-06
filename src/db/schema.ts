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
// Config del alumnado en el ABC: enlaza con la BBDD central por NIA y guarda los avisos.
// Aquí NO se guarda el nombre: solo el NIA (vínculo) y las siglas (lo único que se pinta).
// El formulario NO tiene buscador: enseña exactamente estas filas (las activas), porque el
// módulo es para el puñado de alumnos con muchas necesidades que se dan de alta a mano.
export const abcStudents = pgTable('abc_students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').references(() => eduStudents.id),
  nia: text('nia'), // clave humana del vínculo con edu_students (sobrevive a resyncs)
  siglas: text('siglas'), // 'R.H.' — dos iniciales, sacadas de edu_students al crear la fila
  // El alumno que viene ya elegido al abrir el formulario (como mucho uno a la vez)
  porDefecto: boolean('por_defecto').notNull().default(false),
  // Legado pre-vínculo (2026-08-31): ya no se escriben; el nombre vive en edu_students.
  fullName: text('full_name'),
  displayName: text('display_name'),
  className: text('class_name'),
  destacado: boolean('destacado').default(true).notNull(), // legado: hoy manda `active`
  active: boolean('active').default(true).notNull(), // sale (o no) en el formulario
  // Hasta 20 emails que reciben notificación cuando se guarda un registro de este alumno
  emailRecipients: jsonb('email_recipients').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('abc_students_nia_uq').on(t.nia),
  uniqueIndex('abc_students_edu_student_uq').on(t.eduStudentId),
]);

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
  noteText: text('note_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const licStudents = pgTable('lic_students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: uuid('campaign_id').notNull().references(() => licCampaigns.id),
  // Etiqueta heredada del Excel original (p.ej. 11SOLJOA). YA NO ES CLAVE DE NADA: se genera a
  // partir del nombre, así que cambia sola en cuanto cambia la regla (acentos, apellidos con
  // espacios) y eso daba bajas+altas fantasma de la misma persona. Se conserva porque sale en
  // exportaciones y en el Excel del colegio.
  studentCode: text('student_code').notNull(),
  educamosId: text('educamos_id'),
  /** La identidad del alumno: FK a la BBDD central. Es la clave con la que se empareja. */
  eduStudentId: uuid('edu_student_id').references(() => eduStudents.id),
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
  // Marcado a mano desde "Quién falta" para alumnos que en realidad no tienen que hacer pedido
  // (p.ej. PDC). Deja de contar como pendiente aunque no haya lic_orders para él.
  manualCompletedAt: timestamp('manual_completed_at'),
  manualCompletedReason: text('manual_completed_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  // Un alumno, una fila por campaña. Antes la única era (campaign_id, student_code), y como el
  // código se recalcula del nombre, un alumno que cambiaba de código entraba como alta nueva y
  // el viejo se desactivaba — llevándose por delante el pedido que lo referenciaba.
  uniqueIndex('lic_students_campaign_edu_uq').on(t.campaignId, t.eduStudentId),
  index('lic_students_campaign_code_idx').on(t.campaignId, t.studentCode),
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
  ampa: boolean('ampa').notNull().default(false),
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

// Tutor PERSONAL de un alumno concreto. Cuando una clase tiene dos (o tres) tutores, la
// tutoría del grupo es de todos, pero cada alumno "es" de uno solo: es a esa persona a
// quien se avisa de lo que le pasa a ese alumno en particular. Una fila por alumno y curso
// académico (sin fila = sin tutor personal asignado todavía, que es lo normal en cuanto
// llega alumnado nuevo: no se autoasigna nunca, ver /gestion/profes).
export const eduTutorPersonal = pgTable('edu_tutor_personal', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').notNull().references(() => eduStudents.id, { onDelete: 'cascade' }),
  eduTeacherId: uuid('edu_teacher_id').notNull().references(() => eduTeachers.id),
  academicYear: text('academic_year').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('edu_tutor_personal_uq').on(t.eduStudentId, t.academicYear),
]);

export type EduTutorPersonal = typeof eduTutorPersonal.$inferSelect;

// "Este reparto de alumnos entre los tutores de la clase ya está revisado para este curso".
// Sin fila = la pantalla avisa de que falta confirmarlo. Se guarda por clase y curso
// académico; `letra` va notNull con '' (no nullable como en edu_tutorias) a propósito:
// un índice único con NULL no deduplica, y aquí hacemos upsert sobre él.
export const eduRepartoConfirmado = pgTable('edu_reparto_confirmado', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  curso: text('curso').notNull(),
  letra: text('letra').notNull().default(''),
  academicYear: text('academic_year').notNull(),
  confirmadoAt: timestamp('confirmado_at').defaultNow().notNull(),
  confirmadoPor: text('confirmado_por'), // email de la sesión que lo confirmó
}, (t) => [
  uniqueIndex('edu_reparto_confirmado_uq').on(t.curso, t.letra, t.academicYear),
]);

export type EduRepartoConfirmado = typeof eduRepartoConfirmado.$inferSelect;

export const eduSyncRuns = pgTable('edu_sync_runs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Qué se sincronizó. Las filas antiguas (anteriores a esta columna) son todas de
  // alumnado salvo las que llevan `opciones.tipo = 'profesores'`, de ahí el default.
  tipo: text('tipo').notNull().default('alumnado'), // 'alumnado' | 'profesorado'
  filename: text('filename'),
  formato: text('formato'), // 'csv' | 'xls' | 'xlsx'
  quienEmail: text('quien_email'), // quién lo lanzó (email de la sesión)
  resumen: jsonb('resumen').$type<{
    altas: number;
    cambios: number;
    desactivados: number;
    conflictosResueltos: number;
    errores: string[];
    sinCambios?: number;
    tutores?: number;
    vinculos?: number;
  }>(),
  opciones: jsonb('opciones').$type<Record<string, unknown>>(), // { respetarCursoDe: 'bbdd'|'excel', ... }
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('edu_sync_runs_created_idx').on(t.createdAt),
]);

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

// Libros del banco configurados a mano por curso (mientras el catálogo de Licencias no esté
// listo o no encaje: una asignatura puede tener varios libros). El `book_cod` de
// bl_libro_registros para estos es `manual:<id>`, nunca choca con los COD de lic_books.
export const blLibrosCurso = pgTable('bl_libros_curso', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  curso: text('curso').notNull(),
  asignatura: text('asignatura'),
  nombre: text('nombre').notNull(),
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  // COD del Excel "BBDD Libros" (mismo origen que lic_books) cuando la fila viene del
  // conector de sincronización; NULL en los libros tecleados a mano. Identidad de upsert:
  // Postgres no choca varios NULL en un índice único, así que los manuales conviven sin más.
  cod: text('cod'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('bl_libros_curso_curso_idx').on(t.curso),
  uniqueIndex('bl_libros_curso_curso_cod_uq').on(t.curso, t.cod),
]);

export type BlLote = typeof blLotes.$inferSelect;
export type BlAsignacion = typeof blAsignaciones.$inferSelect;
export type BlLibroRegistro = typeof blLibroRegistros.$inferSelect;
export type BlLibroCurso = typeof blLibrosCurso.$inferSelect;

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
  // Acento visual de la actividad en el formulario público (hex). Se asigna al azar de
  // un catálogo curado al crearla; se puede cambiar desde el editor en un clic. Copiar
  // la actividad a otro curso conserva el color, para que se siga reconociendo.
  color: text('color'),
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
  // Color dominante del formulario público (hex): botón de enviar, barra/anillo de
  // progreso, tinte muy suave del fondo y las manchas decorativas. Distinto del color
  // de cada actividad (eval_activities.color, que solo acenta su propio bloque): este
  // es el que "viste" la experiencia entera de quien responde.
  color: text('color'),
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

// ─── Tool: Puntualidad (prefijo pun_) ─────────────────────────────────────────
//
// Modelo mental (ver docs/17-puntualidad.md):
//
//   REGISTRO (pun_records) = un alumno llegó tarde un día a una hora. Es la unidad del
//   módulo y se crea en segundos: alumno + asignatura + hora. El retraso en minutos se
//   calcula contra la hora límite del centro (08:05) y se GUARDA junto con el límite
//   vigente, para que cambiar la constante mañana no reescriba la historia.
//
//   ASIGNATURA (pun_subjects) = catálogo editable desde el panel. Hoy se elige a mano;
//   cuando estén los horarios del claustro en la app, la asignatura (y su profe) se
//   deducirán del día + hora y este campo se rellenará solo. `edu_teacher_id` ya está
//   aquí para eso: es el profe al que se avisará cuando ese aviso se encienda.
//
//   CONSECUENCIA (con_consequences) = "este día se queda sin patio". Lleva prefijo PROPIO
//   (`con_`) a propósito: cada 3 retrasos no justificados se genera una, pero una
//   consecuencia NO está siempre atada a la puntualidad (mañana puede venir de convivencia
//   o crearse a mano). El vínculo con los retrasos que la motivaron vive en la tabla
//   puente `con_consequence_records`, así que el día que las consecuencias sean módulo
//   aparte se mueven estas tres tablas y no hay que renombrar nada.
export const punSubjects = pgTable('pun_subjects', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(),
  abreviatura: text('abreviatura'), // lo que se pinta en el chip del formulario ('GEH')
  // Profe que la imparte, cuando se sepa. Hoy opcional y sin uso: es el destinatario del
  // aviso "tu alumno llegó tarde a tu clase" que queda escrito pero apagado.
  eduTeacherId: uuid('edu_teacher_id').references(() => eduTeachers.id),
  orden: integer('orden').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const punRecords = pgTable('pun_records', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').notNull().references(() => eduStudents.id),
  // Clase congelada en el momento del registro: el alumno promociona, el histórico no.
  curso: text('curso'),
  letra: text('letra'),
  fecha: date('fecha').notNull(),
  hora: text('hora').notNull(), // 'HH:mm' hora de llegada (sin zona horaria, es hora de centro)
  horaLimite: text('hora_limite').notNull(), // 'HH:mm' vigente al registrar
  minutosRetraso: integer('minutos_retraso').notNull(),
  subjectId: uuid('subject_id').references(() => punSubjects.id),
  justificado: boolean('justificado').notNull().default(false),
  justificacionTipo: text('justificacion_tipo'), // 'familiar' | 'medico' | 'transporte' | 'otro'
  justificacionNota: text('justificacion_nota'),
  subeAClase: boolean('sube_a_clase').notNull().default(false),
  observaciones: text('observaciones'),
  eduTeacherId: uuid('edu_teacher_id').references(() => eduTeachers.id), // quién lo registró
  registradoPorEmail: text('registrado_por_email'),
  academicYear: text('academic_year').notNull(),
  // Aviso al profe de la asignatura: escrito pero apagado hasta que estén los horarios.
  avisoProfeEnviadoAt: timestamp('aviso_profe_enviado_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('pun_records_alumno_fecha_idx').on(t.eduStudentId, t.fecha),
  index('pun_records_fecha_idx').on(t.fecha),
  index('pun_records_year_idx').on(t.academicYear),
]);

// Catálogo abierto de tipos de consecuencia. Hoy solo 'sin_patio'; se pueden añadir más
// desde el panel sin tocar código (aula de convivencia, tarde, tarea…).
export const conConsequenceTypes = pgTable('con_consequence_types', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clave: text('clave').notNull().unique(), // 'sin_patio'
  nombre: text('nombre').notNull(), // 'Se queda sin patio'
  orden: integer('orden').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conConsequences = pgTable('con_consequences', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').notNull().references(() => eduStudents.id),
  tipoClave: text('tipo_clave').notNull().default('sin_patio'),
  // De dónde nace: 'puntualidad' (las 3 acumuladas) o 'manual'. Deja sitio a otros
  // orígenes el día que las consecuencias sean su propio módulo.
  origen: text('origen').notNull().default('puntualidad'),
  fecha: date('fecha'), // el día que la cumple; null mientras el tutor no la fija
  motivo: text('motivo'), // frase del aviso ('3er retraso del curso: 12/09, 18/09 y 24/09')
  notas: text('notas'),
  cumplida: boolean('cumplida').notNull().default(false),
  cumplidaAt: timestamp('cumplida_at'),
  avisadaEducamos: boolean('avisada_educamos').notNull().default(false),
  avisadaEducamosAt: timestamp('avisada_educamos_at'),
  // Enlace de un clic del correo al tutor (token propio del módulo, no de familias).
  token: text('token').unique(),
  tokenExpiraAt: timestamp('token_expira_at'),
  avisoEnviadoAt: timestamp('aviso_enviado_at'),
  avisoDestinatarios: jsonb('aviso_destinatarios').$type<string[]>(),
  creadaPorEmail: text('creada_por_email'), // null si la generó el sistema
  fijadaPorEmail: text('fijada_por_email'), // quién puso la fecha (tutor)
  academicYear: text('academic_year').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('con_consequences_alumno_idx').on(t.eduStudentId),
  index('con_consequences_fecha_idx').on(t.fecha),
]);

// Qué retrasos motivaron una consecuencia. Un retraso ya vinculado NO vuelve a contar para
// el siguiente ciclo de tres: es así como "se reinicia el contador" sin guardar contadores.
export const conConsequenceRecords = pgTable('con_consequence_records', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  consequenceId: uuid('consequence_id').notNull().references(() => conConsequences.id, { onDelete: 'cascade' }),
  punRecordId: uuid('pun_record_id').notNull().references(() => punRecords.id, { onDelete: 'cascade' }),
}, (t) => [
  uniqueIndex('con_consequence_records_uq').on(t.consequenceId, t.punRecordId),
  index('con_consequence_records_record_idx').on(t.punRecordId),
]);

// Bitácora del resumen semanal a tutores (para no mandarlo dos veces si el cron repite).
export const punDigestRuns = pgTable('pun_digest_runs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  semana: text('semana').notNull().unique(), // '2026-W36' (lunes de la semana resumida)
  enviados: integer('enviados').notNull().default(0),
  destinatarios: jsonb('destinatarios').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Types Puntualidad ────────────────────────────────────────────────────────
export type PunSubject = typeof punSubjects.$inferSelect;
export type NewPunSubject = typeof punSubjects.$inferInsert;
export type PunRecord = typeof punRecords.$inferSelect;
export type NewPunRecord = typeof punRecords.$inferInsert;
export type ConConsequence = typeof conConsequences.$inferSelect;
export type NewConConsequence = typeof conConsequences.$inferInsert;
export type ConConsequenceType = typeof conConsequenceTypes.$inferSelect;

// ─── Cuaderno de tutor (prefijo cuad_) ────────────────────────────────────────
// Generador de la documentación de tutoría a partir de plantillas de Google Docs.
// Ficha: docs/18-cuaderno-tutor.md. La idea de fondo: el código NO conoce las etiquetas de
// las plantillas (son de David y las cambia cuando quiere); conoce campos, y `cuad_alias`
// traduce etiqueta → campo. Nada de esto guarda datos personales: solo referencias a
// alumnos (`edu_students.id`) e ids de Drive.

export const cuadPlantillas = pgTable('cuad_plantillas', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(), // 'Dossier Personal' — sale en el nombre del archivo
  googleDocId: text('google_doc_id').notNull(), // id del Google Doc plantilla
  // 'alumno' = una copia por alumno · 'trimestre' = una por trimestre · 'unica' = una sola.
  repeticion: text('repeticion').notNull().default('alumno'),
  etapa: text('etapa'), // 'EI' | 'EP' | 'ESO' · null = vale para todas
  orden: integer('orden').notNull().default(1), // el `x` de "1.x" en el nombre del archivo
  saltoDePagina: boolean('salto_de_pagina').notNull().default(true),
  generaPdf: boolean('genera_pdf').notNull().default(true),
  activa: boolean('activa').notNull().default(true),
  // Última lectura de la plantilla: etiquetas encontradas y si tiene filas repetibles.
  etiquetas: jsonb('etiquetas').$type<string[]>(),
  tieneFilas: boolean('tiene_filas').notNull().default(false),
  analizadaAt: timestamp('analizada_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Etiqueta normalizada → campo del catálogo. Es el "aprendizaje" del panel: se mapea una
// vez y no se vuelve a preguntar, aunque la etiqueta aparezca en otras plantillas.
export const cuadAlias = pgTable('cuad_alias', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  etiqueta: text('etiqueta').notNull().unique(), // normalizada: 'n_clase'
  campo: text('campo').notNull(), // id del catálogo: 'clase'
  creadoPor: text('creado_por'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Ajustes del módulo (fila única, id fijo 'global'): la carpeta base de Drive la da David.
export const cuadAjustes = pgTable('cuad_ajustes', {
  id: text('id').primaryKey().default('global'),
  carpetaBaseId: text('carpeta_base_id'), // id de la subcarpeta de la unidad compartida
  carpetaBaseUrl: text('carpeta_base_url'),
  nombreCentro: text('nombre_centro').notNull().default('Colegio Consolación Burriana'),
  // Al compartir la carpeta de clase: 'reader' (solo imprimir) o 'writer' (rellenar a mano).
  permisoTutores: text('permiso_tutores').notNull().default('writer'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Una ejecución del generador. `numero` es el 1, 2, 3… del curso escolar: la primera tirada
// va a la carpeta de la clase y las siguientes a una subcarpeta "aammdd - Ejecución N".
export const cuadTiradas = pgTable('cuad_tiradas', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(),
  numero: integer('numero').notNull().default(1),
  estado: text('estado').notNull().default('pendiente'), // pendiente | ejecutando | hecha | error | cancelada
  opciones: jsonb('opciones').$type<{
    formatos: ('doc' | 'pdf')[];
    cuadernoCompletoPdf: boolean;
    compartir: boolean;
    avisarPorCorreo: boolean;
    soloSinHoja: boolean;
    subcarpetaPropia: boolean;
  }>(),
  carpetaCursoId: text('carpeta_curso_id'), // carpeta "Cuaderno de tutor 2026-2027"
  carpetaCursoUrl: text('carpeta_curso_url'),
  lanzadaPor: text('lanzada_por'), // email de la sesión
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  // Latido del worker: la única forma de distinguir "va lento" de "no ha arrancado nunca".
  // `pases` cuenta las vueltas del worker sobre esta tirada (una por invocación).
  latidoAt: timestamp('latido_at'),
  pases: integer('pases').notNull().default(0),
}, (t) => [
  index('cuad_tiradas_estado_idx').on(t.estado),
]);

// Bitácora de la tirada: lo que el panel le cuenta a quien la lanzó y lo que se mira
// después para saber por qué algo no salió. Es append-only y se borra con la tirada.
export const cuadEventos = pgTable('cuad_eventos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tiradaId: uuid('tirada_id').references(() => cuadTiradas.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id'), // sin FK: el evento sobrevive al borrado de un ítem
  nivel: text('nivel').notNull().default('info'), // info | aviso | error
  fase: text('fase').notNull(), // lanzar | worker | drive | documento | cierre | correo | toque
  mensaje: text('mensaje').notNull(),
  datos: jsonb('datos').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('cuad_eventos_tirada_idx').on(t.tiradaId, t.createdAt),
]);

// La unidad de trabajo de la cola: un documento = un tutor × una plantilla.
// `alumnoIds` es el SNAPSHOT de quién entró en ese documento, que es lo que permite saber
// después a quién le falta su hoja y regenerar solo eso.
export const cuadItems = pgTable('cuad_items', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tiradaId: uuid('tirada_id').notNull().references(() => cuadTiradas.id, { onDelete: 'cascade' }),
  plantillaId: uuid('plantilla_id').notNull().references(() => cuadPlantillas.id),
  curso: text('curso').notNull(),
  letra: text('letra').notNull().default(''),
  eduTeacherId: uuid('edu_teacher_id').references(() => eduTeachers.id), // null = clase sin tutor
  indiceTutor: integer('indice_tutor').notNull().default(1),
  alumnoIds: jsonb('alumno_ids').$type<string[]>().notNull().default([]),
  estado: text('estado').notNull().default('pendiente'), // pendiente | haciendo | hecho | error | omitido
  docId: text('doc_id'),
  docUrl: text('doc_url'),
  pdfId: text('pdf_id'),
  pdfUrl: text('pdf_url'),
  carpetaId: text('carpeta_id'), // carpeta donde acabó (la de la clase o la de la ejecución)
  carpetaUrl: text('carpeta_url'),
  intentos: integer('intentos').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('cuad_items_tirada_estado_idx').on(t.tiradaId, t.estado),
  index('cuad_items_estado_idx').on(t.estado),
]);

// Número de lista congelado por curso escolar. Una vez impreso el cuaderno, el nº 14 es el
// nº 14 todo el año: quien llega tarde recibe el siguiente número libre de su clase, y en
// los listados regenerados aparece como "7* (31)" (ver `numeroListaTexto`).
export const cuadNumeracion = pgTable('cuad_numeracion', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').notNull().references(() => eduStudents.id, { onDelete: 'cascade' }),
  academicYear: text('academic_year').notNull(),
  curso: text('curso').notNull(),
  letra: text('letra').notNull().default(''),
  numero: integer('numero').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('cuad_numeracion_uq').on(t.eduStudentId, t.academicYear),
  index('cuad_numeracion_clase_idx').on(t.academicYear, t.curso, t.letra),
]);

// "Este alumno ya tiene su hoja de esta plantilla en este curso escolar". Lo escribe el
// worker cuando un documento sale bien; es lo que contesta a "¿a quién le falta?".
export const cuadHojas = pgTable('cuad_hojas', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduStudentId: uuid('edu_student_id').notNull().references(() => eduStudents.id, { onDelete: 'cascade' }),
  plantillaId: uuid('plantilla_id').notNull().references(() => cuadPlantillas.id, { onDelete: 'cascade' }),
  academicYear: text('academic_year').notNull(),
  tiradaId: uuid('tirada_id').references(() => cuadTiradas.id, { onDelete: 'set null' }),
  itemId: uuid('item_id').references(() => cuadItems.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('cuad_hojas_uq').on(t.eduStudentId, t.plantillaId, t.academicYear),
]);

// ─── Types Cuaderno de tutor ──────────────────────────────────────────────────
export type CuadPlantilla = typeof cuadPlantillas.$inferSelect;
export type NewCuadPlantilla = typeof cuadPlantillas.$inferInsert;
export type CuadAlias = typeof cuadAlias.$inferSelect;
export type CuadAjustes = typeof cuadAjustes.$inferSelect;
export type CuadTirada = typeof cuadTiradas.$inferSelect;
export type NewCuadTirada = typeof cuadTiradas.$inferInsert;
export type CuadItem = typeof cuadItems.$inferSelect;
export type NewCuadItem = typeof cuadItems.$inferInsert;
export type CuadNumeracion = typeof cuadNumeracion.$inferSelect;
export type CuadHoja = typeof cuadHojas.$inferSelect;
export type CuadEvento = typeof cuadEventos.$inferSelect;
// ─── Horarios (prefijo hor_, pieza transversal) ───────────────────────────────
//
// Modelo mental (ver docs/07-horarios.md). TRES CAPAS, separadas a propósito:
//
//   1. LA REJILLA — cuándo hay huecos.
//      hor_periodos    tramo de FECHAS con horario propio (ordinario / junio / septiembre),
//                      con prioridad: el de junio pisa al ordinario en sus fechas. Va por
//                      fechas y no por meses porque "normalmente junio" nunca empieza el
//                      mismo día dos años seguidos.
//      hor_rejillas    la plantilla de huecos de ese periodo ("Primaria ordinaria").
//      hor_tramos      UN hueco: rejilla + día + orden + horas. Hay una fila por
//                      (rejilla, DÍA, orden) y no una por orden compartida entre días:
//                      así los viernes de primaria pueden tener las mismas 6 sesiones con
//                      horas distintas sin descolocar nada, porque las sesiones del horario
//                      se refieren al tramo por ORDEN (la 3ª), nunca por hora.
//      hor_rejilla_ambitos  a quién aplica cada rejilla, con precedencia:
//                      centro → etapa → curso → curso+letra. Gana el más específico.
//
//   2. LA ASIGNACIÓN DOCENTE — qué se imparte, a quién y por quién. Existe con
//      independencia de en qué hueco cae (es el "Unterricht" de Untis). Es la unidad que
//      se importa y la que se duplica de un curso al siguiente.
//      hor_actividades       catálogo del TIPO de hora (clase, guardia, departamento,
//                            reunión, atención a padres…), con `lectiva` y
//                            `cubre_sustitucion`.
//      hor_materias          catálogo de asignaturas COMPARTIDO del centro.
//      hor_asignaciones      actividad + materia + aula + periodo.
//      hor_asignacion_grupos a qué grupo(s)/subgrupo(s) va (varios = optativa que junta
//                            dos clases; subgrupo = desdoble).
//      hor_asignacion_profes qué profe(s), con rol y `principal` (varios = dos profes en
//                            el aula, o PT/AL entrando a apoyar).
//
//   3. LA COLOCACIÓN — hor_sesiones: la celda del horario, una asignación puesta en un
//      tramo. SIN unicidad por grupo ni por profe a propósito: dos sesiones del mismo
//      grupo en el mismo tramo es un desdoble legítimo y dos del mismo profe es un error
//      de verdad; esa diferencia la sabe el negocio, no una constraint. Los choques salen
//      como informe de conflictos.
//
// Y encima, hor_apoyos: QUÉ ALUMNOS concretos toca una asignación de PT/AL. El horario de
// PT y AL viene en el fichero como el de cualquier profe (son asignaciones normales); lo
// que no viene, y se mete a mano, es a quién sacan o a quién acompañan.

export const horPeriodos = pgTable('hor_periodos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(), // '2026-27'
  nombre: text('nombre').notNull(), // 'Ordinario', 'Junio', 'Septiembre'
  fechaInicio: date('fecha_inicio').notNull(),
  fechaFin: date('fecha_fin').notNull(),
  // A mayor prioridad, gana cuando dos periodos se solapan en una fecha. El ordinario va
  // a 0 y puede cubrir el curso entero; junio y septiembre van por encima y le recortan.
  prioridad: integer('prioridad').notNull().default(0),
  esOrdinario: boolean('es_ordinario').notNull().default(false),
  notas: text('notas'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hor_periodos_year_idx').on(t.academicYear),
  index('hor_periodos_fechas_idx').on(t.fechaInicio, t.fechaFin),
]);

export const horRejillas = pgTable('hor_rejillas', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  periodoId: uuid('periodo_id').notNull().references(() => horPeriodos.id),
  nombre: text('nombre').notNull(), // 'Primaria ordinaria', 'Secundaria junio'
  notas: text('notas'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hor_rejillas_periodo_idx').on(t.periodoId),
]);

// A quién aplica una rejilla. Cuantos más campos rellenos, más específica y más manda:
// todo a null = centro entero · solo etapa = 'EP' · etapa+curso = '1PRI' · +letra = '1PRI A'.
export const horRejillaAmbitos = pgTable('hor_rejilla_ambitos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  rejillaId: uuid('rejilla_id').notNull().references(() => horRejillas.id),
  etapa: text('etapa'), // 'EI' | 'EP' | 'ESO' | 'BACH' | 'CFGM' | 'CFGS'
  curso: text('curso'), // '2ESO'
  letra: text('letra'), // 'B'
}, (t) => [
  index('hor_rejilla_ambitos_rejilla_idx').on(t.rejillaId),
  uniqueIndex('hor_rejilla_ambitos_uq').on(t.rejillaId, t.etapa, t.curso, t.letra),
]);

export const horTramos = pgTable('hor_tramos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  rejillaId: uuid('rejilla_id').notNull().references(() => horRejillas.id),
  diaSemana: integer('dia_semana').notNull(), // 1 = lunes … 5 = viernes
  orden: integer('orden').notNull(), // 1ª, 2ª… incluidos recreos, para que el orden sea el real
  etiqueta: text('etiqueta'), // '1ª', 'Patio', '6ª'
  // Hora de centro en texto 'HH:mm', sin zona horaria — igual que `pun_records.hora`.
  horaInicio: text('hora_inicio').notNull(),
  horaFin: text('hora_fin').notNull(),
  tipo: text('tipo').notNull().default('sesion'), // 'sesion'|'recreo'|'comedor'|'entrada'|'salida'|'otro'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('hor_tramos_uq').on(t.rejillaId, t.diaSemana, t.orden),
  index('hor_tramos_rejilla_dia_idx').on(t.rejillaId, t.diaSemana),
]);

export const horActividades = pgTable('hor_actividades', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  codigo: text('codigo').notNull().unique(), // 'clase'|'guardia'|'departamento'|'reunion'|…
  nombre: text('nombre').notNull(),
  // Defecto del catálogo; `hor_asignaciones.lectiva` lo pisa cuando toque (hay reuniones
  // que caen en hora lectiva y otras que no).
  lectiva: boolean('lectiva').notNull().default(true),
  // ¿Si el profe falta, hay que cubrir esta hora? Y al revés: la guardia es la hora desde
  // la que se cubre. Las dos preguntas del futuro módulo de sustituciones.
  cubreSustitucion: boolean('cubre_sustitucion').notNull().default(false),
  requiereGrupo: boolean('requiere_grupo').notNull().default(false),
  color: text('color'),
  orden: integer('orden').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const horMaterias = pgTable('hor_materias', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nombre: text('nombre').notNull(),
  abreviatura: text('abreviatura'), // 'GEH' — lo que se pinta en la celda del horario
  etapa: text('etapa'),
  orden: integer('orden').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Espacios físicos del centro (aulas, pistas, salas). Nacen porque los horarios traen el
// aula en la celda ('EFI1 - SDOM0 - Poli2') con su propia leyenda de códigos, y porque el
// navegador tiene que poder mirar el horario POR AULA. Hoy el dato es pobre y sucio en el
// origen (tres códigos, 'POLI' y 'Poli2' conviviendo), así que `hor_asignaciones.aula`
// sigue existiendo como texto libre: `espacio_id` es lo que se rellena cuando el código se
// reconoce, y el texto es la red de seguridad para no perder lo que no se reconoce.
export const horEspacios = pgTable('hor_espacios', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  codigo: text('codigo').notNull().unique(), // 'POLI2', 'MUS' — normalizado a mayúsculas
  nombre: text('nombre').notNull(), // 'Polideportivo 2'
  tipo: text('tipo'), // 'aula' | 'pista' | 'sala' | 'laboratorio' | 'otro'
  // ¿Caben varias clases a la vez? En el polideportivo sí: dos grupos haciendo EF en las
  // dos pistas no es un choque, es un martes normal. En un aula, dos clases a la vez SÍ es
  // un error. Por eso el detector de conflictos mira esta columna en vez de suponer que
  // todo espacio es exclusivo.
  admiteSolapes: boolean('admite_solapes').notNull().default(false),
  capacidad: integer('capacidad'),
  notas: text('notas'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const horAsignaciones = pgTable('hor_asignaciones', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  periodoId: uuid('periodo_id').notNull().references(() => horPeriodos.id),
  academicYear: text('academic_year').notNull(),
  actividadId: uuid('actividad_id').notNull().references(() => horActividades.id),
  materiaId: uuid('materia_id').references(() => horMaterias.id), // null: una guardia no tiene materia
  etiqueta: text('etiqueta'), // 'Religión desdoble A', 'Reunión de departamento de Ciencias'
  lectiva: boolean('lectiva'), // null = lo que diga la actividad
  espacioId: uuid('espacio_id').references(() => horEspacios.id),
  aula: text('aula'), // lo que venía en el fichero, aunque no se reconociera
  notas: text('notas'),
  origen: text('origen').notNull().default('manual'), // 'importado' | 'manual'
  importRunId: uuid('import_run_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hor_asignaciones_periodo_idx').on(t.periodoId),
  index('hor_asignaciones_year_idx').on(t.academicYear),
]);

// Grupos por texto (curso + letra), como en todo el repo (edu_tutorias, pun_records…).
// Varias filas = una asignación que junta clases (la optativa de 1ESO A + 1ESO B).
export const horAsignacionGrupos = pgTable('hor_asignacion_grupos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  asignacionId: uuid('asignacion_id').notNull().references(() => horAsignaciones.id),
  curso: text('curso').notNull(),
  letra: text('letra'),
  subgrupo: text('subgrupo'), // desdoble: 'A1', 'Religión', 'Valores'
}, (t) => [
  index('hor_asignacion_grupos_asig_idx').on(t.asignacionId),
  index('hor_asignacion_grupos_clase_idx').on(t.curso, t.letra),
]);

export const horAsignacionProfes = pgTable('hor_asignacion_profes', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  asignacionId: uuid('asignacion_id').notNull().references(() => horAsignaciones.id),
  eduTeacherId: uuid('edu_teacher_id').notNull().references(() => eduTeachers.id),
  rol: text('rol').notNull().default('titular'), // 'titular'|'apoyo'|'pt'|'al'|'practicas'
  // El que responde por esa hora cuando hace falta uno solo (p. ej. el destinatario del
  // aviso de Puntualidad). Los demás siguen ahí, no se pierden.
  principal: boolean('principal').notNull().default(false),
}, (t) => [
  uniqueIndex('hor_asignacion_profes_uq').on(t.asignacionId, t.eduTeacherId),
  index('hor_asignacion_profes_profe_idx').on(t.eduTeacherId),
]);

export const horSesiones = pgTable('hor_sesiones', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  asignacionId: uuid('asignacion_id').notNull().references(() => horAsignaciones.id),
  tramoId: uuid('tramo_id').notNull().references(() => horTramos.id),
  // Desnormalizados desde el tramo: pintar la cuadrícula de una clase no debería
  // necesitar tres joins.
  diaSemana: integer('dia_semana').notNull(),
  orden: integer('orden').notNull(),
  // null = todas las semanas (es lo que hay hoy). Está por si algún día hay ciclo
  // quincenal: es el segundo caso más común en las herramientas de horarios y cuesta
  // una columna nullable ahora frente a una migración entonces.
  semana: text('semana'),
  espacioId: uuid('espacio_id').references(() => horEspacios.id), // pisa el de la asignación
  aula: text('aula'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('hor_sesiones_uq').on(t.asignacionId, t.tramoId),
  index('hor_sesiones_tramo_idx').on(t.tramoId),
]);

// Alumnos concretos atendidos por PT/AL en una asignación. El profe y la hora salen de la
// asignación (que viene del fichero como cualquier otra); esto es lo que NO viene y se
// mete a mano desde orientación. `modalidad` distingue al PT que entra al aula del AL que
// se lleva al alumno fuera, y `sale_de_asignacion_id` dice de qué clase se lo llevan — que
// es la pregunta de verdad ("¿a este alumno siempre le estamos quitando Lengua?").
export const horApoyos = pgTable('hor_apoyos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  asignacionId: uuid('asignacion_id').notNull().references(() => horAsignaciones.id),
  eduStudentId: uuid('edu_student_id').notNull().references(() => eduStudents.id),
  modalidad: text('modalidad').notNull().default('fuera'), // 'dentro' | 'fuera'
  saleDeAsignacionId: uuid('sale_de_asignacion_id').references(() => horAsignaciones.id),
  // Estos apoyos se reorganizan a mitad de curso; con fechas el histórico no se pierde.
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  notas: text('notas'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('hor_apoyos_asig_idx').on(t.asignacionId),
  index('hor_apoyos_alumno_idx').on(t.eduStudentId),
]);

// Traducción de los códigos del fichero externo a nuestros IDs ('ALP' → un edu_teacher,
// '2ESOB' → curso 2ESO letra B). Aquí vive el 90% del dolor de un importador: con esta
// tabla, la segunda importación y todas las siguientes solo preguntan por los códigos nuevos.
export const horAlias = pgTable('hor_alias', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tipo: text('tipo').notNull(), // 'profe' | 'materia' | 'grupo' | 'aula'
  codigoExterno: text('codigo_externo').notNull(),
  eduTeacherId: uuid('edu_teacher_id').references(() => eduTeachers.id),
  materiaId: uuid('materia_id').references(() => horMaterias.id),
  espacioId: uuid('espacio_id').references(() => horEspacios.id),
  curso: text('curso'),
  letra: text('letra'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('hor_alias_uq').on(t.tipo, t.codigoExterno),
]);

// Bitácora de importaciones, calcada de edu_sync_runs.
export const horImportRuns = pgTable('hor_import_runs', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  periodoId: uuid('periodo_id').references(() => horPeriodos.id),
  tipo: text('tipo').notNull().default('horarios'), // 'horarios' | 'rejillas'
  filename: text('filename'),
  formato: text('formato'), // 'csv' | 'xls' | 'xlsx'
  quienEmail: text('quien_email'),
  resumen: jsonb('resumen').$type<{
    asignaciones: number;
    sesiones: number;
    profesVinculados: number;
    aliasNuevos: number;
    conflictos: string[];
    errores: string[];
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('hor_import_runs_created_idx').on(t.createdAt),
]);

// ─── Types Horarios ───────────────────────────────────────────────────────────
export type HorPeriodo = typeof horPeriodos.$inferSelect;
export type NewHorPeriodo = typeof horPeriodos.$inferInsert;
export type HorRejilla = typeof horRejillas.$inferSelect;
export type NewHorRejilla = typeof horRejillas.$inferInsert;
export type HorTramo = typeof horTramos.$inferSelect;
export type NewHorTramo = typeof horTramos.$inferInsert;
export type HorActividad = typeof horActividades.$inferSelect;
export type HorMateria = typeof horMaterias.$inferSelect;
export type NewHorMateria = typeof horMaterias.$inferInsert;
export type HorAsignacion = typeof horAsignaciones.$inferSelect;
export type NewHorAsignacion = typeof horAsignaciones.$inferInsert;
export type HorSesion = typeof horSesiones.$inferSelect;
export type NewHorSesion = typeof horSesiones.$inferInsert;
export type HorEspacio = typeof horEspacios.$inferSelect;
export type NewHorEspacio = typeof horEspacios.$inferInsert;
export type HorApoyo = typeof horApoyos.$inferSelect;
export type NewHorApoyo = typeof horApoyos.$inferInsert;

// Calendario de festivos del centro: COMPARTIDO (no es de cada profe), por rangos porque
// Navidad, Fallas y Semana Santa lo son, y meterlos día a día es garantizar que alguien se
// deje uno. Lo usa "Mi horario" para no crear eventos en días sin clase, y algún día también
// el navegador para pintarlos. El primero que los mete los deja puestos para el resto del
// claustro — no hay "mis festivos", son los del centro.
export const horFestivos = pgTable('hor_festivos', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(),
  nombre: text('nombre').notNull(), // 'Navidad', '9 d\'Octubre', 'Fallas'
  fechaInicio: date('fecha_inicio').notNull(),
  fechaFin: date('fecha_fin').notNull(), // igual a fechaInicio si es un solo día
  tipo: text('tipo').notNull().default('festivo'), // 'festivo' | 'vacaciones' | 'no_lectivo'
  notas: text('notas'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('hor_festivos_year_idx').on(t.academicYear),
  index('hor_festivos_fechas_idx').on(t.fechaInicio, t.fechaFin),
]);

export type HorFestivo = typeof horFestivos.$inferSelect;
export type NewHorFestivo = typeof horFestivos.$inferInsert;

// ─── Tool: Mi horario (prefijo mih_) ───────────────────────────────────────────
//
// Módulo pequeño y personal: cada profe ve SOLO lo suyo y se lo lleva a su Google Calendar.
// No tiene datos de horario propios — todo sale de `hor_*` — solo dos cosas que son de cada
// persona: cómo quiere que se llamen sus eventos, y el registro de qué se exportó para poder
// deshacerlo. Ver docs/20-mi-horario.md.

export const mihPreferencias = pgTable('mih_preferencias', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduTeacherId: uuid('edu_teacher_id').notNull().unique().references(() => eduTeachers.id),
  plantillaTitulo: text('plantilla_titulo').notNull().default('{emoji} {abrev} · {clase}'),
  plantillaDescripcion: text('plantilla_descripcion'),
  // Emoji por clave: 'materia:<id>' o 'actividad:<codigo>'. Empieza vacío; la pantalla
  // propone los del centro (ver EMOJIS_POR_DEFECTO en mihorario.ts) y esto guarda solo lo
  // que la persona ha CAMBIADO respecto a esa propuesta — igual que auth_users con los
  // módulos extra/bloqueados: la propuesta del centro puede mejorar sin pisar lo que alguien
  // ya eligió a mano.
  emojis: jsonb('emojis').$type<Record<string, string>>().notNull().default({}),
  calendarioGoogleId: text('calendario_google_id'), // null = el calendario principal
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type MihPreferencias = typeof mihPreferencias.$inferSelect;
export type NewMihPreferencias = typeof mihPreferencias.$inferInsert;

// Bitácora de qué se exportó, para poder deshacer sin tocar lo que la persona haya puesto a
// mano en su calendario: cada evento creado se marca con `origen` (ver mihorario-google.ts)
// y esta fila es la que dice "esto es lo tuyo de este periodo, se puede borrar limpio".
export const mihExportaciones = pgTable('mih_exportaciones', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eduTeacherId: uuid('edu_teacher_id').notNull().references(() => eduTeachers.id),
  periodoId: uuid('periodo_id').notNull().references(() => horPeriodos.id),
  calendarioGoogleId: text('calendario_google_id').notNull(),
  eventosCreados: integer('eventos_creados').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('mih_exportaciones_profe_idx').on(t.eduTeacherId, t.periodoId),
]);

export type MihExportacion = typeof mihExportaciones.$inferSelect;
export type NewMihExportacion = typeof mihExportaciones.$inferInsert;

// Asignaturas por curso para el cuaderno de tutor. Salen del horario (`hor_materias` vía
// `hor_asignaciones`) con un botón, y a partir de ahí se editan a mano: el horario dice
// "Valencià: Llengua i Literatura" y en una hoja impresa cabe "Valencià".
//
// El CÓDIGO de una asignatura (`<<asignatura1>>`, `<<asignatura2>>`…) es su POSICIÓN dentro
// del curso, no un id: la plantilla es la misma para todos los cursos y cada clase rellena
// las suyas. Por eso `orden` es lo único que decide qué sale en cada hueco.
export const cuadAsignaturas = pgTable('cuad_asignaturas', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(),
  curso: text('curso').notNull(), // '2ESO', '1PRI'… (sin letra: son del curso, no de la clase)
  nombre: text('nombre').notNull(), // el nombre largo, tal cual viene del horario
  nombreCorto: text('nombre_corto'), // 'Mates' — si está, es lo que sale en las hojas
  orden: integer('orden').notNull().default(1),
  // De dónde salió, para que "traer del horario" no pise lo que se editó a mano.
  horMateriaId: uuid('hor_materia_id').references(() => horMaterias.id, { onDelete: 'set null' }),
  origen: text('origen').notNull().default('manual'), // 'horario' | 'manual'
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('cuad_asignaturas_curso_idx').on(t.academicYear, t.curso, t.orden),
]);

export type CuadAsignatura = typeof cuadAsignaturas.$inferSelect;
export type NewCuadAsignatura = typeof cuadAsignaturas.$inferInsert;

// ─── AUTOASM (prefijo asm_) ───────────────────────────────────────────────────
//
// El módulo trabaja en el navegador y no guarda ningún export en la base de datos (ver
// docs/19-autoasm.md). Lo único que sí vive aquí son DOS cosas que tienen que sobrevivir
// al navegador de quien lo prepare:
//
//   1. El **histórico de entregas**: qué día se generó el fichero y si se llegó a subir a
//      Apple School Manager, a mano o por FTP. Sin nombres ni NIAs: solo recuentos.
//   2. La **configuración del FTP**, con la contraseña cifrada (nunca en claro, ver
//      `src/lib/cripto.ts`), para no tener que pedirla cada septiembre.

export const asmEntregas = pgTable('asm_entregas', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  academicYear: text('academic_year').notNull(),
  // 'descargado' = se generó el ZIP y ahí se quedó · 'ftp' = lo subió el módulo ·
  // 'manual' = lo subió una persona a mano y lo marcó aquí.
  modo: text('modo').notNull().default('descargado'),
  estado: text('estado').notNull().default('ok'), // 'ok' | 'error'
  quien: text('quien'), // correo de quien lo hizo
  desdeCurso: text('desde_curso'), // alcance del alumnado en esa entrega ('6PRI', null = todo)
  // Recuentos del ZIP: sirven para el histórico y para no tener que guardar los ficheros.
  alumnos: integer('alumnos').notNull().default(0),
  profes: integer('profes').notNull().default(0),
  cursos: integer('cursos').notNull().default(0),
  clases: integer('clases').notNull().default(0),
  matriculas: integer('matriculas').notNull().default(0),
  errores: integer('errores').notNull().default(0),
  avisos: integer('avisos').notNull().default(0),
  fichero: text('fichero'), // nombre del ZIP generado
  destino: text('destino'), // host y carpeta, si se subió por FTP
  detalle: text('detalle'), // notas o el error, si lo hubo
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('asm_entregas_year_idx').on(t.academicYear, t.createdAt),
]);

export const asmFtpConfig = pgTable('asm_ftp_config', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  protocolo: text('protocolo').notNull().default('ftps'), // 'ftps' | 'ftp' | 'sftp'
  host: text('host').notNull(),
  puerto: integer('puerto'),
  usuario: text('usuario').notNull(),
  // AES-256-GCM (ver src/lib/cripto.ts). Nunca sale de aquí hacia el navegador.
  passwordCifrada: text('password_cifrada').notNull(),
  ruta: text('ruta').notNull().default('/'), // carpeta remota donde deja los CSV
  notas: text('notas'),
  actualizadoPor: text('actualizado_por'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type AsmEntrega = typeof asmEntregas.$inferSelect;
export type NewAsmEntrega = typeof asmEntregas.$inferInsert;
export type AsmFtpConfig = typeof asmFtpConfig.$inferSelect;
