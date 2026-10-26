'use client';

import { useEffect, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PERIODOS, FILTROS_ABC_KEY, PERIODO_POR_DEFECTO, type Periodo } from '@/lib/abc';
import { Filtro, Filtros } from '@/components/ui/filtro';

export interface AlumnoFiltro {
  id: string;
  siglas: string;
  clase: string;
}

// Los filtros del panel viven en la URL (`?periodo=30&alumnos=id1,id2`): el panel es de servidor,
// así que cambiar un filtro es navegar, y el enlace se puede compartir o guardar. Además se dejan
// anotados en el navegador con la misma clave que usa la lista de Registros, para que «Ver todos»
// abra la lista con lo mismo que se está mirando aquí.
export function PanelFiltros({
  alumnos,
  periodo,
  alumnoIds,
}: {
  alumnos: AlumnoFiltro[];
  periodo: Periodo;
  alumnoIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    try {
      localStorage.setItem(FILTROS_ABC_KEY, JSON.stringify({ timePreset: periodo, selectedStudentIds: alumnoIds }));
    } catch {
      // sin localStorage: la lista de Registros se abre con sus propios filtros, sin más
    }
  }, [periodo, alumnoIds]);

  const ir = (nuevoPeriodo: Periodo, nuevosAlumnos: string[]) => {
    const params = new URLSearchParams();
    if (nuevoPeriodo !== PERIODO_POR_DEFECTO) params.set('periodo', nuevoPeriodo);
    if (nuevosAlumnos.length > 0) params.set('alumnos', nuevosAlumnos.join(','));
    const query = params.toString();
    empezar(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const alternar = (id: string) =>
    ir(periodo, alumnoIds.includes(id) ? alumnoIds.filter((x) => x !== id) : [...alumnoIds, id]);

  return (
    <div className="space-y-3" aria-busy={pendiente}>
      <Filtros etiqueta="Periodo">
        {PERIODOS.map((p) => (
          <Filtro key={p.value} activo={periodo === p.value} onClick={() => ir(p.value, alumnoIds)}>
            {p.label}
          </Filtro>
        ))}
      </Filtros>

      {alumnos.length > 0 && (
        <Filtros etiqueta="Alumno">
          <Filtro activo={alumnoIds.length === 0} onClick={() => ir(periodo, [])}>
            Todos
          </Filtro>
          {alumnos.map((a) => (
            <Filtro key={a.id} activo={alumnoIds.includes(a.id)} onClick={() => alternar(a.id)}>
              {a.siglas}
              {a.clase && <span className="text-xs font-normal opacity-70">{a.clase}</span>}
            </Filtro>
          ))}
        </Filtros>
      )}
    </div>
  );
}
