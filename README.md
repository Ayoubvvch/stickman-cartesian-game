# Stickman · Orthonormal Cartesian Frame v3.0

An interactive **Orthonormal Cartesian Coordinate System `(O; i, j)`**, **Vector Mechanics Engine**, & **Calculus Combat Playground** where an IK-animated Stickman physically walks, climbs the `y`-axis, surfs arbitrary `y = f(x)` curves across all four quadrants, **launches & rides moving mathematical vectors (`u⃗`)**, composes velocities via **Chasles' relation ($\vec{u} + \vec{w} = \vec{R}$)**, and battles calculus constructs using the right mathematical operators.

## What's New in v3.0

- **Rideable Vectors (`u⃗ = (uₓ, uᵧ)` & Chasles Addition)**:
  - Launch real Cartesian vectors (`U`, presets, numerical components, or click/drag Aim on the plane) displaying orthogonal `(i, j)` projections, magnitude `‖u⃗‖`, and angle `θ`.
  - Sprint (`Shift`) + jump onto the vector shaft to ride it with Galilean velocity composition ($\vec{V}_{\text{total}} = \vec{V}_{\text{vec}} + \vec{V}_{\text{player}}$), and trigger **`U` mid-ride** for live **Chasles addition** ($\vec{u} + \vec{w} = \vec{R}$).
- **Math Battle Arena (`ساحة المعركة الرياضية` / `Arena`)**:
  - Wave-based mathematical combat with 4 operator weapons (`[1] d/dx`, `[2] ∫ dx`, `[3] -f(x)`, `[4] -v⃗ / ⊥`) aimed by mouse or keyboard (`J`), plus right-drag camera panning.
  - Real mathematical rules against 6 enemy archetypes: lower Polynomial degrees with `d/dx` (`∫ dx` grows their degree!), fill negative Integral Deficits with `∫ dx`, cancel invariant Waves/`eˣ` with `-f(x)`, neutralize Vector Force Chargers (`F⃗`) with opposite/orthogonal vectors (`-v⃗` / `⊥` or launched rideable `u⃗` collisions!), smooth C⁰ kinks `|x - a|` with `∫ dx` before differentiating, and defeat multi-phase Boss waves.
- **Physics & Calculus Inspection Fixes**: Fixed `Sprint` toggle propagation, seamless Quadrant III/IV negative-`y` curve surfing (`S + Space` drop-through, one-way `y = 0` axis, deep fall recovery), tangent root detection (`root-min` / `root-max`) with deduplicated critical markers, and double-jump buffer bleed.

## What's Included from v2.0 & Core

- **Symbolic Calculus CAS Engine**: Parses `y = f(x)` into an AST, symbolically differentiates $f'(x)$ and $f''(x)$, detects roots/local extrema, and computes live signed definite integrals $\int_0^x f(t)\,dt$.
- **Lightweight WebGL 2 Shader Overlay (`FX`)**: Hardware-accelerated GPU glow, tangent surf ribbons, velocity streaks, and shaders with graceful fallback.
- **Procedural Web Audio Math Synth**: Velocity- and slope-reactive synth plus crisp SFX for vectors, Chasles joins, operator weapons, hits, and platforming.
- **Derivative Mastery Trials (تحديات إتقان المشتقات)**: 6 Arabic calculus challenges covering tangent lines, extrema, inflection points, $f'(x)$ graphing, smooth $C^1$ seams, and launch calculus.
- **Multi-Input & Desktop/Web Ready**: Keyboard, Mouse, Gamepad/Controller, On-Screen Touch Pad, packaged for Windows via **Tauri 2** and deployed to web.

## Download for Windows

Grab the latest Windows installer (`*-setup.exe` / `*.msi`) or portable `.zip` from the [**Releases**](../../releases) page!

## Local Development (Web)

Open `index.html` directly in a modern browser or serve the directory with any static server:

```bash
npx serve .
```

## Automated Windows Releases (GitHub Actions)

Pushing a version tag like `v3.0.0` triggers `.github/workflows/release.yml` on `windows-latest` to compile the Tauri v2 desktop app and publish the Windows installers and portable archive automatically to GitHub Releases.
