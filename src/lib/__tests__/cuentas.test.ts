import { describe, expect, it } from 'vitest';
import {
  adivinarUo,
  aFechaISO,
  AJUSTES_CUENTAS_POR_DEFECTO,
  ajustesEfectivos,
  claveClase,
  conAscendientes,
  cruzar,
  describirFuente,
  elegirCorreo,
  enlaceGrupo,
  firmaUo,
  generarContrasena,
  leerAjustesCuentas,
  miembrosDeseados,
  motivoCorreoNoValido,
  nombreLista,
  planGrupo,
  propuestasCorreo,
  sumarMeses,
  uoArchivo,
  uoDentroDe,
  usuarioCorreo,
  type AjustesCuentas,
  type AlumnoCruce,
  type CuentaGoogle,
  type DatosGrupos,
  type MiembroActual,
  type ProfeCruce,
  type ReglasGrupo,
} from '@/lib/cuentas';

const DOM = 'cole.test';
const HOY = new Date('2026-10-20T10:00:00Z');

// Unidades con los nombres variados de un colegio de verdad (estructura, no personas).
const RUTAS = [
  '/Alumnos',
  '/Alumnos/Alumnos Infantil',
  '/Alumnos/Alumnos Infantil/3 A',
  '/Alumnos/Alumnos Infantil/4 Años A',
  '/Alumnos/Alumnos Infantil/2526 3INFA',
  '/Alumnos/Alumnos Primaria',
  '/Alumnos/Alumnos Primaria/1ºA',
  '/Alumnos/Alumnos Primaria/1ºB',
  '/Alumnos/Alumnos Secundaria',
  '/Alumnos/Alumnos Secundaria/1º ESO A',
  '/Alumnos/Alumnos Secundaria/4º ESO A',
  '/Alumnos/Alumnos Secundaria/Ex-alumnos',
  '/Alumnos/Alumnos Secundaria/4 ESO acabado 2023-2024',
  '/Alumnos/Pendientes de eliminar',
  '/Profesores',
  '/Profesores/Infantil',
  '/Profesores/Primaria',
  '/Profesores/Secundaria',
  '/PAS',
];

function cuenta(p: Partial<CuentaGoogle> & { id: string; email: string }): CuentaGoogle {
  return {
    alias: [],
    nombre: null,
    apellidos: null,
    uo: '/',
    suspendida: false,
    archivada: false,
    admin: false,
    creadaAt: '2024-09-01T08:00:00.000Z',
    ultimoAccesoAt: '2026-10-01T08:00:00.000Z',
    ...p,
  };
}

function alumno(p: Partial<AlumnoCruce> & { id: string }): AlumnoCruce {
  return {
    nombre: 'ANA',
    apellido1: 'PLAZA',
    apellido2: 'ROCA',
    curso: '1PRI',
    letra: 'A',
    emailGoogle: null,
    email: null,
    activo: true,
    salidaAt: '2026-10-01T00:00:00.000Z',
    desestimaCorreo: false,
    ...p,
  };
}

function profe(p: Partial<ProfeCruce> & { id: string }): ProfeCruce {
  return {
    nombre: 'LUIS',
    apellido1: 'MORA',
    apellido2: 'SANZ',
    email: null,
    emailOtro: null,
    activo: true,
    fechaBaja: null,
    etapas: ['EP'],
    ...p,
  };
}

function ajustes(p: Partial<AjustesCuentas> = {}): AjustesCuentas {
  return ajustesEfectivos({ ...AJUSTES_CUENTAS_POR_DEFECTO, ...p }, RUTAS).ajustes;
}

describe('correos', () => {
  it('saca la parte del correo como las del colegio: sin acentos, la ñ como n, solo letras', () => {
    expect(usuarioCorreo('MARÍA DEL MAR', 'NÚÑEZ')).toBe('mariadelmarnunez');
    expect(usuarioCorreo("D'ARC", 'Gómez-Peña')).toBe('darcgomezpena');
    expect(usuarioCorreo('Çelia', null, undefined, 'Col·legi')).toBe('celiacollegi');
  });

  it('propone nombre + primer apellido, y si no, con el segundo entero y con su inicial', () => {
    expect(propuestasCorreo({ nombre: 'ANA', apellido1: 'PLAZA', apellido2: 'ROCA' })).toEqual([
      'anaplaza',
      'anaplazaroca',
      'anaplazar',
    ]);
    expect(propuestasCorreo({ nombre: 'ANA', apellido1: null, apellido2: 'ROCA' })).toEqual(['anaroca']);
    expect(propuestasCorreo({ nombre: null, apellido1: null, apellido2: null })).toEqual([]);
  });

  it('elige el primero libre y, si están todos, le pone un número', () => {
    const p = { nombre: 'ANA', apellido1: 'PLAZA', apellido2: 'ROCA' };
    expect(elegirCorreo(p, new Set(), DOM)).toBe('anaplaza@cole.test');
    expect(elegirCorreo(p, new Set(['anaplaza@cole.test']), DOM)).toBe('anaplazaroca@cole.test');
    const todos = new Set(['anaplaza@cole.test', 'anaplazaroca@cole.test', 'anaplazar@cole.test']);
    expect(elegirCorreo(p, todos, DOM)).toBe('anaplaza2@cole.test');
  });

  it('valida un correo nuevo del dominio', () => {
    expect(motivoCorreoNoValido('anaplaza@cole.test', DOM)).toBeNull();
    expect(motivoCorreoNoValido('ana.plaza@cole.test', DOM)).toBeNull();
    expect(motivoCorreoNoValido('anaplaza@gmail.com', DOM)).toMatch(/cole\.test/);
    expect(motivoCorreoNoValido('añaplaza@cole.test', DOM)).toMatch(/acentos/);
    expect(motivoCorreoNoValido('ana@plaza@cole.test', DOM)).toBeTruthy();
    expect(motivoCorreoNoValido('.ana@cole.test', DOM)).toBeTruthy();
  });

  it('pinta el nombre como en una lista de clase', () => {
    expect(nombreLista({ nombre: 'MARIA DEL MAR', apellido1: 'DE LA TORRE', apellido2: 'GIL' })).toBe(
      'De la Torre Gil, Maria del Mar',
    );
  });
});

describe('unidades organizativas', () => {
  it('lee los nombres que hay en el colegio', () => {
    expect(firmaUo('/Alumnos/Alumnos Infantil/3 A')).toMatchObject({ etapa: 'EI', nivel: 3, letra: 'A', cohorte: false });
    expect(firmaUo('/Alumnos/Alumnos Infantil/4 Años A')).toMatchObject({ etapa: 'EI', nivel: 4, letra: 'A' });
    expect(firmaUo('/Alumnos/Alumnos Infantil/2526 3INFA')).toMatchObject({ etapa: 'EI', nivel: 3, letra: 'A', cohorte: true });
    expect(firmaUo('/Alumnos/Alumnos Primaria/1ºB')).toMatchObject({ etapa: 'EP', nivel: 1, letra: 'B' });
    expect(firmaUo('/Alumnos/Alumnos Secundaria/1º ESO A')).toMatchObject({ etapa: 'ESO', nivel: 1, letra: 'A' });
    expect(firmaUo('/Alumnos/Alumnos Secundaria/3º ESO PDC')).toMatchObject({ etapa: 'ESO', nivel: 3, letra: 'PDC' });
    expect(firmaUo('/Alumnos/Alumnos Secundaria/4 ESO acabado 2023-2024').apartada).toBe(true);
    expect(firmaUo('/Alumnos/Alumnos Secundaria/Ex-alumnos').apartada).toBe(true);
    expect(firmaUo('/UO de prueba david/PIAR Tests').apartada).toBe(true);
    expect(firmaUo('/Profesores/Primaria').nivel).toBeNull();
  });

  it('adivina la unidad de cada clase sin coger las de una promoción ni las de archivo', () => {
    expect(adivinarUo({ curso: '3INF', letra: 'A' }, RUTAS)).toBe('/Alumnos/Alumnos Infantil/3 A');
    expect(adivinarUo({ curso: '4INF', letra: 'A' }, RUTAS)).toBe('/Alumnos/Alumnos Infantil/4 Años A');
    expect(adivinarUo({ curso: '1PRI', letra: 'B' }, RUTAS)).toBe('/Alumnos/Alumnos Primaria/1ºB');
    expect(adivinarUo({ curso: '4ESO', letra: 'A' }, RUTAS)).toBe('/Alumnos/Alumnos Secundaria/4º ESO A');
    // Sin unidad (5ºA no existe) o sin una sola clara: no adivina.
    expect(adivinarUo({ curso: '5PRI', letra: 'A' }, RUTAS)).toBeNull();
    expect(adivinarUo({ curso: '3ºPPDC', letra: 'PDC' }, RUTAS)).toBeNull();
    expect(adivinarUo({ curso: '1PRI', letra: 'A' }, [...RUTAS, '/Otra/Primaria/1 A'])).toBeNull();
  });

  it('añade las unidades padre que no tienen a nadie dentro', () => {
    expect(conAscendientes(['/Alumnos/Alumnos Infantil/3 A'])).toEqual([
      '/Alumnos',
      '/Alumnos/Alumnos Infantil',
      '/Alumnos/Alumnos Infantil/3 A',
    ]);
  });

  it('sabe si una unidad está dentro de otra (sin confundir prefijos)', () => {
    expect(uoDentroDe('/Alumnos/A', '/Alumnos')).toBe(true);
    expect(uoDentroDe('/Alumnos', '/Alumnos')).toBe(true);
    expect(uoDentroDe('/AlumnosViejos', '/Alumnos')).toBe(false);
    expect(uoDentroDe('/PAS', '/')).toBe(true);
    expect(uoDentroDe('/PAS', null)).toBe(false);
  });

  it('propone raíces, archivo y unidades del profesorado, y lo guardado manda', () => {
    const { ajustes: a, propuestos } = ajustesEfectivos(AJUSTES_CUENTAS_POR_DEFECTO, RUTAS);
    expect(a.raizAlumnos).toBe('/Alumnos');
    expect(a.raizProfes).toBe('/Profesores');
    expect(a.archivoAlumnos).toBe('/Alumnos/Alumnos Secundaria/Ex-alumnos');
    expect(a.archivoProfes).toBeNull();
    expect(a.profes).toEqual({ EI: '/Profesores/Infantil', EP: '/Profesores/Primaria', ESO: '/Profesores/Secundaria' });
    expect(propuestos).toContain('raizAlumnos');
    const guardado = ajustesEfectivos({ ...AJUSTES_CUENTAS_POR_DEFECTO, archivoAlumnos: '/Antiguos' }, RUTAS);
    expect(guardado.ajustes.archivoAlumnos).toBe('/Antiguos');
    expect(guardado.propuestos).not.toContain('archivoAlumnos');
  });

  it('lee los ajustes guardados con lo que falte por defecto, y la basura no rompe', () => {
    expect(leerAjustesCuentas(null)).toEqual(AJUSTES_CUENTAS_POR_DEFECTO);
    expect(leerAjustesCuentas('basura')).toEqual(AJUSTES_CUENTAS_POR_DEFECTO);
    expect(leerAjustesCuentas({ graciaGraduados: 6 })).toEqual({ ...AJUSTES_CUENTAS_POR_DEFECTO, graciaGraduados: 6 });
  });

  it('archiva por curso de salida si se pide', () => {
    const a = ajustes({ archivoPorCurso: true });
    expect(uoArchivo(a, { zona: 'alumnado', salidaAt: '2026-07-09', graduado: true })).toBe(
      '/Alumnos/Alumnos Secundaria/Ex-alumnos/Promoción 2025-26',
    );
    expect(uoArchivo(a, { zona: 'alumnado', salidaAt: '2026-11-15', graduado: false })).toBe(
      '/Alumnos/Alumnos Secundaria/Ex-alumnos/Bajas 2026-27',
    );
    expect(uoArchivo(a, { zona: 'profesorado', salidaAt: '2026-11-15', graduado: false })).toBeNull();
  });
});

describe('fechas', () => {
  it('suma meses sin pasarse de fin de mes', () => {
    expect(sumarMeses('2026-07-09', 8)).toBe('2027-03-09');
    expect(sumarMeses('2027-01-31', 1)).toBe('2027-02-28');
    expect(sumarMeses('2026-12-15', 0)).toBe('2026-12-15');
  });

  it('normaliza fechas e instantes', () => {
    expect(aFechaISO('2026-07-09T10:00:00.000Z')).toBe('2026-07-09');
    expect(aFechaISO(new Date('2026-07-09T10:00:00Z'))).toBe('2026-07-09');
    expect(aFechaISO('no es fecha')).toBeNull();
    expect(aFechaISO(null)).toBeNull();
  });
});

describe('el cruce Educamos ↔ Google', () => {
  it('casa por el correo de Google o por un alias, y propone correo a quien no tiene', () => {
    const r = cruzar({
      cuentas: [
        cuenta({ id: 'g1', email: 'anaplaza@cole.test', uo: '/Alumnos/Alumnos Primaria/1ºA' }),
        cuenta({ id: 'g2', email: 'nuevo@cole.test', alias: ['pablomir@cole.test'], uo: '/Alumnos/Alumnos Primaria/1ºA' }),
      ],
      rutas: RUTAS,
      alumnos: [
        alumno({ id: 'a1', emailGoogle: 'anaplaza@cole.test' }),
        alumno({ id: 'a2', nombre: 'PABLO', apellido1: 'MIR', emailGoogle: 'pablomir@cole.test' }),
        alumno({ id: 'a3', nombre: 'ANA', apellido1: 'PLAZA', apellido2: 'VIDAL' }),
        alumno({ id: 'a4', nombre: 'ANA', apellido1: 'PLAZA', apellido2: 'VERA' }),
      ],
      profes: [],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    const f = (clave: string) => r.filas.find((x) => x.clave === clave)!;
    expect(f('a:a1').cuenta?.id).toBe('g1');
    expect(f('a:a2').cuenta?.id).toBe('g2');
    expect(f('a:a3').estado).toBe('sin-correo');
    // Dos «Ana Plaza» sin correo: la primera no puede ser anaplaza (está pillado) y la segunda
    // no repite lo que se le ha propuesto a la primera.
    expect(f('a:a3').propuesta).toBe('anaplazavidal@cole.test');
    expect(f('a:a4').propuesta).toBe('anaplazavera@cole.test');
    expect(r.resumen.crear).toEqual({ alumnos: 2, profes: 0, porCurso: [{ curso: '1PRI', n: 2 }] });
  });

  it('solo propone mover cuando la unidad de la clase está confirmada', () => {
    const datos = {
      cuentas: [cuenta({ id: 'g1', email: 'anaplaza@cole.test', uo: '/Alumnos/Alumnos Infantil/2526 3INFA' })],
      rutas: RUTAS,
      alumnos: [alumno({ id: 'a1', curso: '4INF', letra: 'A', emailGoogle: 'anaplaza@cole.test' })],
      profes: [],
      marcas: [],
      dominio: DOM,
      hoy: HOY,
    };
    const sinConfirmar = cruzar({ ...datos, ajustes: ajustes() });
    expect(sinConfirmar.filas[0].estado).toBe('ok');
    expect(sinConfirmar.clases[0]).toMatchObject({ uo: '/Alumnos/Alumnos Infantil/4 Años A', confirmada: false });
    expect(sinConfirmar.resumen.clasesSinUo).toBe(1);

    const confirmada = cruzar({
      ...datos,
      ajustes: ajustes({ clases: { [claveClase('4INF', 'A')]: '/Alumnos/Alumnos Infantil/4 Años A' } }),
    });
    expect(confirmada.filas[0]).toMatchObject({ estado: 'fuera', uoDestino: '/Alumnos/Alumnos Infantil/4 Años A' });
    expect(confirmada.clases[0]).toMatchObject({ confirmada: true, enSuSitio: 0, fuera: 1 });
    expect(confirmada.resumen.fuera).toBe(1);
  });

  it('una persona activa con la cuenta suspendida pide reactivar; la que desestima el correo no pide crear', () => {
    const r = cruzar({
      cuentas: [cuenta({ id: 'g1', email: 'anaplaza@cole.test', suspendida: true })],
      rutas: RUTAS,
      alumnos: [alumno({ id: 'a1', emailGoogle: 'anaplaza@cole.test' }), alumno({ id: 'a2', nombre: 'EVA', desestimaCorreo: true })],
      profes: [],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    expect(r.filas.find((f) => f.clave === 'a:a1')!.estado).toBe('suspendida');
    expect(r.filas.find((f) => f.clave === 'a:a2')!.estado).toBe('no-le-toca');
    expect(r.resumen).toMatchObject({ reactivar: 1, crear: { alumnos: 0 } });
  });

  it('a los de 4º de ESO les deja la cuenta los meses de gracia, y a las bajas, los suyos', () => {
    const r = cruzar({
      cuentas: [
        cuenta({ id: 'g1', email: 'graduada@cole.test', uo: '/Alumnos/Alumnos Secundaria/4º ESO A' }),
        cuenta({ id: 'g2', email: 'sefue@cole.test', uo: '/Alumnos/Alumnos Primaria/1ºA' }),
        cuenta({ id: 'g3', email: 'profe@cole.test', uo: '/Profesores/Primaria' }),
      ],
      rutas: RUTAS,
      alumnos: [
        alumno({ id: 'a1', curso: '4ESO', emailGoogle: 'graduada@cole.test', activo: false, salidaAt: '2026-07-09T08:00:00Z' }),
        alumno({ id: 'a2', curso: '1PRI', emailGoogle: 'sefue@cole.test', activo: false, salidaAt: '2026-09-01T08:00:00Z' }),
      ],
      profes: [profe({ id: 'p1', email: 'profe@cole.test', activo: false, fechaBaja: '2026-06-30' })],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    const f = (clave: string) => r.filas.find((x) => x.clave === clave)!;
    expect(f('a:a1')).toMatchObject({ estado: 'baja-espera', graduado: true, suspenderDesde: '2027-03-09' });
    expect(f('a:a1').uoDestino).toBe('/Alumnos/Alumnos Secundaria/Ex-alumnos');
    expect(f('a:a2')).toMatchObject({ estado: 'baja', graduado: false, suspenderDesde: '2026-10-01' });
    expect(f('p:p1')).toMatchObject({ estado: 'baja', suspenderDesde: '2026-07-30', uoDestino: null });
    expect(r.resumen).toMatchObject({ suspender: 2, enEspera: 1, proximaBaja: '2027-03-09' });
  });

  it('una baja sin cuenta no sale, y si una baja y un alta apuntan a la misma cuenta, es del alta', () => {
    const r = cruzar({
      cuentas: [cuenta({ id: 'g1', email: 'ana@cole.test' })],
      rutas: RUTAS,
      alumnos: [
        alumno({ id: 'vieja', emailGoogle: 'ana@cole.test', activo: false }),
        alumno({ id: 'nueva', emailGoogle: 'ana@cole.test' }),
        alumno({ id: 'otra', emailGoogle: null, activo: false }),
      ],
      profes: [],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    expect(r.filas.map((f) => f.clave)).toEqual(['a:nueva']);
  });

  it('avisa si dos personas que siguen en el centro tienen apuntado el mismo correo', () => {
    const r = cruzar({
      cuentas: [cuenta({ id: 'g1', email: 'ana@cole.test' })],
      rutas: RUTAS,
      alumnos: [alumno({ id: 'a1', emailGoogle: 'ana@cole.test' }), alumno({ id: 'a2', emailGoogle: 'ana@cole.test' })],
      profes: [],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    const segunda = r.filas.find((f) => f.cuenta === null)!;
    expect(segunda.avisos.join(' ')).toMatch(/otra persona/);
  });

  it('clasifica las cuentas que no son de nadie, y la marcada o la de un administrador se dejan', () => {
    const r = cruzar({
      cuentas: [
        cuenta({ id: 'g1', email: 'exalumno@cole.test', uo: '/Alumnos/Alumnos Primaria/1ºA' }),
        cuenta({ id: 'g2', email: 'exprofe@cole.test', uo: '/Profesores/Primaria' }),
        cuenta({ id: 'g3', email: 'secretaria@cole.test', uo: '/' }),
        cuenta({ id: 'g4', email: 'conserje@cole.test', uo: '/PAS' }),
        cuenta({ id: 'g5', email: 'jefa@cole.test', uo: '/', admin: true }),
        cuenta({ id: 'g6', email: 'vieja@cole.test', uo: '/Alumnos/Alumnos Primaria/1ºB', suspendida: true }),
        cuenta({ id: 'g7', email: 'promo@cole.test', uo: '/Alumnos/Alumnos Secundaria/4 ESO acabado 2023-2024', suspendida: true }),
      ],
      rutas: RUTAS,
      alumnos: [],
      profes: [],
      marcas: [{ googleId: 'g3', tipo: 'centro', nota: null, por: 'tic@cole.test', at: '2026-10-01T00:00:00Z' }],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    const f = (id: string) => r.filas.find((x) => x.clave === `g:${id}`)!;
    expect(f('g1')).toMatchObject({ estado: 'suelta', zona: 'alumnado', uoDestino: '/Alumnos/Alumnos Secundaria/Ex-alumnos' });
    expect(f('g2')).toMatchObject({ estado: 'suelta', zona: 'profesorado' });
    expect(f('g3')).toMatchObject({ estado: 'marcada', zona: 'otras' });
    expect(f('g4')).toMatchObject({ estado: 'suelta', zona: 'otras' });
    expect(f('g5').estado).toBe('marcada');
    expect(f('g6').estado).toBe('archivar');
    expect(f('g7').estado).toBe('archivada');
    expect(r.resumen.sueltas).toEqual({ alumnado: 1, profesorado: 1, otras: 1 });
    expect(r.resumen.archivar).toBe(1);
  });

  it('a quien no tiene correo le enseña las cuentas que se le parecen, también suspendidas', () => {
    const r = cruzar({
      cuentas: [
        cuenta({ id: 'g1', email: 'anaplazaroca@cole.test', nombre: 'Ana', apellidos: 'Plaza Roca', suspendida: true }),
        cuenta({ id: 'g2', email: 'otra@cole.test', nombre: 'Marta', apellidos: 'Gil' }),
      ],
      rutas: RUTAS,
      alumnos: [alumno({ id: 'a1' })],
      profes: [],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    const a = r.filas.find((f) => f.clave === 'a:a1')!;
    expect(a.parecidas.map((p) => p.clave)).toEqual(['g:g1']);
    expect(r.filas.find((f) => f.clave === 'g:g1')!.parecidas.map((p) => p.clave)).toEqual(['a:a1']);
    expect(r.resumen.parecidas).toBe(1);
  });

  it('si el correo apuntado en Educamos no existe en Google, lo propone y avisa', () => {
    const r = cruzar({
      cuentas: [],
      rutas: RUTAS,
      alumnos: [alumno({ id: 'a1', emailGoogle: 'anaplazar@cole.test' })],
      profes: [profe({ id: 'p1', email: 'luismora@cole.test' })],
      marcas: [],
      ajustes: ajustes(),
      dominio: DOM,
      hoy: HOY,
    });
    const a = r.filas.find((f) => f.clave === 'a:a1')!;
    expect(a.propuesta).toBe('anaplazar@cole.test');
    expect(a.avisos[0]).toMatch(/no existe en Google/);
    const p = r.filas.find((f) => f.clave === 'p:p1')!;
    expect(p).toMatchObject({ estado: 'sin-correo', propuesta: 'luismora@cole.test', uoDestino: '/Profesores/Primaria' });
  });
});

describe('contraseñas', () => {
  it('cuatro sílabas y dos cifras, que se puedan dictar', () => {
    let i = 0;
    const fijo = (n: number) => i++ % n;
    const c = generarContrasena(fijo);
    expect(c).toMatch(/^[A-Z][a-z]{7}\d{2}$/);
    for (let k = 0; k < 50; k++) expect(generarContrasena()).toMatch(/^[BCDFGHJKMNPRSTVZ][aeiu]([bcdfghjkmnprstvz][aeiu]){3}[1-9]\d$/);
  });
});

describe('grupos', () => {
  const datos: DatosGrupos = {
    profes: [
      { nombre: 'Luis Mora', email: 'luis@cole.test', etapas: ['EP'] },
      { nombre: 'Rosa Gil', email: 'rosa@cole.test', etapas: ['ESO'] },
      { nombre: 'Nuevo Sincorreo', email: null, etapas: ['EP'] },
    ],
    tutores: [{ nombre: 'Luis Mora', email: 'luis@cole.test', curso: '1PRI', letra: 'A' }],
    alumnos: [
      { nombre: 'Ana Plaza', email: 'ana@cole.test', curso: '1PRI', letra: 'A' },
      { nombre: 'Eva Roca', email: 'eva@cole.test', curso: '1PRI', letra: 'B' },
    ],
    cuentas: [
      cuenta({ id: 'u-pas', email: 'conserje@cole.test', uo: '/PAS' }),
      cuenta({ id: 'u-pas2', email: 'vieja@cole.test', uo: '/PAS', suspendida: true }),
    ],
  };

  it('describe las fuentes como se leen', () => {
    expect(describirFuente({ tipo: 'profes', etapa: null })).toBe('Todo el claustro');
    expect(describirFuente({ tipo: 'profes', etapa: 'EP' })).toBe('Profesorado de Primaria');
    expect(describirFuente({ tipo: 'alumnos', etapa: null, curso: null, clase: '1PRI|A' })).toBe('Alumnado de 1PRI A');
    expect(describirFuente({ tipo: 'uo', ruta: '/PAS' })).toBe('Cuentas de PAS');
  });

  it('resuelve las reglas sin repetir y dice quién se queda fuera por no tener correo', () => {
    const reglas: ReglasGrupo = {
      fuentes: [
        { tipo: 'profes', etapa: 'EP' },
        { tipo: 'tutores', etapa: null },
        { tipo: 'uo', ruta: '/PAS' },
      ],
      extra: ['Externo@Gmail.com'],
      excluidos: ['conserje@cole.test'],
      modo: 'exacto',
    };
    const d = miembrosDeseados(reglas, datos);
    expect(d.miembros.map((m) => m.email)).toEqual(['luis@cole.test', 'externo@gmail.com']);
    expect(d.miembros[0].motivo).toBe('Profesorado de Primaria');
    expect(d.sinCorreo).toEqual([{ nombre: 'Nuevo Sincorreo', motivo: 'Profesorado de Primaria' }]);
  });

  it('filtra el alumnado por clase', () => {
    const d = miembrosDeseados(
      { fuentes: [{ tipo: 'alumnos', etapa: null, curso: null, clase: '1PRI|B' }], extra: [], excluidos: [], modo: 'exacto' },
      datos,
    );
    expect(d.miembros.map((m) => m.email)).toEqual(['eva@cole.test']);
  });

  const deseados = { miembros: [{ email: 'luis@cole.test', nombre: 'Luis', motivo: 'x' }, { email: 'rosa@cole.test', nombre: 'Rosa', motivo: 'x' }], sinCorreo: [] };
  const idPorCorreo = new Map([
    ['luis@cole.test', 'id-luis'],
    ['luis.mora@cole.test', 'id-luis'],
    ['rosa@cole.test', 'id-rosa'],
  ]);

  it('añade lo que falta, quita lo que sobra y no toca a propietarios ni gestores', () => {
    const actuales: MiembroActual[] = [
      { id: 'id-luis', email: 'luis.mora@cole.test', rol: 'MEMBER', tipo: 'USER' },
      { id: 'id-viejo', email: 'viejo@cole.test', rol: 'MEMBER', tipo: 'USER' },
      { id: 'id-jefa', email: 'jefa@cole.test', rol: 'OWNER', tipo: 'USER' },
      { id: 'id-dominio', email: null, rol: 'MEMBER', tipo: 'CUSTOMER' },
    ];
    const plan = planGrupo(deseados, actuales, 'exacto', idPorCorreo);
    // Luis está con su alias: casa por el id y no entra ni sale.
    expect(plan.anadir.map((m) => m.email)).toEqual(['rosa@cole.test']);
    expect(plan.quitar.map((m) => m.email)).toEqual(['viejo@cole.test']);
    expect(plan.gestores).toBe(1);
    expect(plan.siguen).toBe(1);
    expect(plan.muchasBajas).toBe(false);
  });

  it('en «solo añadir» no quita a nadie', () => {
    const plan = planGrupo(deseados, [{ id: 'id-viejo', email: 'viejo@cole.test', rol: 'MEMBER', tipo: 'USER' }], 'solo-anadir', idPorCorreo);
    expect(plan.quitar).toEqual([]);
    expect(plan.anadir).toHaveLength(2);
  });

  it('si las reglas no dan a nadie, no vacía el grupo', () => {
    const plan = planGrupo({ miembros: [], sinCorreo: [] }, [{ id: 'x', email: 'x@cole.test', rol: 'MEMBER', tipo: 'USER' }], 'exacto', idPorCorreo);
    expect(plan.quitar).toEqual([]);
    expect(plan.avisos[0]).toMatch(/no se quita a nadie/);
  });

  it('pide confirmación cuando las bajas son muchas', () => {
    const actuales: MiembroActual[] = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, email: `v${i}@cole.test`, rol: 'MEMBER', tipo: 'USER' }));
    expect(planGrupo(deseados, actuales, 'exacto', idPorCorreo).muchasBajas).toBe(true);
  });

  it('el enlace del grupo en Google Groups', () => {
    expect(enlaceGrupo('claustro@cole.test')).toBe('https://groups.google.com/a/cole.test/g/claustro');
  });
});
