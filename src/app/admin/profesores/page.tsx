'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STAGES, STAGE_LABELS, type StageValue } from '@/lib/constants';
import type { Teacher } from '@/db/schema';

const teacherSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email('Email inválido'),
  stage: z.string().min(1, 'Selecciona una etapa'),
});

type TeacherForm = z.infer<typeof teacherSchema>;

const ALL_STAGES = [{ value: 'all', label: 'Todas' }, ...STAGES];

// Normaliza etapas: acepta versiones con/sin tilde y variantes de capitalización
const STAGE_ALIASES: Record<string, string> = {
  'direccion': 'Direccion',
  'dirección': 'Direccion',
  'orientacion': 'Orientacion',
  'orientación': 'Orientacion',
  'ei': 'EI',
  'ep': 'EP',
  'eso': 'ESO',
  'pas': 'PAS',
};

function normalizeStage(raw: string): string {
  const key = raw.trim().toLowerCase();
  return STAGE_ALIASES[key] ?? raw.trim();
}

// Detecta automáticamente el delimitador (coma o punto y coma)
function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ';' : ',';
}

export default function ProfesoresPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [importResult, setImportResult] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
  });

  const fetchTeachers = async () => {
    const res = await fetch('/api/teachers');
    const data: Teacher[] = await res.json();
    setTeachers(data);
    setLoading(false);
  };

  useEffect(() => { fetchTeachers(); }, []);

  const onSubmit = async (data: TeacherForm) => {
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success('Profesor creado');
      reset();
      setOpen(false);
      fetchTeachers();
    } else {
      toast.error('Error creando profesor');
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const res = await fetch(`/api/teachers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    if (res.ok) setTeachers((prev) => prev.map((t) => t.id === id ? { ...t, active: !active } : t));
  };

  const deleteTeacher = async (id: string) => {
    const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTeachers((prev) => prev.filter((t) => t.id !== id));
      toast.success('Profesor eliminado');
    } else {
      toast.error('Error eliminando profesor');
    }
    setDeleteId(null);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) { toast.error('CSV vacío o sin datos'); return; }

    // Detectar delimitador automáticamente (coma o punto y coma)
    const delimiter = detectDelimiter(lines[0]);
    const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

    const expectedCols = ['firstname', 'lastname', 'email', 'stage'];
    const missingCols = expectedCols.filter((c) => !header.includes(c));
    if (missingCols.length > 0) {
      toast.error(`CSV incorrecto. Faltan columnas: ${missingCols.join(', ')}. Cabecera detectada: ${header.join(', ')}`);
      return;
    }

    const validStages = STAGES.map((s) => s.value);
    let created = 0, skipped = 0;
    const lineErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const row: Record<string, string> = {};
      header.forEach((col, idx) => { row[col] = values[idx] ?? ''; });

      const stage = normalizeStage(row.stage ?? '');

      if (!validStages.includes(stage as typeof validStages[number])) {
        lineErrors.push(`Línea ${i + 1}: etapa inválida "${row.stage}" (normalizada: "${stage}")`);
        continue;
      }

      if (!row.email || !row.firstname) {
        lineErrors.push(`Línea ${i + 1}: faltan campos obligatorios`);
        continue;
      }

      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: row.firstname,
          lastName: row.lastname,
          email: row.email.toLowerCase(),
          stage,
        }),
      });

      if (res.status === 201) created++;
      else if (res.status === 409) skipped++;
      else lineErrors.push(`Línea ${i + 1}: error al guardar`);
    }

    await fetchTeachers();
    const summary = `${created} creados, ${skipped} ya existían, ${lineErrors.length} errores`;
    setImportResult([summary, ...lineErrors].join('\n'));
    if (lineErrors.length === 0) toast.success(`✓ ${summary}`);
    else toast.warning(`Importado con errores: ${summary}`);
    e.target.value = '';
  };

  const downloadCSVSample = () => {
    const content = [
      'firstName;lastName;email;stage',
      'Ana;García López;ana.garcia@consolacion.es;ESO',
      'Pedro;Martínez;pedro.martinez@consolacion.es;Direccion',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profesores_ejemplo.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = stageFilter === 'all' ? teachers : teachers.filter((t) => t.stage === stageFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Profesores</h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Recurso global · compartido entre todas las tools</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadCSVSample} className="gap-2 rounded-xl text-sm">
            <Download className="w-4 h-4" />
            CSV ejemplo
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport} />
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Importar CSV
            </div>
          </label>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors">
              <PlusCircle className="w-4 h-4" />
              Añadir
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo profesor/a</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nombre</Label>
                    <Input {...register('firstName')} className="rounded-xl" />
                    {errors.firstName && <p className="text-xs text-rose-500">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Apellidos</Label>
                    <Input {...register('lastName')} className="rounded-xl" />
                    {errors.lastName && <p className="text-xs text-rose-500">{errors.lastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input {...register('email')} type="email" className="rounded-xl" />
                  {errors.email && <p className="text-xs text-rose-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Etapa</Label>
                  <Select onValueChange={(v: unknown) => setValue('stage', v as string)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Seleccionar etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.stage && <p className="text-xs text-rose-500">{errors.stage.message}</p>}
                </div>
                <Button type="submit" className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white">
                  Guardar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtro por etapa */}
      <div className="flex flex-wrap gap-2">
        {ALL_STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStageFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              stageFilter === s.value
                ? 'bg-teal-50 dark:bg-teal-900/40 border border-teal-400 text-teal-800 dark:text-teal-200'
                : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {importResult && (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">Resultado de importación</p>
          <pre className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap font-mono">{importResult}</pre>
          <button
            onClick={() => setImportResult(null)}
            className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400 text-center">Sin profesores en esta etapa.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500 hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Etapa</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-500">Activo</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((t) => (
                <tr key={t.id} className="group">
                  <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {t.firstName} {t.lastName}
                  </td>
                  <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400 hidden sm:table-cell text-xs">
                    {t.email}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {STAGE_LABELS[t.stage as StageValue] ?? t.stage}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(t.id, t.active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.active ? 'bg-teal-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${t.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    {deleteId === t.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => deleteTeacher(t.id)}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="text-xs text-zinc-400 hover:text-zinc-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteId(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-rose-500 transition-all"
                        aria-label="Eliminar profesor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
