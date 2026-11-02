import { beforeEach, describe, expect, it, vi } from 'vitest';

const crear = vi.fn();
const jwt = vi.fn((scope: unknown, subject: unknown) => `jwt-falso:${String(scope)}:${String(subject)}`);
let configurado = true;

vi.mock('googleapis', () => ({ google: { drive: vi.fn(() => ({ files: { create: crear } })) } }));
vi.mock('@/lib/google-sa', async (original) => ({
  ...(await original<typeof import('@/lib/google-sa')>()),
  googleConfigurado: () => configurado,
  jwtGoogle: (scope: unknown, subject: unknown) => jwt(scope, subject),
}));

import {
  ErrorDrive,
  explicarFalloDrive,
  fechaParaNombre,
  guardarEnDriveDe,
  nombreEnDrive,
  SCOPE_DRIVE_ARCHIVOS,
} from '@/lib/drive-usuario';

beforeEach(() => {
  crear.mockReset();
  jwt.mockClear();
  configurado = true;
});

describe('nombreEnDrive', () => {
  it('pone la fecha de Madrid, no la de UTC', () => {
    // 23:30 UTC del 2 de noviembre ya es 3 de noviembre en Madrid (CET, UTC+1).
    expect(fechaParaNombre(new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-03');
    expect(fechaParaNombre(new Date('2026-11-02T10:00:00Z'))).toBe('2026-11-02');
  });

  it('deja el nombre legible: con acentos, sin saltos de línea y con la fecha al final', () => {
    const fecha = new Date('2026-11-02T10:00:00Z');
    expect(nombreEnDrive('  Correos   familias\n2º ESO B 2026-2027 ', fecha)).toBe('Correos familias 2º ESO B 2026-2027 · 2026-11-02');
  });

  it('no se queda sin nombre ni se pasa de largo', () => {
    const fecha = new Date('2026-11-02T10:00:00Z');
    expect(nombreEnDrive('   ', fecha)).toBe('Exportación · 2026-11-02');
    expect(nombreEnDrive('x'.repeat(500), fecha).length).toBeLessThan(180);
  });
});

describe('explicarFalloDrive', () => {
  it('si falta la delegación, lo dice de forma que TIC sepa qué hacer (503)', () => {
    const e = explicarFalloDrive(new Error('unauthorized_client: Client is unauthorized to retrieve access tokens'));
    expect(e.status).toBe(503);
    expect(e.message).toMatch(/TIC/);
    expect(e.message).toMatch(/Descarga el Excel/);
  });

  it('el Drive lleno y los fallos de Google se explican aparte', () => {
    expect(explicarFalloDrive(Object.assign(new Error('The user storageQuotaExceeded'), { code: 403 })).status).toBe(507);
    expect(explicarFalloDrive(Object.assign(new Error('boom'), { code: 503 })).message).toMatch(/otra vez/);
  });

  it('un fallo cualquiera no filtra el mensaje de Google, que puede llevar datos', () => {
    const e = explicarFalloDrive(new Error('detalle interno con ana@alumnos.ejemplo.com'));
    expect(e).toBeInstanceOf(ErrorDrive);
    expect(e.message).not.toMatch(/ana@/);
    expect(e.status).toBe(502);
  });
});

describe('guardarEnDriveDe', () => {
  const xlsx = Buffer.from('xlsx-falso');

  it('Google Sheet: suplanta a quien pide, con el scope mínimo, convierte y va a la raíz de Mi unidad', async () => {
    crear.mockResolvedValue({ data: { id: 'ABC123' } });
    const r = await guardarEnDriveDe('tutora@cole.es', { nombre: 'Lista 2º ESO B · 2026-11-02', xlsx, formato: 'sheet' });

    expect(jwt).toHaveBeenCalledWith(SCOPE_DRIVE_ARCHIVOS, 'tutora@cole.es');
    expect(SCOPE_DRIVE_ARCHIVOS).toBe('https://www.googleapis.com/auth/drive.file');
    const args = crear.mock.calls[0][0];
    expect(args.requestBody).toEqual({ name: 'Lista 2º ESO B · 2026-11-02', mimeType: 'application/vnd.google-apps.spreadsheet' });
    expect(args.requestBody).not.toHaveProperty('parents');
    expect(args.media.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(r).toEqual({
      id: 'ABC123',
      nombre: 'Lista 2º ESO B · 2026-11-02',
      url: 'https://docs.google.com/spreadsheets/d/ABC123/edit',
      formato: 'sheet',
    });
  });

  it('Excel: lo deja como .xlsx, sin convertir', async () => {
    crear.mockResolvedValue({ data: { id: 'XYZ789' } });
    const r = await guardarEnDriveDe('tutora@cole.es', { nombre: 'Informe', xlsx, formato: 'xlsx' });

    expect(crear.mock.calls[0][0].requestBody).toEqual({
      name: 'Informe.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(r.nombre).toBe('Informe.xlsx');
    expect(r.url).toBe('https://drive.google.com/file/d/XYZ789/view');
  });

  it('sin credenciales de Google no intenta nada y lo explica', async () => {
    configurado = false;
    await expect(guardarEnDriveDe('a@cole.es', { nombre: 'x', xlsx, formato: 'sheet' })).rejects.toMatchObject({ status: 503 });
    expect(crear).not.toHaveBeenCalled();
  });

  it('si Drive falla, sale un ErrorDrive legible y no el error crudo', async () => {
    crear.mockRejectedValue(new Error('invalid_grant: Invalid email or User ID'));
    await expect(guardarEnDriveDe('fuera@gmail.com', { nombre: 'x', xlsx, formato: 'sheet' })).rejects.toBeInstanceOf(ErrorDrive);
  });
});
