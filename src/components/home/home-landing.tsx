'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowRight, Lock, SearchCheck } from 'lucide-react';

export function HomeLanding({ cursoLabel }: { cursoLabel: string | null }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Fondo animado sutil */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/10"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10"
        animate={{ x: [0, -40, 0], y: [0, -20, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center text-center"
        >
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/70">
            <Image
              src="/logobur.png"
              alt="Colegio Consolación · Burriana"
              width={260}
              height={130}
              priority
              className="h-auto w-[220px] sm:w-[260px]"
            />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Licencias digitales
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{cursoLabel ? `${cursoLabel} · ` : ''}Colegio Consolación Burriana</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
          className="mt-8 w-full space-y-3"
        >
          <Link
            href="/licencias"
            className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-blue-600 px-5 py-4 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <span>Solicitar licencias digitales</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            href="/licencias"
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="flex items-center gap-2">
              <SearchCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ¿He hecho mi pedido de licencias?
            </span>
            <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10"
        >
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <Lock className="h-3.5 w-3.5" />
            Administrador
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
