// Los tres pasos del pedido a editoriales: generar los Google Sheets, pasarlos a PDF y
// marcarlos como pedidos. Cada uno es un botón, y se pueden dar por separado a propósito:
// así se puede generar, mirar cómo ha quedado en Drive, y solo entonces confirmar.
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { licPedidosEditorial, type LicPedidoEditorial } from '@/db/schema';
import {
  exportarPdf,
  subirComoGoogleSheet,
  subirPdf,
  comprobarCarpetaBase,
  driveConfigurado,
  cuentaDeServicio,
  mensajeDeError,
} from '@/lib/cuaderno/drive';
import {
  getBancoLibrosReport,
  getEditorialReport,
  markEditorialProcessed,
  type EditorialReportRow,
} from '@/lib/licencias-server';
import { importeTotal, nombreFichero, porEditorial, xlsxPedido, type TipoPedido } from '@/lib/licencias-pedidos';

/** Carpeta de Drive donde se dejan los pedidos. Configurable por entorno. */
export const CARPETA_PEDIDOS_POR_DEFECTO = '1JRD4q8n7vZxK7QTAnWVUqdWPViuD4dn2';

export function carpetaPedidos(): string {
  return process.env.LICENCIAS_CARPETA_PEDIDOS?.trim() || CARPETA_PEDIDOS_POR_DEFECTO;
}

export interface EstadoDrive {
  configurado: boolean;
  cuenta: string | null;
  carpetaId: string;
  carpetaNombre?: string;
  ok: boolean;
  error?: string;
}

export async function estadoDrive(): Promise<EstadoDrive> {
  const carpetaId = carpetaPedidos();
  if (!driveConfigurado()) {
    return { configurado: false, cuenta: null, carpetaId, ok: false, error: 'Faltan las credenciales de Google' };
  }
  const check = await comprobarCarpetaBase(carpetaId);
  return {
    configurado: true,
    cuenta: cuentaDeServicio(),
    carpetaId,
    carpetaNombre: check.nombre,
    ok: check.ok,
    error: check.error,
  };
}

/** Lo que se generaría al pulsar el botón, sin tocar nada: para enseñarlo antes. */
export async function previsualizarPedidos(campaignId: string): Promise<{
  pago: { editorial: string; libros: number; unidades: number; importe: number }[];
  banco: { editorial: string; libros: number; unidades: number; importe: number }[];
  pedidosPendientes: number;
}> {
  const [{ rows: pago, orderIds }, banco] = await Promise.all([
    getEditorialReport(campaignId),
    getBancoLibrosReport(campaignId),
  ]);
  const resumen = (filas: EditorialReportRow[]) =>
    porEditorial(filas).map((g) => ({
      editorial: g.editorial,
      libros: g.filas.length,
      unidades: g.filas.reduce((s, r) => s + r.unidades, 0),
      importe: importeTotal(g.filas),
    }));
  return { pago: resumen(pago), banco: resumen(banco.rows), pedidosPendientes: orderIds.length };
}

export interface ResultadoGeneracion {
  tiradaId: string;
  ficheros: LicPedidoEditorial[];
  errores: { editorial: string; tipo: TipoPedido; error: string }[];
}

/**
 * Genera un Google Sheet por editorial y tipo. Los dos tipos van SIEMPRE en ficheros
 * distintos: el pedido de pago y el del banco de libros se tramitan por vías separadas.
 *
 * Reemplaza el fichero si ya existía uno con el mismo nombre en la carpeta (así repetir la
 * tirada no llena Drive de copias), pero cada pulsación es una tirada nueva en la base de
 * datos: lo que se marca como hecho es lo que se generó, no lo que hubiera pendiente después.
 */
export async function generarPedidos(
  campaignId: string,
  campaña: string,
  tipos: TipoPedido[] = ['pago', 'banco'],
): Promise<ResultadoGeneracion> {
  const carpetaId = carpetaPedidos();
  const tiradaId = crypto.randomUUID();
  const fecha = new Date();
  const ficheros: LicPedidoEditorial[] = [];
  const errores: ResultadoGeneracion['errores'] = [];

  const [pago, banco] = await Promise.all([getEditorialReport(campaignId), getBancoLibrosReport(campaignId)]);
  const fuentes: { tipo: TipoPedido; filas: EditorialReportRow[]; orderIds: string[] }[] = [
    { tipo: 'pago', filas: pago.rows, orderIds: pago.orderIds },
    { tipo: 'banco', filas: banco.rows, orderIds: [] },
  ];

  for (const fuente of fuentes) {
    if (!tipos.includes(fuente.tipo)) continue;
    for (const grupo of porEditorial(fuente.filas)) {
      const nombre = nombreFichero(campaña, grupo.editorial, fuente.tipo);
      try {
        const xlsx = await xlsxPedido(grupo.filas, fuente.tipo, fecha);
        const subido = await subirComoGoogleSheet({ nombre, carpetaId, xlsx });
        const [fila] = await db
          .insert(licPedidosEditorial)
          .values({
            campaignId,
            tiradaId,
            tipo: fuente.tipo,
            editorial: grupo.editorial,
            nombre,
            sheetId: subido.id,
            sheetUrl: subido.url,
            unidades: grupo.filas.reduce((s, r) => s + r.unidades, 0),
            libros: grupo.filas.length,
            importe: importeTotal(grupo.filas).toFixed(2),
            orderIds: fuente.tipo === 'pago' ? fuente.orderIds : null,
          })
          .returning();
        ficheros.push(fila);
      } catch (error) {
        errores.push({ editorial: grupo.editorial, tipo: fuente.tipo, error: mensajeDeError(error) });
      }
    }
  }

  return { tiradaId, ficheros, errores };
}

/** Pasa a PDF los Sheets de una tirada y los deja al lado, en la misma carpeta. */
export async function generarPdfs(tiradaId: string): Promise<{
  hechos: LicPedidoEditorial[];
  errores: { nombre: string; error: string }[];
}> {
  const carpetaId = carpetaPedidos();
  const filas = await db
    .select()
    .from(licPedidosEditorial)
    .where(and(eq(licPedidosEditorial.tiradaId, tiradaId), isNull(licPedidosEditorial.pdfId)));

  const hechos: LicPedidoEditorial[] = [];
  const errores: { nombre: string; error: string }[] = [];

  for (const f of filas) {
    if (!f.sheetId) continue;
    try {
      const pdf = await exportarPdf(f.sheetId);
      const subido = await subirPdf({ nombre: f.nombre, carpetaId, pdf });
      const [actualizada] = await db
        .update(licPedidosEditorial)
        .set({ pdfId: subido.id, pdfUrl: subido.url })
        .where(eq(licPedidosEditorial.id, f.id))
        .returning();
      hechos.push(actualizada);
    } catch (error) {
      errores.push({ nombre: f.nombre, error: mensajeDeError(error) });
    }
  }
  return { hechos, errores };
}

/**
 * Marca como pedidos (🧾) los pedidos que entraron en los ficheros de PAGO de la tirada.
 * Los del banco no se marcan: no salen de ningún pedido.
 */
export async function marcarTiradaPedida(tiradaId: string): Promise<{ pedidos: number; ficheros: number }> {
  const filas = await db.select().from(licPedidosEditorial).where(eq(licPedidosEditorial.tiradaId, tiradaId));
  const orderIds = [...new Set(filas.flatMap((f) => f.orderIds ?? []))];
  if (orderIds.length > 0) await markEditorialProcessed(orderIds);
  const ids = filas.filter((f) => !f.marcadoAt).map((f) => f.id);
  if (ids.length > 0) {
    await db
      .update(licPedidosEditorial)
      .set({ marcadoAt: new Date() })
      .where(inArray(licPedidosEditorial.id, ids));
  }
  return { pedidos: orderIds.length, ficheros: ids.length };
}

/** La última tirada de la campaña, que es sobre la que actúan los botones de PDF y marcar. */
export async function getUltimaTirada(campaignId: string): Promise<LicPedidoEditorial[]> {
  const [ultima] = await db
    .select({ tiradaId: licPedidosEditorial.tiradaId })
    .from(licPedidosEditorial)
    .where(eq(licPedidosEditorial.campaignId, campaignId))
    .orderBy(desc(licPedidosEditorial.createdAt))
    .limit(1);
  if (!ultima) return [];
  return db
    .select()
    .from(licPedidosEditorial)
    .where(eq(licPedidosEditorial.tiradaId, ultima.tiradaId))
    .orderBy(licPedidosEditorial.tipo, licPedidosEditorial.editorial);
}
