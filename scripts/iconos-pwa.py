#!/usr/bin/env python3
"""Genera el juego de iconos de la PWA a partir del logo del colegio.

Herramienta de un solo uso (no forma parte del build). Se ejecuta a mano cuando
cambie el logo o haga falta un tamaño nuevo:

    pip install pillow && python3 scripts/iconos-pwa.py

De dónde sale el dibujo: `public/logobur.png` es el lockup horizontal (emblema +
"Consolación" + bajada). El **emblema** que se usa como icono es la marca de trazos
con la cruz MÁS la C, y se extrae así:

  1. Se etiquetan los componentes conexos de tinta del PNG. Los trazos del emblema
     son componentes propios; toda la palabra "Consolación" es UN único componente
     (es caligrafía, va todo unido), así que no se puede aislar la C por color.
  2. De ese componente grande se toman solo los píxeles con `x <= CORTE_C`, que es
     donde el trazo de la C termina de forma natural (probado a 145, 152, 158, 165:
     145 es el que no deja canto plano visible).
  3. Se recorta al bbox del resultado y se compone centrado sobre fondo claro, sin
     recolorear NADA: el azul #084174 y el celeste #40B2D6 son los oficiales.

Por qué fondo claro y no azul: recolorear el emblema para que se vea sobre azul
exige separar dos tintas con antialiasing sobre blanco, y deja halos. Con fondo
claro el emblema va tal cual salió de imprenta.

Resolución: el emblema mide ~136x204 px en el origen, así que el icono de 192
queda casi 1:1 (nítido) y el de 512 se amplía 1,7x (bordes algo suaves, pero solo
se usa para splash/instalación). Si algún día aparece el logo VECTORIAL, lo suyo
es rasterizar de ahí: cambiar `ORIGEN` por el SVG rasterizado a 1024 y listo.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ModuleNotFoundError:  # pragma: no cover - herramienta manual
    sys.exit('Falta Pillow: pip install pillow')

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'public' / 'logobur.png'

CORTE_C = 145  # x hasta donde llega el trazo de la C (ver docstring)
AZUL = (8, 65, 116)  # #084174 azul institucional
CLARO = (64, 178, 214)  # #40B2D6 celeste del emblema
FONDO_ALTO = (255, 255, 255)
FONDO_BAJO = (233, 243, 250)  # #E9F3FA — un velo azulado, para que no sea blanco plano


def es_tinta(px, x: int, y: int) -> bool:
    r, _g, _b, a = px[x, y]
    return a > 80 and r < 230


def componentes(im: Image.Image):
    """Componentes conexos (8-vecinos) de la tinta del logo."""
    px = im.load()
    w, h = im.size
    visto = bytearray(w * h)
    fuera = []
    for x0 in range(w):
        for y0 in range(h):
            if visto[y0 * w + x0] or not es_tinta(px, x0, y0):
                continue
            cola = deque([(x0, y0)])
            visto[y0 * w + x0] = 1
            puntos = []
            while cola:
                x, y = cola.popleft()
                puntos.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not visto[ny * w + nx] and es_tinta(px, nx, ny):
                            visto[ny * w + nx] = 1
                            cola.append((nx, ny))
            fuera.append(puntos)
    return sorted(fuera, key=len, reverse=True)


def emblema() -> Image.Image:
    """El emblema recortado y con fondo transparente."""
    im = Image.open(ORIGEN).convert('RGBA')
    src = im.load()
    comps = componentes(im)
    lettering = comps[0]  # "Consolación" entero, un solo trazo
    trazos = [c for c in comps[1:] if len(c) > 150 and max(p[0] for p in c) < 140 and max(p[1] for p in c) < 200]

    salida = Image.new('RGBA', im.size, (0, 0, 0, 0))
    dst = salida.load()
    for comp in trazos:
        for x, y in comp:
            dst[x, y] = src[x, y]
    for x, y in lettering:
        if x <= CORTE_C:
            dst[x, y] = src[x, y]

    return salida.crop(salida.getbbox())


def fondo(lado: int, radio: float) -> Image.Image:
    """Cuadrado con degradado vertical muy leve y esquinas opcionales."""
    grad = Image.new('RGBA', (lado, lado))
    d = ImageDraw.Draw(grad)
    for y in range(lado):
        t = y / max(1, lado - 1)
        color = tuple(round(FONDO_ALTO[i] * (1 - t) + FONDO_BAJO[i] * t) for i in range(3))
        d.line([(0, y), (lado, y)], fill=color + (255,))
    if radio <= 0:
        return grad
    mascara = Image.new('L', (lado, lado), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, lado - 1, lado - 1], radius=round(lado * radio), fill=255)
    grad.putalpha(mascara)
    return grad


def icono(marca: Image.Image, lado: int, margen: float, radio: float) -> Image.Image:
    """Emblema centrado sobre el fondo, ocupando (1 - 2*margen) del lado."""
    lienzo = fondo(lado, radio)
    util = lado * (1 - 2 * margen)
    escala = min(util / marca.width, util / marca.height)
    m = marca.resize((max(1, round(marca.width * escala)), max(1, round(marca.height * escala))), Image.LANCZOS)
    # Centrado óptico: el emblema pesa arriba (los trazos), así que baja un pelín.
    lienzo.alpha_composite(m, (round((lado - m.width) / 2), round((lado - m.height) / 2 + lado * 0.012)))
    return lienzo


def opaco(im: Image.Image) -> Image.Image:
    """iOS no admite transparencia en el apple-touch-icon."""
    plano = Image.new('RGBA', im.size, FONDO_ALTO + (255,))
    plano.alpha_composite(im)
    return plano.convert('RGB').convert('RGBA')


def main() -> None:
    marca = emblema()
    print(f'emblema {marca.width}x{marca.height} px')
    iconos = RAIZ / 'public' / 'icons'
    iconos.mkdir(parents=True, exist_ok=True)

    # purpose "any": el sistema lo pinta tal cual → esquinas redondeadas propias.
    icono(marca, 192, 0.11, 0.22).save(iconos / 'icon-192.png')
    icono(marca, 512, 0.11, 0.22).save(iconos / 'icon-512.png')
    # purpose "maskable": a sangre y con zona segura (el recorte puede ser circular).
    icono(marca, 192, 0.21, 0).save(iconos / 'icon-maskable-192.png')
    icono(marca, 512, 0.21, 0).save(iconos / 'icon-maskable-512.png')
    # iOS: cuadrado opaco, ya lo redondea el sistema.
    opaco(icono(marca, 180, 0.11, 0)).save(iconos / 'apple-touch-icon-180.png')
    opaco(icono(marca, 180, 0.11, 0)).save(RAIZ / 'src' / 'app' / 'apple-icon.png')
    # Favicon: más apretado, que a 32 px se vea algo.
    icono(marca, 128, 0.05, 0.2).save(RAIZ / 'src' / 'app' / 'icon.png')

    for p in sorted(iconos.glob('*.png')):
        print(' ', p.relative_to(RAIZ), Image.open(p).size)


if __name__ == '__main__':
    main()
