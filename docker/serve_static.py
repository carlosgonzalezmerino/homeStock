"""
Wraps the FastAPI app and mounts the built frontend as static files.
The SPA catch-all serves index.html for any unknown path so React Router works.
"""
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.main import app

DIST = Path(__file__).parent.parent / "frontend" / "dist"

# Serve static assets (JS, CSS, icons…) — must come before the catch-all
app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

# Individual known static files
for _file in ("favicon.ico", "manifest.webmanifest", "sw.js", "registerSW.js"):
    _path = DIST / _file
    if _path.exists():
        app.add_api_route(
            f"/{_file}",
            lambda p=_path: FileResponse(p),
            include_in_schema=False,
        )


# SPA catch-all — serve index.html for everything not matched above
@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str) -> FileResponse:
    # Real static file (icons, etc.)
    candidate = DIST / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST / "index.html")
