#!/usr/bin/env python3
"""Genera el juego de iconos de la PWA: emblema del colegio + insignia de herramientas.

Herramienta de un solo uso (no forma parte del build). Se ejecuta a mano cuando
cambie el diseño:

    pip install pillow && python3 scripts/icono-app.py

## El diseño

Dos marcas en un icono, no una sola:

- **El emblema del colegio** (la cruz + la C, sacada de `public/logobur.png` — ver
  `scripts/iconos-pwa.py`, que es quien sabe extraerlo de verdad y de quien se
  importan `emblema()` y `fondo()` en vez de duplicar esa extracción aquí),
  arriba a la izquierda: es lo que YA identificaba a la app y lo que se echaba en
  falta al probar el icono nuevo a solas.
- **Una insignia** (círculo azul con un engranaje simple, dibujado aquí mismo con
  formas — sin depender de ningún PNG suelto) abajo a la derecha: dice "esto es
  herramientas/gestión" sin competir con el emblema.

Por qué esta forma y no la ilustración completa (portapapeles + lápiz) que se usó
en el primer intento: a tamaño de favicon (16-32 px) un dibujo con tantos
elementos se convierte en una mancha. El emblema, por su trazo grueso y simple, sí
aguanta ese tamaño — por eso llevaba años siendo el icono — así que la insignia de
engranaje se queda pequeña y sencilla (un círculo + una forma), para sumar sin
estropear la legibilidad que ya funcionaba.

## Márgenes por variante

Mismo criterio que `iconos-pwa.py`: `any` dejan algo de aire (11 % en el lado más
apretado) con las esquinas redondeadas propias; `maskable` va a sangre y con
margen de sobra para que el recorte circular de Android (zona segura: círculo de
diámetro 80 % del icono) no coma ni el emblema ni la insignia — verificado por
script, no a ojo (ver `_ratio_maximo` más abajo).
"""

from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ModuleNotFoundError:  # pragma: no cover - herramienta manual
    sys.exit('Falta Pillow: pip install pillow')

RAIZ = Path(__file__).resolve().parent.parent

# `iconos-pwa.py` no es un módulo importable por su nombre (el guion no es válido
# en un identificador de Python), así que se carga por ruta. Sigue siendo el único
# sitio que sabe extraer el emblema de `public/logobur.png`.
_spec = importlib.util.spec_from_file_location('iconos_pwa', RAIZ / 'scripts' / 'iconos-pwa.py')
iconos_pwa = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(iconos_pwa)

AZUL = (8, 65, 116)  # #084174 — azul institucional (mismo que el emblema)
CELESTE = (110, 214, 245)  # celeste de la insignia (variante viva del #40B2D6 del emblema)

# Layout de la composición "any"/apple-touch/favicon: emblema arriba-izquierda,
# insignia abajo-derecha, sin que se toquen (probado a ojo, ver docstring).
LAYOUT_NORMAL = dict(emblema_centro=(0.40, 0.38), emblema_escala=0.46, badge_centro=(0.74, 0.74), badge_escala=0.32)

# Layout "maskable": la misma composición encogida hacia el centro (mismo factor
# para el emblema y la insignia, para no romper las proporciones) hasta que quepa
# en la zona segura. El factor 0.661 sale de `_ratio_maximo(LAYOUT_NORMAL) * f ≈ 0.33`
# (0,33 de radio máximo respecto al lado, con margen de sobra bajo el límite 0,40).
LAYOUT_MASKABLE = dict(emblema_centro=(0.434, 0.421), emblema_escala=0.304, badge_centro=(0.659, 0.659), badge_escala=0.211)


def insignia(diam: int) -> Image.Image:
    """Círculo azul institucional con un engranaje sencillo dentro. Todo vectorial
    (dibujado con formas, supersampleado x4 y reducido), nada de recortar PNGs."""
    s = 4
    d = diam * s
    circulo = Image.new('RGBA', (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(circulo).ellipse([0, 0, d, d], fill=AZUL + (255,))
    circulo = circulo.resize((diam, diam), Image.LANCZOS)

    gd = round(diam * 0.62) * s
    gear = Image.new('RGBA', (gd, gd), (0, 0, 0, 0))
    dr = ImageDraw.Draw(gear)
    cx = cy = gd / 2
    outer_r, root_r, hole_r = gd * 0.46, gd * 0.34, gd * 0.20
    n = 8
    medio_diente = (360 / n) * 0.24
    dr.ellipse([cx - root_r, cy - root_r, cx + root_r, cy + root_r], fill=CELESTE + (255,))
    for i in range(n):
        ang = 360 / n * i
        pts = [
            (cx + r * math.cos(math.radians(ang + delta)), cy + r * math.sin(math.radians(ang + delta)))
            for delta, r in ((-medio_diente, root_r), (-medio_diente * 0.7, outer_r), (medio_diente * 0.7, outer_r), (medio_diente, root_r))
        ]
        dr.polygon(pts, fill=CELESTE + (255,))
    dr.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r], fill=(0, 0, 0, 0))
    gear = gear.resize((round(diam * 0.62), round(diam * 0.62)), Image.LANCZOS)

    circulo.alpha_composite(gear, (round((diam - gear.width) / 2), round((diam - gear.height) / 2)))
    return circulo


def compone(lado: int, radio: float, layout: dict) -> Image.Image:
    lienzo = iconos_pwa.fondo(lado, radio)

    marca = iconos_pwa.emblema()
    util = lado * layout['emblema_escala']
    escala = min(util / marca.width, util / marca.height)
    m = marca.resize((max(1, round(marca.width * escala)), max(1, round(marca.height * escala))), Image.LANCZOS)
    cx, cy = lado * layout['emblema_centro'][0], lado * layout['emblema_centro'][1]
    lienzo.alpha_composite(m, (round(cx - m.width / 2), round(cy - m.height / 2)))

    b = insignia(round(lado * layout['badge_escala']))
    bx, by = lado * layout['badge_centro'][0], lado * layout['badge_centro'][1]
    lienzo.alpha_composite(b, (round(bx - b.width / 2), round(by - b.height / 2)))
    return lienzo


def _ratio_maximo(lado: int, layout: dict) -> float:
    """Radio máximo del dibujo real (emblema + insignia) respecto al centro, como
    fracción del lado — para comprobar la zona segura del maskable (límite 0,40)
    sin fiarse a ojo. Resta el fondo puro para no confundir el degradado con dibujo."""
    solo_fondo = iconos_pwa.fondo(lado, 0)
    con_dibujo = compone(lado, 0, layout)
    px_f, px_d = solo_fondo.load(), con_dibujo.load()
    cx = cy = lado / 2
    maxd = 0.0
    for y in range(0, lado, 2):
        for x in range(0, lado, 2):
            if px_f[x, y] != px_d[x, y]:
                maxd = max(maxd, math.hypot(x - cx, y - cy))
    return maxd / lado


def main() -> None:
    ratio = _ratio_maximo(512, LAYOUT_MASKABLE)
    print(f'zona segura maskable: dibujo al {ratio:.0%} del radio (límite 80%)')
    if ratio > 0.4:
        sys.exit('LAYOUT_MASKABLE se sale de la zona segura, ajusta la escala antes de generar')

    iconos = RAIZ / 'public' / 'icons'
    iconos.mkdir(parents=True, exist_ok=True)

    # purpose "any": esquinas redondeadas propias (transparentes fuera de ellas).
    compone(192, 0.22, LAYOUT_NORMAL).save(iconos / 'icon-192.png')
    compone(512, 0.22, LAYOUT_NORMAL).save(iconos / 'icon-512.png')
    # purpose "maskable": a sangre (radio 0 ya sale opaco, sin esquinas transparentes).
    compone(192, 0, LAYOUT_MASKABLE).save(iconos / 'icon-maskable-192.png')
    compone(512, 0, LAYOUT_MASKABLE).save(iconos / 'icon-maskable-512.png')
    # iOS: cuadrado opaco, ya lo redondea el sistema.
    compone(180, 0, LAYOUT_NORMAL).save(iconos / 'apple-touch-icon-180.png')
    compone(180, 0, LAYOUT_NORMAL).save(RAIZ / 'src' / 'app' / 'apple-icon.png')
    # Favicon.
    compone(128, 0, LAYOUT_NORMAL).save(RAIZ / 'src' / 'app' / 'icon.png')

    for p in sorted(iconos.glob('*.png')):
        print(' ', p.relative_to(RAIZ), Image.open(p).size)


if __name__ == '__main__':
    main()
