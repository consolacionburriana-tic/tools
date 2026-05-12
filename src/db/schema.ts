import { boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const students = pgTable('students', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  fullName: text('full_name').notNull(),
  displayName: text('display_name').notNull(),
  className: text('class_name').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teachers = pgTable('teachers', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  stage: text('stage').notNull(), // EI | EP | ESO | PAS | Direccion | Orientacion
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const behaviorReports = pgTable('behavior_reports', {
  id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: uuid('student_id').notNull().references(() => students.id),
  teacherId: uuid('teacher_id').references(() => teachers.id),
  otherTeacherName: text('other_teacher_name'),
  reportDate: date('report_date').notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0=domingo, 6=sábado
  context: text('context').notNull(), // aula | patio | comedor | otros
  contextNote: text('context_note'),
  timeSlot: text('time_slot').notNull(), // primera_hora | antes_patio | bajadas | patio | almuerzo | despues_patio | ultima_hora
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

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Teacher = typeof teachers.$inferSelect;
export type NewTeacher = typeof teachers.$inferInsert;
export type BehaviorReport = typeof behaviorReports.$inferSelect;
export type NewBehaviorReport = typeof behaviorReports.$inferInsert;
