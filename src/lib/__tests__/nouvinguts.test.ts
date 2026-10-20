import { describe, expect, it } from 'vitest';
import { correoAlta, correoNota, correoParteTerminada } from '@/lib/nouvinguts-email';
import {
  AJUSTES_POR_DEFECTO,
  correosSueltos,
  eventosDeCambio,
  notaSchema,
  altaSchema,
  aplicaDesde,
  claveNombre,
  cursosOfrecidos,
  diasDesde,
  emparejarAltas,
  esInicioDeCurso,
  estadoPaso,
  leerAjustesNouvinguts,
  PASOS,
  pasosDeNouvingut,
  procesoEfectivo,
  procesoSchema,
  resumenPasos,
  CLAVES_PASO,
  type DatosNouvingut,
  type PasoProceso,
} from '@/lib/nouvinguts';

// Datos inventados: una alumna de 2º ESO recién vinculada, con todo por hacer.
function datos(extra: Partial<DatosNouvingut> = {}): DatosNouvingut {
  return {
    vinculado: true,
    activo: true,
    avisoVinculo: null,
    curso: '2ESO',
    matricula: null,
    proteccion: { actualizadoAt: null, imagen: true, redes: true, ampa: true, ong: true },
    desestimaCorreo: false,
    bancoLibros: true,
    ampa: false,
    emailGoogle: null,
    materiales: [{ id: 'm1', nombre: 'Agenda', estado: null }],
    asmSubidaAt: null,
    dispositivo: null,
    licencias: { campania: 'Licencias 2026-27', enCampania: true, pedidoAt: null, noPedira: false },
    marcas: {},
    ...extra,
  };
}

const proceso = procesoEfectivo([]);
const paso = (clave: string): PasoProceso => proceso.find((p) => p.clave === clave)!;

describe('procesoEfectivo', () => {
  it('sin ajustes es el orden y los valores de PASOS', () => {
    expect(proceso.map((p) => p.clave)).toEqual(PASOS.map((p) => p.clave));
    expect(proceso.every((p) => p.activo)).toBe(true);
  });

  it('aplica orden, responsable, desde y activo, e ignora claves que no existen', () => {
    const p = procesoEfectivo([
      { clave: 'foto', orden: -1, activo: true, responsable: 'tic', desdeCurso: null },
      { clave: 'ipad', orden: 50, activo: false, responsable: 'tic', desdeCurso: '1ESO' },
      { clave: 'no-existe', orden: 0, activo: true, responsable: 'tic', desdeCurso: null },
    ]);
    expect(p[0].clave).toBe('foto');
    expect(p[0].responsable).toBe('tic');
    expect(p[p.length - 1]).toMatchObject({ clave: 'ipad', activo: false, desde: '1ESO' });
    expect(p).toHaveLength(PASOS.length);
  });
});

describe('cursos', () => {
  it('ofrece infantil, primaria y ESO en orden', () => {
    const c = cursosOfrecidos().map((x) => x.codigo);
    expect(c[0]).toBe('3INF');
    expect(c).toContain('6PRI');
    expect(c.indexOf('6PRI')).toBeLessThan(c.indexOf('1ESO'));
  });

  it('«desde 6º EP» incluye 6º y la ESO (también el PDC) y deja fuera 5º', () => {
    expect(aplicaDesde('6PRI', '6PRI')).toBe(true);
    expect(aplicaDesde('2ESO', '6PRI')).toBe(true);
    expect(aplicaDesde('3ºPPDC', '1ESO')).toBe(true);
    expect(aplicaDesde('5PRI', '6PRI')).toBe(false);
    expect(aplicaDesde(null, '6PRI')).toBe(false);
    expect(aplicaDesde(null, null)).toBe(true);
  });

  it('solo los 3 años de junio a septiembre son de inicio de curso', () => {
    expect(esInicioDeCurso('3INF', '2026-09-02')).toBe(true);
    expect(esInicioDeCurso('3INF', '2026-06-20')).toBe(true);
    expect(esInicioDeCurso('3INF', '2026-11-03')).toBe(false);
    expect(esInicioDeCurso('4INF', '2026-09-02')).toBe(false);
    expect(esInicioDeCurso('1PRI', '2026-09-02')).toBe(false);
  });
});

describe('estadoPaso', () => {
  it('nº de matrícula: aviso si Educamos no lo trae, hecho si lo hay', () => {
    expect(estadoPaso(paso('matricula'), datos())).toEqual({ estado: 'aviso', texto: 'NO ESTÁ EN EDUCAMOS el número de matrícula' });
    expect(estadoPaso(paso('matricula'), datos({ matricula: ' 2026/0412 ' })).estado).toBe('hecho');
  });

  it('sin vincular, lo que depende de Educamos espera y lo manual se puede marcar', () => {
    const d = datos({ vinculado: false, curso: '6PRI', proteccion: null });
    expect(estadoPaso(paso('educamos'), d).estado).toBe('pendiente');
    expect(estadoPaso(paso('matricula'), d).texto).toBe('Cuando esté en Educamos');
    expect(estadoPaso(paso('claves'), { ...d, marcas: { claves: { valor: 'hecho', porNombre: 'Mª José', at: '2026-10-07T09:00:00Z' } } })).toEqual({
      estado: 'hecho',
      texto: 'Entregadas el 07/10 · Mª José',
    });
    expect(estadoPaso(paso('educamos'), { ...d, avisoVinculo: 'Varias altas se le parecen' }).estado).toBe('aviso');
  });

  it('protección de datos: hecha solo cuando alguien la ha guardado', () => {
    expect(estadoPaso(paso('proteccion'), datos()).estado).toBe('pendiente');
    const hecha = datos({ proteccion: { actualizadoAt: '2026-10-09T10:00:00Z', imagen: true, redes: false, ampa: true, ong: null } });
    expect(estadoPaso(paso('proteccion'), hecha)).toEqual({ estado: 'hecho', texto: 'Imagen sí · Redes no · AMPA sí · ONG ¿?' });
  });

  it('banco: no le toca antes de 3º EP; un «no» decidido también es hecho', () => {
    expect(estadoPaso(paso('banco'), datos({ curso: '1PRI' })).estado).toBe('no_aplica');
    expect(estadoPaso(paso('banco'), datos()).estado).toBe('pendiente');
    const decidido = datos({ bancoLibros: false, marcas: { banco: { valor: 'decidido', porNombre: null, at: '2026-10-10T00:00:00Z' } } });
    expect(estadoPaso(paso('banco'), decidido)).toEqual({ estado: 'hecho', texto: 'No entra en el banco' });
  });

  it('materiales: hecho cuando todos tienen estado; sin materiales no le toca', () => {
    expect(estadoPaso(paso('materiales'), datos()).estado).toBe('pendiente');
    expect(estadoPaso(paso('materiales'), datos({ materiales: [] })).estado).toBe('no_aplica');
    const pagados = datos({ materiales: [{ id: 'm1', nombre: 'Agenda', estado: 'pagado' }, { id: 'm2', nombre: 'Bata', estado: 'no' }] });
    expect(estadoPaso(paso('materiales'), pagados)).toEqual({ estado: 'hecho', texto: 'Agenda: pagado · Bata: no' });
  });

  it('correo: no le toca si la familia lo desestima', () => {
    const d = datos({ desestimaCorreo: true });
    expect(estadoPaso(paso('correo'), d).estado).toBe('no_aplica');
    expect(estadoPaso(paso('vinculo_correo'), d).estado).toBe('no_aplica');
    expect(estadoPaso(paso('correo'), datos({ emailGoogle: 'ana@cole.test' })).estado).toBe('hecho');
  });

  it('iPad, ASM y licencias van desde 6º EP', () => {
    const cuarto = datos({ curso: '4PRI' });
    for (const c of ['ipad', 'asm', 'licencias']) expect(estadoPaso(paso(c), cuarto).estado).toBe('no_aplica');
  });

  it('iPad: lo dice Dispositivos 1:1; la marca a mano sigue valiendo para quien no tenga el módulo', () => {
    expect(estadoPaso(paso('ipad'), datos())).toEqual({ estado: 'pendiente', texto: 'Sin informar en Dispositivos 1:1' });
    expect(estadoPaso(paso('ipad'), datos({ vinculado: false })).texto).toBe('Cuando esté en Educamos');
    const prestado = { modalidad: 'prestado', texto: 'Prestado S3 · en el cole', cursoCompra: null, aCasa: false };
    expect(estadoPaso(paso('ipad'), datos({ dispositivo: prestado }))).toEqual({ estado: 'hecho', texto: 'Prestado S3 · en el cole' });
    const marca = { valor: 'hecho', porNombre: 'Ana', at: '2026-10-20T09:00:00Z' };
    expect(estadoPaso(paso('ipad'), datos({ marcas: { ipad: marca } })).estado).toBe('hecho');
  });

  it('ASM: aviso si no ha habido subida desde su alta', () => {
    expect(estadoPaso(paso('asm'), datos()).estado).toBe('aviso');
    expect(estadoPaso(paso('asm'), datos({ asmSubidaAt: '2026-10-21T08:00:00Z' })).texto).toBe('En la subida a ASM del 21/10');
  });

  it('licencias: pedido, «no pedirá», fuera de campaña y sin campaña', () => {
    const l = (x: Partial<DatosNouvingut['licencias']>) => datos({ licencias: { ...datos().licencias, ...x } });
    expect(estadoPaso(paso('licencias'), l({ pedidoAt: '2026-10-14T00:00:00Z' })).estado).toBe('hecho');
    expect(estadoPaso(paso('licencias'), l({ noPedira: true })).texto).toBe('No pedirá licencias');
    expect(estadoPaso(paso('licencias'), l({ enCampania: false })).estado).toBe('aviso');
    expect(estadoPaso(paso('licencias'), l({ campania: null })).estado).toBe('pendiente');
    expect(estadoPaso(paso('licencias'), l({})).texto).toBe('Sin pedido en «Licencias 2026-27»');
  });
});

describe('resumenPasos', () => {
  it('cuenta lo que le toca, reparte lo pendiente y dice el siguiente', () => {
    const pasos = pasosDeNouvingut(proceso, datos({ curso: '4PRI', matricula: '1' }));
    const r = resumenPasos(pasos);
    expect(r.total).toBe(pasos.filter((p) => p.estado !== 'no_aplica').length);
    expect(r.hechos).toBe(2); // Educamos y matrícula
    expect(r.siguiente?.clave).toBe('claves');
    expect(r.listo).toBe(false);
    expect(r.pendientes.secretaria + r.pendientes.tic).toBe(r.total - r.hechos);
  });

  it('un paso desactivado en el proceso no cuenta', () => {
    const sinFoto = procesoEfectivo([{ clave: 'foto', orden: 7, activo: false, responsable: 'secretaria', desdeCurso: null }]);
    expect(pasosDeNouvingut(sinFoto, datos()).some((p) => p.clave === 'foto')).toBe(false);
  });
});

describe('emparejarAltas', () => {
  const alta = (id: string, nombre: string, a1: string, a2: string, curso = '6PRI') => ({ id, nombre, apellido1: a1, apellido2: a2, curso });

  it('vincula una coincidencia única sin mirar acentos ni mayúsculas', () => {
    const r = emparejarAltas(
      [{ id: 'ap1', nombre: 'MARTA', apellidos: 'LLORENS  GIMENEZ', curso: '6PRI' }],
      [alta('e1', 'Marta', 'Llorens', 'Giménez'), alta('e2', 'Hugo', 'Safont', 'Ribes')],
    );
    expect(r).toEqual({ vinculos: [{ apuntadoId: 'ap1', altaId: 'e1' }], dudosos: [] });
  });

  it('dos altas iguales: desempata el curso; si no desempata, es dudoso', () => {
    const altas = [alta('e1', 'Marta', 'Llorens', 'Gimeno', '6PRI'), alta('e2', 'Marta', 'Llorens', 'Gimeno', '3PRI')];
    expect(emparejarAltas([{ id: 'ap1', nombre: 'MARTA', apellidos: 'LLORENS GIMENO', curso: '3PRI' }], altas).vinculos).toEqual([
      { apuntadoId: 'ap1', altaId: 'e2' },
    ]);
    const dudoso = emparejarAltas([{ id: 'ap1', nombre: 'MARTA', apellidos: 'LLORENS GIMENO', curso: '1ESO' }], altas);
    expect(dudoso.vinculos).toEqual([]);
    expect(dudoso.dudosos).toEqual([{ apuntadoId: 'ap1', candidatos: ['e1', 'e2'] }]);
  });

  it('dos apuntados con el mismo nombre no se quedan la misma alta', () => {
    const r = emparejarAltas(
      [
        { id: 'ap1', nombre: 'LEO', apellidos: 'RUIZ', curso: null },
        { id: 'ap2', nombre: 'LEO', apellidos: 'RUIZ', curso: null },
      ],
      [alta('e1', 'Leo', 'Ruiz', '')],
    );
    expect(r.vinculos).toEqual([]);
    expect(r.dudosos.map((d) => d.apuntadoId)).toEqual(['ap1', 'ap2']);
  });

  it('sin parecido no hay nada', () => {
    expect(emparejarAltas([{ id: 'ap1', nombre: 'ANA', apellidos: 'PEREZ', curso: null }], [alta('e1', 'Hugo', 'Safont', 'Ribes')])).toEqual({
      vinculos: [],
      dudosos: [],
    });
  });

  it('claveNombre normaliza acentos, espacios y signos', () => {
    expect(claveNombre(' José-María ', 'Gil  Ortí')).toBe('JOSE MARIA GIL ORTI');
  });
});

describe('validación y ajustes', () => {
  it('el alta pasa nombre y apellidos a mayúsculas y exige un curso ofrecido', () => {
    const ok = altaSchema.parse({ nombre: ' marta ', apellidos: 'llorens   gimeno', curso: '6PRI', fechaMatricula: '2026-10-19' });
    expect(ok).toMatchObject({ nombre: 'MARTA', apellidos: 'LLORENS GIMENO' });
    expect(altaSchema.safeParse({ nombre: 'A', apellidos: 'B', curso: '9PRI', fechaMatricula: '2026-10-19' }).success).toBe(false);
  });

  it('el proceso tiene que traer todos los pasos una vez', () => {
    const pasos = CLAVES_PASO.map((clave) => ({ clave, activo: true, responsable: 'tic' as const, desdeCurso: null }));
    const avisos = AJUSTES_POR_DEFECTO.avisos;
    expect(procesoSchema.safeParse({ pasos, diasAtasco: 10, avisos }).success).toBe(true);
    expect(procesoSchema.safeParse({ pasos: [...pasos.slice(1), pasos[1]], diasAtasco: 10, avisos }).success).toBe(false);
    expect(procesoSchema.safeParse({ pasos, diasAtasco: 10, avisos: { ...avisos, alta: ['jefe'] } }).success).toBe(false);
  });

  it('días y ajustes', () => {
    expect(diasDesde('2026-10-06', '2026-10-19')).toBe(13);
    expect(diasDesde('2026-10-20', '2026-10-19')).toBe(0);
    expect(leerAjustesNouvinguts(null)).toEqual(AJUSTES_POR_DEFECTO);
    expect(leerAjustesNouvinguts({ diasAtasco: 7 }).diasAtasco).toBe(7);
    expect(leerAjustesNouvinguts({ diasAtasco: 'x' }).diasAtasco).toBe(10);
  });
});

describe('avisos por correo', () => {
  const r = (secretaria: number, tic: number) => ({ listo: secretaria + tic === 0, pendientes: { secretaria, tic } });

  it('por defecto: altas a TIC, secretaría terminada a TIC, listo a secretaría', () => {
    expect(AJUSTES_POR_DEFECTO.avisos).toEqual({ alta: ['tic'], secretaria_terminada: ['tic'], tic_terminada: [], listo: ['secretaria'] });
  });

  it('lee los grupos guardados y descarta lo que no es un grupo', () => {
    const a = leerAjustesNouvinguts({ diasAtasco: 5, avisos: { alta: ['direccion', 'tic', 'jefe'], listo: [] } });
    expect(a.avisos.alta).toEqual(['direccion', 'tic']);
    expect(a.avisos.listo).toEqual([]);
    expect(a.avisos.secretaria_terminada).toEqual(['tic']); // sin guardar: el de por defecto
  });

  it('solo avisa en las transiciones', () => {
    expect(eventosDeCambio(r(1, 3), r(0, 3))).toEqual(['secretaria_terminada']);
    expect(eventosDeCambio(r(2, 1), r(2, 0))).toEqual(['tic_terminada']);
    expect(eventosDeCambio(r(0, 1), r(0, 0))).toEqual(['listo']);
    expect(eventosDeCambio(r(1, 1), r(0, 0))).toEqual(['listo']);
    expect(eventosDeCambio(r(0, 3), r(0, 2))).toEqual([]);
    expect(eventosDeCambio(r(0, 0), r(0, 0))).toEqual([]);
  });

  it('correos sueltos: solo del dominio y sin repetir', () => {
    expect(correosSueltos('A.Gil@cole.test, b@cole.test; a.gil@cole.test', 'cole.test')).toEqual({ validos: ['a.gil@cole.test', 'b@cole.test'], malos: [] });
    expect(correosSueltos('x@gmail.com nada', 'cole.test').malos).toEqual(['x@gmail.com', 'nada']);
  });

  it('una nota con correo tiene que llevar a alguien', () => {
    expect(notaSchema.safeParse({ paso: 'claves', texto: 'hola', correo: { grupos: [], otros: [] } }).success).toBe(false);
    expect(notaSchema.safeParse({ paso: null, texto: 'hola', correo: { grupos: ['tic'], otros: [] } }).success).toBe(true);
    expect(notaSchema.safeParse({ paso: null, texto: 'hola' }).success).toBe(true);
  });

  it('las plantillas escapan y dicen lo justo', () => {
    const a = { nombre: 'ANA <PÉREZ>', clase: '2º ESO B', url: 'https://x.test/n/1' };
    const uno = correoAlta([a], 'https://x.test/n');
    expect(uno.subject).toBe('Nouvingut: ANA <PÉREZ> (2º ESO B)');
    expect(uno.html).toContain('ANA &lt;PÉREZ&gt;');
    expect(correoAlta([a, { ...a, nombre: 'LEO' }], 'https://x.test/n').subject).toBe('2 alumnos nuevos en nouvinguts');
    const parte = correoParteTerminada(a, 'secretaria', [{ titulo: 'iPad' }]);
    expect(parte.subject).toContain('le toca a TIC');
    expect(parte.html).toContain('iPad');
    expect(correoNota(a, { texto: 'línea 1\nlínea 2', paso: 'Foto en Educamos', autor: 'Mª José' }).subject).toBe('Foto en Educamos · ANA <PÉREZ> (nouvinguts)');
  });
});
