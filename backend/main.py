from __future__ import annotations

"""
DEMONSTRATION API - DeFI CREDIT RISK (app assembly)
===================================================

Creates the FastAPI application, mounts the routes and serves the
built React frontend (frontend/dist).

Run from the project root:

    python -m uvicorn backend.api.main:app --port 8000

Then open:  http://127.0.0.1:8000

If the React app has not been built yet, GET / returns setup
instructions instead (the API itself works regardless).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.api.routes import router
from backend.model.train_binary import PROJECT_ROOT

FRONTEND_DIST = (
    PROJECT_ROOT / "frontend" / "dist"
)

_NOT_BUILT_HTML = """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DeFi Credit Risk</title>
<style>
body{{font-family:system-ui;background:#0d1117;color:#e6edf3;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}
.box{{max-width:560px;padding:32px;border:1px solid #30363d;border-radius:12px}}
code{{background:#161b22;padding:2px 6px;border-radius:4px}}
</style></head>
<body><div class="box">
<h2>API is running - React frontend not built yet</h2>
<p>Build it once, then reload this page:</p>
<p><code>cd frontend</code><br><code>npm install</code><br>
<code>npm run build</code></p>
<p>Or use the interactive API docs at <a style="color:#58a6ff"
href="/docs">/docs</a> meanwhile.</p>
</div></body></html>"""


app = FastAPI(
    title="DeFi Credit Risk API",
    description=(
        "Explainable, privacy-preserving Graph AI for DeFi credit "
        "risk (binary liquidation-risk model) - GraphSAGE + "
        "federated learning + secure aggregation + SHAP / GNN "
        "explanations"
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Built React assets (present after `npm run build`).

if (FRONTEND_DIST / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="assets",
    )


def _index_response():

    index_path = FRONTEND_DIST / "index.html"

    if index_path.exists():
        return FileResponse(index_path)

    return HTMLResponse(_NOT_BUILT_HTML)


@app.get("/")
def serve_frontend():

    return _index_response()


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):

    """
    Client-side routing fallback: unknown non-API GETs return the
    React app; unknown API paths stay 404.
    """

    if full_path.startswith("api/") or full_path.startswith(
        "docs"
    ):
        from fastapi import HTTPException

        raise HTTPException(status_code=404)

    return _index_response()
