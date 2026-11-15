(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { CONFIG, utils } = MathStickGame;

  class Stickman {
    constructor(particles, functionPlotter = null) {
      this.particles = particles;
      this.functionPlotter = functionPlotter;
      this._glowSprites = new Map();
      this._scarfPtsX = new Float64Array(8);
      this._scarfPtsY = new Float64Array(8);
      this._honoredQuoteW = 0;
      this.reset();
    }

    _resetScarf(nx, ny) {
      this.scarfChain = [
        { x: nx, y: ny },
        { x: nx - this.facing * 0.12, y: ny - 0.04 },
        { x: nx - this.facing * 0.24, y: ny - 0.1 },
        { x: nx - this.facing * 0.35, y: ny - 0.17 },
        { x: nx - this.facing * 0.45, y: ny - 0.24 },
      ];
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
      this.curveSlopeAngle = 0;
      this.curveSpeed = 0;
      this.dropThroughTimer = 0;
      this.leanAngle = 0.04;
      this.currentVisualHeight = CONFIG.HEIGHT_STANDING;
      this.lastPose = null;
      this._resetScarf(0, 1.48);
    }

    resetTo(x = 0, y = 0) {
      this.reset();
      this.x = x;
      this.y = y;
      this.grounded = y <= 0.02;
      this._resetScarf(x, y + 1.48);
    }

    isFreeFalling() {
      return (
        !this.grounded &&
        !this.climbing &&
        !this.surfingCurve &&
        this.dashTimer <= 0 &&
        (this.freeFallMode || this.vy < -7.5 || (this.y > 3.5 && this.vy < -2.0))
      );
    }

    getStateLabel() {
      if (this.dashTimer > 0) return 'Dash';
      if (this.surfingCurve) return 'Curve Surf';
      if (this.climbing) return 'Climbing';
      if (this.flipTimer > 0) return 'Flip';
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
      this.heavyLandTimer = Math.max(0, this.heavyLandTimer - dt);
      this.landSquash = Math.max(0, this.landSquash - dt * 4.2);

      if (this.flipTimer > 0) {
        this.flipTimer = Math.max(0, this.flipTimer - dt);
      }

      // Free Fall drop trigger (G key or toolbar button)
      if (input.freeFallPressed) {
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
        if (this.grounded || this.dancing || this.climbing || this.surfingCurve) {
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

      // Climbing grab detection on y-axis (x = 0)
      const nearYAxis = Math.abs(this.x) <= CONFIG.CLIMB_GRAB_RADIUS;
      if (
        !this.climbing &&
        !this.surfingCurve &&
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
          this.particles.spawnJumpBurst(this.x, this.y, true);
        } else {
          this.flipDuration = 0.42;
          this.flipTimer = 0.42;
          this.flipDir = this.facing;
        }
      }

      // Crouch & Slide logic
      if (this.grounded && input.crouchHeld && this.dashTimer <= 0) {
        if (!this.sliding && Math.abs(this.vx) >= CONFIG.SLIDE_MIN_SPEED) {
          this.sliding = true;
          this.vx *= CONFIG.SLIDE_BOOST;
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
          this.particles.addGhost(this.lastPose);
          this.ghostTimer = 0.032;
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

      // Jump & Double Jump
      if (this.jumpBufferTimer > 0 && this.dashTimer <= 0) {
        if (this.coyoteTimer > 0) {
          this.vy = CONFIG.JUMP_VEL;
          this.grounded = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          this.sliding = false;
          this.crouching = false;
          this.freeFallMode = false;
          this.jumpsRemaining = 1;
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

      // Landing or walking onto active math function curve y = f(x)
      let snappedToCurve = false;
      if (
        this.functionPlotter &&
        this.functionPlotter.isActive() &&
        this.dropThroughTimer <= 0 &&
        !this.dancing &&
        this.dashTimer <= 0
      ) {
        const prevCurve = this.functionPlotter.sample(prevX);
        const nextCurve = this.functionPlotter.sample(this.x);
        if (
          nextCurve.valid &&
          nextCurve.y >= 0 &&
          Math.abs(nextCurve.dy) <= CONFIG.SURF_MAX_SLOPE
        ) {
          const prevRef = prevCurve.valid ? prevCurve.y - 0.24 : 0;
          const airLand =
            !this.grounded &&
            this.vy <= 0.7 &&
            prevY >= prevRef &&
            this.y <= nextCurve.y + 0.14;
          const groundWalkOn =
            this.grounded &&
            Math.abs(this.vx) > 0.18 &&
            nextCurve.y >= 0.008 &&
            nextCurve.y <= 0.48 &&
            (!prevCurve.valid || prevCurve.y <= 0.28);

          if (airLand || groundWalkOn) {
            this._snapToCurve(nextCurve, airLand);
            snappedToCurve = true;
          }
        }
      }

      // Ground collision (x-axis at y = 0)
      if (!snappedToCurve) {
        if (this.y <= 0) {
          if (!this.grounded && this.vy < -2.2) {
            const intensity = utils.clamp(Math.abs(this.vy) / 14, 0.2, 2.2);
            this.landSquash = Math.min(1.0, intensity);
            if (this.vy < -11.0) {
              this.heavyLandTimer = 0.24;
            }
            this.particles.spawnLandingBurst(this.x, intensity);
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
        if (this.vy < -11.0) {
          this.heavyLandTimer = 0.24;
        }
        this.particles.spawnLandingBurst(this.x, intensity);
      }

      const cosT = Math.cos(curve.angle);
      const sinT = Math.sin(curve.angle);
      this.surfingCurve = true;
      this.curveSlopeAngle = curve.angle;
      this.curveSpeed = this.vx * cosT + this.vy * sinT;
      if (Math.abs(this.curveSpeed) < 0.08) {
        this.curveSpeed = this.vx;
      }
      this.y = Math.max(0, curve.y);
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
          return false;
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
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return false;
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
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return false;
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
        this.particles.spawnJumpBurst(this.x, this.y, true);
        return false;
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
          (input.sprintHeld ? CONFIG.SURF_RUN_MAX_SPEED : CONFIG.SURF_WALK_MAX_SPEED) *
          (carving ? 1.25 : 1.0);
        const driveAccel = CONFIG.SURF_DRIVE_ACCEL * (input.sprintHeld ? 1.22 : 1.0);
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

      if (next.valid && next.y <= 0.0) {
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
        this.y = Math.max(0, this.y);
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
        this.particles.spawnJumpBurst(this.x, this.y, false);
        return false;
      }

      this.x = nx;
      this.y = Math.max(0, next.y);
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
        !this.grounded && !this.climbing ? 1 : 0,
        18,
        dt
      );
      this.crouchBlend = utils.damp(
        this.crouchBlend,
        (this.crouching || this.heavyLandTimer > 0) && this.grounded && !this.surfingCurve ? 1 : 0,
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
        this.surfingCurve ? 1 : 0,
        18,
        dt
      );

      let targetLean = 0.04;
      if (this.dashTimer > 0) targetLean = 0.56;
      else if (this.surfingCurve) targetLean = 0.36;
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

    _solveTwoBoneIK(ax, ay, tx, ty, len1, len2, bendSign) {
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

      if (p < Math.PI) {
        const t = p / Math.PI;
        gaitX = (0.5 - t) * strideLen;
        gaitY = 0;
      } else {
        const t = (p - Math.PI) / Math.PI;
        gaitX = (-0.5 + 0.5 * (1 - Math.cos(t * Math.PI))) * strideLen;
        gaitY = liftHeight * Math.sin(t * Math.PI);
      }

      return {
        x: utils.lerp(idleX, gaitX, walkBlend),
        y: utils.lerp(0, gaitY, walkBlend),
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
      if (!this.scarfChain || this.scarfChain.length < 5) {
        this._resetScarf(pose.neck.x, pose.neck.y);
        return;
      }

      const chain = this.scarfChain;
      const nx = pose.neck.x;
      const ny = pose.neck.y;
      // Snap safely if teleported far away
      if (Math.hypot(chain[0].x - nx, chain[0].y - ny) > 2.0) {
        this._resetScarf(nx, ny);
      }

      chain[0].x = nx;
      chain[0].y = ny;

      const segLen = 0.135;
      const flutter = this.idleTime * (this.dancing ? 5.5 : 4.2);
      const isPurple = this.dancing && this.danceStyle === 0;
      const isHonored = this.dancing && this.danceStyle === 2;

      let windX = -this.facing * 0.85 - this.vx * 0.48;
      let windY = -0.95 - this.vy * 0.28;
      if (isPurple) {
        const t = this.danceLocalTime % 7.8;
        const surge = this._smoothstep(4.8, 5.6, t) * (1 - this._smoothstep(6.7, 7.6, t));
        windX = -0.65 - surge * 0.9;
        windY = 0.35 + surge * 2.2;
      } else if (isHonored) {
        windX = -this.facing * 0.45;
        windY = -0.85;
      } else if (this.dashTimer > 0) {
        windX = -this.facing * 5.2;
        windY = 0.25;
      }

      for (let i = 1; i < chain.length; i++) {
        const prev = chain[i - 1];
        const curr = chain[i];
        const wave = Math.sin(flutter - i * 1.15) * (isPurple ? 0.55 : 0.26);

        curr.x += windX * dt * 0.85;
        curr.y += (windY + wave) * dt * 0.85;

        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.hypot(dx, dy) || 1e-4;
        curr.x = prev.x + (dx / dist) * segLen;
        curr.y = prev.y + (dy / dist) * segLen;
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
      const shoulderX = hipX + Math.cos(bodyAng) * CONFIG.TORSO_LEN;
      const shoulderY = hipY + Math.sin(bodyAng) * CONFIG.TORSO_LEN;
      const headTiltAng = bodyAng + f * 0.12;
      const neckX = shoulderX + Math.cos(headTiltAng) * CONFIG.NECK_LEN;
      const neckY = shoulderY + Math.sin(headTiltAng) * CONFIG.NECK_LEN;
      const headX = neckX + Math.cos(headTiltAng) * CONFIG.HEAD_RADIUS;
      const headY = neckY + Math.sin(headTiltAng) * CONFIG.HEAD_RADIUS;

      this.currentVisualHeight = Math.max(1.3, headY + CONFIG.HEAD_RADIUS - this.y);

      const leg1 = this._solveTwoBoneIK(
        hipX,
        hipY,
        frontFootX,
        frontFootY,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        hipX,
        hipY,
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
        shoulderX,
        shoulderY,
        fBase + sway,
        f * (this.crouching ? 0.42 : 0.28)
      );
      const arm2 = this._armFK(
        shoulderX,
        shoulderY,
        bBase - sway,
        -f * 0.34
      );

      return {
        facing: f,
        eyeDir: { x: f * cosT, y: f * sinT },
        hip: { x: hipX, y: hipY },
        shoulder: { x: shoulderX, y: shoulderY },
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
      if (this.surfingCurve) {
        return this._computeSurfPose();
      }
      if (this.climbing) {
        return this._computeClimbPose();
      }
      if (this.dancing) {
        return this._computeDancePose();
      }

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
      const shoulderX = hipX + f * Math.sin(lean) * CONFIG.TORSO_LEN;
      const shoulderY = hipY + Math.cos(lean) * CONFIG.TORSO_LEN;

      const headAngle = lean * (this.freeFallBlend > 0.3 ? 0.92 : 0.65);
      const neckX = shoulderX + f * Math.sin(headAngle) * CONFIG.NECK_LEN;
      const neckY = shoulderY + Math.cos(headAngle) * CONFIG.NECK_LEN;
      const headX = neckX + f * Math.sin(headAngle) * CONFIG.HEAD_RADIUS;
      const headY = neckY + Math.cos(headAngle) * CONFIG.HEAD_RADIUS;

      this.currentVisualHeight = Math.max(
        1.1,
        Math.max(headY, hipY) + CONFIG.HEAD_RADIUS - this.y
      );

      // Foot targets
      const groundF1 = this._computeFootLocal(0, strideLen, liftHeight, 0.12, walkBlend);
      const groundF2 = this._computeFootLocal(Math.PI, strideLen, liftHeight, -0.12, walkBlend);

      const vyNorm = utils.clamp(this.vy / CONFIG.JUMP_VEL, -1, 1);
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
          // Streamlined dive legs trailed straight behind/up
          ff1 = { x: -0.45, y: 1.55 };
          ff2 = { x: -0.35, y: 1.6 };
        } else if (this.freeFallBrake) {
          // Spread skydiver brake legs
          ff1 = { x: -0.62, y: 1.28 };
          ff2 = { x: -0.42, y: 1.38 };
        } else {
          // Wind flail kick
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
        hipX,
        hipY,
        this.x + f * localF1.x,
        this.y + localF1.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );
      const leg2 = this._solveTwoBoneIK(
        hipX,
        hipY,
        this.x + f * localF2.x,
        this.y + localF2.y,
        CONFIG.THIGH_LEN,
        CONFIG.SHIN_LEN,
        f
      );

      // Arm swing
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
        shoulderX,
        shoulderY,
        shoulderX + f * hand1Local.x,
        shoulderY + hand1Local.y,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );
      const arm2 = this._solveTwoBoneIK(
        shoulderX,
        shoulderY,
        shoulderX + f * hand2Local.x,
        shoulderY + hand2Local.y,
        CONFIG.UPPER_ARM_LEN,
        CONFIG.FOREARM_LEN,
        -f
      );

      const footLen = CONFIG.FOOT_LEN;
      const pose = {
        facing: f,
        auraStyle: this.dashTimer > 0 ? 'cyan' : null,
        coatStyle: true,
        hip: { x: hipX, y: hipY },
        shoulder: { x: shoulderX, y: shoulderY },
        neck: { x: neckX, y: neckY },
        head: { x: headX, y: headY },
        headRadius: CONFIG.HEAD_RADIUS,
        frontKnee: { x: leg1.jx, y: leg1.jy },
        frontFoot: { x: leg1.ex, y: leg1.ey },
        frontToe: { x: leg1.ex + f * footLen, y: Math.max(this.y, leg1.ey) },
        backKnee: { x: leg2.jx, y: leg2.jy },
        backFoot: { x: leg2.ex, y: leg2.ey },
        backToe: { x: leg2.ex + f * footLen, y: Math.max(this.y, leg2.ey) },
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
        'shoulder',
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

    _drawTaperedSegment(ctx, x1, y1, x2, y2, r1, r2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) {
        ctx.beginPath();
        ctx.arc(x1, y1, r1, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const nx = (-dy / len);
      const ny = (dx / len);
      const ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.arc(x1, y1, r1, ang + Math.PI * 0.5, ang - Math.PI * 0.5, false);
      ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
      ctx.arc(x2, y2, r2, ang - Math.PI * 0.5, ang + Math.PI * 0.5, false);
      ctx.closePath();
      ctx.fill();
    }

    _drawLimb(ctx, p1, p2, p3, p4, width, color, gridRenderer, camera, isLeg = false) {
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

      const rRoot = width * (isLeg ? 0.62 : 0.52);
      const rMid = width * (isLeg ? 0.48 : 0.42);
      const rTip = width * (isLeg ? 0.36 : 0.32);

      ctx.fillStyle = color;
      this._drawTaperedSegment(ctx, x1, y1, x2, y2, rRoot, rMid);
      this._drawTaperedSegment(ctx, x2, y2, x3, y3, rMid, rTip);

      if (p4) {
        // Stylized sculpted shoe wedge
        const x4 = hw + (p4.x - cx) * ppu;
        const y4 = hh - (p4.y - cy) * ppu;
        const fdx = x4 - x3;
        const fdy = y4 - y3;
        const flen = Math.hypot(fdx, fdy) || 1;
        const fnx = -fdy / flen;
        const fny = fdx / flen;
        ctx.beginPath();
        ctx.arc(x3, y3, rTip * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x3 + fnx * rTip * 1.05, y3 + fny * rTip * 1.05);
        ctx.lineTo(x4 + (fdx / flen) * rTip * 0.6, y4 + (fdy / flen) * rTip * 0.6);
        ctx.lineTo(x3 - fnx * rTip * 0.9, y3 - fny * rTip * 0.9);
        ctx.closePath();
        ctx.fill();
      } else {
        // Tapered anime hand silhouette extending cleanly from wrist
        const hdx = x3 - x2;
        const hdy = y3 - y2;
        const hlen = Math.hypot(hdx, hdy) || 1;
        const tipX = x3 + (hdx / hlen) * Math.max(3, ppu * 0.05);
        const tipY = y3 + (hdy / hlen) * Math.max(3, ppu * 0.05);
        this._drawTaperedSegment(ctx, x3, y3, tipX, tipY, rTip * 1.08, rTip * 0.55);
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
        ctx.globalAlpha = 0.92 * (1 - i * 0.14);
        this._drawTaperedSegment(ctx, ptsX[i], ptsY[i], ptsX[i + 1], ptsY[i + 1], r1, r2);
      }
      ctx.restore();
    }

    renderPose(ctx, pose, camera, gridRenderer, primaryColor, secondaryColor, eyeColor, alpha = 1, theme = null) {
      const ppu = camera.ppu;
      const torsoWidth = Math.max(2.6, ppu * 0.088);
      const limbWidth = Math.max(2.2, ppu * 0.072);
      const isGhost = eyeColor === null;
      const isBlack = !theme || theme.bg === '#000000';

      const fHip = pose.frontHip || pose.hip;
      const bHip = pose.backHip || pose.hip;
      const fShoulder = pose.frontShoulder || pose.shoulder;
      const bShoulder = pose.backShoulder || pose.shoulder;
      const backColor = isGhost ? secondaryColor : isBlack ? '#94a3b8' : '#475569';

      let accentColor = theme ? theme.stickAccent : '#38bdf8';
      if (pose.auraStyle === 'gold') accentColor = '#fde047';
      else if (pose.auraStyle === 'purple') accentColor = '#c084fc';
      else if (pose.auraStyle === 'cyan') accentColor = '#38bdf8';

      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Subtle Anime Cursed Energy Aura halo (zero shadowBlur!)
      if (!isGhost && pose.auraStyle) {
        const bodyMidX = hw + ((pose.hip.x + pose.shoulder.x) * 0.5 - cx) * ppu;
        const bodyMidY = hh - ((pose.hip.y + pose.shoulder.y) * 0.5 - cy) * ppu;
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
        } else {
          glowSprite = this._getGlowSprite(
            'aura_cyan',
            'rgba(125, 211, 252, 0.32)',
            'rgba(56, 189, 248, 0.15)',
            'rgba(14, 165, 233, 0.04)'
          );
        }
        const auraR = ppu * 1.15;
        ctx.save();
        if (isBlack) ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite, bodyMidX - auraR, bodyMidY - auraR, auraR * 2, auraR * 2);

        // Crisp shimmering energy rim along spine & head
        const sH = { x: hw + (pose.hip.x - cx) * ppu, y: hh - (pose.hip.y - cy) * ppu };
        const sS = { x: hw + (pose.shoulder.x - cx) * ppu, y: hh - (pose.shoulder.y - cy) * ppu };
        const sHd = { x: hw + (pose.head.x - cx) * ppu, y: hh - (pose.head.y - cy) * ppu };
        const pulseW = torsoWidth * (2.15 + 0.25 * Math.sin(this.idleTime * 9));
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = pulseW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sH.x, sH.y);
        ctx.lineTo(sS.x, sS.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sHd.x, sHd.y, Math.max(4, pose.headRadius * ppu) * 1.32, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.16;
        ctx.fill();
        ctx.restore();
      }

      // Back Scarf Layer
      this._drawScarf(ctx, pose, camera, gridRenderer, accentColor, isGhost);

      // Background Limbs
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
        false
      );
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
        true
      );

      // Sculpted Sorcerer Coat / V-Taper Torso
      const sHipX = hw + (pose.hip.x - cx) * ppu;
      const sHipY = hh - (pose.hip.y - cy) * ppu;
      const sShX = hw + (pose.shoulder.x - cx) * ppu;
      const sShY = hh - (pose.shoulder.y - cy) * ppu;
      const sNkX = hw + (pose.neck.x - cx) * ppu;
      const sNkY = hh - (pose.neck.y - cy) * ppu;

      if (!isGhost && pose.coatStyle !== false) {
        const spDx = sShX - sHipX;
        const spDy = sShY - sHipY;
        const spLen = Math.hypot(spDx, spDy) || 1;
        const ux = spDx / spLen;
        const uy = spDy / spLen;
        const px = -uy;
        const py = ux;

        const shHalf = pose.frontFacing ? ppu * 0.128 : ppu * 0.088;
        const hpHalf = pose.frontFacing ? ppu * 0.082 : ppu * 0.056;
        const hemExt = ppu * 0.06;

        const coatFill = isBlack ? '#0b101d' : '#0f172a';
        ctx.fillStyle = coatFill;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = Math.max(1.5, ppu * 0.024);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(sShX - px * shHalf, sShY - py * shHalf);
        ctx.lineTo(sShX + px * shHalf, sShY + py * shHalf);
        ctx.lineTo(sHipX - ux * hemExt + px * (hpHalf * 1.18), sHipY - uy * hemExt + py * (hpHalf * 1.18));
        ctx.lineTo(sHipX - ux * (hemExt * 0.65), sHipY - uy * (hemExt * 0.65));
        ctx.lineTo(sHipX - ux * hemExt - px * (hpHalf * 1.18), sHipY - uy * hemExt - py * (hpHalf * 1.18));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // High Jujutsu collar & subtle glowing trim
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

        // Neck stem
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = torsoWidth * 0.58;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sShX, sShY);
        ctx.lineTo(sNkX, sNkY);
        ctx.stroke();
      } else {
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = torsoWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sHipX, sHipY);
        ctx.lineTo(sShX, sShY);
        ctx.lineTo(sNkX, sNkY);
        ctx.stroke();
      }

      // Foreground Limbs
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
        true
      );
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
        false
      );

      // Sculpted Head & Luminous Eyes ("Six Eyes")
      const sHeadX = hw + (pose.head.x - cx) * ppu;
      const sHeadY = hh - (pose.head.y - cy) * ppu;
      const headPx = Math.max(4, pose.headRadius * ppu);

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(sHeadX, sHeadY, headPx, 0, Math.PI * 2);
      ctx.fill();

      if (!isGhost && (pose.auraStyle || isBlack)) {
        ctx.strokeStyle = pose.auraStyle ? accentColor : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = Math.max(1.1, headPx * 0.11);
        ctx.beginPath();
        ctx.arc(sHeadX, sHeadY, headPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      const activeEyeColor = pose.eyeColorOverride || eyeColor;
      if (headPx >= 6 && activeEyeColor) {
        const isSixEyes = Boolean(pose.eyeColorOverride);
        const eyeR = Math.max(1.5, headPx * (isSixEyes ? 0.18 : 0.15));

        const drawGlowingEye = (ex, ey) => {
          if (isSixEyes) {
            const eGlow = this._getGlowSprite(
              'eye_cyan',
              'rgba(224, 242, 254, 0.95)',
              'rgba(56, 189, 248, 0.55)',
              'rgba(14, 165, 233, 0.15)'
            );
            const gR = eyeR * 3.8;
            ctx.drawImage(eGlow, ex - gR, ey - gR, gR * 2, gR * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.beginPath();
            ctx.arc(ex, ey, eyeR * 0.72, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = activeEyeColor;
            ctx.beginPath();
            ctx.ellipse(ex, ey, eyeR * 1.15, eyeR * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = theme ? theme.stickAccent : '#38bdf8';
            ctx.beginPath();
            ctx.arc(ex + pose.facing * eyeR * 0.2, ey - eyeR * 0.15, Math.max(0.9, eyeR * 0.36), 0, Math.PI * 2);
            ctx.fill();
          }
        };

        if (pose.frontFacing) {
          const eyeSpread = headPx * 0.29;
          const eyeYOff = headPx * 0.05;
          drawGlowingEye(sHeadX - eyeSpread, sHeadY - eyeYOff);
          drawGlowingEye(sHeadX + eyeSpread, sHeadY - eyeYOff);
        } else if (pose.eyeDir) {
          const dLen = Math.hypot(pose.eyeDir.x, pose.eyeDir.y) || 1;
          const ex = sHeadX + (pose.eyeDir.x / dLen) * (headPx * 0.44);
          const ey = sHeadY - (pose.eyeDir.y / dLen) * (headPx * 0.44);
          drawGlowingEye(ex, ey);
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
          drawGlowingEye(sHeadX + wxOff, sHeadY - wyOff);
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

      if (this.dancing && this.danceFx && this.danceFx.mode === 'honored') {
        this._renderHonoredAura(ctx, this.danceFx, camera, gridRenderer, theme);
      }

      for (const ghost of this.particles.ghosts) {
        const alpha = (ghost.life / ghost.maxLife) * 0.45;
        this.renderPose(
          ctx,
          ghost.pose,
          camera,
          gridRenderer,
          theme.dashGhost,
          theme.dashGhost,
          null,
          alpha,
          theme
        );
      }

      const pose = this.lastPose || this.computePose();

      if (this.surfingCurve) {
        this._renderSurfBoard(ctx, camera, gridRenderer, theme);
      }

      this.renderPose(
        ctx,
        pose,
        camera,
        gridRenderer,
        theme.stickPrimary,
        theme.stickSecondary,
        theme.stickEye,
        1,
        theme
      );

      if (this.dancing && this.danceFx && this.danceFx.mode === 'purple') {
        const isBlack = theme && theme.bg === '#000000';
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
