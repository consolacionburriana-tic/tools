import { describe, expect, it } from 'vitest';
import { interpretar, motivoDe, pareceSustitucion, urlNueva } from '@/lib/sustituciones-interpretar';

const HOY = '2026-11-24'; // martes
const PROFES = [
  { id: 'm1', nombre: 'Marta Rubio' },
  { id: 'm2', nombre: 'Marta Usó' },
  { id: 'j', nombre: 'Jorge Enrich' },
  { id: 'r', nombre: 'Reyes Moguer' },
  { id: 'n', nombre: 'Núria Crouseilles' },
];

describe('interpretar una sustitución escrita como se dice', () => {
  it('quién, mañana, a 3ª y 4ª, médico', () => {
    const r = interpretar('Jorge falta mañana a 3ª y 4ª, médico', HOY, PROFES);
    expect(r.profe?.id).toBe('j');
    expect(r).toMatchObject({ desde: '2026-11-25', hasta: '2026-11-25', tramos: ['3ª', '4ª'], motivo: 'medico' });
  });
  it('dos Martas: duda; con el apellido, una', () => {
    expect(interpretar('marta falta hoy', HOY, PROFES).dudas.map((p) => p.id)).toEqual(['m1', 'm2']);
    expect(interpretar('marta uso falta hoy', HOY, PROFES).profe?.id).toBe('m2');
  });
  it('sin tildes y por el apellido', () => {
    expect(interpretar('nuria no viene el viernes', HOY, PROFES)).toMatchObject({ profe: { id: 'n' }, desde: '2026-11-27' });
    expect(interpretar('moguer el jueves de 9 a 11', HOY, PROFES)).toMatchObject({ profe: { id: 'r' }, desde: '2026-11-26', horaInicio: '09:00', horaFin: '11:00' });
  });
  it('rangos de días y de horas', () => {
    expect(interpretar('Reyes del lunes al miércoles por baja', HOY, PROFES)).toMatchObject({ desde: '2026-11-30', hasta: '2026-12-02', motivo: 'baja' });
    expect(interpretar('Reyes falta de 2ª a 4ª', HOY, PROFES).tramos).toEqual(['2ª', '3ª', '4ª']);
    expect(interpretar('Reyes falta de 3 a 5', HOY, PROFES).tramos).toEqual(['3ª', '4ª', '5ª']);
    expect(interpretar('Reyes primera y segunda hora', HOY, PROFES).tramos).toEqual(['1ª', '2ª']);
    expect(interpretar('Reyes el 3/12 a las 10:30', HOY, PROFES)).toMatchObject({ desde: '2026-12-03', horaInicio: '10:30' });
    expect(interpretar('Reyes el 15 de enero', HOY, PROFES).desde).toBe('2027-01-15');
  });
  it('hoy es martes: «el martes» es hoy y «el próximo martes», el de la semana que viene', () => {
    expect(interpretar('Jorge el martes', HOY, PROFES).desde).toBe(HOY);
    expect(interpretar('Jorge el próximo martes', HOY, PROFES).desde).toBe('2026-12-01');
  });
  it('motivos', () => {
    expect(motivoDe('lleva a su hijo al médico')).toBe('medico_familiar');
    expect(motivoDe('excursión con 4º')).toBe('actividad_escolar');
    expect(motivoDe('tiene fiebre')).toBe('enfermedad_leve');
    expect(motivoDe('asuntos propios')).toBeNull();
  });
  it('¿parece una sustitución?', () => {
    expect(pareceSustitucion('s jorge mañana')).toBe(true);
    expect(pareceSustitucion('Marta falta el jueves')).toBe(true);
    expect(pareceSustitucion('salidas')).toBe(false);
  });
  it('la url que abre la propuesta', () => {
    const r = interpretar('Jorge falta mañana a 3ª', HOY, PROFES);
    expect(urlNueva(r)).toBe('/gestion/sustituciones?nueva=1&profe=j&desde=2026-11-25&hasta=2026-11-25&semana=2026-11-25&tramos=3%C2%AA');
  });
});
