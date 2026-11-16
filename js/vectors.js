(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { CONFIG, utils } = MathStickGame;

  let nextVectorId = 1;

  function distToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    if (lenSq < 1e-8) {
      return { dist: Math.hypot(px - ax, py - ay), s: 0, qx: ax, qy: ay };
    }
    const rawS = ((px - ax) * abx + (py - ay) * aby) / lenSq;
    const s = utils.clamp(rawS, 0, 1);
    const qx = ax + s * abx;
    const qy = ay + s * aby;
    return {
      dist: Math.hypot(px - qx, py - qy),
      s,
      qx,
      qy,
    };
  }

  class VectorSystem {
    constructor(particles) {
      this.particles = particles;
      this.vectors = [];
      this.presetUx = CONFIG.VEC_DEFAULT_UX;
      this.presetUy = CONFIG.VEC_DEFAULT_UY;
      this.preview = null; // { ax, ay, ux, uy }
      this.chaslesFx = null; // { ax, ay, u1x, u1y, w2x, w2y, rx, ry, timer, maxTimer }
      this.lastFormulaText = '';
    }

    hasAny() {
      return this.vectors.length > 0 || Boolean(this.preview) || Boolean(this.chaslesFx);
    }

    clear() {
      this.vectors.length = 0;
      this.preview = null;
      this.chaslesFx = null;
      this.lastFormulaText = '';
    }

    setPresetComponents(ux, uy) {
      if (Number.isFinite(ux)) this.presetUx = utils.clamp(ux, -CONFIG.VEC_MAX_LEN, CONFIG.VEC_MAX_LEN);
      if (Number.isFinite(uy)) this.presetUy = utils.clamp(uy, -CONFIG.VEC_MAX_LEN, CONFIG.VEC_MAX_LEN);
    }

    setAimPreview(ax, ay, ux, uy) {
      const clamped = this._clampComponents(ux, uy, 1, false);
      this.preview = {
        ax,
        ay,
        ux: clamped.ux,
        uy: clamped.uy,
        norm: clamped.norm,
        angleDeg: (Math.atan2(clamped.uy, clamped.ux) * 180) / Math.PI,
      };
    }

    clearAimPreview() {
      this.preview = null;
    }

    _clampComponents(ux, uy, fallbackDir = 1, enforceMin = true) {
      let vx = Number.isFinite(ux) ? ux : fallbackDir * CONFIG.VEC_DEFAULT_UX;
      let vy = Number.isFinite(uy) ? uy : CONFIG.VEC_DEFAULT_UY;
      let norm = Math.hypot(vx, vy);
      if (norm < 1e-4) {
        vx = fallbackDir * CONFIG.VEC_DEFAULT_UX;
        vy = CONFIG.VEC_DEFAULT_UY;
        norm = Math.hypot(vx, vy);
      }
      if (enforceMin && norm < CONFIG.VEC_MIN_LEN) {
        const s = CONFIG.VEC_MIN_LEN / norm;
        vx *= s;
        vy *= s;
        norm = CONFIG.VEC_MIN_LEN;
      } else if (norm > CONFIG.VEC_MAX_LEN) {
        const s = CONFIG.VEC_MAX_LEN / norm;
        vx *= s;
        vy *= s;
        norm = CONFIG.VEC_MAX_LEN;
      }
      return { ux: vx, uy: vy, norm };
    }

    _computeTravelVelocity(ux, uy, norm, speedMult = 1) {
      const dirX = ux / norm;
      const dirY = uy / norm;
      const baseSpd = utils.clamp(3.35 + norm * 0.35, 4.1, 5.55) * speedMult;
      const vx = dirX * baseSpd;
      // Slightly moderate extreme vertical climb so chasing/catching remains fair and responsive
      const vy = utils.clamp(dirY * baseSpd, -4.6, 3.6);
      return { vx, vy, speed: Math.hypot(vx, vy) };
    }

    launchVector(ux, uy, stickman, options = {}) {
      if (!stickman) return null;

      const { ux: cuX, uy: cuY, norm } = this._clampComponents(
        ux,
        uy,
        stickman.facing || 1,
        true
      );

      // Chasles Vector Addition (u⃗ + w⃗) if Stickman is already riding a vector
      if (stickman.ridingVector && !options.forceSeparate) {
        const host = stickman.ridingVector;
        const oldUx = host.ux;
        const oldUy = host.uy;

        let rx = oldUx + cuX;
        let ry = oldUy + cuY;
        let rNorm = Math.hypot(rx, ry);
        const maxChaslesLen = CONFIG.VEC_MAX_LEN * 1.35;
        if (rNorm < 0.8) {
          rx = cuX;
          ry = cuY;
          rNorm = norm;
        } else if (rNorm > maxChaslesLen) {
          const k = maxChaslesLen / rNorm;
          rx *= k;
          ry *= k;
          rNorm = maxChaslesLen;
        }

        const prevRiderX = host.ax + host.ux * (stickman.vectorParam || 0.5);
        const prevRiderY = host.ay + host.uy * (stickman.vectorParam || 0.5);

        this.chaslesFx = {
          ax: host.ax,
          ay: host.ay,
          u1x: oldUx,
          u1y: oldUy,
          w2x: cuX,
          w2y: cuY,
          rx,
          ry,
          timer: 1.8,
          maxTimer: 1.8,
        };

        host.ux = rx;
        host.uy = ry;
        host.norm = rNorm;
        const vel = this._computeTravelVelocity(rx, ry, rNorm, 1.08);
        host.vx = vel.vx;
        host.vy = vel.vy;
        host.maxLife = CONFIG.VEC_RIDE_LIFETIME;
        host.life = Math.min(CONFIG.VEC_RIDE_LIFETIME, Math.max(host.life + 2.8, 4.5));

        const s = utils.clamp(stickman.vectorParam || 0.45, 0.15, 0.85);
        stickman.vectorParam = s;
        host.ax = prevRiderX - host.ux * s;
        host.ay = prevRiderY - host.uy * s;

        this.lastFormulaText = `علاقة شال: (${oldUx.toFixed(1)}, ${oldUy.toFixed(1)}) + (${cuX.toFixed(1)}, ${cuY.toFixed(1)}) = (${rx.toFixed(1)}, ${ry.toFixed(1)})`;

        if (this.particles) {
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2;
            const spd = 1.8 + Math.random() * 2.2;
            this.particles.spawnSpark(
              prevRiderX,
              prevRiderY,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              '#34d399',
              0.04,
              0.42
            );
          }
        }
        return { kind: 'chasles', vector: host };
      }

      if (this.vectors.length >= 5) {
        const idxRemove = this.vectors.findIndex((v) => !v.beingRidden);
        if (idxRemove >= 0) this.vectors.splice(idxRemove, 1);
      }

      const dirX = cuX / norm;
      const dirY = cuY / norm;
      const tailX = options.originX !== undefined ? options.originX : stickman.x + dirX * 0.45;
      const tailY =
        options.originY !== undefined
          ? options.originY
          : Math.max(0.28, stickman.y + 0.34 + (cuY < 0 ? 0.55 : 0));

      const vel = this._computeTravelVelocity(cuX, cuY, norm, options.speedMult || 1);
      const vecObj = {
        id: nextVectorId++,
        ax: tailX,
        ay: tailY,
        originX: tailX,
        originY: tailY,
        ux: cuX,
        uy: cuY,
        norm,
        vx: vel.vx,
        vy: vel.vy,
        life: CONFIG.VEC_LIFETIME,
        maxLife: CONFIG.VEC_LIFETIME,
        mountGraceTimer: options.immediateMountGrace ?? 0.16,
        dismountCooldown: 0,
        beingRidden: false,
        combative: options.combative !== false,
        hitEnemyIds: new Set(),
      };

      this.vectors.push(vecObj);
      this.lastFormulaText = `u⃗ = (${cuX.toFixed(1)}, ${cuY.toFixed(1)}) · ‖u⃗‖ = ${norm.toFixed(2)}`;

      if (this.particles) {
        for (let i = 0; i < 8; i++) {
          const spread = (Math.random() - 0.5) * 0.7;
          const baseAng = Math.atan2(cuY, cuX) + spread;
          const spd = 1.5 + Math.random() * 2.4;
          this.particles.spawnSpark(
            tailX + cuX * 0.25,
            tailY + cuY * 0.25,
            Math.cos(baseAng) * spd,
            Math.sin(baseAng) * spd,
            '#f59e0b',
            0.036,
            0.34
          );
        }
      }

      return { kind: 'launch', vector: vecObj };
    }

    findMountableVector(stickman) {
      if (!stickman || this.vectors.length === 0) return null;

      let best = null;
      let bestDist = Infinity;

      for (let i = 0; i < this.vectors.length; i++) {
        const v = this.vectors[i];
        if (v.mountGraceTimer > 0 || v.dismountCooldown > 0) continue;

        const bx = v.ax + v.ux;
        const by = v.ay + v.uy;
        const seg = distToSegment(stickman.x, stickman.y, v.ax, v.ay, bx, by);
        const bodySeg = distToSegment(stickman.x, stickman.y + 0.55, v.ax, v.ay, bx, by);

        const activeSeg = seg.dist <= bodySeg.dist ? seg : bodySeg;
        if (activeSeg.dist > CONFIG.VEC_BOARD_RADIUS) continue;

        const isSprintCatch = Math.abs(stickman.vx) >= 4.0 && stickman.grounded;
        const isAirCatch = !stickman.grounded && stickman.vy <= v.vy + 3.4;
        if (!isSprintCatch && !isAirCatch) continue;

        if (activeSeg.dist < bestDist) {
          bestDist = activeSeg.dist;
          best = { vector: v, s: activeSeg.s, qx: activeSeg.qx, qy: activeSeg.qy };
        }
      }
      return best;
    }

    onMount(vector) {
      if (!vector) return;
      vector.beingRidden = true;
      vector.maxLife = CONFIG.VEC_RIDE_LIFETIME;
      vector.life = Math.max(vector.life, Math.min(CONFIG.VEC_RIDE_LIFETIME, vector.life + 2.2));
      if (this.particles) {
        const px = vector.ax + vector.ux * 0.5;
        const py = vector.ay + vector.uy * 0.5;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.particles.spawnSpark(px, py, Math.cos(a) * 1.8, Math.sin(a) * 1.8, '#34d399', 0.036, 0.3);
        }
      }
    }

    onDismount(vector) {
      if (!vector) return;
      vector.beingRidden = false;
      vector.dismountCooldown = 0.34;
    }

    update(dt, stickman) {
      if (this.chaslesFx) {
        this.chaslesFx.timer -= dt;
        if (this.chaslesFx.timer <= 0) {
          this.chaslesFx = null;
        }
      }

      for (let i = this.vectors.length - 1; i >= 0; i--) {
        const v = this.vectors[i];
        v.life -= dt;
        v.mountGraceTimer = Math.max(0, v.mountGraceTimer - dt);
        v.dismountCooldown = Math.max(0, v.dismountCooldown - dt);

        if (v.life <= 0) {
          if (stickman && stickman.ridingVector === v) {
            stickman.dismountVector(false);
          }
          this.vectors.splice(i, 1);
          continue;
        }

        // Gradually slow down slightly when close to end of flight unless currently ridden
        const lifeRatio = v.life / v.maxLife;
        const speedEase = !v.beingRidden && lifeRatio < 0.28 ? utils.clamp(lifeRatio / 0.28, 0.35, 1) : 1;

        v.ax += v.vx * speedEase * dt;
        v.ay += v.vy * speedEase * dt;

        // Keep vector shaft safely above abyss
        if (v.ay < -8.5 && v.vy < 0) {
          v.vy = Math.abs(v.vy) * 0.5;
        }
      }
    }

    _drawArrowHead(ctx, x, y, angle, size, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size * 0.44);
      ctx.lineTo(-size * 0.72, 0);
      ctx.lineTo(-size, size * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    render(ctx, camera, gridRenderer, theme, options = {}) {
      if (!this.hasAny()) return;

      const showProj = options.showProjections !== false;

      // 1. Live aim preview while dragging / hovering
      if (this.preview) {
        const p = this.preview;
        const spA = gridRenderer.worldToScreen(p.ax, p.ay, camera);
        const spB = gridRenderer.worldToScreen(p.ax + p.ux, p.ay + p.uy, camera);
        const spX = gridRenderer.worldToScreen(p.ax + p.ux, p.ay, camera);
        const ang = Math.atan2(spB.y - spA.y, spB.x - spA.x);

        ctx.save();
        ctx.direction = 'ltr';
        if (showProj) {
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = theme.vecI;
          ctx.beginPath();
          ctx.moveTo(spA.x, spA.y);
          ctx.lineTo(spX.x, spX.y);
          ctx.stroke();

          ctx.strokeStyle = theme.vecJ;
          ctx.beginPath();
          ctx.moveTo(spX.x, spX.y);
          ctx.lineTo(spB.x, spB.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = theme.vecLaunched;
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.moveTo(spA.x, spA.y);
        ctx.lineTo(spB.x, spB.y);
        ctx.stroke();
        ctx.setLineDash([]);
        this._drawArrowHead(ctx, spB.x, spB.y, ang, 11, theme.vecLaunched);

        const label = `u⃗ = (${p.ux.toFixed(1)}, ${p.uy.toFixed(1)}) · ‖u⃗‖ = ${p.norm.toFixed(2)} · θ = ${p.angleDeg.toFixed(0)}°`;
        ctx.font = "600 11.5px 'Cascadia Mono', 'Consolas', monospace";
        const tw = ctx.measureText(label).width;
        const lx = utils.clamp(spB.x, tw * 0.5 + 10, gridRenderer.width - tw * 0.5 - 10);
        const ly = utils.clamp(spB.y - 26, 20, gridRenderer.height - 20);
        ctx.fillStyle = theme.coordTagBg;
        ctx.strokeStyle = theme.vecLaunched;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(lx - tw * 0.5 - 7, ly - 10, tw + 14, 20, 6);
        else ctx.rect(lx - tw * 0.5 - 7, ly - 10, tw + 14, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = theme.vecLaunched;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
        ctx.restore();
      }

      // 2. Chasles geometric triangle overlay (u⃗ + w⃗ = R⃗)
      if (this.chaslesFx) {
        const fx = this.chaslesFx;
        const alpha = utils.clamp(fx.timer / fx.maxTimer, 0, 1);
        const p0 = gridRenderer.worldToScreen(fx.ax, fx.ay, camera);
        const p1 = gridRenderer.worldToScreen(fx.ax + fx.u1x, fx.ay + fx.u1y, camera);
        const p2 = gridRenderer.worldToScreen(fx.ax + fx.u1x + fx.w2x, fx.ay + fx.u1y + fx.w2y, camera);

        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = theme.vecLaunched;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

        ctx.strokeStyle = theme.vecJ;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "700 11px 'Cascadia Mono', 'Consolas', monospace";
        ctx.fillStyle = theme.vecResultant;
        ctx.textAlign = 'center';
        ctx.fillText('Chasles: u⃗ + w⃗ = R⃗', (p0.x + p2.x) * 0.5, Math.min(p0.y, p1.y, p2.y) - 12);
        ctx.restore();
      }

      // 3. Active launched vectors
      for (let i = 0; i < this.vectors.length; i++) {
        const v = this.vectors[i];
        const lifeAlpha = utils.clamp(v.life / 0.85, 0.18, 1);
        const spA = gridRenderer.worldToScreen(v.ax, v.ay, camera);
        const spB = gridRenderer.worldToScreen(v.ax + v.ux, v.ay + v.uy, camera);
        const spO = gridRenderer.worldToScreen(v.originX, v.originY, camera);
        const screenAng = Math.atan2(spB.y - spA.y, spB.x - spA.x);
        const mainColor = v.beingRidden ? theme.vecResultant : theme.vecLaunched;

        ctx.save();
        ctx.direction = 'ltr';
        ctx.globalAlpha = lifeAlpha;

        // Trajectory carrier line from launch point
        ctx.strokeStyle = v.beingRidden ? 'rgba(52, 211, 153, 0.25)' : 'rgba(245, 158, 11, 0.22)';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(spO.x, spO.y);
        ctx.lineTo(spA.x, spA.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Orthogonal components (ux i⃗, uy j⃗)
        if (showProj) {
          const spC = gridRenderer.worldToScreen(v.ax + v.ux, v.ay, camera);
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = theme.vecI;
          ctx.beginPath();
          ctx.moveTo(spA.x, spA.y);
          ctx.lineTo(spC.x, spC.y);
          ctx.stroke();

          ctx.strokeStyle = theme.vecJ;
          ctx.beginPath();
          ctx.moveTo(spC.x, spC.y);
          ctx.lineTo(spB.x, spB.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Glow under shaft
        ctx.strokeStyle = mainColor;
        ctx.globalAlpha = lifeAlpha * 0.26;
        ctx.lineWidth = v.beingRidden ? 11 : 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(spA.x, spA.y);
        ctx.lineTo(spB.x - Math.cos(screenAng) * 5, spB.y - Math.sin(screenAng) * 5);
        ctx.stroke();

        // Main vector shaft + tail anchor circle + arrowhead
        ctx.globalAlpha = lifeAlpha;
        ctx.lineWidth = v.beingRidden ? 4.4 : 3.6;
        ctx.beginPath();
        ctx.moveTo(spA.x, spA.y);
        ctx.lineTo(spB.x - Math.cos(screenAng) * 4, spB.y - Math.sin(screenAng) * 4);
        ctx.stroke();

        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(spA.x, spA.y, 4, 0, Math.PI * 2);
        ctx.fill();

        this._drawArrowHead(ctx, spB.x, spB.y, screenAng, v.beingRidden ? 13 : 11, mainColor);

        // Component badge
        const midX = (spA.x + spB.x) * 0.5;
        const midY = (spA.y + spB.y) * 0.5;
        const tag = v.beingRidden
          ? `u⃗(${v.ux.toFixed(1)}, ${v.uy.toFixed(1)}) · V=(${v.vx.toFixed(1)}, ${v.vy.toFixed(1)})`
          : `u⃗(${v.ux.toFixed(1)}, ${v.uy.toFixed(1)}) · ‖${v.norm.toFixed(1)}‖`;
        ctx.font = "600 10.5px 'Cascadia Mono', 'Consolas', monospace";
        ctx.fillStyle = mainColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(tag, midX, midY - 10);

        ctx.restore();
      }
    }
  }

  MathStickGame.VectorSystem = VectorSystem;
})(window);
