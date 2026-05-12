'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Student } from '@/db/schema';

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

export default function AlumnosPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
  });

  const fullNameVal = watch('fullName');
  useEffect(() => {
    if (fullNameVal) {
      setValue('displayName', autoDisplayName(fullNameVal));
    }
  }, [fullNameVal, setValue]);

  const fetchStudents = async () => {
    const res = await fetch('/api/students');
    const data: Student[] = await res.json();
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
    if (res.ok) {
      setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, active: !active } : s)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Alumnos</h1>
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

      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Cargando…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Sin alumnos. Añade el primero.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Clase</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 dark:text-zinc-400">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{s.displayName}</p>
                      <p className="text-xs text-zinc-400">{s.fullName}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">{s.className}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(s.id, s.active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.active ? 'bg-teal-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${s.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
