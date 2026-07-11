export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getAlumnadoClase, getLibrosBanco, getPasarLista } from '@/lib/bancolibros-server';
import { academicYearActual } from '@/lib/constants';
import { PrintButton } from '@/components/bancolibros/print-button';

export const metadata = { title: 'Ficha de valoración · Banco de libros' };

const ESTADO_LABEL: Record<string, string> = {
  nuevo: 'NUEVO',
  mb: 'MB',
  b: 'B',
  r: 'R',
  m: 'M',
  mojado: 'MOJADO',
};

// Ficha imprimible del "Registro de valoración de los libros": hoja 1 = tabla del
// libro (en blanco como plantilla, o con los datos), hoja 2 = miembros del banco.
// Se descarga con el diálogo de imprimir del navegador (Guardar como PDF en iPad).
export default async function FichaPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; letra?: string; cod?: string; modo?: string }>;
}) {
  const { curso, letra: letraRaw, cod, modo } = await searchParams;
  if (!curso || !cod) notFound();
  const letra = letraRaw || null;
  const conDatos = modo === 'datos';

  const [alumnado, libros, registros] = await Promise.all([
    getAlumnadoClase(curso, letra),
    getLibrosBanco(curso, letra),
    getPasarLista(curso, letra, cod),
  ]);
  const libro = libros.find((b) => b.cod === cod);
  if (!libro) notFound();

  const claseLabel = letra && letra !== 'PDC' ? `${curso} ${letra}` : curso;
  const miembros = alumnado.filter((a) => a.banco);
  const registroDe = new Map(registros.map((r) => [r.asignacionId, r]));

  const filas = miembros.map((a) => {
    const r = a.asignacionId ? registroDe.get(a.asignacionId) : undefined;
    return {
      numeroLista: a.numeroLista,
      nombre: a.nombre,
      lote: a.lote,
      estado: conDatos && r?.estado ? ESTADO_LABEL[r.estado] ?? r.estado.toUpperCase() : '',
      borrado: conDatos && r ? r.borrado : null,
      forrado: conDatos && r ? r.forrado : null,
      notas: conDatos ? (r?.notas ?? '') : '',
    };
  });

  const celda = 'border border-zinc-400 px-2 py-1.5 text-sm';
  const cabecera = `${celda} bg-zinc-100 text-[11px] font-bold uppercase tracking-wide text-zinc-700`;

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-zinc-900 print:max-w-none print:p-0">
      <PrintButton />

      {/* ── Hoja 1: registro de valoración ── */}
      <header className="mb-4 flex items-end justify-between border-b-2 border-zinc-800 pb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            Banco de libros · curso {academicYearActual()}
          </p>
          <h1 className="text-xl font-black">Registro de valoración de los libros</h1>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logobur.png" alt="" className="h-12 w-auto" />
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <p><span className="font-bold">Asignatura:</span> {libro.asignatura ?? libro.nombre}</p>
        <p><span className="font-bold">Clase:</span> {claseLabel}</p>
        <p><span className="font-bold">Profesor/a:</span> {conDatos ? '' : ''}________________</p>
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        {libro.nombre} · {libro.cod}
        {conDatos ? ' · datos del sistema a fecha de impresión' : ' · plantilla en blanco para rellenar a mano'}
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cabecera}>Nº lista</th>
            <th className={`${cabecera} text-left`}>Alumno/a</th>
            <th className={cabecera}>Nº lote</th>
            <th className={cabecera}>Estado</th>
            <th className={cabecera}>Borrado</th>
            <th className={cabecera}>Sin borrar</th>
            <th className={cabecera}>Forrado / funda</th>
            <th className={cabecera}>Sin forrar</th>
            <th className={`${cabecera} w-28`}>Notas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.numeroLista}>
              <td className={`${celda} text-center font-semibold`}>{f.numeroLista}</td>
              <td className={celda}>{f.nombre}</td>
              <td className={`${celda} text-center`}>{f.lote ?? ''}</td>
              <td className={`${celda} text-center font-bold`}>{f.estado}</td>
              <td className={`${celda} text-center`}>{f.borrado === true ? 'X' : ''}</td>
              <td className={`${celda} text-center`}>{f.borrado === false ? 'X' : ''}</td>
              <td className={`${celda} text-center`}>{f.forrado === true ? 'X' : ''}</td>
              <td className={`${celda} text-center`}>{f.forrado === false ? 'X' : ''}</td>
              <td className={`${celda} text-xs`}>{f.notas}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-zinc-400">
        Estado: NUEVO · MB (muy bien) · B (bien) · R (regular) · M (mal) · MOJADO
      </p>

      {/* ── Hoja 2: miembros del banco ── */}
      <section className="mt-8 break-before-page">
        <header className="mb-4 flex items-end justify-between border-b-2 border-zinc-800 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              Banco de libros · curso {academicYearActual()}
            </p>
            <h2 className="text-xl font-black">Miembros del banco — {claseLabel}</h2>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logobur.png" alt="" className="h-12 w-auto" />
        </header>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={cabecera}>Nº lista</th>
              <th className={`${cabecera} text-left`}>Alumno/a</th>
              <th className={cabecera}>Nº lote</th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr key={m.eduStudentId}>
                <td className={`${celda} w-16 text-center font-semibold`}>{m.numeroLista}</td>
                <td className={celda}>{m.nombre}</td>
                <td className={`${celda} w-20 text-center`}>{m.lote ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-500">
          {miembros.length} miembros del banco de {alumnado.length} alumnos de la clase.
        </p>
      </section>
    </div>
  );
}
