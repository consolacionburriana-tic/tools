export const dynamic = 'force-dynamic';

import { CuadernoPanel } from '@/components/cuaderno/cuaderno-panel';
import { cuentaDeServicio, driveConfigurado } from '@/lib/cuaderno/drive';
import { analizarEtiqueta, etapasDePlantilla } from '@/lib/cuaderno/campos';
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
    etapas: etapasDePlantilla(p),
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
    <>
      <h1 className="sr-only">Cuaderno de tutor</h1>
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
            latidoAt: t.tirada.latidoAt?.toISOString() ?? null,
            pases: t.tirada.pases,
            total: t.total,
            hechos: t.hechos,
            errores: t.errores,
            pendientes: t.pendientes + t.haciendo,
          }))}
          faltas={faltas.map((f) => ({ id: f.id, nombre: f.nombre, clase: f.clase, plantillas: f.plantillas }))}
        />
    </>
  );
}
