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
      const config = JSON.parse(process.env.WAVEVIS_RENDER_CONFIG_JSON || "{{}}");
      const model = buildInverseSheetModel(config);
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
    return x - y * 0.006, z - y * 0.0025


def iso_project(point: tuple[float, float, float]) -> tuple[float, float]:
    x, y, z = point
    return x - y * 0.28, z * 1.12 + y * 0.1


def top_project(point: tuple[float, float, float]) -> tuple[float, float]:
    x, y, _ = point
    return x, y


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


def line_color(edge: dict, a: dict, b: dict, center_row: int, active_height: float) -> tuple[int, int, int]:
    del center_row, active_height
    if edge.get("orientation") != "horizontal":
        return GRID

    del a, b
    return GRID


def top_folded_edge(edge: dict, a: dict, b: dict, max_height: float) -> bool:
    del edge
    max_z = max(current(a)[2], current(b)[2])
    max_plan_displacement = max(plan_displacement(a), plan_displacement(b))
    return max_z >= max_height * 0.1 or max_plan_displacement >= max_height * 0.44


def plan_displacement(node: dict) -> float:
    rest = node["restPosition"]
    point = current(node)
    return math.hypot(point[0] - rest[0], point[1] - rest[1])


def render_lattice(model: dict, filename: str, title: str, subtitle: str, projection_name: str, projector: Callable[[tuple[float, float, float]], tuple[float, float]], center_only: bool = False, publish: bool = True) -> None:
    size = (1800, 1120)
    img = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(img, "RGBA")
    nodes = node_map(model)
    center_row = model["config"]["rows"] // 2
    center_col = int(model["config"]["columns"] * 0.56)
    active_height = max(model["summary"]["maxHeight"] * 0.12, 0.08)

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
        color = line_color(edge, a, b, center_row, active_height)
        folded_top = projection_name == "top" and top_folded_edge(edge, a, b, max(model["summary"]["maxHeight"], 0.000001))
        if projection_name == "iso":
            max_edge_z = max(current(a)[2], current(b)[2])
            max_edge_displacement = max(plan_displacement(a), plan_displacement(b))
            near_center = abs(((a["row"] + b["row"]) * 0.5) - center_row) <= 2.1
            active_edge = max_edge_z >= active_height or (max_edge_displacement >= model["summary"]["maxHeight"] * 0.035 and max_edge_z >= active_height * 0.55)
            if edge.get("orientation") == "horizontal" and near_center and active_edge:
                color = CENTER
                alpha = 180
                width = 2
            elif active_edge:
                color = CENTER
                alpha = 84
                width = 1
            else:
                alpha = 44
                width = 1
        else:
            alpha = 7 if folded_top else 225 if color in (LIP, CENTER) else 95
            width = 3 if color in (LIP, CENTER) else 1
        p0 = to_canvas(projector(current(a)))
        p1 = to_canvas(projector(current(b)))
        draw.line((*p0, *p1), fill=(*color, alpha), width=width)

    if projection_name == "iso":
        # Draw the app-equivalent centerline silhouette over the full linkage so the lip shape is auditable in 3D.
        center_nodes = sorted((node for node in model["nodes"] if node["row"] == center_row), key=lambda node: node["col"])
        center_path_nodes = side_profile_display_nodes(center_nodes)
        center_path = [to_canvas(projector(current(node))) for node in center_path_nodes]
        draw.line(smooth_canvas_polyline(center_path, 2), fill=(*INK, 235), width=5, joint="curve")
        terminal_range = terminal_lip_node_range(center_nodes)
        if terminal_range:
            start, tip, _curved_end = terminal_range
            lip_nodes = center_nodes[start:tip + 1]
        else:
            lip_nodes = []
        lip_path = [to_canvas(projector(current(node))) for node in lip_nodes]
        if len(lip_path) >= 2:
            draw.line(smooth_canvas_polyline(lip_path, 2), fill=(*LIP, 245), width=7 if projection_name == "iso" else 6, joint="curve")

        for node in center_nodes[::4]:
            x, y = to_canvas(projector(current(node)))
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(*INK, 90))

    if publish:
        img.save(FIGURES / filename)
    img.save(VERIFY / filename.replace(".png", "-verification.png"))


def smooth_canvas_polyline(points: list[tuple[float, float]], passes: int = 2) -> list[tuple[float, float]]:
    if len(points) < 3:
        return points
    smoothed = points[:]
    for _ in range(passes):
        next_points = [smoothed[0]]
        for index in range(len(smoothed) - 1):
            x0, y0 = smoothed[index]
            x1, y1 = smoothed[index + 1]
            next_points.append((x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25))
            next_points.append((x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75))
        next_points.append(smoothed[-1])
        smoothed = next_points
    return smoothed


def side_profile_display_nodes(center_nodes: list[dict]) -> list[dict]:
    if len(center_nodes) < 5:
        return center_nodes
    max_z = max(current(node)[2] for node in center_nodes)
    if max_z <= 0:
        return center_nodes
    active = [
        index for index, node in enumerate(center_nodes)
        if current(node)[2] >= max_z * 0.045
    ]
    if len(active) < 2:
        return center_nodes
    profile_start = max(0, active[0] - 2)
    terminal_range = terminal_lip_node_range(center_nodes)
    profile_end = min(len(center_nodes) - 1, active[-1] + 1)
    if terminal_range:
        terminal_start, _tip, _curved_end = terminal_range
        profile_end = min(profile_end, terminal_start)
    return center_nodes[profile_start:profile_end + 1]


def side_silhouette_nodes(center_nodes: list[dict]) -> list[dict]:
    body_nodes = side_profile_display_nodes(center_nodes)
    terminal_range = terminal_lip_node_range(center_nodes)
    if not terminal_range:
        return body_nodes
    terminal_start, _terminal_tip, curved_end = terminal_range
    lip_nodes = center_nodes[terminal_start:curved_end + 1]
    if not body_nodes:
        return lip_nodes
    if lip_nodes and body_nodes[-1]["id"] == lip_nodes[0]["id"]:
        return body_nodes + lip_nodes[1:]
    return body_nodes + lip_nodes


def terminal_lip_node_range(center_nodes: list[dict]) -> tuple[int, int, int] | None:
    if len(center_nodes) < 5:
        return None
    max_z = max(current(node)[2] for node in center_nodes)
    if max_z <= 0:
        return None
    crest_index = max(range(len(center_nodes)), key=lambda index: current(center_nodes[index])[2])
    post_crest = [
        index for index in range(crest_index + 1, len(center_nodes))
        if current(center_nodes[index])[2] >= max_z * 0.035
    ]
    if len(post_crest) < 2:
        return None
    target_tip_z = max_z * 0.06
    low_tip_candidates = [
        index for index in post_crest
        if current(center_nodes[index])[2] <= target_tip_z * 1.35
    ]
    tip_index = (
        terminal_local_minimum_index(center_nodes, low_tip_candidates[0], max_z)
        if low_tip_candidates else
        min(
            post_crest,
            key=lambda index: (
                abs(current(center_nodes[index])[2] - target_tip_z),
                current(center_nodes[index])[0],
            ),
        )
    )
    start_index = terminal_lip_profile_start_index(center_nodes, crest_index, tip_index, max_z)
    visible_interior = [
        index for index in range(tip_index, len(center_nodes))
        if index > tip_index
        and current(center_nodes[index])[2] >= max_z * 0.045
        and current(center_nodes[index])[2] <= max_z * 0.32
    ]
    curved_end = (
        max(visible_interior, key=lambda index: current(center_nodes[index])[2])
        if visible_interior else tip_index
    )
    return start_index, tip_index, curved_end


def terminal_lip_profile_start_index(center_nodes: list[dict], crest_index: int, tip_index: int, max_z: float) -> int:
    return min(max(crest_index, 0), tip_index)


def terminal_local_minimum_index(center_nodes: list[dict], first_low_index: int, max_z: float) -> int:
    tip_index = first_low_index
    for index in range(first_low_index + 1, len(center_nodes)):
        point = current(center_nodes[index])
        tip = current(center_nodes[tip_index])
        point_z = point[2]
        tip_z = tip[2]
        if point_z <= max_z * 0.025 and abs(point[0] - tip[0]) >= 1.15:
            break
        if point_z < tip_z - max_z * 0.004:
            tip_index = index
            continue
        if point_z > tip_z + max_z * 0.035:
            break
        if point_z > max_z * 0.18:
            break
    return tip_index


def main() -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    VERIFY.mkdir(parents=True, exist_ok=True)
    model = compile_model()
    render_lattice(
        model,
        "candidate-diagnostic-side.png",
        "Diagnostic inverse-sheet side linkage",
        "Full source model diagnostic; not paper evidence until the rendered mechanism passes acceptance.",
        "side",
        side_project,
        publish=False,
    )
    render_lattice(
        model,
        "candidate-diagnostic-isometric.png",
        "Diagnostic inverse-sheet isometric linkage",
        "Three-quarter 3D diagnostic; not paper evidence until the rendered mechanism passes acceptance.",
        "iso",
        iso_project,
        publish=False,
    )
    render_lattice(
        model,
        "candidate-diagnostic-top.png",
        "Diagnostic inverse-sheet top linkage",
        "Top diagnostic; not paper evidence until the rendered mechanism passes acceptance.",
        "top",
        top_project,
        publish=False,
    )


if __name__ == "__main__":
    main()
