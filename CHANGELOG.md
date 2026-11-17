# Changelog

All notable releases of **Stickman · Orthonormal Cartesian Frame** are documented in this file.

## [v4.1.0] — 2026-11-16
### Added
- **Verlet Cloth, Hair & Armor Physics (`js/verlet-rig.js`)**: Distance- and angle-constrained `VerletChain` solver driving flowing scarves, spiky hair locks, twin coat/haori tails, boss capes, and headband streamers with ground collision and teleport protection.
- **Volume-Preserving Squash & Stretch (`SpringScalar`)**: Damped harmonic spring elasticity on takeoffs, dashes, heavy landings, weapon hits, and parries.
- **Curved 2-Segment Spine + Closed-Chain Two-Handed IK (`RigSolver`)**: Dynamic hip/waist/shoulder curvature, 2.5D depth twist, and locked two-handed grips on heavy broadswords and spears.
- **Weapon Smears & Enemy Upgrades**: Additive slash smear ribbons, style-tinted afterimages, and upgraded articulated silhouettes across all 6 Arena enemy archetypes.

## [v4.0.0] — 2026-11-16
### Added
- **Physical Hand-Thrown Steerable Vectors**: Windup IK arm coil throwing glowing vector spears from Stickman's hand (`throwState`), sprint/leap boarding, smooth 360° mid-ride steering (`WASD` / Arrows), and `Shift` Vector Overdrive (`×2.35`).
- **Alan Becker × Dead Cells IK Combat**: 3-hit melee combos, curved slash arcs + sword-wave projectiles, timed Parry (`K` / Right-Click with `+4 HP` & `PARRY CRIT`), Air Ground-Slam (`S + Attack`), Hitstop freeze frames, and Screen Shake.
- **4 Selectable Anime Warrior Styles (`N`)**: `Infinity` (Gojo), `Zero Curse` (Toji), `Crimson Pyre` (Benimaru), and `Animator+` (Alan), synced live to WebGL 2 shader colors.

## [v3.0.0] — 2026-11-16
### Added
- **Rideable Vectors & Chasles Relation (`js/vectors.js`)**: Launch $\vec{u} = (u_x, u_y)$ vectors via UI, mouse aim, or `U`, board them mid-air/sprint, and compose $\vec{u} + \vec{w} = \vec{R}$ live mid-ride.
- **Math Battle Arena (`js/combat.js`)**: Wave-based mathematical action combat with 4 calculus/vector weapons (`d/dx`, `∫ dx`, `-f(x)`, `-v⃗ / ⊥`) and 6 enemy archetypes including multi-phase Bosses.
- **Physics & Calculus Enhancements**: Improved curve-surfing slopes, Quadrant III/IV interactions, and procedural combat audio cues.

## [v2.0.0] — 2026-11-15
### Added
- **Symbolic CAS Calculus Engine (`js/math-cas.js`)**: Full tokenizer, AST parser, simplifier, exact symbolic $f'(x)$ and $f''(x)$, and Simpson signed integration $\int_0^x f(t)\,dt$.
- **WebGL 2 Shader FX (`js/glfx.js`)**: GPU focus halos, surf tangent ribbons, dash streaks, and dance shaders (Hollow Purple, Honored One, Disco).
- **Procedural Audio Synthesizer (`js/audio-fx.js`)**: Web Audio API sound effects and continuous slope-riding pitch synthesis.
- **Grouped HUD Toolbar**: Organized toolbar controls with `f(x)` Function Lab starting `OFF` by default.

## [v1.0.0] — 2026-11-15
### Added
- **Initial Release**: Orthonormal Cartesian Coordinate System `(O; i, j)`, procedural-IK Stickman platforming, `y`-axis climbing, `y = f(x)` slope surfing, 6 Derivative Mastery Trials, Gamepad & Touch controls, and Windows Tauri v2 desktop packaging with GitHub Actions CI/CD.
