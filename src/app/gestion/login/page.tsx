import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export const metadata = { title: 'Entrar · Tools Consolación' };

// Login único con Google (solo cuentas @consolacionburriana.com). Sustituye al
// password fijo del panel de licencias.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const session = await auth();
  const { volver } = await searchParams;
  const destino = volver && volver.startsWith('/') ? volver : '/gestion';
  if (session?.user) redirect(destino);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="anim-stagger w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logobur.png" alt="Consolación Burriana" width={180} height={90} className="h-auto w-[170px]" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tools Consolación</h1>
          <p className="text-sm text-zinc-500">Entra con tu cuenta del colegio</p>
        </div>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: destino });
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 4.3-5.35 4.3a5.8 5.8 0 1 1 0-11.6c1.5 0 2.85.55 3.9 1.45l2.15-2.15A8.9 8.9 0 0 0 12 3.1a8.9 8.9 0 1 0 0 17.8c5.15 0 8.85-3.6 8.85-8.7 0-.4-.05-.75-.1-1.1Z"
              />
            </svg>
            Entrar con Google
          </button>
          <p className="mt-3 text-center text-xs text-zinc-400">Solo cuentas @consolacionburriana.com · la sesión dura todo el curso</p>
        </form>
      </div>
    </div>
  );
}
