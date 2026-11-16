(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { CONFIG, utils } = MathStickGame;

  class Stickman {
    constructor(particles, functionPlotter = null, vectorSystem = null) {
      this.particles = particles;
      this.functionPlotter = functionPlotter;
      this.vectorSystem = vectorSystem;
      this.combat = null;
      this.characterStyle = 'gojo';
      this._glowSprites = new Map();
      this._scarfPtsX = new Float64Array(12);
      this._scarfPtsY = new Float64Array(12);
      this._honoredQuoteW = 0;
      this._weaponTrail = [];
      this._trailSampleTimer = 0;
      const VR = MathStickGame.VerletRig || {};
      this.squashSpring = VR.SpringScalar ? new VR.SpringScalar(0, 185, 13) : null;
      this.reset();
    }

    setVectorSystem(vectorSystem) {
      this.vectorSystem = vectorSystem || null;
    }

    setCombatArena(combat) {
      this.combat = combat || null;
    }

    getCharacterStyleSpec() {
      const styles = MathStickGame.CHARACTER_STYLES || {};
      return (
        styles[this.characterStyle] ||
        styles.gojo || {
          id: 'gojo',
          label: 'Infinity',
          nameAr: 'الغامض (Gojo)',
          auraStyle: 'cyan',
          accentBlack: '#38bdf8',
          accentLight: '#2563eb',
          eyeColor: '#7dd3fc',
          coatBlack: '#0b101d',
          coatLight: '#0f172a',
          scarfBlack: '#38bdf8',
          scarfLight: '#2563eb',
        }
      );
    }

    setCharacterStyle(id) {
      const styles = MathStickGame.CHARACTER_STYLES || {};
      if (styles[id]) {
        this.characterStyle = id;
        this.glFlashTimer = Math.max(this.glFlashTimer || 0, 0.24);
        if (this.squashSpring) this.squashSpring.impulse(2.4);
      }
      return this.characterStyle;
    }

    cycleCharacterStyle() {
      const styles = MathStickGame.CHARACTER_STYLES || {};
      const keys = Object.keys(styles);
      if (keys.length === 0) return this.characterStyle;
      const idx = Math.max(0, keys.indexOf(this.characterStyle));
      const nextKey = keys[(idx + 1) % keys.length];
      return this.setCharacterStyle(nextKey);
    }

    _impulseSquash(dv) {
      if (this.squashSpring && Number.isFinite(dv)) {
        this.squashSpring.impulse(dv * 1.45);
      }
    }

    _impulseCloth(dvx, dvy) {
      if (this.scarfVerlet) this.scarfVerlet.addImpulse(dvx, dvy, 1.15);
      if (this.coatLeftVerlet) this.coatLeftVerlet.addImpulse(dvx * 0.9, dvy * 0.85, 1.0);
      if (this.coatRightVerlet) this.coatRightVerlet.addImpulse(dvx * 0.9, dvy * 0.85, 1.0);
      if (this.hairVerlet) {
        this.hairVerlet.back.addImpulse(dvx * 0.75, dvy * 0.7, 0.9);
        this.hairVerlet.top.addImpulse(dvx * 0.75, dvy * 0.7, 0.9);
        this.hairVerlet.bang.addImpulse(dvx * 0.75, dvy * 0.7, 0.9);
      }
    }

    _resetScarf(nx, ny) {
      const VR = MathStickGame.VerletRig || {};
      const f = this.facing || 1;
      if (VR.VerletChain) {
        if (!this.scarfVerlet) {
          this.scarfVerlet = new VR.VerletChain(
            8,
            [0.105, 0.105, 0.1, 0.095, 0.09, 0.085, 0.08],
            { friction: 0.89, gravity: -4.2, angleStiffness: 0.18, windFactor: 1.05 }
          );
        }
        this.scarfVerlet.reset(nx, ny, -f, -0.25);
        this.scarfChain = this.scarfVerlet.nodes;

        if (!this.coatLeftVerlet) {
          this.coatLeftVerlet = new VR.VerletChain(
            4,
            [0.125, 0.125, 0.12],
            { friction: 0.86, gravity: -8.2, angleStiffness: 0.24, windFactor: 0.95 }
          );
        }
        this.coatLeftVerlet.reset(nx - f * 0.06, ny - 0.52, -f * 0.45, -1);

        if (!this.coatRightVerlet) {
          this.coatRightVerlet = new VR.VerletChain(
            4,
            [0.125, 0.125, 0.12],
            { friction: 0.86, gravity: -8.2, angleStiffness: 0.24, windFactor: 0.95 }
          );
        }
        this.coatRightVerlet.reset(nx + f * 0.06, ny - 0.52, -f * 0.25, -1);

        if (!this.hairVerlet) {
          this.hairVerlet = {
            back: new VR.VerletChain(3, [0.11, 0.1], {
              friction: 0.83,
              gravity: -1.8,
              angleStiffness: 0.42,
              windFactor: 0.85,
            }),
            top: new VR.VerletChain(3, [0.11, 0.095], {
              friction: 0.83,
              gravity: -1.5,
              angleStiffness: 0.44,
              windFactor: 0.8,
            }),
            bang: new VR.VerletChain(3, [0.09, 0.08], {
              friction: 0.84,
              gravity: -2.2,
              angleStiffness: 0.4,
              windFactor: 0.78,
            }),
          };
        }
        const hx = nx;
        const hy = ny + 0.18;
        this.hairVerlet.back.reset(hx - f * 0.1, hy + 0.06, -f, 0.35);
        this.hairVerlet.top.reset(hx, hy + 0.14, -f * 0.2, 1.0);
        this.hairVerlet.bang.reset(hx + f * 0.11, hy + 0.06, f * 0.8, -0.35);
      } else {
        this.scarfChain = [
          { x: nx, y: ny },
          { x: nx - f * 0.12, y: ny - 0.04 },
          { x: nx - f * 0.24, y: ny - 0.1 },
          { x: nx - f * 0.35, y: ny - 0.17 },
          { x: nx - f * 0.45, y: ny - 0.24 },
        ];
      }
    }

    reset() {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;

      this.grounded = true;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
      this.jumpBufferTimer = 0;
      this.jumpsRemaining = 2;

      this.crouching = false;
      this.sliding = false;

      // Climbing state
      this.climbing = false;
      this.climbPhase = 0;
      this.climbCooldown = 0;
      this.climbPushTimer = 0;
      this.airTime = 0;

      // Free fall state
      this.freeFallMode = false;
      this.freeFallDive = false;
      this.freeFallBrake = false;
      this.heavyLandTimer = 0;

      // Dance state
      this.dancing = false;
      this.danceStyle = 0;
      this.danceStyleLocked = false;
      this.danceTime = 0;
      this.danceLocalTime = 0;
      this.danceNoteTimer = 0;
      this.danceFx = null;

      // Dash & Flip
      this.dashTimer = 0;
      this.dashCooldown = 0;
      this.dashDir = 1;
      this.ghostTimer = 0;

      this.flipTimer = 0;
      this.flipDuration = 0.45;
      this.flipDir = 1;

      // Vector Spear Throw animation state
      this.glFlashTimer = 0;
      this.throwState = {
        active: false,
        timer: 0,
        duration: CONFIG.VEC_THROW_DURATION,
        windup: CONFIG.VEC_THROW_WINDUP,
        ux: CONFIG.VEC_DEFAULT_UX,
        uy: CONFIG.VEC_DEFAULT_UY,
        released: false,
        onRelease: null,
      };

      this.landSquash = 0;
      this.idleTime = 0;
      this.gaitPhase = 0;
      this.prevStepIndex = 0;
      this.airBlend = 0;
      this.crouchBlend = 0;
      this.slideBlend = 0;
      this.climbBlend = 0;
      this.freeFallBlend = 0;
      this.danceBlend = 0;
      this.surfBlend = 0;
      this.surfingCurve = false;
      this.ridingVector = null;
      this.vectorParam = 0.5;
      this.curveSlopeAngle = 0;
      this.curveSpeed = 0;
      this.dropThroughTimer = 0;
      this.groundPassThroughTimer = 0;
      this.damageFlashTimer = 0;
      this.leanAngle = 0.04;
      this.currentVisualHeight = CONFIG.HEIGHT_STANDING;
      this.lastPose = null;
      this._weaponTrail = [];
      this._trailSampleTimer = 0;
      if (this.squashSpring) this.squashSpring.reset(0);
      this._resetScarf(0, 1.48);
    }

    resetTo(x = 0, y = 0) {
      this.reset();
      this.x = x;
      this.y = y;
      this.grounded = Math.abs(y) <= 0.02;
      this._resetScarf(x, y + 1.48);
    }

    startVectorThrow(ux, uy, onRelease = null) {
      // Mid-ride throws immediately trigger Chasles vector addition
      if (this.ridingVector) {
        this.glFlashTimer = 0.22;
        const hand =
          this.lastPose && this.lastPose.frontHand
            ? this.lastPose.frontHand
            : { x: this.x + this.facing * 0.4, y: this.y + 1.05 };
        if (typeof onRelease === 'function') {
          onRelease(hand.x, hand.y);
        }
        return;
      }

      if (Math.abs(ux) > 0.15) {
        this.facing = Math.sign(ux);
      }
      if (this.dancing) {
        this.dancing = false;
        this.danceFx = null;
      }

      if (
        this.throwState.active &&
        !this.throwState.released &&
        typeof this.throwState.onRelease === 'function'
      ) {
        this.throwState.released = true;
        const oldHand =
          this.lastPose && this.lastPose.frontHand
            ? this.lastPose.frontHand
            : { x: this.x + this.facing * 0.42, y: this.y + 1.08 };
        const prevCb = this.throwState.onRelease;
        this.throwState.onRelease = null;
        prevCb(oldHand.x, oldHand.y);
      }

      this.throwState = {
        active: true,
        timer: 0,
        duration: CONFIG.VEC_THROW_DURATION,
        windup: CONFIG.VEC_THROW_WINDUP,
        ux: Number.isFinite(ux) ? ux : this.facing * CONFIG.VEC_DEFAULT_UX,
        uy: Number.isFinite(uy) ? uy : CONFIG.VEC_DEFAULT_UY,
        released: false,
        onRelease: typeof onRelease === 'function' ? onRelease : null,
      };
      this.glFlashTimer = 0.2;
    }

    mountVector(vector, s = 0.5) {
      if (!vector) return;
      this.ridingVector = vector;
      this.vectorParam = utils.clamp(s, 0.06, 0.94);
      this.surfingCurve = false;
      this.climbing = false;
      this.dancing = false;
      this.danceFx = null;
      this.sliding = false;
      this.crouching = false;
      this.freeFallMode = false;
      this.freeFallDive = false;
      this.freeFallBrake = false;
      this.grounded = true;
      this.airTime = 0;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
      this.jumpsRemaining = 2;
      this.x = vector.ax + vector.ux * this.vectorParam;
      this.y = vector.ay + vector.uy * this.vectorParam;
      this.vx = vector.vx;
      this.vy = vector.vy;
      this.curveSpeed = Math.hypot(vector.vx, vector.vy);
      if (Math.abs(vector.vx) > 0.1) this.facing = Math.sign(vector.vx);
      const slopeAng = vector.ux >= 0
        ? Math.atan2(vector.uy, Math.max(1e-4, vector.ux))
        : Math.atan2(-vector.uy, Math.max(1e-4, -vector.ux));
      this.curveSlopeAngle = utils.clamp(slopeAng, -1.05, 1.05);
      this._impulseSquash(-1.35);
      this._impulseCloth(-this.facing * 3.8, 2.2);
      if (this.vectorSystem) {
        this.vectorSystem.onMount(vector);
      }
    }

    dismountVector(keepVelocity = true) {
      if (!this.ridingVector) return;
      const v = this.ridingVector;
      if (keepVelocity) {
        this.vx = v.vx;
        this.vy = v.vy;
      }
      this.ridingVector = null;
      this.grounded = false;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
      if (this.vectorSystem) {
        this.vectorSystem.onDismount(v);
      }
    }

    isFreeFalling() {
      return (
        !this.grounded &&
        !this.climbing &&
        !this.surfingCurve &&
        !this.ridingVector &&
        this.dashTimer <= 0 &&
        (this.freeFallMode || this.vy < -7.5 || (this.y > 3.5 && this.vy < -2.0))
      );
    }

    getStateLabel() {
      if (this.dashTimer > 0) return 'Dash';
      if (this.ridingVector) {
        return (this.ridingVector.speedMult || 1) > 1.55 ? 'Vector Overdrive' : 'Vector Ride';
      }
      if (this.surfingCurve) return 'Curve Surf';
      if (this.climbing) return 'Climbing';
      if (this.flipTimer > 0) return 'Flip';
      if (this.throwState.active) return 'Vector Throw';
      if (this.isFreeFalling()) {
        if (this.freeFallDive) return 'Dive';
        if (this.freeFallBrake) return 'Air Brake';
        return 'Free Fall';
      }
      if (this.sliding) return 'Slide';
      if (this.dancing) {
        if (this.danceStyle === 0) return 'Dance 1 · Hollow Purple';
        if (this.danceStyle === 2) return 'Dance 3 · Honored One ✨';
        return 'Dance 2 · Disco';
      }
      if (!this.grounded) return this.vy >= 0 ? 'Jump' : 'Fall';
      if (this.heavyLandTimer > 0) return 'Hard Land';
      if (this.crouching) return 'Crouch';
      const speed = Math.abs(this.vx);
      if (speed > CONFIG.WALK_SPEED + 0.65) return 'Run';
      if (speed > 0.12) return 'Walk';
      return 'Idle';
    }

    update(dt, input) {
      if (input.resetPressed) {
        this.reset();
        this.particles.clear();
        return;
      }

      this.idleTime += dt;
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.climbCooldown = Math.max(0, this.climbCooldown - dt);
      this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
      this.groundPassThroughTimer = Math.max(0, this.groundPassThroughTimer - dt);
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
      this.heavyLandTimer = Math.max(0, this.heavyLandTimer - dt);
      this.landSquash = Math.max(0, this.landSquash - dt * 4.2);
      this.glFlashTimer = Math.max(0, this.glFlashTimer - dt);
      if (this.squashSpring) {
        this.squashSpring.update(dt);
      }
      if (this._weaponTrail && this._weaponTrail.length > 0) {
        for (let i = this._weaponTrail.length - 1; i >= 0; i--) {
          this._weaponTrail[i].life -= dt;
          if (this._weaponTrail[i].life <= 0) {
            this._weaponTrail.splice(i, 1);
          }
        }
      }

      if (this.throwState.active) {
        this.throwState.timer += dt;
        if (!this.throwState.released && this.throwState.timer >= this.throwState.windup) {
          this.throwState.released = true;
          this._impulseSquash(1.45);
          this._impulseCloth(-Math.sign(this.throwState.ux || this.facing) * 3.8, 2.6);
          this.lastPose = this.computePose();
          const hand =
            this.lastPose && this.lastPose.frontHand
              ? this.lastPose.frontHand
              : { x: this.x + this.facing * 0.44, y: this.y + 1.08 };
          if (typeof this.throwState.onRelease === 'function') {
            const cb = this.throwState.onRelease;
            this.throwState.onRelease = null;
            cb(hand.x, hand.y);
          }
        }
        if (this.throwState.timer >= this.throwState.duration) {
          this.throwState.active = false;
        }
      }

      if (this.flipTimer > 0) {
        this.flipTimer = Math.max(0, this.flipTimer - dt);
      }

      // Free Fall drop trigger (G key or toolbar button)
      if (input.freeFallPressed) {
        if (this.ridingVector) this.dismountVector(false);
        this.y = Math.max(CONFIG.FREE_FALL_DROP_HEIGHT, this.y + 20);
        this.vy = 0;
        this.vx *= 0.25;
        this.grounded = false;
        this.climbing = false;
        this.dancing = false;
        this.surfingCurve = false;
        this.dropThroughTimer = 0.22;
        this.sliding = false;
        this.crouching = false;
        this.dashTimer = 0;
        this.flipTimer = 0;
        this.freeFallMode = true;
        this.jumpsRemaining = 1;
        this.coyoteTimer = 0;
        this.airTime = 0.25;
        this._resetScarf(this.x, this.y + 1.48);
        this.particles.spawnJumpBurst(this.x, this.y, true);
      }

      // Dance toggle & style switching
      if (input.danceStyleIndex !== null) {
        if (this.grounded || this.dancing || this.climbing || this.surfingCurve || this.ridingVector) {
          if (this.ridingVector) this.dismountVector(false);
          this.climbing = false;
          this.surfingCurve = false;
          this.vy = 0;
          this.vx = 0;
          this.sliding = false;
          this.crouching = false;
          this.freeFallMode = false;
          this.dancing = true;
          this.danceStyle = input.danceStyleIndex;
          this.danceStyleLocked = true;
          this.danceTime = 0;
          this.danceLocalTime = 0;
          this.danceNoteTimer = 0.05;
          this.danceFx = null;
        }
      } else if (
        (input.dancePressed || (input.gamepadYPressed && (this.grounded || this.dancing))) &&
        !this.climbing &&
        !this.ridingVector &&
        this.dashTimer <= 0
      ) {
        if (this.dancing) {
          this.dancing = false;
          this.danceFx = null;
          if (this.y > 0.15) {
            this.grounded = false;
            this.vy = 0;
            this.freeFallMode = this.y > 2.0;
          }
        } else if (this.grounded) {
          this.dancing = true;
          this.surfingCurve = false;
          this.vx = 0;
          this.sliding = false;
          this.crouching = false;
          this.danceStyle = 0;
          this.danceStyleLocked = false;
          this.danceTime = 0;
          this.danceLocalTime = 0;
          this.danceNoteTimer = 0.05;
          this.danceFx = null;
        }
      }

      // Cancel dance on any movement/action input
      if (
        this.dancing &&
        (Math.abs(input.moveX) > 0.12 ||
          input.jumpPressed ||
          input.crouchHeld ||
          input.dashPressed ||
          input.flipPressed ||
          input.climbGrabPressed)
      ) {
        this.dancing = false;
        this.danceFx = null;
        if (this.y > 0.15) {
          this.grounded = false;
          this.vy = 0;
          this.freeFallMode = this.y > 2.0;
        }
      }

      // Active Launched Vector Riding Branch
      if (this.ridingVector) {
        const stillRiding = this._updateVectorRide(dt, input);
        if (stillRiding) {
          this._updateAnimationState(dt);
          this.lastPose = this.computePose();
          this._updateScarf(dt, this.lastPose);
          return;
        }
      }

      // Climbing grab detection on y-axis (x = 0)
      const nearYAxis = Math.abs(this.x) <= CONFIG.CLIMB_GRAB_RADIUS;
      if (
        !this.climbing &&
        !this.surfingCurve &&
        !this.ridingVector &&
        this.dashTimer <= 0 &&
        nearYAxis &&
        this.climbCooldown <= 0
      ) {
        const explicitGrab = input.climbGrabPressed;
        const airAutoGrab =
          !this.grounded &&
          this.y > 0.3 &&
          this.airTime > 0.16 &&
          input.climbUpHeld &&
          !input.spaceHeld;

        if (explicitGrab || airAutoGrab) {
          this.climbing = true;
          this.grounded = false;
          this.dancing = false;
          this.danceFx = null;
          this.sliding = false;
          this.crouching = false;
          this.freeFallMode = false;
          this.flipTimer = 0;
          this.vx = 0;
          this.vy = 0;
          this.climbPushTimer = 0;
          this.jumpsRemaining = 2;
        }
      }

      // Active Climbing Branch
      if (this.climbing) {
        this._updateClimbing(dt, input);
        this._updateAnimationState(dt);
        this.lastPose = this.computePose();
        this._updateScarf(dt, this.lastPose);
        return;
      }

      // Active Function Curve Surfing Branch
      if (this.surfingCurve) {
        const stillSurfing = this._updateCurveSurf(dt, input);
        if (stillSurfing) {
          this._updateAnimationState(dt);
          this.lastPose = this.computePose();
          this._updateScarf(dt, this.lastPose);
          return;
        }
      }

      // Active Dancing Branch
      if (this.dancing) {
        this.vx = utils.moveToward(this.vx, 0, CONFIG.GROUND_DECEL * dt);
        this.vy = 0;
        this.danceTime += dt;

        if (!this.danceStyleLocked) {
          // Cycle smoothly through Dance 1 (7.8s) -> Dance 2 (5.0s) -> Dance 3 (7.2s)
          const cycle = this.danceTime % 20.0;
          if (cycle < 7.8) {
            this.danceStyle = 0;
            this.danceLocalTime = cycle;
          } else if (cycle < 12.8) {
            this.danceStyle = 1;
            this.danceLocalTime = cycle - 7.8;
          } else {
            this.danceStyle = 2;
            this.danceLocalTime = cycle - 12.8;
          }
        } else {
          this.danceLocalTime = this.danceTime;
        }

        if (this.danceStyle === 2) {
          // Levitate calmly into the sky ("Throughout heaven and earth...")
          this.grounded = false;
          const targetY = 2.48 + 0.1 * Math.sin(this.danceLocalTime * 1.35);
          this.y = utils.damp(this.y, targetY, 2.2, dt);
        } else {
          this.y = utils.damp(this.y, 0, 12, dt);
          if (this.y < 0.02) {
            this.y = 0;
            this.grounded = true;
          }
        }

        this._updateDanceParticles(dt);
        this._updateAnimationState(dt);
        this.lastPose = this.computePose();
        this._updateScarf(dt, this.lastPose);
        return;
      }

      // Standard Ground / Air / Free-Fall Movement
      if (input.jumpPressed) {
        this.jumpBufferTimer = CONFIG.JUMP_BUFFER;
      }

      // Dash trigger
      if (input.dashPressed && this.dashCooldown <= 0 && this.dashTimer <= 0) {
        this.dashDir = Math.abs(input.moveX) > 0.1 ? Math.sign(input.moveX) : this.facing;
        this.facing = this.dashDir;
        this.dashTimer = CONFIG.DASH_DURATION;
        this.dashCooldown = CONFIG.DASH_COOLDOWN;
        this.sliding = false;
        this.freeFallMode = false;
        this.vx = this.dashDir * CONFIG.DASH_SPEED;
        this.vy = 0;
        this.ghostTimer = 0;
        this._impulseSquash(-1.35);
        this._impulseCloth(-this.dashDir * 8.5, 2.2);
        this.particles.spawnJumpBurst(this.x, this.y, false);
      }

      // Flip trigger (F on keyboard, or Y on controller while airborne)
      const wantFlip =
        input.flipPressed || (input.gamepadYPressed && !this.grounded);
      if (wantFlip && this.flipTimer <= 0 && this.dashTimer <= 0) {
        if (this.grounded) {
          this.vy = 6.8;
          this.grounded = false;
          this.coyoteTimer = 0;
          this.sliding = false;
          this.flipDuration = 0.5;
          this.flipTimer = 0.5;
          this.flipDir = Math.abs(input.moveX) > 0.15 ? Math.sign(input.moveX) : -this.facing;
          this._impulseSquash(2.1);
          this._impulseCloth(-this.flipDir * 4.5, -3.5);
          this.particles.spawnJumpBurst(this.x, this.y, true);
        } else {
          this.flipDuration = 0.42;
          this.flipTimer = 0.42;
          this.flipDir = this.facing;
          this._impulseSquash(1.5);
        }
      }

      // Crouch & Slide logic
      if (this.grounded && input.crouchHeld && this.dashTimer <= 0) {
        if (!this.sliding && Math.abs(this.vx) >= CONFIG.SLIDE_MIN_SPEED) {
          this.sliding = true;
          this.vx *= CONFIG.SLIDE_BOOST;
          this._impulseSquash(-1.5);
          this._impulseCloth(-this.facing * 5.0, 2.4);
          this.particles.spawnLandingBurst(this.x, 0.75);
        }
        this.crouching = !this.sliding;
      } else {
        this.crouching = false;
        if (!input.crouchHeld || !this.grounded) {
          this.sliding = false;
        }
      }

      // Horizontal velocity update
      if (this.dashTimer > 0) {
        this.dashTimer = Math.max(0, this.dashTimer - dt);
        this.vx = this.dashDir * CONFIG.DASH_SPEED;
        this.vy = 0;

        this.ghostTimer -= dt;
        if (this.ghostTimer <= 0 && this.lastPose) {
          const spec = this.getCharacterStyleSpec();
          this.particles.addGhost(this.lastPose, spec.accentBlack || null, 0.22);
          this.ghostTimer = 0.028;
        }
      } else if (this.sliding) {
        this.vx = utils.moveToward(this.vx, 0, CONFIG.SLIDE_DECEL * dt);
        if (Math.random() < dt * 28) {
          this.particles.spawnStepDust(this.x, this.facing);
        }
        if (Math.abs(this.vx) < 1.35) {
          this.sliding = false;
          this.crouching = input.crouchHeld;
        }
      } else if (Math.abs(input.moveX) > 0.01) {
        this.facing = Math.sign(input.moveX);
        const targetSpeed = this._computeTargetSpeed(input);
        const targetVx = this.facing * targetSpeed;

        const reversing = this.vx !== 0 && Math.sign(targetVx) !== Math.sign(this.vx);
        let accel;
        if (this.grounded) {
          accel = reversing ? CONFIG.TURN_DECEL : CONFIG.GROUND_ACCEL;
        } else {
          accel = reversing ? CONFIG.AIR_ACCEL * 1.4 : CONFIG.AIR_ACCEL;
        }
        this.vx = utils.moveToward(this.vx, targetVx, accel * dt);
      } else {
        const decel = this.grounded ? CONFIG.GROUND_DECEL : CONFIG.AIR_DECEL;
        this.vx = utils.moveToward(this.vx, 0, decel * dt);
      }

      // Jump, X-axis Drop-Through & Double Jump
      if (this.jumpBufferTimer > 0 && this.dashTimer <= 0) {
        const belowCurve =
          this.grounded &&
          Math.abs(this.y) <= 0.02 &&
          (input.crouchHeld || input.climbDownHeld) &&
          this.functionPlotter &&
          this.functionPlotter.isActive()
            ? this.functionPlotter.sample(this.x)
            : null;
        if (
          belowCurve &&
          belowCurve.valid &&
          belowCurve.y < -0.02 &&
          Math.abs(belowCurve.dy) <= CONFIG.SURF_MAX_SLOPE
        ) {
          this.groundPassThroughTimer = 0.26;
          this.grounded = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          this.sliding = false;
          this.crouching = false;
          this.freeFallMode = false;
          this.vy = -2.2;
          this.jumpsRemaining = 1;
        } else if (this.coyoteTimer > 0) {
          this.vy = CONFIG.JUMP_VEL;
          this.grounded = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          this.sliding = false;
          this.crouching = false;
          this.freeFallMode = false;
          this.jumpsRemaining = 1;
          this._impulseSquash(2.55);
          this._impulseCloth(0, -4.5);
          this.particles.spawnJumpBurst(this.x, this.y, false);
        } else if (this.jumpsRemaining > 0) {
          this.vy = CONFIG.DOUBLE_JUMP_VEL;
          this.jumpsRemaining -= 1;
          this.jumpBufferTimer = 0;
          this.sliding = false;
          this.freeFallMode = false;
          this.flipDuration = 0.4;
          this.flipTimer = 0.4;
          this.flipDir = this.facing;
          this._impulseSquash(2.4);
          this._impulseCloth(-this.facing * 3.5, -4.0);
          this.particles.spawnJumpBurst(this.x, this.y, true);
        }
      }

      // Variable jump height cut
      if (input.jumpReleased && this.vy > 0 && this.dashTimer <= 0) {
        this.vy *= CONFIG.JUMP_CUT_MULT;
      }

      // Gravity & Free Fall Physics
      const currentlyFreeFalling = this.isFreeFalling();
      this.freeFallDive = currentlyFreeFalling && (input.crouchHeld || input.climbDownHeld);
      this.freeFallBrake = currentlyFreeFalling && !this.freeFallDive && input.climbUpHeld;

      if (this.dashTimer <= 0) {
        if (currentlyFreeFalling) {
          const g = this.freeFallDive
            ? CONFIG.FREE_FALL_DIVE_GRAVITY
            : CONFIG.FREE_FALL_GRAVITY;
          this.vy -= g * dt;

          let term = CONFIG.TERMINAL_VEL_NORMAL;
          if (this.freeFallDive) term = CONFIG.TERMINAL_VEL_DIVE;
          else if (this.freeFallBrake) term = CONFIG.TERMINAL_VEL_BRAKE;

          if (this.vy < -term) {
            this.vy = utils.damp(this.vy, -term, 8, dt);
          }

          if (Math.abs(this.vy) > 6.5 && Math.random() < dt * Math.abs(this.vy) * 1.4) {
            this.particles.spawnWindStreak(this.x, this.y + 0.9, Math.abs(this.vy));
          }
        } else {
          const g = this.vy > 0 && input.jumpHeld ? CONFIG.GRAVITY_UP : CONFIG.GRAVITY_DOWN;
          this.vy -= g * dt;
        }
      }

      // Integrate position
      const prevX = this.x;
      const prevY = this.y;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Catch & board a launched mathematical vector if chasing/landing onto its shaft
      if (
        this.vectorSystem &&
        !this.ridingVector &&
        this.dropThroughTimer <= 0 &&
        !this.dancing &&
        this.dashTimer <= 0
      ) {
        const hitVec = this.vectorSystem.findMountableVector(this);
        if (hitVec) {
          this.mountVector(hitVec.vector, hitVec.s);
          this._updateAnimationState(dt);
          this.lastPose = this.computePose();
          this._updateScarf(dt, this.lastPose);
          return;
        }
      }

      // Landing or walking onto active math function curve y = f(x) (including y < 0)
      let snappedToCurve = false;
      const nextCurve =
        this.functionPlotter && this.functionPlotter.isActive()
          ? this.functionPlotter.sample(this.x)
          : null;
      if (
        nextCurve &&
        this.dropThroughTimer <= 0 &&
        !this.dancing &&
        this.dashTimer <= 0
      ) {
        const prevCurve = this.functionPlotter.sample(prevX);
        if (
          nextCurve.valid &&
          Math.abs(nextCurve.dy) <= CONFIG.SURF_MAX_SLOPE
        ) {
          const prevRef = (prevCurve.valid ? prevCurve.y : nextCurve.y) - 0.24;
          const airLand =
            !this.grounded &&
            this.vy <= 0.7 &&
            prevY >= prevRef &&
            this.y <= nextCurve.y + 0.14;
          const groundWalkUp =
            this.grounded &&
            Math.abs(this.vx) > 0.18 &&
            nextCurve.y >= 0.008 &&
            nextCurve.y <= 0.48 &&
            (!prevCurve.valid || prevCurve.y <= 0.28);
          const groundCrouchDip =
            this.grounded &&
            input.crouchHeld &&
            Math.abs(this.vx) > 0.18 &&
            nextCurve.y <= -0.008 &&
            nextCurve.y >= -0.48 &&
            (!prevCurve.valid || prevCurve.y >= -0.28);

          if (airLand || groundWalkUp || groundCrouchDip) {
            this._snapToCurve(nextCurve, airLand);
            snappedToCurve = true;
          }
        }
      }

      // Ground collision (x-axis at y = 0, one-way when dropping or moving below y = 0)
      if (!snappedToCurve) {
        const hitXAxis =
          this.y <= 0 &&
          this.groundPassThroughTimer <= 0 &&
          prevY >= -0.04;

        if (hitXAxis) {
          if (!this.grounded && this.vy < -2.2) {
            const intensity = utils.clamp(Math.abs(this.vy) / 14, 0.2, 2.2);
            this.landSquash = Math.min(1.0, intensity);
            this._impulseSquash(-utils.clamp(intensity * 2.1, 0.8, 3.8));
            this._impulseCloth(0, Math.abs(this.vy) * 0.55);
            if (this.vy < -11.0) {
              this.heavyLandTimer = 0.24;
            }
            this.particles.spawnLandingBurst(this.x, intensity, 0.02);
          }
          this.y = 0;
          this.vy = 0;
          this.grounded = true;
          this.freeFallMode = false;
          this.freeFallDive = false;
          this.freeFallBrake = false;
          this.airTime = 0;
          this.coyoteTimer = CONFIG.COYOTE_TIME;
          this.jumpsRemaining = 2;
        } else {
          this.grounded = false;
          this.airTime += dt;
          if (this.y > 3.5 && this.vy < -2.0) {
            this.freeFallMode = true;
          }
          // Soft recovery if falling below Quadrants III/IV with no curve underneath
          if (
            this.y < -10 &&
            (!nextCurve || !nextCurve.valid || this.y < nextCurve.y - 6)
          ) {
            this.y = 0;
            this.vy = 0;
            this.grounded = true;
            this.freeFallMode = false;
            this.freeFallDive = false;
            this.freeFallBrake = false;
            this.airTime = 0;
            this.coyoteTimer = CONFIG.COYOTE_TIME;
            this.jumpsRemaining = 2;
            this.particles.spawnLandingBurst(this.x, 0.85, 0.02);
          }
        }
      }

      this._updateAnimationState(dt);
      this.lastPose = this.computePose();
      this._updateScarf(dt, this.lastPose);
    }

    _updateClimbing(dt, input) {
      this.x = utils.damp(this.x, 0, 24, dt);
      this.vx = 0;

      const climbDir = (input.climbUpHeld ? 1 : 0) - (input.climbDownHeld ? 1 : 0);
      const climbSpeed = input.sprint ? CONFIG.CLIMB_FAST_SPEED : CONFIG.CLIMB_SPEED;
      this.vy = climbDir * climbSpeed;
      this.y += this.vy * dt;

      if (Math.abs(this.vy) > 0.05) {
        this.climbPhase += ((this.vy * dt) / CONFIG.CLIMB_STEP_LEN) * Math.PI;
      }

      // Reaching ground dismounts smoothly
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.climbing = false;
        this.climbCooldown = 0.2;
        this.coyoteTimer = CONFIG.COYOTE_TIME;
        this.jumpsRemaining = 2;
        return;
      }

      // Dash off the y-axis
      if (input.dashPressed && this.dashCooldown <= 0) {
        const dir = Math.abs(input.moveX) > 0.1 ? Math.sign(input.moveX) : this.facing;
        this.facing = dir;
        this.climbing = false;
        this.climbCooldown = 0.28;
        this.dashDir = dir;
        this.dashTimer = CONFIG.DASH_DURATION;
        this.dashCooldown = CONFIG.DASH_COOLDOWN;
        this.vx = dir * CONFIG.DASH_SPEED;
        this.vy = 0;
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return;
      }

      // Release grab directly into Free Fall (Q or B on controller)
      if (input.releaseClimbPressed) {
        this.climbing = false;
        this.climbCooldown = 0.35;
        this.vy = 0;
        if (this.y > 2.0) {
          this.freeFallMode = true;
        }
        return;
      }

      // Jump off the y-axis (Space or Controller A)
      if (input.jumpPressed && (input.spaceHeld || !input.climbUpHeld)) {
        const dir = Math.abs(input.moveX) > 0.15 ? Math.sign(input.moveX) : this.facing;
        this.facing = dir;
        this.climbing = false;
        this.climbCooldown = 0.28;
        this.vx = dir * 4.2;
        this.vy = CONFIG.JUMP_VEL * 0.92;
        this.jumpsRemaining = 1;
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return;
      }

      // Push off horizontally by holding Left/Right
      if (Math.abs(input.moveX) > 0.25) {
        this.facing = Math.sign(input.moveX);
        this.climbPushTimer += dt;
        if (this.climbPushTimer >= 0.16) {
          this.climbing = false;
          this.climbCooldown = 0.3;
          this.vx = this.facing * 2.8;
          this.vy = 0;
          if (this.y > 2.0) {
            this.freeFallMode = true;
          }
        }
      } else {
        this.climbPushTimer = 0;
      }
    }

    _computeTargetSpeed(input) {
      const m = input.analogMagnitude;
      if (this.crouching && this.grounded) {
        return CONFIG.CROUCH_SPEED * m;
      }

      if (input.isAnalogStick && !input.sprint) {
        const thresh = CONFIG.STICK_RUN_THRESHOLD;
        if (m <= thresh) {
          return CONFIG.WALK_SPEED * (m / thresh);
        }
        const t = (m - thresh) / (1 - thresh);
        return utils.lerp(CONFIG.WALK_SPEED, CONFIG.RUN_SPEED, t);
      }

      const maxBase = input.sprint ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
      return maxBase * m;
    }

    _snapToCurve(curve, isAirLanding) {
      if (isAirLanding && this.vy < -2.2) {
        const intensity = utils.clamp(Math.abs(this.vy) / 14, 0.2, 2.2);
        this.landSquash = Math.min(1.0, intensity);
        this._impulseSquash(-utils.clamp(intensity * 1.9, 0.7, 3.4));
        this._impulseCloth(0, Math.abs(this.vy) * 0.45);
        if (this.vy < -11.0) {
          this.heavyLandTimer = 0.24;
        }
        this.particles.spawnLandingBurst(this.x, intensity, curve.y);
      }

      const cosT = Math.cos(curve.angle);
      const sinT = Math.sin(curve.angle);
      this.surfingCurve = true;
      this.curveSlopeAngle = curve.angle;
      this.curveSpeed = this.vx * cosT + this.vy * sinT;
      if (Math.abs(this.curveSpeed) < 0.08) {
        this.curveSpeed = this.vx;
      }
      this.y = curve.y;
      this.vx = this.curveSpeed * cosT;
      this.vy = this.curveSpeed * sinT;
      this.grounded = true;
      this.freeFallMode = false;
      this.freeFallDive = false;
      this.freeFallBrake = false;
      this.sliding = false;
      this.airTime = 0;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
      this.jumpsRemaining = 2;
    }

    _updateCurveSurf(dt, input) {
      if (input.jumpPressed) {
        if (input.crouchHeld || input.climbDownHeld) {
          this.dropThroughTimer = 0.28;
          this.surfingCurve = false;
          this.grounded = false;
          this.vy = -1.8;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          this.jumpsRemaining = 1;
          return 'handled';
        }

        this.surfingCurve = false;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.crouching = false;
        this.vx = this.curveSpeed * Math.cos(this.curveSlopeAngle);
        this.vy = Math.max(
          CONFIG.JUMP_VEL,
          this.curveSpeed * Math.sin(this.curveSlopeAngle) + CONFIG.JUMP_VEL * 0.72
        );
        this.jumpsRemaining = 1;
        this._impulseSquash(2.2);
        this._impulseCloth(0, -4.2);
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return 'handled';
      }

      if (input.dashPressed && this.dashCooldown <= 0) {
        this.surfingCurve = false;
        this.grounded = false;
        this.dashDir = Math.abs(input.moveX) > 0.1 ? Math.sign(input.moveX) : this.facing;
        this.facing = this.dashDir;
        this.dashTimer = CONFIG.DASH_DURATION;
        this.dashCooldown = CONFIG.DASH_COOLDOWN;
        this.crouching = false;
        this.vx = this.dashDir * CONFIG.DASH_SPEED;
        this.vy = 0;
        this.ghostTimer = 0;
        this._impulseSquash(-1.35);
        this._impulseCloth(-this.dashDir * 8.5, 2.2);
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return 'handled';
      }

      const wantFlip = input.flipPressed || input.gamepadYPressed;
      if (wantFlip && this.flipTimer <= 0) {
        this.surfingCurve = false;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.crouching = false;
        this.vx = this.curveSpeed * Math.cos(this.curveSlopeAngle);
        this.vy = Math.max(6.8, this.curveSpeed * Math.sin(this.curveSlopeAngle) + 6.2);
        this.flipDuration = 0.5;
        this.flipTimer = 0.5;
        this.flipDir = Math.abs(input.moveX) > 0.15 ? Math.sign(input.moveX) : -this.facing;
        this._impulseSquash(2.1);
        this._impulseCloth(-this.flipDir * 4.5, -3.5);
        this.particles.spawnJumpBurst(this.x, this.y, true);
        return 'handled';
      }

      const sampleNow = this.functionPlotter ? this.functionPlotter.sample(this.x) : null;
      if (
        !this.functionPlotter ||
        !this.functionPlotter.isActive() ||
        !sampleNow ||
        !sampleNow.valid ||
        Math.abs(sampleNow.dy) > CONFIG.SURF_MAX_SLOPE
      ) {
        this.surfingCurve = false;
        this.grounded = false;
        return false;
      }

      const theta = sampleNow.angle;
      const carving = input.crouchHeld;

      // Gravity component along tangent + player drive
      this.curveSpeed -= CONFIG.SURF_GRAVITY * Math.sin(theta) * dt;

      if (Math.abs(input.moveX) > 0.05) {
        const dir = Math.sign(input.moveX);
        this.facing = dir;
        const maxDrive =
          (input.sprint ? CONFIG.SURF_RUN_MAX_SPEED : CONFIG.SURF_WALK_MAX_SPEED) *
          (carving ? 1.25 : 1.0);
        const driveAccel = CONFIG.SURF_DRIVE_ACCEL * (input.sprint ? 1.22 : 1.0);
        const reversing = this.curveSpeed !== 0 && Math.sign(this.curveSpeed) !== dir;
        if (reversing || Math.abs(this.curveSpeed) < maxDrive) {
          this.curveSpeed += dir * driveAccel * (reversing ? 1.35 : 1.0) * dt;
          if (!reversing && Math.abs(this.curveSpeed) > maxDrive && Math.sin(theta) * dir >= -0.05) {
            this.curveSpeed = dir * maxDrive;
          }
        }
      } else {
        const slopeMag = Math.abs(Math.sin(theta));
        const drag = carving ? 0.35 : utils.lerp(4.2, 0.75, utils.clamp(slopeMag * 2.2, 0, 1));
        this.curveSpeed = utils.moveToward(this.curveSpeed, 0, drag * dt);
      }

      this.curveSpeed = utils.clamp(
        this.curveSpeed,
        -CONFIG.SURF_MAX_SPEED,
        CONFIG.SURF_MAX_SPEED
      );

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const vxStep = this.curveSpeed * cosT;
      const nx = this.x + vxStep * dt;
      const next = this.functionPlotter.sample(nx);

      const isFlatAxisCurve =
        next.valid &&
        Math.abs(next.y) <= 1e-5 &&
        Math.abs(next.dy) < 1e-4 &&
        Math.abs(next.d2y) < 1e-4 &&
        Math.abs(this.functionPlotter.evaluateY(nx + 0.5)) < 1e-5 &&
        Math.abs(this.functionPlotter.evaluateY(nx - 0.5)) < 1e-5;
      if (isFlatAxisCurve) {
        this.x = nx;
        this.y = 0;
        this.vx = vxStep;
        this.vy = 0;
        this.surfingCurve = false;
        this.crouching = carving;
        this.grounded = true;
        return true;
      }

      if (!next.valid || Math.abs(next.dy) > CONFIG.SURF_MAX_SLOPE) {
        this.x = nx;
        this.vx = vxStep;
        this.vy = this.curveSpeed * sinT;
        this.surfingCurve = false;
        this.grounded = false;
        this.coyoteTimer = CONFIG.COYOTE_TIME;
        this.jumpsRemaining = 1;
        return false;
      }

      // Crest airtime launch when flying fast over convex peaks (f'' < 0)
      if (-next.d2y * vxStep * vxStep > CONFIG.SURF_GRAVITY * 1.24 && Math.abs(this.curveSpeed) > 7.2) {
        this.x = nx;
        this.y = next.y + 0.05;
        this.vx = vxStep;
        this.vy = Math.max(this.curveSpeed * Math.sin(next.angle), 1.6);
        this.surfingCurve = false;
        this.grounded = false;
        this.jumpsRemaining = 1;
        this._impulseSquash(1.8);
        this._impulseCloth(-this.facing * 2.5, -3.2);
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return false;
      }

      this.x = nx;
      this.y = next.y;
      this.curveSlopeAngle = next.angle;
      this.vx = this.curveSpeed * Math.cos(next.angle);
      this.vy = this.curveSpeed * Math.sin(next.angle);
      if (Math.abs(input.moveX) < 0.05 && Math.abs(this.curveSpeed) > 0.35) {
        this.facing = Math.sign(this.curveSpeed);
      }
      this.crouching = carving;
      this.grounded = true;
      this.freeFallMode = false;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
      this.jumpsRemaining = 2;

      const absSpd = Math.abs(this.curveSpeed);
      if (absSpd > 4.2 && Math.random() < dt * absSpd * 1.6) {
        this.particles.spawnSpark(
          this.x - Math.sign(this.curveSpeed) * 0.18,
          this.y + 0.03,
          -this.vx * 0.25 + (Math.random() - 0.5) * 0.8,
          0.4 + Math.random() * 0.9,
          '#38bdf8',
          0.026,
          0.26
        );
      }
      if (absSpd > 10.5 && Math.random() < dt * absSpd * 0.9) {
        this.particles.spawnWindStreak(this.x, this.y + 0.9, absSpd * 0.75);
      }

      return true;
    }

    _updateVectorRide(dt, input) {
      const v = this.ridingVector;
      if (!v) return false;

      if (input.spacePressed) {
        const walkDir = Math.abs(input.moveX) > 0.1 ? Math.sign(input.moveX) : 0;
        if (input.crouchHeld || input.climbDownHeld) {
          this.dropThroughTimer = 0.25;
          this.dismountVector(true);
          this.vy = v.vy - 2.4;
          this.jumpBufferTimer = 0;
          this.jumpsRemaining = 1;
          return 'handled';
        }
        // Vault off with Galilean vector velocity composition: V_vec + jump impulse
        this.dismountVector(false);
        this.vx = v.vx + walkDir * (input.sprint ? 3.8 : 2.2);
        this.vy = Math.max(CONFIG.JUMP_VEL, v.vy + CONFIG.JUMP_VEL * 0.72);
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.crouching = false;
        this.jumpsRemaining = 1;
        this._impulseSquash(2.1);
        this._impulseCloth(-this.facing * 2.5, -3.8);
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return 'handled';
      }

      if (input.dashPressed && this.dashCooldown <= 0) {
        const dir = Math.abs(input.moveX) > 0.1 ? Math.sign(input.moveX) : this.facing;
        this.dismountVector(false);
        this.facing = dir;
        this.dashDir = dir;
        this.dashTimer = CONFIG.DASH_DURATION;
        this.dashCooldown = CONFIG.DASH_COOLDOWN;
        this.crouching = false;
        this.vx = dir * CONFIG.DASH_SPEED;
        this.vy = 0;
        this.ghostTimer = 0;
        this._impulseSquash(-1.35);
        this._impulseCloth(-dir * 8.5, 2.2);
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return 'handled';
      }

      const wantFlip = input.flipPressed || input.gamepadYPressed;
      if (wantFlip && this.flipTimer <= 0) {
        this.dismountVector(false);
        this.vx = v.vx;
        this.vy = Math.max(6.8, v.vy + 6.2);
        this.flipDuration = 0.5;
        this.flipTimer = 0.5;
        this.flipDir = Math.abs(input.moveX) > 0.15 ? Math.sign(input.moveX) : -this.facing;
        this._impulseSquash(2.0);
        this.particles.spawnJumpBurst(this.x, this.y, true);
        return 'handled';
      }

      // Smooth 360-degree steering (W/S/A/D or Arrows) and Overdrive boost (Shift)
      const sAnchor = this.vectorParam || 0.5;
      const preX = v.ax + v.ux * sAnchor;
      const preY = v.ay + v.uy * sAnchor;
      const steerY = input.steerY || 0;
      const moveX = input.moveX || 0;
      if (this.vectorSystem && typeof this.vectorSystem.steerAndThrottle === 'function') {
        this.vectorSystem.steerAndThrottle(v, steerY, moveX, Boolean(input.sprint), dt);
      }
      // Pivot vector cleanly around the rider's hoverboard stance so steering has zero radial snap
      v.ax = preX - v.ux * sAnchor;
      v.ay = preY - v.uy * sAnchor;
      const riderAnchorY = v.ay + v.uy * sAnchor;
      if (riderAnchorY >= -0.35 && riderAnchorY < 0.14 && v.vy < 0) {
        v.ay += 0.14 - riderAnchorY;
      }

      // Shift surfer balance smoothly along shaft while banking: V_total = V_vector + V_player_rel
      let relVx = 0;
      let relVy = 0;
      const len = Math.max(0.5, v.norm || Math.hypot(v.ux, v.uy));
      if (Math.abs(moveX) > 0.05) {
        const moveSignX = Math.sign(moveX);
        this.facing = moveSignX;
        const alignSign = Math.abs(v.ux) >= 0.22 ? moveSignX * Math.sign(v.ux) : moveSignX;
        const walkSpd = CONFIG.VEC_SHAFT_WALK_SPEED * (input.sprint ? 1.45 : 0.95);
        const ds = (alignSign * walkSpd * dt) / len;
        this.vectorParam = utils.clamp(this.vectorParam + ds, 0.12, 0.88);
        relVx = (alignSign * walkSpd * v.ux * 0.45) / len;
        relVy = (alignSign * walkSpd * v.uy * 0.45) / len;
      } else {
        if (Math.abs(v.vx) > 0.25) this.facing = Math.sign(v.vx);
        this.vectorParam = utils.damp(this.vectorParam, 0.52, 2.2, dt);
      }

      this.x = v.ax + v.ux * this.vectorParam;
      this.y = v.ay + v.uy * this.vectorParam;
      this.vx = v.vx + relVx;
      this.vy = v.vy + relVy;
      const slopeAng = v.ux >= 0
        ? Math.atan2(v.uy, Math.max(1e-4, v.ux))
        : Math.atan2(-v.uy, Math.max(1e-4, -v.ux));
      this.curveSlopeAngle = utils.clamp(slopeAng, -1.05, 1.05);
      this.curveSpeed = Math.hypot(this.vx, this.vy);
      this.crouching = input.crouchHeld;
      this.grounded = true;
      this.freeFallMode = false;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
      this.jumpsRemaining = 2;

      const isOverdrive = (v.speedMult || 1) > 1.55;
      if (isOverdrive) {
        this.glFlashTimer = Math.max(this.glFlashTimer, 0.1);
        this.ghostTimer = (this.ghostTimer || 0) - dt;
        if (this.ghostTimer <= 0 && this.lastPose) {
          const spec = this.getCharacterStyleSpec();
          this.particles.addGhost(this.lastPose, spec.accentBlack || null, 0.16);
          this.ghostTimer = 0.048;
        }
        if (Math.random() < dt * 14) {
          this.particles.spawnWindStreak(this.x, this.y + 0.85, Math.hypot(this.vx, this.vy) * 0.8);
        }
      }

      if (Math.random() < dt * (isOverdrive ? 20 : 10)) {
        const spec = this.getCharacterStyleSpec();
        this.particles.spawnSpark(
          this.x - v.vx * 0.03,
          this.y + 0.02,
          -v.vx * 0.25 + (Math.random() - 0.5) * 0.8,
          0.15 + Math.random() * 0.6,
          isOverdrive ? (spec.accentBlack || '#38bdf8') : '#34d399',
          0.028,
          0.26
        );
      }

      return true;
    }

    _updateAnimationState(dt) {
      const speed = Math.abs(this.vx);
      const runBlend = utils.clamp(
        (speed - CONFIG.WALK_SPEED * 0.8) / (CONFIG.RUN_SPEED - CONFIG.WALK_SPEED * 0.8),
        0,
        1
      );

      let strideLen = utils.lerp(0.56, 1.04, runBlend);
      if (this.crouching) strideLen = 0.38;

      if (
        this.grounded &&
        !this.sliding &&
        !this.dancing &&
        !this.surfingCurve &&
        !this.ridingVector &&
        this.dashTimer <= 0 &&
        speed > 0.04
      ) {
        this.gaitPhase += ((this.vx * this.facing * dt) / strideLen) * Math.PI;
        const stepIdx = Math.floor(this.gaitPhase / Math.PI);
        if (stepIdx !== this.prevStepIndex) {
          this.prevStepIndex = stepIdx;
          if (speed > 2.4) {
            this.particles.spawnStepDust(this.x, this.facing);
          }
        }
      }

      this.airBlend = utils.damp(
        this.airBlend,
        !this.grounded && !this.climbing && !this.ridingVector ? 1 : 0,
        18,
        dt
      );
      this.crouchBlend = utils.damp(
        this.crouchBlend,
        (this.crouching || this.heavyLandTimer > 0) &&
          this.grounded &&
          !this.surfingCurve &&
          !this.ridingVector
          ? 1
          : 0,
        16,
        dt
      );
      this.slideBlend = utils.damp(this.slideBlend, this.sliding ? 1 : 0, 18, dt);
      this.climbBlend = utils.damp(this.climbBlend, this.climbing ? 1 : 0, 20, dt);
      this.freeFallBlend = utils.damp(
        this.freeFallBlend,
        this.isFreeFalling() ? 1 : 0,
        10,
        dt
      );
      this.danceBlend = utils.damp(
        this.danceBlend,
        this.dancing ? 1 : 0,
        18,
        dt
      );
      this.surfBlend = utils.damp(
        this.surfBlend,
        this.surfingCurve || this.ridingVector ? 1 : 0,
        18,
        dt
      );

      let targetLean = 0.04;
      if (this.dashTimer > 0) targetLean = 0.56;
      else if (this.surfingCurve || this.ridingVector) targetLean = 0.36;
      else if (this.climbing) targetLean = 0.14;
      else if (this.sliding) targetLean = -0.58;
      else if ((this.crouching || this.heavyLandTimer > 0) && this.grounded) targetLean = 0.42;
      else if (this.isFreeFalling()) {
        if (this.freeFallDive) targetLean = 2.62;
        else if (this.freeFallBrake) targetLean = 1.48;
        else targetLean = -0.42 + 0.16 * Math.sin(this.idleTime * 9.5);
      } else if (!this.grounded) {
        targetLean = utils.clamp(this.vx * this.facing * 0.045, -0.15, 0.34);
      } else {
        targetLean = utils.lerp(0.04, 0.35, utils.clamp(speed / CONFIG.RUN_SPEED, 0, 1));
      }
      this.leanAngle = utils.damp(this.leanAngle, targetLean, 14, dt);
    }

    _solveTwoBoneIK(ax, ay, tx, ty, len1, len2, bendSign, softMargin = 0.012) {
      const VR = MathStickGame.VerletRig;
      if (VR && VR.RigSolver) {
        return VR.RigSolver.solveTwoBone(ax, ay, tx, ty, len1, len2, bendSign, softMargin);
      }
      const dx = tx - ax;
      const dy = ty - ay;
      const rawDist = Math.hypot(dx, dy);

      if (rawDist < 1e-5) {
        const jx = ax + bendSign * len1 * 0.5;
        const jy = ay - len1 * 0.86;
        return { jx, jy, ex: tx, ey: ty };
      }

      const maxReach = len1 + len2 - 0.002;
      const minReach = Math.abs(len1 - len2) + 0.002;
      const d = utils.clamp(rawDist, minReach, maxReach);

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

      const scaleEnd = rawDist > maxReach ? maxReach / rawDist : 1;
      const ex = ax + dx * scaleEnd;
      const ey = ay + dy * scaleEnd;

      return { jx, jy, ex, ey };
    }

    _computeFootLocal(phaseOffset, strideLen, liftHeight, idleX, walkBlend) {
      const p = utils.mod(this.gaitPhase + phaseOffset, Math.PI * 2);
      let gaitX;
      let gaitY;
      let toePitch = 0;

      if (p < Math.PI) {
        // Stance phase: heel strike -> flat contact -> rear push-off ankle lift
        const t = p / Math.PI;
        gaitX = (0.5 - t) * strideLen;
        if (t < 0.25) {
          toePitch = (1 - t / 0.25) * 0.28;
          gaitY = 0;
        } else if (t > 0.7) {
          const pushT = (t - 0.7) / 0.3;
          gaitY = liftHeight * 0.16 * pushT;
          toePitch = -0.34 * pushT;
        } else {
          gaitY = 0;
        }
      } else {
        // Swing phase: lifted athletic arc forward
        const t = (p - Math.PI) / Math.PI;
        gaitX = (-0.5 + 0.5 * (1 - Math.cos(t * Math.PI))) * strideLen;
        gaitY = liftHeight * Math.sin(t * Math.PI);
        toePitch = utils.lerp(-0.26, 0.22, t);
      }

      return {
        x: utils.lerp(idleX, gaitX, walkBlend),
        y: utils.lerp(0, gaitY, walkBlend),
        toePitch: toePitch * walkBlend,
      };
    }

    _computeClimbTarget(phaseOffset, stepLen, reachOut) {
      const p = utils.mod(this.climbPhase + phaseOffset, Math.PI * 2);
      if (p < Math.PI) {
        // Gripping the y-axis cleanly without slipping
        const t = p / Math.PI;
        return { x: 0, dy: (0.5 - t) * stepLen };
      }
      // Releasing slightly outward to step/reach for next grip
      const t = (p - Math.PI) / Math.PI;
      return {
        x: -this.facing * reachOut * Math.sin(t * Math.PI),
        dy: (-0.5 + 0.5 * (1 - Math.cos(t * Math.PI))) * stepLen,
      };
    }

    _smoothstep(a, b, x) {
      const u = utils.clamp((x - a) / (b - a), 0, 1);
      return u * u * (3 - 2 * u);
    }

    _updateScarf(dt, pose) {
      if (!pose || !pose.neck) return;
      if (!this.scarfVerlet && (!this.scarfChain || this.scarfChain.length < 5)) {
        this._resetScarf(pose.neck.x, pose.neck.y);
        return;
      }

      const f = pose.facing || this.facing || 1;
      const nx = pose.neck.x;
      const ny = pose.neck.y;
      const isPurple = this.dancing && this.danceStyle === 0;
      const isHonored = this.dancing && this.danceStyle === 2;
      const groundFloor = this.grounded && this.flipTimer <= 0 && !isHonored ? this.y + 0.025 : null;

      let windX = -f * 0.9 - this.vx * 0.65;
      let windY = -this.vy * 0.35;
      if (isPurple) {
        const t = this.danceLocalTime % 7.8;
        const surge = this._smoothstep(4.8, 5.6, t) * (1 - this._smoothstep(6.7, 7.6, t));
        windX = -0.8 - surge * 2.2;
        windY = 1.4 + surge * 5.2;
      } else if (isHonored) {
        windX = -f * 0.45 + Math.sin(this.idleTime * 1.4) * 0.55;
        windY = 2.8 + Math.cos(this.idleTime * 1.1) * 0.8;
      } else if (this.dashTimer > 0) {
        windX = -this.dashDir * 8.5;
        windY = 1.2;
      } else if (this.ridingVector) {
        windX = -this.vx * 0.95 - f * 1.1;
        windY = -this.vy * 0.65 + 1.1;
      } else if (this.combat && this.combat.attackState && this.combat.attackState.active) {
        windX -= f * 2.8;
        windY += 1.4;
      }

      if (this.scarfVerlet) {
        this.scarfVerlet.update(dt, nx, ny, windX, windY, {
          iterations: 5,
          time: this.idleTime,
          flutterFreq: isPurple ? 8.5 : 6.4,
          flutterAmp: isPurple ? 2.6 : 1.05,
          flutterPerpX: 0.25,
          flutterPerpY: 1,
          floorY: groundFloor,
          restDirX: -f * 0.85,
          restDirY: -0.25,
          restPull: 0.9,
          resetDirX: -f,
          resetDirY: -0.25,
        });
        this.scarfChain = this.scarfVerlet.nodes;
      } else if (this.scarfChain) {
        const chain = this.scarfChain;
        if (Math.hypot(chain[0].x - nx, chain[0].y - ny) > 2.0) {
          this._resetScarf(nx, ny);
        }
        chain[0].x = nx;
        chain[0].y = ny;
        const segLen = 0.135;
        const flutter = this.idleTime * (this.dancing ? 5.5 : 4.2);
        for (let i = 1; i < chain.length; i++) {
          const prev = chain[i - 1];
          const curr = chain[i];
          const wave = Math.sin(flutter - i * 1.15) * (isPurple ? 0.55 : 0.26);
          curr.x += windX * dt * 0.85;
          curr.y += (windY - 0.9 + wave) * dt * 0.85;
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const dist = Math.hypot(dx, dy) || 1e-4;
          curr.x = prev.x + (dx / dist) * segLen;
          curr.y = prev.y + (dy / dist) * segLen;
        }
      }

      // Coat & Haori Twin Tail Verlet Simulation
      if (this.coatLeftVerlet && this.coatRightVerlet && pose.hip) {
        const hip = pose.hip;
        const latOff = pose.frontFacing ? 0.08 : 0.045;
        const leftAnchorX = pose.frontFacing ? hip.x - latOff : hip.x - f * latOff;
        const rightAnchorX = pose.frontFacing ? hip.x + latOff : hip.x + f * 0.015;
        const coatWindX = windX * 0.85;
        const coatWindY = isHonored ? windY + 1.8 : windY;

        this.coatLeftVerlet.update(dt, leftAnchorX, hip.y - 0.01, coatWindX - (pose.frontFacing ? 0.8 : f * 0.5), coatWindY, {
          iterations: 4,
          time: this.idleTime,
          flutterFreq: 5.8,
          flutterAmp: 0.75,
          floorY: groundFloor,
          restDirX: pose.frontFacing ? -0.35 : -f * 0.35,
          restDirY: -1,
          restPull: 3.4,
          resetDirX: -f * 0.4,
          resetDirY: -1,
        });
        this.coatRightVerlet.update(dt, rightAnchorX, hip.y - 0.01, coatWindX + (pose.frontFacing ? 0.8 : f * 0.25), coatWindY, {
          iterations: 4,
          time: this.idleTime + 0.8,
          flutterFreq: 6.1,
          flutterAmp: 0.7,
          floorY: groundFloor,
          restDirX: pose.frontFacing ? 0.35 : -f * 0.12,
          restDirY: -1,
          restPull: 3.4,
          resetDirX: -f * 0.2,
          resetDirY: -1,
        });
      }

      // Hair Verlet Locks (responsive secondary motion matching style anatomy in world coordinates)
      if (this.hairVerlet && pose.head && pose.neck) {
        let upX = pose.head.x - pose.neck.x;
        let upY = pose.head.y - pose.neck.y;
        const upL = Math.hypot(upX, upY);
        if (upL > 1e-4) {
          upX /= upL;
          upY /= upL;
        } else {
          upX = 0;
          upY = 1;
        }
        // World Y is UP, so forward vector orthogonal to head up-axis is (+upY * f, -upX * f)
        const fwdX = upY * f;
        const fwdY = -upX * f;
        const hr = pose.headRadius || CONFIG.HEAD_RADIUS;
        const hWindX = -this.vx * 0.45 + (isPurple ? -0.6 : 0);
        const hWindY = -this.vy * 0.35 + (isHonored ? 2.4 : isPurple ? 2.8 : 0);

        this.hairVerlet.back.update(
          dt,
          pose.head.x + (-fwdX * 0.56 + upX * 0.52) * hr,
          pose.head.y + (-fwdY * 0.56 + upY * 0.52) * hr,
          hWindX,
          hWindY,
          {
            iterations: 3,
            time: this.idleTime,
            flutterFreq: 7.2,
            flutterAmp: 0.4,
            restDirX: -fwdX * 0.82 + upX * 0.45,
            restDirY: -fwdY * 0.82 + upY * 0.45,
            restPull: 14,
            angleStiffness: 0.42,
            resetDirX: -fwdX,
            resetDirY: upY,
          }
        );
        this.hairVerlet.top.update(
          dt,
          pose.head.x + upX * 0.78 * hr,
          pose.head.y + upY * 0.78 * hr,
          hWindX,
          hWindY,
          {
            iterations: 3,
            time: this.idleTime + 0.4,
            flutterFreq: 7.0,
            flutterAmp: 0.35,
            restDirX: upX * 0.92 - fwdX * 0.22,
            restDirY: upY * 0.92 - fwdY * 0.22,
            restPull: 15,
            angleStiffness: 0.46,
            resetDirX: -fwdX * 0.2,
            resetDirY: 1,
          }
        );
        this.hairVerlet.bang.update(
          dt,
          pose.head.x + (fwdX * 0.62 + upX * 0.56) * hr,
          pose.head.y + (fwdY * 0.62 + upY * 0.56) * hr,
          hWindX * 0.75,
          hWindY * 0.75,
          {
            iterations: 3,
            time: this.idleTime + 1.1,
            flutterFreq: 7.5,
            flutterAmp: 0.32,
            restDirX: fwdX * 0.84 - upX * 0.42,
            restDirY: fwdY * 0.84 - upY * 0.42,
            restPull: 14,
            angleStiffness: 0.4,
            resetDirX: fwdX,
            resetDirY: -0.35,
          }
        );
      }
    }

    _applySquashStretch(pose) {
      if (!pose || !this.squashSpring) return;
      if (this.flipTimer > 0) return;
      const s = utils.clamp(this.squashSpring.value, -0.26, 0.28);
      if (Math.abs(s) < 0.004) return;

      const sy = 1 + s;
      const sx = 1 / Math.sqrt(sy);
      const ax = this.x;
      const ay = this.y;
      const keys = [
        'hip', 'waist', 'shoulder', 'frontShoulder', 'backShoulder',
        'frontHip', 'backHip', 'neck', 'head',
        'frontKnee', 'frontFoot', 'frontToe',
        'backKnee', 'backFoot', 'backToe',
        'frontElbow', 'frontHand', 'backElbow', 'backHand',
      ];
      for (const k of keys) {
        const pt = pose[k];
        if (!pt) continue;
        pt.x = ax + (pt.x - ax) * sx;
        pt.y = ay + (pt.y - ay) * sy;
      }
      pose.headStretchX = sx;
      pose.headStretchY = sy;
    }

    _applySpineDeform(pose, opts = {}) {
      if (!pose || !pose.hip) return;
      const f = pose.facing || 1;
      const VR = MathStickGame.VerletRig || {};
      const canGroundLunge =
        opts.lungeStance &&
        this.grounded &&
        !this.surfingCurve &&
        !this.ridingVector &&
        !this.sliding &&
        !this.crouching &&
        Math.abs(this.vx) < 2.6;

      if (opts.hipDrop && canGroundLunge) {
        pose.hip.y = Math.max(this.y + 0.42, pose.hip.y - opts.hipDrop);
      }

      if (VR.RigSolver && !pose.frontFacing) {
        const baseLean = opts.lean !== undefined ? opts.lean : this.leanAngle + (opts.leanDelta || 0);
        const spine = VR.RigSolver.solveSpine({
          hipX: pose.hip.x,
          hipY: pose.hip.y,
          torsoLen: CONFIG.TORSO_LEN,
          neckLen: CONFIG.NECK_LEN,
          headRadius: CONFIG.HEAD_RADIUS,
          facing: f,
          leanAngle: baseLean,
          archBend: opts.archDelta || 0,
          twist: opts.twistDelta || 0,
          shoulderSpan: 0.055,
          hipSpan: 0.036,
        });
        pose.waist = spine.waist;
        pose.shoulder = spine.shoulder;
        pose.frontShoulder = spine.frontShoulder;
        pose.backShoulder = spine.backShoulder;
        pose.frontHip = spine.frontHip;
        pose.backHip = spine.backHip;
        pose.neck = spine.neck;
        pose.head = spine.head;
        pose.spineAngle = spine.spineAngle;
      }

      if (canGroundLunge && opts.frontFootX !== undefined && opts.backFootX !== undefined) {
        const fh = pose.frontHip || pose.hip;
        const bh = pose.backHip || pose.hip;
        const leg1 = this._solveTwoBoneIK(fh.x, fh.y, this.x + f * opts.frontFootX, this.y, CONFIG.THIGH_LEN, CONFIG.SHIN_LEN, f);
        const leg2 = this._solveTwoBoneIK(bh.x, bh.y, this.x + f * opts.backFootX, this.y, CONFIG.THIGH_LEN, CONFIG.SHIN_LEN, f);
        pose.frontKnee = { x: leg1.jx, y: leg1.jy };
        pose.frontFoot = { x: leg1.ex, y: leg1.ey };
        pose.frontToe = { x: leg1.ex + f * CONFIG.FOOT_LEN, y: Math.max(this.y, leg1.ey) };
        pose.backKnee = { x: leg2.jx, y: leg2.jy };
        pose.backFoot = { x: leg2.ex, y: leg2.ey };
        pose.backToe = { x: leg2.ex + f * CONFIG.FOOT_LEN, y: Math.max(this.y, leg2.ey) };
      }
    }

    _sampleWeaponTrail(pose) {
      if (!pose || this.dancing) return;
      const combatActive = Boolean(this.combat && this.combat.active && this.combat.attackState && this.combat.attackState.active);
      const throwSwinging = Boolean(this.throwState && this.throwState.active && !this.throwState.released && this.throwState.timer >= this.throwState.windup * 0.55);
      if (!combatActive && !throwSwinging) return;

      if (!this._weaponTrail) this._weaponTrail = [];
      const curTimer = combatActive ? this.combat.attackState.timer : this.throwState.timer;
      const curKind = combatActive ? `atk_${this.combat.attackState.weaponIdx}_${this.combat.attackState.comboStep}` : 'throw';
      if (this._lastTrailKind !== curKind || (this._lastTrailTimer !== undefined && curTimer < this._lastTrailTimer - 0.01)) {
        this._trailStrokeSeq = (this._trailStrokeSeq || 0) + 1;
      }
      this._lastTrailKind = curKind;
      this._lastTrailTimer = curTimer;
      const strokeId = this._trailStrokeSeq || 1;

      if (combatActive && pose.combatWeapon && pose.frontHand && pose.weaponWorldAngle !== undefined) {
        const w = pose.combatWeapon;
        const lenMap = { diff: 0.92, integ: 1.06, negate: 0.72, vector: 1.12 };
        const tipDist = lenMap[w.id] || 0.88;
        const ang = pose.weaponWorldAngle;
        const tx = pose.frontHand.x + Math.cos(ang) * tipDist;
        const ty = pose.frontHand.y + Math.sin(ang) * tipDist;
        const bx = pose.frontHand.x + Math.cos(ang) * 0.16;
        const by = pose.frontHand.y + Math.sin(ang) * 0.16;

        this._weaponTrail.push({
          trailId: 'main',
          strokeId,
          tx, ty, bx, by,
          colorBlack: w.colorBlack,
          colorLight: w.colorLight,
          life: 0.14,
          maxLife: 0.14,
        });

        if (w.id === 'negate' && pose.backHand && pose.offWeaponWorldAngle !== undefined) {
          const oAng = pose.offWeaponWorldAngle;
          this._weaponTrail.push({
            trailId: 'off',
            strokeId,
            tx: pose.backHand.x + Math.cos(oAng) * 0.62,
            ty: pose.backHand.y + Math.sin(oAng) * 0.62,
            bx: pose.backHand.x + Math.cos(oAng) * 0.12,
            by: pose.backHand.y + Math.sin(oAng) * 0.12,
            colorBlack: w.colorBlack,
            colorLight: w.colorLight,
            life: 0.13,
            maxLife: 0.13,
          });
        }
      } else if (throwSwinging && pose.throwingSpear && pose.frontHand) {
        const ang = pose.throwingSpear.angle;
        this._weaponTrail.push({
          trailId: 'main',
          strokeId,
          tx: pose.frontHand.x + Math.cos(ang) * 0.68,
          ty: pose.frontHand.y + Math.sin(ang) * 0.68,
          bx: pose.frontHand.x + Math.cos(ang) * 0.12,
          by: pose.frontHand.y + Math.sin(ang) * 0.12,
          colorBlack: '#f59e0b',
          colorLight: '#d97706',
          life: 0.15,
          maxLife: 0.15,
        });
      }

      if (this._weaponTrail.length > 20) {
        this._weaponTrail.splice(0, this._weaponTrail.length - 20);
      }
    }

    _armFK(sx, sy, shoulderAngle, elbowOffsetAngle, upperLen = CONFIG.UPPER_ARM_LEN, foreLen = CONFIG.FOREARM_LEN) {
      const jx = sx + Math.cos(shoulderAngle) * upperLen;
      const jy = sy + Math.sin(shoulderAngle) * upperLen;
      const foreAngle = shoulderAngle + elbowOffsetAngle;
      const ex = jx + Math.cos(foreAngle) * foreLen;
      const ey = jy + Math.sin(foreAngle) * foreLen;
      return { jx, jy, ex, ey };
    }

    _updateDanceParticles(dt) {
      if (this.danceStyle === 1) {
        this.danceNoteTimer -= dt;
        if (this.danceNoteTimer <= 0) {
          this.particles.spawnMusicNote(this.x, this.y + 1.9);
          this.danceNoteTimer = 0.48;
        }
        return;
      }

      if (this.danceStyle === 0) {
        const t = this.danceLocalTime % 7.8;
        if (this.danceFx) {
          if (this.danceFx.blue && Math.random() < dt * 18) {
            const ang = Math.random() * Math.PI * 2;
            const rad = 0.35 + Math.random() * 0.25;
            const bx = this.danceFx.blue.x + Math.cos(ang) * rad;
            const by = this.danceFx.blue.y + Math.sin(ang) * rad;
            this.particles.spawnSpark(
              bx,
              by,
              -Math.cos(ang) * 1.4,
              -Math.sin(ang) * 1.4,
              '#60a5fa',
              0.032,
              0.28
            );
          }
          if (this.danceFx.red && Math.random() < dt * 18) {
            const ang = Math.random() * Math.PI * 2;
            const rx = this.danceFx.red.x + Math.cos(ang) * 0.08;
            const ry = this.danceFx.red.y + Math.sin(ang) * 0.08;
            this.particles.spawnSpark(
              rx,
              ry,
              Math.cos(ang) * 1.5,
              Math.sin(ang) * 1.5,
              '#ff4d6d',
              0.032,
              0.28
            );
          }
          if (this.danceFx.purple && t < 6.9 && Math.random() < dt * 28) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 1.2 + Math.random() * 2.2;
            this.particles.spawnSpark(
              this.danceFx.purple.x + Math.cos(ang) * 0.14,
              this.danceFx.purple.y + Math.sin(ang) * 0.14,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              Math.random() > 0.4 ? '#c084fc' : '#f3e8ff',
              0.036,
              0.34
            );
          }
        }
        return;
      }

      if (this.danceStyle === 2) {
        if (Math.random() < dt * 12) {
          const ox = this.x + (Math.random() - 0.5) * 1.65;
          const oy = this.y - 0.15 + Math.random() * 1.3;
          this.particles.spawnSpark(
            ox,
            oy,
            (Math.random() - 0.5) * 0.12,
            0.38 + Math.random() * 0.42,
            Math.random() > 0.35 ? '#fde047' : '#7dd3fc',
            0.03,
            0.85
          );
        }
      }
    }

    _computeGojoPurplePose(t) {
      // Composed heroic 7.8s cycle:
      // 0.00..2.05: Face camera calmly, raise left arm gracefully to condense Blue & float to sky left
      // 2.05..4.00: Extend right fingertip to condense Red & float to sky right
      // 4.00..5.25: Calm hands-in convergence seal as Blue + Red spiral together
      // 5.25..7.10: Crisp fingertip-aimed Hollow Purple release
      // 7.10..7.80: Effortless return to standing poise
      const shotMask =
        this._smoothstep(5.05, 5.45, t) * (1 - this._smoothstep(6.75, 7.35, t));
      const hipH = 0.895 - 0.03 * shotMask;
      const weightShift = -0.02 + 0.055 * shotMask;

      const hipX = this.x + weightShift;
      const hipY = this.y + hipH;
      const shoulderCenterX = this.x + weightShift * 1.25;
      const shoulderY = hipY + CONFIG.TORSO_LEN;
      const neckX = shoulderCenterX;
      const neckY = shoulderY + CONFIG.NECK_LEN;
      const headX = neckX + shotMask * 0.015;
      const headY = neckY + CONFIG.HEAD_RADIUS;

      this.currentVisualHeight = headY + CONFIG.HEAD_RADIUS - this.y;

      const frontHip = { x: hipX + 0.075, y: hipY };
      const backHip = { x: hipX - 0.075, y: hipY };
      const frontShoulder = { x: shoulderCenterX + 0.145, y: shoulderY };
      const backShoulder = { x: shoulderCenterX - 0.145, y: shoulderY };

      // Tall, poised 3/4 stance with straight human knee alignment (no frog-bow knees)
      const leftFoot = { x: backHip.x - 0.035, y: this.y };
      const rightFoot = { x: this.x + 0.2, y: this.y };

      const legL = this._solveTwoBoneIK(
        backHip.x,
        backHip.y,
        leftFoot.x,
        leftFoot.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        1
      );
      const legR = this._solveTwoBoneIK(
        frontHip.x,
        frontHip.y,
        rightFoot.x,
        rightFoot.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        1
      );

      // Smooth FK choreography for Left Arm (Blue arm) -> zero elbow flipping
      let lAng = -1.78;
      let lElb = 0.12;
      if (t < 0.55) {
        const u = this._smoothstep(0.0, 0.55, t);
        lAng = utils.lerp(-1.78, -3.3, u);
        lElb = utils.lerp(0.12, -0.34, u);
      } else if (t < 1.25) {
        lAng = -3.3 + 0.03 * Math.sin((t - 0.55) * 8);
        lElb = -0.34;
      } else if (t < 1.98) {
        const u = this._smoothstep(1.25, 1.98, t);
        lAng = utils.lerp(-3.3, -3.9, u);
        lElb = utils.lerp(-0.34, -0.18, u);
      } else if (t < 2.85) {
        const u = this._smoothstep(1.98, 2.85, t);
        lAng = utils.lerp(-3.9, -1.78, u);
        lElb = utils.lerp(-0.18, 0.12, u);
      } else if (t < 3.95) {
        lAng = -1.78;
        lElb = 0.12;
      } else if (t < 4.75) {
        const u = this._smoothstep(3.95, 4.75, t);
        lAng = utils.lerp(-1.78, -2.28, u);
        lElb = utils.lerp(0.12, -1.08, u);
      } else if (t < 5.15) {
        lAng = -2.28;
        lElb = -1.08;
      } else if (t < 5.65) {
        const u = this._smoothstep(5.15, 5.65, t);
        lAng = utils.lerp(-2.28, -1.86, u);
        lElb = utils.lerp(-1.08, 0.18, u);
      } else if (t < 6.9) {
        lAng = -1.86;
        lElb = 0.18;
      } else {
        const u = this._smoothstep(6.9, 7.75, t);
        lAng = utils.lerp(-1.86, -1.78, u);
        lElb = utils.lerp(0.18, 0.12, u);
      }

      // Smooth FK choreography for Right Arm (Red & Hollow Purple fingertip release)
      let rAng = -1.36;
      let rElb = -0.12;
      if (t < 2.05) {
        rAng = -1.36;
        rElb = -0.12;
      } else if (t < 2.65) {
        const u = this._smoothstep(2.05, 2.65, t);
        rAng = utils.lerp(-1.36, 0.18, u);
        rElb = utils.lerp(-0.12, 0.28, u);
      } else if (t < 3.25) {
        rAng = 0.18 + 0.025 * Math.sin((t - 2.65) * 9);
        rElb = 0.28;
      } else if (t < 3.95) {
        const u = this._smoothstep(3.25, 3.95, t);
        rAng = utils.lerp(0.18, 0.72, u);
        rElb = utils.lerp(0.28, 0.14, u);
      } else if (t < 4.75) {
        const u = this._smoothstep(3.95, 4.75, t);
        rAng = utils.lerp(0.72, -0.86, u);
        rElb = utils.lerp(0.14, 1.08, u);
      } else if (t < 5.15) {
        rAng = -0.86;
        rElb = 1.08;
      } else if (t < 5.55) {
        const u = this._smoothstep(5.15, 5.55, t);
        rAng = utils.lerp(-0.86, 0.64, u);
        rElb = utils.lerp(1.08, 0.08, u);
      } else if (t < 6.85) {
        const u = this._smoothstep(5.55, 6.85, t);
        rAng = utils.lerp(0.64, 0.56, u);
        rElb = 0.08;
      } else {
        const u = this._smoothstep(6.85, 7.75, t);
        rAng = utils.lerp(0.56, -1.36, u);
        rElb = utils.lerp(0.08, -0.12, u);
      }

      const armL = this._armFK(backShoulder.x, backShoulder.y, lAng, lElb);
      const armR = this._armFK(frontShoulder.x, frontShoulder.y, rAng, rElb);

      // Compute Blue, Red, Hollow Purple world orbs
      const skyCenter = { x: this.x, y: this.y + 2.84 };
      const skyLeft = { x: this.x - 0.86, y: skyCenter.y };
      const skyRight = { x: this.x + 0.86, y: skyCenter.y };

      let blue = null;
      let red = null;
      let purple = null;

      if (t >= 0.45 && t < 5.26) {
        if (t < 1.25) {
          const u = this._smoothstep(0.45, 1.08, t);
          blue = {
            x: armL.ex - 0.05,
            y: armL.ey + 0.14,
            r: utils.lerp(0.05, 0.22, u),
            alpha: u,
          };
        } else if (t < 1.98) {
          const u = this._smoothstep(1.25, 1.98, t);
          blue = {
            x: utils.lerp(armL.ex - 0.05, skyLeft.x, u),
            y: utils.lerp(armL.ey + 0.14, skyLeft.y, u),
            r: utils.lerp(0.22, 0.26, u),
            alpha: 1,
          };
        } else if (t < 3.95) {
          blue = {
            x: skyLeft.x,
            y: skyLeft.y + 0.035 * Math.sin(t * 3.8),
            r: 0.26 + 0.015 * Math.sin(t * 7.5),
            alpha: 1,
          };
        } else {
          const p = this._smoothstep(3.95, 5.25, t);
          const orbitR = 0.86 * (1 - p);
          const ang = Math.PI + p * Math.PI * 2.15;
          blue = {
            x: skyCenter.x + Math.cos(ang) * orbitR,
            y: skyCenter.y + Math.sin(ang) * orbitR * 0.42,
            r: utils.lerp(0.26, 0.17, p),
            alpha: 1,
          };
        }
      }

      if (t >= 2.35 && t < 5.26) {
        if (t < 3.25) {
          const u = this._smoothstep(2.35, 3.05, t);
          red = {
            x: armR.ex + 0.08,
            y: armR.ey + 0.09,
            r: utils.lerp(0.05, 0.22, u),
            alpha: u,
          };
        } else if (t < 3.95) {
          const u = this._smoothstep(3.25, 3.95, t);
          red = {
            x: utils.lerp(armR.ex + 0.08, skyRight.x, u),
            y: utils.lerp(armR.ey + 0.09, skyRight.y, u),
            r: utils.lerp(0.22, 0.26, u),
            alpha: 1,
          };
        } else {
          const p = this._smoothstep(3.95, 5.25, t);
          const orbitR = 0.86 * (1 - p);
          const ang = p * Math.PI * 2.15;
          red = {
            x: skyCenter.x + Math.cos(ang) * orbitR,
            y: skyCenter.y + Math.sin(ang) * orbitR * 0.42,
            r: utils.lerp(0.26, 0.17, p),
            alpha: 1,
          };
        }
      }

      if (t >= 5.22 && t < 7.45) {
        const age = t - 5.22;
        const charge = this._smoothstep(5.22, 5.68, t);
        const surge = this._smoothstep(5.72, 6.72, t);
        const fade = 1 - this._smoothstep(6.65, 7.45, t);
        purple = {
          x: skyCenter.x,
          y: utils.lerp(skyCenter.y, skyCenter.y - 0.35, surge * 0.45),
          r: utils.lerp(0.18, 0.45, charge) + surge * 0.28,
          alpha: fade,
          age,
          surge,
        };
      }

      this.danceFx = {
        mode: 'purple',
        t,
        blue,
        red,
        purple,
        skyCenter,
      };

      const auraStyle = purple && t < 7.1 ? 'purple' : 'cyan';

      return {
        facing: 1,
        frontFacing: true,
        auraStyle,
        coatStyle: true,
        eyeColorOverride: '#38bdf8',
        hip: { x: hipX, y: hipY },
        frontHip,
        backHip,
        shoulder: { x: shoulderCenterX, y: shoulderY },
        frontShoulder,
        backShoulder,
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: legR.jx, y: legR.jy },
        frontFoot: { x: legR.ex, y: legR.ey },
        frontToe: { x: legR.ex + 0.1, y: this.y },
        backKnee: { x: legL.jx, y: legL.jy },
        backFoot: { x: legL.ex, y: legL.ey },
        backToe: { x: legL.ex - 0.06, y: this.y },
        frontElbow: { x: armR.jx, y: armR.jy },
        frontHand: { x: armR.ex, y: armR.ey },
        backElbow: { x: armL.jx, y: armL.jy },
        backHand: { x: armL.ex, y: armL.ey },
      };
    }

    _computeHonoredOnePose(t) {
      // True Gojo "The Honored One" cloud-floating serenity:
      // Deep reclined horizontal posture, head gazing straight UP into heaven,
      // BOTH arms hanging down completely relaxed & weightless.
      const f = this.facing;
      const floatBob = 0.03 * Math.sin(t * 1.45);
      const hipX = this.x + f * 0.22;
      const hipY = this.y + 0.54 + floatBob;

      const torsoTilt = -1.08 + 0.025 * Math.sin(t * 1.2);
      const shoulderX = hipX + f * Math.sin(torsoTilt) * CONFIG.TORSO_LEN;
      const shoulderY = hipY + Math.cos(torsoTilt) * CONFIG.TORSO_LEN;

      const headTilt = torsoTilt - 0.16;
      const neckX = shoulderX + f * Math.sin(headTilt) * CONFIG.NECK_LEN;
      const neckY = shoulderY + Math.cos(headTilt) * CONFIG.NECK_LEN;
      const headX = neckX + f * Math.sin(headTilt) * CONFIG.HEAD_RADIUS;
      const headY = neckY + Math.cos(headTilt) * CONFIG.HEAD_RADIUS;

      this.currentVisualHeight =
        Math.max(headY, shoulderY, hipY) + CONFIG.HEAD_RADIUS - this.y;

      // Drifting zero-gravity relaxed legs
      const leg1 = this._solveTwoBoneIK(
        hipX,
        hipY,
        hipX + f * 0.56,
        hipY - 0.25 + 0.03 * Math.sin(t * 1.3),
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        hipX,
        hipY,
        hipX + f * 0.72,
        hipY - 0.34 - 0.025 * Math.sin(t * 1.3),
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );

      // BOTH arms relaxed downward toward earth, gently drifting weightlessly
      const sway1 = 0.06 * Math.sin(t * 1.35);
      const sway2 = -0.05 * Math.cos(t * 1.15);
      const arm1 = this._armFK(
        shoulderX,
        shoulderY,
        -1.56 + sway1,
        f * 0.16,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN
      );
      const arm2 = this._armFK(
        shoulderX + f * 0.07,
        shoulderY - 0.02,
        -1.36 + sway2,
        f * 0.2,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN
      );

      this.danceFx = {
        mode: 'honored',
        t,
        center: { x: (hipX + shoulderX) * 0.5, y: (hipY + shoulderY) * 0.5 },
        quoteY: this.y - 0.78,
      };

      return {
        facing: f,
        auraStyle: 'gold',
        coatStyle: true,
        eyeColorOverride: '#7dd3fc',
        eyeDir: { x: f * 0.2, y: 0.98 },
        hip: { x: hipX, y: hipY },
        shoulder: { x: shoulderX, y: shoulderY },
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: leg1.jx, y: leg1.jy },
        frontFoot: { x: leg1.ex, y: leg1.ey },
        frontToe: { x: leg1.ex + f * 0.08, y: leg1.ey - 0.1 },
        backKnee: { x: leg2.jx, y: leg2.jy },
        backFoot: { x: leg2.ex, y: leg2.ey },
        backToe: { x: leg2.ex + f * 0.08, y: leg2.ey - 0.1 },
        frontElbow: { x: arm1.jx, y: arm1.jy },
        frontHand: { x: arm1.ex, y: arm1.ey },
        backElbow: { x: arm2.jx, y: arm2.jy },
        backHand: { x: arm2.ex, y: arm2.ey },
      };
    }

    _computeDancePose() {
      const t = this.danceLocalTime;

      if (this.danceStyle === 0) {
        return this._computeGojoPurplePose(t % 7.8);
      }
      if (this.danceStyle === 2) {
        return this._computeHonoredOnePose(t);
      }

      // Dance 2: Classic Disco Point & Groove
      this.danceFx = null;
      const f = this.facing;
      const beat = t * (CONFIG.DANCE_BPM / 60) * Math.PI;
      const snap = Math.tanh(2.8 * Math.sin(beat * 0.5));
      const pulse = Math.abs(Math.sin(beat));
      const hipOffsetX = 0.09 * snap;
      const hipHeight = 0.85 - 0.09 * pulse;
      const torsoTilt = -0.2 * snap;

      const f1 = {
        x: this.x + 0.21,
        y: this.y + (snap > 0 ? 0.05 * pulse : 0),
      };
      const f2 = {
        x: this.x - 0.21,
        y: this.y + (snap < 0 ? 0.05 * pulse : 0),
      };

      let h1Local;
      let h2Local;
      if (snap >= 0) {
        h1Local = { x: 0.42, y: 0.42 };
        h2Local = { x: -0.24, y: -0.34 };
      } else {
        h1Local = { x: 0.24, y: -0.34 };
        h2Local = { x: -0.42, y: 0.42 };
      }

      const hipX = this.x + hipOffsetX;
      const hipY = this.y + hipHeight;
      const shoulderX = hipX + Math.sin(torsoTilt) * CONFIG.TORSO_LEN;
      const shoulderY = hipY + Math.cos(torsoTilt) * CONFIG.TORSO_LEN;

      const headBob = Math.sin(beat * 2) * 0.04;
      const neckX = shoulderX + Math.sin(torsoTilt * 0.5 + headBob) * CONFIG.NECK_LEN;
      const neckY = shoulderY + Math.cos(torsoTilt * 0.5 + headBob) * CONFIG.NECK_LEN;
      const headX = neckX + Math.sin(torsoTilt * 0.5 + headBob) * CONFIG.HEAD_RADIUS;
      const headY = neckY + Math.cos(torsoTilt * 0.5 + headBob) * CONFIG.HEAD_RADIUS;

      this.currentVisualHeight = headY + CONFIG.HEAD_RADIUS - this.y;

      const leg1 = this._solveTwoBoneIK(
        hipX,
        hipY,
        f1.x,
        f1.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        hipX,
        hipY,
        f2.x,
        f2.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const arm1 = this._solveTwoBoneIK(
        shoulderX,
        shoulderY,
        shoulderX + f * h1Local.x,
        shoulderY + h1Local.y,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      const arm2 = this._solveTwoBoneIK(
        shoulderX,
        shoulderY,
        shoulderX + f * h2Local.x,
        shoulderY + h2Local.y,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );

      return {
        facing: f,
        hip: { x: hipX, y: hipY },
        shoulder: { x: shoulderX, y: shoulderY },
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: leg1.jx, y: leg1.jy },
        frontFoot: { x: leg1.ex, y: leg1.ey },
        frontToe: { x: leg1.ex + f * CONFIG.FOOT_LEN, y: Math.max(this.y, leg1.ey) },
        backKnee: { x: leg2.jx, y: leg2.jy },
        backFoot: { x: leg2.ex, y: leg2.ey },
        backToe: { x: leg2.ex + f * CONFIG.FOOT_LEN, y: Math.max(this.y, leg2.ey) },
        frontElbow: { x: arm1.jx, y: arm1.jy },
        frontHand: { x: arm1.ex, y: arm1.ey },
        backElbow: { x: arm2.jx, y: arm2.jy },
        backHand: { x: arm2.ex, y: arm2.ey },
      };
    }

    _computeClimbPose() {
      const f = this.facing;
      const bodyX = -f * 0.24;
      const hipX = bodyX;
      const hipY = this.y + 0.86 + 0.02 * Math.sin(this.climbPhase);

      const lean = 0.14;
      const shoulderX = hipX + f * Math.sin(lean) * CONFIG.TORSO_LEN;
      const shoulderY = hipY + Math.cos(lean) * CONFIG.TORSO_LEN;
      const neckX = shoulderX + f * Math.sin(lean * 0.5) * CONFIG.NECK_LEN;
      const neckY = shoulderY + Math.cos(lean * 0.5) * CONFIG.NECK_LEN;
      const headX = neckX + f * Math.sin(lean * 0.5) * CONFIG.HEAD_RADIUS;
      const headY = neckY + Math.cos(lean * 0.5) * CONFIG.HEAD_RADIUS;

      this.currentVisualHeight = headY + CONFIG.HEAD_RADIUS - this.y;

      const h1 = this._computeClimbTarget(0, CONFIG.CLIMB_STEP_LEN, 0.12);
      const h2 = this._computeClimbTarget(Math.PI, CONFIG.CLIMB_STEP_LEN, 0.12);
      const l1 = this._computeClimbTarget(Math.PI, CONFIG.CLIMB_STEP_LEN * 0.85, 0.14);
      const l2 = this._computeClimbTarget(0, CONFIG.CLIMB_STEP_LEN * 0.85, 0.14);

      const leg1 = this._solveTwoBoneIK(
        hipX,
        hipY,
        l1.x,
        this.y + 0.28 + l1.dy,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        hipX,
        hipY,
        l2.x,
        this.y + 0.28 + l2.dy,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const arm1 = this._solveTwoBoneIK(
        shoulderX,
        shoulderY,
        h1.x,
        shoulderY + 0.16 + h1.dy,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      const arm2 = this._solveTwoBoneIK(
        shoulderX,
        shoulderY,
        h2.x,
        shoulderY + 0.16 + h2.dy,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );

      return {
        facing: f,
        hip: { x: hipX, y: hipY },
        shoulder: { x: shoulderX, y: shoulderY },
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: leg1.jx, y: leg1.jy },
        frontFoot: { x: leg1.ex, y: leg1.ey },
        frontToe: { x: leg1.ex + f * 0.08, y: leg1.ey },
        backKnee: { x: leg2.jx, y: leg2.jy },
        backFoot: { x: leg2.ex, y: leg2.ey },
        backToe: { x: leg2.ex + f * 0.08, y: leg2.ey },
        frontElbow: { x: arm1.jx, y: arm1.jy },
        frontHand: { x: arm1.ex, y: arm1.ey },
        backElbow: { x: arm2.jx, y: arm2.jy },
        backHand: { x: arm2.ex, y: arm2.ey },
      };
    }

    _computeSurfPose() {
      const f = this.facing;
      const theta = this.curveSlopeAngle;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const nx = -sinT;
      const ny = cosT;

      const stanceHalf = this.crouching ? 0.29 : 0.23;
      const frontFootX = this.x + f * stanceHalf * cosT;
      const frontFootY = this.y + f * stanceHalf * sinT;
      const backFootX = this.x - f * stanceHalf * cosT;
      const backFootY = this.y - f * stanceHalf * sinT;

      const carveDepth = this.crouching ? 0.58 : 0.74;
      const speedSquat = utils.clamp(Math.abs(this.curveSpeed) / 24, 0, 0.14);
      const normalH = carveDepth - speedSquat;
      const hipX = this.x + nx * normalH;
      const hipY = this.y + ny * normalH;

      const torsoLean = this.crouching ? 0.54 : 0.34;
      const bodyAng = Math.PI * 0.5 + theta - f * torsoLean;
      const midLen = CONFIG.TORSO_LEN * 0.48;
      const curveBend = f * (this.crouching ? 0.048 : 0.028);
      const waistX = hipX + Math.cos(bodyAng + curveBend) * midLen;
      const waistY = hipY + Math.sin(bodyAng + curveBend) * midLen;
      const shoulderX = hipX + Math.cos(bodyAng) * CONFIG.TORSO_LEN;
      const shoulderY = hipY + Math.sin(bodyAng) * CONFIG.TORSO_LEN;
      const headTiltAng = bodyAng + f * 0.12;
      const neckX = shoulderX + Math.cos(headTiltAng) * CONFIG.NECK_LEN;
      const neckY = shoulderY + Math.sin(headTiltAng) * CONFIG.NECK_LEN;
      const headX = neckX + Math.cos(headTiltAng) * CONFIG.HEAD_RADIUS;
      const headY = neckY + Math.sin(headTiltAng) * CONFIG.HEAD_RADIUS;

      const frontHip = { x: hipX + f * 0.04 * cosT, y: hipY + f * 0.04 * sinT };
      const backHip = { x: hipX - f * 0.04 * cosT, y: hipY - f * 0.04 * sinT };
      const frontShoulder = { x: shoulderX + f * 0.062 * cosT, y: shoulderY + f * 0.062 * sinT };
      const backShoulder = { x: shoulderX - f * 0.062 * cosT, y: shoulderY - f * 0.062 * sinT };

      this.currentVisualHeight = Math.max(1.3, headY + CONFIG.HEAD_RADIUS - this.y);

      const leg1 = this._solveTwoBoneIK(
        frontHip.x,
        frontHip.y,
        frontFootX,
        frontFootY,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        backHip.x,
        backHip.y,
        backFootX,
        backFootY,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );

      const sway = Math.sin(this.idleTime * 6.5) * 0.06;
      const fBase = f > 0 ? theta - (this.crouching ? 0.42 : 0.18) : Math.PI + theta + (this.crouching ? 0.42 : 0.18);
      const bBase = f > 0 ? Math.PI + theta + 0.18 : theta - 0.18;

      const arm1 = this._armFK(
        frontShoulder.x,
        frontShoulder.y,
        fBase + sway,
        f * (this.crouching ? 0.42 : 0.28)
      );
      const arm2 = this._armFK(
        backShoulder.x,
        backShoulder.y,
        bBase - sway,
        -f * 0.34
      );

      return {
        facing: f,
        eyeDir: { x: f * cosT, y: f * sinT },
        hip: { x: hipX, y: hipY },
        waist: { x: waistX, y: waistY },
        frontHip,
        backHip,
        shoulder: { x: shoulderX, y: shoulderY },
        frontShoulder,
        backShoulder,
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: leg1.jx, y: leg1.jy },
        frontFoot: { x: leg1.ex, y: leg1.ey },
        frontToe: {
          x: leg1.ex + f * 0.11 * cosT,
          y: leg1.ey + f * 0.11 * sinT,
        },
        backKnee: { x: leg2.jx, y: leg2.jy },
        backFoot: { x: leg2.ex, y: leg2.ey },
        backToe: {
          x: leg2.ex - f * 0.08 * cosT,
          y: leg2.ey - f * 0.08 * sinT,
        },
        frontElbow: { x: arm1.jx, y: arm1.jy },
        frontHand: { x: arm1.ex, y: arm1.ey },
        backElbow: { x: arm2.jx, y: arm2.jy },
        backHand: { x: arm2.ex, y: arm2.ey },
      };
    }

    computePose() {
      let pose;
      if (this.surfingCurve || this.ridingVector) {
        pose = this._computeSurfPose();
      } else if (this.climbing) {
        pose = this._computeClimbPose();
      } else if (this.dancing) {
        pose = this._computeDancePose();
      } else {
        pose = this._computeLocomotionPose();
      }
      return this._finalizePose(pose);
    }

    _finalizePose(pose) {
      if (!pose) return pose;
      const spec = this.getCharacterStyleSpec();
      pose.styleId = spec.id;

      if (!this.dancing) {
        pose.coatStyle = Boolean(spec.coatBlack || spec.coatLight);
      } else if (pose.coatStyle === undefined) {
        pose.coatStyle = Boolean(spec.coatBlack || spec.coatLight);
      }

      const highIntensity =
        this.dashTimer > 0 ||
        this.glFlashTimer > 0 ||
        Boolean(this.ridingVector) ||
        Boolean(this.surfingCurve) ||
        Boolean(this.combat && this.combat.active);

      if (!pose.auraStyle) {
        if (highIntensity || spec.id !== 'animator') {
          pose.auraStyle = spec.auraStyle || 'cyan';
          pose.auraSoft = !highIntensity;
        }
      }
      if (!pose.eyeColorOverride && spec.eyeColor) {
        pose.eyeColorOverride = spec.eyeColor;
        if (spec.eyeColorAlt) pose.eyeColorAlt = spec.eyeColorAlt;
      }

      if (!this.dancing) {
        if (this.throwState && this.throwState.active) {
          this._applyThrowPose(pose);
        } else if (this.combat && this.combat.active) {
          pose.combatWeapon = this.combat.getActiveWeapon();
          pose.parrying = this.combat.parryTimer > 0;
          if (this.combat.attackState && this.combat.attackState.active) {
            this._applyCombatPose(pose, this.combat.attackState);
          } else if (this.combat.parryTimer > 0) {
            this._applyParryPose(pose);
          }
        }
      }

      this._applySquashStretch(pose);
      this._sampleWeaponTrail(pose);

      return pose;
    }

    _applyThrowPose(pose) {
      const st = this.throwState;
      const f = Math.abs(st.ux) > 0.12 ? Math.sign(st.ux) : pose.facing || 1;
      pose.facing = f;
      const aimAng = Math.atan2(st.uy, st.ux);
      pose.eyeDir = { x: Math.cos(aimAng), y: Math.sin(aimAng) };

      const t = st.timer;
      const windup = Math.max(0.02, st.windup);
      const dur = Math.max(windup + 0.05, st.duration);
      const coilAng = aimAng + f * 2.25;
      let armAng = aimAng;
      let reach = 0.52;

      const peakWind = windup * 0.65;
      if (t < peakWind) {
        const p = utils.clamp(t / peakWind, 0, 1);
        const e = p * p;
        armAng = utils.lerp(aimAng + f * 0.4, coilAng, e);
        reach = utils.lerp(0.42, 0.48, p);
        this._applySpineDeform(pose, {
          hipDrop: 0.06 * e,
          leanDelta: -0.32 * e,
          archDelta: -0.32 * e,
          twistDelta: -0.78 * e,
          lungeStance: true,
          frontFootX: utils.lerp(0.16, 0.24, e),
          backFootX: utils.lerp(-0.14, -0.32, e),
        });
      } else if (t < windup) {
        const p = utils.clamp((t - peakWind) / (windup - peakWind), 0, 1);
        armAng = utils.lerp(coilAng, aimAng, p);
        reach = utils.lerp(0.48, 0.54, p);
        this._applySpineDeform(pose, {
          hipDrop: 0.08,
          leanDelta: utils.lerp(-0.32, 0.26, p),
          archDelta: utils.lerp(-0.32, 0.18, p),
          twistDelta: utils.lerp(-0.78, 0.35, p),
          lungeStance: true,
          frontFootX: utils.lerp(0.24, 0.34, p),
          backFootX: -0.32,
        });
      } else {
        const p = utils.clamp((t - windup) / (dur - windup), 0, 1);
        const follow = 1 - Math.pow(1 - p, 2);
        armAng = aimAng - f * 0.48 * follow;
        reach = utils.lerp(0.54, 0.46, p);
        this._applySpineDeform(pose, {
          hipDrop: 0.08 * (1 - p * 0.5),
          leanDelta: utils.lerp(0.36, 0.14, p),
          archDelta: utils.lerp(0.24, 0.04, p),
          twistDelta: utils.lerp(0.86, 0.25, p),
          lungeStance: true,
          frontFootX: 0.35,
          backFootX: -0.3,
        });
      }

      const sh = pose.frontShoulder || pose.shoulder;
      const bsh = pose.backShoulder || pose.shoulder;
      const hx = sh.x + Math.cos(armAng) * reach;
      const hy = sh.y + Math.sin(armAng) * reach;
      const arm1 = this._solveTwoBoneIK(
        sh.x,
        sh.y,
        hx,
        hy,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      pose.frontElbow = { x: arm1.jx, y: arm1.jy };
      pose.frontHand = { x: arm1.ex, y: arm1.ey };

      // Off-hand sights forward then counterbalances back cleanly upon release
      const guideReach = t < windup ? 0.44 : 0.32;
      const guideAng = t < windup ? aimAng : aimAng + f * 2.1;
      const gx = bsh.x + Math.cos(guideAng) * guideReach;
      const gy = bsh.y + Math.sin(guideAng) * guideReach - 0.04;
      const arm2 = this._solveTwoBoneIK(
        bsh.x,
        bsh.y,
        gx,
        gy,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        f
      );
      pose.backElbow = { x: arm2.jx, y: arm2.jy };
      pose.backHand = { x: arm2.ex, y: arm2.ey };

      if (!st.released) {
        pose.throwingSpear = {
          angle: armAng,
          ux: st.ux,
          uy: st.uy,
        };
      }
    }

    _applyParryPose(pose) {
      const f = pose.facing || 1;
      this._applySpineDeform(pose, {
        hipDrop: 0.08,
        leanDelta: 0.2,
        archDelta: -0.06,
        twistDelta: 0.46,
        lungeStance: true,
        frontFootX: 0.28,
        backFootX: -0.22,
      });

      const sh = pose.frontShoulder || pose.shoulder;
      const bsh = pose.backShoulder || pose.shoulder;

      const guard1 = this._solveTwoBoneIK(
        sh.x,
        sh.y,
        sh.x + f * 0.34,
        sh.y + 0.14,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      pose.frontElbow = { x: guard1.jx, y: guard1.jy };
      pose.frontHand = { x: guard1.ex, y: guard1.ey };

      const guard2 = this._solveTwoBoneIK(
        bsh.x,
        bsh.y,
        guard1.ex - f * 0.06,
        guard1.ey - 0.12,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      pose.backElbow = { x: guard2.jx, y: guard2.jy };
      pose.backHand = { x: guard2.ex, y: guard2.ey };

      pose.weaponWorldAngle = f > 0 ? 1.08 : Math.PI - 1.08;
    }

    _applyCombatPose(pose, atk) {
      const f = pose.facing || 1;
      const p = utils.clamp(atk.timer / Math.max(0.05, atk.duration), 0, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const aim = atk.aimAngle || 0;
      const VR = MathStickGame.VerletRig || {};
      pose.eyeDir = { x: Math.cos(aim), y: Math.sin(aim) };

      if (atk.isSlam) {
        // Meteor Plunge: tucked torso with closed-chain two-handed downward grip
        this._applySpineDeform(pose, {
          leanDelta: 0.38,
          archDelta: 0.24,
          twistDelta: 0.2,
        });
        const sh = pose.frontShoulder || pose.shoulder;
        const bsh = pose.backShoulder || pose.shoulder;
        const slamAng = -Math.PI * 0.5;
        if (VR.RigSolver) {
          const twoHand = VR.RigSolver.solveTwoHandWeapon({
            frontShoulder: sh,
            backShoulder: bsh,
            primaryHandTarget: { x: sh.x + f * 0.14, y: sh.y - 0.44 },
            weaponAngle: slamAng,
            gripSeparation: 0.14,
            upperLen: CONFIG.UPPER_ARM_LEN,
            foreLen: CONFIG.FOREARM_LEN,
            facing: f,
          });
          pose.frontElbow = { x: twoHand.arm1.jx, y: twoHand.arm1.jy };
          pose.frontHand = { x: twoHand.arm1.ex, y: twoHand.arm1.ey };
          pose.backElbow = { x: twoHand.arm2.jx, y: twoHand.arm2.jy };
          pose.backHand = { x: twoHand.arm2.ex, y: twoHand.arm2.ey };
        } else {
          const arm1 = this._solveTwoBoneIK(sh.x, sh.y, sh.x + f * 0.14, sh.y - 0.44, CONFIG.UPPER_ARM_LEN, CONFIG.FOREARM_LEN, -f);
          const arm2 = this._solveTwoBoneIK(bsh.x, bsh.y, bsh.x + f * 0.06, bsh.y - 0.42, CONFIG.UPPER_ARM_LEN, CONFIG.FOREARM_LEN, f);
          pose.frontElbow = { x: arm1.jx, y: arm1.jy };
          pose.frontHand = { x: arm1.ex, y: arm1.ey };
          pose.backElbow = { x: arm2.jx, y: arm2.jy };
          pose.backHand = { x: arm2.ex, y: arm2.ey };
        }
        pose.weaponWorldAngle = slamAng;
        return;
      }

      if (atk.weaponIdx === 3) {
        // Spear: coiled recoil followed by full-extension piston lunge with closed-chain two-hand shaft grip!
        let thrustDist;
        let twist;
        let leanD;
        if (p < 0.22) {
          const u = p / 0.22;
          thrustDist = utils.lerp(0.18, 0.05, u);
          twist = utils.lerp(0.1, -0.68, u);
          leanD = utils.lerp(0.05, -0.14, u);
        } else if (p < 0.68) {
          const u = (p - 0.22) / 0.46;
          const snap = 1 - Math.pow(1 - u, 3);
          thrustDist = utils.lerp(0.05, 0.56, snap);
          twist = utils.lerp(-0.68, 0.85, snap);
          leanD = utils.lerp(-0.14, 0.36, snap);
        } else {
          const u = (p - 0.68) / 0.32;
          thrustDist = utils.lerp(0.56, 0.36, u);
          twist = utils.lerp(0.85, 0.32, u);
          leanD = utils.lerp(0.36, 0.14, u);
        }

        this._applySpineDeform(pose, {
          hipDrop: 0.08,
          leanDelta: leanD,
          archDelta: 0.16,
          twistDelta: twist,
          lungeStance: true,
          frontFootX: p < 0.22 ? 0.22 : 0.38,
          backFootX: -0.32,
        });

        const sh = pose.frontShoulder || pose.shoulder;
        const bsh = pose.backShoulder || pose.shoulder;
        const tx = sh.x + Math.cos(aim) * thrustDist;
        const ty = sh.y + Math.sin(aim) * thrustDist;
        if (VR.RigSolver) {
          const twoHand = VR.RigSolver.solveTwoHandWeapon({
            frontShoulder: sh,
            backShoulder: bsh,
            primaryHandTarget: { x: tx, y: ty },
            weaponAngle: aim,
            gripSeparation: 0.22,
            upperLen: CONFIG.UPPER_ARM_LEN,
            foreLen: CONFIG.FOREARM_LEN,
            facing: f,
          });
          pose.frontElbow = { x: twoHand.arm1.jx, y: twoHand.arm1.jy };
          pose.frontHand = { x: twoHand.arm1.ex, y: twoHand.arm1.ey };
          pose.backElbow = { x: twoHand.arm2.jx, y: twoHand.arm2.jy };
          pose.backHand = { x: twoHand.arm2.ex, y: twoHand.arm2.ey };
        } else {
          const arm1 = this._solveTwoBoneIK(sh.x, sh.y, tx, ty, CONFIG.UPPER_ARM_LEN, CONFIG.FOREARM_LEN, -f);
          pose.frontElbow = { x: arm1.jx, y: arm1.jy };
          pose.frontHand = { x: arm1.ex, y: arm1.ey };
        }
        pose.weaponWorldAngle = aim;
        return;
      }

      // Katana [1], Heavy Broadsword [2], Twin Blades [3] full-body 3-hit combo choreography
      let sweepStart = aim + f * 1.48;
      let sweepEnd = aim - f * 1.08;
      let twistCurve = utils.lerp(-0.68, 0.78, ease);
      let archCurve = utils.lerp(-0.22, 0.24, ease);
      let leanCurve = utils.lerp(-0.08, 0.34, ease);
      let lungeFront = utils.lerp(0.22, 0.34, ease);

      if (atk.comboStep === 1) {
        sweepStart = aim - f * 1.28;
        sweepEnd = aim + f * 1.28;
        twistCurve = utils.lerp(0.65, -0.65, ease);
        archCurve = utils.lerp(0.18, -0.18, ease);
        leanCurve = utils.lerp(0.24, 0.14, ease);
        lungeFront = 0.3;
      } else if (atk.comboStep === 2) {
        sweepStart = aim + f * 1.92;
        sweepEnd = aim - f * 1.38;
        twistCurve = utils.lerp(-0.85, 0.92, ease);
        archCurve = utils.lerp(-0.28, 0.3, ease);
        leanCurve = utils.lerp(-0.12, 0.44, ease);
        lungeFront = utils.lerp(0.24, 0.42, ease);
      }

      this._applySpineDeform(pose, {
        hipDrop: atk.comboStep === 2 ? 0.11 : 0.06,
        leanDelta: leanCurve,
        archDelta: archCurve,
        twistDelta: twistCurve,
        lungeStance: true,
        frontFootX: lungeFront,
        backFootX: -0.3,
      });

      const sh = pose.frontShoulder || pose.shoulder;
      const bsh = pose.backShoulder || pose.shoulder;
      const swingAng = utils.lerp(sweepStart, sweepEnd, ease);
      const tx = sh.x + Math.cos(swingAng) * 0.5;
      const ty = sh.y + Math.sin(swingAng) * 0.5;

      if (atk.weaponIdx === 1 && VR.RigSolver) {
        const twoHand = VR.RigSolver.solveTwoHandWeapon({
          frontShoulder: sh,
          backShoulder: bsh,
          primaryHandTarget: { x: tx, y: ty },
          weaponAngle: swingAng,
          gripSeparation: 0.13,
          upperLen: CONFIG.UPPER_ARM_LEN,
          foreLen: CONFIG.FOREARM_LEN,
          facing: f,
        });
        pose.frontElbow = { x: twoHand.arm1.jx, y: twoHand.arm1.jy };
        pose.frontHand = { x: twoHand.arm1.ex, y: twoHand.arm1.ey };
        pose.backElbow = { x: twoHand.arm2.jx, y: twoHand.arm2.jy };
        pose.backHand = { x: twoHand.arm2.ex, y: twoHand.arm2.ey };
      } else {
        const arm1 = this._solveTwoBoneIK(
          sh.x,
          sh.y,
          tx,
          ty,
          CONFIG.UPPER_ARM_LEN,
          CONFIG.FOREARM_LEN,
          -f
        );
        pose.frontElbow = { x: arm1.jx, y: arm1.jy };
        pose.frontHand = { x: arm1.ex, y: arm1.ey };

        if (atk.weaponIdx === 2) {
          const offAng = utils.lerp(sweepEnd * 0.85, sweepStart * 0.85, ease);
          const arm2 = this._solveTwoBoneIK(
            bsh.x,
            bsh.y,
            bsh.x + Math.cos(offAng) * 0.44,
            bsh.y + Math.sin(offAng) * 0.44,
            CONFIG.UPPER_ARM_LEN,
            CONFIG.FOREARM_LEN,
            f
          );
          pose.backElbow = { x: arm2.jx, y: arm2.jy };
          pose.backHand = { x: arm2.ex, y: arm2.ey };
          pose.offWeaponWorldAngle = offAng;
        } else {
          // Katana stylish off-hand counterbalance trailing behind
          const arm2 = this._solveTwoBoneIK(
            bsh.x,
            bsh.y,
            bsh.x - f * 0.28,
            bsh.y - 0.18 + Math.sin(ease * Math.PI) * 0.1,
            CONFIG.UPPER_ARM_LEN,
            CONFIG.FOREARM_LEN,
            f
          );
          pose.backElbow = { x: arm2.jx, y: arm2.jy };
          pose.backHand = { x: arm2.ex, y: arm2.ey };
        }
      }

      pose.weaponWorldAngle = swingAng;

      // Style-tinted afterimage burst at peak of Combo Step 3 finisher!
      if (atk.comboStep === 2 && !atk._ghostEmitted && Math.abs(p - 0.36) < 0.16 && this.particles) {
        atk._ghostEmitted = true;
        const spec = this.getCharacterStyleSpec();
        this.particles.addGhost(pose, spec.accentBlack || null, 0.18);
      }
    }

    _computeLocomotionPose() {
      const f = this.facing;
      const speed = Math.abs(this.vx);
      const walkBlend = utils.clamp(speed / 0.45, 0, 1);
      const runBlend = utils.clamp(
        (speed - CONFIG.WALK_SPEED * 0.8) / (CONFIG.RUN_SPEED - CONFIG.WALK_SPEED * 0.8),
        0,
        1
      );

      let strideLen = utils.lerp(0.56, 1.04, runBlend);
      let liftHeight = utils.lerp(0.12, 0.28, runBlend);
      if (this.crouching) {
        strideLen = 0.38;
        liftHeight = 0.08;
      }

      const breath = Math.sin(this.idleTime * 3.0) * 0.014 * (1 - walkBlend);
      const gaitBounce =
        (-0.045 * runBlend + 0.036 * Math.abs(Math.sin(this.gaitPhase))) *
        walkBlend *
        (1 - this.airBlend);
      let hipHeight = CONFIG.HIP_HEIGHT_IDLE + breath + gaitBounce - 0.16 * this.landSquash;
      hipHeight = utils.lerp(hipHeight, CONFIG.HIP_HEIGHT_CROUCH, this.crouchBlend);
      hipHeight = utils.lerp(hipHeight, CONFIG.HIP_HEIGHT_SLIDE, this.slideBlend);
      if (this.dashTimer > 0) hipHeight = 0.78;
      if (!this.grounded && this.flipTimer > 0) hipHeight = 0.86;
      if (this.freeFallBlend > 0.2) {
        hipHeight = utils.lerp(hipHeight, 1.05, this.freeFallBlend);
      }

      const hipX = this.x;
      const hipY = this.y + hipHeight;
      const lean = this.leanAngle;

      // Spinal arch & counter-rotation 2.5D shoulder/hip twist
      const vyNorm = utils.clamp(this.vy / CONFIG.JUMP_VEL, -1, 1);
      const gaitTwist = -Math.sin(this.gaitPhase) * (0.24 + 0.2 * runBlend) * walkBlend * (1 - this.airBlend);
      const stateTwist = this.dashTimer > 0 ? 0.5 : this.slideBlend * 0.3 + this.crouchBlend * 0.16;
      const twist = utils.clamp(gaitTwist + stateTwist, -1, 1);

      const archBend =
        0.12 * runBlend * walkBlend +
        0.3 * this.landSquash -
        0.26 * this.slideBlend +
        0.18 * vyNorm * this.airBlend;

      const VR = MathStickGame.VerletRig || {};
      let waist;
      let shoulderX;
      let shoulderY;
      let neckX;
      let neckY;
      let headX;
      let headY;
      let frontShoulder;
      let backShoulder;
      let frontHip;
      let backHip;

      if (VR.RigSolver) {
        const spine = VR.RigSolver.solveSpine({
          hipX,
          hipY,
          torsoLen: CONFIG.TORSO_LEN,
          neckLen: CONFIG.NECK_LEN,
          headRadius: CONFIG.HEAD_RADIUS,
          facing: f,
          leanAngle: lean,
          archBend,
          twist,
          headTiltFactor: this.freeFallBlend > 0.3 ? 0.92 : 0.65,
          shoulderSpan: 0.055,
          hipSpan: 0.036,
        });
        waist = spine.waist;
        shoulderX = spine.shoulder.x;
        shoulderY = spine.shoulder.y;
        neckX = spine.neck.x;
        neckY = spine.neck.y;
        headX = spine.head.x;
        headY = spine.head.y;
        frontShoulder = spine.frontShoulder;
        backShoulder = spine.backShoulder;
        frontHip = spine.frontHip;
        backHip = spine.backHip;
      } else {
        shoulderX = hipX + f * Math.sin(lean) * CONFIG.TORSO_LEN;
        shoulderY = hipY + Math.cos(lean) * CONFIG.TORSO_LEN;
        waist = { x: (hipX + shoulderX) * 0.5, y: (hipY + shoulderY) * 0.5 };
        const headAngle = lean * (this.freeFallBlend > 0.3 ? 0.92 : 0.65);
        neckX = shoulderX + f * Math.sin(headAngle) * CONFIG.NECK_LEN;
        neckY = shoulderY + Math.cos(headAngle) * CONFIG.NECK_LEN;
        headX = neckX + f * Math.sin(headAngle) * CONFIG.HEAD_RADIUS;
        headY = neckY + Math.cos(headAngle) * CONFIG.HEAD_RADIUS;
        frontShoulder = { x: shoulderX, y: shoulderY };
        backShoulder = { x: shoulderX, y: shoulderY };
        frontHip = { x: hipX, y: hipY };
        backHip = { x: hipX, y: hipY };
      }

      this.currentVisualHeight = Math.max(
        1.1,
        Math.max(headY, hipY) + CONFIG.HEAD_RADIUS - this.y
      );

      // Foot targets with heel/toe gait push-off
      const groundF1 = this._computeFootLocal(0, strideLen, liftHeight, 0.12, walkBlend);
      const groundF2 = this._computeFootLocal(Math.PI, strideLen, liftHeight, -0.12, walkBlend);

      let airF1 = {
        x: utils.lerp(0.16, 0.22, Math.max(0, vyNorm)),
        y: utils.lerp(0.06, 0.34, (vyNorm + 1) * 0.5),
      };
      let airF2 = {
        x: utils.lerp(-0.14, -0.25, Math.max(0, vyNorm)),
        y: utils.lerp(0.15, 0.12, (vyNorm + 1) * 0.5),
      };

      // Free Fall leg poses
      if (this.freeFallBlend > 0.05) {
        let ff1;
        let ff2;
        if (this.freeFallDive) {
          ff1 = { x: -0.45, y: 1.55 };
          ff2 = { x: -0.35, y: 1.6 };
        } else if (this.freeFallBrake) {
          ff1 = { x: -0.62, y: 1.28 };
          ff2 = { x: -0.42, y: 1.38 };
        } else {
          const kick = Math.sin(this.idleTime * 13) * 0.16;
          ff1 = { x: 0.24 + kick, y: 0.28 };
          ff2 = { x: -0.24 - kick, y: 0.34 };
        }
        airF1 = {
          x: utils.lerp(airF1.x, ff1.x, this.freeFallBlend),
          y: utils.lerp(airF1.y, ff1.y, this.freeFallBlend),
        };
        airF2 = {
          x: utils.lerp(airF2.x, ff2.x, this.freeFallBlend),
          y: utils.lerp(airF2.y, ff2.y, this.freeFallBlend),
        };
      }

      let localF1 = {
        x: utils.lerp(groundF1.x, airF1.x, this.airBlend),
        y: utils.lerp(groundF1.y, airF1.y, this.airBlend),
      };
      let localF2 = {
        x: utils.lerp(groundF2.x, airF2.x, this.airBlend),
        y: utils.lerp(groundF2.y, airF2.y, this.airBlend),
      };

      if (this.slideBlend > 0.05) {
        localF1 = {
          x: utils.lerp(localF1.x, 0.62, this.slideBlend),
          y: utils.lerp(localF1.y, 0.04, this.slideBlend),
        };
        localF2 = {
          x: utils.lerp(localF2.x, -0.24, this.slideBlend),
          y: utils.lerp(localF2.y, 0.05, this.slideBlend),
        };
      }

      if (this.dashTimer > 0) {
        localF1 = { x: 0.36, y: 0.26 };
        localF2 = { x: -0.45, y: 0.14 };
      }

      if (this.flipTimer > 0) {
        localF1 = { x: 0.18, y: 0.42 };
        localF2 = { x: -0.1, y: 0.38 };
      }

      const leg1 = this._solveTwoBoneIK(
        frontHip.x,
        frontHip.y,
        this.x + f * localF1.x,
        this.y + localF1.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        backHip.x,
        backHip.y,
        this.x + f * localF2.x,
        this.y + localF2.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );

      // Arm swing (driven from 2.5D twisted shoulders!)
      const armReachX = utils.lerp(0.08, 0.38, runBlend) * walkBlend;
      const armSwingLift = utils.lerp(0.02, 0.18, runBlend) * walkBlend;
      const armPhase1 = Math.sin(this.gaitPhase + Math.PI);
      const armPhase2 = Math.sin(this.gaitPhase);

      let hand1Local = {
        x: armPhase1 * armReachX + 0.04,
        y: -0.38 + Math.abs(armPhase1) * armSwingLift + (armPhase1 > 0 ? 0.08 * runBlend : 0),
      };
      let hand2Local = {
        x: armPhase2 * armReachX + 0.04,
        y: -0.38 + Math.abs(armPhase2) * armSwingLift + (armPhase2 > 0 ? 0.08 * runBlend : 0),
      };

      if (walkBlend < 0.2 && this.grounded && !this.crouching) {
        const idleSwing = Math.sin(this.idleTime * 2.1) * 0.015;
        hand1Local.x = utils.lerp(0.08 + idleSwing, hand1Local.x, walkBlend * 5);
        hand2Local.x = utils.lerp(-0.06 - idleSwing, hand2Local.x, walkBlend * 5);
        hand1Local.y = utils.lerp(-0.46, hand1Local.y, walkBlend * 5);
        hand2Local.y = utils.lerp(-0.46, hand2Local.y, walkBlend * 5);
      }

      if (this.airBlend > 0.05) {
        let airH1 = { x: 0.26, y: this.vy > 0 ? 0.2 : 0.02 };
        let airH2 = { x: -0.22, y: this.vy > 0 ? 0.14 : 0.08 };

        if (this.freeFallBlend > 0.05) {
          let ffH1;
          let ffH2;
          if (this.freeFallDive) {
            ffH1 = { x: -0.22, y: 0.44 };
            ffH2 = { x: -0.26, y: 0.42 };
          } else if (this.freeFallBrake) {
            ffH1 = { x: 0.34, y: 0.32 };
            ffH2 = { x: -0.32, y: 0.34 };
          } else {
            const wave = Math.sin(this.idleTime * 15) * 0.16;
            ffH1 = { x: 0.28, y: 0.32 + wave };
            ffH2 = { x: -0.28, y: 0.32 - wave };
          }
          airH1 = {
            x: utils.lerp(airH1.x, ffH1.x, this.freeFallBlend),
            y: utils.lerp(airH1.y, ffH1.y, this.freeFallBlend),
          };
          airH2 = {
            x: utils.lerp(airH2.x, ffH2.x, this.freeFallBlend),
            y: utils.lerp(airH2.y, ffH2.y, this.freeFallBlend),
          };
        }

        hand1Local.x = utils.lerp(hand1Local.x, airH1.x, this.airBlend);
        hand1Local.y = utils.lerp(hand1Local.y, airH1.y, this.airBlend);
        hand2Local.x = utils.lerp(hand2Local.x, airH2.x, this.airBlend);
        hand2Local.y = utils.lerp(hand2Local.y, airH2.y, this.airBlend);
      }

      if (this.slideBlend > 0.05) {
        hand1Local.x = utils.lerp(hand1Local.x, -0.28, this.slideBlend);
        hand1Local.y = utils.lerp(hand1Local.y, -0.18, this.slideBlend);
        hand2Local.x = utils.lerp(hand2Local.x, 0.24, this.slideBlend);
        hand2Local.y = utils.lerp(hand2Local.y, 0.06, this.slideBlend);
      }

      if (this.dashTimer > 0) {
        hand1Local = { x: -0.36, y: -0.12 };
        hand2Local = { x: 0.34, y: -0.05 };
      }

      const arm1 = this._solveTwoBoneIK(
        frontShoulder.x,
        frontShoulder.y,
        frontShoulder.x + f * hand1Local.x,
        frontShoulder.y + hand1Local.y,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      const arm2 = this._solveTwoBoneIK(
        backShoulder.x,
        backShoulder.y,
        backShoulder.x + f * hand2Local.x,
        backShoulder.y + hand2Local.y,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );

      const footLen = CONFIG.FOOT_LEN;
      const pitchAtt = (1 - this.airBlend) * (1 - this.slideBlend) * (this.dashTimer > 0 ? 0 : 1);
      const p1 = (groundF1.toePitch || 0) * pitchAtt;
      const p2 = (groundF2.toePitch || 0) * pitchAtt;
      const toe1Y = this.grounded && !this.sliding && this.airBlend < 0.1
        ? Math.max(this.y, leg1.ey + Math.sin(p1) * footLen)
        : leg1.ey + Math.sin(p1) * footLen;
      const toe2Y = this.grounded && !this.sliding && this.airBlend < 0.1
        ? Math.max(this.y, leg2.ey + Math.sin(p2) * footLen)
        : leg2.ey + Math.sin(p2) * footLen;

      const pose = {
        facing: f,
        hip: { x: hipX, y: hipY },
        waist,
        frontHip,
        backHip,
        shoulder: { x: shoulderX, y: shoulderY },
        frontShoulder,
        backShoulder,
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: leg1.jx, y: leg1.jy },
        frontFoot: { x: leg1.ex, y: leg1.ey },
        frontToe: { x: leg1.ex + f * footLen * Math.cos(p1), y: toe1Y },
        backKnee: { x: leg2.jx, y: leg2.jy },
        backFoot: { x: leg2.ex, y: leg2.ey },
        backToe: { x: leg2.ex + f * footLen * Math.cos(p2), y: toe2Y },
        frontElbow: { x: arm1.jx, y: arm1.jy },
        frontHand: { x: arm1.ex, y: arm1.ey },
        backElbow: { x: arm2.jx, y: arm2.jy },
        backHand: { x: arm2.ex, y: arm2.ey },
      };

      if (this.flipTimer > 0) {
        const progress = 1 - this.flipTimer / this.flipDuration;
        const rotAngle = -this.flipDir * progress * Math.PI * 2;
        const cx = (hipX + shoulderX) * 0.5;
        const cy = (hipY + shoulderY) * 0.5;
        this._rotatePose(pose, cx, cy, rotAngle);
      }

      return pose;
    }

    _rotatePose(pose, cx, cy, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const keys = [
        'hip',
        'waist',
        'frontHip',
        'backHip',
        'shoulder',
        'frontShoulder',
        'backShoulder',
        'neck',
        'head',
        'frontKnee',
        'frontFoot',
        'frontToe',
        'backKnee',
        'backFoot',
        'backToe',
        'frontElbow',
        'frontHand',
        'backElbow',
        'backHand',
      ];
      for (const k of keys) {
        const pt = pose[k];
        if (!pt) continue;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        pt.x = cx + dx * cos - dy * sin;
        pt.y = cy + dx * sin + dy * cos;
      }
    }

    _getGlowSprite(key, c0, c1, c2) {
      let sprite = this._glowSprites.get(key);
      if (!sprite) {
        const size = 128;
        sprite = document.createElement('canvas');
        sprite.width = size;
        sprite.height = size;
        const gctx = sprite.getContext('2d');
        const half = size * 0.5;
        const grad = gctx.createRadialGradient(half, half, half * 0.04, half, half, half);
        grad.addColorStop(0, c0);
        grad.addColorStop(0.3, c1);
        grad.addColorStop(0.66, c2);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, size, size);
        this._glowSprites.set(key, sprite);
      }
      return sprite;
    }

    _drawTaperedSegment(ctx, x1, y1, x2, y2, r1, r2, rMid = null) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const sr1 = Math.max(0.5, r1);
      const sr2 = Math.max(0.5, r2);
      if (len < 0.5) {
        ctx.beginPath();
        ctx.arc(x1, y1, sr1, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const nx = -dy / len;
      const ny = dx / len;
      const ang = Math.atan2(dy, dx);
      const sMid = rMid !== null ? Math.max(0.5, rMid) : (sr1 + sr2) * 0.5;
      const mx = (x1 + x2) * 0.5;
      const my = (y1 + y2) * 0.5;
      ctx.beginPath();
      ctx.arc(x1, y1, sr1, ang + Math.PI * 0.5, ang - Math.PI * 0.5, false);
      if (rMid !== null) {
        ctx.quadraticCurveTo(mx + nx * sMid, my + ny * sMid, x2 + nx * sr2, y2 + ny * sr2);
      } else {
        ctx.lineTo(x2 + nx * sr2, y2 + ny * sr2);
      }
      ctx.arc(x2, y2, sr2, ang - Math.PI * 0.5, ang + Math.PI * 0.5, false);
      if (rMid !== null) {
        ctx.quadraticCurveTo(mx - nx * sMid, my - ny * sMid, x1 - nx * sr1, y1 - ny * sr1);
      }
      ctx.closePath();
      ctx.fill();
    }

    _drawLimb(ctx, p1, p2, p3, p4, width, color, gridRenderer, camera, isLeg = false, rimColor = null) {
      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const ppu = camera.ppu;

      const x1 = hw + (p1.x - cx) * ppu;
      const y1 = hh - (p1.y - cy) * ppu;
      const x2 = hw + (p2.x - cx) * ppu;
      const y2 = hh - (p2.y - cy) * ppu;
      const x3 = hw + (p3.x - cx) * ppu;
      const y3 = hh - (p3.y - cy) * ppu;

      const rRoot = width * (isLeg ? 0.64 : 0.54);
      const rUpperMid = width * (isLeg ? 0.61 : 0.51);
      const rMid = width * (isLeg ? 0.45 : 0.39);
      const rLowerMid = width * (isLeg ? 0.53 : 0.45);
      const rTip = width * (isLeg ? 0.32 : 0.29);

      ctx.fillStyle = color;
      this._drawTaperedSegment(ctx, x1, y1, x2, y2, rRoot, rMid, rUpperMid);
      this._drawTaperedSegment(ctx, x2, y2, x3, y3, rMid, rTip, rLowerMid);

      // Subtle sculpted joint cap
      ctx.beginPath();
      ctx.arc(x2, y2, Math.max(0.8, rMid * 1.04), 0, Math.PI * 2);
      ctx.fill();

      if (rimColor && ppu >= 22) {
        ctx.save();
        ctx.strokeStyle = rimColor;
        ctx.globalAlpha *= 0.28;
        ctx.lineWidth = Math.max(1.0, width * 0.16);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
        ctx.restore();
      }

      if (p4) {
        // Articulated Alan-Becker style shoe silhouette with heel & pitched toe
        const x4 = hw + (p4.x - cx) * ppu;
        const y4 = hh - (p4.y - cy) * ppu;
        const fdx = x4 - x3;
        const fdy = y4 - y3;
        const flen = Math.hypot(fdx, fdy) || 1;
        const ux = fdx / flen;
        const uy = fdy / flen;
        const fnx = -uy;
        const fny = ux;
        const heelX = x3 - ux * rTip * 0.55;
        const heelY = y3 - uy * rTip * 0.55;
        const midArchX = (x3 + x4) * 0.52;
        const midArchY = (y3 + y4) * 0.52;
        const toeTipX = x4 + ux * rTip * 0.72;
        const toeTipY = y4 + uy * rTip * 0.72;

        ctx.beginPath();
        ctx.moveTo(heelX + fnx * rTip * 1.08, heelY + fny * rTip * 1.08);
        ctx.quadraticCurveTo(
          midArchX + fnx * rTip * 0.95,
          midArchY + fny * rTip * 0.95,
          toeTipX,
          toeTipY
        );
        ctx.quadraticCurveTo(
          midArchX - fnx * rTip * 0.58,
          midArchY - fny * rTip * 0.58,
          heelX - fnx * rTip * 0.92,
          heelY - fny * rTip * 0.92
        );
        ctx.arc(heelX, heelY, Math.max(0.8, rTip * 0.95), Math.atan2(-fny, -fnx), Math.atan2(fny, fnx), false);
        ctx.closePath();
        ctx.fill();
      } else {
        // Sculpted forearm wrist + gripping/bladed martial hand silhouette
        const hdx = x3 - x2;
        const hdy = y3 - y2;
        const hlen = Math.hypot(hdx, hdy) || 1;
        const ux = hdx / hlen;
        const uy = hdy / hlen;
        const fistLen = Math.max(3.2, ppu * 0.056);
        const midX = x3 + ux * fistLen * 0.45;
        const midY = y3 + uy * fistLen * 0.45;
        const tipX = x3 + ux * fistLen;
        const tipY = y3 + uy * fistLen;
        this._drawTaperedSegment(ctx, x3, y3, midX, midY, rTip * 1.02, rTip * 1.24, rTip * 1.2);
        this._drawTaperedSegment(ctx, midX, midY, tipX, tipY, rTip * 1.22, rTip * 0.56);
      }
    }

    _drawScarf(ctx, pose, camera, gridRenderer, accentColor, isGhost) {
      if (isGhost || !this.scarfChain || this.scarfChain.length < 3) return;
      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const ppu = camera.ppu;
      const chain = this.scarfChain;
      const n = chain.length;

      if (this._scarfPtsX.length < n) {
        this._scarfPtsX = new Float64Array(n);
        this._scarfPtsY = new Float64Array(n);
      }
      const ptsX = this._scarfPtsX;
      const ptsY = this._scarfPtsY;
      for (let i = 0; i < n; i++) {
        ptsX[i] = hw + (chain[i].x - cx) * ppu;
        ptsY[i] = hh - (chain[i].y - cy) * ppu;
      }

      // Soft aura outer pass
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = Math.max(4, ppu * 0.11);
      ctx.beginPath();
      ctx.moveTo(ptsX[0], ptsY[0]);
      for (let i = 1; i < n - 1; i++) {
        const mx = (ptsX[i] + ptsX[i + 1]) * 0.5;
        const my = (ptsY[i] + ptsY[i + 1]) * 0.5;
        ctx.quadraticCurveTo(ptsX[i], ptsY[i], mx, my);
      }
      ctx.lineTo(ptsX[n - 1], ptsY[n - 1]);
      ctx.stroke();

      // Sleek tapered core ribbon
      ctx.fillStyle = accentColor;
      for (let i = 0; i < n - 1; i++) {
        const r1 = Math.max(1.2, ppu * 0.044 * (1 - i / n));
        const r2 = Math.max(0.6, ppu * 0.044 * (1 - (i + 1) / n));
        ctx.globalAlpha = 0.92 * (1 - i * 0.11);
        this._drawTaperedSegment(ctx, ptsX[i], ptsY[i], ptsX[i + 1], ptsY[i + 1], r1, r2);
      }
      ctx.restore();
    }

    _drawVerletCoatFlaps(ctx, pose, camera, gridRenderer, spec, coatFill, edgeColor, isBlack) {
      if (!pose || !pose.hip) return;
      if (!this.coatLeftVerlet && !this.coatRightVerlet) return;
      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const ppu = camera.ppu;
      const isBenimaru = spec && spec.id === 'benimaru' && !this.dancing;

      const drawChain = (verlet, frontLayer) => {
        if (!verlet || !verlet.nodes || verlet.nodes.length < 3) return;
        const nodes = verlet.nodes;
        if (Math.hypot(nodes[0].x - pose.hip.x, nodes[0].y - pose.hip.y) > 1.8) return;

        const n = nodes.length;
        const sx = [];
        const sy = [];
        for (let i = 0; i < n; i++) {
          sx.push(hw + (nodes[i].x - cx) * ppu);
          sy.push(hh - (nodes[i].y - cy) * ppu);
        }

        const leftX = [];
        const leftY = [];
        const rightX = [];
        const rightY = [];
        for (let i = 0; i < n; i++) {
          const iPrev = Math.max(0, i - 1);
          const iNext = Math.min(n - 1, i + 1);
          let dx = sx[iNext] - sx[iPrev];
          let dy = sy[iNext] - sy[iPrev];
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
          const nx = -dy;
          const ny = dx;
          const t = i / (n - 1);
          const halfW = ppu * (0.046 + t * (isBenimaru ? 0.088 : 0.068));
          leftX.push(sx[i] + nx * halfW);
          leftY.push(sy[i] + ny * halfW);
          rightX.push(sx[i] - nx * halfW);
          rightY.push(sy[i] - ny * halfW);
        }

        ctx.save();
        ctx.globalAlpha *= frontLayer ? 0.95 : 0.78;
        ctx.fillStyle = coatFill;
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = Math.max(1.2, ppu * (isBenimaru ? 0.025 : 0.018));
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(leftX[0], leftY[0]);
        for (let i = 1; i < n - 1; i++) {
          const mx = (leftX[i] + leftX[i + 1]) * 0.5;
          const my = (leftY[i] + leftY[i + 1]) * 0.5;
          ctx.quadraticCurveTo(leftX[i], leftY[i], mx, my);
        }
        ctx.lineTo(leftX[n - 1], leftY[n - 1]);
        ctx.lineTo(
          sx[n - 1] + (sx[n - 1] - sx[n - 2]) * 0.22,
          sy[n - 1] + (sy[n - 1] - sy[n - 2]) * 0.22
        );
        ctx.lineTo(rightX[n - 1], rightY[n - 1]);
        for (let i = n - 2; i >= 1; i--) {
          const mx = (rightX[i] + rightX[i - 1]) * 0.5;
          const my = (rightY[i] + rightY[i - 1]) * 0.5;
          ctx.quadraticCurveTo(rightX[i], rightY[i], mx, my);
        }
        ctx.lineTo(rightX[0], rightY[0]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Benimaru haori ember/gold seam near hem
        if (isBenimaru && frontLayer && ppu >= 20) {
          ctx.strokeStyle = isBlack ? '#fbbf24' : '#f59e0b';
          ctx.lineWidth = Math.max(1.0, ppu * 0.016);
          ctx.beginPath();
          ctx.moveTo(leftX[n - 2], leftY[n - 2]);
          ctx.lineTo(rightX[n - 2], rightY[n - 2]);
          ctx.stroke();
        }
        ctx.restore();
      };

      drawChain(this.coatLeftVerlet, false);
      drawChain(this.coatRightVerlet, true);
    }

    _drawTojiCursedWorm(ctx, pose, sShX, sShY, sHipX, sHipY, shHalf, hpHalf, px, py, ppu) {
      const f = pose.facing || 1;
      const sx = pose.frontFacing ? sShX - shHalf * 0.72 : sShX - px * f * shHalf * 0.78;
      const sy = pose.frontFacing ? sShY - ppu * 0.02 : sShY - py * f * shHalf * 0.78;
      const hx = pose.frontFacing ? sHipX + hpHalf * 0.85 : sHipX + px * f * hpHalf * 0.92;
      const hy = pose.frontFacing ? sHipY - ppu * 0.01 : sHipY + py * f * hpHalf * 0.92;
      const ctrlX = (sx + hx) * 0.5 + f * ppu * 0.03;
      const ctrlY = (sy + hy) * 0.5 + ppu * 0.03;

      ctx.save();
      const segs = 7;
      const segR = Math.max(2.6, ppu * 0.044);
      for (let i = segs; i >= 0; i--) {
        const t = i / segs;
        const omt = 1 - t;
        const bx = omt * omt * sx + 2 * omt * t * ctrlX + t * t * hx;
        const by = omt * omt * sy + 2 * omt * t * ctrlY + t * t * hy;
        const r = segR * (1 - t * 0.28);
        ctx.fillStyle = i % 2 === 0 ? '#7e22ce' : '#9333ea';
        ctx.strokeStyle = '#d8b4fe';
        ctx.lineWidth = Math.max(0.8, ppu * 0.012);
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
        if (i % 2 === 0) ctx.stroke();
      }

      // Iconic purple worm head perched by shoulder
      const wHeadX = sx - f * ppu * 0.02;
      const wHeadY = sy - ppu * 0.03 + Math.sin(this.idleTime * 5.2) * 1.4;
      const hrX = Math.max(3.2, segR * 1.28);
      const hrY = Math.max(2.5, segR * 0.95);
      ctx.fillStyle = '#a855f7';
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = Math.max(1.0, ppu * 0.014);
      ctx.beginPath();
      ctx.ellipse(wHeadX, wHeadY, hrX, hrY, -f * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tiny gleaming worm eyes
      if (hrX >= 3.5) {
        ctx.fillStyle = '#f8fafc';
        const eyeOff = f * hrX * 0.32;
        ctx.beginPath();
        ctx.arc(wHeadX + eyeOff, wHeadY - hrY * 0.25, Math.max(0.9, hrX * 0.22), 0, Math.PI * 2);
        ctx.arc(wHeadX + eyeOff * 0.35, wHeadY + hrY * 0.15, Math.max(0.8, hrX * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _renderWeaponSmearTrails(ctx, camera, gridRenderer, theme) {
      if (!this._weaponTrail || this._weaponTrail.length < 2) return;
      const isBlack = !theme || theme.bg === '#000000';
      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const ppu = camera.ppu;

      const drawStream = (samples) => {
        if (samples.length < 2) return;
        const pts = samples.map((s) => ({
          strokeId: s.strokeId,
          tx: hw + (s.tx - cx) * ppu,
          ty: hh - (s.ty - cy) * ppu,
          bx: hw + (s.bx - cx) * ppu,
          by: hh - (s.by - cy) * ppu,
          ratio: utils.clamp(s.life / Math.max(0.01, s.maxLife), 0, 1),
          col: isBlack ? s.colorBlack : s.colorLight,
        }));

        ctx.save();
        if (isBlack) ctx.globalCompositeOperation = 'lighter';
        const maxJumpPx = Math.max(ppu * 1.15, 72);
        const spans = [];
        let curSpan = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const jump = Math.hypot(curr.tx - prev.tx, curr.ty - prev.ty);
          if (curr.strokeId !== prev.strokeId || jump > maxJumpPx) {
            if (curSpan.length >= 2) spans.push(curSpan);
            curSpan = [curr];
          } else {
            curSpan.push(curr);
          }
        }
        if (curSpan.length >= 2) spans.push(curSpan);

        for (const span of spans) {
          for (let i = 0; i < span.length - 1; i++) {
            const a = span[i];
            const b = span[i + 1];
            const alpha = Math.min(a.ratio, b.ratio) * (isBlack ? 0.5 : 0.36);
            if (alpha <= 0.02) continue;
            ctx.fillStyle = b.col;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(a.bx, a.by);
            ctx.lineTo(a.tx, a.ty);
            ctx.lineTo(b.tx, b.ty);
            ctx.lineTo(b.bx, b.by);
            ctx.closePath();
            ctx.fill();
          }

          // Razor-crisp bright slash tip spline
          const last = span[span.length - 1];
          ctx.strokeStyle = isBlack ? '#ffffff' : last.col;
          ctx.globalAlpha = utils.clamp(last.ratio * 0.88, 0, 0.9);
          ctx.lineWidth = Math.max(1.8, ppu * 0.036);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(span[0].tx, span[0].ty);
          for (let i = 1; i < span.length - 1; i++) {
            const mx = (span[i].tx + span[i + 1].tx) * 0.5;
            const my = (span[i].ty + span[i + 1].ty) * 0.5;
            ctx.quadraticCurveTo(span[i].tx, span[i].ty, mx, my);
          }
          ctx.lineTo(last.tx, last.ty);
          ctx.stroke();
        }
        ctx.restore();
      };

      const mainSamples = [];
      const offSamples = [];
      for (const s of this._weaponTrail) {
        if (s.trailId === 'off') offSamples.push(s);
        else mainSamples.push(s);
      }
      drawStream(mainSamples);
      drawStream(offSamples);
    }

    _drawHakamaLeg(ctx, p1, p2, p3, p4, width, clothColor, shoeColor, rimColor, gridRenderer, camera, isBack) {
      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const ppu = camera.ppu;

      const x1 = hw + (p1.x - cx) * ppu;
      const y1 = hh - (p1.y - cy) * ppu;
      const x2 = hw + (p2.x - cx) * ppu;
      const y2 = hh - (p2.y - cy) * ppu;
      const x3 = hw + (p3.x - cx) * ppu;
      const y3 = hh - (p3.y - cy) * ppu;

      const rRoot = width * 1.05;
      const rKnee = width * 1.65;
      const rAnkle = width * 1.32;

      ctx.fillStyle = clothColor;
      this._drawTaperedSegment(ctx, x1, y1, x2, y2, rRoot, rKnee, width * 1.46);
      this._drawTaperedSegment(ctx, x2, y2, x3, y3, rKnee, rAnkle, width * 1.56);

      if (rimColor) {
        ctx.save();
        ctx.strokeStyle = rimColor;
        ctx.globalAlpha *= isBack ? 0.34 : 0.62;
        ctx.lineWidth = Math.max(1.1, ppu * 0.018);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(x2, y2, x3, y3);
        ctx.stroke();
        ctx.restore();
      }

      if (p4) {
        const x4 = hw + (p4.x - cx) * ppu;
        const y4 = hh - (p4.y - cy) * ppu;
        const fdx = x4 - x3;
        const fdy = y4 - y3;
        const flen = Math.hypot(fdx, fdy) || 1;
        const fnx = -fdy / flen;
        const fny = fdx / flen;
        const rTip = width * 0.42;
        ctx.fillStyle = shoeColor;
        ctx.beginPath();
        ctx.arc(x3, y3, Math.max(0.8, rTip * 1.15), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x3 + fnx * rTip * 1.05, y3 + fny * rTip * 1.05);
        ctx.lineTo(x4 + (fdx / flen) * rTip * 0.65, y4 + (fdy / flen) * rTip * 0.65);
        ctx.lineTo(x3 - fnx * rTip * 0.9, y3 - fny * rTip * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }

    _drawHairSpikes(ctx, sHeadX, sHeadY, sNkX, sNkY, headPx, pose, spec, primaryColor, accentColor, isBlack, ppu = 50) {
      if (!spec || !spec.hairColor) return;
      const f = pose.facing || 1;
      let upX = sHeadX - sNkX;
      let upY = sHeadY - sNkY;
      const upLen = Math.hypot(upX, upY);
      if (upLen > 1) {
        upX /= upLen;
        upY /= upLen;
      } else {
        upX = 0;
        upY = -1;
      }
      // Forward axis orthogonal to head's upward vector (Screen Y points DOWN)
      const rx = -upY * f;
      const ry = upX * f;
      const windPush = utils.clamp(-this.vx * f * 0.04, -0.35, 0.45) + 0.08 * Math.sin(this.idleTime * 7.5);

      // Dynamic Verlet lock tip displacement relative to scalp root (zero static rest offset)
      const getVerletTipDelta = (chain, restLocalX, restLocalY) => {
        if (!chain || !chain.nodes || chain.nodes.length < 2 || !chain.tip || !pose.head) {
          return { dx: 0, dy: 0 };
        }
        const root = chain.nodes[0];
        const tip = chain.tip;
        const rLen = Math.hypot(restLocalX, restLocalY) || 1;
        const totalL = chain.totalLength || 0.2;
        const restX = (restLocalX / rLen) * totalL * ppu;
        const restY = (restLocalY / rLen) * totalL * ppu;
        const actX = (tip.x - root.x) * ppu;
        const actY = -(tip.y - root.y) * ppu;
        const maxD = headPx * 0.72;
        return {
          dx: utils.clamp((actX - restX) * 0.65, -maxD, maxD),
          dy: utils.clamp((actY - restY) * 0.65, -maxD, maxD),
        };
      };

      const dBack = this.hairVerlet
        ? getVerletTipDelta(this.hairVerlet.back, (-rx * 0.82 + upX * 0.45), (-ry * 0.82 + upY * 0.45))
        : { dx: 0, dy: 0 };
      const dTop = this.hairVerlet
        ? getVerletTipDelta(this.hairVerlet.top, (upX * 0.92 - rx * 0.22), (upY * 0.92 - ry * 0.22))
        : { dx: 0, dy: 0 };
      const dBang = this.hairVerlet
        ? getVerletTipDelta(this.hairVerlet.bang, (rx * 0.84 - upX * 0.42), (ry * 0.84 - upY * 0.42))
        : { dx: 0, dy: 0 };

      const drawSpike = (baseFwd, baseUp, tipFwd, tipUp, halfW, fillCol, tipAccent = null, zone = 'top') => {
        const bCx = sHeadX + (rx * baseFwd + upX * baseUp) * headPx;
        const bCy = sHeadY + (ry * baseFwd + upY * baseUp) * headPx;
        const vd = zone === 'back' ? dBack : zone === 'bang' ? dBang : dTop;
        const tX = sHeadX + (rx * (tipFwd - windPush * 0.35) + upX * tipUp) * headPx + vd.dx * 0.65;
        const tY = sHeadY + (ry * (tipFwd - windPush * 0.35) + upY * tipUp) * headPx + vd.dy * 0.65;
        const e1x = bCx - upX * halfW * headPx * 0.5 + rx * halfW * headPx * 0.65;
        const e1y = bCy - upY * halfW * headPx * 0.5 + ry * halfW * headPx * 0.65;
        const e2x = bCx + upX * halfW * headPx * 0.5 - rx * halfW * headPx * 0.65;
        const e2y = bCy + upY * halfW * headPx * 0.5 - ry * halfW * headPx * 0.65;
        const c1x = (e1x + tX) * 0.5 - rx * headPx * 0.08;
        const c1y = (e1y + tY) * 0.5 - upY * headPx * 0.06;
        const c2x = (e2x + tX) * 0.5 + rx * headPx * 0.06;
        const c2y = (e2y + tY) * 0.5 - upY * headPx * 0.06;

        ctx.fillStyle = fillCol;
        ctx.beginPath();
        ctx.moveTo(e1x, e1y);
        ctx.quadraticCurveTo(c1x, c1y, tX, tY);
        ctx.quadraticCurveTo(c2x, c2y, e2x, e2y);
        ctx.closePath();
        ctx.fill();
        if (tipAccent) {
          ctx.strokeStyle = tipAccent;
          ctx.lineWidth = Math.max(1.0, headPx * 0.11);
          ctx.beginPath();
          ctx.moveTo((bCx + tX) * 0.5, (bCy + tY) * 0.5);
          ctx.lineTo(tX, tY);
          ctx.stroke();
        }
      };

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const darkRim = isBlack ? '#64748b' : '#0f172a';

      if (spec.id === 'gojo') {
        // Gojo Satoru layered spiky white crown + Verlet responsive tips
        drawSpike(-0.62, 0.55, -1.42, 0.92, 0.44, spec.hairTipColor || '#94a3b8', null, 'back');
        drawSpike(-0.25, 0.78, -0.78, 1.56, 0.48, spec.hairColor, null, 'back');
        drawSpike(0.15, 0.82, -0.18, 1.74, 0.52, spec.hairColor, '#e0f2fe', 'top');
        drawSpike(0.55, 0.66, 0.52, 1.5, 0.44, spec.hairColor, null, 'top');
        drawSpike(0.78, 0.35, 1.15, 0.88, 0.34, spec.hairTipColor || '#cbd5e1', null, 'bang');
      } else if (spec.id === 'toji') {
        // Toji Fushiguro sharp dark swept locks + iconic forehead bang
        const fillC = isBlack ? '#1e293b' : '#09090b';
        drawSpike(-0.68, 0.42, -1.42, 0.65, 0.4, fillC, darkRim, 'back');
        drawSpike(-0.2, 0.78, -0.78, 1.24, 0.48, fillC, darkRim, 'back');
        drawSpike(0.26, 0.76, -0.18, 1.28, 0.46, fillC, darkRim, 'top');
        drawSpike(0.66, 0.52, 1.08, 0.25, 0.3, fillC, '#34d399', 'bang');
        drawSpike(0.75, 0.25, 0.96, -0.18, 0.22, fillC, '#34d399', 'bang');
      } else if (spec.id === 'benimaru') {
        // Benimaru Shinmon spiky black warrior hair with crimson flame tips
        const fillC = isBlack ? '#1e1b26' : '#18181b';
        drawSpike(-0.66, 0.45, -1.48, 0.85, 0.44, fillC, spec.hairTipColor || '#ef4444', 'back');
        drawSpike(-0.22, 0.76, -0.82, 1.48, 0.48, fillC, spec.hairTipColor || '#ef4444', 'back');
        drawSpike(0.2, 0.82, 0.02, 1.58, 0.5, fillC, '#fb7185', 'top');
        drawSpike(0.62, 0.62, 1.05, 1.05, 0.38, fillC, '#fde047', 'top');
        drawSpike(0.78, 0.28, 1.04, 0.08, 0.26, fillC, spec.hairTipColor || '#ef4444', 'bang');
      }

      ctx.restore();
    }

    _drawThrowSpear(ctx, handWorld, spearInfo, camera, gridRenderer, theme) {
      const sp = gridRenderer.worldToScreen(handWorld.x, handWorld.y, camera);
      const ppu = camera.ppu;
      const lenPx = Math.max(36, ppu * 0.95);
      const col = (theme && theme.vecLaunched) || '#f59e0b';
      const screenAng = -spearInfo.angle;

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(screenAng);

      // Halo glow around condensed thrown vector spear
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.36;
      ctx.lineWidth = Math.max(7, ppu * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-lenPx * 0.48, 0);
      ctx.lineTo(lenPx * 0.65, 0);
      ctx.stroke();

      ctx.globalAlpha = 0.98;
      ctx.lineWidth = Math.max(3, ppu * 0.052);
      ctx.beginPath();
      ctx.moveTo(-lenPx * 0.48, 0);
      ctx.lineTo(lenPx * 0.62, 0);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, ppu * 0.02);
      ctx.beginPath();
      ctx.moveTo(-lenPx * 0.42, 0);
      ctx.lineTo(lenPx * 0.6, 0);
      ctx.stroke();

      // Razor arrowhead at tip
      const headS = Math.max(9, ppu * 0.16);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(lenPx * 0.72, 0);
      ctx.lineTo(lenPx * 0.46, -headS * 0.42);
      ctx.lineTo(lenPx * 0.54, 0);
      ctx.lineTo(lenPx * 0.46, headS * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    _drawHeldWeapon(ctx, handWorld, worldAngle, weaponSpec, camera, gridRenderer, isBlack, isOffhand = false) {
      if (!handWorld || !weaponSpec) return;
      const sp = gridRenderer.worldToScreen(handWorld.x, handWorld.y, camera);
      const ppu = camera.ppu;
      const col = isBlack ? weaponSpec.colorBlack : weaponSpec.colorLight;
      const screenAng = -worldAngle;
      const scale = isOffhand ? 0.82 : 1.0;

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(screenAng);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (weaponSpec.id === 'diff') {
        // Holographic Differential Katana (d/dx)
        const bladeLen = Math.max(30, ppu * 0.86 * scale);
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.34;
        ctx.lineWidth = Math.max(6, ppu * 0.11);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(bladeLen * 0.55, -bladeLen * 0.08, bladeLen, -bladeLen * 0.03);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(3, ppu * 0.048);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.3, ppu * 0.02);
        ctx.beginPath();
        ctx.moveTo(bladeLen * 0.08, -0.5);
        ctx.quadraticCurveTo(bladeLen * 0.55, -bladeLen * 0.08, bladeLen, -bladeLen * 0.03);
        ctx.stroke();

        // Handle & Tsuba handguard
        ctx.strokeStyle = isBlack ? '#cbd5e1' : '#334155';
        ctx.lineWidth = Math.max(2.4, ppu * 0.045);
        ctx.beginPath();
        ctx.moveTo(-bladeLen * 0.2, 0);
        ctx.lineTo(0, 0);
        ctx.moveTo(1, -ppu * 0.07);
        ctx.lineTo(1, ppu * 0.07);
        ctx.stroke();
      } else if (weaponSpec.id === 'integ') {
        // Heavy Integral Broadsword (∫ dx)
        const bladeLen = Math.max(34, ppu * 0.96 * scale);
        const halfW = Math.max(3.5, ppu * 0.068);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.ellipse(bladeLen * 0.48, 0, bladeLen * 0.55, halfW * 1.9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.1, ppu * 0.018);
        ctx.beginPath();
        ctx.moveTo(0, -halfW * 0.72);
        ctx.lineTo(bladeLen * 0.82, -halfW);
        ctx.lineTo(bladeLen, 0);
        ctx.lineTo(bladeLen * 0.82, halfW);
        ctx.lineTo(0, halfW * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crossguard & pommel
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = Math.max(2.6, ppu * 0.045);
        ctx.beginPath();
        ctx.moveTo(-bladeLen * 0.22, 0);
        ctx.lineTo(0, 0);
        ctx.moveTo(0, -halfW * 1.6);
        ctx.lineTo(0, halfW * 1.6);
        ctx.stroke();
      } else if (weaponSpec.id === 'negate') {
        // Assassin Twin-Blades (-f(x))
        const bladeLen = Math.max(24, ppu * 0.64 * scale);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, ppu * 0.016);
        ctx.beginPath();
        ctx.moveTo(0, -ppu * 0.03);
        ctx.lineTo(bladeLen * 0.65, -ppu * 0.055);
        ctx.lineTo(bladeLen, 0);
        ctx.lineTo(bladeLen * 0.55, ppu * 0.032);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, ppu * 0.034);
        ctx.beginPath();
        ctx.moveTo(-bladeLen * 0.25, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
      } else {
        // Vector Thrust Spear (-v⃗ / ⊥)
        const shaftBack = Math.max(14, ppu * 0.34);
        const bladeLen = Math.max(38, ppu * 1.05 * scale);
        ctx.strokeStyle = isBlack ? '#e2e8f0' : '#334155';
        ctx.lineWidth = Math.max(2.4, ppu * 0.038);
        ctx.beginPath();
        ctx.moveTo(-shaftBack, 0);
        ctx.lineTo(bladeLen * 0.72, 0);
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.1, ppu * 0.018);
        ctx.beginPath();
        ctx.moveTo(bladeLen * 0.66, -ppu * 0.068);
        ctx.lineTo(bladeLen * 1.08, 0);
        ctx.lineTo(bladeLen * 0.66, ppu * 0.068);
        ctx.lineTo(bladeLen * 0.74, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawParryShield(ctx, pose, camera, gridRenderer) {
      const f = pose.facing || 1;
      const sx = gridRenderer.worldToScreen(pose.shoulder.x + f * 0.38, pose.shoulder.y + 0.06, camera);
      const r = Math.max(18, camera.ppu * 0.48);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#38bdf8';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(4, camera.ppu * 0.075);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (f >= 0) ctx.arc(sx.x - r * 0.25, sx.y, r, -1.05, 1.05);
      else ctx.arc(sx.x + r * 0.25, sx.y, r, Math.PI - 1.05, Math.PI + 1.05);
      ctx.stroke();

      ctx.strokeStyle = '#fde047';
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = Math.max(1.8, camera.ppu * 0.03);
      ctx.stroke();
      ctx.restore();
    }

    renderPose(ctx, pose, camera, gridRenderer, primaryColor, secondaryColor, eyeColor, alpha = 1, theme = null) {
      const ppu = camera.ppu;
      const torsoWidth = Math.max(2.6, ppu * 0.088);
      const limbWidth = Math.max(2.2, ppu * 0.072);
      const isGhost = eyeColor === null;
      const isBlack = !theme || theme.bg === '#000000';
      const spec = this.getCharacterStyleSpec();

      const fHip = pose.frontHip || pose.hip;
      const bHip = pose.backHip || pose.hip;
      const fShoulder = pose.frontShoulder || pose.shoulder;
      const bShoulder = pose.backShoulder || pose.shoulder;
      const backColor = isGhost ? secondaryColor : isBlack ? '#64748b' : '#475569';

      let accentColor = isBlack ? (spec.accentBlack || '#38bdf8') : (spec.accentLight || '#2563eb');
      if (pose.auraStyle === 'gold') accentColor = '#fde047';
      else if (pose.auraStyle === 'purple') accentColor = '#c084fc';
      else if (pose.auraStyle === 'emerald') accentColor = '#34d399';
      else if (pose.auraStyle === 'crimson') accentColor = '#fb7185';
      else if (pose.auraStyle === 'amber') accentColor = '#f59e0b';
      else if (pose.auraStyle === 'cyan') accentColor = '#38bdf8';

      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const sHipX = hw + (pose.hip.x - cx) * ppu;
      const sHipY = hh - (pose.hip.y - cy) * ppu;
      const sWaistX = pose.waist ? hw + (pose.waist.x - cx) * ppu : (sHipX + hw + (pose.shoulder.x - cx) * ppu) * 0.5;
      const sWaistY = pose.waist ? hh - (pose.waist.y - cy) * ppu : (sHipY + hh - (pose.shoulder.y - cy) * ppu) * 0.5;
      const sShX = hw + (pose.shoulder.x - cx) * ppu;
      const sShY = hh - (pose.shoulder.y - cy) * ppu;
      const sNkX = hw + (pose.neck.x - cx) * ppu;
      const sNkY = hh - (pose.neck.y - cy) * ppu;
      const limbRim = null;

      ctx.save();
      ctx.globalAlpha = alpha;

      // 1. Warrior / Cursed Energy Aura Halo (zero shadowBlur!)
      if (!isGhost && pose.auraStyle) {
        const bodyMidX = sWaistX;
        const bodyMidY = sWaistY;
        const softMult = pose.auraSoft ? 0.55 : 1.0;
        let glowSprite;
        if (pose.auraStyle === 'gold') {
          glowSprite = this._getGlowSprite(
            'aura_gold',
            'rgba(254, 240, 138, 0.30)',
            'rgba(125, 211, 252, 0.14)',
            'rgba(250, 204, 21, 0.04)'
          );
        } else if (pose.auraStyle === 'purple') {
          glowSprite = this._getGlowSprite(
            'aura_purple',
            'rgba(216, 180, 254, 0.36)',
            'rgba(168, 85, 247, 0.18)',
            'rgba(126, 34, 206, 0.05)'
          );
        } else if (pose.auraStyle === 'emerald') {
          glowSprite = this._getGlowSprite(
            'aura_emerald',
            'rgba(110, 231, 183, 0.32)',
            'rgba(52, 211, 153, 0.15)',
            'rgba(16, 185, 129, 0.04)'
          );
        } else if (pose.auraStyle === 'crimson') {
          glowSprite = this._getGlowSprite(
            'aura_crimson',
            'rgba(253, 164, 175, 0.32)',
            'rgba(239, 68, 68, 0.16)',
            'rgba(220, 38, 38, 0.04)'
          );
        } else if (pose.auraStyle === 'amber') {
          glowSprite = this._getGlowSprite(
            'aura_amber',
            'rgba(253, 224, 71, 0.30)',
            'rgba(245, 158, 11, 0.15)',
            'rgba(217, 119, 6, 0.04)'
          );
        } else {
          glowSprite = this._getGlowSprite(
            'aura_cyan',
            'rgba(125, 211, 252, 0.32)',
            'rgba(56, 189, 248, 0.15)',
            'rgba(14, 165, 233, 0.04)'
          );
        }
        const auraR = ppu * (pose.auraSoft ? 0.95 : 1.18);
        ctx.save();
        if (isBlack) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= softMult;
        ctx.drawImage(glowSprite, bodyMidX - auraR, bodyMidY - auraR, auraR * 2, auraR * 2);

        // Crisp shimmering energy rim along curved spine & head
        const sHd = { x: hw + (pose.head.x - cx) * ppu, y: hh - (pose.head.y - cy) * ppu };
        const pulseW = torsoWidth * (2.15 + 0.25 * Math.sin(this.idleTime * 9));
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.22 * softMult;
        ctx.lineWidth = pulseW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sHipX, sHipY);
        ctx.quadraticCurveTo(sWaistX, sWaistY, sShX, sShY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sHd.x, sHd.y, Math.max(4, pose.headRadius * ppu) * 1.32, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.16 * softMult;
        ctx.fill();
        ctx.restore();
      }

      // 2. Back Scarf Layer tinted to style or active dance
      let scarfColor = isBlack ? (spec.scarfBlack || accentColor) : (spec.scarfLight || accentColor);
      if (this.dancing && pose.auraStyle === 'gold') scarfColor = '#fde047';
      else if (this.dancing && pose.auraStyle === 'purple') scarfColor = '#c084fc';
      this._drawScarf(ctx, pose, camera, gridRenderer, scarfColor, isGhost);

      // 3. Background Limbs (wide flared hakama legs for Toji & Benimaru!)
      this._drawLimb(
        ctx,
        bShoulder,
        pose.backElbow,
        pose.backHand,
        null,
        pose.frontFacing ? limbWidth : limbWidth * 0.94,
        backColor,
        gridRenderer,
        camera,
        false,
        limbRim
      );
      if (!isGhost && !this.dancing && spec.hakamaBlack) {
        const hakBack = isBlack ? '#0f172a' : '#334155';
        this._drawHakamaLeg(
          ctx,
          bHip,
          pose.backKnee,
          pose.backFoot,
          pose.backToe,
          limbWidth,
          hakBack,
          backColor,
          isBlack ? '#475569' : '#1e293b',
          gridRenderer,
          camera,
          true
        );
      } else {
        this._drawLimb(
          ctx,
          bHip,
          pose.backKnee,
          pose.backFoot,
          pose.backToe,
          pose.frontFacing ? limbWidth : limbWidth * 0.96,
          backColor,
          gridRenderer,
          camera,
          true,
          limbRim
        );
      }

      // Optional Off-hand Blade for Twin-Blades (-f(x)) before torso
      const combatW = !isGhost && !pose.throwingSpear ? pose.combatWeapon : null;
      if (combatW && combatW.id === 'negate' && pose.backHand) {
        const f = pose.facing || 1;
        const offDefAng = pose.offWeaponWorldAngle !== undefined
          ? pose.offWeaponWorldAngle
          : (f > 0 ? Math.PI - 0.52 : 0.52);
        this._drawHeldWeapon(ctx, pose.backHand, offDefAng, combatW, camera, gridRenderer, isBlack, true);
      }

      // 4. Sculpted Curved-Spine Warrior Coat / Haori / Alan Silhouette Torso
      if (!isGhost && pose.coatStyle !== false) {
        const spDx = sShX - sHipX;
        const spDy = sShY - sHipY;
        const spLen = Math.hypot(spDx, spDy) || 1;
        const ux = spDx / spLen;
        const uy = spDy / spLen;
        const px = -uy;
        const py = ux;

        const isToji = spec.id === 'toji' && !this.dancing;
        const isBenimaru = spec.id === 'benimaru' && !this.dancing;
        const shHalf = pose.frontFacing
          ? ppu * 0.132
          : isBenimaru
            ? ppu * 0.105
            : isToji
              ? ppu * 0.095
              : ppu * 0.09;
        const waistHalf = (shHalf + ppu * 0.056) * 0.44;
        const hpHalf = pose.frontFacing
          ? ppu * 0.084
          : isToji
            ? ppu * 0.052
            : isBenimaru
              ? ppu * 0.072
              : ppu * 0.058;
        const hemExt = isToji ? ppu * 0.025 : isBenimaru ? ppu * 0.085 : ppu * 0.06;
        const coatFill = isBlack ? (spec.coatBlack || '#0b101d') : (spec.coatLight || '#0f172a');

        if (!isToji && spec.id !== 'animator') {
          const edgeCol = isBenimaru ? (spec.trimColor || '#ef4444') : accentColor;
          this._drawVerletCoatFlaps(ctx, pose, camera, gridRenderer, spec, coatFill, edgeCol, isBlack);
        }

        ctx.fillStyle = coatFill;
        ctx.strokeStyle = isToji
          ? (isBlack ? '#475569' : '#0f172a')
          : isBenimaru
            ? (spec.trimColor || '#ef4444')
            : (isBlack ? '#334155' : '#0f172a');
        ctx.lineWidth = Math.max(1.1, ppu * 0.016);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const colTopX = (sShX + sNkX) * 0.5;
        const colTopY = (sShY + sNkY) * 0.5;
        ctx.moveTo(sShX - px * shHalf, sShY - py * shHalf);
        ctx.lineTo(colTopX - px * (shHalf * 0.42), colTopY - py * (shHalf * 0.42));
        ctx.lineTo(colTopX + px * (shHalf * 0.42), colTopY + py * (shHalf * 0.42));
        ctx.lineTo(sShX + px * shHalf, sShY + py * shHalf);
        ctx.quadraticCurveTo(
          sWaistX + px * waistHalf,
          sWaistY + py * waistHalf,
          sHipX - ux * hemExt + px * (hpHalf * 1.15),
          sHipY - uy * hemExt + py * (hpHalf * 1.15)
        );
        ctx.quadraticCurveTo(
          sHipX - ux * (hemExt * 0.85),
          sHipY - uy * (hemExt * 0.85),
          sHipX - ux * hemExt - px * (hpHalf * 1.15),
          sHipY - uy * hemExt - py * (hpHalf * 1.15)
        );
        ctx.quadraticCurveTo(
          sWaistX - px * waistHalf,
          sWaistY - py * waistHalf,
          sShX - px * shHalf,
          sShY - py * shHalf
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (isToji) {
          // Toji signature purple Inventory Curse worm draped shoulder-to-hip + emerald waist belt
          this._drawTojiCursedWorm(ctx, pose, sShX, sShY, sHipX, sHipY, shHalf, hpHalf, px, py, ppu);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = Math.max(1.6, ppu * 0.024);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sHipX - px * hpHalf, sHipY - py * hpHalf);
          ctx.lineTo(sHipX + px * hpHalf, sHipY + py * hpHalf);
          ctx.stroke();
        } else if (isBenimaru) {
          // Benimaru glowing crimson haori collar trim + golden-amber obi sash with fluttering ties
          const f = pose.facing || 1;
          ctx.strokeStyle = spec.trimColor || '#ef4444';
          ctx.lineWidth = Math.max(1.8, ppu * 0.028);
          ctx.beginPath();
          ctx.moveTo(sShX - px * (shHalf * 0.55), sShY - py * (shHalf * 0.55));
          ctx.lineTo(sNkX, sNkY);
          ctx.lineTo(sShX + px * (shHalf * 0.55), sShY + py * (shHalf * 0.55));
          ctx.moveTo(sHipX - ux * hemExt + px * hpHalf * 1.12, sHipY - uy * hemExt + py * hpHalf * 1.12);
          ctx.lineTo(sHipX - ux * hemExt - px * hpHalf * 1.12, sHipY - uy * hemExt - py * hpHalf * 1.12);
          ctx.stroke();

          ctx.strokeStyle = spec.sashColor || '#f59e0b';
          ctx.lineWidth = Math.max(2.3, ppu * 0.036);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sHipX - px * hpHalf, sHipY - py * hpHalf);
          ctx.lineTo(sHipX + px * hpHalf, sHipY + py * hpHalf);
          ctx.moveTo(sHipX - px * f * hpHalf * 0.6, sHipY - py * f * hpHalf * 0.6);
          ctx.lineTo(
            sHipX - px * f * (hpHalf * 1.25) - f * ppu * 0.05,
            sHipY + ppu * 0.14 + Math.sin(this.idleTime * 8) * 1.6
          );
          ctx.stroke();
        } else {
          // Gojo high Jujutsu collar, luminous button & central zip seam
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = Math.max(1.3, ppu * 0.022);
          ctx.beginPath();
          ctx.moveTo(sShX - px * (shHalf * 0.52), sShY - py * (shHalf * 0.52));
          ctx.lineTo(sNkX, sNkY);
          ctx.lineTo(sShX + px * (shHalf * 0.52), sShY + py * (shHalf * 0.52));
          if (pose.frontFacing) {
            ctx.moveTo(sShX, sShY);
            ctx.lineTo(sHipX, sHipY);
          }
          ctx.stroke();
          if (ppu >= 25) {
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc((sShX + sNkX) * 0.5, (sShY + sNkY) * 0.5, Math.max(1.2, ppu * 0.018), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Neck stem
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = torsoWidth * 0.58;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sShX, sShY);
        ctx.lineTo(sNkX, sNkY);
        ctx.stroke();
      } else {
        // Alan Becker sculpted athletic stick-fighter silhouette (tapered chest + curved waist spine)
        ctx.fillStyle = primaryColor;
        this._drawTaperedSegment(ctx, sHipX, sHipY, sWaistX, sWaistY, torsoWidth * 0.44, torsoWidth * 0.48);
        this._drawTaperedSegment(ctx, sWaistX, sWaistY, sShX, sShY, torsoWidth * 0.48, torsoWidth * 0.62, torsoWidth * 0.56);
        this._drawTaperedSegment(ctx, sShX, sShY, sNkX, sNkY, torsoWidth * 0.4, torsoWidth * 0.32);

        if (!isGhost && spec.id === 'animator' && pose.auraStyle && ppu >= 22 && pose.frontHand && pose.backHand) {
          // Subtle glowing animator energy cuffs at wrists
          const shF = gridRenderer.worldToScreen(pose.frontHand.x, pose.frontHand.y, camera);
          const shB = gridRenderer.worldToScreen(pose.backHand.x, pose.backHand.y, camera);
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = Math.max(1.4, limbWidth * 0.42);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(shF.x, shF.y, Math.max(1.8, limbWidth * 0.46), 0, Math.PI * 2);
          ctx.arc(shB.x, shB.y, Math.max(1.6, limbWidth * 0.42), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 5. Foreground Limbs & Style Hakama
      if (!isGhost && !this.dancing && spec.hakamaBlack) {
        const hakFront = isBlack ? spec.hakamaBlack : (spec.hakamaLight || '#334155');
        this._drawHakamaLeg(
          ctx,
          fHip,
          pose.frontKnee,
          pose.frontFoot,
          pose.frontToe,
          limbWidth,
          hakFront,
          primaryColor,
          isBlack ? '#64748b' : '#0f172a',
          gridRenderer,
          camera,
          false
        );
      } else {
        this._drawLimb(
          ctx,
          fHip,
          pose.frontKnee,
          pose.frontFoot,
          pose.frontToe,
          limbWidth,
          primaryColor,
          gridRenderer,
          camera,
          true,
          limbRim
        );
      }
      this._drawLimb(
        ctx,
        fShoulder,
        pose.frontElbow,
        pose.frontHand,
        null,
        limbWidth,
        primaryColor,
        gridRenderer,
        camera,
        false,
        limbRim
      );

      // Thrown Vector Spear or Held Combat Sword in frontHand
      if (!isGhost && pose.throwingSpear && pose.frontHand) {
        this._drawThrowSpear(ctx, pose.frontHand, pose.throwingSpear, camera, gridRenderer, theme);
      } else if (combatW && pose.frontHand) {
        const f = pose.facing || 1;
        const defaultAng = combatW.id === 'diff'
          ? (f > 0 ? 0.34 : Math.PI - 0.34)
          : combatW.id === 'integ'
            ? (f > 0 ? -0.45 : Math.PI + 0.45)
            : combatW.id === 'negate'
              ? (f > 0 ? 0.22 : Math.PI - 0.22)
              : (f > 0 ? 0.14 : Math.PI - 0.14);
        const wAng = pose.weaponWorldAngle !== undefined ? pose.weaponWorldAngle : defaultAng;
        this._drawHeldWeapon(ctx, pose.frontHand, wAng, combatW, camera, gridRenderer, isBlack, false);
      }

      if (!isGhost && pose.parrying) {
        this._drawParryShield(ctx, pose, camera, gridRenderer);
      }

      // 6. Sculpted Head (with volume-preserving Squash & Stretch), Verlet Hair Spikes & Signature Style Eyes
      const sHeadX = hw + (pose.head.x - cx) * ppu;
      const sHeadY = hh - (pose.head.y - cy) * ppu;
      const headPx = Math.max(4, pose.headRadius * ppu);
      const headSX = pose.headStretchX || 1;
      const headSY = pose.headStretchY || 1;
      const headRx = Math.max(2, headPx * headSX);
      const headRy = Math.max(2, headPx * headSY);
      const headTiltAng = Math.atan2(sHeadY - sNkY, sHeadX - sNkX) + Math.PI * 0.5;

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.ellipse(sHeadX, sHeadY, headRx, headRy, headTiltAng, 0, Math.PI * 2);
      ctx.fill();

      if (!isGhost && (pose.auraStyle || isBlack)) {
        ctx.strokeStyle = pose.auraStyle ? accentColor : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = Math.max(1.1, headPx * 0.11);
        ctx.beginPath();
        ctx.ellipse(sHeadX, sHeadY, headRx, headRy, headTiltAng, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (!isGhost && headPx >= 4.5) {
        this._drawHairSpikes(ctx, sHeadX, sHeadY, sNkX, sNkY, headPx, pose, spec, primaryColor, accentColor, isBlack, ppu);
      }

      const activeEyeColor = pose.eyeColorOverride || eyeColor;
      const intenseExpr =
        this.dashTimer > 0 ||
        Boolean(this.throwState && this.throwState.active) ||
        Boolean(this.combat && this.combat.active && this.combat.attackState && this.combat.attackState.active);
      if (headPx >= 6 && activeEyeColor) {
        const styleId = pose.styleId || spec.id;
        const useGlowEye = Boolean(pose.eyeColorOverride) && (this.dancing || styleId !== 'animator');
        const eyeR = Math.max(1.5, headPx * (useGlowEye ? 0.19 : 0.15));

        const drawStyledEye = (ex, ey, isLeftEye = false) => {
          if (styleId === 'benimaru' && !this.dancing) {
            // Fire Force Benimaru mismatched Red circle (○) & Gold cross (×) eyes
            const isGoldCross = pose.frontFacing ? !isLeftEye : false;
            const ringCol = isGoldCross ? '#fde047' : '#ef4444';
            ctx.strokeStyle = ringCol;
            ctx.lineWidth = Math.max(1.3, eyeR * 0.62);
            if (isGoldCross) {
              const r = eyeR * 0.95;
              ctx.beginPath();
              ctx.moveTo(ex - r, ey - r);
              ctx.lineTo(ex + r, ey + r);
              ctx.moveTo(ex + r, ey - r);
              ctx.lineTo(ex - r, ey + r);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(ex, ey, eyeR * 0.95, 0, Math.PI * 2);
              ctx.stroke();
              if (!pose.frontFacing) {
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(ex, ey, eyeR * 0.36, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            return;
          }

          if (useGlowEye) {
            const isEmerald = styleId === 'toji' && !this.dancing;
            const eGlow = isEmerald
              ? this._getGlowSprite(
                  'eye_emerald',
                  'rgba(167, 243, 208, 0.95)',
                  'rgba(52, 211, 153, 0.55)',
                  'rgba(5, 150, 105, 0.15)'
                )
              : this._getGlowSprite(
                  'eye_cyan',
                  'rgba(224, 242, 254, 0.95)',
                  'rgba(56, 189, 248, 0.55)',
                  'rgba(14, 165, 233, 0.15)'
                );
            const gR = eyeR * 3.6;
            ctx.drawImage(eGlow, ex - gR, ey - gR, gR * 2, gR * 2);
            ctx.fillStyle = isEmerald ? '#d1fae5' : '#e0f2fe';
            ctx.beginPath();
            ctx.arc(ex, ey, eyeR * 0.72, 0, Math.PI * 2);
            ctx.fill();
            if (intenseExpr && headPx >= 9) {
              // Sharp anime determination brow slant
              ctx.strokeStyle = isEmerald ? '#059669' : '#0284c7';
              ctx.lineWidth = Math.max(1.2, eyeR * 0.45);
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(ex - pose.facing * eyeR * 0.95, ey - eyeR * 1.15);
              ctx.lineTo(ex + pose.facing * eyeR * 0.95, ey - eyeR * 0.65);
              ctx.stroke();
            }
          } else {
            ctx.fillStyle = activeEyeColor;
            ctx.beginPath();
            ctx.ellipse(ex, ey, eyeR * 1.18, eyeR * (intenseExpr ? 0.74 : 0.88), pose.facing * (intenseExpr ? 0.18 : 0), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(ex + pose.facing * eyeR * 0.2, ey - eyeR * 0.15, Math.max(0.9, eyeR * 0.38), 0, Math.PI * 2);
            ctx.fill();
          }
        };

        if (pose.frontFacing) {
          const eyeSpread = headPx * 0.29;
          const eyeYOff = headPx * 0.05;
          drawStyledEye(sHeadX - eyeSpread, sHeadY - eyeYOff, true);
          drawStyledEye(sHeadX + eyeSpread, sHeadY - eyeYOff, false);
        } else if (pose.eyeDir) {
          const dLen = Math.hypot(pose.eyeDir.x, pose.eyeDir.y) || 1;
          const ex = sHeadX + (pose.eyeDir.x / dLen) * (headPx * 0.44);
          const ey = sHeadY - (pose.eyeDir.y / dLen) * (headPx * 0.44);
          drawStyledEye(ex, ey, false);
        } else {
          const dx = pose.head.x - pose.neck.x;
          const dy = pose.head.y - pose.neck.y;
          const theta = Math.atan2(dy, dx) - Math.PI / 2;
          const eyeForward = pose.facing * headPx * 0.42;
          const eyeUp = headPx * 0.12;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          const wxOff = eyeForward * cos - eyeUp * sin;
          const wyOff = eyeForward * sin + eyeUp * cos;
          drawStyledEye(sHeadX + wxOff, sHeadY - wyOff, false);
        }
      }

      ctx.restore();
    }

    _drawEnergyOrb(ctx, orb, spriteKey, colors, camera, gridRenderer, labelText) {
      const center = gridRenderer.worldToScreen(orb.x, orb.y, camera);
      const rPx = Math.max(4, orb.r * camera.ppu);
      const outerPx = rPx * 2.45;

      const glowSprite = this._getGlowSprite(spriteKey, colors.core, colors.mid, colors.outer);

      ctx.save();
      ctx.globalAlpha = orb.alpha;
      if (glowSprite) {
        ctx.drawImage(
          glowSprite,
          center.x - outerPx,
          center.y - outerPx,
          outerPx * 2,
          outerPx * 2
        );
      }

      // Razor-crisp bright inner singularity sphere
      ctx.fillStyle = colors.core;
      ctx.beginPath();
      ctx.arc(center.x, center.y, rPx * 0.44, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colors.mid;
      ctx.lineWidth = Math.max(1.2, rPx * 0.1);
      ctx.beginPath();
      ctx.arc(center.x, center.y, rPx * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      if (labelText && orb.alpha > 0.25) {
        ctx.direction = 'ltr';
        ctx.font = "700 11px 'Segoe UI', system-ui, sans-serif";
        ctx.fillStyle = colors.mid;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, center.x, center.y + rPx * 1.15 + 4);
      }

      ctx.restore();
    }

    _renderHonoredAura(ctx, fx, camera, gridRenderer, theme) {
      const sc = gridRenderer.worldToScreen(fx.center.x, fx.center.y, camera);
      const ppu = camera.ppu;
      const baseR = ppu * 1.35;
      const pulse = 1 + 0.05 * Math.sin(fx.t * 1.9);
      const isBlack = theme.bg === '#000000';

      ctx.save();

      // Subtle heavenward celestial light shafts (zero shadowBlur!)
      if (isBlack) ctx.globalCompositeOperation = 'lighter';
      const raySpread = ppu * 0.9;
      ctx.fillStyle = 'rgba(254, 240, 138, 0.045)';
      ctx.beginPath();
      ctx.moveTo(sc.x - raySpread * 0.38, 0);
      ctx.lineTo(sc.x + raySpread * 0.38, 0);
      ctx.lineTo(sc.x + raySpread * 1.15, gridRenderer.height);
      ctx.lineTo(sc.x - raySpread * 1.15, gridRenderer.height);
      ctx.closePath();
      ctx.fill();

      // Cached golden-cyan celestial radial aura sprite
      const sprite = this._getGlowSprite(
        'honored_celestial',
        'rgba(254, 240, 138, 0.30)',
        'rgba(125, 211, 252, 0.14)',
        'rgba(250, 204, 21, 0.04)'
      );
      const glowR = baseR * 1.75 * pulse;
      ctx.drawImage(sprite, sc.x - glowR, sc.y - glowR, glowR * 2, glowR * 2);

      // Single serene tilted halo ring
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.30)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y, baseR * 1.05 * pulse, baseR * 0.56 * pulse, -0.24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Quote floating serenely beneath the honored one
      ctx.save();
      const qPos = gridRenderer.worldToScreen(this.x, fx.quoteY, camera);
      const fade = utils.clamp(fx.t / 1.1, 0, 1);
      const quoteText = '"Throughout heaven and earth, I alone am the honored one"';
      ctx.globalAlpha = fade * 0.96;
      ctx.direction = 'ltr';
      ctx.font = "italic 700 13.5px 'Cambria Math', 'Times New Roman', Georgia, serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (!this._honoredQuoteW) {
        this._honoredQuoteW = ctx.measureText(quoteText).width;
      }
      const textW = this._honoredQuoteW;
      const boxW = textW + 24;
      const boxH = 26;
      const boxX = qPos.x - boxW * 0.5;
      const boxY = qPos.y - boxH * 0.5;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(boxX, boxY, boxW, boxH, 999);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fillStyle = isBlack ? 'rgba(0, 0, 0, 0.84)' : 'rgba(255, 255, 255, 0.90)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isBlack ? 'rgba(253, 224, 71, 0.36)' : 'rgba(180, 83, 9, 0.32)';
      ctx.stroke();

      // Zero-shadowBlur crisp warm glow text
      if (isBlack) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
        ctx.fillText(quoteText, qPos.x, qPos.y + 1);
      }
      ctx.fillStyle = isBlack ? '#fef08a' : '#b45309';
      ctx.fillText(quoteText, qPos.x, qPos.y);

      ctx.restore();
    }

    _renderPurpleEffects(ctx, fx, camera, gridRenderer) {
      const t = fx.t;

      // Spiral merge trails when Blue and Red converge
      if (fx.blue && fx.red && t >= 3.95 && t < 5.25) {
        const pB = gridRenderer.worldToScreen(fx.blue.x, fx.blue.y, camera);
        const pR = gridRenderer.worldToScreen(fx.red.x, fx.red.y, camera);
        const pC = gridRenderer.worldToScreen(fx.skyCenter.x, fx.skyCenter.y, camera);

        ctx.save();
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.72;
        ctx.strokeStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(pB.x, pB.y);
        ctx.quadraticCurveTo(pC.x, pC.y - 26, pC.x, pC.y);
        ctx.stroke();

        ctx.strokeStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(pR.x, pR.y);
        ctx.quadraticCurveTo(pC.x, pC.y + 26, pC.x, pC.y);
        ctx.stroke();
        ctx.restore();
      }

      if (fx.blue) {
        this._drawEnergyOrb(
          ctx,
          fx.blue,
          'orb_blue',
          {
            core: '#eff6ff',
            mid: '#60a5fa',
            outer: 'rgba(37, 99, 235, 0.72)',
          },
          camera,
          gridRenderer,
          'Blue'
        );
      }

      if (fx.red) {
        this._drawEnergyOrb(
          ctx,
          fx.red,
          'orb_red',
          {
            core: '#fff1f2',
            mid: '#ff4d6d',
            outer: 'rgba(220, 38, 38, 0.72)',
          },
          camera,
          gridRenderer,
          'Red'
        );
      }

      if (fx.purple) {
        const p = fx.purple;
        const sc = gridRenderer.worldToScreen(p.x, p.y, camera);

        // Expanding fusion shockwave ring
        if (p.age < 1.15) {
          const ringP = p.age / 1.15;
          const ringR = Math.max(8, (0.3 + ringP * 2.4) * camera.ppu);
          ctx.save();
          ctx.globalAlpha = (1 - ringP) * 0.88;
          ctx.strokeStyle = '#e9d5ff';
          ctx.lineWidth = 3.2 * (1 - ringP) + 1;
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Spatial distortion lance flare & crackling violet arcs
        if (p.alpha > 0.2) {
          ctx.save();
          if (p.surge > 0.15) {
            const beamHalfW = (1.1 + p.surge * 2.8) * camera.ppu;
            ctx.globalAlpha = p.alpha * 0.35;
            ctx.fillStyle = '#c084fc';
            ctx.beginPath();
            ctx.ellipse(sc.x, sc.y, beamHalfW, Math.max(2, p.r * camera.ppu * 0.24), 0, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = p.alpha * 0.85;
          ctx.strokeStyle = '#f3e8ff';
          ctx.lineWidth = 1.6;
          const arcR = p.r * camera.ppu * 1.18;
          for (let i = 0; i < 4; i++) {
            const a0 = t * 7 + (i * Math.PI) / 2;
            const x1 = sc.x + Math.cos(a0) * arcR * 0.7;
            const y1 = sc.y + Math.sin(a0) * arcR * 0.7;
            const x2 = sc.x + Math.cos(a0 + 0.45) * arcR * 1.25;
            const y2 = sc.y + Math.sin(a0 + 0.45) * arcR * 1.25;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo((x1 + x2) * 0.5 + Math.sin(t * 30 + i) * 7, (y1 + y2) * 0.5);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          ctx.restore();
        }

        this._drawEnergyOrb(
          ctx,
          p,
          'orb_purple',
          {
            core: '#ffffff',
            mid: '#c084fc',
            outer: 'rgba(147, 51, 234, 0.82)',
          },
          camera,
          gridRenderer,
          'Hollow Purple'
        );
      }
    }

    render(ctx, camera, gridRenderer, theme) {
      if (this.y >= -0.05) {
        const shadowScale = utils.clamp(1 - this.y / 6.0, 0.2, 1);
        const sShadow = gridRenderer.worldToScreen(this.x, 0, camera);
        const rx = Math.max(6, camera.ppu * 0.34 * shadowScale);
        const ry = Math.max(2, camera.ppu * 0.065 * shadowScale);

        ctx.save();
        ctx.globalAlpha = shadowScale;
        ctx.fillStyle = theme.shadow;
        ctx.beginPath();
        ctx.ellipse(sShadow.x, sShadow.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (this.dancing && this.danceFx && this.danceFx.mode === 'honored') {
        this._renderHonoredAura(ctx, this.danceFx, camera, gridRenderer, theme);
      }

      const isBlack = !theme || theme.bg === '#000000';
      for (const ghost of this.particles.ghosts) {
        const alpha = (ghost.life / Math.max(0.01, ghost.maxLife)) * 0.48;
        const gCol = ghost.color || theme.dashGhost;
        ctx.save();
        if (ghost.color && isBlack) ctx.globalCompositeOperation = 'lighter';
        this.renderPose(
          ctx,
          ghost.pose,
          camera,
          gridRenderer,
          gCol,
          gCol,
          null,
          alpha,
          theme
        );
        ctx.restore();
      }

      const pose = this.lastPose || this.computePose();

      if (this.surfingCurve) {
        this._renderSurfBoard(ctx, camera, gridRenderer, theme);
      }

      const hurtFlash = this.damageFlashTimer > 0 && Math.floor(this.damageFlashTimer * 24) % 2 === 0;
      this.renderPose(
        ctx,
        pose,
        camera,
        gridRenderer,
        hurtFlash ? '#ff4d6d' : theme.stickPrimary,
        hurtFlash ? '#fb7185' : theme.stickSecondary,
        theme.stickEye,
        1,
        theme
      );

      this._renderWeaponSmearTrails(ctx, camera, gridRenderer, theme);

      if (this.dancing && this.danceFx && this.danceFx.mode === 'purple') {
        ctx.save();
        if (isBlack) ctx.globalCompositeOperation = 'lighter';
        this._renderPurpleEffects(ctx, this.danceFx, camera, gridRenderer);
        ctx.restore();
      }
    }

    _renderSurfBoard(ctx, camera, gridRenderer, theme) {
      const cosT = Math.cos(this.curveSlopeAngle);
      const sinT = Math.sin(this.curveSlopeAngle);
      const nx = -sinT;
      const ny = cosT;
      const half = 0.44;
      const tipShift = 0.1;
      const lift = 0.08;

      const x1 = this.x - half * cosT;
      const y1 = this.y - half * sinT;
      const x2 = this.x + half * cosT;
      const y2 = this.y + half * sinT;
      const tipX = x2 + tipShift * cosT + nx * lift;
      const tipY = y2 + tipShift * sinT + ny * lift;
      const tailX = x1 - tipShift * cosT + nx * lift;
      const tailY = y1 - tipShift * sinT + ny * lift;

      const sTail = gridRenderer.worldToScreen(tailX, tailY, camera);
      const s1 = gridRenderer.worldToScreen(x1, y1, camera);
      const s2 = gridRenderer.worldToScreen(x2, y2, camera);
      const sTip = gridRenderer.worldToScreen(tipX, tipY, camera);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.strokeStyle = theme.funcGlow || 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(sTail.x, sTail.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.lineTo(sTip.x, sTip.y);
      ctx.stroke();

      ctx.strokeStyle = theme.funcStroke || '#22d3ee';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(sTail.x, sTail.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.lineTo(sTip.x, sTip.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  MathStickGame.Stickman = Stickman;
})(window);
