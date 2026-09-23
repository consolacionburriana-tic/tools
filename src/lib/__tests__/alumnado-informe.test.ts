import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import {
  celda,
  columnasDisponibles,
  construirInforme,
  informeCsv,
  nombreFichero,
  type AlumnoInforme,
  type MaterialInforme,
} from '@/lib/alumnado-informe';
import { aWinAnsi, informePdf, informeXlsx } from '@/lib/alumnado-informe-formatos';

// Datos inventados: imitan la forma de `listaAlumnado`, no son de nadie.
const todoSi = { imagen: true, redes: true, ampa: true, ong: true, desestimaCorreo: false };
const alumno = (campos: Partial<AlumnoInforme> & Pick<AlumnoInforme, 'id' | 'completo'>): AlumnoInforme => ({
  apellidos: '',
  nombre: '',
  curso: '2ESO',
  letra: 'B',
  clase: '2º ESO B',
  numero: null,
  nia: null,
  bancoLibros: false,
  ampa: false,
  proteccion: todoSi,
  materiales: {},
  ...campos,
});

const agenda: MaterialInforme = { id: 'm-agenda', nombre: 'Agenda', destinos: [{ tipo: 'curso', curso: '2ESO' }] };
const bata: MaterialInforme = { id: 'm-bata', nombre: 'Bata', destinos: [{ tipo: 'etapa', etapa: 'EP' }] };

const alumnos: AlumnoInforme[] = [
  alumno({ id: '1', completo: 'Ana Prueba', numero: 1, nia: '100', bancoLibros: true, materiales: { 'm-agenda': 'pagado' } }),
  alumno({
    id: '2',
    completo: 'Bruno Ficticio',
    numero: 2,
    ampa: true,
    proteccion: { ...todoSi, ong: false, desestimaCorreo: true },
    materiales: { 'm-agenda': 'becado' },
  }),
  alumno({ id: '3', completo: 'Carla Inventada', numero: 3, bancoLibros: true, proteccion: null }),
  alumno({ id: '4', completo: 'Dani Primaria', curso: '2PRI', letra: 'A', clase: '2º Primaria A', numero: 1 }),
];

describe('celdas del informe', () => {
  const mats = new Map([agenda, bata].map((m) => [m.id, m]));

  it('la protección de datos que no te toca sale en blanco, no como «no»', () => {
    expect(celda(alumnos[2], 'pd', mats)).toEqual({ texto: '', tono: 'nada', clave: '' });
    expect(celda(alumnos[2], 'pd_correo', mats).texto).toBe('');
  });

  it('general y desestimación: parcial en ámbar, desestimar en rojo', () => {
    expect(celda(alumnos[1], 'pd', mats)).toMatchObject({ texto: 'Parcial', tono: 'aviso' });
    expect(celda(alumnos[1], 'pd_correo', mats)).toMatchObject({ texto: 'Sí', tono: 'no' });
    expect(celda(alumnos[0], 'pd_correo', mats)).toMatchObject({ texto: 'No', tono: 'si' });
  });

  it('un material que no va a su clase deja la celda vacía; sin marcar es «—»', () => {
    expect(celda(alumnos[3], 'mat:m-agenda', mats).tono).toBe('nada');
    expect(celda(alumnos[3], 'mat:m-bata', mats)).toMatchObject({ texto: '—', clave: 'sin' });
    expect(celda(alumnos[1], 'mat:m-agenda', mats)).toMatchObject({ texto: 'Becado', tono: 'beca' });
  });

  it('en banco y AMPA el «no» es neutro, no una alarma', () => {
    expect(celda(alumnos[1], 'banco', mats)).toMatchObject({ texto: 'No', tono: 'gris', clave: 'no' });
    expect(celda(alumnos[0], 'banco', mats)).toMatchObject({ texto: 'Sí', tono: 'si' });
    expect(celda(alumnos[1], 'pd_ong', mats)).toMatchObject({ texto: 'No', tono: 'no' });
  });

  it('ofrece una columna por material', () => {
    const claves = columnasDisponibles([agenda]).map((c) => c.clave);
    expect(claves).toContain('mat:m-agenda');
    expect(claves).toContain('pd_correo');
    expect(claves).not.toContain('pd_firmada');
  });
});

describe('construirInforme', () => {
  it('agrupa por clase y totaliza sobre a quien aplica', () => {
    const informe = construirInforme({
      alumnos,
      columnas: ['banco', 'mat:m-agenda'],
      materiales: [agenda, bata],
      ambito: 'Todo el centro',
    });
    expect(informe.grupos.map((g) => g.clase)).toEqual(['2º ESO B', '2º Primaria A']);
    expect(informe.grupos[0].totales).toEqual(['2/3', '2/3']); // el becado cuenta como pagado
    // En Primaria la agenda no aplica a nadie: sin total, en vez de un «0/0».
    expect(informe.grupos[1].totales).toEqual(['0/1', null]);
    expect(informe.titulo).toBe('Banco de libros · Agenda');
  });

  it('filtra por el valor canónico y quita las clases que se quedan vacías', () => {
    const informe = construirInforme({
      alumnos,
      columnas: ['banco'],
      materiales: [],
      filtro: { columna: 'banco', valor: 'si' },
      ambito: '2º ESO B',
    });
    expect(informe.total).toBe(2);
    expect(informe.grupos).toHaveLength(1);
    expect(informe.ambito).toBe('2º ESO B · solo Banco de libros: Sí');
  });

  it('ignora columnas que no existen y un filtro sobre ellas', () => {
    const informe = construirInforme({
      alumnos,
      columnas: ['banco', 'mat:no-existe' as const],
      materiales: [],
      filtro: { columna: 'mat:no-existe', valor: 'pagado' },
      ambito: 'x',
    });
    expect(informe.columnas.map((c) => c.clave)).toEqual(['banco']);
    expect(informe.total).toBe(4);
  });

  it('sin agrupar, cada fila lleva su clase', () => {
    const informe = construirInforme({ alumnos, columnas: ['ampa'], materiales: [], ambito: 'x', sinAgrupar: true });
    expect(informe.grupos).toHaveLength(1);
    expect(informe.grupos[0].filas[3].alumno).toBe('Dani Primaria · 2º Primaria A');
  });
});

describe('formatos', () => {
  const informe = construirInforme({
    alumnos,
    columnas: ['nia', 'banco', 'ampa', 'pd', 'pd_imagen', 'pd_redes', 'pd_ampa', 'pd_ong', 'pd_correo', 'mat:m-agenda'],
    materiales: [agenda],
    ambito: 'Todo el centro',
  });

  it('CSV con BOM, «;» y una línea por alumno', () => {
    const csv = informeCsv(informe);
    expect(csv.startsWith('﻿')).toBe(true);
    const lineas = csv.slice(1).split('\n');
    expect(lineas).toHaveLength(5);
    expect(lineas[0]).toBe(
      '"Clase";"Nº";"Alumno";"NIA";"Banco de libros";"AMPA";"Protección de datos";"Imagen y voz";"Redes y web";"AMPA";"ONG";"Desestima correo";"Agenda"',
    );
    expect(lineas[1]).toBe('"2º ESO B";"1";"Ana Prueba";"100";"Sí";"No";"Sí";"Sí";"Sí";"Sí";"Sí";"No";"Pagado"');
  });

  it('el PDF sale, apaisado con tantas columnas, y aguanta letras raras', async () => {
    const raro = construirInforme({
      alumnos: [alumno({ id: 'r', completo: 'Łukasz Øster 😀 Ñúñez' })],
      columnas: ['banco'],
      materiales: [],
      ambito: 'x',
    });
    await expect(informePdf(raro)).resolves.toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(await informePdf(informe, { paginaPorClase: true }));
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });

  it('un listado largo pasa de página', async () => {
    const muchos = Array.from({ length: 90 }, (_, i) => alumno({ id: `a${i}`, completo: `Alumno ${i}`, numero: i + 1 }));
    const doc = await PDFDocument.load(
      await informePdf(construirInforme({ alumnos: muchos, columnas: ['banco'], materiales: [], ambito: 'x' })),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('el Excel lleva la hoja del informe y la de totales', async () => {
    const zip = await JSZip.loadAsync(await informeXlsx(informe));
    const libro = await zip.file('xl/workbook.xml')!.async('string');
    expect(libro).toContain('name="Informe"');
    expect(libro).toContain('name="Totales"');
  });

  it('aWinAnsi deja lo castellano y valenciano intacto', () => {
    expect(aWinAnsi('Àngels Ñúñez · 3º ESO')).toBe('Àngels Ñúñez · 3º ESO');
    expect(aWinAnsi('Łukasz 😀')).toBe('?ukasz ?');
    expect(aWinAnsi('Ştefan')).toBe('Stefan');
  });

  it('nombre de fichero limpio', () => {
    expect(nombreFichero({ titulo: 'Banco de libros', ambito: '2º ESO B · solo…' }, 'pdf')).toBe(
      'informe-banco-de-libros-2-eso-b.pdf',
    );
  });
});
