// La tabla de Números del cole como imagen PNG, para WhatsApp (docs/24-numeros.md, decisión 5).
// Solo navegador: dibuja en un <canvas>. Siempre en claro, porque la imagen acaba en un chat
// que no sabe de temas, y con los colores de etapa para leerla de un vistazo.
import { ETAPA_HEX, type TablaCopiable } from '@/lib/numeros';

const FONDO_ETAPA = { EI: '#fdf2e7', EP: '#edf2fe', ESO: '#e7f6f0', BACH: '#eef1f5' } as const;

export function tablaAImagen(t: TablaCopiable, color: string): Promise<Blob | null> {
  const dpr = 2;
  const pad = 28;
  const altoFila = 30;
  const altoCab = 44;
  const altoTitulo = 60;
  const altoPie = 36;
  const fuente = 'Geist, ui-sans-serif, system-ui, -apple-system, sans-serif';

  const medir = document.createElement('canvas').getContext('2d');
  if (!medir) return Promise.resolve(null);
  medir.font = `600 14px ${fuente}`;
  const anchos = t.cabecera.map(
    (h, j) => Math.max(medir.measureText(h).width, ...t.filas.map((f) => medir.measureText(f.celdas[j] ?? '').width)) + 26,
  );
  anchos[0] = Math.max(anchos[0] + 18, 170);
  const ancho = Math.max(pad * 2 + anchos.reduce((a, b) => a + b, 0), 520);
  const alto = altoTitulo + altoCab + t.filas.length * altoFila + altoPie + pad / 2;

  const canvas = document.createElement('canvas');
  canvas.width = ancho * dpr;
  canvas.height = alto * dpr;
  const x = canvas.getContext('2d');
  if (!x) return Promise.resolve(null);
  x.scale(dpr, dpr);

  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, ancho, alto);
  x.fillStyle = color;
  x.fillRect(0, 0, ancho, 5);
  x.fillStyle = '#15181e';
  x.font = `700 19px ${fuente}`;
  x.fillText(t.titulo, pad, 38);
  x.fillStyle = '#788195';
  x.font = `400 13px ${fuente}`;
  x.fillText(t.subtitulo, ancho - pad - x.measureText(t.subtitulo).width, 38);

  let y = altoTitulo;
  x.fillStyle = '#eef2f8';
  x.fillRect(pad, y, ancho - 2 * pad, altoCab);
  x.font = `600 12px ${fuente}`;
  x.fillStyle = '#485062';
  let cx = pad;
  t.cabecera.forEach((h, j) => {
    const w = anchos[j];
    x.fillText(h, j === 0 ? cx + 12 : cx + w - 12 - x.measureText(h).width, y + 27);
    cx += w;
  });
  y += altoCab;

  for (const f of t.filas) {
    const grupo = f.tipo === 'total' || f.tipo === 'etapa' || (f.tipo === 'curso' && f.celdas[0].startsWith('Total'));
    x.fillStyle =
      f.tipo === 'total' ? '#e3e9f3' : f.tipo === 'etapa' && f.etapa ? FONDO_ETAPA[f.etapa] : grupo ? '#f5f7fa' : '#ffffff';
    x.fillRect(pad, y, ancho - 2 * pad, altoFila);
    x.fillStyle = '#e2e6ec';
    x.fillRect(pad, y + altoFila - 1, ancho - 2 * pad, 1);
    x.font = `${grupo ? 650 : 400} 14px ${fuente}`;
    cx = pad;
    f.celdas.forEach((v, j) => {
      const w = anchos[j];
      if (j === 0) {
        let ox = cx + 12;
        if (f.tipo !== 'clase' && f.tipo !== 'total' && f.etapa) {
          x.fillStyle = ETAPA_HEX[f.etapa].claro;
          x.beginPath();
          x.arc(ox + 4, y + altoFila / 2, 4, 0, Math.PI * 2);
          x.fill();
          ox += 16;
        } else if (f.tipo === 'clase') ox += 16;
        x.fillStyle = f.tipo === 'clase' ? '#485062' : '#15181e';
        x.fillText(v, ox, y + 20);
      } else {
        x.fillStyle = '#15181e';
        x.fillText(v, cx + w - 12 - x.measureText(v).width, y + 20);
      }
      cx += w;
    });
    y += altoFila;
  }
  x.fillStyle = '#788195';
  x.font = `400 12px ${fuente}`;
  x.fillText('Números del cole · Consolación Burriana', pad, y + 24);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
