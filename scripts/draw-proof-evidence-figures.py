from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FIGURES = ROOT / "proofs" / "figures"

INK = (35, 32, 29)
MUTED = (99, 93, 86)
PAPER = (250, 247, 241)
PANEL = (255, 253, 249)
LINE = (214, 205, 192)
RED = (181, 54, 45)
RED_DARK = (126, 36, 31)
RED_FILL = (253, 238, 235)
GREEN = (52, 124, 86)
GREEN_DARK = (28, 84, 58)
GREEN_FILL = (235, 247, 240)
BLUE = (48, 94, 157)
BLUE_FILL = (235, 242, 252)
GOLD = (183, 126, 36)
GOLD_FILL = (255, 246, 225)
GRAY_FILL = (244, 240, 233)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE = font(54, True)
SUBTITLE = font(28)
HEAD = font(34, True)
BODY = font(26)
BODY_BOLD = font(26, True)
SMALL = font(21)
SMALL_BOLD = font(21, True)
TINY = font(17)
TINY_BOLD = font(17, True)


def text_size(draw: ImageDraw.ImageDraw, text: str, text_font):
    box = draw.textbbox((0, 0), text, font=text_font)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, text: str, text_font, max_width: int):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if draw.textlength(trial, font=text_font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(draw, xy, text, text_font, fill, max_width, line_gap=9):
    x, y = xy
    lines = wrap(draw, text, text_font, max_width)
    line_h = text_size(draw, "Ag", text_font)[1] + line_gap
    for i, line in enumerate(lines):
        draw.text((x, y + i * line_h), line, font=text_font, fill=fill)
    return y + len(lines) * line_h


def rounded(draw, box, fill, outline=LINE, radius=28, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def shadowed_panel(img, box, radius=34):
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    x0, y0, x1, y1 = box
    sd.rounded_rectangle((x0 + 8, y0 + 10, x1 + 8, y1 + 10), radius=radius, fill=(54, 40, 28, 35))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    img.alpha_composite(shadow)
    draw = ImageDraw.Draw(img, "RGBA")
    rounded(draw, box, PANEL, LINE, radius=radius, width=2)


def label(draw, xy, text, fill, outline, text_color=None, pad=(18, 12), radius=18, text_font=SMALL_BOLD):
    x, y = xy
    if text_color is None:
        text_color = outline
    tw, th = text_size(draw, text, text_font)
    box = (x, y, x + tw + 2 * pad[0], y + th + 2 * pad[1])
    rounded(draw, box, fill, outline, radius=radius, width=2)
    draw.text((x + pad[0], y + pad[1] - 1), text, font=text_font, fill=text_color)
    return box


def draw_arrow(draw, start, end, color, width=7):
    draw.line((*start, *end), fill=color, width=width)
    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    head = 28
    wing = 14
    draw.polygon(
        [
            (ex, ey),
            (ex - ux * head + px * wing, ey - uy * head + py * wing),
            (ex - ux * head - px * wing, ey - uy * head - py * wing),
        ],
        fill=color,
    )


def draw_cell(draw, center, rx, ry, angle_deg=90, equal_all=True, color=INK, accent=GREEN):
    import math

    cx, cy = center
    theta = math.radians(angle_deg)
    ux, uy = 1, 0
    vx, vy = math.cos(theta), -math.sin(theta)
    left = (cx - rx * ux, cy - rx * uy)
    right = (cx + rx * ux, cy + rx * uy)
    down = (cx - ry * vx, cy - ry * vy)
    up = (cx + ry * vx, cy + ry * vy)

    draw.line((*left, *right), fill=accent if not equal_all else color, width=12)
    draw.line((*down, *up), fill=color, width=12)
    for point in (left, right, down, up):
        draw.ellipse((point[0] - 18, point[1] - 18, point[0] + 18, point[1] + 18), fill=PANEL, outline=BLUE, width=5)
    draw.rounded_rectangle((cx - 42, cy - 42, cx + 42, cy + 42), radius=8, fill=INK, outline=INK)
    return left, right, down, up


def draw_constraint_contract():
    img = Image.new("RGBA", (2200, 1180), PAPER + (255,))
    draw = ImageDraw.Draw(img, "RGBA")

    draw.text((90, 66), "Which cell constraint survives the overhang?", font=TITLE, fill=INK)
    draw.text(
        (92, 130),
        "The figures separate a rejected Sarrus-like all-four-equal X from the pairwise X-cell that actually closes.",
        font=SUBTITLE,
        fill=MUTED,
    )

    left = (90, 215, 720, 1035)
    mid = (785, 215, 1415, 1035)
    right = (1480, 215, 2110, 1035)
    for box in (left, mid, right):
        shadowed_panel(img, box)
    draw = ImageDraw.Draw(img, "RGBA")

    label(draw, (125, 250), "REJECTED TARGET", RED_FILL, RED, RED_DARK)
    draw.text((125, 320), "all-four-equal X-cell", font=HEAD, fill=INK)
    draw_wrapped(draw, (125, 365), "One common arm length and a right angle are both hard constraints.", BODY, MUTED, 540)
    c = (405, 610)
    draw.ellipse((c[0] - 145, c[1] - 145, c[0] + 145, c[1] + 145), outline=(72, 118, 180, 120), width=5)
    draw_cell(draw, c, 145, 145, angle_deg=90, equal_all=True, color=INK)
    draw.text((550, 575), "L", font=BODY_BOLD, fill=BLUE)
    draw.text((428, 445), "L", font=BODY_BOLD, fill=BLUE)
    draw.text((462, 636), "90 deg", font=SMALL_BOLD, fill=INK)
    draw_wrapped(
        draw,
        (125, 800),
        "For the curved overhang this branch either leaves gaps, folds the local lattice, or breaks embedding.",
        BODY_BOLD,
        RED_DARK,
        540,
    )

    label(draw, (820, 250), "REJECTION TESTS", GRAY_FILL, MUTED, INK)
    tests = [
        ("1", "Equal radius", "all four connectors must sit on one circle/sphere about C"),
        ("2", "Midpoint symmetry", "each opposite pair must pass straight through the cell center"),
        ("3", "Finite embedding", "shared connectors must stay ordered, non-folded, and on the overhang"),
    ]
    y = 340
    for num, head, desc in tests:
        draw.ellipse((830, y, 882, y + 52), fill=INK)
        draw.text((848, y + 9), num, font=SMALL_BOLD, fill=PANEL)
        draw.text((908, y - 2), head, font=BODY_BOLD, fill=INK)
        draw_wrapped(draw, (908, y + 36), desc, SMALL, MUTED, 410, line_gap=7)
        y += 170
    rounded(draw, (835, 865, 1365, 980), RED_FILL, RED, radius=20, width=3)
    draw.text((862, 890), "No tested row satisfies all three.", font=BODY_BOLD, fill=RED_DARK)
    draw.text((862, 930), "Equal arms and clean embedding do not coexist.", font=SMALL, fill=INK)

    label(draw, (1515, 250), "ACCEPTED DIRECTION", GREEN_FILL, GREEN, GREEN_DARK)
    draw.text((1515, 320), "pairwise X-cell", font=HEAD, fill=INK)
    draw_wrapped(draw, (1515, 365), "Opposite arms stay equal and collinear by pair. The two pair lengths and the included angle are free.", BODY, MUTED, 535)
    c = (1785, 620)
    draw_cell(draw, c, 170, 128, angle_deg=62, equal_all=False, color=INK, accent=GREEN)
    draw.text((1965, 604), "Lx", font=BODY_BOLD, fill=GREEN_DARK)
    draw.text((1860, 474), "Ly", font=BODY_BOLD, fill=INK)
    draw.text((1868, 645), "theta free", font=SMALL_BOLD, fill=INK)
    checks = ["connector gap: 0", "opposite-pair length spread: 0", "opposite-pair collinearity error: 0 deg"]
    y = 805
    for check in checks:
        draw.ellipse((1520, y + 4, 1546, y + 30), fill=GREEN)
        draw.line((1526, y + 18, 1534, y + 26, 1541, y + 10), fill=PANEL, width=4)
        draw.text((1560, y), check, font=SMALL_BOLD, fill=GREEN_DARK)
        y += 52

    img.convert("RGB").save(FIGURES / "constraint-contract-summary.png", quality=96)


def draw_projection_tradeoff():
    img = Image.new("RGBA", (2200, 1320), PAPER + (255,))
    draw = ImageDraw.Draw(img, "RGBA")

    draw.text((90, 64), "Sliding-cell escape route: still rejected", font=TITLE, fill=INK)
    draw.text(
        (92, 128),
        "Sliding was tested as the strongest way to rescue all-four equality. The tradeoff stayed fatal.",
        font=SUBTITLE,
        fill=MUTED,
    )

    shadowed_panel(img, (90, 215, 2110, 1115), radius=32)
    draw = ImageDraw.Draw(img, "RGBA")

    attempts = [
        ("Equal-arm first", "0.0022", "18 outside", "4 flipped", "folded / invalid", RED, RED_FILL),
        ("Mild no-fold", "0.2275", "324 outside", "16 flipped", "still invalid", RED, RED_FILL),
        ("Strong no-fold", "0.1854", "0 outside", "45 flipped", "center still folds", GOLD, GOLD_FILL),
        ("Locked corridor", "0.3629", "0 outside", "0 flipped", "clean but unequal", BLUE, BLUE_FILL),
    ]

    cols = [130, 610, 990, 1325, 1655]
    headers = ["attempt", "all-four spread", "connector corridor", "center quads", "result"]
    for x, h in zip(cols, headers):
        draw.text((x, 270), h.upper(), font=TINY_BOLD, fill=MUTED)
    draw.line((125, 315, 2070, 315), fill=LINE, width=3)

    y = 350
    row_h = 150
    for i, (name, spread, outside, flipped, result, color, fill) in enumerate(attempts):
        row_y = y + i * row_h
        fill_row = (255, 255, 255, 255) if i % 2 == 0 else (249, 246, 239, 255)
        rounded(draw, (125, row_y, 2070, row_y + 112), fill_row, (235, 228, 218), radius=16, width=1)
        draw.text((cols[0], row_y + 36), name, font=BODY_BOLD, fill=INK)
        badge_fill = GREEN_FILL if spread == "0.0022" else RED_FILL
        badge_color = GREEN if spread == "0.0022" else RED
        rounded(draw, (cols[1], row_y + 22, cols[1] + 240, row_y + 88), badge_fill, badge_color, radius=18, width=2)
        draw.text((cols[1] + 25, row_y + 39), spread, font=BODY_BOLD, fill=badge_color)
        draw.text((cols[2], row_y + 39), outside, font=BODY_BOLD, fill=RED if outside != "0 outside" else GREEN)
        draw.text((cols[3], row_y + 39), flipped, font=BODY_BOLD, fill=RED if flipped != "0 flipped" else GREEN)
        rounded(draw, (cols[4], row_y + 22, 2038, row_y + 88), fill, color, radius=18, width=2)
        draw.text((cols[4] + 25, row_y + 39), result, font=BODY_BOLD, fill=color)

    rounded(draw, (165, 985, 1000, 1070), GREEN_FILL, GREEN, radius=20, width=3)
    draw.text((195, 1008), "Best equality row: spread 0.0022", font=BODY_BOLD, fill=GREEN_DARK)
    draw.text((620, 1008), "but folded", font=BODY_BOLD, fill=RED_DARK)
    rounded(draw, (1080, 985, 2025, 1070), BLUE_FILL, BLUE, radius=20, width=3)
    draw.text((1110, 1008), "Best embedding row: clean corridor", font=BODY_BOLD, fill=BLUE)
    draw.text((1645, 1008), "but unequal", font=BODY_BOLD, fill=RED_DARK)

    rounded(draw, (90, 1160, 2110, 1265), RED_FILL, RED, radius=24, width=3)
    draw.text((130, 1184), "Decision", font=BODY_BOLD, fill=RED_DARK)
    draw_wrapped(
        draw,
        (265, 1184),
        "No valid operating point was found: equality requires folding, while a clean embedded lattice requires giving up all-four equality.",
        BODY,
        INK,
        1740,
    )

    img.convert("RGB").save(FIGURES / "projection-tradeoff-summary.png", quality=96)


def fit_crop(src: Image.Image, size):
    tw, th = size
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def draw_simulator_evidence():
    invalid = Image.open(FIGURES / "sim-strict-all-constraints-side.png").convert("RGB")
    accepted = Image.open(FIGURES / "sim-overhang-side-overview.png").convert("RGB")

    invalid_crop = invalid.crop((0, 80, 1206, 880))
    accepted_crop = accepted.crop((240, 300, 1100, 876))
    invalid_panel = fit_crop(invalid_crop, (940, 630))
    accepted_panel = fit_crop(accepted_crop, (940, 630))

    img = Image.new("RGBA", (2200, 1280), PAPER + (255,))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.text((90, 60), "Simulator evidence", font=TITLE, fill=INK)
    draw.text((92, 124), "Same surface family; different cell contract. The rejected branch makes local geometry visibly invalid.", font=SUBTITLE, fill=MUTED)

    left_box = (90, 220, 1060, 990)
    right_box = (1140, 220, 2110, 990)
    for box in (left_box, right_box):
        shadowed_panel(img, box, radius=30)
    draw = ImageDraw.Draw(img, "RGBA")

    label(draw, (130, 255), "REJECTED: all-four-equal", RED_FILL, RED, RED_DARK)
    draw.text((130, 318), "near-equal arms create folded/invalid local geometry", font=SMALL, fill=MUTED)
    img.alpha_composite(invalid_panel.convert("RGBA"), (105, 390))
    draw.ellipse((410, 525, 760, 825), outline=RED, width=9)
    draw.line((275, 858, 815, 858), fill=(255, 226, 90, 230), width=9)
    draw_arrow(draw, (310, 362), (510, 570), RED, width=6)
    rounded(draw, (130, 1030, 1045, 1135), RED_FILL, RED, radius=20, width=2)
    draw_wrapped(
        draw,
        (165, 1055),
        "Observed symptom: high strain and distorted connector geometry near the overhang interior.",
        SMALL_BOLD,
        RED_DARK,
        820,
    )

    label(draw, (1180, 255), "ACCEPTED: pairwise X-cell", GREEN_FILL, GREEN, GREEN_DARK)
    draw.text((1180, 318), "shared connectors close; opposite bars stay clean by pair", font=SMALL, fill=MUTED)
    img.alpha_composite(accepted_panel.convert("RGBA"), (1155, 390))
    rounded(draw, (1180, 1030, 2095, 1135), GREEN_FILL, GREEN, radius=20, width=2)
    draw_wrapped(
        draw,
        (1215, 1055),
        "Verified mechanism checks: connector gap 0, opposite-pair spread 0, opposite collinearity error 0 deg.",
        SMALL_BOLD,
        GREEN_DARK,
        820,
    )

    rounded(draw, (90, 1170, 2110, 1235), GRAY_FILL, LINE, radius=18, width=2)
    draw.text((128, 1188), "Interpretation:", font=SMALL_BOLD, fill=INK)
    draw.text(
        (290, 1188),
        "The all-four-equal branch fails as a mechanism result, not as a rendering style. The pairwise branch keeps contact without the invalid fold.",
        font=SMALL,
        fill=INK,
    )

    img.convert("RGB").save(FIGURES / "simulator-evidence-plate.png", quality=96)

    # Keep legacy filenames as clean single-panel exports for any existing links.
    invalid_panel.save(FIGURES / "annotated-all-four-invalid.png", quality=96)
    accepted_panel.save(FIGURES / "annotated-pairwise-accepted.png", quality=96)


def main():
    FIGURES.mkdir(parents=True, exist_ok=True)
    draw_constraint_contract()
    draw_projection_tradeoff()
    draw_simulator_evidence()


if __name__ == "__main__":
    main()
