import { describe, expect, it } from 'vitest';
import { contar, excesos, rebajar } from '@/lib/guardia-diseno';

const MODULO = 'src/components/tableros/tablero.tsx';
const GESTION = 'src/app/gestion/licencias/page.tsx';

describe('guardia del diseño: qué cuenta', () => {
  it('los diálogos del navegador, pero no nuestras funciones que se llaman parecido', () => {
    const texto = `
      if (!confirm('¿Seguro?')) return;
      const n = window.prompt('Nombre');
      alert('Hecho');
      await confirmar({ titulo: 'x' });
      haptic.confirm();
      const { confirmar: c } = useConfirmar();
      <p>Nunca confirm() ni prompt() del navegador.</p>
    `;
    expect(contar(MODULO, texto)).toEqual({ navegador: 3 });
  });

  it('las constantes de estilo propias de botones y campos', () => {
    const texto = `
      export const BOTON_PRIMARIO = 'h-10';
      const ESTILO_CAMPO = 'h-11';
      export const CAMPO = 'x';
      const BTN_GHOST = 'y';
      const CAMPOS_OBLIGATORIOS = ['a'];
      const botonera = 1;
    `;
    expect(contar(MODULO, texto)).toEqual({ estilos: 5 });
  });

  it('letra de 9 a 11 px a mano, no la de 12 o más', () => {
    expect(contar(MODULO, `<p className="text-[10px] text-[11px] text-[9.5px] text-[12px] text-[13px]">`)).toEqual({
      letra: 3,
    });
  });

  it('acciones que solo salen con el ratón', () => {
    const texto = `<button className="opacity-0 transition group-hover:opacity-100">x</button><span className="opacity-0">y</span>`;
    expect(contar(MODULO, texto)).toEqual({ hover: 1 });
  });

  it('la cabecera propia solo cuenta en /gestion', () => {
    expect(contar(GESTION, '<header className="x">')).toEqual({ cabecera: 1 });
    expect(contar('src/app/(public)/licencias/page.tsx', '<header className="x">')).toEqual({});
  });

  it('no mira las piezas comunes ni lo que solo se menciona en un comentario', () => {
    expect(contar('src/components/ui/avatar.tsx', `const x = 'text-[10px]'; confirm('a');`)).toEqual({});
    expect(contar(MODULO, `// antes había un confirm() aquí\n/* text-[10px] */\nconst a = 1;`)).toEqual({});
  });
});

describe('guardia del diseño: la lista solo baja', () => {
  const permitido = { 'a.tsx': { navegador: 2, letra: 5 }, 'b.tsx': { hover: 1 } };

  it('falla si un fichero sube o si aparece uno nuevo', () => {
    const actual = { 'a.tsx': { navegador: 3, letra: 1 }, 'c.tsx': { estilos: 1 } };
    expect(excesos(actual, permitido)).toEqual([
      { ruta: 'a.tsx', regla: 'navegador', antes: 2, ahora: 3 },
      { ruta: 'c.tsx', regla: 'estilos', antes: 0, ahora: 1 },
    ]);
  });

  it('al rebajar se queda con lo menor y quita lo que llega a cero', () => {
    const actual = { 'a.tsx': { navegador: 9, letra: 1 }, 'c.tsx': { estilos: 4 } };
    expect(rebajar(actual, permitido)).toEqual({ 'a.tsx': { navegador: 2, letra: 1 } });
  });
});
