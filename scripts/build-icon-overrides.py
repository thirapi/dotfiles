#!/usr/bin/env python3
"""Build Mocha-Icons app overrides: GNOME's own app icons on Colloid's tile.

Colloid's tiles are fine, but for some apps its artwork copies Apple's
(Software as the App Store, Music as Apple Music, ...). For those apps this
puts GNOME's official icon (from /usr/share/icons/hicolor) on a white tile
with Colloid's shadow and edge shading, so the dock stays uniform without
borrowing Apple's glyphs.

Run after installing or updating Colloid / GNOME apps:
    ./scripts/build-icon-overrides.py
"""

import os
import re

COLLOID = os.path.expanduser('~/.local/share/icons/Colloid-Orange-Catppuccin-Dark/apps/scalable')
HICOLOR = '/usr/share/icons/hicolor/scalable/apps'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', 'home', 'icons', '.local', 'share', 'icons', 'Mocha-Icons', 'apps', 'scalable')

# Icon names whose Colloid artwork imitates Apple's.
APPS = [
    'org.gnome.Software', 'org.gnome.Music', 'org.gnome.Settings', 'org.gnome.Maps',
    'org.gnome.Weather', 'org.gnome.Contacts', 'org.gnome.clocks', 'org.gnome.Calendar',
    'org.gnome.Snapshot', 'org.gnome.SoundRecorder', 'org.gnome.Calculator', 'evolution',
]

# Colloid tile geometry (viewBox 0 0 16.933 16.933).
TILE_X, TILE_Y, TILE_SIZE = 1.058, 1.05, 14.817
TILE_FILL = '#f5f5f7'
# GNOME's Settings gear is light grey and vanishes on white.
TILE_FILLS = {'org.gnome.Settings': '#c3c8d6'}
ART_SIZE = 12.2  # GNOME icons carry their own margin inside a 128px canvas


def colloid_frame():
    """The tile's drop shadow and edge shading, lifted from a Colloid icon."""
    svg = open(os.path.join(COLLOID, 'gnome-software.svg')).read()
    shadow = re.search(r'<image\b[^>]*/>', svg).group(0)
    shading = re.findall(r'<path\b[^>]*opacity="\.15"[^>]*/>', svg)
    return shadow, shading


def nested(icon_svg, x, y, size):
    """Re-root an SVG document as a nested <svg> placed at x, y."""
    start = re.search(r'<svg\b[^>]*>', icon_svg)
    root = start.group(0)
    body = icon_svg[start.end():icon_svg.rindex('</svg>')]
    namespaces = ' '.join(re.findall(r'xmlns(?::\w+)?="[^"]*"', root))
    view_box = re.search(r'viewBox="([^"]*)"', root)
    if view_box:
        view_box = view_box.group(1)
    else:
        w = re.search(r'\bwidth="([\d.]+)', root).group(1)
        h = re.search(r'\bheight="([\d.]+)', root).group(1)
        view_box = f'0 0 {w} {h}'
    return (f'<svg {namespaces} x="{x:.3f}" y="{y:.3f}" width="{size}" height="{size}" '
            f'viewBox="{view_box}">{body}</svg>')


def main():
    os.makedirs(OUT, exist_ok=True)
    shadow, shading = colloid_frame()
    centre_x = TILE_X + TILE_SIZE / 2
    centre_y = TILE_Y + TILE_SIZE / 2
    for name in APPS:
        source = os.path.join(HICOLOR, f'{name}.svg')
        if not os.path.exists(source):
            print(f'skip {name}: no GNOME icon')
            continue
        art = nested(open(source).read(),
                     centre_x - ART_SIZE / 2, centre_y - ART_SIZE / 2, ART_SIZE)
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
               'width="64" height="64" viewBox="0 0 16.933 16.933">'
               f'{shadow}'
               f'<rect width="{TILE_SIZE}" height="{TILE_SIZE}" x="{TILE_X}" y="{TILE_Y}" '
               f'fill="{TILE_FILLS.get(name, TILE_FILL)}" rx="3.44" ry="3.44"/>'
               f'{art}{"".join(shading)}</svg>')
        with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
            f.write(svg)
        print(f'built {name}')


if __name__ == '__main__':
    main()
