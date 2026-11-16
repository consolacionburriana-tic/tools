'use client';

// Todos los arreglos del cole en una lista: lo urgente arriba, por aula. Para sacarla en papel y
// salir a hacer la ronda (cada línea con su casilla para tachar a boli), y para marcar desde el
// iPad lo que ya está hecho. `?apuntar=1` (el botón de la cabecera) abre la hoja de apuntar.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Wrench } from 'lucide-react';
import { AREAS, AREA_LABEL, PRIORIDADES, PRIORIDAD_LABEL, etiquetaPiso, type Area, type Prioridad } from '@/lib/inventario';
import type { ArregloInv, Inventario } from '@/lib/inventario-server';
import { buttonVariants } from '@/components/ui/button';
import { Filtro, Filtros } from '@/components/ui/filtro';
import { Segmentado } from '@/components/ui/segmentado';
import { Rotulo } from '@/components/ui/rotulo';
import { Tarjeta } from '@/components/ui/tarjeta';
import { Vacio } from '@/components/ui/vacio';
import { etiquetaAula, useIndice } from './comun';
import { FilaArreglo, HojaArreglo, ordenarArreglos } from './arreglos';

type Vista = 'pendientes' | 'hechos';
type Agrupar = 'prioridad' | 'piso';

export function ListaGeneralArreglos({ inv, apuntar }: { inv: Inventario; apuntar: boolean }) {
  const filas = useIndice(inv);
  const [vista, setVista] = useState<Vista>('pendientes');
  const [agrupar, setAgrupar] = useState<Agrupar>('prioridad');
  const [area, setArea] = useState<Area | 'todas'>('todas');
  const [editando, setEditando] = useState<ArregloInv | 'nuevo' | null>(apuntar ? 'nuevo' : null);

  // Quita el ?apuntar=1 de la URL al abrir, para que volver atrás no lo abra otra vez.
  useEffect(() => {
    if (!apuntar) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('apuntar');
    window.history.replaceState(null, '', url);
  }, [apuntar]);

  const aulas = new Map(filas.map((f) => [f.aula.id, f]));
  const kits = new Map(inv.kits.map((k) => [k.id, k]));
  const donde = (a: ArregloInv): string => {
    if (a.kitId) return `Kit ${kits.get(a.kitId)?.codigo ?? '?'}`;
    const f = a.aulaId ? aulas.get(a.aulaId) : null;
    return f ? etiquetaAula(f) : 'General';
  };
  const ordenAula = (a: ArregloInv) => {
    const aulaId = a.aulaId ?? (a.kitId ? kits.get(a.kitId)?.aulaId : null);
    return aulaId ? (aulas.get(aulaId)?.aula.orden ?? 999) : 999;
  };

  const base = inv.arreglos.filter((a) => (vista === 'hechos' ? a.hechoAt : !a.hechoAt));
  const visibles = base.filter((a) => area === 'todas' || a.area === area);
  const grupos: { clave: string; titulo: string; lista: ArregloInv[] }[] = [];
  if (agrupar === 'prioridad' && vista === 'pendientes') {
    for (const p of PRIORIDADES) {
      const lista = visibles.filter((a) => a.prioridad === p).sort((x, y) => ordenAula(x) - ordenAula(y));
      if (lista.length) grupos.push({ clave: p, titulo: PRIORIDAD_LABEL[p as Prioridad], lista });
    }
  } else if (agrupar === 'piso') {
    const pisoDe = (a: ArregloInv) => {
      const aulaId = a.aulaId ?? (a.kitId ? kits.get(a.kitId)?.aulaId : null);
      return (aulaId ? aulas.get(aulaId)?.aula.piso : null) ?? '';
    };
    for (const p of ['PB', 'P1', 'P2', 'P3', '']) {
      const lista = ordenarArreglos(visibles.filter((a) => pisoDe(a) === p)).sort((x, y) => ordenAula(x) - ordenAula(y));
      if (lista.length) grupos.push({ clave: p || 'otros', titulo: p ? etiquetaPiso(p) : 'Sin aula', lista });
    }
  } else {
    grupos.push({ clave: 'todo', titulo: '', lista: [...visibles].sort((x, y) => (y.hechoAt ?? '').localeCompare(x.hechoAt ?? '')) });
  }

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Arreglos</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado
          etiqueta="Ver"
          opciones={[
            { valor: 'pendientes', etiqueta: 'Pendientes', cuenta: inv.arreglos.filter((a) => !a.hechoAt).length },
            { valor: 'hechos', etiqueta: 'Hechos', cuenta: inv.arreglos.filter((a) => a.hechoAt).length },
          ]}
          valor={vista}
          onChange={setVista}
        />
        {vista === 'pendientes' && (
          <Segmentado
            etiqueta="Agrupar por"
            opciones={[
              { valor: 'prioridad', etiqueta: 'Por prioridad' },
              { valor: 'piso', etiqueta: 'Por piso' },
            ]}
            valor={agrupar}
            onChange={setAgrupar}
          />
        )}
        <Link
          href={`/gestion/inventario/imprimir?informe=arreglos&agrupar=${agrupar}${area !== 'todas' ? `&area=${area}` : ''}`}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'ml-auto' })}
        >
          <Printer aria-hidden /> Imprimir la ronda
        </Link>
      </div>
      <Filtros etiqueta="De qué">
        <Filtro activo={area === 'todas'} onClick={() => setArea('todas')} cuenta={base.length}>
          Todo
        </Filtro>
        {AREAS.map((a) => {
          const n = base.filter((x) => x.area === a).length;
          if (!n) return null;
          return (
            <Filtro key={a} activo={area === a} onClick={() => setArea(area === a ? 'todas' : a)} cuenta={n}>
              {AREA_LABEL[a]}
            </Filtro>
          );
        })}
      </Filtros>

      {visibles.length === 0 ? (
        <Vacio icono={<Wrench />} titulo={vista === 'pendientes' ? 'Nada pendiente' : 'Todavía no se ha marcado nada como hecho'}>
          {vista === 'pendientes' ? 'Todo arreglado. Lo que vaya saliendo, con «Apuntar arreglo».' : null}
        </Vacio>
      ) : (
        grupos.map((g) => (
          <section key={g.clave} className="space-y-2">
            {g.titulo && <Rotulo>{`${g.titulo} · ${g.lista.length}`}</Rotulo>}
            <Tarjeta className="px-2">
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {g.lista.map((a) => (
                  <FilaArreglo key={a.id} a={a} donde={donde(a)} onEditar={setEditando} />
                ))}
              </ul>
            </Tarjeta>
          </section>
        ))
      )}

      {editando && (
        <HojaArreglo
          arreglo={editando === 'nuevo' ? null : editando}
          areaPorDefecto={area === 'todas' ? 'av' : area}
          filas={filas}
          fijo={editando !== 'nuevo' && Boolean(editando.kitId)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
