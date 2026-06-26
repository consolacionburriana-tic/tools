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
export const abcStudents = pgTable('abc_students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  fullName: text('full_name').notNull(),
  displayName: text('display_name').notNull(),
  className: text('class_name').notNull(),
  active: boolean('active').default(true).notNull(),
  // Hasta 20 emails que reciben notificación cuando se guarda un registro de este alumno
  emailRecipients: jsonb('email_recipients').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const abcBehaviorReports = pgTable('abc_behavior_reports', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: uuid('student_id').notNull().references(() => abcStudents.id),
  teacherId: uuid('teacher_id').references(() => teachers.id),
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
  studentCode: text('student_code').notNull(), // "N" de la BBDD, p.ej. 11SOLJOA
  educamosId: text('educamos_id'),
  apellidos: text('apellidos').notNull(),
  apellido1: text('apellido1'),
  apellido2: text('apellido2'),
  nombre: text('nombre').notNull(),
  birthYear: integer('birth_year'),
  curso: text('curso').notNull(), // curso del año de la campaña (ya promocionado)
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
