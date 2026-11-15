# Stickman · Orthonormal Cartesian Frame v2.0

An interactive **Orthonormal Cartesian Coordinate System `(O; i, j)`** & **Calculus Playground** where an IK-animated Stickman physically walks, climbs the `y`-axis, free-falls, dances, and **surfs arbitrary `y = f(x)` curves** governed by real-time derivatives $f'(x)$ and concavity $f''(x)$.

## What's New in v2.0

- **Symbolic Calculus CAS Engine**: Parses `y = f(x)` into an AST, symbolically differentiates exact expressions for $f'(x)$ and $f''(x)$, detects **roots and local extrema**, and computes live signed **definite integrals** $\int_0^x f(t)\,dt$ with Simpson quadrature and signed area shading.
- **Lightweight WebGL 2 Shader Overlay (`FX`)**: Hardware-accelerated GPU glow, tangent surf ribbons, velocity streaks, and plasma/prism dance shaders designed to run smoothly at 60 FPS even on Intel HD / DirectX 11 integrated GPUs (with automatic fallback if unavailable).
- **Procedural Web Audio Math Synth**: Velocity- and slope-reactive surfing oscillator plus crisp synthesized SFX for jumps, dashes, landings, flips, point locks, and trial clears (respecting mute `M`).
- **Organized Toolbar & Clean Launch**: Top controls are grouped into **Camera · Math · Actions · Interface**, and `f(x)` starts **`OFF` by default** at launch so you begin directly in the clean `(O; i, j)` frame.

## Features

- **Living Orthonormal Frame `(O; i, j)`**: Auto-scaling grid, basis vectors `i` and `j`, live `(x, y)` projections, velocity vector `v`, dark/light themes, zoom & pan.
- **IK Stickman Physics & Animation**: 2-bone inverse kinematics legs, dynamic Verlet scarf, walk/run/crouch/slide/dash/double-jump/flip, `y`-axis climbing (`x = 0`), free fall with dive & air-brake.
- **`y = f(x)` Slope Surfing & Calculus Lab**: Type expressions (`sin`, `cos`, `tan`, `exp`, `ln`, `abs`, `sqrt`, `^`, implicit multiplication like `2x` or `3sin(x)`), toggle live `f'(x)` curves, `∫ dx` area shading, and `Roots` markers.
- **Derivative Mastery Trials (تحديات إتقان المشتقات)**: 6 Arabic calculus challenges covering tangent lines, critical points (`f'(x) = 0`), inflection points (`f''(x) = 0`), graphing `f'(x)`, smooth $C^1$ seams, and launch calculus.
- **Multi-Input**: Keyboard, Gamepad/Controller (with live HUD monitor), and On-Screen Touch Pad.
- **Desktop & Web Ready**: Packaged for Windows via **Tauri 2** (hardware-accelerated WebView2) and playable directly in the browser.

## Download for Windows

Grab the latest Windows installer (`*-setup.exe` / `*.msi`) or portable `.zip` from the [**Releases**](../../releases) page!

## Local Development (Web)

Open `index.html` directly in a modern browser or serve the directory with any static server:

```bash
npx serve .
```

## Automated Windows Releases (GitHub Actions)

Pushing a version tag like `v2.0.0` triggers `.github/workflows/release.yml` on `windows-latest` to compile the Tauri v2 desktop app and publish the Windows installers and portable archive automatically to GitHub Releases.
