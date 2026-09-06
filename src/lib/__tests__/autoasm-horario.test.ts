import { describe, expect, it } from 'vitest';
import { CAMPOS_INSTRUCTOR, cabecerasDe, type ArchivoAsm, type FilaCsv } from '@/lib/autoasm';
import { proyectoVacio, type ProyectoAsm } from '@/lib/autoasm-construir';
import { aplicarPropuestas, proponerDesdeHorario, type AsignacionHorario } from '@/lib/autoasm-horario';

// Datos inventados, como en el resto de tests del módulo.

function fila(archivo: ArchivoAsm, valores: Partial<FilaCsv>): FilaCsv {
  return Object.fromEntries(cabecerasDe(archivo).map((c) => [c, valores[c] ?? '']));
}

function proyecto(): ProyectoAsm {
  const p = proyectoVacio();
  const location = p.opciones.locationId;
  p.archivos.staff = [
    fila('staff', { person_id: 'anaturing', first_name: 'Ana', last_name: 'Turing', email_address: 'ana@ej.com', location_id: location }),
    fila('staff', { person_id: 'luislovelace', first_name: 'Luis', last_name: 'Lovelace', email_address: 'luis@ej.com', location_id: location }),
  ];
  p.archivos.courses = [
    fila('courses', { course_id: 'Course-ESO-ESO3A', course_number: 'ESO3A', course_name: 'ESO 3A', location_id: location }),
    fila('courses', { course_id: 'Course-ESO-ESO3PDC', course_number: 'ESO3PDC', course_name: 'ESO 3 PDC', location_id: location }),
    fila('courses', { course_id: 'Course-ESO-ESO3', course_number: 'ESO3', course_name: 'ESO3', location_id: location }),
  ];
  p.archivos.classes = [
    fila('classes', { class_id: 'Cls-MusESO3A', class_number: 'Música', course_id: 'Course-ESO-ESO3A', instructor_id: 'anaturing', location_id: location }),
  ];
  p.reglas = { 'Cls-MusESO3A': ['ESO 3A'] };
  return p;
}

const musica: AsignacionHorario = {
  id: 'asig-musica',
  materia: 'Música',
  abreviatura: 'MUS',
  grupos: [
    { curso: '3ESO', letra: 'A', subgrupo: null },
    { curso: '3ESO', letra: 'PDC', subgrupo: null },
  ],
  profes: ['ana@ej.com', 'luis@ej.com'],
};

describe('proponerDesdeHorario', () => {
  it('empareja con la clase que ya existe y NO le toca el class_id ni el curso', () => {
    const { propuestas } = proponerDesdeHorario(proyecto(), [musica]);
    expect(propuestas).toHaveLength(1);
    expect(propuestas[0].classId).toBe('Cls-MusESO3A');
    expect(propuestas[0].courseId).toBe('Course-ESO-ESO3A');
    expect(propuestas[0].estado).toBe('actualiza');
  });

  it('la asignatura conjunta se lleva a los dos grupos (3º A y 3º PDC)', () => {
    const { propuestas } = proponerDesdeHorario(proyecto(), [musica]);
    expect(propuestas[0].grupos).toEqual(['ESO 3 PDC', 'ESO 3A']);
    expect(propuestas[0].cambios.some((c) => c.includes('Quién se matricula'))).toBe(true);
  });

  it('trae los profes del horario, con el titular primero', () => {
    const { propuestas } = proponerDesdeHorario(proyecto(), [musica]);
    expect(propuestas[0].instructores).toEqual(['anaturing', 'luislovelace']);
  });

  it('no dice nada cuando el horario coincide con lo que ya hay', () => {
    const p = proyecto();
    p.archivos.classes[0].instructor_id_2 = 'luislovelace';
    p.reglas['Cls-MusESO3A'] = ['ESO 3 PDC', 'ESO 3A'];
    const { propuestas } = proponerDesdeHorario(p, [musica]);
    expect(propuestas[0].estado).toBe('igual');
    expect(propuestas[0].cambios).toEqual([]);
  });

  it('propone una clase nueva cuando la materia no está en ASM', () => {
    const latin: AsignacionHorario = {
      id: 'asig-latin',
      materia: 'Latín',
      abreviatura: 'LAT',
      grupos: [{ curso: '3ESO', letra: 'A', subgrupo: null }],
      profes: ['luis@ej.com'],
    };
    const { propuestas } = proponerDesdeHorario(proyecto(), [latin]);
    expect(propuestas[0].estado).toBe('nueva');
    expect(propuestas[0].classId).toBe('Cls-LatESO3A');
    expect(propuestas[0].courseId).toBe('Course-ESO-ESO3A');
  });

  it('una optativa de las dos líneas del nivel cuelga del curso de nivel entero', () => {
    const frances: AsignacionHorario = {
      id: 'asig-frances',
      materia: 'Francés',
      abreviatura: 'FRA',
      grupos: [
        { curso: '3ESO', letra: 'A', subgrupo: null },
        { curso: '3ESO', letra: 'B', subgrupo: null },
      ],
      profes: [],
    };
    const { propuestas } = proponerDesdeHorario(proyecto(), [frances]);
    expect(propuestas[0].courseId).toBe('Course-ESO-ESO3');
  });

  it('un desdoble no se atreve a matricular a nadie, y lo dice', () => {
    const desdoble: AsignacionHorario = {
      ...musica,
      id: 'asig-desdoble',
      materia: 'Religión',
      grupos: [{ curso: '3ESO', letra: 'A', subgrupo: 'Religión' }],
    };
    const { propuestas } = proponerDesdeHorario(proyecto(), [desdoble]);
    expect(propuestas[0].grupos).toEqual([]);
    expect(propuestas[0].avisos.some((a) => a.includes('desdoble'))).toBe(true);
  });

  it('si el horario no trae profes, NO vacía la clase: se queda con los suyos', () => {
    const { propuestas } = proponerDesdeHorario(proyecto(), [{ ...musica, profes: [] }]);
    expect(propuestas[0].instructores).toEqual(['anaturing']);
    expect(propuestas[0].avisos.some((a) => a.includes('no trae profesorado'))).toBe(true);
  });

  it('avisa del profe que no tiene cuenta en staff.csv', () => {
    const { propuestas } = proponerDesdeHorario(proyecto(), [{ ...musica, profes: ['fantasma@ej.com'] }]);
    expect(propuestas[0].avisos.some((a) => a.includes('fantasma@ej.com'))).toBe(true);
    // …y como no queda ninguno reconocido, se conservan los que ya estaban.
    expect(propuestas[0].instructores).toEqual(['anaturing']);
  });

  it('lista las clases de ASM que el horario no menciona, sin tocarlas', () => {
    const p = proyecto();
    p.archivos.classes.push(fila('classes', { class_id: 'Cls-Comp', class_number: 'Compartidos', course_id: 'Course-ESO-ESO3', location_id: p.opciones.locationId }));
    const { clasesSinHorario } = proponerDesdeHorario(p, [musica]);
    expect(clasesSinHorario).toEqual(['Cls-Comp']);
  });

  it('recuerda el emparejamiento para el año siguiente', () => {
    const p = proyecto();
    const primera = aplicarPropuestas(p, proponerDesdeHorario(p, [musica]).propuestas);
    expect(primera.horario).toEqual({ 'asig-musica': 'Cls-MusESO3A' });
    // Aunque la clase se renombre a mano, el emparejamiento aguanta
    primera.archivos.classes[0].class_number = 'Música (conjunta)';
    const segunda = proponerDesdeHorario(primera, [musica]);
    expect(segunda.propuestas[0].classId).toBe('Cls-MusESO3A');
  });
});

describe('aplicarPropuestas', () => {
  it('actualiza los profes y la regla de matrícula de una clase existente', () => {
    const p = proyecto();
    const despues = aplicarPropuestas(p, proponerDesdeHorario(p, [musica]).propuestas);
    const clase = despues.archivos.classes[0];
    expect(CAMPOS_INSTRUCTOR.map((c) => clase[c]).filter(Boolean)).toEqual(['anaturing', 'luislovelace']);
    expect(despues.reglas['Cls-MusESO3A']).toEqual(['ESO 3 PDC', 'ESO 3A']);
    expect(despues.archivos.classes).toHaveLength(1);
  });

  it('crea la clase nueva con todas las columnas del fichero', () => {
    const p = proyecto();
    const latin: AsignacionHorario = {
      id: 'asig-latin', materia: 'Latín', abreviatura: 'LAT',
      grupos: [{ curso: '3ESO', letra: 'A', subgrupo: null }], profes: ['luis@ej.com'],
    };
    const despues = aplicarPropuestas(p, proponerDesdeHorario(p, [latin]).propuestas);
    const nueva = despues.archivos.classes.find((c) => c.class_id === 'Cls-LatESO3A')!;
    expect(Object.keys(nueva)).toEqual(cabecerasDe('classes'));
    expect(nueva.instructor_id).toBe('luislovelace');
    expect(nueva.location_id).toBe(p.opciones.locationId);
    expect(despues.tipos['Cls-LatESO3A']).toBe('asignatura');
  });
});
