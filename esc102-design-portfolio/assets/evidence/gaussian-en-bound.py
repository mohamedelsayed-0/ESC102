import os
import numpy as np
import matplotlib.pyplot as plt

# symplectic spectrum + log-negativity

def omega_2():
    return np.array([[0.0, 1.0], [-1.0, 0.0]])

def omega_4():
    O2 = omega_2()
    return np.block([[O2, np.zeros((2,2))],
                     [np.zeros((2,2)), O2]])

def partial_transpose_cm(V):
    P = np.diag([1.0, 1.0, 1.0, -1.0])
    return P @ V @ P

def symplectic_eigs(V):
    Om = omega_4()
    eigvals = np.linalg.eigvals(1j * Om @ V)
    vals = np.sort(np.abs(eigvals))
    return vals[0], vals[2]

def log_negativity(V):
    Vpt = partial_transpose_cm(V)
    nu_min, _ = symplectic_eigs(Vpt)
    EN = max(0.0, -np.log(nu_min))
    return EN, nu_min

# TMSV covariance matrix

def tmsv_cm(r):
    a = np.cosh(2*r)
    c = np.sinh(2*r)
    I2 = np.eye(2)
    Z = np.diag([1.0, -1.0])
    A = a * I2
    B = a * I2
    C = c * Z
    V = np.block([[A, C],
                  [C.T, B]])
    return V

# two-mode independent phase-insensitive channels

def apply_phase_insensitive_two_mode(V, tau1, nu1, tau2, nu2):
    A = V[:2, :2]
    C = V[:2, 2:]
    B = V[2:, 2:]

    I2 = np.eye(2)
    Apr = tau1 * A + nu1 * I2
    Bpr = tau2 * B + nu2 * I2
    Cpr = np.sqrt(tau1 * tau2) * C

    Vpr = np.block([[Apr, Cpr],
                    [Cpr.T, Bpr]])
    return Vpr, Apr, Bpr, Cpr

# Compatibility wrappers

def apply_two_mode_phase_insensitive(V, tau1, nu1, tau2, nu2):
    # returns only the transformed covariance matrix
    Vpr, _, _, _ = apply_phase_insensitive_two_mode(V, tau1, nu1, tau2, nu2)
    return Vpr

def exact_log_negativity(V):
    # returns only E_N.
    EN, _ = log_negativity(V)
    return EN

def reference_bound(V):
    # compute the reference bound from the full covariance matrix.
    A = V[:2, :2]
    C = V[:2, 2:]
    B = V[2:, 2:]
    return bound_EN(A, B, C, V)

# Reference bound
# E_bound = max(0, 0.5*log( (detA + detB + 2|detC|) / detV ))

def bound_EN(A, B, C, V):
    detA = float(np.linalg.det(A))
    detB = float(np.linalg.det(B))
    detC = float(np.linalg.det(C))
    detV = float(np.linalg.det(V))
    Delta_plus = detA + detB + 2.0 * abs(detC)
    if detV <= 0 or Delta_plus <= 0:
        return np.nan
    val = 0.5 * np.log(Delta_plus / detV)
    return max(0.0, val)

def rel_error(Eb, E):
    # relative error meaningful only when E>0; clip denom
    return (Eb - E) / max(E, 1e-9)

# parameter helper functions

def pure_loss_params(eta):
    return eta, 1.0 - eta

def thermal_loss_params(eta, Nth):
    return eta, (1.0 - eta) * (2.0 * Nth + 1.0)

def amplifier_params(g):
    return g, g - 1.0

# thermal threshold formula (symmetric thermal loss, TMSV)

def rc_thermal(eta, Nth):
    denom = 1.0 - (1.0 - eta) * (2.0 * Nth + 1.0)
    if denom <= 0:
        return np.inf
    ratio = eta / denom
    if ratio <= 1.0:
        return 0.0
    return 0.5 * np.log(ratio)

# plot helper functions

def ensure_fig_dir():
    os.makedirs("figs", exist_ok=True)

def plot_exact_bound(rs, exact, bound, title, filename, vline=None):
    plt.figure()
    plt.plot(rs, exact, label="Exact $E_N$")
    plt.plot(rs, bound, label="Reference bound $E_{\\mathrm{ref}}$")
    if vline is not None and np.isfinite(vline):
        plt.axvline(vline, linestyle="--", label=f"$r_c$={vline:.3f}")
    plt.xlabel("squeezing $r$")
    plt.ylabel("$E_N$ (nats)")
    plt.title(title)
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join("figs", filename), dpi=200)
    plt.close()

def plot_relative_error(rs, exact, bound, title, filename):
    rel = np.array([rel_error(b, e) for b, e in zip(bound, exact)])
    plt.figure()
    plt.plot(rs, rel, label="Relative error $(E_{\\mathrm{ref}}-E_N)/E_N$")
    plt.axhline(0.0, linewidth=1)
    plt.xlabel("squeezing $r$")
    plt.ylabel("relative error")
    plt.title(title)
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join("figs", filename), dpi=200)
    plt.close()

def main():
    ensure_fig_dir()

    print(f"Vacuum artifact constant: 0.5*log(2) = {0.5*np.log(2):.6f} nats")

    rs = np.linspace(0.0, 3.0, 301)

    # Pure loss: exact vs bound + relative error
    etas = [0.2, 0.4, 0.6, 0.8]
    for eta in etas:
        tau, nu = pure_loss_params(eta)
        exact_vals = []
        bound_vals = []
        for r in rs:
            V0 = tmsv_cm(r)
            Vp, A, B, C = apply_phase_insensitive_two_mode(V0, tau, nu, tau, nu)
            EN, _ = log_negativity(Vp)
            EB = bound_EN(A, B, C, Vp)
            exact_vals.append(EN)
            bound_vals.append(EB)

        plot_exact_bound(
            rs, exact_vals, bound_vals,
            title=f"Pure loss (symmetric), $\\eta={eta}$",
            filename=f"pure_loss_eta_{eta:.1f}.png"
        )
        plot_relative_error(
            rs, exact_vals, bound_vals,
            title=f"Pure loss relative error (symmetric), $\\eta={eta}$",
            filename=f"pure_loss_eta_{eta:.1f}_relerr.png"
        )

    # Thermal loss exact vs bound + relative error + rc check
    eta = 0.6
    Nths = [0.0, 0.1, 0.5, 1.0]
    for Nth in Nths:
        tau, nu = thermal_loss_params(eta, Nth)
        exact_vals = []
        bound_vals = []
        for r in rs:
            V0 = tmsv_cm(r)
            Vp, A, B, C = apply_phase_insensitive_two_mode(V0, tau, nu, tau, nu)
            EN, _ = log_negativity(Vp)
            EB = bound_EN(A, B, C, Vp)
            exact_vals.append(EN)
            bound_vals.append(EB)

        rc = rc_thermal(eta, Nth)

        plot_exact_bound(
            rs, exact_vals, bound_vals,
            title=f"Thermal loss (sym.), $\\eta={eta}$, $N_{{th}}={Nth}$",
            filename=f"thermal_loss_eta_{eta:.1f}_Nth_{Nth:.1f}.png",
            vline=rc
        )
        plot_relative_error(
            rs, exact_vals, bound_vals,
            title=f"Thermal loss relative error, $\\eta={eta}$, $N_{{th}}={Nth}$",
            filename=f"thermal_loss_eta_{eta:.1f}_Nth_{Nth:.1f}_relerr.png"
        )

        idx = next((i for i, val in enumerate(exact_vals) if val > 1e-6), None)
        r_num = rs[idx] if idx is not None else np.inf
        print(f"[THERMAL] eta={eta}, Nth={Nth}: rc_formula={rc:.6f}, rc_numeric~{r_num:.6f}")

    # amplifier exact vs bound + relative error 
    gs = [1.5, 2.0, 3.0]
    for g in gs:
        tau, nu = amplifier_params(g)
        exact_vals = []
        bound_vals = []
        for r in rs:
            V0 = tmsv_cm(r)
            Vp, A, B, C = apply_phase_insensitive_two_mode(V0, tau, nu, tau, nu)
            EN, _ = log_negativity(Vp)
            EB = bound_EN(A, B, C, Vp)
            exact_vals.append(EN)
            bound_vals.append(EB)

        plot_exact_bound(
            rs, exact_vals, bound_vals,
            title=f"Quantum-limited amplifier (sym.), $g={g}$",
            filename=f"amplifier_g_{g:.1f}.png"
        )
        plot_relative_error(
            rs, exact_vals, bound_vals,
            title=f"Amplifier relative error (sym.), $g={g}$",
            filename=f"amplifier_g_{g:.1f}_relerr.png"
        )

    # heatmaps absolute slack and relative error (pure loss, realistic r)
    eta_grid = np.linspace(0.1, 0.9, 81)
    r_grid = np.linspace(0.0, 1.5, 121)  # ~0--13 dB-ish
    slack = np.zeros((len(eta_grid), len(r_grid)))
    rel = np.zeros((len(eta_grid), len(r_grid)))

    for i, eta in enumerate(eta_grid):
        tau, nu = pure_loss_params(eta)
        for j, r in enumerate(r_grid):
            V0 = tmsv_cm(r)
            Vp, A, B, C = apply_phase_insensitive_two_mode(V0, tau, nu, tau, nu)
            EN, _ = log_negativity(Vp)
            EB = bound_EN(A, B, C, Vp)
            slack[i, j] = EB - EN
            rel[i, j] = rel_error(EB, EN)

    # absolute slack heatmap
    plt.figure()
    plt.imshow(
        slack, origin="lower", aspect="auto",
        extent=[r_grid[0], r_grid[-1], eta_grid[0], eta_grid[-1]]
    )
    plt.colorbar(label="Slack $E_{\\mathrm{ref}}-E_N$ (nats)")
    plt.xlabel("squeezing $r$")
    plt.ylabel("transmissivity $\\eta$")
    plt.title("Pure loss: absolute slack heatmap (symmetric)")
    plt.tight_layout()
    plt.savefig(os.path.join("figs", "heatmap_pure_loss_slack.png"), dpi=200)
    plt.close()

    # relative error heatmap (clip for visualization)
    rel_clip = np.clip(rel, -1.0, 5.0)  # avoid huge spikes near EN ~ 0
    plt.figure()
    plt.imshow(
        rel_clip, origin="lower", aspect="auto",
        extent=[r_grid[0], r_grid[-1], eta_grid[0], eta_grid[-1]]
    )
    plt.colorbar(label="Relative error (clipped)")
    plt.xlabel("squeezing $r$")
    plt.ylabel("transmissivity $\\eta$")
    plt.title("Pure loss: relative error heatmap (symmetric, clipped)")
    plt.tight_layout()
    plt.savefig(os.path.join("figs", "heatmap_pure_loss_relerr.png"), dpi=200)
    plt.close()

    print(f"[PURE LOSS HEATMAP] r∈[0,1.5], eta∈[0.1,0.9]: "
          f"max slack={np.max(slack):.6f}, mean slack={np.mean(slack):.6f}")
    print("Done. Figures saved to ./figs/")

if __name__ == "__main__":
    main()
