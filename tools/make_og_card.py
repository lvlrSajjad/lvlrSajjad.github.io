"""Generate the 1200x630 Open Graph share card.

Run from the repo root:  python3 tools/make_og_card.py
Writes assets/images/og-card.png. Colours track assets/css/site.css.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
GROUND = (34, 41, 51)
GREEN = (104, 195, 163)   # #68c3a3
BLUE = (82, 179, 217)     # #52b3d9
WHITE = (255, 255, 255)
MUTED = (166, 176, 189)

HELV = "/System/Library/Fonts/HelveticaNeue.ttc"


def font(size, index):
    return ImageFont.truetype(HELV, size, index=index)


# HelveticaNeue.ttc face indices: 1 Bold, 0 Regular, 7 Light.
bold, medium, light = font(64, 1), font(28, 0), font(25, 7)

img = Image.new("RGB", (W, H), GROUND)
d = ImageDraw.Draw(img)

# Subtle vertical lift so the card is not a flat rectangle.
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=tuple(int(c + (10 - 20 * t)) for c in GROUND))

# Portrait, circle-cropped, bled off the right edge.
photo = Image.open("assets/images/myphoto.jpeg").convert("RGB")
side = min(photo.size)
photo = photo.crop((
    (photo.width - side) // 2, 0,
    (photo.width + side) // 2, side,
)).resize((360, 360), Image.LANCZOS)
mask = Image.new("L", (360 * 4, 360 * 4), 0)
ImageDraw.Draw(mask).ellipse((0, 0, 360 * 4 - 1, 360 * 4 - 1), fill=255)
img.paste(photo, (760, 135), mask.resize((360, 360), Image.LANCZOS))
d.ellipse([757, 132, 757 + 366, 132 + 366], outline=GREEN, width=3)

x = 80
d.text((x, 150), "Sadjad (Mo) Asadi", font=bold, fill=WHITE)
d.rectangle([x, 245, x + 90, 249], fill=GREEN)
d.text((x, 285), "Senior Software Engineer", font=medium, fill=BLUE)
d.text((x, 335), "Eleven years on production systems", font=light, fill=MUTED)

for i, line in enumerate([
    "Post-quantum cryptography policy",
    "Healthcare data standards",
    "Agent-legible codebases",
]):
    y = 415 + i * 42
    d.ellipse([x + 2, y + 11, x + 10, y + 19], fill=GREEN)
    d.text((x + 26, y), line, font=light, fill=WHITE)

d.text((x, 560), "lvlrsajjad.github.io", font=light, fill=MUTED)

img.save("assets/images/og-card.png", optimize=True)
print(f"wrote assets/images/og-card.png  {img.size[0]}x{img.size[1]}")
