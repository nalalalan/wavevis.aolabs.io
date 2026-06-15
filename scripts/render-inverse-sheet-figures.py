from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "node_modules" / ".tmp" / "wavevis-inverse-sheet-render"
FIGURES = ROOT / "proofs" / "figures"
VERIFY = ROOT / "_verification"

PAPER = (250, 247, 241)
INK = (34, 31, 28)
MUTED = (118, 109, 97)
GRID = (197, 188, 174)
CENTER = (42, 40, 36)
LIP = (168, 66, 54)
FILL = (237, 231, 221)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE = font(34, True)
BODY = font(21)
SMALL = font(18)


def compile_model() -> dict:
    TMP.mkdir(parents=True, exist_ok=True)
    (TMP / "package.json").write_text('{"type":"commonjs"}\n', encoding="utf-8")
    subprocess.run(
        [
            "node",
            str(ROOT / "node_modules" / "typescript" / "bin" / "tsc"),
            "src/inverseSheetTypes.ts",
            "src/latticeGeometry.ts",
            "--outDir",
            str(TMP.relative_to(ROOT)),
            "--module",
            "commonjs",
            "--target",
            "es2022",
            "--moduleResolution",
            "node",
            "--skipLibCheck",
            "--esModuleInterop",
            "--ignoreConfig",
            "--ignoreDeprecations",
            "6.0",
        ],
        cwd=ROOT,
        check=True,
    )
    loader = f"""
      const {{ buildInverseSheetModel }} = require({json.dumps(str(TMP / "latticeGeometry.js"))});
      const model = buildInverseSheetModel({{ profileMode: 'generated' }});
      process.stdout.write(JSON.stringify({{
        config: model.config,
        nodes: model.nodes,
        edges: model.edges,
        summary: model.summary,
      }}));
    """
    return json.loads(subprocess.check_output(["node", "-e", loader], cwd=ROOT, text=True))


def bounds(points: list[tuple[float, float]], pad: float = 0.04) -> tuple[float, float, float, float]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max(max_x - min_x, 1)
    span_y = max(max_y - min_y, 1)
    return (
        min_x - span_x * pad,
        max_x + span_x * pad,
        min_y - span_y * pad,
        max_y + span_y * pad,
    )


def make_mapper(points: list[tuple[float, float]], size: tuple[int, int], margin: int = 88) -> Callable[[tuple[float, float]], tuple[float, float]]:
    width, height = size
    min_x, max_x, min_y, max_y = bounds(points)
    scale = min((width - margin * 2) / (max_x - min_x), (height - margin * 2) / (max_y - min_y))
    offset_x = (width - (max_x - min_x) * scale) / 2
    offset_y = (height - (max_y - min_y) * scale) / 2

    def project(point: tuple[float, float]) -> tuple[float, float]:
        return (
            offset_x + (point[0] - min_x) * scale,
            height - (offset_y + (point[1] - min_y) * scale),
        )

    return project


def node_map(model: dict) -> dict[str, dict]:
    return {node["id"]: node for node in model["nodes"]}


def current(node: dict) -> tuple[float, float, float]:
    x, y, z = node["currentPosition"]
    return float(x), float(y), float(z)


def side_project(point: tuple[float, float, float]) -> tuple[float, float]:
    x, y, z = point
    return x + y * 0.045, z - y * 0.018


def iso_project(point: tuple[float, float, float]) -> tuple[float, float]:
    x, y, z = point
    return (x - y) * 0.86, (x + y) * 0.31 - z * 1.15


def cross_project(point: tuple[float, float, float]) -> tuple[float, float]:
    x, _, z = point
    return x, z


def draw_header(draw: ImageDraw.ImageDraw, title: str, subtitle: str, summary: dict) -> None:
    draw.text((58, 36), title, fill=INK, font=TITLE)
    draw.text((60, 82), subtitle, fill=MUTED, font=BODY)
    metrics = (
        f"nodes {summary['nodeCount']} | edges {summary['edgeCount']} | "
        f"max height {summary['maxHeight']:.2f} | max tensile strain {summary['maxTensileStrain']:.2f}"
    )
    draw.text((60, 116), metrics, fill=MUTED, font=SMALL)


def summarize(model: dict) -> dict:
    return {
        "nodeCount": len(model["nodes"]),
        "edgeCount": len(model["edges"]),
        "maxHeight": model["summary"]["maxHeight"],
        "maxTensileStrain": model["summary"]["maxTensileStrain"],
    }


def sorted_edges(model: dict, nodes: dict[str, dict], projection: str) -> list[dict]:
    def depth(edge: dict) -> float:
        a = current(nodes[edge["nodeA"]])
        b = current(nodes[edge["nodeB"]])
        if projection == "iso":
            return (a[1] + b[1]) * 0.5 - (a[2] + b[2]) * 0.08
        return (a[1] + b[1]) * 0.5

    return sorted(model["edges"], key=depth)


def line_color(edge: dict, a: dict, b: dict, center_row: int, center_col: int) -> tuple[int, int, int]:
    row_near_center = abs(a["row"] - center_row) <= 1 and abs(b["row"] - center_row) <= 1
    col_near_lip = a["col"] >= center_col or b["col"] >= center_col
    if row_near_center and col_near_lip:
        return LIP
    if row_near_center:
        return CENTER
    return GRID


def render_lattice(model: dict, filename: str, title: str, subtitle: str, projection_name: str, projector: Callable[[tuple[float, float, float]], tuple[float, float]], center_only: bool = False) -> None:
    size = (1800, 1120)
    img = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(img, "RGBA")
    nodes = node_map(model)
    center_row = model["config"]["rows"] // 2
    center_col = int(model["config"]["columns"] * 0.56)

    if center_only:
        visible_nodes = [
            node for node in model["nodes"]
            if abs(node["row"] - center_row) <= 2
        ]
        visible_ids = {node["id"] for node in visible_nodes}
        visible_edges = [
            edge for edge in model["edges"]
            if edge["nodeA"] in visible_ids and edge["nodeB"] in visible_ids
        ]
    else:
        visible_nodes = model["nodes"]
        visible_edges = sorted_edges(model, nodes, projection_name)

    projected_points = [projector(current(node)) for node in visible_nodes]
    to_canvas = make_mapper(projected_points, size, margin=125)

    draw_header(draw, title, subtitle, summarize(model))
    draw.rounded_rectangle((54, 154, 1746, 1056), radius=18, fill=(255, 253, 248, 255), outline=(224, 216, 204, 255), width=2)

    # Low opacity fill from quads would hide linkage closure; draw only actual model edges.
    for edge in visible_edges:
        a = nodes[edge["nodeA"]]
        b = nodes[edge["nodeB"]]
        color = line_color(edge, a, b, center_row, center_col)
        alpha = 225 if color in (LIP, CENTER) else 95
        width = 3 if color in (LIP, CENTER) else 1
        p0 = to_canvas(projector(current(a)))
        p1 = to_canvas(projector(current(b)))
        draw.line((*p0, *p1), fill=(*color, alpha), width=width)

    # Draw the central node path over the full linkage so the lip silhouette is auditable.
    center_nodes = sorted((node for node in model["nodes"] if node["row"] == center_row), key=lambda node: node["col"])
    center_path = [to_canvas(projector(current(node))) for node in center_nodes]
    draw.line(center_path, fill=(*INK, 235), width=5, joint="curve")
    lip_path = [to_canvas(projector(current(node))) for node in center_nodes if node["col"] >= center_col]
    if len(lip_path) >= 2:
        draw.line(lip_path, fill=(*LIP, 245), width=6, joint="curve")

    for node in center_nodes[::4]:
        x, y = to_canvas(projector(current(node)))
        draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(*INK, 235))

    img.save(FIGURES / filename)
    img.save(VERIFY / filename.replace(".png", "-verification.png"))


def main() -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    VERIFY.mkdir(parents=True, exist_ok=True)
    model = compile_model()
    render_lattice(
        model,
        "current-live-side.png",
        "Current inverse-sheet side linkage",
        "Full source model, center row highlighted; red marks the active terminal lip.",
        "side",
        side_project,
    )
    render_lattice(
        model,
        "current-live-isometric.png",
        "Current inverse-sheet isometric linkage",
        "Full source model with preserved rectangular array and bounded downturned lip.",
        "iso",
        iso_project,
    )
    render_lattice(
        model,
        "current-live-cross-section.png",
        "Current inverse-sheet cross-section",
        "Central rows only; this stays separate from the full side view.",
        "cross",
        cross_project,
        center_only=True,
    )


if __name__ == "__main__":
    main()
