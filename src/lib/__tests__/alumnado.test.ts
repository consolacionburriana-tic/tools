import { describe, expect, it } from 'vitest';
import {
  avisoCumple,
  aplicaMaterial,
  avisoProteccion,
  describirDestinos,
  estadoVisible,
  generalProteccion,
  siguienteEstadoMaterial,
  siguienteGeneral,
  casaBusqueda,
  claseLarga,
  colorAvatar,
  correosUnicos,
  delExtra,
  diasHastaCumple,
  domicilio,
  edadEnAnios,
  esCorreo,
  indiceDeBusqueda,
  iniciales,
  noAutorizados,
  normalizar,
  siNo,
  sinConstar,
  tieneProteccion,
  telefono,
  whatsapp,
} from '@/lib/alumnado';
import { listaEtapas } from '@/components/alumnado/alumnado-panel';
import { puedeConAlumno } from '@/lib/alumnado-server';

describe('normalizar', () => {
  it('quita acentos, mayúsculas y signos', () => {
    expect(normalizar('Aitana PITARCH Roldán')).toBe('aitana pitarch roldan');
    expect(normalizar('  Mª  José   Gil-Soler ')).toBe('m jose gil soler');
  });

  it('respeta la ñ, que sí distingue nombres', () => {
    expect(normalizar('Muñoz')).toBe('munoz');
    expect(normalizar('Ñuño')).toBe('nuno');
  });

  it('aguanta null sin quejarse', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('búsqueda', () => {
  const indice = indiceDeBusqueda({
    nombre: 'Aitana',
    apellido1: 'Pitarch',
    apellido2: 'Roldán',
    clase: '2º ESO B',
    nia: '11430523',
    dni: '20123456J',
    codigo: '14PITROL',
  });

  it('encuentra por trozos y en cualquier orden', () => {
    expect(casaBusqueda(indice, 'aitana')).toBe(true);
    expect(casaBusqueda(indice, 'roldan aitana')).toBe(true);
    expect(casaBusqueda(indice, 'PITARCH')).toBe(true);
  });

  it('encuentra por acentos escritos de cualquier manera', () => {
    expect(casaBusqueda(indice, 'roldán')).toBe(true);
    expect(casaBusqueda(indice, 'roldan')).toBe(true);
  });

  it('encuentra por NIA, DNI, código y clase', () => {
    expect(casaBusqueda(indice, '11430')).toBe(true);
    expect(casaBusqueda(indice, '20123456j')).toBe(true);
    expect(casaBusqueda(indice, '14pitrol')).toBe(true);
    expect(casaBusqueda(indice, '2 eso b')).toBe(true);
  });

  it('no encuentra a quien no es', () => {
    expect(casaBusqueda(indice, 'martinez')).toBe(false);
    expect(casaBusqueda(indice, 'aitana martinez')).toBe(false);
  });

  it('sin término, todo casa (la lista no se vacía al borrar el buscador)', () => {
    expect(casaBusqueda(indice, '')).toBe(true);
    expect(casaBusqueda(indice, '   ')).toBe(true);
  });
});

describe('edad y cumpleaños', () => {
  const hoy = new Date(2026, 8, 10); // 10-sep-2026

  it('cuenta la edad sin adelantarla', () => {
    expect(edadEnAnios('2013-01-29', hoy)).toBe(13); // ya cumplió este año
    expect(edadEnAnios('2013-12-05', hoy)).toBe(12); // aún no
    expect(edadEnAnios('2013-09-10', hoy)).toBe(13); // justo hoy
  });

  it('dice cuántos días faltan', () => {
    expect(diasHastaCumple('2013-09-10', hoy)).toBe(0);
    expect(diasHastaCumple('2013-09-11', hoy)).toBe(1);
    expect(diasHastaCumple('2013-09-09', hoy)).toBe(364); // ya pasó: el del año que viene
  });

  it('avisa solo si es esta semana', () => {
    expect(avisoCumple('2013-09-10', hoy)).toBe('Cumple hoy 🎂');
    expect(avisoCumple('2013-09-11', hoy)).toBe('Cumple mañana 🎂');
    expect(avisoCumple('2013-09-14', hoy)).toBe('Cumple en 4 días');
    expect(avisoCumple('2013-11-20', hoy)).toBeNull();
  });

  it('devuelve null sin fecha o con una fecha que no se entiende', () => {
    expect(edadEnAnios(null)).toBeNull();
    expect(edadEnAnios('vete a saber')).toBeNull();
    expect(avisoCumple(null)).toBeNull();
  });
});

describe('teléfonos', () => {
  it('agrupa los móviles españoles y deja el tel: limpio', () => {
    expect(telefono('618609291')).toEqual({ texto: '618 609 291', tel: '+34618609291' });
    // Educamos los manda también con espacios puestos a mano.
    expect(telefono('661 61 40 20')).toEqual({ texto: '661 614 020', tel: '+34661614020' });
    // Y como número, cuando la fila viene de un Excel.
    expect(telefono(605351864)).toEqual({ texto: '605 351 864', tel: '+34605351864' });
  });

  it('no inventa un enlace para lo que no es un teléfono', () => {
    expect(telefono('ext. 24')).toEqual({ texto: 'ext. 24', tel: '' });
    expect(telefono('')).toBeNull();
    expect(telefono(null)).toBeNull();
  });

  it('ofrece WhatsApp solo con móviles', () => {
    expect(whatsapp('618609291')).toBe('34618609291');
    expect(whatsapp('964510123')).toBeNull(); // fijo de Castellón
    expect(whatsapp('ext. 24')).toBeNull();
  });
});

describe('correos', () => {
  it('reconoce lo que es un correo', () => {
    expect(esCorreo('ana@ejemplo.com')).toBe(true);
    expect(esCorreo('ana@ejemplo')).toBe(false);
    expect(esCorreo('no tengo')).toBe(false);
  });

  it('deduplica sin distinguir mayúsculas y tira la basura', () => {
    expect(correosUnicos(['Ana@Ejemplo.com', 'ana@ejemplo.com', '', null, 'no-es-correo', 'luis@x.es'])).toEqual([
      'ana@ejemplo.com',
      'luis@x.es',
    ]);
  });
});

describe('domicilio', () => {
  it('recompone la dirección repartida en el extra del tutor', () => {
    const d = domicilio(
      {
        'TIPO VÍA TUTOR1': 'C/',
        'CALLE TUTOR1': 'Mayor',
        'NÚMERO TUTOR1': '14',
        'ESCALERA TUTOR1': '2',
        'PISO TUTOR1': '3',
        'PUERTA TUTOR1': 'B',
      },
      { cp: '12530', localidad: 'BURRIANA', provincia: 'CASTELLÓN' },
    );
    expect(d?.calle).toBe('C/ Mayor 14, esc. 2, 3º B');
    expect(d?.poblacion).toBe('12530 BURRIANA (CASTELLÓN)');
    expect(d?.completo).toBe('C/ Mayor 14, esc. 2, 3º B · 12530 BURRIANA (CASTELLÓN)');
  });

  it('vale igual con las claves del segundo tutor', () => {
    const d = domicilio({ 'CALLE TUTOR2': 'Pl. del Pla', 'NÚMERO TUTOR2': '3' });
    expect(d?.calle).toBe('Pl. del Pla 3');
  });

  it('no se rompe si solo hay población, ni devuelve nada si no hay nada', () => {
    expect(domicilio(null, { localidad: 'BURRIANA' })?.completo).toBe('BURRIANA');
    expect(domicilio(null)).toBeNull();
    expect(domicilio({})).toBeNull();
  });
});

describe('banderitas del extra', () => {
  it('traduce el TRUE/FALSE de Educamos', () => {
    expect(siNo('TRUE')).toBe(true);
    expect(siNo('FALSE')).toBe(false);
    expect(siNo('sí')).toBe(true);
    expect(siNo('')).toBeNull();
    expect(siNo(null)).toBeNull();
    expect(siNo('a saber')).toBeNull();
  });

  it('encuentra la clave sin saber el sufijo ni los acentos', () => {
    const extra = { 'FAM.NUMEROSA': 'TRUE', 'TEL EMERGENCIA ALUMNO': '600112233', 'FALLECIDO TUTOR1': 'FALSE' };
    expect(delExtra(extra, 'fam numerosa')).toBe('TRUE');
    expect(delExtra(extra, 'tel emergencia')).toBe('600112233');
    expect(delExtra(extra, 'fallecido')).toBe('FALSE');
    expect(delExtra(extra, 'no existe')).toBeNull();
    expect(delExtra(null, 'lo que sea')).toBeNull();
  });
});

describe('clase y avatar', () => {
  it('escribe la clase como la dice el colegio', () => {
    expect(claseLarga('2ESO', 'B')).toBe('2º ESO B');
    expect(claseLarga('3INF', 'A')).toBe('3º INF A');
    expect(claseLarga('1PRI', null)).toBe('1º PRI');
    expect(claseLarga(null, 'A')).toBe('—');
  });

  it('no duplica el PDC ni le añade otro ordinal', () => {
    // Tal y como viene de Educamos: curso '3ºPPDC' y letra 'PDC'.
    expect(claseLarga('3ºPPDC', 'PDC')).toBe('3º PDC');
    expect(claseLarga('4ºPPDC', 'PDC')).toBe('4º PDC');
  });

  it('saca iniciales y un color estable', () => {
    expect(iniciales('Aitana', 'Pitarch')).toBe('AP');
    expect(colorAvatar('abc')).toBe(colorAvatar('abc'));
  });
});

describe('etapas, tal y como se dicen', () => {
  it('las escribe en el orden del colegio y con «y» al final', () => {
    expect(listaEtapas(['ESO'])).toBe('Secundaria');
    expect(listaEtapas(['EP', 'EI'])).toBe('Infantil y Primaria');
    expect(listaEtapas(['ESO', 'EI', 'EP'])).toBe('Infantil, Primaria y Secundaria');
  });

  it('sin etapas no inventa un nombre', () => {
    expect(listaEtapas([])).toBe('tu etapa');
  });
});

describe('quién puede con qué alumno', () => {
  const infantil = { curso: '3INF', letra: 'A' };
  const eso2b = { curso: '2ESO', letra: 'B' };
  const eso4a = { curso: '4ESO', letra: 'A' };
  const pdc = { curso: '3ºPPDC', letra: 'PDC' };

  it('con alcance null (dirección, TIC…) puede con todos', () => {
    for (const a of [infantil, eso2b, pdc]) expect(puedeConAlumno(null, a)).toBe(true);
  });

  it('un tutor de ESO puede con toda su etapa, no solo con su clase', () => {
    // Es el cambio de criterio del 10-sep-2026: el alcance es la ETAPA.
    const suEtapa = [eso2b, eso4a, pdc];
    expect(puedeConAlumno(suEtapa, eso2b)).toBe(true);
    expect(puedeConAlumno(suEtapa, eso4a)).toBe(true);
    expect(puedeConAlumno(suEtapa, pdc)).toBe(true);
  });

  it('…pero no cruza a otra etapa', () => {
    expect(puedeConAlumno([eso2b, eso4a], infantil)).toBe(false);
  });

  it('con alcance vacío (sin etapa asignada) no puede con nadie', () => {
    expect(puedeConAlumno([], eso2b)).toBe(false);
    expect(puedeConAlumno([], infantil)).toBe(false);
  });

  it('distingue la letra, y trata null y ausente igual', () => {
    expect(puedeConAlumno([{ curso: '2ESO', letra: 'A' }], eso2b)).toBe(false);
    expect(puedeConAlumno([{ curso: '2ESO', letra: null }], { curso: '2ESO', letra: null })).toBe(true);
  });
});

describe('protección de datos', () => {
  const pd = (campos: Partial<Parameters<typeof avisoProteccion>[0]> = {}) => ({
    imagen: null,
    redes: null,
    ampa: null,
    ong: null,
    desestimaCorreo: false,
    notas: null,
    actualizadoAt: null,
    actualizadoPor: null,
    ...campos,
  });

  it('un NO a la imagen manda sobre todo lo demás y sale en rojo', () => {
    const aviso = avisoProteccion(pd({ imagen: false, redes: false, ampa: true, ong: true }));
    expect(aviso.tono).toBe('rojo');
    expect(aviso.texto).toBe('NO puede salir en fotos');
    // El de imagen no se repite en el detalle: ya lo dice el texto.
    expect(aviso.detalle).toBe('tampoco redes');
  });

  it('un no a las otras es ámbar y dice a cuáles', () => {
    const aviso = avisoProteccion(pd({ imagen: true, redes: false, ampa: false, ong: true }));
    expect(aviso.tono).toBe('ambar');
    expect(aviso.texto).toBe('Sin permiso de redes, AMPA');
  });

  it('con huecos sin marcar: gris, y dice cuáles faltan', () => {
    const aviso = avisoProteccion(pd({ imagen: true, redes: true }));
    expect(aviso.tono).toBe('gris');
    expect(aviso.detalle).toBe('sin marcar: AMPA, ONG');
  });

  it('todo autorizado: verde y en una línea', () => {
    const aviso = avisoProteccion(pd({ imagen: true, redes: true, ampa: true, ong: true }));
    expect(aviso).toEqual({ tono: 'verde', texto: 'Imagen autorizada', detalle: undefined });
  });

  it('la desestimación del correo va de coletilla, sin cambiar el tono', () => {
    const verde = avisoProteccion(pd({ imagen: true, redes: true, ampa: true, ong: true, desestimaCorreo: true }));
    expect(verde).toEqual({ tono: 'verde', texto: 'Imagen autorizada', detalle: 'sin correo del alumno' });
    const rojo = avisoProteccion(pd({ imagen: false, redes: false, ampa: true, ong: true, desestimaCorreo: true }));
    expect(rojo.detalle).toBe('tampoco redes · sin correo del alumno');
  });

  it('«no consta» no es «ha dicho que no»', () => {
    const solo = pd({ imagen: false });
    expect(noAutorizados(solo)).toEqual(['imagen']);
    expect(sinConstar(solo)).toEqual(['redes', 'AMPA', 'ONG']);
  });

  it('el check general se deduce de los cuatro', () => {
    expect(generalProteccion(pd({ imagen: true, redes: true, ampa: true, ong: true }))).toBe('si');
    expect(generalProteccion(pd({ imagen: false, redes: false, ampa: false, ong: false }))).toBe('no');
    // Un no suelto: «parcial», que es lo que obliga a desplegar el detalle.
    expect(generalProteccion(pd({ imagen: true, redes: true, ampa: true, ong: false }))).toBe('parcial');
    expect(generalProteccion(pd({ imagen: true, redes: null, ampa: false, ong: true }))).toBe('parcial');
    // Huecos sin ningún no: sin constar, no «sí».
    expect(generalProteccion(pd({ imagen: true, redes: true }))).toBeNull();
    expect(generalProteccion(pd())).toBeNull();
  });

  it('un toque en la general pone todo a no si estaba todo a sí, y si no, todo a sí', () => {
    expect(siguienteGeneral('si')).toBe(false);
    expect(siguienteGeneral('no')).toBe(true);
    expect(siguienteGeneral('parcial')).toBe(true);
    expect(siguienteGeneral(null)).toBe(true);
  });

  it('tieneProteccion distingue lo vacío de lo anotado', () => {
    expect(tieneProteccion(pd())).toBe(false);
    expect(tieneProteccion(pd({ ong: true }))).toBe(true);
    expect(tieneProteccion(pd({ desestimaCorreo: true }))).toBe(true);
    expect(tieneProteccion(pd({ notas: 'solo fotos de grupo' }))).toBe(true);
  });
});

describe('venta de materiales', () => {
  const eso3a = { curso: '3ESO', letra: 'A' };
  const pdc3 = { curso: '3ºPPDC', letra: 'PDC' };
  const pri2b = { curso: '2PRI', letra: 'B' };

  it('un material va a una etapa, a un curso o a clases sueltas, y se mezclan', () => {
    expect(aplicaMaterial([{ tipo: 'etapa', etapa: 'EP' }], pri2b)).toBe(true);
    expect(aplicaMaterial([{ tipo: 'etapa', etapa: 'EP' }], eso3a)).toBe(false);
    expect(aplicaMaterial([{ tipo: 'curso', curso: '3ESO' }], eso3a)).toBe(true);
    expect(aplicaMaterial([{ tipo: 'clase', curso: '3ESO', letra: 'B' }], eso3a)).toBe(false);
    expect(
      aplicaMaterial([{ tipo: 'etapa', etapa: 'EP' }, { tipo: 'clase', curso: '3ESO', letra: 'A' }], eso3a),
    ).toBe(true);
    expect(aplicaMaterial([], eso3a)).toBe(false);
    expect(aplicaMaterial([{ tipo: 'etapa', etapa: 'ESO' }], { curso: null, letra: null })).toBe(false);
  });

  it('un curso de ESO incluye a su PDC, y el PDC es de Secundaria', () => {
    expect(aplicaMaterial([{ tipo: 'curso', curso: '3ESO' }], pdc3)).toBe(true);
    expect(aplicaMaterial([{ tipo: 'curso', curso: '4ESO' }], pdc3)).toBe(false);
    expect(aplicaMaterial([{ tipo: 'etapa', etapa: 'ESO' }], pdc3)).toBe(true);
  });

  it('el ciclo de la celda empieza en «sí» y la beca solo sale a quien la ve', () => {
    expect(siguienteEstadoMaterial(null)).toBe('pagado');
    expect(siguienteEstadoMaterial('pagado')).toBe('no');
    expect(siguienteEstadoMaterial('no')).toBe('becado');
    expect(siguienteEstadoMaterial('becado')).toBe('no_aplica');
    expect(siguienteEstadoMaterial('no_aplica')).toBeNull();
    expect(siguienteEstadoMaterial('no', false)).toBe('no_aplica');
  });

  it('becado se ve como pagado para quien no deba saberlo', () => {
    expect(estadoVisible('becado', false)).toBe('pagado');
    expect(estadoVisible('becado', true)).toBe('becado');
    expect(estadoVisible('no', false)).toBe('no');
    expect(estadoVisible(null, false)).toBeNull();
  });

  it('describe a quién va en una línea', () => {
    expect(
      describirDestinos([
        { tipo: 'etapa', etapa: 'EP' },
        { tipo: 'curso', curso: '1ESO' },
        { tipo: 'clase', curso: '2ESO', letra: 'B' },
      ]),
    ).toBe('Primaria · 1º ESO · 2º ESO B');
  });
});
