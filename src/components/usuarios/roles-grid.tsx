'use client';

import { useMemo, useState } from 'react';
import { Ban, Loader2, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/permissions';

export interface FilaUsuario {
  email: string;
  nombre: string | null;
  /** Rol explícito en auth_users (null = sin fila) */
  rolExplicito: Role | null;
  /** Es profe activo de la BBDD central (rol automático 'profe' si no hay fila) */
  esProfe: boolean;
  /** Fila en auth_users con active=false → sin acceso pese a estar en el claustro */
  bloqueado: boolean;
}

// Asignación de roles en UN click: cada fila tiene los chips de rol; tocar un chip asigna.
// Tocar el chip ya activo lo quita (vuelve al automático: profe si es del claustro).
export function RolesGrid({ filas, miEmail }: { filas: FilaUsuario[]; miEmail: string }) {
  const [datos, setDatos] = useState(filas);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);
  const [nuevoEmail, setNuevoEmail] = useState('');

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return datos;
    return datos.filter((f) => f.email.includes(q) || (f.nombre ?? '').toLowerCase().includes(q));
  }, [datos, busqueda]);

  async function enviar(email: string, body: Record<string, unknown>, optimista: (f: FilaUsuario) => FilaUsuario) {
    setGuardando(email);
    const previo = datos;
    setDatos((d) => d.map((f) => (f.email === email ? optimista(f) : f)));
    try {
      const res = await fetch('/api/usuarios/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');
      haptic.tap();
      return true;
    } catch (e) {
      setDatos(previo);
      toast.error(e instanceof Error ? e.message : 'Error inesperado');
      haptic.warning();
      return false;
    } finally {
      setGuardando(null);
    }
  }

  function asignar(fila: FilaUsuario, role: Role | null) {
    return enviar(fila.email, { action: 'set', role, nombre: fila.nombre ?? undefined }, (f) => ({
      ...f,
      rolExplicito: role,
      bloqueado: false,
    }));
  }

  function bloquear(fila: FilaUsuario) {
    return enviar(fila.email, { action: 'block', nombre: fila.nombre ?? undefined }, (f) => ({
      ...f,
      rolExplicito: null,
      bloqueado: true,
    }));
  }

  async function eliminar(fila: FilaUsuario) {
    if (!confirm(`¿Eliminar definitivamente a ${fila.nombre ?? fila.email}?\n\nDejará de aparecer y sin acceso. Sus registros históricos se conservan.`)) return;
    const ok = await enviar(fila.email, { action: 'delete' }, (f) => f);
    if (ok) setDatos((d) => d.filter((f) => f.email !== fila.email));
  }

  function rolEfectivo(f: FilaUsuario): Role | null {
    if (f.bloqueado) return null;
    return f.rolExplicito ?? (f.esProfe ? 'profe' : null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-100"
        />
      </div>

      <ul className="space-y-1.5">
        {visibles.map((f) => {
          const efectivo = rolEfectivo(f);
          return (
            <li
              key={f.email}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {f.nombre ?? f.email}
                    {f.email === miEmail && <span className="ml-1 text-xs text-zinc-400">(tú)</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-400">{f.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {guardando === f.email && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                  {f.bloqueado ? (
                    <>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        Sin acceso
                      </span>
                      <button
                        type="button"
                        disabled={guardando === f.email}
                        onClick={() => void asignar(f, f.esProfe ? null : 'profe')}
                        title="Reactivar acceso"
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <RotateCcw className="h-3 w-3" /> Reactivar
                      </button>
                      <button
                        type="button"
                        disabled={guardando === f.email}
                        onClick={() => void eliminar(f)}
                        title="Eliminar definitivamente"
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3 w-3" /> Eliminar
                      </button>
                    </>
                  ) : (
                    <>
                      {ROLES.map((r) => {
                        const activo = efectivo === r;
                        const esAutomatico = activo && f.rolExplicito === null;
                        return (
                          <button
                            key={r}
                            type="button"
                            disabled={guardando === f.email}
                            onClick={() => void asignar(f, f.rolExplicito === r ? null : r)}
                            title={esAutomatico ? 'Automático (profe del claustro)' : undefined}
                            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                              activo
                                ? esAutomatico
                                  ? 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-700'
                                  : 'bg-blue-600 text-white'
                                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {ROLE_LABELS[r]}
                          </button>
                        );
                      })}
                      {f.email !== miEmail && (
                        <button
                          type="button"
                          disabled={guardando === f.email}
                          onClick={() => void bloquear(f)}
                          title="Quitar el acceso a esta persona"
                          className="ml-0.5 inline-flex items-center rounded-full bg-zinc-100 p-1.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const email = nuevoEmail.trim().toLowerCase();
          if (!email.includes('@')) return;
          if (datos.some((f) => f.email === email)) {
            toast.info('Ese correo ya está en la lista');
            return;
          }
          setDatos((d) => [{ email, nombre: null, rolExplicito: null, esProfe: false, bloqueado: false }, ...d]);
          setNuevoEmail('');
        }}
      >
        <input
          value={nuevoEmail}
          onChange={(e) => setNuevoEmail(e.target.value)}
          placeholder="añadir-correo@consolacionburriana.com"
          type="email"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" /> Añadir
        </button>
      </form>
      <p className="text-xs text-zinc-400">
        Un click asigna el rol; repetir el click lo quita (los profes del claustro vuelven a su rol automático de
        Profe, en azul claro). Añade un correo solo si no sale ya en la lista.
      </p>
    </div>
  );
}
