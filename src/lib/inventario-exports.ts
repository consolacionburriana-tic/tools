// Inventario y aulas: el Excel con todo (una pestaña por sección). Ficha: docs/33-inventario.md.
import {
  ACCION_AV_LABEL,
  AREA_LABEL,
  AUDIO_LABEL,
  CATEGORIA_ROB_LABEL,
  ESTADO_KIT_LABEL,
  NIVEL_LABEL,
  PANTALLA_LABEL,
  PRIORIDAD_LABEL,
  antenaPorRenombrar,
  cuadreMobiliario,
  type AccionAv,
  type Area,
  type Audio,
  type CategoriaRob,
  type EstadoKit,
  type Pantalla,
  type Prioridad,
} from './inventario';
import { etiquetaAula, indexar } from './inventario-indice';
import type { Inventario } from './inventario-server';
import type { EntradaCelda, Libro } from './xlsx-escribir';

const CAB = { negrita: true, fondo: 'E0F2FE' };
const cab = (t: string[]): EntradaCelda[] => t.map((valor) => ({ valor, estilo: CAB }));

export function libroInventario(inv: Inventario): Libro {
  const filas = indexar(inv);
  const aulas = new Map(filas.map((f) => [f.aula.id, f]));
  const kits = new Map(inv.kits.map((k) => [k.id, k]));
  const modelos = new Map(inv.modelos.map((m) => [m.id, m]));
  const dondeAula = (id: string | null) => {
    const f = id ? aulas.get(id) : null;
    return f ? etiquetaAula(f) : '';
  };
  const hoja = (nombre: string, cabecera: string[], cuerpo: EntradaCelda[][], anchos: number[]) => ({
    nombre,
    filas: [cab(cabecera), ...cuerpo],
    columnas: anchos.map((ancho) => ({ ancho })),
    congelar: 'A2',
    autofiltro: true,
  });
  return {
    hojas: [
      hoja(
        'Aulas',
        ['Aula', 'Piso', 'Sala', `Clase ${inv.cursoActual}`, 'Tutor/a', 'Alumnos', 'Arreglos pendientes', 'Notas'],
        filas.map((f) => [f.aula.numero, f.aula.piso, f.aula.nombre, f.cartel, f.tutores.join(', '), f.alumnos, f.pendientes.length, f.aula.notas]),
        [8, 6, 20, 14, 30, 9, 10, 40],
      ),
      hoja(
        'Audiovisual',
        ['Aula', 'Clase', 'Pantalla', 'Marca', 'Audio', 'Apple TV', 'Valoración', 'Qué hacer', 'Prioridad', 'Notas', 'Revisado por'],
        filas
          .filter((f) => f.av)
          .map((f) => [
            f.aula.numero,
            f.aula.nombre ?? f.cartel,
            f.av!.pantalla ? PANTALLA_LABEL[f.av!.pantalla as Pantalla] : '',
            f.av!.marca,
            f.av!.audio ? AUDIO_LABEL[f.av!.audio as Audio] : '',
            f.av!.appleTv ? 'Sí' : 'No',
            f.av!.valoracion,
            ACCION_AV_LABEL[f.av!.accion as AccionAv],
            NIVEL_LABEL[f.atencionAv],
            f.av!.notas,
            f.av!.actualizadoPor,
          ]),
        [8, 16, 11, 18, 18, 9, 10, 16, 10, 60, 24],
      ),
      hoja(
        'Mesas y sillas',
        ['Aula', 'Clase', 'Alumnos', 'Sillas', 'Mesas', 'Sillas − alumnos', 'Mesas − alumnos', 'Notas'],
        filas
          .filter((f) => f.mob || f.ocupacion?.curso)
          .map((f) => {
            const c = cuadreMobiliario(f.mob, f.alumnos, f.ocupacion?.curso ?? null);
            return [f.aula.numero, f.aula.nombre ?? f.cartel, f.alumnos, f.mob?.sillas, f.mob?.mesas, c.sillas, c.mesas, f.mob?.notas];
          }),
        [8, 16, 9, 8, 8, 15, 15, 40],
      ),
      hoja(
        'Antenas',
        ['Piso', 'Nombre actual', 'Nombre nuevo', 'Por renombrar', 'Aula', 'Ubicación', 'Notas'],
        inv.antenas.map((a) => [a.piso, a.nombreActual, a.nombreNuevo, antenaPorRenombrar(a) ? 'Sí' : 'No', dondeAula(a.aulaId), a.ubicacion, a.notas]),
        [6, 24, 24, 12, 22, 26, 40],
      ),
      hoja(
        'Arreglos',
        ['Estado', 'Prioridad', 'De qué', 'Dónde', 'Qué hay que hacer', 'Apuntado por', 'Hecho el', 'Hecho por'],
        inv.arreglos.map((a) => [
          a.hechoAt ? 'Hecho' : 'Pendiente',
          PRIORIDAD_LABEL[a.prioridad as Prioridad],
          AREA_LABEL[a.area as Area],
          a.kitId ? `Kit ${kits.get(a.kitId)?.codigo ?? ''}` : dondeAula(a.aulaId),
          a.texto,
          a.creadoPor,
          a.hechoAt ? new Date(a.hechoAt) : null,
          a.hechoPor,
        ]),
        [10, 14, 14, 22, 60, 24, 12, 24],
      ),
      hoja(
        'Robótica · material',
        ['Material', 'Tipo', 'Código artículo', 'Pedidas', 'Llegadas', 'Letra kits', 'Notas'],
        inv.modelos.map((m) => [
          m.nombre,
          CATEGORIA_ROB_LABEL[m.categoria as CategoriaRob],
          m.codigoArticulo,
          m.pedidas,
          inv.kits.filter((k) => k.modeloId === m.id).length,
          m.prefijo,
          m.notas,
        ]),
        [44, 20, 14, 9, 9, 10, 40],
      ),
      hoja(
        'Robótica · kits',
        ['Kit', 'Material', 'Dónde', 'Estado', 'Llegó', 'Notas'],
        inv.kits.map((k) => [
          k.codigo,
          modelos.get(k.modeloId)?.nombre,
          dondeAula(k.aulaId),
          ESTADO_KIT_LABEL[k.estado as EstadoKit],
          k.recibidoAt ? new Date(k.recibidoAt) : null,
          k.notas,
        ]),
        [8, 36, 22, 14, 12, 50],
      ),
      hoja(
        'Recursos didácticos',
        ['Material', 'Recurso', 'Enlace', 'Notas'],
        inv.recursos.map((r) => [modelos.get(r.modeloId)?.nombre, r.titulo, r.url, r.notas]),
        [36, 36, 60, 40],
      ),
    ],
  };
}
