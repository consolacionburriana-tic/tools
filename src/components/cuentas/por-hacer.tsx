'use client';

// «Por hacer»: lo que pide el cruce, como una lista de tareas. Cada tarjeta lleva a la lista
// de cuentas ya filtrada y con la selección hecha, para revisar y hacerlo de una vez.
import {
  ArchiveRestore,
  CheckCircle2,
  ChevronRight,
  FolderInput,
  FolderTree,
  Link2,
  MailPlus,
  UserX,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONFIGURACION } from '@/lib/configuracion';
import type { FilaCuenta } from '@/lib/cuentas';
import type { EstadoCuentas } from '@/lib/cuentas-server';
import { fecha, TARJETA } from './comun';
import type { Filtro, Quien } from './lista';

export function PorHacer({
  estado,
  puedeGestionar,
  ir,
  irA,
}: {
  estado: EstadoCuentas;
  puedeGestionar: boolean;
  /** A la lista de cuentas con este filtro, dejando seleccionadas las que cumplan `elegir`. */
  ir: (filtro: Filtro, opciones?: { quien?: Quien; elegir?: (f: FilaCuenta) => boolean }) => void;
  irA: (pestana: 'unidades' | 'grupos') => void;
}) {
  const { resumen, filas } = estado.cruce;
  const tresAnos = `${CONFIGURACION.niveles.EI.min}INF`;
  const deTres = resumen.crear.porCurso.find((c) => c.curso === tresAnos)?.n ?? 0;
  const crear = resumen.crear.alumnos + resumen.crear.profes;
  const sueltas = resumen.sueltas.alumnado + resumen.sueltas.profesorado;
  const gestionados = estado.grupos.filter((g) => g.gestionado);

  const alumnos = filas.filter((f) => f.tipo === 'alumno' && f.activo);
  const profes = filas.filter((f) => f.tipo === 'profe' && f.activo);
  const conCorreo = (lista: FilaCuenta[]) => lista.filter((f) => f.cuenta && !f.cuenta.suspendida).length;
  const enGoogle = filas.filter((f) => f.cuenta);

  const tarjetas: Tarea[] = [
    {
      clave: 'crear',
      icono: MailPlus,
      titulo: 'Crear correos',
      n: crear,
      texto:
        crear === 0
          ? 'Todo el alumnado y el profesorado de Educamos tiene su cuenta.'
          : [
              resumen.crear.alumnos > 0 && `${resumen.crear.alumnos} alumno${resumen.crear.alumnos === 1 ? '' : 's'} sin correo`,
              resumen.crear.profes > 0 && `${resumen.crear.profes} profe${resumen.crear.profes === 1 ? '' : 's'}`,
            ]
              .filter(Boolean)
              .join(' y ') + '.',
      chips: resumen.crear.porCurso.map((c) => `${c.curso} · ${c.n}`),
      nota:
        resumen.parecidas > 0
          ? `${resumen.parecidas} tienen ya una cuenta que se les parece: mira si es suya antes de crear otra.`
          : undefined,
      acciones: [
        { texto: 'Revisar y crear', onClick: () => ir('sin-correo', { elegir: (f) => f.estado === 'sin-correo' && f.parecidas.length === 0 }) },
        ...(deTres > 0
          ? [
              {
                texto: `Solo los de 3 años (${deTres})`,
                onClick: () =>
                  ir('sin-correo', {
                    quien: 'alumno' as const,
                    elegir: (f: FilaCuenta) => f.estado === 'sin-correo' && f.claveClase?.split('|')[0] === tresAnos && f.parecidas.length === 0,
                  }),
              },
            ]
          : []),
      ],
    },
    {
      clave: 'parecidas',
      icono: Link2,
      titulo: '¿Es su cuenta?',
      n: resumen.parecidas,
      texto:
        resumen.parecidas === 0
          ? 'Nadie sin correo se parece a una cuenta suelta.'
          : 'Personas de Educamos sin correo apuntado y una cuenta de Google que se les parece. Si es suya, se vincula y listo.',
      acciones: [{ texto: 'Revisar', onClick: () => ir('parecidas') }],
    },
    resumen.clasesSinUo > 0
      ? {
          clave: 'clase',
          icono: FolderTree,
          titulo: 'Cada alumno en su clase',
          n: resumen.clasesSinUo,
          unidad: 'clases',
          texto: `Antes de mover a nadie, confirma a qué unidad organizativa va cada clase. Hay ${resumen.clasesSinUo} sin confirmar.`,
          acciones: [{ texto: 'Confirmar unidades', onClick: () => irA('unidades') }],
        }
      : {
          clave: 'clase',
          icono: FolderInput,
          titulo: 'Cada alumno en su clase',
          n: resumen.fuera,
          texto:
            resumen.fuera === 0
              ? 'Todas las cuentas del alumnado están en la unidad de su clase.'
              : `${resumen.fuera} cuenta${resumen.fuera === 1 ? '' : 's'} en la unidad de otra clase. Después de pasar de curso en Educamos salen aquí todas las que cambian.`,
          acciones: [{ texto: 'Revisar y mover', onClick: () => ir('fuera', { elegir: (f) => f.estado === 'fuera' }) }],
        },
    {
      clave: 'bajas',
      icono: UserX,
      titulo: 'Bajas con la cuenta abierta',
      n: resumen.suspender,
      texto:
        resumen.suspender + resumen.enEspera === 0
          ? 'Ninguna baja de Educamos conserva la cuenta abierta.'
          : `${resumen.suspender} ya toca suspender${resumen.enEspera ? ` · ${resumen.enEspera} esperan${resumen.proximaBaja ? ` (la primera, el ${fecha(resumen.proximaBaja)})` : ''}` : ''}.`,
      nota: `Los de 4º de ESO se suspenden ${estado.ajustes.graciaGraduados} meses después de irse; las demás bajas, a los ${estado.ajustes.graciaBajas}.`,
      acciones: [{ texto: 'Revisar bajas', onClick: () => ir('bajas', { elegir: (f) => f.estado === 'baja' }) }],
    },
    {
      clave: 'sueltas',
      icono: UsersRound,
      titulo: 'Cuentas que no son de nadie',
      n: sueltas,
      texto:
        sueltas === 0
          ? 'Todas las cuentas de alumnado y profesorado casan con alguien de Educamos.'
          : `${resumen.sueltas.alumnado} en las unidades del alumnado y ${resumen.sueltas.profesorado} en las del profesorado que no salen en Educamos.`,
      acciones: [{ texto: 'Revisar', onClick: () => ir('sueltas') }],
    },
    {
      clave: 'reactivar',
      icono: ArchiveRestore,
      titulo: 'Suspendidas de gente que sigue',
      n: resumen.reactivar,
      texto:
        resumen.reactivar === 0
          ? 'Nadie de Educamos tiene la cuenta suspendida.'
          : 'Están en Educamos, pero su cuenta está suspendida: suele ser alguien que ha vuelto.',
      acciones: [{ texto: 'Revisar y reactivar', onClick: () => ir('suspendidas', { elegir: (f) => f.estado === 'suspendida' }) }],
    },
    {
      clave: 'archivar',
      icono: FolderInput,
      titulo: 'Suspendidas sin archivar',
      n: resumen.archivar,
      texto:
        resumen.archivar === 0
          ? 'Las cuentas suspendidas están en su unidad de archivo.'
          : 'Siguen en la unidad de una clase o de una etapa. Se llevan a su unidad de archivo.',
      acciones: [{ texto: 'Archivar', onClick: () => ir('archivar', { elegir: (f) => f.estado === 'archivar' }) }],
    },
    {
      clave: 'otras',
      icono: Users,
      titulo: 'Otras cuentas',
      n: resumen.sueltas.otras,
      texto:
        resumen.sueltas.otras === 0
          ? 'Las cuentas fuera de alumnado y profesorado están todas revisadas.'
          : `${resumen.sueltas.otras} fuera de las unidades de alumnado y profesorado (raíz, PAS…). Marca las que son del colegio y suspende las que sobran.`,
      acciones: [{ texto: 'Revisar', onClick: () => ir('otras') }],
    },
  ];

  const pendientes = tarjetas.filter((t) => t.n > 0);
  const hechas = tarjetas.filter((t) => t.n === 0);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Cifra titulo="Alumnado con correo" valor={`${conCorreo(alumnos)} de ${alumnos.length}`} />
        <Cifra titulo="Profesorado con correo" valor={`${conCorreo(profes)} de ${profes.length}`} />
        <Cifra
          titulo="Cuentas en Google"
          valor={String(enGoogle.length)}
          sub={`${enGoogle.filter((f) => f.cuenta!.suspendida).length} suspendidas`}
        />
      </section>

      {pendientes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5" /> Nada pendiente: cuentas, unidades y bajas al día.
        </p>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {pendientes.map((t) => (
            <Tarjeta key={t.clave} t={t} puedeGestionar={puedeGestionar} />
          ))}
        </section>
      )}

      <section className={cn(TARJETA, 'p-4')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Grupos</p>
            <p className="text-sm text-zinc-500">
              {gestionados.length === 0
                ? 'Ningún grupo se mantiene desde aquí todavía.'
                : `${gestionados.length} grupo${gestionados.length === 1 ? '' : 's'} con reglas: revisa los cambios cuando llegue alguien nuevo o se vaya alguien.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => irA('grupos')}
            className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Ver grupos <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {hechas.length > 0 && (
        <ul className="space-y-1.5 text-sm text-zinc-500">
          {hechas.map((t) => (
            <li key={t.clave} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <b className="font-medium text-zinc-700 dark:text-zinc-300">{t.titulo}.</b> {t.texto}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Tarea {
  clave: string;
  icono: LucideIcon;
  titulo: string;
  n: number;
  unidad?: string;
  texto: string;
  chips?: string[];
  nota?: string;
  acciones: { texto: string; onClick: () => void }[];
}

function Tarjeta({ t, puedeGestionar }: { t: Tarea; puedeGestionar: boolean }) {
  const Icono = t.icono;
  return (
    <article className={cn(TARJETA, 'flex flex-col gap-3 p-4')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <Icono className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t.titulo}</span>
            <span className="font-mono text-2xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {t.n}
              {t.unidad && <span className="ml-1 font-sans text-xs font-normal text-zinc-500">{t.unidad}</span>}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{t.texto}</p>
        </div>
      </div>
      {t.chips && t.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {t.chips.map((c) => (
            <span key={c} className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {c}
            </span>
          ))}
        </div>
      )}
      {t.nota && <p className="text-xs text-zinc-500">{t.nota}</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        {(puedeGestionar ? t.acciones : t.acciones.slice(0, 1)).map((a, i) => (
          <button
            key={a.texto}
            type="button"
            onClick={a.onClick}
            className={cn(
              'inline-flex h-10 cursor-pointer items-center gap-1 rounded-xl px-3 text-sm font-medium',
              i === 0 && puedeGestionar
                ? 'bg-blue-600 font-semibold text-white hover:bg-blue-700'
                : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
            )}
          >
            {puedeGestionar ? a.texto : 'Ver'} <ChevronRight className="h-4 w-4" />
          </button>
        ))}
      </div>
    </article>
  );
}

function Cifra({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className={cn(TARJETA, 'p-4')}>
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">{valor}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
