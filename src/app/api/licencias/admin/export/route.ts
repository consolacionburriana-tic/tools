import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_TOKEN } from '@/lib/licencias-auth';
import { getCurrentCampaign } from '@/lib/licencias-server';
import {
  type EnviarRow,
  getEducamosRows,
  getEnviarRows,
  getGratisRows,
  getPagosConsolidado,
  getPagosPorLibro,
} from '@/lib/licencias-exports';

function toCsv(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  return '﻿' + body; // BOM para que Excel respete acentos
}

const ENVIAR_HEADER = [
  'COD ALU', 'COD LIBRO', 'Licencia Activación', 'Curso', 'Asignatura', 'Editorial',
  'Plataforma', 'Nombre', 'Apellidos', 'Mail', 'ISBN', 'Proyecto - Nombre Libro',
  'Banco Libros', 'Precio', 'Fecha pidió licencia',
];
const enviarToRow = (r: EnviarRow) => [
  r.codAlu, r.codLibro, '', r.curso, r.asignatura, r.editorial, r.plataforma,
  r.nombre, r.apellidos, r.mail, r.isbn, r.nombreLibro, r.bancoLibros, r.precio, r.fecha,
];

export async function GET(request: Request) {
  const jar = await cookies();
  if (jar.get(ADMIN_COOKIE)?.value !== ADMIN_TOKEN) {
    return new Response('No autorizado', { status: 401 });
  }
  const tipo = new URL(request.url).searchParams.get('tipo') ?? '';
  const campaign = await getCurrentCampaign();
  if (!campaign) return new Response('Sin campaña', { status: 404 });

  let header: string[] = [];
  let rows: (string | number)[][] = [];
  let nombre = 'export';

  if (tipo === 'enviar-si' || tipo === 'enviar-no') {
    const grupo = tipo === 'enviar-si' ? 'SI' : 'NO';
    const all = await getEnviarRows(campaign.id);
    header = ENVIAR_HEADER;
    rows = all.filter((r) => r.grupo === grupo).map(enviarToRow);
    nombre = `ENVIAR-${grupo}-BdL`;
  } else if (tipo === 'gratis') {
    header = ENVIAR_HEADER;
    rows = (await getGratisRows(campaign.id)).map(enviarToRow);
    nombre = 'ENVIAR-GRATIS-BdL';
  } else if (tipo === 'pagos') {
    const p = await getPagosConsolidado(campaign.id);
    header = ['COD ALU', 'ID Educamos', 'Curso', 'Apellidos', 'Nombre', 'Nº Licencias', 'Códigos', 'Total'];
    rows = p.map((r) => [r.codAlu, r.educamosId, r.curso, r.apellidos, r.nombre, r.numLicencias, r.codigos, r.total]);
    nombre = 'Pagos-consolidado';
  } else if (tipo === 'educamos') {
    const e = await getEducamosRows(campaign.id);
    header = ['Curso', 'ID Educamos', 'Importe'];
    rows = e.map((r) => [r.curso, r.educamosId, r.importe]);
    nombre = 'Educamos';
  } else if (tipo === 'libros') {
    const l = await getPagosPorLibro(campaign.id);
    header = ['COD', 'Editorial', 'Curso', 'Asignatura', 'Precio', 'Unidades'];
    rows = l.map((r) => [r.cod, r.editorial, r.curso, r.asignatura, r.precio, r.unidades]);
    nombre = 'Pagos-por-libro';
  } else {
    return new Response('Tipo no válido', { status: 400 });
  }

  return new Response(toCsv(header, rows), {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}-${campaign.academicYear.replace('/', '-')}.csv"`,
    },
  });
}
