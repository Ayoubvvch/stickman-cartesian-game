(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { utils } = MathStickGame;

  class MathAudioSynth {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.sfxEnabled = true;

      this._surfOsc = null;
      this._surfGain = null;
      this._surfFilter = null;

      this._prevGrounded = true;
      this._prevSurfing = false;
      this._prevDash = false;
      this._prevJumps = 2;
      this._prevFlip = false;
    }

    _ensureCtx() {
      if (this.muted || !this.sfxEnabled) return null;
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        try {
          this.ctx = new AC();
        } catch (_) {
          return null;
        }
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    unlock() {
      this._ensureCtx();
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      if (this.muted && this._surfGain && this.ctx) {
        this._surfGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
    }

    setSfxEnabled(enabled) {
      this.sfxEnabled = Boolean(enabled);
      if (!this.sfxEnabled && this._surfGain && this.ctx) {
        this._surfGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      }
    }

    playTone(freq, duration = 0.09, type = 'sine', gainVal = 0.06, endFreq = null) {
      const ctx = this._ensureCtx();
      if (!ctx || this.muted || !this.sfxEnabled) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playJump(isDouble = false) {
      if (isDouble) {
        this.playTone(390, 0.12, 'triangle', 0.055, 680);
      } else {
        this.playTone(250, 0.1, 'sine', 0.05, 480);
      }
    }

    playDash() {
      this.playTone(540, 0.11, 'sawtooth', 0.028, 170);
    }

    playLand(speedY) {
      const mag = utils.clamp(Math.abs(speedY) / 18, 0.25, 1.0);
      this.playTone(135, 0.08 + mag * 0.04, 'sine', 0.04 * mag, 55);
    }

    playLockPoint() {
      this.playTone(523.25, 0.12, 'sine', 0.06, 659.25);
    }

    playStarClear() {
      this.playTone(523.25, 0.14, 'triangle', 0.06, 523.25);
      setTimeout(() => this.playTone(659.25, 0.14, 'triangle', 0.06, 659.25), 65);
      setTimeout(() => this.playTone(783.99, 0.22, 'triangle', 0.07, 1046.5), 130);
    }

    _ensureSurfNodes(ctx) {
      if (this._surfOsc) return;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 190;
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      gain.gain.value = 0;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this._surfOsc = osc;
      this._surfFilter = filter;
      this._surfGain = gain;
    }

    update(stickman, dt) {
      // Detect action transitions cleanly without modifying Stickman physics code
      if (!this._prevDash && stickman.dashTimer > 0) {
        this.playDash();
      }
      if (this._prevGrounded && !stickman.grounded && stickman.vy > 2.5 && !stickman.climbing) {
        this.playJump(false);
      } else if (!this._prevGrounded && !stickman.grounded && stickman.jumpsRemaining < this._prevJumps) {
        this.playJump(true);
      }
      if (!this._prevGrounded && stickman.grounded && stickman.landSquash > 0.12) {
        this.playLand(stickman.landSquash * 14);
      }
      if (!this._prevFlip && stickman.flipTimer > 0) {
        this.playTone(340, 0.13, 'sine', 0.04, 620);
      }

      this._prevGrounded = stickman.grounded;
      this._prevSurfing = stickman.surfingCurve;
      this._prevDash = stickman.dashTimer > 0;
      this._prevJumps = stickman.jumpsRemaining;
      this._prevFlip = stickman.flipTimer > 0;

      if (!this.ctx && !(stickman.surfingCurve && Math.abs(stickman.curveSpeed) > 0.8)) {
        return;
      }

      const ctx = this.ctx;
      if (!ctx) return;

      if (this.muted || !this.sfxEnabled || !stickman.surfingCurve || Math.abs(stickman.curveSpeed) < 0.6) {
        if (this._surfGain) {
          this._surfGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        }
        return;
      }

      this._ensureSurfNodes(ctx);
      const speedNorm = utils.clamp(Math.abs(stickman.curveSpeed) / 14.0, 0, 1);
      const slopeNorm = utils.clamp(Math.abs(Math.sin(stickman.curveSlopeAngle || 0)), 0, 1);
      const targetFreq = 165 + speedNorm * 220 + slopeNorm * 140;
      const targetGain = 0.012 + speedNorm * 0.024;

      this._surfOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.04);
      this._surfFilter.frequency.setTargetAtTime(420 + speedNorm * 900, ctx.currentTime, 0.05);
      this._surfGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
    }
  }

  MathStickGame.MathAudioSynth = MathAudioSynth;
})(window);
