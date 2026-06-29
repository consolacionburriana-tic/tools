'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { CURSOS_FORM } from '@/lib/licencias';

interface Book {
  cod: string;
  asignatura: string;
  lengua: string | null;
  bancoLibros: boolean;
  precio: string | null;
}
interface Pack {
  name: string;
  selectionMode: string;
  bookCods: string[];
}

const MODES = [
  { value: 'todos', label: 'Todos (recomendado)' },
  { value: 'one', label: 'Elige uno' },
  { value: 'one_or_none', label: 'Elige uno o ninguno' },
  { value: 'free', label: 'Libre' },
];

export function PacksEditor() {
  const [curso, setCurso] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!curso) return;
    setLoading(true);
    setSaved(false);
    fetch(`/api/licencias/admin/packs?curso=${encodeURIComponent(curso)}`)
      .then((r) => r.json())
      .then((d) => {
        setBooks(d.books ?? []);
        setPacks((d.packs ?? []).map((p: Pack) => ({ name: p.name, selectionMode: p.selectionMode, bookCods: p.bookCods ?? [] })));
      })
      .finally(() => setLoading(false));
  }, [curso]);

  function update(i: number, patch: Partial<Pack>) {
    setPacks((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    setSaved(false);
  }
  function toggleBook(i: number, cod: string) {
    setPacks((prev) =>
      prev.map((p, j) => {
        if (j !== i) return p;
        const has = p.bookCods.includes(cod);
        return { ...p, bookCods: has ? p.bookCods.filter((c) => c !== cod) : [...p.bookCods, cod] };
      }),
    );
    setSaved(false);
  }
  function addPack() {
    setPacks((prev) => [...prev, { name: `Pack ${prev.length + 1}`, selectionMode: 'todos', bookCods: [] }]);
    setSaved(false);
  }
  function removePack(i: number) {
    setPacks((prev) => prev.filter((_, j) => j !== i));
    setSaved(false);
  }
  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/licencias/admin/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso, packs }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Curso</p>
      <div className="flex flex-wrap gap-2">
        {CURSOS_FORM.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCurso(c.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
              curso === c.value
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}

      {curso && !loading && (
        <div className="mt-6 space-y-4">
          {packs.length === 0 && (
            <p className="text-sm text-zinc-500">
              Sin packs para {curso}. Las familias verán la lista de licencias sin agrupar. Crea packs para guiarlas.
            </p>
          )}

          {packs.map((p, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
                />
                <select
                  value={p.selectionMode}
                  onChange={(e) => update(i, { selectionMode: e.target.value })}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200"
                >
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removePack(i)}
                  aria-label="Eliminar pack"
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {books.map((b) => {
                  const on = p.bookCods.includes(b.cod);
                  return (
                    <label
                      key={b.cod}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        on ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggleBook(i, b.cod)} className="accent-blue-600" />
                      <span className="flex-1 text-zinc-700 dark:text-zinc-200">{b.asignatura}</span>
                      <span className="text-xs text-zinc-400">{b.cod}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addPack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Añadir pack
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            {saved && <span className="text-sm text-emerald-600">Guardado ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}
