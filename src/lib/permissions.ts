// Quién entra a qué. Dos capas, a propósito:
//
//   1. El ROL es el punto de partida de un clic: "eres tutor" → salidas y banco de
//      libros. Vive en código porque cambiarlo es cambiar una línea y afecta a todos.
//   2. Los AJUSTES POR PERSONA son la excepción: "este tutor además lleva las
//      evaluaciones". Viven en `auth_users` y se guardan como DIFERENCIA respecto al
//      rol (extra / bloqueados), no como lista cerrada. Así, si mañana se le añade un
//      módulo al rol tutor, les llega a todos los tutores menos a quien lo tuviera
//      bloqueado explícitamente — que es lo que uno espera.

export const MODULES = [
  'abc',
  'licencias',
  'salidas',
  'bancolibros',
  'evaluaciones',
  'puntualidad',
  'horarios',
  'horarios-profes',
  'mi-horario',
  'educamos',
  'alumnado',
  'numeros',
  'cuaderno',
  'usuarios',
  'profes',
  'autoasm',
  'tareas',
  'tareas-reportar',
  'comunicacion',
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  abc: 'Registro ABC',
  licencias: 'Licencias',
  salidas: 'Salidas y pagos',
  bancolibros: 'Banco de libros',
  evaluaciones: 'Evaluaciones',
  puntualidad: 'Puntualidad',
  horarios: 'Horarios de clase',
  'horarios-profes': 'Horarios del profesorado',
  'mi-horario': 'Mi horario',
  educamos: 'BBDD central',
  alumnado: 'Alumnado',
  numeros: 'Números del cole',
  cuaderno: 'Cuaderno de tutor',
  usuarios: 'Usuarios y roles',
  profes: 'Tutorías',
  autoasm: 'AUTOASM (Apple School Manager)',
  tareas: 'Tareas de la plataforma',
  'tareas-reportar': 'Reportar fallitos',
  comunicacion: 'Comunicación (protección de datos de todo el centro)',
};

/**
 * Módulos que conviene pensárselo dos veces antes de dar a dedo: `usuarios` permite
 * repartir permisos (incluidos los propios) y `educamos` toca la BBDD de alumnado y
 * familias entera. La interfaz los marca; no están prohibidos.
 */
export const MODULOS_SENSIBLES: readonly Module[] = ['usuarios', 'educamos'];

export const ROLES = [
  'profe',
  'tutor',
  'jefe',
  'direccion',
  'tic',
  'orientacion',
  'secretaria',
  'evaluaciones',
  'comunicacion',
  'supertic',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  profe: 'Profe',
  tutor: 'Tutor/a',
  jefe: 'Jefatura/Coord.',
  direccion: 'Dirección',
  tic: 'TIC',
  orientacion: 'Orientación',
  secretaria: 'Secretaría',
  evaluaciones: 'Evaluaciones',
  comunicacion: 'Comunicación',
  supertic: 'SuperTIC',
};

export const ROLE_MODULES: Record<Role, readonly Module[]> = {
  supertic: [...MODULES],
  tic: [...MODULES],
  direccion: [
    'abc',
    'licencias',
    'salidas',
    'bancolibros',
    'evaluaciones',
    'puntualidad',
    'horarios',
    'horarios-profes',
    'mi-horario',
    'educamos',
    'alumnado',
    'numeros',
    'cuaderno',
    'profes',
    'autoasm',
    'tareas-reportar',
  ],
  jefe: ['salidas', 'bancolibros', 'puntualidad', 'horarios', 'horarios-profes', 'mi-horario', 'profes', 'autoasm', 'alumnado', 'numeros'],
  orientacion: ['abc', 'puntualidad', 'horarios', 'horarios-profes', 'mi-horario', 'alumnado', 'numeros', 'tareas-reportar'],
  // Secretaría tiene acceso a TODO, como TIC (David, 23-sep-2026: «son los DIOSES»)…
  // menos al tablero de tareas de la plataforma, que es cosa de TIC: secretaría apunta
  // fallitos, no los gestiona (David, 24-sep-2026).
  secretaria: MODULES.filter((m) => m !== 'tareas'),
  // Tutor y profe entran en Alumnado, pero solo ven SU ETAPA (entrando en su tutoría si la
  // tienen): `alcanceAlumnado` en alumnado-server.ts. Profe, desde el 28-sep-2026 (David).
  // Números del cole, con el mismo alcance, solo el tutor (docs/24-numeros.md).
  tutor: ['salidas', 'bancolibros', 'puntualidad', 'horarios', 'mi-horario', 'alumnado', 'numeros'],
  profe: ['salidas', 'bancolibros', 'horarios', 'mi-horario', 'alumnado'],
  // Rol "de una sola cosa": quien lleva las evaluaciones sin tener por qué ver
  // pedidos ni la BBDD central. Para alguien que ADEMÁS es tutor, mejor dejarle
  // 'tutor' y darle 'evaluaciones' como módulo extra.
  evaluaciones: ['evaluaciones', 'mi-horario'],
  // Comunicación publica fotos y vídeos de todo el centro: ve la ficha y la protección de
  // datos de TODAS las etapas (David, 28-sep-2026). A quien además es tutor/profe se le deja
  // su rol y se le da el módulo `comunicacion` como extra: el efecto es el mismo.
  comunicacion: ['alumnado', 'comunicacion', 'horarios', 'mi-horario', 'tareas-reportar'],
};
// Nota: el FORMULARIO del ABC lo puede enviar cualquier persona autenticada del claustro
// (basta sesión); el módulo 'abc' de esta matriz es su panel de gestión.

/** Lo que hace falta saber de alguien para decidir si entra. */
export interface Acceso {
  role: Role | null;
  modulosExtra?: readonly string[] | null;
  modulosBloqueados?: readonly string[] | null;
}

function esModulo(m: string): m is Module {
  return (MODULES as readonly string[]).includes(m);
}

/** Módulos efectivos de alguien: los de su rol, más los extra, menos los bloqueados. */
export function modulosDe(acceso: Acceso | null | undefined): Module[] {
  if (!acceso?.role) return [];
  const base = new Set<Module>(ROLE_MODULES[acceso.role] ?? []);
  for (const m of acceso.modulosExtra ?? []) if (esModulo(m)) base.add(m);
  for (const m of acceso.modulosBloqueados ?? []) if (esModulo(m)) base.delete(m);
  // Se devuelve en el orden de MODULES, no en el de inserción: la interfaz los
  // pinta siempre igual sin tener que ordenar en cada sitio.
  return MODULES.filter((m) => base.has(m));
}

export function canAccess(acceso: Acceso | null | undefined, modulo: Module): boolean {
  if (!acceso?.role) return false;
  const bloqueados = acceso.modulosBloqueados ?? [];
  if (bloqueados.includes(modulo)) return false;
  if ((acceso.modulosExtra ?? []).includes(modulo)) return true;
  return ROLE_MODULES[acceso.role]?.includes(modulo) ?? false;
}

/** ¿Este módulo le viene del rol, se lo han dado a mano, o se lo han quitado a mano? */
export type OrigenModulo = 'rol' | 'extra' | 'bloqueado' | 'no';

export function origenModulo(acceso: Acceso | null | undefined, modulo: Module): OrigenModulo {
  if (!acceso?.role) return 'no';
  const delRol = ROLE_MODULES[acceso.role]?.includes(modulo) ?? false;
  if ((acceso.modulosBloqueados ?? []).includes(modulo)) return delRol ? 'bloqueado' : 'no';
  if ((acceso.modulosExtra ?? []).includes(modulo)) return delRol ? 'rol' : 'extra';
  return delRol ? 'rol' : 'no';
}

/**
 * Traduce "quiero que esta persona tenga exactamente estos módulos" a la diferencia
 * que se guarda. La interfaz marca casillas y no tiene que saber nada de esto.
 */
export function diffModulos(
  role: Role | null,
  seleccionados: readonly Module[],
): { modulosExtra: Module[]; modulosBloqueados: Module[] } {
  const base = new Set<Module>(role ? (ROLE_MODULES[role] ?? []) : []);
  const quiere = new Set(seleccionados);
  return {
    modulosExtra: MODULES.filter((m) => quiere.has(m) && !base.has(m)),
    modulosBloqueados: MODULES.filter((m) => !quiere.has(m) && base.has(m)),
  };
}

/**
 * Dentro del módulo `bancolibros`, dos cosas quedan reservadas a dirección/TIC (no a
 * tutores, de momento): marcar quién participa en el banco/AMPA, y configurar a mano el
 * catálogo de libros por curso. El resto del módulo (lotes, checks, pasar lista) lo sigue
 * llevando cualquier rol con acceso al módulo, sin cambios.
 */
export function puedeGestionarParticipantesBanco(role: Role | null): boolean {
  return role === 'direccion' || role === 'secretaria' || role === 'tic' || role === 'supertic';
}

/**
 * Dentro del módulo `puntualidad`, quién ve TODO el centro y quién solo lo suyo.
 * Dirección, jefatura, orientación y TIC ven todos los retrasos; un tutor con el módulo
 * ve únicamente el alumnado de las clases que tutoriza (se filtra contra `edu_tutorias`
 * del curso académico en vigor). Registrar, en cambio, lo puede hacer cualquier persona
 * del claustro con sesión: basta `requireSession()`, como el formulario del ABC.
 */
export function vePuntualidadCompleta(role: Role | null): boolean {
  return role === 'direccion' || role === 'jefe' || role === 'orientacion' || role === 'secretaria' || role === 'tic' || role === 'supertic';
}

/**
 * Dentro del módulo `alumnado`, ¿quién ve la **protección de datos** (imagen y voz, redes,
 * AMPA y ONG) de todo el centro? Quien lleva el centro y quien tenga el módulo
 * `comunicacion` (rol o extra). El resto (tutor, profe) la ve de su etapa, igual que la
 * ficha (David, 28-sep-2026; antes era solo la de su tutoría).
 */
export function veProteccionDatosCompleta(acceso: Acceso | null | undefined): boolean {
  if (canAccess(acceso, 'comunicacion')) return true;
  const role = acceso?.role ?? null;
  return (
    role === 'direccion' ||
    role === 'jefe' ||
    role === 'orientacion' ||
    role === 'secretaria' ||
    role === 'tic' ||
    role === 'supertic'
  );
}

/**
 * Y EDITARLA es todavía más estrecho: los papeles firmados los guarda secretaría, y
 * dirección/TIC arreglan lo que haga falta. Un tutor la ve (la suya) pero no la toca: si
 * cada uno pudiera cambiarla desde la ficha, el dato dejaría de significar «lo que hay
 * firmado» para significar «lo que le pareció a alguien».
 */
export function puedeEditarProteccionDatos(role: Role | null): boolean {
  return role === 'direccion' || role === 'secretaria' || role === 'tic' || role === 'supertic';
}

/**
 * Venta de materiales (dentro de `alumnado`): crear materiales —cada uno es una columna— y
 * marcar quién ha pagado es cosa de secretaría, dirección y TIC (David, 23-sep-2026). El
 * resto de quien entra en Alumnado lo ve, dentro de su alcance, sin lápiz.
 */
export function puedeGestionarMateriales(role: Role | null): boolean {
  return role === 'direccion' || role === 'secretaria' || role === 'tic' || role === 'supertic';
}

/**
 * «Becado» es un dato económico de la familia: lo ven dirección, secretaría, orientación y
 * TIC. Para el resto del claustro un becado sale como «pagado» —lo que le importa a un tutor
 * es que el alumno tiene su material—, y ese cambio se hace en el servidor.
 */
export function veBecasMateriales(role: Role | null): boolean {
  return (
    role === 'direccion' || role === 'secretaria' || role === 'orientacion' || role === 'tic' || role === 'supertic'
  );
}

/**
 * Números del cole: la pestaña «Perfil del alumnado» (edad, repetición por año de
 * nacimiento, nacionalidad, de dónde vienen, familia numerosa…) es información de gestión,
 * no de aula: equipo directivo, orientación, secretaría y TIC. Un tutor ve su etapa en el
 * resto de pestañas, pero esta no (docs/24-numeros.md).
 */
export function vePerfilAlumnado(role: Role | null): boolean {
  return (
    role === 'direccion' ||
    role === 'jefe' ||
    role === 'orientacion' ||
    role === 'secretaria' ||
    role === 'tic' ||
    role === 'supertic'
  );
}

/**
 * Números del cole: guardar una foto a mano en el histórico (además de la del día 1 de cada
 * mes, que es automática). Secretaría, dirección y TIC, los mismos que llevan los datos.
 */
export function puedeHacerFotosNumeros(role: Role | null): boolean {
  return role === 'direccion' || role === 'secretaria' || role === 'tic' || role === 'supertic';
}

/**
 * Los horarios van en DOS módulos a propósito, no en uno:
 *
 *   - `horarios`         → ver el horario de las CLASES. Abierto a todo el claustro: un
 *                          profe tiene que poder mirar qué tiene 2ESO B a 3ª.
 *   - `horarios-profes`  → ver el horario de un PROFESOR concreto. Va aparte para poder
 *                          quitárselo a alguien sin quitarle lo anterior (decisión de
 *                          David: el horario de los demás invita al "a mí me has puesto…").
 *
 * Y encima, quién puede EDITAR (rejillas, importar, tocar asignaciones) es cuestión de rol,
 * como `vePuntualidadCompleta()`: tener el módulo da vista, no lápiz.
 */
export function puedeEditarHorarios(role: Role | null): boolean {
  return role === 'direccion' || role === 'jefe' || role === 'secretaria' || role === 'tic' || role === 'supertic';
}

export const DOMINIO_LOGIN = 'consolacionburriana.com';
