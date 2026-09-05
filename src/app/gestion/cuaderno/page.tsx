export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CuadernoPanel } from '@/components/cuaderno/cuaderno-panel';
import { cuentaDeServicio, driveConfigurado } from '@/lib/cuaderno/drive';
import { analizarEtiqueta } from '@/lib/cuaderno/campos';
import { cursoEscolarLargo } from '@/lib/cuaderno/nombres';
import {
  academicYearActual,
  alumnosSinHoja,
  getAjustes,
  getMapeo,
  getPlantillas,
  getResumenClases,
  listarTiradas,
  resumenHojas,
} from '@/lib/cuaderno-server';

export const metadata = { title: 'Cuaderno de tutor · Gestión' };

export default async function CuadernoPage() {
  const academicYear = academicYearActual();
  const [ajustes, plantillas, clases, tiradas, mapeo, hojas, faltas] = await Promise.all([
    getAjustes(),
    getPlantillas(),
    getResumenClases(),
    listarTiradas(10),
    getMapeo(),
    resumenHojas(academicYear),
    alumnosSinHoja(academicYear),
  ]);

  // Las etiquetas se analizan aquí (en el servidor) para que el panel ya sepa de entrada
  // qué plantillas están listas y cuáles tienen etiquetas por mapear.
  const plantillasUI = plantillas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    googleDocId: p.googleDocId,
    repeticion: p.repeticion,
    etapa: p.etapa,
    orden: p.orden,
    generaPdf: p.generaPdf,
    saltoDePagina: p.saltoDePagina,
    activa: p.activa,
    tieneFilas: p.tieneFilas,
    analizadaAt: p.analizadaAt ? p.analizadaAt.toISOString() : null,
    etiquetas: (p.etiquetas ?? []).map((e) => analizarEtiqueta(e, mapeo)),
    hojasHechas: hojas[p.id] ?? 0,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <Link href="/gestion" className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
              Cuaderno de tutor
            </Link>
            <p className="text-xs text-zinc-500">
              Genera la documentación de tutoría de {cursoEscolarLargo(academicYear)} y déjala en el Drive de cada tutor
            </p>
          </div>
          <Link
            href="/gestion"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
          >
            <ChevronLeft className="h-4 w-4" /> Escritorio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <CuadernoPanel
          academicYear={academicYear}
          cursoEscolar={cursoEscolarLargo(academicYear)}
          ajustes={{
            carpetaBaseId: ajustes.carpetaBaseId,
            carpetaBaseUrl: ajustes.carpetaBaseUrl,
            nombreCentro: ajustes.nombreCentro,
            permisoTutores: ajustes.permisoTutores,
          }}
          drive={{ configurado: driveConfigurado(), cuenta: cuentaDeServicio() }}
          plantillas={plantillasUI}
          clases={clases}
          tiradas={tiradas.map((t) => ({
            id: t.tirada.id,
            numero: t.tirada.numero,
            estado: t.tirada.estado,
            academicYear: t.tirada.academicYear,
            carpetaCursoUrl: t.tirada.carpetaCursoUrl,
            lanzadaPor: t.tirada.lanzadaPor,
            createdAt: t.tirada.createdAt.toISOString(),
            error: t.tirada.error,
            total: t.total,
            hechos: t.hechos,
            errores: t.errores,
            pendientes: t.pendientes + t.haciendo,
          }))}
          faltas={faltas.map((f) => ({ id: f.id, nombre: f.nombre, clase: f.clase, plantillas: f.plantillas }))}
        />
      </main>
    </div>
  );
}
