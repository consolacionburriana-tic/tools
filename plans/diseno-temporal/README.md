# 🧹 TEMPORAL · Unificar el diseño de Tools Consolación

> **Esta carpeta entera es temporal.** Se creó el 20-oct-2026 para unificar el diseño de los
> módulos y **se borra completa cuando se termine** (fase 5): `git rm -r plans/diseno-temporal`.
> No enlaces nada permanente aquí. Lo que se queda al final es la guía `docs/diseno.md` y las
> piezas de `src/components/ui/`.
>
> No confundir con el resto de `plans/` (planes de agosto, todos hechos).

## Qué hay aquí

| Fichero | Qué es | Estado |
|---|---|---|
| [`auditoria.md`](./auditoria.md) | Lo que encontró la auditoría, módulo a módulo. Contexto para quien ejecute los planes | Hecho |
| [`fase-1-guia-y-piezas.md`](./fase-1-guia-y-piezas.md) | Guía `docs/diseno.md`, tokens, piezas comunes en `ui/`, escaparate y red de seguridad | BORRADOR |
| [`fase-2-cabeceras-y-esqueletos.md`](./fase-2-cabeceras-y-esqueletos.md) | Registro de módulos, cabecera y página comunes en los 22 layouts, `loading.tsx` en todas las rutas | BORRADOR |
| [`fase-3-modulo-a-modulo.md`](./fase-3-modulo-a-modulo.md) | Cambiar las piezas propias de cada módulo por las comunes, en orden de uso | BORRADOR |
| [`fase-4-repaso.md`](./fase-4-repaso.md) | Contraste, foco, tamaños, modo oscuro y capturas de antes y después | BORRADOR |
| [`fase-5-limpieza.md`](./fase-5-limpieza.md) | Borrar esta carpeta y el artefacto; dejar la guía | BORRADOR |
| [`arreglos-sueltos.md`](./arreglos-sueltos.md) | 5 fallos que salieron de paso (no son de diseño) | HECHO (21-oct) |

**BORRADOR** = escrito con mis propuestas por defecto; lo reescribo con las decisiones de David
antes de ejecutarlo. **LISTO** = se puede ejecutar. **HECHO** = ejecutado y verificado.

## Cómo se decide

Las decisiones se toman en el artefacto **«Diseño de Tools Consolación»**
(<https://claude.ai/artifact/FU1n5dXscsn3BEVLZ6C5op>, privado de David): galería con capturas
reales de 13 pantallas en claro y oscuro, 16 decisiones con ejemplos hechos con las clases de la
app, 16 buenas prácticas y el plan. Las respuestas se guardan en la base de datos del artefacto.

Cuando David diga «listo», Claude:
1. lee las respuestas del artefacto (colecciones `decisiones`, `galeria`, `practicas`, `notas`);
2. le propone la guía final y le pregunta lo que no esté claro;
3. reescribe los planes de las fases con lo decidido y los pasa de BORRADOR a LISTO.

Las decisiones van numeradas igual que en el artefacto (D01…D16). En los planes, lo que depende
de una decisión lleva su número entre corchetes, por ejemplo **[D07]**.

## Cómo se ejecuta

Una fase por sesión de agente: «ejecuta `plans/diseno-temporal/fase-2-cabeceras-y-esqueletos.md`».
Cada plan dice qué tocar, cómo comprobarlo y cuándo parar. Al terminar una fase, su fila de
arriba pasa a HECHO en el mismo commit.

**A partir del 1-nov-2026 manda la fuente única de alumnado** (`docs/06-fuente-unica-alumnado.md`):
estas fases se intercalan con ella, no la adelantan.

## Lo temporal que existe fuera de esta carpeta

- **El artefacto** de decisiones (enlace arriba). Se borra en la fase 5, con permiso de David.
- **La galería local de capturas** (`src/app/galeria-temporal/`): solo existió en el contenedor de la
  sesión del 20-oct-2026, excluida de git con `.git/info/exclude`. No está en el repo.

## Cómo borrarlo todo (fase 5)

```bash
git rm -r plans/diseno-temporal
git commit -m "Diseño: fuera los planes temporales (ya está la guía en docs/diseno.md)"
```

Antes de borrar: que `docs/diseno.md` exista y esté enlazada desde `AGENTS.md`, y que los
arreglos sueltos estén hechos o apuntados en `docs/pequeños-arreglos.md`.
