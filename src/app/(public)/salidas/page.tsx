export const dynamic = 'force-dynamic';

import { SalidasFamilia } from '@/components/salidas/salidas-familia';

export const metadata = {
  title: 'Salidas y pagos · Consolación',
  description: 'Justificantes de pago de salidas escolares',
};

export default function SalidasPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logobur.png"
              alt="Colegio Consolación · Burriana"
              width={250}
              height={125}
              className="h-auto w-[210px] sm:w-[250px]"
            />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Salidas y pagos</h1>
          <p className="mt-1 text-sm text-zinc-500">Colegio Consolación Burriana</p>
        </div>
        <SalidasFamilia />
      </main>
    </div>
  );
}
