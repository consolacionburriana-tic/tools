import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { auth, signOut } from '@/auth';
import { Button, buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Sin acceso · Tools Consolación' };

// Autenticado pero sin rol (ni alta en auth_users ni profe activo), o sin el módulo pedido.
export default async function SinAccesoPage() {
  const session = await auth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No tienes acceso aquí</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Tu cuenta {session?.user?.email ? <strong>{session.user.email}</strong> : null} no tiene permiso para esta
          sección. Si crees que deberías tenerlo, pídele el alta al equipo TIC.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/gestion" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            Ir al escritorio
          </Link>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/gestion/login' });
            }}
          >
            <Button type="submit" variant="ghost" className="w-full">
              Salir y entrar con otra cuenta
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
