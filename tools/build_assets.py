"""
Fasla Mat asset pipeline.

Reads the source art in assets-src/ and writes game-ready files to client/public/assets/:
  ground.png            baked ground map (grass, stone plaza, dirt path, water + shoreline)
  atlas.png/.json       every prop as a trimmed, named frame (Phaser JSON-hash format)
  npc/*.png             character sheets, plus two palette-swapped shopper variants

Improvements over the raw sheet:
  - per-vendor stall awnings (saffron, rani pink, tarp blue) instead of three identical stalls
  - stalls composed into complete single sprites with a darker, weathered counter shade
  - props trimmed to their pixels so origins/collisions line up
  - ground baked once with stone variation, shoreline highlight and a soft edge vignette
  - new shopper characters made by palette-swapping the NPC pack (crowd no longer clones the player)

Run:  python3 tools/build_assets.py
"""
import colorsys
import json
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "client" / "public" / "assets"
LAYOUT = json.loads((ROOT / "tools" / "map_layout.json").read_text())
T = LAYOUT["tile"]

sheet = Image.open(SRC / "PathAndObjects.png").convert("RGBA")
random.seed(7)


def crop(box):
    return sheet.crop(box)


def trim(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def shift_hue(img, band, target_hue, min_s=0.4, min_v=0.45, sat_mul=1.0, val_mul=1.0, region=None):
    """Move every pixel whose hue falls inside `band` (degrees) to `target_hue`."""
    img = img.copy()
    px = img.load()
    x0, y0, x1, y1 = region or (0, 0, img.width, img.height)
    lo, hi = band
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            deg = h * 360
            inside = lo <= deg <= hi if lo <= hi else (deg >= lo or deg <= hi)
            if inside and s >= min_s and v >= min_v:
                nr, ng, nb = colorsys.hsv_to_rgb(target_hue / 360, min(1, s * sat_mul), min(1, v * val_mul))
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return img


def darken(img, factor, region):
    img = img.copy()
    px = img.load()
    x0, y0, x1, y1 = region
    for y in range(y0, min(y1, img.height)):
        for x in range(x0, min(x1, img.width)):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (int(r * factor), int(g * factor), int(b * factor), a)
    return img


# ---------------------------------------------------------------- props
stall_frame = crop((416, 352, 512, 512))          # empty stall: awning, posts, counter (96x160)
AWNING_H = 75                                      # awning + valances live in the top part

frames = {
    # one stall per vendor, recoloured awnings
    "stall_ramesh": shift_hue(stall_frame, (15, 45), 36, sat_mul=1.15),            # saffron
    "stall_pinky": shift_hue(stall_frame, (15, 45), 332, sat_mul=0.95, val_mul=1.02),  # rani pink
    "stall_salim": shift_hue(stall_frame, (15, 45), 208, sat_mul=0.9),             # blue tarp
    "fish_shelf": trim(crop((448, 64, 512, 96))),
    "veg_shelf": trim(crop((448, 32, 512, 64))),
    "crate_cabbage": trim(crop((384, 224, 416, 272))),
    "crate_cucumber": trim(crop((416, 224, 448, 272))),
    "crate_potato": trim(crop((448, 224, 480, 272))),
    "crate_tomato": trim(crop((480, 224, 512, 272))),
    "crate_redpepper": trim(crop((384, 288, 416, 336))),
    "crate_carrot": trim(crop((416, 288, 448, 336))),
    "crate_empty": trim(crop((448, 288, 480, 336))),
    "crate_yellowpepper": trim(crop((480, 288, 512, 336))),
    "sacks_big": trim(crop((288, 256, 352, 320))),
    "sack_small": trim(crop((352, 256, 384, 290))),
    "flowerpot": trim(crop((352, 288, 384, 320))),
    "flower_basket": trim(crop((224, 416, 256, 448))),
    "logs": trim(crop((128, 320, 192, 352))),
    "log_small": trim(crop((192, 320, 224, 352))),
    "basket_green": trim(crop((224, 320, 256, 352))),
    "basket_yellow": trim(crop((256, 320, 288, 352))),
    "woodpile": trim(crop((224, 352, 288, 416))),
    "table": trim(crop((288, 320, 384, 416))),
    "platform_small": trim(crop((192, 352, 224, 448))),
    "dock": trim(crop((288, 416, 384, 512))),
    "boat": trim(crop((0, 448, 128, 512))),
    "vase": trim(crop((384, 352, 416, 384))),
    "stumps": trim(crop((480, 96, 512, 160))),
}

# weather the stall counters a touch so the awning colour reads first
for key in ("stall_ramesh", "stall_pinky", "stall_salim"):
    frames[key] = darken(frames[key], 0.9, (0, AWNING_H + 30, 96, 160))

# ---------------------------------------------------------------- atlas (shelf packing)
PAD = 2
ATLAS_W = 512
order = sorted(frames.items(), key=lambda kv: -kv[1].height)
x = y = shelf_h = 0
placed = {}
for name, img in order:
    if x + img.width + PAD > ATLAS_W:
        x, y, shelf_h = 0, y + shelf_h + PAD, 0
    placed[name] = (x, y, img)
    x += img.width + PAD
    shelf_h = max(shelf_h, img.height)
atlas_h = 1
while atlas_h < y + shelf_h:
    atlas_h *= 2

atlas = Image.new("RGBA", (ATLAS_W, atlas_h), (0, 0, 0, 0))
meta = {"frames": {}, "meta": {"image": "atlas.png", "size": {"w": ATLAS_W, "h": atlas_h}, "scale": "1"}}
for name, (fx, fy, img) in placed.items():
    atlas.paste(img, (fx, fy))
    meta["frames"][name] = {
        "frame": {"x": fx, "y": fy, "w": img.width, "h": img.height},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": img.width, "h": img.height},
        "sourceSize": {"w": img.width, "h": img.height},
    }

OUT.mkdir(parents=True, exist_ok=True)
atlas.save(OUT / "atlas.png")
(OUT / "atlas.json").write_text(json.dumps(meta, indent=1))

# ---------------------------------------------------------------- ground
W, H = LAYOUT["cols"] * T, LAYOUT["rows"] * T
ground = Image.new("RGBA", (W, H))


def tile(col, row):
    return crop((col * T, row * T, col * T + T, row * T + T))


GRASS = crop((32, 352, 64, 384))
WATER = crop((96, 320, 128, 352))
STONE_TUFT = tile(2, 4)


def nine(origin_col, origin_row):
    return {(dx, dy): tile(origin_col + dx, origin_row + dy) for dx in range(3) for dy in range(3)}


STONE = nine(0, 0)
DIRT = nine(6, 0)


def paint_nine(tiles, rect, open_bottom=False, open_top=False):
    for ty in range(rect["y"], rect["y"] + rect["h"]):
        for tx in range(rect["x"], rect["x"] + rect["w"]):
            dx = 0 if tx == rect["x"] else 2 if tx == rect["x"] + rect["w"] - 1 else 1
            dy = 0 if (ty == rect["y"] and not open_top) else 2 if (ty == rect["y"] + rect["h"] - 1 and not open_bottom) else 1
            t = tiles[(dx, dy)]
            if (dx, dy) == (1, 1) and tiles is STONE and random.random() < 0.07:
                t = STONE_TUFT
            ground.alpha_composite(t, (tx * T, ty * T))


for ty in range(LAYOUT["rows"]):
    for tx in range(LAYOUT["cols"]):
        g = GRASS if random.random() > 0.5 else GRASS.transpose(Image.FLIP_LEFT_RIGHT)
        ground.alpha_composite(g, (tx * T, ty * T))

paint_nine(STONE, LAYOUT["plaza"])
paint_nine(DIRT, LAYOUT["path"], open_bottom=True, open_top=True)  # flows into the plaza

wr = LAYOUT["water"]
for ty in range(wr["y"], wr["y"] + wr["h"]):
    for tx in range(wr["x"], wr["x"] + wr["w"]):
        ground.alpha_composite(WATER, (tx * T, ty * T))

d = ImageDraw.Draw(ground)
wx0, wy0, wx1 = wr["x"] * T, wr["y"] * T, (wr["x"] + wr["w"]) * T
d.rectangle([wx0, wy0, wx1, wy0 + 2], fill=(35, 26, 18, 255))          # bank lip
d.rectangle([wx0, wy0 + 3, wx1, wy0 + 3], fill=(120, 170, 205, 255))    # foam line
d.rectangle([wx0, wy0 + 4, wx0 + 1, H], fill=(35, 26, 18, 255))        # left bank

# soft vignette so the eye stays on the stalls
vig = Image.new("L", (W, H), 0)
ImageDraw.Draw(vig).rectangle([18, 18, W - 18, H - 18], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(22))
shade = Image.new("RGBA", (W, H), (20, 14, 30, 110))
shade.putalpha(Image.eval(vig, lambda v: int((255 - v) * 0.45)))
ground.alpha_composite(shade)
ground.save(OUT / "ground.png")

# ---------------------------------------------------------------- NPC sheets + shopper variants
npc_out = OUT / "npc"
npc_out.mkdir(exist_ok=True)
for p in (SRC / "npc").glob("*.png"):
    shutil.copy(p, npc_out / p.name)

for anim in ("idle", "walk"):
    base = Image.open(SRC / "npc" / f"road_merchant_{anim}.png").convert("RGBA")
    shift_hue(base, (250, 310), 172, min_s=0.25, min_v=0.2).save(npc_out / f"shopper_teal_{anim}.png")
    shift_hue(base, (250, 310), 355, min_s=0.25, min_v=0.2, sat_mul=1.1).save(npc_out / f"shopper_red_{anim}.png")

# the game reads the same layout the ground was baked from
shutil.copy(ROOT / "tools" / "map_layout.json", ROOT / "client" / "src" / "game" / "mapLayout.json")

print(f"atlas {ATLAS_W}x{atlas_h}, {len(frames)} frames; ground {W}x{H}")
