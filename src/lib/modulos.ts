// La identidad de cada módulo en pantalla: su nombre en la cabecera, su icono y su grupo (el
// grupo da el color del icono, el mismo que en el escritorio). Puro, sin IO. Lo usan la
// cabecera común (`components/ui/cabecera-modulo.tsx`) y el escaparate de `/gestion/diseno`.
//
// Un módulo nuevo = una entrada aquí y otra en `lib/escritorio.ts` (con el mismo icono y el
// mismo grupo; lo comprueba `__tests__/modulos.test.ts`).
import type { Grupo, IconoHerramienta } from '@/lib/escritorio';

export type IconoModulo = IconoHerramienta | 'puntualidad' | 'diseno';

export interface IdentidadModulo {
  /** Como sale en la cabecera: corto, que quepa en el móvil. */
  titulo: string;
  icono: IconoModulo;
  grupo: Grupo;
  /** Su portada: adonde lleva tocar el nombre en la cabecera. */
  href: string;
}

export const MODULOS = {
  tableros: { titulo: 'Tableros', icono: 'tableros', grupo: 'dia', href: '/gestion/tableros' },
  'mi-horario': { titulo: 'Mi horario', icono: 'horario', grupo: 'dia', href: '/mi-horario' },
  alumnado: { titulo: 'Alumnado', icono: 'alumnado', grupo: 'alumnado', href: '/gestion/alumnado' },
  nouvinguts: { titulo: 'Nouvinguts', icono: 'nouvinguts', grupo: 'alumnado', href: '/gestion/nouvinguts' },
  numeros: { titulo: 'Números del cole', icono: 'numeros', grupo: 'alumnado', href: '/gestion/numeros' },
  cuaderno: { titulo: 'Cuaderno de tutor', icono: 'cuaderno', grupo: 'alumnado', href: '/gestion/cuaderno' },
  abc: { titulo: 'Registro ABC', icono: 'abc', grupo: 'alumnado', href: '/gestion/abc' },
  puntualidad: { titulo: 'Puntualidad', icono: 'puntualidad', grupo: 'alumnado', href: '/gestion/puntualidad' },
  licencias: { titulo: 'Licencias digitales', icono: 'licencias', grupo: 'familias', href: '/gestion/licencias' },
  bancolibros: { titulo: 'Banco de libros', icono: 'banco', grupo: 'familias', href: '/gestion/bancolibros' },
  salidas: { titulo: 'Salidas y pagos', icono: 'salidas', grupo: 'familias', href: '/gestion/salidas' },
  horarios: { titulo: 'Horarios', icono: 'horarios', grupo: 'centro', href: '/gestion/horarios' },
  oratorios: { titulo: 'Oratorios y talleres', icono: 'oratorios', grupo: 'centro', href: '/gestion/oratorios' },
  evaluaciones: { titulo: 'Evaluaciones', icono: 'evaluaciones', grupo: 'centro', href: '/gestion/evaluaciones' },
  profes: { titulo: 'Profesorado y tutorías', icono: 'profes', grupo: 'centro', href: '/gestion/profes' },
  dispositivos: { titulo: 'Dispositivos 1:1', icono: 'dispositivos', grupo: 'tic', href: '/gestion/dispositivos' },
  cuentas: { titulo: 'Correos y grupos', icono: 'cuentas', grupo: 'tic', href: '/gestion/cuentas' },
  calendarios: { titulo: 'Classrooms y calendarios', icono: 'calendarios', grupo: 'tic', href: '/gestion/calendarios' },
  autoasm: { titulo: 'AUTOASM', icono: 'autoasm', grupo: 'tic', href: '/gestion/autoasm' },
  usuarios: { titulo: 'Usuarios y roles', icono: 'usuarios', grupo: 'config', href: '/gestion/usuarios' },
  educamos: { titulo: 'BBDD central', icono: 'educamos', grupo: 'config', href: '/gestion/educamos' },
  ajustes: { titulo: 'Ajustes del colegio', icono: 'ajustes', grupo: 'config', href: '/gestion/ajustes' },
  tareas: { titulo: 'Tareas de la plataforma', icono: 'tareas', grupo: 'config', href: '/gestion/tareas' },
  diseno: { titulo: 'Piezas de diseño', icono: 'diseno', grupo: 'config', href: '/gestion/diseno' },
} as const satisfies Record<string, IdentidadModulo>;

export type ClaveModulo = keyof typeof MODULOS;
