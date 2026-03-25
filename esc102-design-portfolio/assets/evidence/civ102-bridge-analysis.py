"""
Enhanced Bridge FOS Analysis - Following MATLAB Simulation Logic
Adds comprehensive FOS tracking, BMD/SFD envelopes, and detailed failure analysis
"""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from matplotlib.lines import Line2D
from math import pi

# Import section calculations
import section as secmod
from section import compute_section_properties

def sig_str(x):
    """Format numbers with slide rule precision"""
    if x == 0:
        return "0"
    x_abs = abs(x)
    sci = f"{x_abs:.5e}"
    first_sig_digit = sci[0]
    return f"{x:.4g}" if first_sig_digit == "1" else f"{x:.3g}"

# Import geometry
if hasattr(secmod, "get_geometry"):
    geometry = secmod.get_geometry()
elif hasattr(secmod, "geometry"):
    geometry = secmod.geometry
else:
    raise ValueError("section.py must define geometry or get_geometry().")

# Compute section properties
ybar, ytop, ybot, I, Q_centroid, Q_glue, t_shear, t_glue = compute_section_properties(geometry)

# Bridge parameters (matching MATLAB)
L = 1269
E = 4000
mu = 0.2

spacing_A = 176
spacing_B = 164

TOTAL_LOAD = 400
num_axles = 6
P_axle = TOTAL_LOAD / num_axles
load_values = [P_axle] * num_axles

offsets = np.array([
    0,
    spacing_A,
    spacing_A + spacing_B,
    spacing_A + spacing_B + spacing_A,
    spacing_A + spacing_B + spacing_A + spacing_B,
    spacing_A + spacing_B + spacing_A + spacing_B + spacing_A
])

train_length = offsets[-1]

print(f"\n{'='*70}")
print("ENHANCED BRIDGE FOS ANALYSIS")
print(f"{'='*70}")
print(f"Span: {L} mm | E: {E} MPa | I: {sig_str(I)} mm^4")
print(f"Total train load: {TOTAL_LOAD} N (6 axles × {P_axle:.1f} N)")
print(f"Train length: {train_length} mm")

# Print section properties
print(f"\n{'='*70}")
print("CROSS-SECTION PROPERTIES")
print(f"{'='*70}")
print(f"ȳ (ybar): {sig_str(ybar)} mm")
print(f"y_top: {sig_str(ytop)} mm")
print(f"y_bot: {sig_str(ybot)} mm")
print(f"I: {sig_str(I)} mm⁴ = {sig_str(I/1e6)} × 10⁶ mm⁴")
print(f"Q_centroid: {sig_str(Q_centroid)} mm³")
print(f"Q_glue: {sig_str(Q_glue)} mm³")
print(f"t_shear: {sig_str(t_shear)} mm")
print(f"t_glue: {sig_str(t_glue)} mm")
print(f"{'='*70}\n")

# Discretization (matching Python analysis)
num_points = 1201
x = np.linspace(0, L, num_points)
slide_step = 1.0

# Train positions for envelope calculation
group_length = offsets[-1]
start_positions = np.arange(0, L - group_length + 1e-9, slide_step)

print(f"Computing envelopes over {len(start_positions)} train positions...")

# SFD and BMD calculation functions
def compute_sfd(load_positions, load_vals):
    """Compute shear force diagram"""
    total_load = sum(load_vals)
    moment_A = sum(p * m for p, m in zip(load_positions, load_vals))
    
    RB = moment_A / L
    RA = total_load - RB
    
    V = np.ones_like(x) * RA
    for p, m in zip(load_positions, load_vals):
        V[x >= p] -= m
    return V

def compute_bmd(V):
    """Compute bending moment diagram"""
    dx = x[1] - x[0]
    M = np.cumsum(V) * dx
    M[-1] = 0
    return M

# Compute envelopes
env_M_pos = np.full_like(x, -np.inf)
env_M_neg = np.full_like(x, np.inf)
env_V_pos = np.full_like(x, -np.inf)
env_V_neg = np.full_like(x, np.inf)

# Sample positions for visualization
sample_idx = [
    0,
    len(start_positions) // 4,
    len(start_positions) // 2,
    3 * len(start_positions) // 4,
    len(start_positions) - 1
]

sample_M_list = []
sample_V_list = []

for i, p0 in enumerate(start_positions):
    loads_here = p0 + offsets
    V = compute_sfd(loads_here, load_values)
    M = compute_bmd(V)
    
    env_M_pos = np.maximum(env_M_pos, M)
    env_M_neg = np.minimum(env_M_neg, M)
    env_V_pos = np.maximum(env_V_pos, V)
    env_V_neg = np.minimum(env_V_neg, V)
    
    if i in sample_idx:
        sample_M_list.append(M.copy())
        sample_V_list.append(V.copy())

BMD_envelope = env_M_pos
SFD_envelope = env_V_pos

print("Envelope computation complete.")

# Material capacities (matching MATLAB)
tension_cap = 30
compression_cap = 6
shear_cap_matboard = 4
shear_cap_glue = 2

# Buckling parameters (matching MATLAB section2.m)
t_flange = 2 * geometry["top_flange_thickness"]  # double layer top flange
b_web = 2 * geometry["web_thickness"]  # paired webs (matching MATLAB web_pair_thickness)
h_web = geometry["web_height"]

# Buckling Case 1: inboard panel
if "b_in" in geometry:
    b_in = geometry["b_in"]
else:
    b_in = geometry["bottom_flange_width"] - 2.0 * b_web

# Buckling Case 2: outstand panel
if "b_out" in geometry:
    b_out = geometry["b_out"]
else:
    b_out = (geometry["top_flange_width"] - geometry["bottom_flange_width"]) / 2.0

# Buckling Case 4: diaphragm spacing
n_diaphragms = 10.5
a = L / (n_diaphragms + 1.0)

# Calculate buckling capacities
k1 = 4.0
sigma_case1 = k1 * pi**2 * E / (12.0 * (1 - mu**2)) * (t_flange / b_in)**2

k2 = 0.425
sigma_case2 = k2 * pi**2 * E / (12.0 * (1 - mu**2)) * (t_flange / b_out)**2

k3 = 6.0
sigma_case3 = k3 * pi**2 * E / (12.0 * (1 - mu**2)) * (b_web / ytop)**2

k4 = 5.0
tau_case4 = k4 * pi**2 * E / (12.0 * (1 - mu**2)) * ((b_web / h_web)**2 + (b_web / a)**2)

cap_flange_buckling = min(sigma_case1, sigma_case2)
cap_web_buckling = sigma_case3
cap_shear_buckling = tau_case4

print(f"\nCAPACITIES:")
print(f"  Tension: {tension_cap} MPa")
print(f"  Compression: {compression_cap} MPa")
print(f"  Flange Buckling (Case 1): {sig_str(sigma_case1)} MPa")
print(f"  Flange Buckling (Case 2): {sig_str(sigma_case2)} MPa")
print(f"  Flange Buckling (min): {sig_str(cap_flange_buckling)} MPa")
print(f"  Web Buckling (Case 3): {sig_str(cap_web_buckling)} MPa")
print(f"  Shear (Matboard): {shear_cap_matboard} MPa")
print(f"  Shear (Glue): {shear_cap_glue} MPa")
print(f"  Shear Buckling (Case 4): {sig_str(cap_shear_buckling)} MPa")
print(f"\nBuckling parameters:")
print(f"  b_in = {sig_str(b_in)} mm")
print(f"  b_out = {sig_str(b_out)} mm")
print(f"  a (diaphragm) = {sig_str(a)} mm\n")

# Calculate stresses from envelopes
eps = 1e-10

stress_top = -BMD_envelope * ytop / I   # compression at top for +M
stress_bot = BMD_envelope * ybot / I    # tension at bottom for +M

tau_cent = SFD_envelope * Q_centroid / (I * t_shear)
tau_gl = SFD_envelope * Q_glue / (I * t_glue)

# Calculate FOS for all modes
stress_bot_tens = np.maximum(stress_bot, 0.0)
stress_top_comp = np.maximum(-stress_top, 0.0)

FOS_tension = tension_cap / (stress_bot_tens + eps)
FOS_compression = compression_cap / (stress_top_comp + eps)
FOS_buck_case1 = sigma_case1 / (stress_top_comp + eps)
FOS_buck_case2 = sigma_case2 / (stress_top_comp + eps)
FOS_buck_case3 = sigma_case3 / (stress_top_comp + eps)
FOS_buck_case4 = tau_case4 / (np.abs(tau_cent) + eps)
FOS_shear_mat = shear_cap_matboard / (np.abs(tau_cent) + eps)
FOS_shear_glue = shear_cap_glue / (np.abs(tau_gl) + eps)

# Minimum FOS at each position
FOS_min = np.minimum.reduce([
    FOS_tension,
    FOS_compression,
    FOS_buck_case1,
    FOS_buck_case2,
    FOS_buck_case3,
    FOS_buck_case4,
    FOS_shear_mat,
    FOS_shear_glue
])

# Analysis metrics
min_FOS_global = np.min(FOS_min)
idx_min_global = np.argmin(FOS_min)
x_min_global = x[idx_min_global]
P_failure = TOTAL_LOAD * min_FOS_global

# Find first location where FOS < 1
below1 = np.where(FOS_min < 1.0)[0]
if len(below1) > 0:
    fail_idx = below1[0]
    fail_x = x[fail_idx]
    failed_under_current_load = True
else:
    fail_idx = idx_min_global
    fail_x = x_min_global
    failed_under_current_load = False

min_FOS_at_reported = FOS_min[fail_idx]

# Identify critical mode at failure location
modes = [
    "Flexural Tension",
    "Flexural Compression",
    "Buckling Case 1 (Top flange inboard)",
    "Buckling Case 2 (Top flange outstand)",
    "Buckling Case 3 (Web compression)",
    "Buckling Case 4 (Shear w/ diaphragms)",
    "Shear (Matboard)",
    "Shear (Glue)"
]

vals_at_reported = [
    FOS_tension[fail_idx],
    FOS_compression[fail_idx],
    FOS_buck_case1[fail_idx],
    FOS_buck_case2[fail_idx],
    FOS_buck_case3[fail_idx],
    FOS_buck_case4[fail_idx],
    FOS_shear_mat[fail_idx],
    FOS_shear_glue[fail_idx]
]

mode_reported = modes[np.argmin(vals_at_reported)]

# Minimum FOS across span for each mode
mins_over_span = [
    np.min(FOS_tension),
    np.min(FOS_compression),
    np.min(FOS_buck_case1),
    np.min(FOS_buck_case2),
    np.min(FOS_buck_case3),
    np.min(FOS_buck_case4),
    np.min(FOS_shear_mat),
    np.min(FOS_shear_glue)
]

print(f"{'='*70}")
print("ANALYSIS RESULTS")
print(f"{'='*70}")
print(f"Applied load: {sig_str(TOTAL_LOAD)} N")
print(f"Predicted failure load: {sig_str(P_failure)} N")
print(f"Global min FOS: {sig_str(min_FOS_global)} at x = {sig_str(x_min_global)} mm")
if failed_under_current_load:
    print("⚠ Failure occurs under CURRENT load (first location where min FOS < 1).")
else:
    print("✓ No failure under current load (all min FOS >= 1).")
print(f"Reported location: {sig_str(fail_x)} mm | min FOS there = {sig_str(min_FOS_at_reported)}")
print(f"Critical mode there: {mode_reported}")
print(f"{'='*70}\n")

print("MIN FOS BY MODE (HISTORICAL):")
for mode, val in zip(modes, mins_over_span):
    status = "✓" if val >= 1.0 else "✗"
    print(f"  {status} {mode}: {sig_str(val)}")
print()

#%% PLOTTING
plt.style.use("default")

fig = plt.figure(figsize=(22, 13))
fig.patch.set_facecolor("#f8f9fa")

gs = GridSpec(3, 3, figure=fig, hspace=0.38, wspace=0.28,
              left=0.05, right=0.97, top=0.94, bottom=0.06,
              height_ratios=[1.0, 1.0, 1.1])

# Color scheme
colors = ["#6C5CE7", "#00CEC9", "#0984E3", "#E17055", "#00B894"]
mode_colors = ["#E74C3C", "#3498DB", "#9B59B6", "#1ABC9C", "#F39C12", "#E67E22", "#95A5A6", "#34495E"]
env_color_m = "#2D3436"
env_color_v = "#D63031"
fos_color = "#27AE60"

def style_ax(ax):
    """Apply consistent styling to axes"""
    ax.grid(True, alpha=0.18, linestyle="--", linewidth=0.8, color='#B8B8B8')
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=10.5, colors='#2C3E50')
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color('#7F8C8D')
    ax.spines["bottom"].set_color('#7F8C8D')
    ax.spines["left"].set_linewidth(1.2)
    ax.spines["bottom"].set_linewidth(1.2)

# Plot 1: BMD Envelope
ax1 = fig.add_subplot(gs[0, 0])
for i, M in enumerate(sample_M_list):
    ax1.plot(x, M, "--", linewidth=1.2, alpha=0.35, color=colors[i % len(colors)])
env_line, = ax1.plot(x, BMD_envelope, linewidth=3.5, color=env_color_m, label="Envelope", zorder=5)
ax1.axvline(fail_x, linestyle=":", linewidth=2.0, color="#E74C3C", alpha=0.7, label=f"Critical x={fail_x:.1f} mm")
sample_line = Line2D([0], [0], linestyle="--", color="gray", alpha=0.6, linewidth=1.2, label="Sample positions")
ax1.legend(handles=[env_line, sample_line], fontsize=10, framealpha=0.97, loc="upper right", 
           edgecolor='#BDC3C7', fancybox=True)
ax1.set_title("Bending Moment Envelope", fontsize=14, fontweight="bold", pad=12, color='#2C3E50')
ax1.set_xlabel("Position along bridge (mm)", fontsize=11, fontweight='semibold', color='#34495E')
ax1.set_ylabel("Bending Moment (N·mm)", fontsize=11, fontweight='semibold', color='#34495E')
ax1.set_xlim(0, L)
style_ax(ax1)

# Plot 2: SFD Envelope
ax2 = fig.add_subplot(gs[0, 1])
for i, V in enumerate(sample_V_list):
    ax2.plot(x, V, "--", linewidth=1.2, alpha=0.35, color=colors[i % len(colors)])
env_v_line, = ax2.plot(x, SFD_envelope, linewidth=3.5, color=env_color_v, label="Envelope", zorder=5)
ax2.axhline(0, linestyle="-", linewidth=1.0, color="#95A5A6", alpha=0.8)
ax2.axvline(fail_x, linestyle=":", linewidth=2.0, color="#E74C3C", alpha=0.7, label=f"Critical x={fail_x:.1f} mm")
sample_v_line = Line2D([0], [0], linestyle="--", color="gray", alpha=0.6, linewidth=1.2, label="Sample positions")
ax2.legend(handles=[env_v_line, sample_v_line], fontsize=10, framealpha=0.97, loc="upper right",
           edgecolor='#BDC3C7', fancybox=True)
ax2.set_title("Shear Force Envelope", fontsize=14, fontweight="bold", pad=12, color='#2C3E50')
ax2.set_xlabel("Position along bridge (mm)", fontsize=11, fontweight='semibold', color='#34495E')
ax2.set_ylabel("Shear Force (N)", fontsize=11, fontweight='semibold', color='#34495E')
ax2.set_xlim(0, L)
style_ax(ax2)

# Plot 3: Minimum FOS Distribution
ax3 = fig.add_subplot(gs[0, 2])
ax3.plot(x, FOS_min, linewidth=3.5, color=fos_color, zorder=3)
ax3.fill_between(x, 0, FOS_min, color=fos_color, alpha=0.12, zorder=2)
ax3.axhline(1.0, linestyle="--", linewidth=2.5, color="#E74C3C", label="FOS = 1.0", zorder=4)

# First unsafe marker
ax3.plot(fail_x, min_FOS_at_reported, "o", markersize=13,
         markerfacecolor="#E74C3C", markeredgecolor="#8B0000",
         markeredgewidth=2.5, zorder=5,
         label=f"First unsafe = {sig_str(min_FOS_at_reported)}")

# Global min marker
ax3.plot(x_min_global, min_FOS_global, "s", markersize=12,
         markerfacecolor="#2D3436", markeredgecolor="black",
         markeredgewidth=2.0, zorder=5,
         label=f"Global min = {sig_str(min_FOS_global)}")

ax3.set_title("Minimum FOS Distribution", fontsize=14, fontweight="bold", pad=12, color='#2C3E50')
ax3.set_xlabel("Position along bridge (mm)", fontsize=11, fontweight='semibold', color='#34495E')
ax3.set_ylabel("Factor of Safety", fontsize=11, fontweight='semibold', color='#34495E')
ax3.set_xlim(0, L)
fos_max = max(np.max(FOS_min), 1.1)
ax3.set_ylim(0, min(fos_max * 1.25, 10))
ax3.legend(fontsize=10, framealpha=0.97, loc="upper right", edgecolor='#BDC3C7', fancybox=True)
style_ax(ax3)

# Plot 4: All FOS Curves
ax4 = fig.add_subplot(gs[1, :])
fos_curves = [
    (FOS_tension, "Flexural Tension"),
    (FOS_compression, "Flexural Compression"),
    (FOS_buck_case1, "Buckling Case 1 (inboard)"),
    (FOS_buck_case2, "Buckling Case 2 (outstand)"),
    (FOS_buck_case3, "Buckling Case 3 (web)"),
    (FOS_buck_case4, "Buckling Case 4 (diaphragms)"),
    (FOS_shear_mat, "Shear (Matboard)"),
    (FOS_shear_glue, "Shear (Glue)")
]

for i, (fos_data, label) in enumerate(fos_curves):
    fos_clipped = np.clip(fos_data, 0, 10)
    ax4.plot(x, fos_clipped, linewidth=2.2, label=label, color=mode_colors[i], alpha=0.85)

ax4.axhline(1.0, linestyle="--", linewidth=2.8, color="#E74C3C", label="FOS = 1.0", zorder=10)
ax4.axvline(fail_x, linestyle=":", linewidth=2.2, color="#7F8C8D", alpha=0.7, zorder=1)

ax4.set_title("All Failure Mode FOS Curves", fontsize=15, fontweight="bold", pad=14, color='#2C3E50')
ax4.set_xlabel("Position along bridge (mm)", fontsize=12, fontweight='semibold', color='#34495E')
ax4.set_ylabel("Factor of Safety", fontsize=12, fontweight='semibold', color='#34495E')
ax4.set_xlim(0, L)
ax4.set_ylim(0, 10)
ax4.legend(fontsize=9.5, framealpha=0.97, loc="upper right", ncol=2, edgecolor='#BDC3C7', fancybox=True)
style_ax(ax4)

# Plot 5: Bar Chart - Min FOS by Mode
ax5 = fig.add_subplot(gs[2, 0])
labels = ["Tens", "Comp", "Case1", "Case2", "Case3", "Case4", "Shear", "Glue"]

bar_colors = []
for v in mins_over_span:
    if v > 2:
        bar_colors.append("#27AE60")
    elif v > 1:
        bar_colors.append("#F39C12")
    else:
        bar_colors.append("#E74C3C")

bars = ax5.bar(labels, mins_over_span, color=bar_colors, edgecolor="#2C3E50", 
               linewidth=1.5, alpha=0.85, width=0.7)
critical_index = np.argmin(mins_over_span)
bars[critical_index].set_edgecolor("#8B0000")
bars[critical_index].set_linewidth(3.5)
bars[critical_index].set_alpha(1.0)

ax5.axhline(1.0, linestyle="--", linewidth=2.5, color="#E74C3C", label="FOS = 1.0", zorder=10)
ax5.set_title("Minimum FOS by Mode", fontsize=13, fontweight="bold", pad=12, color='#2C3E50')
ax5.set_ylabel("Minimum Factor of Safety", fontsize=11, fontweight='semibold', color='#34495E')
ax5.set_xlabel("Failure Mode", fontsize=11, fontweight='semibold', color='#34495E')

fos_bar_max = max(mins_over_span)
ax5.set_ylim(0, min(fos_bar_max * 1.4, 10))

for bar, val in zip(bars, mins_over_span):
    ax5.text(bar.get_x() + bar.get_width()/2, val + fos_bar_max*0.04,
             sig_str(val), ha="center", va="bottom", fontsize=9.5, fontweight='bold', color='#2C3E50')

ax5.legend(fontsize=10, framealpha=0.97, loc="upper right", edgecolor='#BDC3C7', fancybox=True)
ax5.tick_params(axis='x', rotation=25)
style_ax(ax5)

# Plot 6: Design Summary Text
ax6 = fig.add_subplot(gs[2, 1:])
ax6.axis("off")

status_symbol = "✗ FAILURE" if failed_under_current_load else "✓ SAFE"
status_color = "#E74C3C" if failed_under_current_load else "#27AE60"

summary_text = f"""
╔{'═'*58}╗
║  DESIGN SUMMARY                                          ║
╚{'═'*58}╝

Applied Load:              {sig_str(TOTAL_LOAD)} N
Predicted Failure Load:    {sig_str(P_failure)} N
Status:                    {status_symbol}

{'─'*60}
CRITICAL LOCATION (First Unsafe)
{'─'*60}
Position:                  x = {sig_str(fail_x)} mm
Min FOS at location:       {sig_str(min_FOS_at_reported)}
Critical mode:             {mode_reported}

{'─'*60}
GLOBAL MINIMUM
{'─'*60}
Min FOS (global):          {sig_str(min_FOS_global)}
Position:                  x = {sig_str(x_min_global)} mm

{'─'*60}
BUCKLING PARAMETERS
{'─'*60}
b_in (inboard panel):      {sig_str(b_in)} mm
b_out (outstand panel):    {sig_str(b_out)} mm
a (diaphragm spacing):     {sig_str(a)} mm
"""

ax6.text(0.02, 0.98, summary_text, fontsize=10.2, va="top", family="monospace",
         bbox=dict(boxstyle="round,pad=0.8", facecolor="white", alpha=0.98, 
                   edgecolor='#BDC3C7', linewidth=1.5),
         color='#2C3E50', linespacing=1.6)

# Add status indicator
status_y = 0.05
ax6.text(0.50, status_y, status_symbol, fontsize=18, fontweight='bold',
         ha='center', va='bottom', color=status_color,
         bbox=dict(boxstyle="round,pad=0.5", facecolor='white', 
                   edgecolor=status_color, linewidth=3))

plt.suptitle(f"Bridge Structural Analysis — Predicted Failure Load: {sig_str(P_failure)} N",
             fontsize=18, fontweight="bold", y=0.975, color='#2C3E50')

plt.tight_layout(rect=[0, 0, 1, 0.97])
plt.show()

print("\n✓ Analysis complete! All plots generated.")