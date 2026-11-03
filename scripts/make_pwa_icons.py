import struct
import sys
import zlib
from pathlib import Path

# Brand colours from the style guide: obsidian background, neon green bars.
BACKGROUND = (0x13, 0x23, 0x22)
BAR_COLOUR = (0x3D, 0xDC, 0x91)

# The icon is drawn on a 32 x 32 grid and scaled to any size.
GRID = 32
# Bars of the barcode as (left, width) on the grid. They stay inside the central 80%
# of the icon, which is the safe zone of maskable icons.
BARS = [(8, 2), (11, 1), (13, 3), (17, 1), (19, 2), (22, 2)]
BAR_TOP = 10
BAR_BOTTOM = 22

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
RGB_COLOUR_TYPE = 2
BIT_DEPTH = 8
CRC_MASK = 0xFFFFFFFF
COMPRESSION_LEVEL = 9
BYTES_PER_PIXEL = 3

PUBLIC_DIR = Path(__file__).resolve().parents[1] / "frontend" / "public"
# File name -> side in pixels.
ICONS = {
    "icons/icon-192.png": 192,
    "icons/icon-512.png": 512,
    "apple-touch-icon.png": 180,
}


def _chunk(kind: bytes, data: bytes) -> bytes:
    """Builds one PNG chunk with its length and checksum.

    Args:
        kind: The four-letter chunk type.
        data: The chunk payload.

    Returns:
        The chunk bytes.
    """
    checksum = zlib.crc32(kind + data) & CRC_MASK
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def _row(size: int, with_bars: bool) -> bytes:
    """Builds one scanline of the icon, filter byte included.

    Args:
        size: Side of the icon in pixels.
        with_bars: Whether the row crosses the barcode.

    Returns:
        The scanline bytes.
    """
    pixels = bytearray()
    for x in range(size):
        cell = x * GRID // size
        in_bar = with_bars and any(left <= cell < left + width for left, width in BARS)
        pixels += bytes(BAR_COLOUR if in_bar else BACKGROUND)
    return b"\x00" + bytes(pixels)


def render_icon(size: int) -> bytes:
    """Draws the icon: a barcode in the brand green on the dark brand background.

    Args:
        size: Side of the square icon in pixels.

    Returns:
        The PNG file content.
    """
    plain, barred = _row(size, False), _row(size, True)
    rows = [
        barred if BAR_TOP <= y * GRID // size < BAR_BOTTOM else plain
        for y in range(size)
    ]
    header = struct.pack(">IIBBBBB", size, size, BIT_DEPTH, RGB_COLOUR_TYPE, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(b"".join(rows), level=COMPRESSION_LEVEL))
        + _chunk(b"IEND", b"")
    )


def write_icons(directory: Path = PUBLIC_DIR) -> list[Path]:
    """Writes every icon under a public directory.

    Args:
        directory: The folder that the web server publishes as its root.

    Returns:
        The paths of the written files.
    """
    written = []
    for name, size in ICONS.items():
        path = directory / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(render_icon(size))
        written.append(path)
    return written


def main() -> None:
    """Command line entry point: writes the icons into `frontend/public`."""
    for path in write_icons():
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
    sys.exit(0)
