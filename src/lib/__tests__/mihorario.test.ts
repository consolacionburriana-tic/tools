import { describe, expect, it } from 'vitest';

import type { CeldaHorario } from '@/lib/horarios';
import {
  construirEventoGoogle,
  datosPlantillaDeCelda,
  duracionMinutos,
  emojiDeCelda,
  EMOJI_GENERICO_LECTIVA,
  EMOJI_GENERICO_NO_LECTIVA,
  generarAbreviatura,
  ocurrenciasSemanales,
  PLANTILLA_TITULO_DEFECTO,
  renderizarPlantilla,
} from '@/lib/mihorario';

function celda(o: Partial<CeldaHorario>): CeldaHorario {
  return {
    sesionId: 's1',
    dia: 1,
    tramoId: 't1',
    horaInicio: '09:00',
    horaFin: '09:45',
    tipoTramo: 'sesion',
    titulo: 'Matemáticas',
    subtitulo: null,
    materiaId: 'mat-1',
    abreviatura: 'MAT',
    actividad: 'clase',
    actividadNombre: 'Clase',
    lectiva: true,
    espacio: null,
    profes: [],
    grupos: ['3PRI A'],
    notas: null,
    ...o,
  };
}

describe('emoji de una celda', () => {
  it('el de la persona gana siempre, aunque el centro proponga otro', () => {
    const c = celda({});
    expect(emojiDeCelda(c, { 'materia:mat-1': '🦄' })).toBe('🦄');
  });

  it('sin preferencia propia, el del centro por defecto', () => {
    expect(emojiDeCelda(celda({}), {})).toBe('🔢'); // Matemáticas
  });

  it('una actividad sin materia usa el emoji de la actividad', () => {
    const c = celda({ materiaId: null, actividad: 'atencion_padres', actividadNombre: 'Atención a familias', grupos: [] });
    expect(emojiDeCelda(c, {})).toBe('🗣️');
  });

  it('sin nada que la identifique, el genérico según sea lectiva o no', () => {
    const noLectiva = celda({ materiaId: null, actividad: 'libre_disposicion', lectiva: false, grupos: [] });
    expect(emojiDeCelda(noLectiva, {})).toBe(EMOJI_GENERICO_NO_LECTIVA);
    const lectivaSinMateria = celda({ materiaId: null, actividad: 'algo_raro', lectiva: true, grupos: [] });
    expect(emojiDeCelda(lectivaSinMateria, {})).toBe(EMOJI_GENERICO_LECTIVA);
  });
});

describe('abreviatura de respaldo', () => {
  it('el ejemplo que pidió David: dos significativas con un conector en medio', () => {
    expect(generarAbreviatura('Geografía e Historia')).toBe('GeH');
  });

  it('una sola palabra significativa: sus 3 primeras letras', () => {
    expect(generarAbreviatura('Matemáticas')).toBe('MAT');
    expect(generarAbreviatura('English')).toBe('ENG');
  });

  it('dos palabras sin conector: iniciales de las dos', () => {
    expect(generarAbreviatura('Educació Física')).toBe('EF');
  });

  it('un conector al final no aporta nada (no genera basura tipo "GeHe")', () => {
    expect(generarAbreviatura('Geografia e Historia e')).toBe('GeH');
  });
});

describe('motor de la plantilla', () => {
  it('la plantilla por defecto con todos los huecos rellenos', () => {
    const datos = datosPlantillaDeCelda(celda({}), '🔢');
    expect(renderizarPlantilla(PLANTILLA_TITULO_DEFECTO, datos)).toBe('🔢 MAT · 3PRI A');
  });

  it('sin clase (una guardia) no deja el separador colgando', () => {
    const c = celda({ materiaId: null, abreviatura: null, titulo: 'Guardia', actividad: 'guardia', actividadNombre: 'Guardia', grupos: [] });
    const datos = datosPlantillaDeCelda(c, '🛟');
    // La abreviatura de respaldo de 'Guardia' es 'GUA' (3 letras); lo que importa es que
    // NO quede un '·' suelto al final cuando {clase} está vacío.
    expect(renderizarPlantilla(PLANTILLA_TITULO_DEFECTO, datos)).toBe('🛟 GUA');
    expect(renderizarPlantilla(PLANTILLA_TITULO_DEFECTO, datos)).not.toMatch(/·\s*$/);
  });

  it('una plantilla con dos huecos vacíos seguidos no dobla el separador', () => {
    const datos = { emoji: '', abrev: '', materia: '', clase: 'Guardia', clases: '', aula: '', profes: '', actividad: '' };
    expect(renderizarPlantilla('{emoji} {abrev} · {clase}', datos)).toBe('Guardia');
  });

  it('respeta literales que no son separadores', () => {
    const datos = datosPlantillaDeCelda(celda({}), '🔢');
    expect(renderizarPlantilla('[{abrev}] {clase}', datos)).toBe('[MAT] 3PRI A');
  });

  it('un literal con texto (no solo separador) NUNCA se recorta, aunque el hueco esté vacío', () => {
    // Es la otra cara de la regla: el recorte automático solo se come separadores puros
    // (espacios, '·', '-'…). Un texto como '(aula: )' es cosa de quien edita la plantilla.
    const datos = { emoji: '🔢', abrev: 'MAT', materia: '', clase: '3PRI A', clases: '', aula: '', profes: '', actividad: '' };
    expect(renderizarPlantilla('{clase} (aula: {aula})', datos)).toBe('3PRI A (aula: )');
  });

  it('una persona puede reordenar y usar otro separador', () => {
    const datos = datosPlantillaDeCelda(celda({}), '🔢');
    expect(renderizarPlantilla('{clase} - {abrev} {emoji}', datos)).toBe('3PRI A - MAT 🔢');
  });
});

describe('ocurrencias semanales y festivos', () => {
  const periodo = { fechaInicio: '2026-09-14', fechaFin: '2026-12-22' };

  it('la primera fecha cae en el día de la semana pedido', () => {
    // lunes = 1: 2026-09-14 es lunes
    const r = ocurrenciasSemanales(1, periodo, []);
    expect(r.primeraFecha).toBe('2026-09-14');
  });

  it('si el periodo empieza en fin de semana, busca el primer día lectivo de esa semana', () => {
    const r = ocurrenciasSemanales(5, { fechaInicio: '2026-09-14', fechaFin: '2026-12-22' }, []); // viernes
    expect(r.primeraFecha).toBe('2026-09-18');
  });

  it('el puente de diciembre excluye el martes que cae dentro', () => {
    // Puente 5-8 diciembre 2026: el martes 8 de diciembre cae en ese rango.
    const r = ocurrenciasSemanales(2, periodo, [{ fechaInicio: '2026-12-05', fechaFin: '2026-12-08' }]);
    expect(r.fechasExcluidas).toContain('2026-12-08');
    expect(r.fechasExcluidas).not.toContain('2026-12-01');
  });

  it('sin festivos que caigan en ese día de la semana, no excluye nada', () => {
    const r = ocurrenciasSemanales(1, periodo, [{ fechaInicio: '2026-12-08', fechaFin: '2026-12-08' }]); // martes
    expect(r.fechasExcluidas).toEqual([]);
  });

  it('un periodo invertido (fin antes que inicio) no revienta, devuelve vacío', () => {
    expect(ocurrenciasSemanales(1, { fechaInicio: '2026-12-01', fechaFin: '2026-09-01' }, [])).toEqual({
      primeraFecha: null,
      fechasExcluidas: [],
    });
  });
});

describe('el evento de Google Calendar', () => {
  const periodo = { fechaInicio: '2026-09-14', fechaFin: '2027-05-31' };

  it('arma RRULE semanal con el día correcto y UNTIL del fin de periodo', () => {
    const { evento, primeraFecha } = construirEventoGoogle(celda({ dia: 2 }), {
      plantillaTitulo: PLANTILLA_TITULO_DEFECTO,
      emoji: '🔢',
      periodo,
      festivos: [],
      periodoId: 'per-1',
    });
    expect(primeraFecha).toBe('2026-09-15'); // martes
    expect(evento.summary).toBe('🔢 MAT · 3PRI A');
    expect(evento.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20270531T235959Z']);
    expect(evento.start).toEqual({ dateTime: '2026-09-15T09:00:00', timeZone: 'Europe/Madrid' });
  });

  it('con festivos, añade una línea EXDATE con las fechas excluidas', () => {
    const { evento } = construirEventoGoogle(celda({ dia: 1 }), {
      plantillaTitulo: PLANTILLA_TITULO_DEFECTO,
      emoji: '🔢',
      periodo: { fechaInicio: '2026-09-14', fechaFin: '2026-12-22' },
      festivos: [{ fechaInicio: '2026-12-07', fechaFin: '2026-12-08' }],
      periodoId: 'per-1',
    });
    const recurrence = evento.recurrence as string[];
    expect(recurrence[1]).toMatch(/^EXDATE;TZID=Europe\/Madrid:20261207T090000$/);
  });

  it('marca el origen y el periodo en extendedProperties, para poder deshacer luego', () => {
    const { evento } = construirEventoGoogle(celda({}), {
      plantillaTitulo: PLANTILLA_TITULO_DEFECTO,
      emoji: '🔢',
      periodo,
      festivos: [],
      periodoId: 'periodo-abc',
    });
    expect(evento.extendedProperties).toEqual({
      private: { origen: 'tools-horarios', periodoId: 'periodo-abc', sesionId: 's1' },
    });
  });

  it('la ubicación sale del espacio, y se omite si no hay', () => {
    const conAula = construirEventoGoogle(celda({ espacio: 'Polideportivo' }), {
      plantillaTitulo: PLANTILLA_TITULO_DEFECTO, emoji: '🔢', periodo, festivos: [], periodoId: 'p',
    });
    expect(conAula.evento.location).toBe('Polideportivo');
    const sinAula = construirEventoGoogle(celda({}), {
      plantillaTitulo: PLANTILLA_TITULO_DEFECTO, emoji: '🔢', periodo, festivos: [], periodoId: 'p',
    });
    expect(sinAula.evento.location).toBeUndefined();
  });
});

describe('duración de la sesión', () => {
  it('calcula los minutos', () => {
    expect(duracionMinutos({ horaInicio: '09:00', horaFin: '09:45' })).toBe(45);
    expect(duracionMinutos({ horaInicio: '08:00', horaFin: '10:10' })).toBe(130);
  });
});
