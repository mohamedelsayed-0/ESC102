import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

plt.rcParams["font.family"] = "DejaVu Sans"
fig, ax = plt.subplots(figsize=(28, 22))
fig.patch.set_facecolor('#FAFAFA')
ax.set_facecolor('#FAFAFA')

def box(x, y, w, h, title, body, fc, tc="#2B2B2B", ec="#2B2B2B"):
    rect = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.02,rounding_size=0.03",
        linewidth=3, edgecolor=ec, facecolor=fc, zorder=5
    )
    ax.add_patch(rect)
    ax.text(x + w/2, y + h - 0.3, title,
            ha="center", va="top",
            fontsize=32, weight="bold", color=tc, zorder=6)
    ax.text(x + w/2, y + h - 0.9, body,
            ha="center", va="top",
            fontsize=22, color=tc, zorder=6,
            linespacing=1.5)

def make_arrow(start, end, rad, color="#546E7A", lw=3.5):
    arrow = FancyArrowPatch(
        start, end,
        connectionstyle=f"arc3,rad={rad}",
        arrowstyle="-|>",
        mutation_scale=40,
        linewidth=lw,
        color=color,
        zorder=3,
        shrinkA=10, shrinkB=10
    )
    ax.add_patch(arrow)

def bezier_point(start, end, rad, t):
    sx, sy = start; ex, ey = end
    mx, my = (sx+ex)/2, (sy+ey)/2
    dx, dy = ex-sx, ey-sy
    length = max(np.sqrt(dx**2 + dy**2), 1)
    nx, ny = -dy/length, dx/length
    cx = mx + rad*length*nx; cy = my + rad*length*ny
    return ((1-t)**2*sx + 2*(1-t)*t*cx + t**2*ex,
            (1-t)**2*sy + 2*(1-t)*t*cy + t**2*ey)

def on_arrow_label(start, end, rad, text, t=0.5, color="#546E7A", fontsize=24, ec=None):
    px, py = bezier_point(start, end, rad, t)
    if ec is None: ec = color
    ax.text(px, py, text, ha="center", va="center",
            fontsize=fontsize, color=color, weight="bold", zorder=10,
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white",
                      edgecolor=ec, linewidth=2.5, alpha=0.97))

def placed_label(x, y, text, color="#546E7A", fontsize=24, ec=None):
    if ec is None: ec = color
    ax.text(x, y, text, ha="center", va="center",
            fontsize=fontsize, color=color, weight="bold", zorder=10,
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white",
                      edgecolor=ec, linewidth=2.5, alpha=0.97))

# ===================== TITLE =====================
ax.text(0, 15.2, "Stakeholder Interrelationships",
        ha="center", fontsize=52, weight="bold", color="#1B5E20")
ax.text(0, 14.4, "Belaying Communication Design  •  Basecamp Bloor West",
        ha="center", fontsize=30, color="#546E7A", style="italic")
ax.plot([-12, 12], [14.0, 14.0], color="#B0BEC5", linewidth=1.2)

# PRIMARY label
ax.text(0, 13.4, "PRIMARY  STAKEHOLDERS",
    ha="center", fontsize=34, weight="bold", color="#1B5E20",
    bbox=dict(boxstyle="round,pad=0.35", facecolor="#E8F5E9", edgecolor="#A5D6A7", linewidth=2))

# ===================== PRIMARY BOXES =====================
pw, ph = 10, 3.2
rope_x, rope_y = -11.2, 9.8
design_x, design_y = 1.2, 9.8

box(rope_x, rope_y, pw, ph,
    "Basecamp Rope Climbers",
    "Wide age range (children to seniors)\nDiverse climbing experience\nPersonal improvement & safety\nSuccessful completion of climbs",
    fc="#2E7D32", tc="white", ec="#1B5E20")

box(design_x, design_y, pw, ph,
    "Design Team",
    "Problem framing & data collection\nSolution development\nCourse & time constraints\nDeveloping engineering design skills",
    fc="#2E7D32", tc="white", ec="#1B5E20")

# SECONDARY label
ax.text(0, 3.7, "SECONDARY  STAKEHOLDERS",
        ha="center", fontsize=34, weight="bold", color="#37474F",
        bbox=dict(boxstyle="round,pad=0.5", facecolor="#ECEFF1", edgecolor="#B0BEC5", linewidth=2))

# ===================== SECONDARY BOXES =====================
sw, sh = 7.2, 2.8
staff_x, staff_y = -11.5, 0.0
vendors_x, vendors_y = -3.5, 0.0
clubs_x, clubs_y = 4.5, 0.0

box(staff_x, staff_y, sw, sh,
    "Staff & Owners",
    "Route setters, coaches, management\nBusiness operations & livelihood\nDirectly tied to patrons",
    fc="#E3F2FD", ec="#64B5F6")

box(vendors_x, vendors_y, sw, sh,
    "Vendors",
    "Local product sales at Basecamp\nCommunity presence\nA few times per year",
    fc="#E8F5E9", ec="#81C784")

box(clubs_x, clubs_y, sw, sh,
    "Partners Clubs",
    "UofT Climbing Club\nCanadian Adaptive Climbing Society\nRehabilitation & inclusive climbing",
    fc="#FFF3E0", ec="#FFB74D")

# ===================== ENDPOINTS =====================
r1 = (rope_x + pw*0.10, rope_y)
r2 = (rope_x + pw*0.45, rope_y)
r3 = (rope_x + pw*0.90, rope_y)
d1 = (design_x + pw*0.10, design_y)
d2 = (design_x + pw*0.55, design_y)
d3 = (design_x + pw*0.90, design_y)
st_t = (staff_x + sw*0.5, staff_y + sh)
vt_l = (vendors_x + sw*0.25, vendors_y + sh)
vt_r = (vendors_x + sw*0.75, vendors_y + sh)
ct_t = (clubs_x + sw*0.5, clubs_y + sh)
d1_staff = (staff_x + sw*0.7, staff_y + sh)

# ===================== ARROWS =====================

# 1. Rope → Staff (blue)
rad1 = 0.06
make_arrow(r1, st_t, rad1, color="#1565C0")
on_arrow_label(r1, st_t, rad1, "Safety &\nsupervision\nrequirements", t=0.30, color="#1565C0")

# 2. Rope → Vendors (green)
rad2 = 0.0
make_arrow(r2, vt_l, rad2, color="#388E3C")
on_arrow_label(r2, vt_l, rad2, "Compatibility", t=0.28, color="#388E3C")

# 3. Rope → Clubs (orange)
rad3 = -0.06
make_arrow(r3, ct_t, rad3, color="#E65100")
on_arrow_label(r3, ct_t, rad3, "Inclusivity &\nacceptable practices", t=0.45, color="#E65100")

# 4. Design → Staff (blue, big curve)
# NOTE: removed the Design -> Staff arrow per request (was a large curved blue arrow)

# 5. Design → Vendors (green)
rad5 = 0.0
make_arrow(d2, vt_r, rad5, color="#388E3C")
on_arrow_label(d2, vt_r, rad5, "Available components\n& integration", t=0.28, color="#388E3C")

# 6. Design → Clubs (orange)
rad6 = 0.06
make_arrow(d3, ct_t, rad6, color="#E65100")
on_arrow_label(d3, ct_t, rad6, "User testing\n& feedback", t=0.30, color="#E65100")

# Gym policies — in gap between blue and green lines
placed_label(-7.0, 6.0, "Gym policies, space\n& staff workload",
             color="#388E3C", fontsize=24, ec="#1565C0")

# ===================== LAYOUT =====================
ax.set_xlim(-13.5, 13.5)
ax.set_ylim(-0.8, 16.2)
ax.axis("off")
# Prepare outputs directory next to this script
script_dir = os.path.dirname(os.path.abspath(__file__))
outputs_dir = os.path.join(script_dir, 'outputs')
os.makedirs(outputs_dir, exist_ok=True)
out_path = os.path.join(outputs_dir, 'diagram.png')
plt.savefig(out_path, dpi=150, bbox_inches='tight', facecolor='#FAFAFA')

# Write a simple index.html to display the image (overwrite each run)
index_html = '''<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <title>Stakeholder Diagram</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{background:#FAFAFA;margin:0;display:flex;align-items:center;justify-content:center;height:100vh}</style>
    </head>
    <body>
        <img src="diagram.png" alt="diagram" style="max-width:100%;height:auto;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
    </body>
</html>'''
with open(os.path.join(outputs_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(index_html)

print(f"Saved diagram to: {out_path}")

# Start a simple HTTP server to serve the outputs directory on port 8000
port = 8000
os.chdir(outputs_dir)
handler = SimpleHTTPRequestHandler
httpd = HTTPServer(('0.0.0.0', port), handler)
print(f"Serving diagram at http://localhost:{port}/")
try:
        httpd.serve_forever()
except KeyboardInterrupt:
        print('\nShutting down server')
        httpd.server_close()