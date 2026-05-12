'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Mail, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { AbcStudent } from '@/db/schema';

const studentSchema = z.object({
  fullName: z.string().min(2, 'Mínimo 2 caracteres'),
  displayName: z.string().min(2, 'Mínimo 2 caracteres'),
  className: z.string().min(1, 'Obligatorio'),
});

type StudentForm = z.infer<typeof studentSchema>;

function autoDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts[1][0]}.`;
}

function EmailManager({ student, onUpdated }: { student: AbcStudent; onUpdated: (s: AbcStudent) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const recipients = (student.emailRecipients as string[]) ?? [];

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email no válido');
      return;
    }
    if (recipients.includes(email)) { toast.error('Ya está en la lista'); return; }
    if (recipients.length >= 20) { toast.error('Máximo 20 destinatarios'); return; }

    const updated = [...recipients, email];
    const res = await fetch(`/api/students/${student.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailRecipients: updated }),
    });
    if (res.ok) {
      onUpdated({ ...student, emailRecipients: updated });
      setNewEmail('');
      toast.success('Email añadido');
    } else {
      toast.error('Error guardando email');
    }
  };

  const removeEmail = async (email: string) => {
    const updated = recipients.filter((e) => e !== email);
    const res = await fetch(`/api/students/${student.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailRecipients: updated }),
    });
    if (res.ok) {
      onUpdated({ ...student, emailRecipients: updated });
      toast.success('Email eliminado');
    }
  };

  return (
    <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
      >
        <Mail className="w-3.5 h-3.5" />
        <span>
          {recipients.length > 0
            ? `${recipients.length} destinatario${recipients.length !== 1 ? 's' : ''} de notificación`
            : 'Sin destinatarios de email configurados'}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {recipients.length === 0 && (
            <p className="text-xs text-zinc-400 italic">Añade emails para recibir notificaciones cuando se registre una conducta de este alumno.</p>
          )}
          {recipients.map((email) => (
            <div key={email} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-1.5">
              <Mail className="w-3 h-3 text-teal-500 shrink-0" />
              <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-300 font-mono truncate">{email}</span>
              <button
                onClick={() => removeEmail(email)}
                className="text-zinc-400 hover:text-rose-500 transition-colors p-0.5"
                aria-label={`Eliminar ${email}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {recipients.length < 20 && (
            <div className="flex gap-2 pt-1">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                placeholder="correo@ejemplo.com"
                className="h-8 text-xs rounded-lg border-zinc-200 dark:border-zinc-700"
              />
              <Button
                type="button"
                onClick={addEmail}
                className="h-8 px-3 text-xs rounded-lg bg-teal-600 hover:bg-teal-700 text-white shrink-0"
              >
                Añadir
              </Button>
            </div>
          )}
          {recipients.length >= 20 && (
            <p className="text-[11px] text-zinc-400 italic">Límite de 20 destinatarios alcanzado.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlumnosPage() {
  const [students, setStudents] = useState<AbcStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
  });

  const fullNameVal = watch('fullName');
  useEffect(() => {
    if (fullNameVal) setValue('displayName', autoDisplayName(fullNameVal));
  }, [fullNameVal, setValue]);

  const fetchStudents = async () => {
    const res = await fetch('/api/students');
    const data: AbcStudent[] = await res.json();
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const onSubmit = async (data: StudentForm) => {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success('Alumno creado');
      reset();
      setOpen(false);
      fetchStudents();
    } else {
      toast.error('Error creando alumno');
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    if (res.ok) setStudents((prev) => prev.map((s) => s.id === id ? { ...s, active: !active } : s));
  };

  const updateStudent = (updated: AbcStudent) => {
    setStudents((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Alumnos</h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Específico del Registro ABC · Alta manual</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
            <PlusCircle className="w-4 h-4" />
            Añadir alumno
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo alumno</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input id="fullName" {...register('fullName')} placeholder="R. Herreros" className="rounded-xl" />
                {errors.fullName && <p className="text-xs text-rose-500">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Nombre para mostrar</Label>
                <Input id="displayName" {...register('displayName')} placeholder="R. H." className="rounded-xl" />
                {errors.displayName && <p className="text-xs text-rose-500">{errors.displayName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="className">Clase</Label>
                <Input id="className" {...register('className')} placeholder="2 ESO A" className="rounded-xl" />
                {errors.className && <p className="text-xs text-rose-500">{errors.className.message}</p>}
              </div>
              <Button type="submit" className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white">
                Guardar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Cargando…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Sin alumnos. Añade el primero.</p>
        ) : (
          students.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{s.displayName}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.fullName} · {s.className}</p>
                </div>
                <button
                  onClick={() => toggleActive(s.id, s.active)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${s.active ? 'bg-teal-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                  aria-label={s.active ? 'Desactivar' : 'Activar'}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${s.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <EmailManager student={s} onUpdated={updateStudent} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
