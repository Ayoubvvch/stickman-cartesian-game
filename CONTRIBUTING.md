# Contributing to Stickman · Orthonormal Cartesian Frame

Thank you for your interest in contributing! Whether you're fixing a physics edge case, adding a new calculus trial, tuning procedural animation, or improving accessibility and translations, your help is welcome.

## Development Setup

### Web Version (Zero Build Required)

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/Ayoubvvch/stickman-cartesian-game.git
   cd stickman-cartesian-game
   ```
2. Serve the project with any static file server (e.g. `npx serve .` or `python -m http.server 8080`).
3. Edit `index.html`, `style.css`, or modules under `js/` and refresh your browser.

### Windows Desktop App (Tauri v2)

Prerequisites: [Node.js 22+](https://nodejs.org/) and [Rust](https://rustup.rs/).

```bash
npm ci
npm run tauri dev
```

To verify the static bundle output:

```bash
npm run build
```

## Project Architecture

| File | Responsibility |
| --- | --- |
| `js/config.js` | Physics constants, character style palettes, themes (`black` / `light`), math helpers |
| `js/math-cas.js` | Tokenizer, AST parser, simplifier, symbolic differentiator ($f', f''$), Simpson integration |
| `js/functions.js` | $y = f(x)$ sampler, curve/derivative/integral rendering, root & extrema detection |
| `js/challenges.js` | 6 interactive Derivative Mastery Trials |
| `js/vectors.js` | Steerable vector spears, Chasles composition ($\vec{u} + \vec{w} = \vec{R}$), boarding & aim preview |
| `js/combat.js` | Math Battle Arena, 4 mathematical weapons, parry/hitstop/slam, 6 IK enemy archetypes |
| `js/verlet-rig.js` | `SpringScalar`, `VerletChain` cloth/hair/cape physics, `RigSolver` (2-bone + closed-chain IK + spine) |
| `js/stickman.js` | Player locomotion, curve surfing, vector riding, dance choreography, procedural renderer |
| `js/grid.js` | Orthonormal coordinate grid, basis vectors $(\vec{i}, \vec{j})$, axis ticks, projections |
| `js/glfx.js` | WebGL 2 custom GLSL shader overlay (auras, surf ribbons, dance VFX) |
| `js/audio-fx.js` | Procedural Web Audio API synthesizer for movement, calculus, and combat cues |
| `js/particles.js` | Dust, sparks, wind streaks, afterimages, and floating music notes |
| `js/input.js` | Keyboard, mouse, Gamepad API, and on-screen touch controller |
| `js/game.js` | Main loop, HUD state synchronization, camera tracking, and audio playback |

## Guidelines

- Keep the frontend **100% dependency-free vanilla JavaScript** (no runtime npm packages or bundlers required for the web demo).
- Keep the coordinate system **strictly orthonormal** (`1 unit on x == 1 unit on y`).
- Verify all modified `.js` files pass `node --check` and test in both Dark (`black`) and Light (`light`) themes.
- Keep pull requests focused, descriptive, and include screenshots or short clips for visual/gameplay changes.

## Opening Issues & Pull Requests

- Use the provided issue templates for bug reports or feature requests.
- For significant gameplay or math engine changes, consider opening a feature issue first to align on the design.
