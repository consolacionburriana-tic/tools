// Los tres pasos del pedido a editoriales: generar los Google Sheets, pasarlos a PDF y
// marcarlos como pedidos. Cada uno es un botón, y se pueden dar por separado a propósito:
// así se puede generar, mirar cómo ha quedado en Drive, y solo entonces confirmar.
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { licPedidosEditorial, type LicPedidoEditorial } from '@/db/schema';
import {
  buscarEnCarpeta,
  borrarArchivo,
  copiarArchivo,
  exportarPdf,
  reemplazarPdf,
  subirPdf,
  urlArchivo,
  comprobarCarpetaBase,
  infoArchivo,
  driveConfigurado,
  cuentaDeServicio,
  mensajeDeError,
  urlHojaDeCalculo,
  MIME_GSHEET,
} from '@/lib/cuaderno/drive';
import {
  getBancoLibrosReport,
  getEditorialReport,
  markEditorialProcessed,
  type EditorialReportRow,
} from '@/lib/licencias-server';
import {
  escribirPedidoEnCopia,
  importeTotal,
  nombreFichero,
  plantillaPedido,
  porEditorial,
  type TipoPedido,
} from '@/lib/licencias-pedidos';

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
  if (!check.ok) {
    return { configurado: true, cuenta: cuentaDeServicio(), carpetaId, carpetaNombre: check.nombre, ok: false, error: check.error };
  }
  // La plantilla también tiene que estar a mano: sin ella no se puede generar nada.
  try {
    await infoArchivo(plantillaPedido());
  } catch (error) {
    return {
      configurado: true,
      cuenta: cuentaDeServicio(),
      carpetaId,
      carpetaNombre: check.nombre,
      ok: false,
      error: `No se puede leer la plantilla del pedido (${mensajeDeError(error)}). Compártela con la cuenta de servicio.`,
    };
  }
  return { configurado: true, cuenta: cuentaDeServicio(), carpetaId, carpetaNombre: check.nombre, ok: true };
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
        // Repetir la tirada no debe dejar dos ficheros con el mismo nombre: el anterior se
        // quita antes de copiar. Se hace aquí y no con un "reemplazar" como en el cuaderno
        // porque la copia de la plantilla crea siempre un archivo nuevo.
        const previo = await buscarEnCarpeta(nombre, carpetaId, MIME_GSHEET);
        if (previo) await borrarArchivo(previo.id);

        const copia = await copiarArchivo(plantillaPedido(), nombre, carpetaId);
        await escribirPedidoEnCopia(copia.id, grupo.filas, fuente.tipo, grupo.editorial, fecha);
        const subido = { id: copia.id, url: urlHojaDeCalculo(copia.id) };
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

/**
 * Pasa a PDF los Sheets de una tirada y los deja al lado, en la misma carpeta.
 *
 * El PDF sale del Google Sheet **tal como esté en ese momento**, así que recoge lo que se haya
 * retocado a mano en él. Por eso rehace SIEMPRE los de la tirada, también los que ya tenían
 * PDF: antes solo hacía los que faltaban, y quien editaba el Sheet después de pasarlo a PDF se
 * quedaba con el PDF viejo y sin forma de rehacerlo desde el panel. Se reemplaza el contenido
 * del PDF que ya existía para no dejar dos con el mismo nombre en Drive ni romper su enlace.
 */
export async function generarPdfs(tiradaId: string): Promise<{
  hechos: LicPedidoEditorial[];
  errores: { nombre: string; error: string }[];
}> {
  const carpetaId = carpetaPedidos();
  const filas = await db
    .select()
    .from(licPedidosEditorial)
    .where(eq(licPedidosEditorial.tiradaId, tiradaId));

  const hechos: LicPedidoEditorial[] = [];
  const errores: { nombre: string; error: string }[] = [];

  for (const f of filas) {
    if (!f.sheetId) continue;
    try {
      const pdf = await exportarPdf(f.sheetId);
      // Si ya había PDF se reemplaza su contenido (mismo enlace); si alguien lo borró a mano,
      // `reemplazarPdf` devuelve false y se crea uno nuevo.
      const reemplazado = f.pdfId ? await reemplazarPdf(f.pdfId, pdf) : false;
      const subido = reemplazado
        ? { id: f.pdfId!, url: f.pdfUrl ?? urlArchivo(f.pdfId!) }
        : await subirPdf({ nombre: f.nombre, carpetaId, pdf });
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
