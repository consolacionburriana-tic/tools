'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { StudentPicker, type StudentSelection } from './student-picker';
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
import type { DestacadoItem, RosterItem } from '@/lib/abc-server';

const seleccionAlumno = z.object({
  abcStudentId: z.string().uuid().optional(),
  eduStudentId: z.string().uuid().optional(),
  label: z.string(),
});

const schema = z.object({
  student: seleccionAlumno.nullable(),
  reportDate: z.date(),
  context: z.enum(['aula', 'patio', 'comedor', 'otros']),
  contextNote: z.string().optional(),
  timeSlot: z.enum(['primera_hora', 'antes_patio', 'bajadas', 'patio', 'almuerzo', 'despues_patio', 'ultima_hora']),
  presentPeople: z.array(z.string()).min(1, 'Selecciona al menos una persona'),
  presentNames: z.string().optional(),
  behaviors: z.array(z.string()).min(1, 'Selecciona al menos una conducta'),
  involvedWith: z.string().optional(),
  reasons: z.array(z.string()),
  reasonOther: z.string().optional(),
  antecedents: z.string().optional(),
  consequences: z.string().optional(),
  redirectActions: z.string().optional(),
  effectivenessRating: z.number().nullable(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RegistroFormProps {
  destacados: DestacadoItem[];
  roster: RosterItem[];
  /** Quién registra (de la sesión) — solo informativo, el servidor lo resuelve por su cuenta */
  registradoPor: string;
  onSuccess?: () => void;
}

export function RegistroForm({ destacados, roster, registradoPor, onSuccess }: RegistroFormProps) {
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
      student: destacados.length === 1 ? { abcStudentId: destacados[0].abcStudentId, label: destacados[0].siglas } : null,
      reportDate: new Date(),
      context: 'aula',
      contextNote: '',
      timeSlot: undefined,
      presentPeople: [],
      presentNames: '',
      behaviors: [],
      involvedWith: '',
      reasons: [],
      reasonOther: '',
      antecedents: '',
      consequences: '',
      redirectActions: '',
      effectivenessRating: null,
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
  const reasons = watch('reasons');

  const onSubmit = async (data: FormValues) => {
    if (!data.student) {
      toast.error('Selecciona un alumno');
      haptic.warning();
      return;
    }
    setSubmitting(true);
    try {
      const { student, ...resto } = data;
      const payload = {
        ...resto,
        abcStudentId: student?.abcStudentId,
        eduStudentId: student?.eduStudentId,
        reportDate: format(data.reportDate, 'yyyy-MM-dd'),
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

      {/* ── Header ABC ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 space-y-2">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
          Registro de conductas
        </p>
        <p className="text-base font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Análisis{' '}
          <span className="font-bold text-teal-600 dark:text-teal-400">A</span>ntecedentes
          {' — '}
          <span className="font-bold text-teal-600 dark:text-teal-400">C</span>onducta
          {' — '}
          <span className="font-bold text-teal-600 dark:text-teal-400">C</span>onsecuencias
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Rellena los campos obligatorios{' '}
          <span className="text-teal-600 dark:text-teal-400 font-medium">*</span>
          {' '}· Los demás son opcionales y puedes completarlos después.
        </p>
      </div>

      {/* ── Campos obligatorios ────────────────────────────────────── */}

      <FormSection title="Alumno" required error={errors.student?.message}>
        <Controller
          name="student"
          control={control}
          render={({ field }) => (
            <StudentPicker
              destacados={destacados}
              roster={roster}
              value={(field.value as StudentSelection) ?? null}
              onChange={field.onChange}
            />
          )}
        />
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Registrando como <span className="font-medium text-zinc-500 dark:text-zinc-400">{registradoPor}</span>
        </p>
      </FormSection>

      <FormSection title="Fecha" required error={errors.reportDate?.message}>
        <Controller
          name="reportDate"
          control={control}
          render={({ field }) => (
            <DateQuickPicker value={field.value} onChange={field.onChange} />
          )}
        />
      </FormSection>

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

      <FormSection title="¿Cuándo ocurre?" required error={errors.timeSlot?.message}>
        <Controller
          name="timeSlot"
          control={control}
          render={({ field }) => (
            <ChipSelect options={[...TIME_SLOTS]} value={field.value ?? null} onChange={field.onChange} />
          )}
        />
      </FormSection>

      <FormSection
        title="¿Qué personas estaban presentes?"
        required
        multiselect
        error={errors.presentPeople?.message}
      >
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

      <FormSection title="Conducta que te preocupa" required multiselect error={errors.behaviors?.message}>
        <Controller
          name="behaviors"
          control={control}
          render={({ field }) => (
            <ChipMultiselect options={[...BEHAVIORS]} value={field.value} onChange={field.onChange} emphasized />
          )}
        />
      </FormSection>

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

      {/* ¿Por qué? — opcional pero antes del divisor */}
      <FormSection title="¿Por qué crees que ha hecho esto?" multiselect>
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

      <OptionalDivider />

      {/* ── Análisis A-B-C completo (opcional) ────────────────────── */}

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

      <FormSection title="¿Ha servido para reconducir?">
        <Controller
          name="effectivenessRating"
          control={control}
          render={({ field }) => (
            <EffectivenessSlider value={field.value} onChange={field.onChange} />
          )}
        />
      </FormSection>

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
