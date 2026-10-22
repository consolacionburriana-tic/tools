'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { StudentPicker, type StudentSelection } from './student-picker';
import { DateQuickPicker } from './date-quick-picker';
import { ChipSelect } from './chip-select';
import { ChipMultiselect } from './chip-multiselect';
import { EffectivenessSlider } from './effectiveness-slider';
import { FormSection, OptionalBlock } from './form-section';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarraAcciones } from '@/components/ui/barra-acciones';
import { Aviso } from '@/components/ui/aviso';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft-storage';
import { haptic } from '@/lib/haptics';
import { CONTEXTS, TIME_SLOTS, PRESENT_PEOPLE, BEHAVIORS, REASONS } from '@/lib/constants';
import type { AlumnoSeguimiento } from '@/lib/abc-server';

const seleccionAlumno = z.object({
  abcStudentId: z.string().uuid(),
  label: z.string(),
});

// Los mensajes salen tal cual bajo cada campo: tienen que decir qué falta, no «Invalid option».
const schema = z.object({
  student: seleccionAlumno.nullable().refine((v): boolean => v !== null, { message: 'Elige un alumno' }),
  reportDate: z.date({ error: 'Elige la fecha' }),
  context: z.enum(['aula', 'patio', 'comedor', 'otros'], { error: 'Elige dónde ocurre' }),
  contextNote: z.string().optional(),
  timeSlot: z.enum(['primera_hora', 'antes_patio', 'bajadas', 'patio', 'almuerzo', 'despues_patio', 'ultima_hora'], {
    error: 'Elige cuándo ocurre',
  }),
  presentPeople: z.array(z.string()).min(1, 'Selecciona al menos una persona'),
  presentNames: z.string().optional(),
  behaviors: z.array(z.string()).min(1, 'Selecciona al menos una conducta'),
  involvedWith: z.string().optional(),
  situationDescription: z.string().optional(),
  reasons: z.array(z.string()),
  reasonOther: z.string().optional(),
  antecedents: z.string().optional(),
  consequences: z.string().optional(),
  redirectActions: z.string().optional(),
  effectivenessRating: z.number().nullable(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Para decir en voz alta qué falta (el botón de guardar está abajo y el campo puede quedar lejos).
const TITULO_CAMPO: Partial<Record<keyof FormValues, string>> = {
  student: 'Alumno',
  reportDate: 'Fecha',
  context: '¿Dónde ocurre?',
  timeSlot: '¿Cuándo ocurre?',
  presentPeople: '¿Qué personas estaban presentes?',
  behaviors: 'Conducta que te preocupa',
};

// El botón de guardar va en un portal (`BarraAcciones`), fuera del <form> en el DOM: sin
// `form="…"` apuntando a este id, pulsarlo no enviaba nada.
const FORM_ID = 'registro-abc-form';

/** Lo que dijo el servidor, en cristiano: el estado, el motivo y, si lo hay, el detalle técnico. */
async function motivoDelServidor(res: Response): Promise<string> {
  let cuerpo: { error?: string; detalle?: string; issues?: { path?: (string | number)[]; message?: string }[] } = {};
  try {
    cuerpo = await res.json();
  } catch {
    // respuesta sin JSON (p. ej. una página de error de la plataforma)
  }
  if (res.status === 401) return 'Tu sesión ha caducado. Vuelve a entrar con tu cuenta del colegio y guarda de nuevo.';
  const partes = [`Error ${res.status}${cuerpo.error ? `: ${cuerpo.error}` : ''}`];
  if (cuerpo.issues?.length) {
    partes.push(cuerpo.issues.map((i) => `${i.path?.join('.') || 'datos'} — ${i.message}`).join(' · '));
  }
  if (cuerpo.detalle) partes.push(cuerpo.detalle.slice(0, 300));
  return partes.join(' · ');
}

interface RegistroFormProps {
  alumnos: AlumnoSeguimiento[];
  /** Quién registra (de la sesión) — solo informativo, el servidor lo resuelve por su cuenta */
  registradoPor: string;
  onSuccess?: () => void;
}

export function RegistroForm({ alumnos, registradoPor, onSuccess }: RegistroFormProps) {
  const alumnoInicial = alumnos.find((a) => a.porDefecto) ?? (alumnos.length === 1 ? alumnos[0] : null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [opcionalAbierto, setOpcionalAbierto] = useState(false);
  // Error del guardado (red, sesión, servidor, BBDD): se queda en pantalla hasta el siguiente intento.
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Viene elegido el alumno marcado por defecto en el panel (o el único que haya)
      student: alumnoInicial ? { abcStudentId: alumnoInicial.abcStudentId, label: alumnoInicial.siglas } : null,
      reportDate: new Date(),
      context: 'aula',
      contextNote: '',
      timeSlot: undefined,
      presentPeople: [],
      presentNames: '',
      behaviors: [],
      involvedWith: '',
      situationDescription: '',
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
    // Si el borrador ya traía algo del bloque opcional, se deja abierto para que se vea
    const opcionales = ['antecedents', 'consequences', 'redirectActions', 'effectivenessRating', 'comments'] as const;
    if (opcionales.some((k) => draft[k] !== null && draft[k] !== undefined && draft[k] !== '')) {
      setOpcionalAbierto(true);
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
      toast.error('Elige un alumno');
      haptic.warning();
      return;
    }
    setErrorGuardado(null);
    setSubmitting(true);
    try {
      const { student, ...resto } = data;
      const payload = {
        ...resto,
        abcStudentId: student?.abcStudentId,
        reportDate: format(data.reportDate, 'yyyy-MM-dd'),
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const motivo = await motivoDelServidor(res);
        await haptic.warning();
        setErrorGuardado(motivo);
        toast.error('No se ha guardado el registro', { description: motivo, duration: 10000 });
        return;
      }

      await haptic.success();
      clearDraft();
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
      }, 2500);
    } catch (err) {
      await haptic.warning();
      const motivo =
        err instanceof TypeError
          ? 'No hay conexión con el servidor. Comprueba el wifi o los datos y vuelve a intentarlo.'
          : `Error inesperado: ${err instanceof Error ? err.message : String(err)}`;
      setErrorGuardado(motivo);
      toast.error('No se ha guardado el registro', { description: motivo, duration: 10000 });
    } finally {
      setSubmitting(false);
    }
  };

  // Si falta algo: se dice qué (arriba, en un aviso) y se baja/sube hasta el primer campo con error.
  const onError = (errs: FieldErrors<FormValues>) => {
    haptic.warning();
    const faltan = (Object.keys(errs) as (keyof FormValues)[]).map((k) => TITULO_CAMPO[k] ?? String(k));
    setErrorGuardado(null);
    toast.error(faltan.length === 1 ? 'Falta un campo obligatorio' : `Faltan ${faltan.length} campos obligatorios`, {
      description: faltan.join(' · '),
      duration: 8000,
    });
    // Esperar al pintado de los mensajes de error para localizar el primero en la página
    setTimeout(() => {
      const primero = document.querySelector<HTMLElement>('[data-campo-error="true"]');
      primero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
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
          <CheckCircle2 aria-hidden className="w-20 h-20 text-emerald-600 dark:text-emerald-400" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-semibold text-zinc-800 dark:text-zinc-200"
        >
          Guardado, gracias
        </motion.p>
      </motion.div>
    );
  }

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8" noValidate>

      {/* ── Header ABC ─────────────────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">
          Análisis <span className="font-bold">A</span>ntecedentes — <span className="font-bold">C</span>onducta —{' '}
          <span className="font-bold">C</span>onsecuencias
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Rellena los campos obligatorios (*). Los demás son opcionales y puedes completarlos después.
        </p>
      </div>

      {/* ── Campos obligatorios ────────────────────────────────────── */}

      <FormSection title="Alumno" required error={errors.student?.message}>
        <Controller
          name="student"
          control={control}
          render={({ field }) => (
            <StudentPicker
              alumnos={alumnos}
              value={(field.value as StudentSelection) ?? null}
              onChange={field.onChange}
            />
          )}
        />
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
            <ChipSelect etiqueta="Dónde ocurre" options={[...CONTEXTS]} value={field.value} onChange={field.onChange} />
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
                    className="mt-2"
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
            <ChipSelect etiqueta="Cuándo ocurre" options={[...TIME_SLOTS]} value={field.value ?? null} onChange={field.onChange} />
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
            <ChipMultiselect etiqueta="Personas presentes" options={[...PRESENT_PEOPLE]} value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          name="presentNames"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="Nombres (opcional)"
              className="mt-2 min-h-[72px]"
            />
          )}
        />
      </FormSection>

      <FormSection title="Conducta que te preocupa" required multiselect error={errors.behaviors?.message}>
        <Controller
          name="behaviors"
          control={control}
          render={({ field }) => (
            <ChipMultiselect etiqueta="Conductas" options={[...BEHAVIORS]} value={field.value} onChange={field.onChange} />
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
            <ChipMultiselect etiqueta="Motivos" options={[...REASONS]} value={field.value} onChange={field.onChange} />
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
                    className="mt-2"
                  />
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </FormSection>

      <FormSection title="Describe la situación problemática">
        <Controller
          name="situationDescription"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="¿Qué ha pasado? Cuéntalo con tus palabras…"
              className="min-h-[120px]"
            />
          )}
        />
      </FormSection>

      {/* ── Análisis A-B-C completo (opcional, plegado) ───────────── */}

      <OptionalBlock
        title="Comentarios opcionales que nos ayudan a entender la situación"
        open={opcionalAbierto}
        onToggle={() => setOpcionalAbierto((v) => !v)}
      >
        <FormSection title="Antecedentes">
          <Controller
            name="antecedents"
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                placeholder="¿Qué ocurre antes de que se desarrolle esta conducta?"
                className="min-h-[96px]"
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
                className="min-h-[96px]"
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
                className="min-h-[96px]"
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
                className="min-h-[96px]"
              />
            )}
          />
        </FormSection>
      </OptionalBlock>

      {errorGuardado && (
        <Aviso tono="error" titulo="No se ha guardado el registro">
          <p className="break-words">{errorGuardado}</p>
          <p className="mt-1">Lo que has escrito sigue aquí: pulsa «Guardar registro» para reintentarlo.</p>
        </Aviso>
      )}

      {/* Guardar: la barra fija común, con quién registra a la izquierda */}
      <BarraAcciones
        ancho="estrecho"
        resumen={<span className="block truncate">Registra {registradoPor}</span>}
      >
        <Button type="submit" form={FORM_ID} size="lg" cargando={submitting}>
          {submitting ? 'Guardando…' : 'Guardar registro'}
        </Button>
      </BarraAcciones>
    </form>
  );
}
