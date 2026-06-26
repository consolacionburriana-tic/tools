'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';

export default function GestionLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/licencias/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'No se pudo iniciar sesión');
        return;
      }
      router.push('/gestion');
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15">
            <Lock className="h-4 w-4" />
          </span>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Panel de licencias</h1>
        </div>

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Correo</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100"
        />

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
        </button>
      </form>
    </div>
  );
}
