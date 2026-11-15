# Stickman · Orthonormal Cartesian Frame

An interactive **Orthonormal Cartesian Coordinate System `(O; i, j)`** & **Calculus Playground** where an IK-animated Stickman physically walks, climbs the `y`-axis, free-falls, dances, and **surfs arbitrary `y = f(x)` curves** governed by real-time derivatives $f'(x)$ and concavity $f''(x)$.

## Features

- **Living Orthonormal Frame `(O; i, j)`**: Auto-scaling grid, basis vectors `i` and `j`, live `(x, y)` projections, velocity vector `v`, dark/light themes, zoom & pan.
- **IK Stickman Physics & Animation**: 2-bone inverse kinematics legs, dynamic Verlet scarf, walk/run/crouch/slide/dash/double-jump/flip, `y`-axis climbing (`x = 0`), free fall with dive & air-brake.
- **`y = f(x)` Slope Surfing**: Type any mathematical expression (`sin`, `cos`, `tan`, `exp`, `ln`, `abs`, `sqrt`, `^`, implicit multiplication like `2x` or `3sin(x)`) and surf its tangent slopes, launch off convex crests (`-f''(x)·vx² > g`), and toggle live `y = f'(x)` overlay.
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

Pushing a version tag like `v1.0.0` triggers `.github/workflows/release.yml` on `windows-latest` to compile the Tauri v2 desktop app and publish the Windows installers and portable archive automatically to GitHub Releases.
