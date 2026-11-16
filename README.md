# Stickman · Orthonormal Cartesian Frame v4.0

An interactive **Orthonormal Cartesian Coordinate System `(O; i, j)`**, **Vector Mechanics Engine**, & **Anime Stickman Action-Calculus Game** where a stylized procedural-IK warrior sprints, climbs the `y`-axis, surfs arbitrary `y = f(x)` curves across all four quadrants, **physically throws & rides steerable vectors (`u⃗`)**, composes velocities via **Chasles' relation ($\vec{u} + \vec{w} = \vec{R}$)**, and battles articulated Stickman constructs using mathematical swords & parries.

## What's New in v4.0

- **Physical Vector Throwing + Smooth 360° Mid-Ride Steering & Overdrive**:
  - Aim & launch (`U` or mouse aim) plays a windup IK arm coil and whips a glowing vector spear forward from Stickman's hand (`throwState`), allowing sprinting/leaping right onto the shaft to ride it.
  - While riding, steer direction angle $\theta$ smoothly in full 360° (`W`/`S`/`A`/`D` or Arrows) around your stance pivot with conserved $\|\vec{u}\|$, engage **`Shift` Vector Overdrive (`×2.35`)** with slipstream shockwaves & GPU ribbons, use **`U` mid-ride** for live **Chasles addition**, and **`Space`** to vault cleanly off.
- **Alan Becker × Dead Cells IK Stickman Combat (`ساحة المعركة الرياضية` / `Arena`)**:
  - Battle **articulated procedural-IK Stickman enemies** wielding math-reactive weaponry and glowing `!` telegraph windups across all 6 archetypes (`poly`, `deficit`, `harmonic`, `vector_charger`, `kink`, and 4-phase `Boss`).
  - Wield **4 selectable Swords & Weapons** (`[1] d/dx` Katana, `[2] ∫ dx` Heavy Broadsword, `[3] -f(x)` Twin Blades, `[4] -v⃗ / ⊥` Force Spear) with **3-hit melee combos**, crescent slash arcs + sword-wave projectiles, timed **Parry** (`K` or Right-Click, `+4 HP` & `PARRY CRIT`), **Air Ground-Slam** (`S + Attack`), **Hitstop** freeze frames, and DPR-aware **Screen Shake**.
- **Selectable Anime Warrior Styles (`N` / Toolbar Switcher)** + Dynamic GPU Shader Sync:
  - **`Infinity` (Gojo)**: Wind-reactive spiky silver-white hair, dark obsidian coat, Six Eyes cyan glow.
  - **`Zero Curse` (Toji)**: Swept black hair with bangs, fitted top + hakama trousers, purple sash, emerald aura.
  - **`Crimson Pyre` (Benimaru)**: Black-crimson spiky hair, flame-motif haori, mismatched `○ / ×` eyes.
  - **`Animator+` (Alan)**: Sharp classic Stickman silhouette enhanced with amber energy aura.

## Included from v3.0 & Core

- **Symbolic Calculus CAS Engine & Vector Mechanics**: Parses `y = f(x)`, symbolically computes $f'(x)$, $f''(x)$, roots/extrema, and signed integrals $\int_0^x f(t)\,dt$; Quadrant III/IV curve surfing (`S + Space` drop-through), WebGL 2 shader FX, procedural Web Audio SFX/synth, and 6 **Derivative Mastery Trials**.
- **Multi-Input & Desktop/Web Ready**: Keyboard, Mouse, Gamepad/Controller, On-Screen Touch Pad, packaged for Windows via **Tauri 2**.

## Download for Windows

Grab the latest Windows installer (`*-setup.exe` / `*.msi`) or portable `.zip` from the [**Releases**](../../releases) page!

## Local Development (Web)

Open `index.html` directly in a modern browser or serve the directory with any static server:

```bash
npx serve .
```

## Automated Windows Releases (GitHub Actions)

Pushing a version tag like `v4.0.0` triggers `.github/workflows/release.yml` on `windows-latest` to compile the Tauri v2 desktop app and publish the Windows installers and portable archive automatically to GitHub Releases.
