import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { auth, signOut } from '@/auth';

export const metadata = { title: 'Sin acceso · Tools Consolación' };

// Autenticado pero sin rol (ni alta en auth_users ni profe activo), o sin el módulo pedido.
export default async function SinAccesoPage() {
  const session = await auth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No tienes acceso aquí</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tu cuenta {session?.user?.email ? <strong>{session.user.email}</strong> : null} no tiene permiso para esta
          sección. Si crees que deberías tenerlo, pídele el alta al equipo TIC.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/gestion"
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Ir al escritorio
          </Link>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/gestion/login' });
            }}
          >
            <button type="submit" className="w-full text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              Salir y entrar con otra cuenta
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
