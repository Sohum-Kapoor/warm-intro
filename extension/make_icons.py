#!/usr/bin/env python3
"""Draw the Warm Intro toolbar icons with the standard library only.

A grey-green rounded square with two paper dots joined by a line: two members,
one introduction. Rendered at 4x and box-filtered down for anti-aliasing.

    python3 extension/make_icons.py
"""
import math
import pathlib
import struct
import zlib

HERE = pathlib.Path(__file__).resolve().parent
ACCENT = (92, 107, 84)     # #5c6b54, the palette accent ("Three stones")
DOT = (246, 246, 245)      # #f6f6f5, the palette paper
SS = 4                     # supersampling factor


def png(path: pathlib.Path, size: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def rounded_box(x: float, y: float, half: float, radius: float) -> float:
    """Signed distance to a rounded square centred at 0.5,0.5."""
    qx = abs(x - 0.5) - half + radius
    qy = abs(y - 0.5) - half + radius
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - radius


def segment(x, y, ax, ay, bx, by) -> float:
    px, py, dx, dy = x - ax, y - ay, bx - ax, by - ay
    t = max(0.0, min(1.0, (px * dx + py * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - dx * t, py - dy * t)


def draw(size: int) -> bytes:
    small = size <= 32
    a, b = (0.31, 0.62), (0.69, 0.38)
    r_dot = 0.135 if small else 0.115
    w_line = 0.055 if small else 0.04
    half = 0.5 if small else 0.47          # full bleed at tiny sizes
    radius = 0.22
    n = size * SS
    out = bytearray()
    for py in range(size):
        for px in range(size):
            bg = fg = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) / n
                    y = (py * SS + sy + 0.5) / n
                    if rounded_box(x, y, half, radius) <= 0:
                        bg += 1
                        d = min(math.hypot(x - a[0], y - a[1]) - r_dot,
                                math.hypot(x - b[0], y - b[1]) - r_dot,
                                segment(x, y, *a, *b) - w_line)
                        if d <= 0:
                            fg += 1
            total = SS * SS
            if bg == 0:
                out += bytes((0, 0, 0, 0))
                continue
            t = fg / bg
            rgb = [round(ACCENT[i] * (1 - t) + DOT[i] * t) for i in range(3)]
            out += bytes((*rgb, round(255 * bg / total)))
    return bytes(out)


def main() -> None:
    (HERE / "icons").mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        png(HERE / "icons" / f"icon{size}.png", size, draw(size))
        print(f"icons/icon{size}.png")


if __name__ == "__main__":
    main()
