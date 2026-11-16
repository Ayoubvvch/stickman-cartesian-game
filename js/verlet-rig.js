(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { utils } = MathStickGame;

  /**
   * Damped harmonic spring scalar (inspired by Celeste squash/stretch & deepnightLibs springs).
   * Numerically stable across variable dt via sub-stepping and strict finite guards.
   */
  class SpringScalar {
    constructor(initial = 0, stiffness = 240, damping = 18) {
      this.value = initial;
      this.target = initial;
      this.vel = 0;
      this.stiffness = stiffness;
      this.damping = damping;
    }

    reset(val = 0) {
      this.value = val;
      this.target = val;
      this.vel = 0;
    }

    impulse(dv) {
      if (Number.isFinite(dv)) {
        this.vel = utils.clamp(this.vel + dv, -18, 18);
      }
    }

    set(val) {
      if (Number.isFinite(val)) {
        this.value = val;
      }
    }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return this.value;
      const clampedDt = Math.min(dt, 0.04);
      const subSteps = clampedDt > 0.018 ? 2 : 1;
      const h = clampedDt / subSteps;

      for (let i = 0; i < subSteps; i++) {
        const accel = (this.target - this.value) * this.stiffness - this.vel * this.damping;
        this.vel += accel * h;
        this.value += this.vel * h;
      }
      if (!Number.isFinite(this.value) || !Number.isFinite(this.vel)) {
        this.reset(this.target);
      }
      return this.value;
    }
  }

  /**
   * Momentum-driven Verlet soft chain with distance & angular constraints
   * (adapted from MIT-licensed Verly.js & verlet-js patterns for zero-dependency Canvas 2D).
   */
  class VerletChain {
    constructor(nodeCount, segLengths, options = {}) {
      this.count = Math.max(2, nodeCount | 0);
      if (Array.isArray(segLengths)) {
        this.lengths = [];
        for (let i = 0; i < this.count - 1; i++) {
          this.lengths.push(Math.max(0.015, segLengths[Math.min(i, segLengths.length - 1)] || 0.1));
        }
      } else {
        const len = Math.max(0.015, Number(segLengths) || 0.12);
        this.lengths = new Array(this.count - 1).fill(len);
      }

      this.friction = options.friction !== undefined ? options.friction : 0.89;
      this.gravity = options.gravity !== undefined ? options.gravity : -5.5;
      this.angleStiffness = options.angleStiffness !== undefined ? options.angleStiffness : 0.14;
      this.windFactor = options.windFactor !== undefined ? options.windFactor : 1.0;
      this.maxStretchSpeed = options.maxStretchSpeed !== undefined ? options.maxStretchSpeed : 0.35;
      this.dirBiasX = options.dirBiasX !== undefined ? options.dirBiasX : -1;
      this.dirBiasY = options.dirBiasY !== undefined ? options.dirBiasY : -0.25;

      this.nodes = [];
      this.reset(0, 0, this.dirBiasX, this.dirBiasY);
    }

    get tip() {
      return this.nodes && this.nodes.length > 0 ? this.nodes[this.nodes.length - 1] : null;
    }

    get totalLength() {
      let sum = 0;
      for (let i = 0; i < this.lengths.length; i++) sum += this.lengths[i];
      return sum;
    }

    reset(anchorX, anchorY, dirX = -1, dirY = -0.25) {
      const len = Math.hypot(dirX, dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      this.nodes = [];
      let cx = Number.isFinite(anchorX) ? anchorX : 0;
      let cy = Number.isFinite(anchorY) ? anchorY : 0;
      this.nodes.push({ x: cx, y: cy, oldX: cx, oldY: cy, mass: 1 });
      for (let i = 1; i < this.count; i++) {
        const seg = this.lengths[i - 1];
        cx += nx * seg;
        cy += ny * seg;
        this.nodes.push({ x: cx, y: cy, oldX: cx, oldY: cy, mass: 1 });
      }
    }

    addImpulse(dvx, dvy, tipWeight = 1.0) {
      if (!Number.isFinite(dvx) || !Number.isFinite(dvy)) return;
      const n = this.nodes.length;
      for (let i = 1; i < n; i++) {
        const w = 0.25 + (i / Math.max(1, n - 1)) * 0.75 * tipWeight;
        this.nodes[i].oldX -= dvx * w * 0.016;
        this.nodes[i].oldY -= dvy * w * 0.016;
      }
    }

    update(dt, anchorX, anchorY, windX = 0, windY = 0, opts = {}) {
      if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return;
      if (!this.nodes || this.nodes.length !== this.count) {
        this.reset(anchorX, anchorY, this.dirBiasX, this.dirBiasY);
      }

      const root = this.nodes[0];
      if (!Number.isFinite(root.x) || !Number.isFinite(root.y) || Math.hypot(root.x - anchorX, root.y - anchorY) > 2.4) {
        this.reset(anchorX, anchorY, opts.resetDirX ?? this.dirBiasX, opts.resetDirY ?? this.dirBiasY);
      }

      const h = Math.min(Math.max(dt || 0.016, 0.001), 0.033);
      const h2 = h * h;
      const iterations = opts.iterations || 5;
      const floorY = opts.floorY !== undefined ? opts.floorY : null;
      const flutterFreq = opts.flutterFreq !== undefined ? opts.flutterFreq : 7.5;
      const flutterAmp = opts.flutterAmp !== undefined ? opts.flutterAmp : 0.8;
      const phaseTime = opts.time || 0;
      const restDirX = opts.restDirX !== undefined ? opts.restDirX : 0;
      const restDirY = opts.restDirY !== undefined ? opts.restDirY : 0;
      const restPull = opts.restPull !== undefined ? opts.restPull : 0;

      // Pin root cleanly
      this.nodes[0].x = anchorX;
      this.nodes[0].y = anchorY;
      this.nodes[0].oldX = anchorX;
      this.nodes[0].oldY = anchorY;

      const damp = Math.pow(this.friction, h * 60);
      const maxStep = this.maxStretchSpeed;

      for (let i = 1; i < this.count; i++) {
        const p = this.nodes[i];
        let vx = (p.x - p.oldX) * damp;
        let vy = (p.y - p.oldY) * damp;
        const speed = Math.hypot(vx, vy);
        if (speed > maxStep) {
          const s = maxStep / speed;
          vx *= s;
          vy *= s;
        }
        p.oldX = p.x;
        p.oldY = p.y;

        const tRatio = i / (this.count - 1);
        const wave = Math.sin(phaseTime * flutterFreq - i * 1.25) * flutterAmp * tRatio;
        const ax = windX * this.windFactor + restDirX * restPull + (opts.flutterPerpX || 0) * wave;
        const ay = this.gravity + windY * this.windFactor + restDirY * restPull + (opts.flutterPerpY || 1) * wave;

        p.x += vx + ax * h2;
        p.y += vy + ay * h2;
      }

      // Distance + optional Angle constraint relaxation (Verly.js AngleStick pattern)
      const angStiff = opts.angleStiffness !== undefined ? opts.angleStiffness : this.angleStiffness;

      for (let iter = 0; iter < iterations; iter++) {
        this.nodes[0].x = anchorX;
        this.nodes[0].y = anchorY;

        for (let i = 0; i < this.count - 1; i++) {
          const a = this.nodes[i];
          const b = this.nodes[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const rest = this.lengths[i];

          if (dist < 1e-6) {
            b.x = a.x + (opts.restDirX || -0.7) * rest;
            b.y = a.y + (opts.restDirY || -0.3) * rest;
            continue;
          }
          const diff = (dist - rest) / dist;
          if (i === 0) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            const half = diff * 0.5;
            a.x += dx * half;
            a.y += dy * half;
            b.x -= dx * half;
            b.y -= dy * half;
          }
        }

        // Gentle straightening / curvature control along consecutive 3-node joints
        if (angStiff > 0.001 && this.count >= 3) {
          for (let i = 1; i < this.count - 1; i++) {
            const a = this.nodes[i - 1];
            const b = this.nodes[i];
            const c = this.nodes[i + 1];
            const v1x = b.x - a.x;
            const v1y = b.y - a.y;
            const v2x = c.x - b.x;
            const v2y = c.y - b.y;
            const l1 = Math.hypot(v1x, v1y);
            const l2 = Math.hypot(v2x, v2y);
            if (l1 > 1e-4 && l2 > 1e-4) {
              const targetX = b.x + (v1x / l1) * l2;
              const targetY = b.y + (v1y / l1) * l2;
              const k = angStiff * 0.35;
              c.x += (targetX - c.x) * k;
              c.y += (targetY - c.y) * k;
            }
          }
        }

        if (floorY !== null) {
          for (let i = 1; i < this.count; i++) {
            if (this.nodes[i].y < floorY) {
              this.nodes[i].y = floorY;
            }
          }
        }
      }
    }
  }

  /**
   * Procedural Skeletal & Multi-Chain IK Solver:
   * - Soft-cushion analytic 2-bone limb IK
   * - Flexible 2-segment Spine + 2.5D Shoulder/Hip depth twist
   * - Closed-chain two-handed weapon coupling (inspired by closed-chain-ik-js)
   */
  const RigSolver = {
    solveTwoBone(ax, ay, tx, ty, len1, len2, bendSign, softMargin = 0.012) {
      const dx = tx - ax;
      const dy = ty - ay;
      const rawDist = Math.hypot(dx, dy);

      if (!Number.isFinite(rawDist) || rawDist < 1e-5) {
        const jx = ax + bendSign * len1 * 0.5;
        const jy = ay - len1 * 0.86;
        return { jx, jy, ex: tx, ey: ty };
      }

      const hardMax = len1 + len2 - 0.002;
      const minReach = Math.abs(len1 - len2) + 0.004;
      // Soft knee/elbow cushion avoids ugly snapping pop when reaching near full length
      let d = rawDist;
      const softStart = hardMax - softMargin;
      if (d > softStart) {
        const excess = d - softStart;
        d = softStart + softMargin * Math.tanh(excess / Math.max(1e-4, softMargin));
      }
      d = utils.clamp(d, minReach, hardMax);

      const cosAlpha = utils.clamp(
        (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d),
        -1,
        1
      );
      const alpha = Math.acos(cosAlpha);
      const baseAngle = Math.atan2(dy, dx);
      const angle1 = baseAngle + bendSign * alpha;

      const jx = ax + Math.cos(angle1) * len1;
      const jy = ay + Math.sin(angle1) * len1;

      const clampedEnd = Math.min(rawDist, hardMax);
      const inv = 1 / rawDist;
      const ex = ax + dx * inv * clampedEnd;
      const ey = ay + dy * inv * clampedEnd;

      return { jx, jy, ex, ey };
    },

    /**
     * Articulates pelvis -> waist -> chest/shoulder -> neck -> head with spinal curvature
     * and 2.5D shoulder/hip twist offsets for dynamic Alan Becker silhouettes.
     */
    solveSpine({
      hipX,
      hipY,
      torsoLen,
      neckLen,
      headRadius,
      facing = 1,
      leanAngle = 0.04,
      archBend = 0,
      twist = 0,
      headTiltFactor = 0.65,
      shoulderSpan = 0.055,
      hipSpan = 0.036,
    }) {
      const f = facing >= 0 ? 1 : -1;
      const lowerLen = torsoLen * 0.46;
      const upperLen = torsoLen * 0.54;

      const lowerAng = f * (leanAngle - archBend * 0.45);
      const upperAng = f * (leanAngle + archBend * 0.65);

      const waistX = hipX + Math.sin(lowerAng) * lowerLen;
      const waistY = hipY + Math.cos(lowerAng) * lowerLen;

      const shoulderX = waistX + Math.sin(upperAng) * upperLen;
      const shoulderY = waistY + Math.cos(upperAng) * upperLen;

      const headAngle = upperAng * headTiltFactor;
      const neckX = shoulderX + Math.sin(headAngle) * neckLen;
      const neckY = shoulderY + Math.cos(headAngle) * neckLen;
      const headX = neckX + Math.sin(headAngle) * headRadius;
      const headY = neckY + Math.cos(headAngle) * headRadius;

      // 2.5D twist shifts front/back shoulder & hip anchors cleanly along local chest axis
      const tw = utils.clamp(twist, -1, 1);
      const shShiftX = f * tw * shoulderSpan;
      const shShiftY = -Math.abs(tw) * 0.012;
      const hpShiftX = f * (-tw * 0.45) * hipSpan;

      return {
        hip: { x: hipX, y: hipY },
        waist: { x: waistX, y: waistY },
        shoulder: { x: shoulderX, y: shoulderY },
        frontShoulder: { x: shoulderX + shShiftX, y: shoulderY + shShiftY },
        backShoulder: { x: shoulderX - shShiftX * 0.9, y: shoulderY - shShiftY * 0.4 },
        frontHip: { x: hipX + hpShiftX, y: hipY },
        backHip: { x: hipX - hpShiftX * 0.9, y: hipY + 0.008 },
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        spineAngle: upperAng,
      };
    },

    /**
     * Closed-chain two-handed grip solver (inspired by closed-chain-ik-js):
     * Computes compatible front & rear hand anchors locked to the same weapon axis
     * within natural arm reach so both arms stay solidly connected to heavy blades & spears.
     */
    solveTwoHandWeapon({
      frontShoulder,
      backShoulder,
      primaryHandTarget,
      weaponAngle,
      gripSeparation = 0.14,
      upperLen,
      foreLen,
      facing = 1,
    }) {
      const f = facing >= 0 ? 1 : -1;
      const maxReach = upperLen + foreLen - 0.015;
      let tx = primaryHandTarget.x;
      let ty = primaryHandTarget.y;

      // Clamp primary hand gently toward average shoulder reach when two-hand locked
      const midShX = (frontShoulder.x + backShoulder.x) * 0.5;
      const midShY = (frontShoulder.y + backShoulder.y) * 0.5;
      const distMid = Math.hypot(tx - midShX, ty - midShY);
      if (distMid > maxReach * 0.96) {
        const s = (maxReach * 0.96) / distMid;
        tx = midShX + (tx - midShX) * s;
        ty = midShY + (ty - midShY) * s;
      }

      const arm1 = this.solveTwoBone(frontShoulder.x, frontShoulder.y, tx, ty, upperLen, foreLen, -f);
      const backTx = arm1.ex - Math.cos(weaponAngle) * gripSeparation;
      const backTy = arm1.ey - Math.sin(weaponAngle) * gripSeparation;
      const arm2 = this.solveTwoBone(backShoulder.x, backShoulder.y, backTx, backTy, upperLen, foreLen, -f);

      return { arm1, arm2 };
    },
  };

  MathStickGame.VerletRig = {
    SpringScalar,
    VerletChain,
    RigSolver,
  };
})(window);
