'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Mail, Plus, PlusCircle, Search, Star, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { AbcStudentPanel, DirectorioDestinatarios, PersonaDestinataria } from '@/lib/abc-server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function patchStudent(id: string, body: Record<string, unknown>): Promise<AbcStudentPanel | null> {
  const res = await fetch(`/api/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

// ─── Avisos: se eligen PERSONAS, no se teclean correos ────────────────────────
// Orientación y el tutor/a de la clase salen como sugerencias de un toque; el resto del
// claustro por buscador; y como último recurso un correo suelto (familias, externos).
function AvisosManager({ student, onUpdated }: { student: AbcStudentPanel; onUpdated: (s: AbcStudentPanel) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [dir, setDir] = useState<DirectorioDestinatarios | null>(null);
  const [buscador, setBuscador] = useState(false);
  const [otro, setOtro] = useState('');
  const [otroAbierto, setOtroAbierto] = useState(false);
  const recipients = student.emailRecipients;

  useEffect(() => {
    if (!expanded || dir) return;
    fetch(`/api/students/${student.id}/destinatarios`)
      .then((r) => r.json())
      .then(setDir)
      .catch(() => toast.error('No se pudo cargar el claustro'));
  }, [expanded, dir, student.id]);

  const guardar = useCallback(async (lista: string[]) => {
    const actualizado = await patchStudent(student.id, { emailRecipients: lista });
    if (!actualizado) { toast.error('Error guardando los avisos'); return; }
    onUpdated(actualizado);
  }, [student.id, onUpdated]);

  const añadir = async (email: string, etiqueta?: string) => {
    const limpio = email.trim().toLowerCase();
    if (!EMAIL_RE.test(limpio)) { toast.error('Correo no válido'); return; }
    if (recipients.includes(limpio)) { toast.error('Ya está en la lista'); return; }
    if (recipients.length >= 20) { toast.error('Máximo 20 destinatarios'); return; }
    await guardar([...recipients, limpio]);
    toast.success(`Avisaremos a ${etiqueta ?? limpio}`);
  };

  const quitar = async (email: string) => {
    await guardar(recipients.filter((e) => e !== email));
  };

  const persona = (email: string): PersonaDestinataria | undefined =>
    dir?.claustro.find((p) => p.email === email);

  const sugeridosPendientes = (dir?.sugeridos ?? []).filter((p) => !recipients.includes(p.email));

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-zinc-500 transition-colors hover:text-teal-600 dark:text-zinc-400 dark:hover:text-teal-400"
      >
        <Mail className="h-3.5 w-3.5" />
        <span>
          {recipients.length > 0
            ? `Avisamos a ${recipients.length} persona${recipients.length !== 1 ? 's' : ''}`
            : 'Nadie recibe aviso de sus registros'}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Quién recibe hoy el aviso */}
          {recipients.length === 0 ? (
            <p className="text-xs italic text-zinc-400">
              Nadie recibe aviso todavía. Empieza por orientación o por su tutor/a.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((email) => {
                const p = persona(email);
                return (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 py-1 pl-2.5 pr-1 text-xs dark:bg-zinc-800"
                  >
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">{p?.nombre ?? email}</span>
                    {p && <span className="text-[10px] text-teal-600 dark:text-teal-400">{p.etiqueta}</span>}
                    <button
                      onClick={() => quitar(email)}
                      className="p-0.5 text-zinc-400 transition-colors hover:text-rose-500"
                      aria-label={`Quitar a ${p?.nombre ?? email}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Sugerencias de un toque */}
          {sugeridosPendientes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Sugeridos</p>
              <div className="flex flex-wrap gap-1.5">
                {sugeridosPendientes.map((p) => (
                  <button
                    key={p.email}
                    onClick={() => añadir(p.email, p.nombre)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                      p.motivo === 'orientacion'
                        ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-200'
                        : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    <span className="font-medium">{p.nombre}</span>
                    <span className="opacity-70">{p.etiqueta}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resto del claustro + correo suelto */}
          {recipients.length < 20 && (
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={buscador} onOpenChange={setBuscador}>
                <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 transition-colors hover:border-teal-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-teal-700">
                  <Search className="h-3 w-3" /> Buscar en el claustro
                </PopoverTrigger>
                <PopoverContent className="w-72 rounded-xl p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Nombre del profe…" autoFocus />
                    <CommandList>
                      <CommandEmpty>{dir ? 'Sin resultados.' : 'Cargando…'}</CommandEmpty>
                      <CommandGroup>
                        {(dir?.claustro ?? []).map((p) => {
                          const ya = recipients.includes(p.email);
                          return (
                            <CommandItem
                              key={p.email}
                              value={`${p.nombre} ${p.etiqueta}`}
                              onSelect={() => {
                                if (!ya) añadir(p.email, p.nombre);
                                setBuscador(false);
                              }}
                              className="cursor-pointer py-2"
                            >
                              <div className="flex w-full items-baseline justify-between gap-2">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.nombre}</span>
                                <span className="shrink-0 text-[10px] text-zinc-400">{p.etiqueta}</span>
                              </div>
                              {ya && <Check className="ml-1 h-3.5 w-3.5 text-teal-500" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {otroAbierto ? (
                <div className="flex flex-1 gap-2">
                  <Input
                    type="email"
                    value={otro}
                    onChange={(e) => setOtro(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      añadir(otro).then(() => setOtro(''));
                    }}
                    placeholder="correo@ejemplo.com"
                    autoFocus
                    className="h-8 rounded-lg border-zinc-200 text-xs dark:border-zinc-700"
                  />
                  <Button
                    type="button"
                    onClick={() => añadir(otro).then(() => setOtro(''))}
                    className="h-8 shrink-0 rounded-lg bg-teal-600 px-3 text-xs text-white hover:bg-teal-700"
                  >
                    Añadir
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setOtroAbierto(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <Mail className="h-3 w-3" /> Otro correo (familia, externo…)
                </button>
              )}
            </div>
          )}
          {recipients.length >= 20 && (
            <p className="text-[11px] italic text-zinc-400">Límite de 20 destinatarios alcanzado.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Alta por NIA ─────────────────────────────────────────────────────────────
function AltaPorNia({ onCreado }: { onCreado: (s: AbcStudentPanel) => void }) {
  const [open, setOpen] = useState(false);
  const [nia, setNia] = useState('');
  const [guardando, setGuardando] = useState(false);

  const alta = async () => {
    setGuardando(true);
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nia }),
    });
    setGuardando(false);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Error dando de alta'); return; }
    toast.success(`${data.siglas} añadido al seguimiento`);
    onCreado(data);
    setNia('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700">
        <PlusCircle className="h-4 w-4" />
        Añadir alumno
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Seguir a un alumno</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nia">NIA del alumno</Label>
            <Input
              id="nia"
              value={nia}
              inputMode="numeric"
              onChange={(e) => setNia(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), alta())}
              placeholder="11358569"
              className="rounded-xl font-mono"
            />
            <p className="text-xs text-zinc-400">
              Se enlaza con la BBDD central por NIA: aquí solo se guardan sus siglas, nunca su nombre.
            </p>
          </div>
          <Button
            onClick={alta}
            disabled={guardando || nia.trim().length < 6}
            className="w-full rounded-xl bg-teal-600 text-white hover:bg-teal-700"
          >
            <UserPlus className="mr-1 h-4 w-4" /> {guardando ? 'Buscando…' : 'Añadir al seguimiento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AlumnosPage() {
  const [students, setStudents] = useState<AbcStudentPanel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((data: AbcStudentPanel[]) => { setStudents(data); setLoading(false); });
  }, []);

  const actualizar = useCallback((s: AbcStudentPanel) => {
    setStudents((prev) => (prev.some((x) => x.id === s.id) ? prev.map((x) => (x.id === s.id ? s : x)) : [s, ...prev]));
  }, []);

  const toggleActivo = async (s: AbcStudentPanel) => {
    const actualizado = await patchStudent(s.id, { active: !s.active });
    if (actualizado) actualizar(actualizado);
  };

  // Por defecto solo puede haber uno: el servidor desmarca al anterior, aquí se refleja.
  const marcarPorDefecto = async (s: AbcStudentPanel) => {
    const valor = !s.porDefecto;
    const actualizado = await patchStudent(s.id, { porDefecto: valor });
    if (!actualizado) return;
    setStudents((prev) => prev.map((x) => (x.id === s.id ? actualizado : { ...x, porDefecto: valor ? false : x.porDefecto })));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Alumnado</h1>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Estos son los alumnos que salen en el formulario (no hay buscador) · la estrella
            marca al que viene ya elegido al abrirlo
          </p>
        </div>
        <AltaPorNia onCreado={actualizar} />
      </div>

      <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="p-6 text-center text-sm text-zinc-400">Cargando…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-400">Sin alumnos. Añade el primero por su NIA.</p>
        ) : (
          students.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => marcarPorDefecto(s)}
                  className="shrink-0 cursor-pointer"
                  title={s.porDefecto ? 'Viene elegido al abrir el formulario' : 'Que venga elegido al abrir el formulario'}
                  aria-label={s.porDefecto ? 'Quitar como alumno por defecto' : 'Marcar como alumno por defecto'}
                  aria-pressed={s.porDefecto}
                >
                  <Star className={`h-5 w-5 ${s.porDefecto ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600'}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tracking-wide text-zinc-900 dark:text-zinc-100">
                    {s.siglas}
                    {!s.eduStudentId && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        sin enlazar
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{s.clase || 'Sin clase'}</p>
                </div>
                <button
                  onClick={() => toggleActivo(s)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${s.active ? 'bg-teal-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                  aria-label={s.active ? 'Desactivar' : 'Activar'}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${s.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <AvisosManager student={s} onUpdated={actualizar} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
