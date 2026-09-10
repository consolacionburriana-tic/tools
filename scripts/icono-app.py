#!/usr/bin/env python3
"""Genera el juego de iconos de la PWA a partir del nuevo icono de la app.

Herramienta de un solo uso (no forma parte del build). Se ejecuta a mano cuando
cambie el icono:

    pip install pillow && python3 scripts/icono-app.py

A diferencia de `iconos-pwa.py` (que recorta el EMBLEMA del logo del colegio de
`public/logobur.png`), aquí la fuente ya es un icono cuadrado completo y
diseñado como tal (`scripts/assets/icono-app-fuente.png`, 1254x1254): solo hace
falta reescalarlo a cada tamaño, y para "maskable" darle más margen y quitarle
la transparencia de las esquinas (los sistemas maskable ponen su propia
máscara — un icono con esquinas redondeadas propias + poco margen se recorta
mal en algunos launchers).

Ojo al orden aplanar → reescalar, no al revés: la fuente tiene las esquinas
redondeadas transparentes, y si se reescala ANTES de rellenarlas de color,
Pillow mezcla el RGB "de la nada" de los píxeles transparentes con los del
borde y deja un anillo oscuro visible al componer luego sobre fondo opaco.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - herramienta manual
    sys.exit('Falta Pillow: pip install pillow')

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / 'scripts' / 'assets' / 'icono-app-fuente.png'

# Color de fondo del icono fuente (para rellenar sus esquinas transparentes al
# generar variantes opacas / a sangre), sacado por muestreo del propio PNG.
FONDO = (2, 76, 144)

# Margen de la zona segura "maskable": los launchers recortan con su propia
# forma (círculo, squircle...) sobre TODO el cuadrado, así que el dibujo tiene
# que caber en un círculo centrado de diámetro ~80% del lado. La fuente ya
# trae algo de aire (el dibujo llega al 84,5% del radio) pero no el suficiente
# (el límite es 80%), así que aquí se encoge un poco más, con margen de sobra.
MARGEN_MASKABLE = 0.11


def aplanar(im: Image.Image) -> Image.Image:
    """La fuente sin transparencia: esquinas rellenas con el color de fondo,
    hecho a la resolución NATIVA antes de reescalar nada (ver docstring)."""
    base = Image.new('RGBA', im.size, FONDO + (255,))
    base.alpha_composite(im)
    return base


def maskable(opaca: Image.Image, lado: int) -> Image.Image:
    """A sangre (sin transparencia) y con margen extra para la zona segura.
    Recibe ya la versión aplanada — nunca la fuente con transparencia."""
    base = Image.new('RGBA', (lado, lado), FONDO + (255,))
    util = round(lado * (1 - 2 * MARGEN_MASKABLE))
    dibujo = opaca.resize((util, util), Image.LANCZOS)
    off = (lado - util) // 2
    base.paste(dibujo, (off, off))
    return base


def main() -> None:
    fuente = Image.open(FUENTE).convert('RGBA')
    print(f'fuente {fuente.width}x{fuente.height} px')
    opaca = aplanar(fuente)
    iconos = RAIZ / 'public' / 'icons'
    iconos.mkdir(parents=True, exist_ok=True)

    # purpose "any": el sistema lo pinta tal cual, con las esquinas redondeadas
    # que ya trae la propia fuente (transparentes fuera de ellas).
    fuente.resize((192, 192), Image.LANCZOS).save(iconos / 'icon-192.png')
    fuente.resize((512, 512), Image.LANCZOS).save(iconos / 'icon-512.png')
    # purpose "maskable": a sangre, con la zona segura respetada.
    maskable(opaca, 192).save(iconos / 'icon-maskable-192.png')
    maskable(opaca, 512).save(iconos / 'icon-maskable-512.png')
    # iOS: cuadrado opaco, ya lo redondea el sistema.
    opaca.resize((180, 180), Image.LANCZOS).save(iconos / 'apple-touch-icon-180.png')
    opaca.resize((180, 180), Image.LANCZOS).save(RAIZ / 'src' / 'app' / 'apple-icon.png')
    # Favicon.
    opaca.resize((128, 128), Image.LANCZOS).save(RAIZ / 'src' / 'app' / 'icon.png')

    for p in sorted(iconos.glob('*.png')):
        print(' ', p.relative_to(RAIZ), Image.open(p).size)


if __name__ == '__main__':
    main()
