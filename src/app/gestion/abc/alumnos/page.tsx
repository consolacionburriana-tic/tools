'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Mail, Plus, PlusCircle, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Interruptor } from '@/components/ui/interruptor';
import { Estado } from '@/components/ui/estado';
import { Rotulo } from '@/components/ui/rotulo';
import { SkeletonRows } from '@/components/ui/skeleton';
import { claseTarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { AbcStudentPanel, DirectorioDestinatarios, PersonaDestinataria, ResultadoBusquedaAlumno } from '@/lib/abc-server';

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
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="-ml-3.5 font-normal"
      >
        <Mail aria-hidden />
        <span>
          {recipients.length > 0
            ? `Avisamos a ${recipients.length} persona${recipients.length !== 1 ? 's' : ''}`
            : 'Nadie recibe aviso de sus registros'}
        </span>
        {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
      </Button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Quién recibe hoy el aviso */}
          {recipients.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nadie recibe aviso todavía. Empieza por orientación o por su tutor/a.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((email) => {
                const p = persona(email);
                return (
                  <span
                    key={email}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-200 bg-white pl-3.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{p?.nombre ?? email}</span>
                    {p && <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.etiqueta}</span>}
                    <button
                      type="button"
                      onClick={() => quitar(email)}
                      className="flex size-10 items-center justify-center rounded-full text-zinc-500 outline-none transition-colors hover:text-red-600 focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label={`Quitar a ${p?.nombre ?? email}`}
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Sugerencias de un toque */}
          {sugeridosPendientes.length > 0 && (
            <div className="space-y-1.5">
              <Rotulo as="p">Sugeridos</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {sugeridosPendientes.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => añadir(p.email, p.nombre)}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    <Plus aria-hidden />
                    <span>{p.nombre}</span>
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">{p.etiqueta}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resto del claustro + correo suelto */}
          {recipients.length < 20 && (
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={buscador} onOpenChange={setBuscador}>
                <PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <Search aria-hidden /> Buscar en el claustro
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
                                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{p.etiqueta}</span>
                              </div>
                              {ya && <Check aria-label="Ya está" className="ml-1 size-4 text-blue-600 dark:text-blue-400" />}
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
                    aria-label="Correo"
                    className="h-10"
                  />
                  <Button type="button" size="sm" onClick={() => añadir(otro).then(() => setOtro(''))}>
                    Añadir
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setOtroAbierto(true)}>
                  <Mail aria-hidden /> Otro correo (familia, externo…)
                </Button>
              )}
            </div>
          )}
          {recipients.length >= 20 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Límite de 20 destinatarios alcanzado.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Alta por NIA ─────────────────────────────────────────────────────────────
function AltaAlumno({ onCreado }: { onCreado: (s: AbcStudentPanel) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusquedaAlumno[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [dandoDeAlta, setDandoDeAlta] = useState<string | null>(null);

  // Buscador simple: nombre, apellidos o NIA a partir de 3 caracteres, con debounce.
  const buscable = query.trim().length >= 3;
  useEffect(() => {
    if (!buscable) return;
    const t = setTimeout(() => {
      setBuscando(true);
      fetch(`/api/students/buscar?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data: ResultadoBusquedaAlumno[]) => setResultados(data))
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, buscable]);

  const alta = async (r: ResultadoBusquedaAlumno) => {
    if (r.yaEnSeguimiento) return;
    setDandoDeAlta(r.eduStudentId);
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eduStudentId: r.eduStudentId }),
    });
    setDandoDeAlta(null);
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Error dando de alta'); return; }
    toast.success(`${data.siglas} añadido al seguimiento`);
    onCreado(data);
    setQuery('');
    setResultados([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: 'outline' })}>
        <PlusCircle aria-hidden />
        Añadir alumno
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seguir a un alumno</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-3">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 3) setResultados([]); }}
              placeholder="Nombre, apellidos o NIA…"
              autoFocus
              aria-label="Buscar alumno"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Se enlaza con la BBDD central: aquí solo se guardan sus siglas y su NIA, nunca su nombre.
          </p>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {!buscable ? (
              <p className="px-1 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">Escribe al menos 3 letras.</p>
            ) : buscando ? (
              <p className="px-1 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">Buscando…</p>
            ) : resultados.length === 0 ? (
              <p className="px-1 py-3 text-center text-sm text-zinc-500 dark:text-zinc-400">Sin resultados.</p>
            ) : (
              resultados.map((r) => (
                <button
                  key={r.eduStudentId}
                  type="button"
                  disabled={r.yaEnSeguimiento || dandoDeAlta === r.eduStudentId}
                  onClick={() => alta(r)}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <span className="min-w-0 truncate text-zinc-900 dark:text-zinc-100">{r.nombre}</span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {r.yaEnSeguimiento ? 'ya en seguimiento' : r.clase || 'sin clase'}
                  </span>
                </button>
              ))
            )}
          </div>
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
    <div className="space-y-5">
      <h1 className="sr-only">Alumnado del Registro ABC</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Estos son los alumnos que salen en el formulario (no hay buscador) · la estrella marca al que viene ya
          elegido al abrirlo
        </p>
        <AltaAlumno onCreado={actualizar} />
      </div>

      {loading ? (
        <SkeletonRows n={4} />
      ) : students.length === 0 ? (
        <Vacio titulo="Sin alumnos.">Añade el primero por su NIA.</Vacio>
      ) : (
        <div className={cn(claseTarjeta, 'divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800')}>
          {students.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => marcarPorDefecto(s)}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl outline-none hover:bg-zinc-100 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-zinc-800"
                  aria-label={s.porDefecto ? 'Quitar como alumno por defecto' : 'Marcar como alumno por defecto'}
                  aria-pressed={s.porDefecto}
                >
                  <Star
                    aria-hidden
                    className={cn(
                      'size-5',
                      s.porDefecto ? 'fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500',
                    )}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tracking-wide text-zinc-900 dark:text-zinc-100">
                    {s.siglas}
                    {!s.eduStudentId && (
                      <Estado tono="aviso" className="ml-2">
                        sin enlazar
                      </Estado>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {s.clase || 'Sin clase'}
                    {s.porDefecto && ' · viene elegido al abrir el formulario'}
                  </p>
                </div>
                <Interruptor
                  etiquetaOculta
                  etiqueta={`${s.siglas} activo`}
                  activo={s.active}
                  onChange={() => toggleActivo(s)}
                />
              </div>
              <AvisosManager student={s} onUpdated={actualizar} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
