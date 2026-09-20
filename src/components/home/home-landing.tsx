'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { ArrowRight, Bus, Lock, SearchCheck, Smartphone } from 'lucide-react';
import type { AccesoPortada, ModuloPortada } from '@/lib/portada';

/**
 * El acento de cada módulo: azul y móvil para Licencias (el mismo azul de `/licencias`),
 * ámbar y autobús para Salidas. Color de fondo suave y el color fuerte solo en el icono y
 * en el texto — un botón a todo color por trámite gritaba demasiado para una portada que
 * la mayoría de las veces tiene dos.
 *
 * Un módulo nuevo en la portada añade aquí su tema, con un color que no tenga ya otro: que
 * dos trámites se parezcan es justo el problema que esta pantalla viene a resolver.
 */
const TEMAS: Record<ModuloPortada, { Icono: typeof Bus; tarjeta: string; icono: string; texto: string }> = {
  licencias: {
    Icono: Smartphone,
    tarjeta:
      'border-blue-200 bg-blue-50/70 hover:bg-blue-50 active:bg-blue-100/80 dark:border-blue-900/70 dark:bg-blue-500/10 dark:hover:bg-blue-500/15',
    icono: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    texto: 'text-blue-900 dark:text-blue-100',
  },
  salidas: {
    Icono: Bus,
    tarjeta:
      'border-amber-200 bg-amber-50/70 hover:bg-amber-50 active:bg-amber-100/80 dark:border-amber-900/70 dark:bg-amber-500/10 dark:hover:bg-amber-500/15',
    icono: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    texto: 'text-amber-900 dark:text-amber-100',
  },
};

function TarjetaAcceso({ acceso }: { acceso: AccesoPortada }) {
  const tema = TEMAS[acceso.modulo];
  const { Icono } = tema;
  return (
    <div className="space-y-2">
      <Link
        href={acceso.href}
        className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 transition-colors ${tema.tarjeta}`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tema.icono}`}>
          <Icono className="h-5.5 w-5.5" />
        </span>
        <span className={`min-w-0 flex-1 font-semibold leading-snug ${tema.texto}`}>{acceso.titulo}</span>
        <ArrowRight
          className={`h-5 w-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 ${tema.texto}`}
        />
      </Link>

      {acceso.secundario && (
        <Link
          href={acceso.secundario.href}
          className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="flex items-center gap-2.5">
            <SearchCheck className="h-4.5 w-4.5 text-zinc-400" />
            {acceso.secundario.titulo}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
        </Link>
      )}
    </div>
  );
}

/**
 * Portada pública: un botón por trámite abierto (ver `@/lib/portada`) y poco más. Sin nada
 * abierto no se queda en blanco, pero tampoco se explica: una línea y ya.
 *
 * El acceso a gestión va siempre, y siempre discreto —incluso cuando es lo único que hay—:
 * el claustro entra directo a `/gestion` desde la PWA y no necesita que se lo ofrezcan.
 */
export function HomeLanding({ accesos }: { accesos: AccesoPortada[] }) {
  const vacia = accesos.length === 0;
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
            Colegio Consolación Burriana
          </h1>
          {vacia && (
            <p className="mt-2 text-sm text-zinc-500">
              Por aquí no hay nada abierto ahora mismo; cuando toque algo, el colegio te avisa por correo.
            </p>
          )}
        </motion.div>

        {!vacia && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: 'easeOut' }}
            className="mt-8 w-full space-y-3"
          >
            {accesos.map((acceso) => (
              <TarjetaAcceso key={acceso.modulo} acceso={acceso} />
            ))}
          </motion.div>
        )}

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
            Acceso del profesorado
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
