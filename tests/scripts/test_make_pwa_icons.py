import struct
import zlib

import pytest

from scripts.make_pwa_icons import (
    BACKGROUND,
    BAR_COLOUR,
    ICONS,
    PNG_SIGNATURE,
    render_icon,
    write_icons,
)


def _size_of(png: bytes) -> tuple[int, int]:
    """Reads the width and height from a PNG header.

    Args:
        png: The PNG file content.

    Returns:
        The width and the height in pixels.
    """
    return struct.unpack(">II", png[16:24])


def test_render_icon_output_is_a_png_of_the_requested_size() -> None:
    png = render_icon(192)
    assert png.startswith(PNG_SIGNATURE)
    assert _size_of(png) == (192, 192)


@pytest.mark.parametrize("size", [180, 192, 512])
def test_render_icon_output_is_square_for_every_published_size(size: int) -> None:
    assert _size_of(render_icon(size)) == (size, size)


def test_render_icon_uses_only_the_two_brand_colours() -> None:
    size = 64
    png = render_icon(size)
    raw = zlib.decompress(png[png.index(b"IDAT") + 4 : png.index(b"IEND") - 8])
    row_length = 1 + size * 3  # a filter byte, then one RGB triple per pixel
    pixels = set()
    for start in range(0, len(raw), row_length):
        row = raw[start + 1 : start + row_length]
        pixels |= {tuple(row[i : i + 3]) for i in range(0, len(row), 3)}
    assert pixels == {BACKGROUND, BAR_COLOUR}


def test_write_icons_creates_every_file_the_manifest_points_to(tmp_path) -> None:
    written = write_icons(tmp_path)
    assert {path.relative_to(tmp_path).as_posix() for path in written} == set(ICONS)
    assert all(path.stat().st_size > 0 for path in written)
