(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});

  MathStickGame.CONFIG = {
    // Orthonormal coordinate system scale (1 unit on x == 1 unit on y)
    DEFAULT_PPU: 72,
    MIN_PPU: 18,
    MAX_PPU: 220,

    // Stickman proportions in math units (total height ~ 1.80 units)
    HEIGHT_STANDING: 1.8,
    HIP_HEIGHT_IDLE: 0.88,
    HIP_HEIGHT_CROUCH: 0.49,
    HIP_HEIGHT_SLIDE: 0.36,
    THIGH_LEN: 0.46,
    SHIN_LEN: 0.45,
    TORSO_LEN: 0.55,
    NECK_LEN: 0.06,
    HEAD_RADIUS: 0.165,
    UPPER_ARM_LEN: 0.29,
    FOREARM_LEN: 0.27,
    FOOT_LEN: 0.14,

    // Movement & platforming physics (in math units / second)
    WALK_SPEED: 3.6,
    RUN_SPEED: 7.8,
    CROUCH_SPEED: 1.8,
    GROUND_ACCEL: 26,
    GROUND_DECEL: 28,
    TURN_DECEL: 46,
    AIR_ACCEL: 19,
    AIR_DECEL: 5.5,

    // Jump & gravity (units / s^2)
    GRAVITY_UP: 25,
    GRAVITY_DOWN: 33,
    JUMP_VEL: 11.4,
    DOUBLE_JUMP_VEL: 9.8,
    JUMP_CUT_MULT: 0.46,
    COYOTE_TIME: 0.11,
    JUMP_BUFFER: 0.12,

    // Climb on y-axis (x = 0)
    CLIMB_GRAB_RADIUS: 0.52,
    CLIMB_SPEED: 4.4,
    CLIMB_FAST_SPEED: 7.6,
    CLIMB_STEP_LEN: 0.62,

    // Free fall physics
    FREE_FALL_DROP_HEIGHT: 26,
    FREE_FALL_GRAVITY: 22,
    FREE_FALL_DIVE_GRAVITY: 34,
    TERMINAL_VEL_NORMAL: 22,
    TERMINAL_VEL_DIVE: 32,
    TERMINAL_VEL_BRAKE: 9.5,

    // Dance
    DANCE_BPM: 124,

    // Slide & Dash
    SLIDE_MIN_SPEED: 4.1,
    SLIDE_BOOST: 1.08,
    SLIDE_DECEL: 10.5,
    DASH_SPEED: 15.5,
    DASH_DURATION: 0.16,
    DASH_COOLDOWN: 0.5,

    // Curve Surfing y = f(x)
    SURF_GRAVITY: 26,
    SURF_DRIVE_ACCEL: 24,
    SURF_RUN_MAX_SPEED: 12.0,
    SURF_WALK_MAX_SPEED: 6.2,
    SURF_MAX_SPEED: 26.0,
    SURF_MAX_SLOPE: 3.6,

    // Launched Vector & Riding Physics
    VEC_MIN_LEN: 1.4,
    VEC_MAX_LEN: 7.5,
    VEC_DEFAULT_UX: 4.5,
    VEC_DEFAULT_UY: 1.5,
    VEC_BASE_SPEED: 4.85,
    VEC_LIFETIME: 6.0,
    VEC_RIDE_LIFETIME: 7.5,
    VEC_SHAFT_WALK_SPEED: 4.4,
    VEC_BOARD_RADIUS: 0.42,

    // Camera tracking
    CAMERA_FOLLOW_X_SPEED: 7.5,
    CAMERA_FOLLOW_Y_SPEED: 6.5,
    CAMERA_LOOKAHEAD_FACTOR: 0.16,
    DEFAULT_CAM_Y: 1.45,

    // Gamepad deadzone
    STICK_DEADZONE: 0.15,
    STICK_RUN_THRESHOLD: 0.72,
  };

  MathStickGame.THEMES = {
    black: {
      bg: '#000000',
      minorGrid: 'rgba(255, 255, 255, 0.08)',
      majorGrid: 'rgba(255, 255, 255, 0.19)',
      axis: '#f8fafc',
      axisTickText: '#a1a1aa',
      originBadgeBg: 'rgba(0, 0, 0, 0.88)',
      rightAngleFill: 'rgba(56, 189, 248, 0.16)',
      rightAngleStroke: 'rgba(56, 189, 248, 0.78)',
      vecI: '#ff4d6d',
      vecJ: '#38bdf8',
      vecV: '#22c55e',
      vecLaunched: '#f59e0b',
      vecLaunchedGlow: 'rgba(245, 158, 11, 0.32)',
      vecResultant: '#34d399',
      projection: 'rgba(56, 189, 248, 0.65)',
      projectionX: '#ff4d6d',
      projectionY: '#38bdf8',
      coordTagBg: 'rgba(10, 10, 12, 0.92)',
      coordTagBorder: 'rgba(255, 255, 255, 0.24)',
      coordTagText: '#ffffff',
      stickPrimary: '#ffffff',
      stickSecondary: '#9ca3af',
      stickAccent: '#38bdf8',
      stickEye: '#000000',
      shadow: 'rgba(255, 255, 255, 0.18)',
      dust: 'rgba(228, 228, 231, 0.45)',
      dashGhost: 'rgba(56, 189, 248, 0.34)',
      climbGlow: 'rgba(56, 189, 248, 0.55)',
      windStreak: 'rgba(255, 255, 255, 0.36)',
      musicNote: '#fbbf24',
      funcStroke: '#38bdf8',
      funcGlow: 'rgba(56, 189, 248, 0.24)',
      funcTangent: '#fde047',
    },
    light: {
      bg: '#f8fafc',
      minorGrid: 'rgba(148, 163, 184, 0.26)',
      majorGrid: 'rgba(100, 116, 139, 0.40)',
      axis: '#0f172a',
      axisTickText: '#334155',
      originBadgeBg: 'rgba(248, 250, 252, 0.85)',
      rightAngleFill: 'rgba(37, 99, 235, 0.10)',
      rightAngleStroke: 'rgba(37, 99, 235, 0.55)',
      vecI: '#dc2626',
      vecJ: '#2563eb',
      vecV: '#059669',
      vecLaunched: '#d97706',
      vecLaunchedGlow: 'rgba(217, 119, 6, 0.25)',
      vecResultant: '#059669',
      projection: 'rgba(37, 99, 235, 0.55)',
      projectionX: '#dc2626',
      projectionY: '#2563eb',
      coordTagBg: 'rgba(255, 255, 255, 0.90)',
      coordTagBorder: 'rgba(15, 23, 42, 0.18)',
      coordTagText: '#0f172a',
      stickPrimary: '#0f172a',
      stickSecondary: '#64748b',
      stickAccent: '#2563eb',
      stickEye: '#f8fafc',
      shadow: 'rgba(15, 23, 42, 0.20)',
      dust: 'rgba(100, 116, 139, 0.42)',
      dashGhost: 'rgba(37, 99, 235, 0.28)',
      climbGlow: 'rgba(37, 99, 235, 0.55)',
      windStreak: 'rgba(15, 23, 42, 0.28)',
      musicNote: '#d97706',
      funcStroke: '#2563eb',
      funcGlow: 'rgba(37, 99, 235, 0.18)',
      funcTangent: '#d97706',
    },
  };

  MathStickGame.utils = {
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    damp(current, target, lambda, dt) {
      return current + (target - current) * (1 - Math.exp(-lambda * dt));
    },
    moveToward(current, target, maxDelta) {
      if (Math.abs(target - current) <= maxDelta) return target;
      return current + Math.sign(target - current) * maxDelta;
    },
    mod(n, m) {
      return ((n % m) + m) % m;
    },
  };
})(window);
