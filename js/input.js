(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { CONFIG, utils } = MathStickGame;

  const PREVENT_SCROLL_CODES = new Set([
    'Space',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ]);

  const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
  const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
  const UP_KEYS = ['ArrowUp', 'KeyW'];
  const DOWN_KEYS = ['ArrowDown', 'KeyS'];
  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  const CROUCH_KEYS = ['ArrowDown', 'KeyS'];
  const SPRINT_KEYS = ['ShiftLeft', 'ShiftRight'];
  const DASH_KEYS = ['KeyE', 'KeyK', 'KeyX'];
  const CLIMB_KEYS = ['KeyQ'];
  const FREEFALL_KEYS = ['KeyG'];
  const DANCE_KEYS = ['KeyZ'];
  const FLIP_KEYS = ['KeyF'];
  const RESET_KEYS = ['KeyR'];

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable === true;
  }

  class InputManager {
    constructor() {
      this.keysDown = new Set();
      this.justPressedKeys = new Set();
      this.justReleasedKeys = new Set();

      this.virtualState = {
        left: false,
        right: false,
        up: false,
        down: false,
        sprint: false,
        jump: false,
        dash: false,
        dance: false,
      };
      this.prevVirtualJump = false;
      this.prevVirtualDash = false;
      this.prevVirtualDance = false;
      this.prevVirtualUp = false;

      this.queuedFreeFall = false;
      this.queuedDance = false;

      this.activeSource = 'keyboard';
      this.activeGamepadIndex = null;
      this.prevGamepadButtons = new Map();
      this.prevGpStickUp = false;
      this._btnScratch = [];
      this.hasConnectedGamepad = false;
      this.onWake = null;

      this.gamepadSummary = {
        connected: false,
        id: '',
        stickX: 0,
        stickY: 0,
        a: false,
        b: false,
        x: false,
        y: false,
        run: false,
      };

      this._gpResult = {
        stickX: 0,
        stickY: 0,
        dpadX: 0,
        dpadUp: false,
        dpadDown: false,
        triggerSprint: false,
        jumpHeld: false,
        jumpPressed: false,
        jumpReleased: false,
        crouchHeld: false,
        releaseClimbPressed: false,
        climbUpHeld: false,
        climbDownHeld: false,
        climbGrabPressed: false,
        dashPressed: false,
        yButtonPressed: false,
        resetPressed: false,
      };

      this._frameSample = {
        moveX: 0,
        analogMagnitude: 0,
        isAnalogStick: false,
        sprint: false,
        jumpHeld: false,
        jumpPressed: false,
        jumpReleased: false,
        spaceHeld: false,
        crouchHeld: false,
        climbUpHeld: false,
        climbDownHeld: false,
        climbGrabPressed: false,
        releaseClimbPressed: false,
        dashPressed: false,
        freeFallPressed: false,
        dancePressed: false,
        danceStyleIndex: null,
        flipPressed: false,
        gamepadYPressed: false,
        resetPressed: false,
        activeSource: 'keyboard',
        gamepad: this.gamepadSummary,
      };

      this._syncInitialGamepads();
      this._bindEvents();
    }

    setWakeCallback(fn) {
      this.onWake = typeof fn === 'function' ? fn : null;
    }

    _notifyWake() {
      if (this.onWake) this.onWake();
    }

    _syncInitialGamepads() {
      if (!navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      if (!pads) return;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
          this.hasConnectedGamepad = true;
          return;
        }
      }
    }

    hasActiveInput() {
      if (
        this.keysDown.size > 0 ||
        this.justPressedKeys.size > 0 ||
        this.justReleasedKeys.size > 0 ||
        this.queuedFreeFall ||
        this.queuedDance
      ) {
        return true;
      }
      const v = this.virtualState;
      return (
        v.left ||
        v.right ||
        v.up ||
        v.down ||
        v.sprint ||
        v.jump ||
        v.dash ||
        v.dance
      );
    }

    isGamepadInputActive() {
      if (!this.hasConnectedGamepad || !navigator.getGamepads) return false;
      const pads = navigator.getGamepads();
      if (!pads) return false;
      for (let i = 0; i < pads.length; i++) {
        const gp = pads[i];
        if (!gp || !gp.connected) continue;
        if (gp.axes) {
          for (let a = 0; a < gp.axes.length; a++) {
            if (Math.abs(gp.axes[a]) > CONFIG.STICK_DEADZONE) return true;
          }
        }
        if (gp.buttons) {
          for (let b = 0; b < gp.buttons.length; b++) {
            const btn = gp.buttons[b];
            if (btn && (btn.pressed || btn.value > 0.35)) return true;
          }
        }
      }
      return false;
    }

    _bindEvents() {
      global.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) return;
        if (PREVENT_SCROLL_CODES.has(e.code)) {
          e.preventDefault();
        }
        if (!this.keysDown.has(e.code)) {
          this.justPressedKeys.add(e.code);
        }
        this.keysDown.add(e.code);
        this.activeSource = 'keyboard';
        this._notifyWake();
      });

      global.addEventListener('keyup', (e) => {
        if (isEditableTarget(e.target)) {
          this.keysDown.delete(e.code);
          return;
        }
        if (this.keysDown.has(e.code)) {
          this.justReleasedKeys.add(e.code);
        }
        this.keysDown.delete(e.code);
        this._notifyWake();
      });

      global.addEventListener('blur', () => {
        this.keysDown.clear();
        this.justPressedKeys.clear();
        this.justReleasedKeys.clear();
        this.clearVirtual();
        this._notifyWake();
      });

      global.addEventListener('gamepadconnected', (e) => {
        this.hasConnectedGamepad = true;
        this.activeGamepadIndex = e.gamepad.index;
        this.activeSource = 'gamepad';
        this._notifyWake();
      });

      global.addEventListener('gamepaddisconnected', (e) => {
        this.prevGamepadButtons.delete(e.gamepad.index);
        if (this.activeGamepadIndex === e.gamepad.index) {
          this.activeGamepadIndex = null;
        }
        const pads = navigator.getGamepads ? navigator.getGamepads() : null;
        let anyConn = false;
        if (pads) {
          for (let i = 0; i < pads.length; i++) {
            if (pads[i] && pads[i].connected) {
              anyConn = true;
              break;
            }
          }
        }
        this.hasConnectedGamepad = anyConn;
        this._notifyWake();
      });
    }

    triggerFreeFall() {
      this.queuedFreeFall = true;
      this._notifyWake();
    }

    triggerDance() {
      this.queuedDance = true;
      this._notifyWake();
    }

    clearVirtual() {
      for (const k of Object.keys(this.virtualState)) {
        this.virtualState[k] = false;
      }
    }

    setVirtualButton(action, pressed) {
      if (Object.prototype.hasOwnProperty.call(this.virtualState, action)) {
        this.virtualState[action] = Boolean(pressed);
        if (pressed) this.activeSource = 'touch';
        this._notifyWake();
      }
    }

    _anyInSet(set, codes) {
      for (const code of codes) {
        if (set.has(code)) return true;
      }
      return false;
    }

    _readGamepads() {
      if (!this.hasConnectedGamepad || !navigator.getGamepads) {
        if (this.gamepadSummary.connected) {
          this.gamepadSummary.connected = false;
          this.gamepadSummary.id = '';
          this.gamepadSummary.stickX = 0;
          this.gamepadSummary.stickY = 0;
          this.gamepadSummary.a = false;
          this.gamepadSummary.b = false;
          this.gamepadSummary.x = false;
          this.gamepadSummary.y = false;
          this.gamepadSummary.run = false;
        }
        this.prevGpStickUp = false;
        return null;
      }

      const pads = navigator.getGamepads();
      let chosen = null;

      if (this.activeGamepadIndex !== null && pads[this.activeGamepadIndex]) {
        chosen = pads[this.activeGamepadIndex];
      }

      for (let i = 0; i < pads.length; i++) {
        const gp = pads[i];
        if (!gp || !gp.connected) continue;
        if (!chosen) chosen = gp;

        let hasAxisInput = false;
        if (gp.axes) {
          for (let a = 0; a < gp.axes.length; a++) {
            if (Math.abs(gp.axes[a]) > CONFIG.STICK_DEADZONE) {
              hasAxisInput = true;
              break;
            }
          }
        }
        let hasBtnInput = false;
        if (!hasAxisInput && gp.buttons) {
          for (let b = 0; b < gp.buttons.length; b++) {
            const btn = gp.buttons[b];
            if (btn && (btn.pressed || btn.value > 0.35)) {
              hasBtnInput = true;
              break;
            }
          }
        }

        if (hasAxisInput || hasBtnInput) {
          chosen = gp;
          this.activeGamepadIndex = gp.index;
          this.activeSource = 'gamepad';
          break;
        }
      }

      if (!chosen || !chosen.connected) {
        this.gamepadSummary.connected = false;
        this.gamepadSummary.id = '';
        this.gamepadSummary.stickX = 0;
        this.gamepadSummary.stickY = 0;
        this.gamepadSummary.a = false;
        this.gamepadSummary.b = false;
        this.gamepadSummary.x = false;
        this.gamepadSummary.y = false;
        this.gamepadSummary.run = false;
        this.prevGpStickUp = false;
        return null;
      }

      const rawButtons = chosen.buttons || [];
      const prevBtns = this.prevGamepadButtons.get(chosen.index);
      const currBtns = this._btnScratch;
      currBtns.length = rawButtons.length;
      for (let i = 0; i < rawButtons.length; i++) {
        const b = rawButtons[i];
        currBtns[i] = Boolean(b && (b.pressed || b.value > 0.45));
      }

      const justPressed = (idx) => Boolean(currBtns[idx] && !(prevBtns && prevBtns[idx]));
      const justReleased = (idx) => Boolean(!currBtns[idx] && (prevBtns && prevBtns[idx]));

      const rawX = chosen.axes && chosen.axes.length > 0 ? chosen.axes[0] : 0;
      const rawY = chosen.axes && chosen.axes.length > 1 ? chosen.axes[1] : 0;
      const dz = CONFIG.STICK_DEADZONE;

      let stickX = 0;
      if (Math.abs(rawX) > dz) {
        stickX =
          Math.sign(rawX) * utils.clamp((Math.abs(rawX) - dz) / (1 - dz), 0, 1);
      }

      let stickY = 0;
      if (Math.abs(rawY) > dz) {
        stickY =
          Math.sign(rawY) * utils.clamp((Math.abs(rawY) - dz) / (1 - dz), 0, 1);
      }

      const dpadLeft = Boolean(currBtns[14]);
      const dpadRight = Boolean(currBtns[15]);
      const dpadUp = Boolean(currBtns[12]);
      const dpadDown = Boolean(currBtns[13]);
      const dpadX = (dpadRight ? 1 : 0) - (dpadLeft ? 1 : 0);

      const stickUpHeld = stickY < -0.5;
      const stickUpJustPressed = stickUpHeld && !this.prevGpStickUp;
      this.prevGpStickUp = stickUpHeld;

      const triggerSprint =
        Boolean(currBtns[4]) ||
        Boolean(currBtns[6]) ||
        Boolean(currBtns[7]) ||
        Boolean(chosen.buttons[6] && chosen.buttons[6].value > 0.25) ||
        Boolean(chosen.buttons[7] && chosen.buttons[7].value > 0.25);

      const result = this._gpResult;
      result.stickX = stickX;
      result.stickY = stickY;
      result.dpadX = dpadX;
      result.dpadUp = dpadUp;
      result.dpadDown = dpadDown;
      result.triggerSprint = triggerSprint;
      result.jumpHeld = Boolean(currBtns[0]);
      result.jumpPressed = justPressed(0);
      result.jumpReleased = justReleased(0);
      result.crouchHeld = Boolean(currBtns[1] || dpadDown || stickY > 0.6);
      result.releaseClimbPressed = justPressed(1);
      result.climbUpHeld = dpadUp || stickUpHeld;
      result.climbDownHeld = dpadDown || stickY > 0.5;
      result.climbGrabPressed = justPressed(12) || stickUpJustPressed;
      result.dashPressed = justPressed(2) || justPressed(5);
      result.yButtonPressed = justPressed(3);
      result.resetPressed = justPressed(8) || justPressed(9);

      this.gamepadSummary.connected = true;
      this.gamepadSummary.id = chosen.id || 'Controller';
      this.gamepadSummary.stickX = rawX;
      this.gamepadSummary.stickY = rawY;
      this.gamepadSummary.a = Boolean(currBtns[0]);
      this.gamepadSummary.b = Boolean(currBtns[1]);
      this.gamepadSummary.x = Boolean(currBtns[2]);
      this.gamepadSummary.y = Boolean(currBtns[3]);
      this.gamepadSummary.run = triggerSprint;

      if (!prevBtns || prevBtns.length !== currBtns.length) {
        this.prevGamepadButtons.set(chosen.index, currBtns.slice());
      } else {
        for (let i = 0; i < currBtns.length; i++) {
          prevBtns[i] = currBtns[i];
        }
      }
      return result;
    }

    sampleFrame() {
      const kbLeft = this._anyInSet(this.keysDown, LEFT_KEYS) || this.virtualState.left;
      const kbRight = this._anyInSet(this.keysDown, RIGHT_KEYS) || this.virtualState.right;
      const kbMoveX = (kbRight ? 1 : 0) - (kbLeft ? 1 : 0);

      const kbSprint =
        this._anyInSet(this.keysDown, SPRINT_KEYS) || this.virtualState.sprint;
      const kbJumpHeld =
        this._anyInSet(this.keysDown, JUMP_KEYS) || this.virtualState.jump;
      const kbJumpPressed =
        this._anyInSet(this.justPressedKeys, JUMP_KEYS) ||
        (this.virtualState.jump && !this.prevVirtualJump);
      const kbJumpReleased =
        this._anyInSet(this.justReleasedKeys, JUMP_KEYS) ||
        (!this.virtualState.jump && this.prevVirtualJump);

      const kbUpHeld = this._anyInSet(this.keysDown, UP_KEYS) || this.virtualState.up;
      const kbDownHeld = this._anyInSet(this.keysDown, DOWN_KEYS) || this.virtualState.down;
      const kbCrouchHeld =
        this._anyInSet(this.keysDown, CROUCH_KEYS) || this.virtualState.down;

      const kbDashPressed =
        this._anyInSet(this.justPressedKeys, DASH_KEYS) ||
        (this.virtualState.dash && !this.prevVirtualDash);
      const kbClimbPressed =
        this._anyInSet(this.justPressedKeys, CLIMB_KEYS) ||
        (this.virtualState.up && !this.prevVirtualUp);
      const kbFreeFallPressed =
        this._anyInSet(this.justPressedKeys, FREEFALL_KEYS) || this.queuedFreeFall;
      const kbDancePressed =
        this._anyInSet(this.justPressedKeys, DANCE_KEYS) ||
        (this.virtualState.dance && !this.prevVirtualDance) ||
        this.queuedDance;

      let danceStyleIndex = null;
      if (this.justPressedKeys.has('Digit1')) danceStyleIndex = 0;
      else if (this.justPressedKeys.has('Digit2')) danceStyleIndex = 1;
      else if (this.justPressedKeys.has('Digit3')) danceStyleIndex = 2;

      const kbFlipPressed = this._anyInSet(this.justPressedKeys, FLIP_KEYS);
      const kbResetPressed = this._anyInSet(this.justPressedKeys, RESET_KEYS);

      this.queuedFreeFall = false;
      this.queuedDance = false;
      this.prevVirtualJump = this.virtualState.jump;
      this.prevVirtualDash = this.virtualState.dash;
      this.prevVirtualDance = this.virtualState.dance;
      this.prevVirtualUp = this.virtualState.up;
      this.justPressedKeys.clear();
      this.justReleasedKeys.clear();

      const gp = this._readGamepads();

      let moveX = kbMoveX;
      let analogMagnitude = Math.abs(kbMoveX);
      const sprint = kbSprint || Boolean(gp && gp.triggerSprint);
      let isAnalogStick = false;

      if (gp) {
        if (gp.dpadX !== 0 && kbMoveX === 0) {
          moveX = gp.dpadX;
          analogMagnitude = 1;
        } else if (Math.abs(gp.stickX) > 0 && kbMoveX === 0) {
          moveX = gp.stickX;
          analogMagnitude = Math.abs(gp.stickX);
          isAnalogStick = true;
        }
      }

      const out = this._frameSample;
      out.moveX = utils.clamp(moveX, -1, 1);
      out.analogMagnitude = utils.clamp(analogMagnitude, 0, 1);
      out.isAnalogStick = isAnalogStick;
      out.sprint = sprint;
      out.jumpHeld = kbJumpHeld || Boolean(gp && gp.jumpHeld);
      out.jumpPressed = kbJumpPressed || Boolean(gp && gp.jumpPressed);
      out.jumpReleased = kbJumpReleased || Boolean(gp && gp.jumpReleased);
      out.spaceHeld =
        this.keysDown.has('Space') ||
        this.virtualState.jump ||
        Boolean(gp && gp.jumpHeld);
      out.crouchHeld = kbCrouchHeld || Boolean(gp && gp.crouchHeld);
      out.climbUpHeld = kbUpHeld || Boolean(gp && gp.climbUpHeld);
      out.climbDownHeld = kbDownHeld || Boolean(gp && gp.climbDownHeld);
      out.climbGrabPressed = kbClimbPressed || Boolean(gp && gp.climbGrabPressed);
      out.releaseClimbPressed =
        kbClimbPressed || Boolean(gp && gp.releaseClimbPressed);
      out.dashPressed = kbDashPressed || Boolean(gp && gp.dashPressed);
      out.freeFallPressed = kbFreeFallPressed;
      out.dancePressed = kbDancePressed;
      out.danceStyleIndex = danceStyleIndex;
      out.flipPressed = kbFlipPressed;
      out.gamepadYPressed = Boolean(gp && gp.yButtonPressed);
      out.resetPressed = kbResetPressed || Boolean(gp && gp.resetPressed);
      out.activeSource = this.activeSource;
      out.gamepad = this.gamepadSummary;
      return out;
    }
  }

  MathStickGame.InputManager = InputManager;
})(window);
