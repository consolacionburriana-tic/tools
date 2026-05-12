'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { StudentPicker } from './student-picker';
import { TeacherPicker, OTHER_TEACHER_VALUE } from './teacher-picker';
import { DateQuickPicker } from './date-quick-picker';
import { ChipSelect } from './chip-select';
import { ChipMultiselect } from './chip-multiselect';
import { EffectivenessSlider } from './effectiveness-slider';
import { FormSection, OptionalDivider } from './form-section';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft-storage';
import { haptic } from '@/lib/haptics';
import { CONTEXTS, TIME_SLOTS, PRESENT_PEOPLE, BEHAVIORS, REASONS } from '@/lib/constants';
import type { Student, Teacher } from '@/db/schema';

const schema = z.object({
  studentId: z.string().uuid('Selecciona un alumno'),
  teacherId: z.string().nullable(),
  otherTeacherName: z.string().optional(),
  reportDate: z.date(),
  context: z.enum(['aula', 'patio', 'comedor', 'otros']),
  contextNote: z.string().optional(),
  timeSlot: z.enum(['primera_hora', 'antes_patio', 'bajadas', 'patio', 'almuerzo', 'despues_patio', 'ultima_hora']),
  presentPeople: z.array(z.string()).min(1, 'Selecciona al menos una persona'),
  presentNames: z.string().optional(),
  behaviors: z.array(z.string()).min(1, 'Selecciona al menos una conducta'),
  involvedWith: z.string().optional(),
  antecedents: z.string().optional(),
  consequences: z.string().optional(),
  redirectActions: z.string().optional(),
  effectivenessRating: z.number().nullable(),
  reasons: z.array(z.string()),
  reasonOther: z.string().optional(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RegistroFormProps {
  students: Student[];
  teachers: Teacher[];
  onSuccess?: () => void;
}

export function RegistroForm({ students, teachers, onSuccess }: RegistroFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      studentId: students.length === 1 ? students[0].id : '',
      teacherId: null,
      otherTeacherName: '',
      reportDate: new Date(),
      context: 'aula',
      contextNote: '',
      timeSlot: undefined,
      presentPeople: [],
      presentNames: '',
      behaviors: [],
      involvedWith: '',
      antecedents: '',
      consequences: '',
      redirectActions: '',
      effectivenessRating: null,
      reasons: [],
      reasonOther: '',
      comments: '',
    },
  });

  // Restaurar borrador al montar
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    const fields = Object.entries(draft) as [keyof FormValues, unknown][];
    for (const [key, val] of fields) {
      if (key === 'reportDate' && typeof val === 'string') {
        setValue('reportDate', new Date(val));
      } else {
        setValue(key, val as FormValues[typeof key]);
      }
    }
  }, [setValue]);

  // Auto-save con debounce
  const formValues = watch();
  const debouncedSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debouncedSave.current) clearTimeout(debouncedSave.current);
    debouncedSave.current = setTimeout(() => {
      saveDraft(formValues as unknown as Record<string, unknown>);
    }, 500);
    return () => {
      if (debouncedSave.current) clearTimeout(debouncedSave.current);
    };
  }, [formValues]);

  const contextVal = watch('context');
  const teacherId = watch('teacherId');
  const reasons = watch('reasons');

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        reportDate: format(data.reportDate, 'yyyy-MM-dd'),
        teacherId: data.teacherId === OTHER_TEACHER_VALUE ? null : data.teacherId,
        otherTeacherName: data.teacherId === OTHER_TEACHER_VALUE ? data.otherTeacherName : null,
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error del servidor');

      await haptic.success();
      clearDraft();
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 2500);
    } catch {
      await haptic.warning();
      toast.error('No se pudo guardar el registro. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const onError = () => {
    haptic.warning();
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center gap-4 py-24 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <CheckCircle2 className="w-20 h-20 text-teal-500" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-semibold text-zinc-800 dark:text-zinc-200"
        >
          Guardado, gracias 💚
        </motion.p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8 pb-32">
      {/* Alumno */}
      <FormSection title="Alumno" required error={errors.studentId?.message}>
        <Controller
          name="studentId"
          control={control}
          render={({ field }) => (
            <StudentPicker students={students} value={field.value || null} onChange={field.onChange} />
          )}
        />
      </FormSection>

      {/* Profesor */}
      <FormSection
        title="Profesor/a que rellena"
        required
        error={errors.teacherId?.message}
      >
        <Controller
          name="teacherId"
          control={control}
          render={({ field }) => (
            <TeacherPicker
              teachers={teachers}
              value={field.value}
              onChange={field.onChange}
              otherName={watch('otherTeacherName') ?? ''}
              onOtherNameChange={(name) => setValue('otherTeacherName', name)}
            />
          )}
        />
      </FormSection>

      {/* Fecha */}
      <FormSection title="Fecha" required error={errors.reportDate?.message}>
        <Controller
          name="reportDate"
          control={control}
          render={({ field }) => (
            <DateQuickPicker value={field.value} onChange={field.onChange} />
          )}
        />
      </FormSection>

      {/* Contexto */}
      <FormSection title="¿Dónde ocurre?" required error={errors.context?.message}>
        <Controller
          name="context"
          control={control}
          render={({ field }) => (
            <ChipSelect options={[...CONTEXTS]} value={field.value} onChange={field.onChange} />
          )}
        />
        <AnimatePresence>
          {contextVal === 'otros' && (
            <motion.div
              layout
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Controller
                name="contextNote"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="Especifica el lugar…"
                    className="mt-2 rounded-xl border-zinc-200 dark:border-zinc-700"
                  />
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </FormSection>

      {/* Franja horaria */}
      <FormSection title="¿Cuándo ocurre?" required error={errors.timeSlot?.message}>
        <Controller
          name="timeSlot"
          control={control}
          render={({ field }) => (
            <ChipSelect options={[...TIME_SLOTS]} value={field.value ?? null} onChange={field.onChange} />
          )}
        />
      </FormSection>

      {/* Personas presentes */}
      <FormSection title="¿Qué personas estaban presentes?" required error={errors.presentPeople?.message}>
        <Controller
          name="presentPeople"
          control={control}
          render={({ field }) => (
            <ChipMultiselect options={[...PRESENT_PEOPLE]} value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          name="presentNames"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Nombres (opcional)"
              className="mt-2 rounded-xl border-zinc-200 dark:border-zinc-700 min-h-[72px]"
            />
          )}
        />
      </FormSection>

      {/* Conductas */}
      <FormSection title="Conducta que te preocupa" required error={errors.behaviors?.message}>
        <Controller
          name="behaviors"
          control={control}
          render={({ field }) => (
            <ChipMultiselect options={[...BEHAVIORS]} value={field.value} onChange={field.onChange} emphasized />
          )}
        />
      </FormSection>

      {/* Con quién */}
      <FormSection title="El problema se ha producido con…">
        <Controller
          name="involvedWith"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Nombres o descripción de las personas implicadas"
              className="rounded-xl border-zinc-200 dark:border-zinc-700"
            />
          )}
        />
      </FormSection>

      <OptionalDivider />

      {/* Antecedentes */}
      <FormSection title="Antecedentes">
        <Controller
          name="antecedents"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="¿Qué ocurre antes de que se desarrolle esta conducta?"
              className="rounded-xl border-zinc-200 dark:border-zinc-700 min-h-[96px]"
            />
          )}
        />
      </FormSection>

      {/* Consecuencias */}
      <FormSection title="Consecuencias">
        <Controller
          name="consequences"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="¿Qué ocurre después?"
              className="rounded-xl border-zinc-200 dark:border-zinc-700 min-h-[96px]"
            />
          )}
        />
      </FormSection>

      {/* Acciones para reconducir */}
      <FormSection title="Acciones para reconducir">
        <Controller
          name="redirectActions"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="¿Qué hiciste para reconducir la situación?"
              className="rounded-xl border-zinc-200 dark:border-zinc-700 min-h-[96px]"
            />
          )}
        />
      </FormSection>

      {/* Slider de efectividad */}
      <FormSection title="¿Ha servido para reconducir?">
        <Controller
          name="effectivenessRating"
          control={control}
          render={({ field }) => (
            <EffectivenessSlider value={field.value} onChange={field.onChange} />
          )}
        />
      </FormSection>

      {/* Motivos */}
      <FormSection title="¿Por qué crees que ha hecho esto?">
        <Controller
          name="reasons"
          control={control}
          render={({ field }) => (
            <ChipMultiselect options={[...REASONS]} value={field.value} onChange={field.onChange} />
          )}
        />
        <AnimatePresence>
          {reasons.includes('otro') && (
            <motion.div
              layout
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Controller
                name="reasonOther"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="Describe el motivo…"
                    className="mt-2 rounded-xl border-zinc-200 dark:border-zinc-700"
                  />
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </FormSection>

      {/* Comentarios */}
      <FormSection title="Otros comentarios">
        <Controller
          name="comments"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Cualquier otra observación relevante…"
              className="rounded-xl border-zinc-200 dark:border-zinc-700 min-h-[96px]"
            />
          )}
        />
      </FormSection>

      {/* Botón guardar sticky */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 z-50">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white font-semibold text-base shadow-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Guardando…
            </>
          ) : (
            'Guardar registro'
          )}
        </Button>
      </div>
    </form>
  );
}
