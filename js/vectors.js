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

    _computeTravelVelocity(ux, uy, norm, speedMult = 1, beingRidden = false) {
      const dirX = ux / norm;
      const dirY = uy / norm;
      const baseSpd = utils.clamp(3.35 + norm * 0.35, 4.1, 5.55) * speedMult;
      const vx = dirX * baseSpd;
      if (beingRidden) {
        return { vx, vy: dirY * baseSpd, speed: baseSpd };
      }
      // Prior to boarding, thrown spear keeps true direction angle (ux, uy)
      // while translating along a fair catchable glide trajectory for sprinting/leaping
      const verticalGlide = Math.abs(dirY) > 0.72 ? 0.45 : 0.24;
      const vy = utils.clamp(dirY * baseSpd * verticalGlide, -2.8, 1.9);
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
        host.theta = Math.atan2(ry, rx);
        host.speedMult = Math.max(host.speedMult || 1.0, 1.15);
        const vel = this._computeTravelVelocity(rx, ry, rNorm, host.speedMult, true);
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
          for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const spd = 1.9 + Math.random() * 2.4;
            this.particles.spawnSpark(
              prevRiderX,
              prevRiderY,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              '#34d399',
              0.042,
              0.44
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
      const tailX = options.originX !== undefined ? options.originX : stickman.x + dirX * 0.48;
      const tailY =
        options.originY !== undefined
          ? options.originY
          : Math.max(0.28, stickman.y + 0.48 + (cuY < 0 ? 0.48 : 0));

      const speedMult = options.speedMult || 1.0;
      const vel = this._computeTravelVelocity(cuX, cuY, norm, speedMult, false);
      // Inherit partial thrower forward momentum when throwing on the run
      const forwardBias =
        stickman.vx && Math.sign(stickman.vx) === Math.sign(cuX)
          ? utils.clamp(stickman.vx * 0.25, -2.1, 2.1)
          : 0;

      const vecObj = {
        id: nextVectorId++,
        ax: tailX,
        ay: tailY,
        originX: tailX,
        originY: tailY,
        ux: cuX,
        uy: cuY,
        norm,
        theta: Math.atan2(cuY, cuX),
        speedMult,
        vx: vel.vx + forwardBias,
        vy: vel.vy,
        life: CONFIG.VEC_LIFETIME,
        maxLife: CONFIG.VEC_LIFETIME,
        mountGraceTimer: options.immediateMountGrace ?? 0.14,
        dismountCooldown: 0,
        beingRidden: false,
        combative: options.combative !== false,
        hitEnemyIds: new Set(),
      };

      this.vectors.push(vecObj);
      this.lastFormulaText = `u⃗ = (${cuX.toFixed(1)}, ${cuY.toFixed(1)}) · ‖u⃗‖ = ${norm.toFixed(2)}`;

      if (this.particles) {
        const baseAng = Math.atan2(cuY, cuX);
        for (let i = 0; i < 10; i++) {
          const spread = (Math.random() - 0.5) * 0.55;
          const a = baseAng + spread;
          const spd = 2.0 + Math.random() * 2.8;
          this.particles.spawnSpark(
            tailX + cuX * 0.3,
            tailY + cuY * 0.3,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            i % 2 === 0 ? '#f59e0b' : '#fde047',
            0.036,
            0.34
          );
        }
      }

      return { kind: 'launch', vector: vecObj };
    }

    steerAndThrottle(vector, steerY, moveX, sprint, dt) {
      if (!vector) return;
      if (!Number.isFinite(vector.theta)) {
        vector.theta = Math.atan2(vector.uy, vector.ux);
      }
      if (!Number.isFinite(vector.speedMult)) {
        vector.speedMult = 1.0;
      }

      const norm = Math.max(CONFIG.VEC_MIN_LEN, vector.norm || Math.hypot(vector.ux, vector.uy));
      const hasSteerInput = Math.abs(steerY) > 0.08 || Math.abs(moveX) > 0.08;

      if (hasSteerInput) {
        // Compute desired direction smoothly in 2D:
        // If only W/S is pressed, curve vertically relative to current horizontal side.
        // If A/D or both are pressed, steer fluidly toward the full 2D stick/key vector.
        const currCos = Math.cos(vector.theta);
        const dirSignX = Math.abs(currCos) >= 0.12 ? Math.sign(currCos) : 1;
        const targetX = Math.abs(moveX) > 0.08 ? moveX : dirSignX * 0.45;
        const targetY = steerY;
        const targetAngle = Math.atan2(targetY, targetX);

        let diff = targetAngle - vector.theta;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const steerRate = (sprint ? 1.2 : 1.0) * CONFIG.VEC_STEER_SPEED;
        const maxStep = steerRate * dt;
        if (Math.abs(diff) <= maxStep) {
          vector.theta = targetAngle;
        } else {
          vector.theta += Math.sign(diff) * maxStep;
        }

        vector.ux = Math.cos(vector.theta) * norm;
        vector.uy = Math.sin(vector.theta) * norm;
      }

      // Smooth speed multiplier control:
      // Sprint holds peak overdrive (2.35x); active directional flying cruises fast (1.45x);
      // tight sharp turns ease throttle momentarily, neutral gently settles toward 1.05x.
      let targetMult = 1.05;
      if (sprint) {
        targetMult = CONFIG.VEC_THRUST_MAX;
      } else if (Math.abs(moveX) > 0.1 || Math.abs(steerY) > 0.1) {
        const alignDot =
          moveX * Math.cos(vector.theta) + steerY * Math.sin(vector.theta);
        targetMult = alignDot < -0.35 ? CONFIG.VEC_THRUST_MIN : 1.5;
      }

      const accelRate = sprint ? CONFIG.VEC_THRUST_ACCEL : CONFIG.VEC_THRUST_ACCEL * 0.72;
      vector.speedMult = utils.moveToward(
        utils.clamp(vector.speedMult, CONFIG.VEC_THRUST_MIN, CONFIG.VEC_THRUST_MAX),
        targetMult,
        accelRate * dt
      );

      const vel = this._computeTravelVelocity(
        vector.ux,
        vector.uy,
        norm,
        vector.speedMult,
        true
      );
      vector.vx = vel.vx;
      vector.vy = vel.vy;

      // Refresh lifetime gently while actively flying on the vector
      vector.life = Math.min(CONFIG.VEC_RIDE_LIFETIME, Math.max(vector.life, 4.0));

      const deg = (vector.theta * 180) / Math.PI;
      this.lastFormulaText = `u⃗ = (${vector.ux.toFixed(1)}, ${vector.uy.toFixed(1)}) · θ = ${deg.toFixed(0)}° · ×${vector.speedMult.toFixed(1)}`;

      if (this.particles && vector.speedMult > 1.25 && Math.random() < dt * vector.speedMult * 14) {
        const tailAng = vector.theta + Math.PI + (Math.random() - 0.5) * 0.45;
        const pSpd = 1.5 + vector.speedMult * 1.4;
        this.particles.spawnSpark(
          vector.ax + vector.ux * 0.18,
          vector.ay + vector.uy * 0.18,
          Math.cos(tailAng) * pSpd,
          Math.sin(tailAng) * pSpd,
          vector.speedMult > 1.85 ? '#38bdf8' : '#34d399',
          0.032,
          0.24
        );
      }
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
        const chestSeg = distToSegment(stickman.x, stickman.y + 1.05, v.ax, v.ay, bx, by);
        const reachSeg = distToSegment(stickman.x, stickman.y + 1.5, v.ax, v.ay, bx, by);

        let activeSeg = seg;
        if (bodySeg.dist < activeSeg.dist) activeSeg = bodySeg;
        if (chestSeg.dist < activeSeg.dist) activeSeg = chestSeg;
        if (reachSeg.dist < activeSeg.dist) activeSeg = reachSeg;
        if (activeSeg.dist > CONFIG.VEC_BOARD_RADIUS) continue;

        const isSprintCatch = Math.abs(stickman.vx) >= 3.2 && stickman.grounded;
        const isAirCatch = !stickman.grounded && stickman.vy <= v.vy + 4.8;
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
      vector.life = Math.max(vector.life, Math.min(CONFIG.VEC_RIDE_LIFETIME, vector.life + 2.5));
      const norm = Math.max(CONFIG.VEC_MIN_LEN, vector.norm || Math.hypot(vector.ux, vector.uy));
      const fullVel = this._computeTravelVelocity(
        vector.ux,
        vector.uy,
        norm,
        vector.speedMult || 1.0,
        true
      );
      vector.vx = fullVel.vx;
      vector.vy = fullVel.vy;
      if (this.particles) {
        const px = vector.ax + vector.ux * 0.5;
        const py = vector.ay + vector.uy * 0.5;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.particles.spawnSpark(px, py, Math.cos(a) * 2.0, Math.sin(a) * 2.0, '#34d399', 0.038, 0.32);
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
        v.life -= v.beingRidden ? dt * 0.32 : dt;
        v.mountGraceTimer = Math.max(0, v.mountGraceTimer - dt);
        v.dismountCooldown = Math.max(0, v.dismountCooldown - dt);

        if (v.life <= 0) {
          if (stickman && stickman.ridingVector === v) {
            stickman.dismountVector(false);
          }
          this.vectors.splice(i, 1);
          continue;
        }

        // Thrown spear launches fast from hand, then settles into a catchable glide
        const lifeRatio = v.life / v.maxLife;
        const age = Math.max(0, v.maxLife - v.life);
        let speedEase = 1;
        if (!v.beingRidden) {
          const postBurstDrag = age > 0.32 ? utils.clamp(1 - (age - 0.32) * 0.42, 0.52, 1) : 1;
          const tailEase = lifeRatio < 0.28 ? utils.clamp(lifeRatio / 0.28, 0.35, 1) : 1;
          speedEase = Math.min(postBurstDrag, tailEase);
        }

        v.ax += v.vx * speedEase * dt;
        v.ay += v.vy * speedEase * dt;

        // Keep ridden vectors gently skimming above y = 0 axis when diving from Q1/Q2 (preserve deep Q3/Q4 flight)
        if (v.beingRidden && stickman && stickman.ridingVector === v) {
          const riderY = v.ay + v.uy * (stickman.vectorParam || 0.5);
          if (riderY >= -0.35 && riderY < 0.14 && v.vy < 0) {
            v.ay += 0.14 - riderY;
            v.vy = 0;
          }
        } else if (v.ay < -8.5 && v.vy < 0) {
          // Keep unmounted vectors safely above abyss
          v.vy = Math.abs(v.vy) * 0.5;
        }
      }
    }

    _drawArrowHead(ctx, x, y, angle, size, color, withCore = true) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(size * 0.35, 0);
      ctx.lineTo(-size * 0.95, -size * 0.42);
      ctx.lineTo(-size * 0.58, 0);
      ctx.lineTo(-size * 0.95, size * 0.42);
      ctx.closePath();
      ctx.fill();

      if (withCore) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha *= 0.85;
        ctx.beginPath();
        ctx.moveTo(size * 0.2, 0);
        ctx.lineTo(-size * 0.52, -size * 0.16);
        ctx.lineTo(-size * 0.35, 0);
        ctx.lineTo(-size * 0.52, size * 0.16);
        ctx.closePath();
        ctx.fill();
      }
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
        this._drawArrowHead(ctx, spB.x, spB.y, ang, 12, theme.vecLaunched);

        const label = `u⃗ = (${p.ux.toFixed(1)}, ${p.uy.toFixed(1)}) · ‖u⃗‖ = ${p.norm.toFixed(2)} · θ = ${p.angleDeg.toFixed(0)}°`;
        ctx.font = "600 11.5px 'Cascadia Mono', 'Cambria Math', 'Segoe UI Symbol', 'Consolas', monospace";
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

        ctx.font = "700 11px 'Cascadia Mono', 'Cambria Math', 'Segoe UI Symbol', 'Consolas', monospace";
        ctx.fillStyle = theme.vecResultant;
        ctx.textAlign = 'center';
        ctx.fillText('Chasles: u⃗ + w⃗ = R⃗', (p0.x + p2.x) * 0.5, Math.min(p0.y, p1.y, p2.y) - 12);
        ctx.restore();
      }

      // 3. Active launched vectors & aerodynamic speed spears
      for (let i = 0; i < this.vectors.length; i++) {
        const v = this.vectors[i];
        const lifeAlpha = utils.clamp(v.life / 0.85, 0.2, 1);
        const spA = gridRenderer.worldToScreen(v.ax, v.ay, camera);
        const spB = gridRenderer.worldToScreen(v.ax + v.ux, v.ay + v.uy, camera);
        const spO = gridRenderer.worldToScreen(v.originX, v.originY, camera);
        const screenAng = Math.atan2(spB.y - spA.y, spB.x - spA.x);
        const isBoosted = v.beingRidden && (v.speedMult || 1) > 1.35;
        const mainColor = v.beingRidden
          ? (isBoosted ? '#38bdf8' : theme.vecResultant)
          : theme.vecLaunched;

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
        ctx.globalAlpha = lifeAlpha * (isBoosted ? 0.34 : 0.24);
        ctx.lineWidth = v.beingRidden ? 12 : 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(spA.x, spA.y);
        ctx.lineTo(spB.x - Math.cos(screenAng) * 5, spB.y - Math.sin(screenAng) * 5);
        ctx.stroke();

        // Main vector spear shaft + hot core highlight
        ctx.globalAlpha = lifeAlpha;
        ctx.lineWidth = v.beingRidden ? 4.8 : 3.8;
        ctx.beginPath();
        ctx.moveTo(spA.x, spA.y);
        ctx.lineTo(spB.x - Math.cos(screenAng) * 4, spB.y - Math.sin(screenAng) * 4);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = lifeAlpha * (v.beingRidden ? 0.72 : 0.48);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(spA.x, spA.y);
        ctx.lineTo(spB.x - Math.cos(screenAng) * 4, spB.y - Math.sin(screenAng) * 4);
        ctx.stroke();

        // Slipstream shock cone chevrons when riding fast
        if (isBoosted) {
          const nx = -Math.sin(screenAng);
          const ny = Math.cos(screenAng);
          const tx = Math.cos(screenAng);
          const ty = Math.sin(screenAng);
          const coneLen = 18 + (v.speedMult - 1) * 14;
          const coneSpread = 12 + (v.speedMult - 1) * 6;
          ctx.strokeStyle = mainColor;
          ctx.globalAlpha = lifeAlpha * 0.65;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(spB.x - tx * coneLen + nx * coneSpread, spB.y - ty * coneLen + ny * coneSpread);
          ctx.lineTo(spB.x + tx * 4, spB.y + ty * 4);
          ctx.lineTo(spB.x - tx * coneLen - nx * coneSpread, spB.y - ty * coneLen - ny * coneSpread);
          ctx.stroke();
        }

        // Tail fletching/anchor node
        ctx.globalAlpha = lifeAlpha;
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(spA.x, spA.y, 4.2, 0, Math.PI * 2);
        ctx.fill();

        this._drawArrowHead(ctx, spB.x, spB.y, screenAng, v.beingRidden ? 14.5 : 12, mainColor, true);

        // Component + polar angle + thrust readout
        const midX = (spA.x + spB.x) * 0.5;
        const midY = (spA.y + spB.y) * 0.5;
        const deg = ((v.theta !== undefined ? v.theta : Math.atan2(v.uy, v.ux)) * 180) / Math.PI;
        const multTxt = (v.speedMult || 1) > 1.05 || (v.speedMult || 1) < 0.95 ? ` ×${(v.speedMult || 1).toFixed(1)}` : '';
        const tag = v.beingRidden
          ? `u⃗(${v.ux.toFixed(1)}, ${v.uy.toFixed(1)}) · θ=${deg.toFixed(0)}°${multTxt}`
          : `u⃗(${v.ux.toFixed(1)}, ${v.uy.toFixed(1)}) · ‖${v.norm.toFixed(1)}‖`;
        ctx.font = "600 10.5px 'Cascadia Mono', 'Cambria Math', 'Segoe UI Symbol', 'Consolas', monospace";
        ctx.fillStyle = mainColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(tag, midX, midY - 12);

        ctx.restore();
      }
    }
  }

  MathStickGame.VectorSystem = VectorSystem;
})(window);
