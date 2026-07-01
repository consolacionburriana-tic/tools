'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Check, ChevronLeft, Info, Languages, Loader2, TriangleAlert } from 'lucide-react';
import {
  type Candidate,
  type CatalogBook,
  CURSOS_FORM,
  baseCod,
  cursoLabel,
  euros,
  normalize,
} from '@/lib/licencias';

interface Pack {
  name: string;
  selectionMode: string;
  bookCods: string[];
}

type Step = 'identify' | 'licenses' | 'review' | 'done';

interface Props {
  campaignName: string;
  deadline: string | null;
  processedBeforeStart: boolean;
}

interface SubmitResult {
  total: number;
  itemCount: number;
  emailStatus: string;
}

const isOptativa = (b: CatalogBook) => /optativa/i.test(b.asignatura);
const isValenciano = (lengua: string | null) => /valenc/i.test(lengua ?? '');

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
      {children}
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
    >
      <ChevronLeft className="h-4 w-4" /> Atrás
    </button>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  );
}

function BookCard({ book, on, onToggle }: { book: CatalogBook; on: boolean; onToggle: () => void }) {
  const opt = isOptativa(book);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer ${
        on
          ? opt
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
            : 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
          : opt
            ? 'border-amber-300/70 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-500/[0.04] hover:bg-amber-50 dark:hover:bg-amber-500/10'
            : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
          on
            ? opt
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-blue-600 bg-blue-600 text-white'
            : 'border-zinc-300 dark:border-zinc-600'
        }`}
      >
        {on && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{book.asignatura}</span>
          {opt && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Optativa
            </span>
          )}
          {isValenciano(book.lengua) && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
              Valencià
            </span>
          )}
        </span>
        <span className="block text-xs text-zinc-400">
          {book.editorial}
          {book.nombreLibro ? ` · ${book.nombreLibro}` : ''}
        </span>
      </span>
      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{euros(parseFloat(book.precio || '0'))}</span>
    </button>
  );
}

const stepAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

export function LicenciasForm({ deadline, processedBeforeStart }: Props) {
  const [step, setStep] = useState<Step>('identify');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const [curso, setCurso] = useState<string>('');
  const [apellidos, setApellidos] = useState('');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [student, setStudent] = useState<Candidate | null>(null);

  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [bancoLibros, setBancoLibros] = useState(false);
  const [lenguaBase, setLenguaBase] = useState<string | null>(null);
  const [effCurso, setEffCurso] = useState('');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [email, setEmail] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);

  const selectedBooks = useMemo(() => catalog.filter((b) => selected.has(b.cod)), [catalog, selected]);
  const total = useMemo(
    () => selectedBooks.reduce((s, b) => s + parseFloat(b.precio || '0'), 0),
    [selectedBooks],
  );
  const anyOptativaSelected = selectedBooks.some(isOptativa);

  const grupos = useMemo(() => {
    if (!packs.length) return [{ name: null as string | null, hint: null as string | null, books: catalog }];
    const hintFor = (m: string) =>
      m === 'one' ? 'Elige una' : m === 'one_or_none' ? 'Elige una o ninguna' : m === 'todos' ? 'Recomendadas todas' : null;
    const used = new Set<string>();
    const gs = packs
      .map((p) => {
        const bases = new Set(p.bookCods.map(baseCod));
        const books = catalog.filter((b) => bases.has(baseCod(b.cod)));
        books.forEach((b) => used.add(b.cod));
        return { name: p.name as string | null, hint: hintFor(p.selectionMode), books };
      })
      .filter((g) => g.books.length > 0);
    const resto = catalog.filter((b) => !used.has(b.cod));
    if (resto.length) gs.push({ name: 'Otras licencias' as string | null, hint: null, books: resto });
    return gs;
  }, [packs, catalog]);
  const deadlineLabel = deadline
    ? new Date(deadline + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    : null;

  useEffect(() => {
    if (!curso || normalize(apellidos).length < 3) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch('/api/licencias/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ curso, apellidos }),
        });
        const data = await res.json();
        setCandidates(res.ok ? (data.candidates ?? []) : []);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [curso, apellidos]);

  async function elegirAlumno(c: Candidate) {
    setError(null);
    setLoading(true);
    setStudent(c);
    try {
      const [catRes, ordRes] = await Promise.all([
        fetch(`/api/licencias/catalog?studentId=${c.id}&curso=${encodeURIComponent(curso)}`),
        fetch(`/api/licencias/orders?studentId=${c.id}`),
      ]);
      const cat = await catRes.json();
      if (!catRes.ok) throw new Error(cat.error ?? 'Error');
      setCatalog(cat.books);
      setBancoLibros(cat.bancoLibros);
      setLenguaBase(cat.lenguaBase ?? null);
      setEffCurso(cat.curso ?? curso);
      setPacks(cat.packs ?? []);
      const ord = await ordRes.json();
      setSelected(new Set<string>(ord.order ? (ord.cods ?? []) : []));
      if (ord.order?.email) setEmail(ord.order.email);
      setStep('licenses');
    } catch {
      setError('No se pudo cargar el catálogo. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function toggle(cod: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  }

  async function confirmar() {
    setError(null);
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Introduce un correo electrónico válido.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/licencias/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student!.id, curso: effCurso || curso, email, cods: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setResult({ total: data.total, itemCount: data.itemCount, emailStatus: data.emailStatus });
      setStep('done');
    } catch {
      setError('No se pudo registrar el pedido. Inténtalo de nuevo y si continua contacta con licencias@consolacionburriana.com');
    } finally {
      setLoading(false);
    }
  }

  function otroHijo() {
    setStep('identify');
    setCurso('');
    setApellidos('');
    setCandidates([]);
    setStudent(null);
    setCatalog([]);
    setSelected(new Set());
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {step === 'identify' && (
          <motion.div key="identify" {...stepAnim}>
            <Card>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Nuevo pedido de licencias</h2>
              <p className="mt-2 text-sm text-zinc-500">

                Las licencias digitales <strong>no son obligatorias</strong>. 
                Marca solo las que quieras solicitar.
                {deadlineLabel && <> Plazo: hasta el <strong>{deadlineLabel}</strong> (no se permitirán pedidos después)</>}
              </p>

              <p className="mt-5 mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">¿En qué curso estará EL AÑO QUE VIENE?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CURSOS_FORM.map((c) => (
                  <Choice
                    key={c.value}
                    active={curso === c.value}
                    onClick={() => setCurso(c.value)}
                  >
                    {c.label}
                  </Choice>
                ))}
              </div>

              {curso && (
                <>
                  <label className="mt-5 mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Apellidos del alumno/a
                  </label>
                  <input
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Escribe los apellidos…"
                    autoComplete="off"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  />

                  <div className="mt-3 min-h-[1.25rem]">
                    {searching && (
                      <p className="flex items-center gap-2 text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                      </p>
                    )}
                    {!searching && normalize(apellidos).length >= 3 && candidates.length === 0 && (
                      <p className="text-sm text-zinc-500">
                        No encontramos a nadie con esos datos. Escribe el <strong>APELLIDO</strong> más completo o revisa el curso.
                      </p>
                    )}
                  </div>

                  {candidates.length > 0 && (
                    <div className="mt-1 space-y-2">
                      <p className="text-xs text-zinc-400">Selecciona al alumno/a (datos abreviados por privacidad):</p>
                      {candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => elegirAlumno(c)}
                          disabled={loading}
                          className="flex w-full items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                        >
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {c.maskedName} {c.apellidos}
                          </span>
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                          ) : (
                            <ChevronLeft className="h-4 w-4 rotate-180 text-zinc-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
                </>
              )}

              <p className="mt-6 text-xs text-zinc-400">
                ¿Dudas o algún error? Escríbenos a{' '}
                <a href="mailto:tic@consolacionburriana.com" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
                  licencias@consolacionburriana.com
                </a>
              </p>
            </Card>
          </motion.div>
        )}

        {step === 'licenses' && student && (
          <motion.div key="licenses" {...stepAnim}>
            <Card>
              <Back onClick={() => { setError(null); setStep('identify'); }} />
              <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Licencias para {student.maskedName} {student.apellidos}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                    bancoLibros
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  {bancoLibros ? 'Banco de Libros' : 'Sin Banco de Libros'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                    isValenciano(lenguaBase)
                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  }`}
                >
                  <Languages className="h-4 w-4" />
                  Clase en {isValenciano(lenguaBase) ? 'Valencià' : 'Castellano'}
                </span>
                {effCurso.endsWith('PDC') && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                    Programa PDC
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm text-zinc-500">
                {bancoLibros
                  ? 'Como estáis en el Banco de Libros, los libros del banco se gestionan aparte. Aquí solo eliges las licencias de pago.'
                  : 'Selecciona las licencias digitales que quieras solicitar.'}
              </p>

              <div className="mt-4 space-y-4">
                {catalog.length === 0 && (
                  <p className="text-sm text-zinc-500">No hay licencias disponibles para este curso, es posible que sea un error. Contacta con licencias@consolacionburriana.com</p>
                )}
                {grupos.map((g, gi) => (
                  <div key={gi} className="space-y-2">
                    {g.name && (
                      <div className="flex items-center justify-between px-1 pt-1">
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{g.name}</p>
                        {g.hint && <span className="text-xs text-zinc-400">{g.hint}</span>}
                      </div>
                    )}
                    {g.books.map((b) => (
                      <BookCard key={b.cod} book={b} on={selected.has(b.cod)} onToggle={() => toggle(b.cod)} />
                    ))}
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {anyOptativaSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-500/10 dark:text-amber-200">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Es posible que aún no sepas la optativa del año que viene. Asegúrate de que el alumno ha solicitado esa
                        optativa como <strong>primera opción</strong>. Si finalmente no la cursara, se devolverá la licencia
                       y no se cobrará.  <strong>Márcala solo si estás seguro/a</strong> de que era la primera opción.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <span className="text-sm text-zinc-500">{selected.size} licencia(s)</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{euros(total)}</span>
              </div>

              <button
                type="button"
                onClick={() => { setError(null); setStep('review'); }}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Continuar
              </button>
            </Card>
          </motion.div>
        )}

        {step === 'review' && student && (
          <motion.div key="review" {...stepAnim}>
            <Card>
              <Back onClick={() => { setError(null); setStep('licenses'); }} />
              <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Revisa y confirma</h2>

              <div className="mt-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {student.maskedName} {student.apellidos} · {cursoLabel(effCurso || curso)}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedBooks.map((b) => (
                    <li key={b.cod} className="flex justify-between">
                      <span>{b.asignatura}</span>
                      <span>{euros(parseFloat(b.precio || '0'))}</span>
                    </li>
                  ))}
                  {selected.size === 0 && <li className="text-zinc-400">Sin licencias seleccionadas</li>}
                </ul>
                <div className="mt-3 flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 font-bold text-zinc-900 dark:text-zinc-100">
                  <span>Total</span>
                  <span>{euros(total)}</span>
                </div>
              </div>

              <label className="mt-5 mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Correo electrónico para la confirmación <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                Si no lo indicas, no recibirás un correo de confirmación pero el pedido quedará registrado igualmente.
                Las licencias LLEGARÁN A LOS ALUMNOS A FINALES DE SEPTIEMBRE - INICIO DE OCTUBRE
              </p>

              {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="button"
                disabled={loading}
                onClick={confirmar}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar pedido
              </button>
            </Card>
          </motion.div>
        )}

        {step === 'done' && student && result && (
          <motion.div key="done" {...stepAnim}>
            <Card>
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <motion.span
                    className="absolute inset-0 rounded-full bg-blue-500/20"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.span
                    className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: [0, 1.15, 1], rotate: 0 }}
                    transition={{ duration: 0.5, ease: 'backOut' }}
                  >
                    <motion.span
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Check className="h-7 w-7" />
                    </motion.span>
                  </motion.span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">¡Solicitud registrada!</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {result.emailStatus === 'sent'
                    ? 'Te hemos enviado un correo de confirmación.'
                    : 'Pedido guardado correctamente.'}
                </p>
              </div>

              <div className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {student.maskedName} {student.apellidos}
                  </p>
                  <p className="text-xs text-zinc-400">{cursoLabel(effCurso || curso)} · {result.itemCount} licencia(s)</p>
                </div>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {selectedBooks.map((b) => (
                    <li key={b.cod} className="flex justify-between px-4 py-2.5 text-sm">
                      <span className="text-zinc-600 dark:text-zinc-300">{b.asignatura}</span>
                      <span className="text-zinc-500">{euros(parseFloat(b.precio || '0'))}</span>
                    </li>
                  ))}
                  {selectedBooks.length === 0 && (
                    <li className="px-4 py-2.5 text-sm text-zinc-400">Sin licencias de pago</li>
                  )}
                </ul>
                <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                  <span>Total</span>
                  <span>{euros(result.total)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">¿Cuándo llegará?</p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {processedBeforeStart
                        ? 'Los pedidos de licencias se procesan con antelación al inicio de curso y llegarán por correo electrónico, directamente al iPad del alumno durante los primeros días de clase.'
                        : 'Los pedidos de licencias que llegan una vez se ha iniciado el curso se procesan en un máximo de 15-20 días y llegarán por correo electrónico, directamente al iPad del alumno en cuanto estén disponibles.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">¿Tengo que hacer algo más?</p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Nada más, hemos recibido tu pedido y lo hemos anotado. Las licencias llegarán directamente al iPad
                      del alumno en los plazos previstos. Se cobrará al final del primer trimestre.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={otroHijo}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Añadir otro hijo/a
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
