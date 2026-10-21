# Fase 4 · Repaso

> TEMPORAL: se borra con `plans/diseno-temporal/`.
> **Estado: BORRADOR.** Después de la fase 3.

## Para qué

Comprobar con ojos y con herramientas que la app es una sola, que se usa bien con el dedo y con
el teclado, y que el modo oscuro aguanta. Y dejar capturas de antes y después.

## Pasos

1. **Barrido de capturas.** Todas las rutas de `/gestion` y las públicas, en claro y oscuro, a 390 px
   (móvil), 820 px (iPad vertical) y 1180 px (iPad horizontal). Con datos inventados, como la galería
   de la auditoría (componentes reales con props falsas, sin tocar Neon). **Las capturas no se
   commitean** y nunca llevan datos reales de alumnado.
2. **Accesibilidad automática.** `@axe-core/playwright` sobre las mismas pantallas (instalado en una
   carpeta temporal, no en el repo): contraste, nombres de botones, roles de pestañas.
3. **Tamaños.** Un script que mida en el DOM todo lo tocable por debajo de 40 px y lo liste por pantalla.
4. **Teclado.** Recorrer con Tab cada pantalla: se llega a todo, el foco se ve, Esc cierra diálogos y hojas.
5. **Modo oscuro.** Ningún texto ilegible ni superficie blanca suelta (el logo del colegio puede
   quedarse sobre blanco a propósito).
6. **Movimiento reducido.** Con «reducir movimiento» en el sistema, nada se anima en bucle.
7. **En el iPad de verdad (David).** Una vuelta por los módulos que más usa, en vertical y en
   horizontal, con la app instalada (PWA). Apuntar lo raro en Tareas de la plataforma.
8. **Antes y después.** Las capturas de la auditoría (en el artefacto) frente a las nuevas, en el
   mismo artefacto o en uno nuevo, para que David lo vea de un vistazo.

## Hecho cuando

- [ ] Cero avisos graves de axe; contraste ≥ 4,5:1 en texto normal.
- [ ] Nada tocable por debajo de 40 px salvo excepciones apuntadas en `docs/diseno.md`.
- [ ] Revisión en iPad de David hecha.
- [ ] Fila de la fase 4 → HECHO.
