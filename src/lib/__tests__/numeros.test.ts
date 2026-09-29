import { describe, expect, it } from 'vitest';
import {
  aHTML,
  anioDeEmpezar3,
  anioQueToca,
  aTSV,
  celda,
  columnasVisibles,
  construirTabla,
  llamaLaAtencion,
  nombreClase,
  nombreCurso,
  pestanas,
  porEtapa,
  recortar,
  sumar,
  tablaCopiable,
  type DatosNumeros,
  type FilaClase,
  type PermisosNumeros,
} from '@/lib/numeros';

const TODO: PermisosNumeros = { proteccion: true, licencias: true, perfil: true, becas: true };
const NADA: PermisosNumeros = { proteccion: false, licencias: false, perfil: false, becas: false };

const fila = (curso: string, letra: string | null, v: Record<string, number>): FilaClase => ({
  curso,
  letra,
  etapa: curso.includes('INF') ? 'EI' : curso.includes('PRI') ? 'EP' : 'ESO',
  v,
});

const FILAS: FilaClase[] = [
  fila('3ESO', 'B', { alumnos: 31, 'fam.papeles': 28, 'banco.alumnos': 31, 'banco.si': 29 }),
  fila('3ºPPDC', 'PDC', { alumnos: 12, 'fam.papeles': 11, 'banco.alumnos': 12, 'banco.si': 11 }),
  fila('3INF', 'A', { alumnos: 23, 'fam.papeles': 15, ampa: 1 }),
  fila('3ESO', 'A', { alumnos: 18, 'fam.papeles': 16, 'banco.alumnos': 18, 'banco.si': 17 }),
  fila('1PRI', 'A', { alumnos: 23, 'fam.papeles': 15 }),
];

describe('nombres', () => {
  it('clase y curso como se dicen', () => {
    expect(nombreClase('3INF', 'A')).toBe('3 años A');
    expect(nombreClase('1PRI', 'B')).toBe('1º EP B');
    expect(nombreClase('2ESO', 'A')).toBe('2º ESO A');
    expect(nombreClase('3ºPPDC', 'PDC')).toBe('3º PDC');
    expect(nombreCurso('5INF')).toBe('Infantil 5 años');
    expect(nombreCurso('6PRI')).toBe('6º Primaria');
    expect(nombreCurso('3ESO')).toBe('3º ESO');
  });
});

describe('la tabla', () => {
  it('por cursos: el PDC va dentro de su curso de ESO, con subtotal de etapa y total', () => {
    const t = construirTabla(FILAS, 'cursos');
    expect(t.map((f) => f.nombre)).toEqual([
      'Infantil 3 años',
      'Total Infantil',
      '1º Primaria',
      'Total Primaria',
      '3º ESO',
      'Total Secundaria',
      'Todo el cole',
    ]);
    const eso3 = t.find((f) => f.nombre === '3º ESO')!;
    expect(eso3.v.alumnos).toBe(61);
    expect(eso3.clases).toBe(3);
    expect(t.at(-1)!.v.alumnos).toBe(107);
  });

  it('por clases: ordenadas, y el total de curso solo cuando tiene más de una', () => {
    const t = construirTabla(FILAS, 'clases');
    expect(t.map((f) => f.nombre)).toEqual([
      '3 años A',
      'Total Infantil',
      '1º EP A',
      'Total Primaria',
      '3º ESO A',
      '3º ESO B',
      '3º PDC',
      'Total 3º ESO',
      'Total Secundaria',
      'Todo el cole',
    ]);
  });

  it('con una sola etapa no hay fila de todo el cole', () => {
    const t = construirTabla(FILAS.filter((f) => f.etapa === 'ESO'), 'etapas');
    expect(t.map((f) => f.nombre)).toEqual(['Secundaria']);
  });
});

describe('celdas', () => {
  const [resumen] = pestanas({ permisos: TODO, materiales: [], materialId: null, papel: 'cole', hayLicencias: false });
  const banco = pestanas({ permisos: TODO, materiales: [], materialId: null, papel: 'cole', hayLicencias: false }).find(
    (p) => p.id === 'banco',
  )!;
  const t = construirTabla(FILAS, 'clases');

  it('«Clases» y «Media» no dicen nada en una fila de clase', () => {
    const media = resumen.columnas.find((c) => c.id === 'media')!;
    expect(celda(media, t[0], 'n').texto).toBe('');
    const eso = t.find((f) => f.nombre === 'Total 3º ESO')!;
    expect(celda(media, eso, 'n').texto).toBe('20,3');
  });

  it('el banco en Infantil sale «—», no 0', () => {
    const si = banco.columnas.find((c) => c.id === 'banco.si')!;
    expect(celda(si, t[0], 'n')).toMatchObject({ texto: '—', vacia: true });
    const eso = t.find((f) => f.nombre === 'Total 3º ESO')!;
    expect(celda(si, eso, 'n').texto).toBe('57');
    expect(celda(si, eso, 'p')).toMatchObject({ texto: '93 %', crudo: '93%' });
  });

  it('miles con punto en pantalla y sin punto al copiar', () => {
    const alumnos = resumen.columnas[0];
    const c = celda(alumnos, { tipo: 'total', v: { alumnos: 1234 } }, 'n');
    expect(c.texto).toBe((1234).toLocaleString('es-ES'));
    expect(c.crudo).toBe('1234');
  });
});

describe('papeles por familia', () => {
  const ctx = { permisos: TODO, materiales: [], materialId: null, hayLicencias: false } as const;
  const v = { alumnos: 45, 'fam.papeles': 27, 'fam.papelesEtapa': 30 };
  it('para el cole cuenta el mayor del cole; por etapa, el mayor de la etapa', () => {
    const cole = pestanas({ ...ctx, papel: 'cole' }).find((p) => p.id === 'familias')!;
    const etapa = pestanas({ ...ctx, papel: 'etapa' }).find((p) => p.id === 'familias')!;
    expect(cole.columnas.find((c) => c.id === 'papeles')!.valor(v)).toBe(27);
    expect(etapa.columnas.find((c) => c.id === 'papeles')!.valor(v)).toBe(30);
    expect(cole.frase('3º Primaria', v)).toBe(
      'Para dar un papel por familia en 3º Primaria hacen falta 27 copias, no 45: 18 alumnos tienen un hermano mayor que ya se lo lleva.',
    );
  });
});

describe('pestañas según permisos', () => {
  it('sin permisos: ni protección de datos, ni licencias, ni perfil, ni becas', () => {
    const ps = pestanas({
      permisos: NADA,
      materiales: [{ id: 'm1', nombre: 'Tekman', importe: null }],
      materialId: null,
      papel: 'etapa',
      hayLicencias: true,
    });
    expect(ps.map((p) => p.id)).toEqual(['resumen', 'familias', 'banco', 'materiales', 'datos']);
    expect(ps.find((p) => p.id === 'materiales')!.columnas.some((c) => c.id === 'becado')).toBe(false);
  });

  it('licencias solo si hay campaña que enseñar', () => {
    const sin = pestanas({ permisos: TODO, materiales: [], materialId: null, papel: 'cole', hayLicencias: false });
    expect(sin.some((p) => p.id === 'licencias')).toBe(false);
    expect(sin.some((p) => p.id === 'materiales')).toBe(false);
  });

  it('«solo lo básico» deja una o dos columnas', () => {
    const ps = pestanas({ permisos: TODO, materiales: [], materialId: null, papel: 'cole', hayLicencias: true });
    for (const p of ps) {
      const n = columnasVisibles(p, true).length;
      expect(n, p.id).toBeGreaterThanOrEqual(1);
      expect(n, p.id).toBeLessThanOrEqual(2);
    }
    expect(columnasVisibles(ps[0], true).map((c) => c.titulo)).toEqual(['Alumnos']);
  });

  it('materiales: «sin marcar» es lo que va menos lo marcado', () => {
    const [m] = pestanas({
      permisos: TODO,
      materiales: [{ id: 'm1', nombre: 'Tekman', importe: 12 }],
      materialId: 'm1',
      papel: 'cole',
      hayLicencias: false,
    }).filter((p) => p.id === 'materiales');
    const v = { 'mat.m1.van': 25, 'mat.m1.pagado': 20, 'mat.m1.no': 2, 'mat.m1.becado': 1 };
    expect(m.titulo).toBe('Materiales · Tekman');
    expect(m.columnas.find((c) => c.id === 'sin')!.valor(v)).toBe(2);
    expect(m.columnas.find((c) => c.id === 'recaudado')!.valor(v)).toBe(240);
  });
});

describe('recortar por permisos', () => {
  const datos: DatosNumeros = {
    version: 1,
    generadoAt: '2026-09-28T08:00:00.000Z',
    academicYear: '2026-27',
    materiales: [{ id: 'm1', nombre: 'Tekman', importe: null }],
    campana: { nombre: 'Licencias 2026/27', estado: 'open' },
    profes: { EI: 7, EP: 18, ESO: 18, sinEtapa: 11 },
    filas: [
      fila('2ESO', 'B', { alumnos: 29, 'pd.todoSi': 29, 'lic.pedidos': 29, 'perfil.mayores': 3, 'mat.m1.pagado': 4, 'mat.m1.becado': 2 }),
      fila('3INF', 'A', { alumnos: 23, 'mat.m1.becado': 1 }),
    ],
  };

  it('quien lo ve todo, lo ve todo', () => {
    expect(recortar(datos, { clases: null, permisos: TODO })).toEqual(datos);
  });

  it('un tutor: su etapa, sin protección de datos, licencias ni perfil, y las becas como pagado', () => {
    const r = recortar(datos, { clases: [{ curso: '2ESO', letra: 'B' }], permisos: NADA });
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].v).toEqual({ alumnos: 29, 'mat.m1.pagado': 6 });
    expect(r.campana).toBeNull();
  });

  it('una beca sin pagos también pasa a pagado, y no se cuenta dos veces', () => {
    const r = recortar(datos, { clases: null, permisos: { ...TODO, becas: false } });
    expect(r.filas[1].v).toEqual({ alumnos: 23, 'mat.m1.pagado': 1 });
    expect(r.filas[0].v['mat.m1.pagado']).toBe(6);
  });
});

describe('copiar', () => {
  const [resumen] = pestanas({ permisos: TODO, materiales: [], materialId: null, papel: 'cole', hayLicencias: false });
  const cols = columnasVisibles(resumen, true);
  const t = tablaCopiable('Resumen', '2026-27', 'etapas', cols, construirTabla(FILAS, 'etapas'), 'n');

  it('TSV: cabecera y una fila por línea', () => {
    expect(aTSV(t)).toBe('Etapa\tAlumnos\nInfantil\t23\nPrimaria\t23\nSecundaria\t61\nTodo el cole\t107');
  });

  it('HTML: tabla con estilos en línea y sin colarse etiquetas', () => {
    const h = aHTML({ ...t, titulo: 'A <b>' });
    expect(h).toContain('<table');
    expect(h).toContain('A &lt;b&gt;');
    expect(h).toContain('>107<');
  });
});

describe('lo que llama la atención', () => {
  it('la clase más llena y la más pequeña', () => {
    const r = llamaLaAtencion('resumen', FILAS, { papel: 'cole', materialId: null, materiales: [] });
    expect(r[0]).toBe('La clase más llena es **3º ESO B** (31) y la más pequeña **3º PDC** (12).');
  });

  it('papeles: cuántas copias de más se ahorran', () => {
    const r = llamaLaAtencion('familias', FILAS, { papel: 'cole', materialId: null, materiales: [] });
    expect(r[0]).toBe('Con **85** copias llegas a todas las familias; una por alumno serían 107, **22 de más**.');
  });
});

describe('años que tocan', () => {
  it('curso 2026-27', () => {
    expect(anioQueToca('3INF', 2026)).toBe(2023);
    expect(anioQueToca('1PRI', 2026)).toBe(2020);
    expect(anioQueToca('1ESO', 2026)).toBe(2014);
    expect(anioQueToca('3ºPPDC', 2026)).toBe(2012);
    expect(anioDeEmpezar3('3INF', 2026)).toBe(2026);
    expect(anioDeEmpezar3('1PRI', 2026)).toBe(2023);
    expect(anioDeEmpezar3('1ESO', 2026)).toBe(2017);
  });
});

describe('histórico', () => {
  it('suma por etapa', () => {
    expect(porEtapa(FILAS, (v) => v.alumnos ?? 0)).toEqual({ EI: 23, EP: 23, ESO: 61, total: 107 });
  });
  it('sumar junta todas las claves', () => {
    expect(sumar([{ v: { a: 1 } }, { v: { a: 2, b: 3 } }])).toEqual({ a: 3, b: 3 });
  });
});

describe('preferencias', () => {
  it('lo que no es válido se queda en lo de siempre', async () => {
    const { leerPreferencias, PREFERENCIAS_INICIALES } = await import('@/lib/numeros');
    expect(leerPreferencias(undefined)).toEqual(PREFERENCIAS_INICIALES);
    expect(leerPreferencias('{roto')).toEqual(PREFERENCIAS_INICIALES);
    expect(leerPreferencias(JSON.stringify({ pestana: 'familias', nivel: 'clases', basico: false, modo: 'x' }))).toEqual({
      ...PREFERENCIAS_INICIALES,
      pestana: 'familias',
      nivel: 'clases',
      basico: false,
    });
    expect(PREFERENCIAS_INICIALES.basico).toBe(true);
  });
});

describe('quiénes son', () => {
  it('cada columna de personas tiene su lista; las de euros o medias, no', async () => {
    const { listaDeColumna } = await import('@/lib/numeros');
    const ctx = { papel: 'cole' as const, materialId: '1c9955ea-ad01-4e4d-90fe-aa01884391fc' };
    expect(listaDeColumna('resumen', 'chicas', ctx)).toEqual({ tipo: 'a', marca: 'chica' });
    expect(listaDeColumna('resumen', 'media', ctx)).toBeNull();
    expect(listaDeColumna('familias', 'papeles', { ...ctx, papel: 'etapa' })).toEqual({ tipo: 'a', marca: 'papel_etapa' });
    expect(listaDeColumna('banco', 'banco.no', ctx)).toEqual({ tipo: 'a', marca: 'banco_no', soloBanco: true });
    expect(listaDeColumna('materiales', 'sin', ctx)).toEqual({ tipo: 'm', materialId: ctx.materialId, estado: 'sin' });
    expect(listaDeColumna('licencias', 'lic.importe', ctx)).toBeNull();
  });

  it('ida y vuelta por la URL, y nada raro se cuela', async () => {
    const { escribirLista, leerLista } = await import('@/lib/numeros');
    const marcas = ['chica', 'banco_no'];
    const l = { tipo: 'a' as const, marca: 'banco_no', soloBanco: true };
    expect(leerLista(escribirLista(l), marcas)).toEqual(l);
    expect(leerLista('a:chica', marcas)).toEqual({ tipo: 'a', marca: 'chica' });
    expect(leerLista("a:chica'; drop", marcas)).toBeNull();
    expect(leerLista('a:mayor', marcas)).toBeNull();
    expect(leerLista('m:no-es-un-id:pagado', marcas)).toBeNull();
    expect(leerLista('l:faltan', marcas)).toEqual({ tipo: 'l', estado: 'faltan' });
  });

  it('el ámbito de cada fila', async () => {
    const { enAmbito } = await import('@/lib/numeros');
    expect(enAmbito('total', '3INF', 'A')).toBe(true);
    expect(enAmbito('e|ESO', '3ºPPDC', 'PDC')).toBe(true);
    expect(enAmbito('e|EP', '3ºPPDC', 'PDC')).toBe(false);
    expect(enAmbito('c|3ESO', '3ºPPDC', 'PDC')).toBe(true);
    expect(enAmbito('c|3ESO', '3ESO', 'A')).toBe(true);
    expect(enAmbito('3ESO|A', '3ESO', 'B')).toBe(false);
    expect(enAmbito('3ºPPDC|PDC', '3ºPPDC', 'PDC')).toBe(true);
  });
});
