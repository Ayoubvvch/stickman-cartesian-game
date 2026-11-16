(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { utils } = MathStickGame;

  const VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uIsDark;
uniform vec2 uStickPx;
uniform vec2 uVelNorm;
uniform float uSpeedNorm;
uniform float uSurfActive;
uniform float uSlopeAngle;
uniform float uDashGlow;
uniform float uDanceMode;     // 0=none, 1=purple, 2=honored, 3=disco
uniform float uDanceTime;
uniform vec2 uOrbBluePx;
uniform float uOrbBlueAlpha;
uniform vec2 uOrbRedPx;
uniform float uOrbRedAlpha;
uniform vec2 uOrbPurplePx;
uniform float uOrbPurpleAlpha;
uniform float uPurpleRadiusPx;
uniform vec3 uStyleColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  float themeMult = mix(0.45, 1.0, uIsDark);

  // 1. Subtle kinetic focus halo tinted by active Warrior Style
  vec2 dStick = px - uStickPx;
  float distStick = length(dStick);
  float baseGlow = exp(-distStick * 0.0085) * (0.09 + 0.16 * uSpeedNorm) * themeMult;
  vec3 focusCol = uStyleColor;
  col += focusCol * baseGlow;
  alpha += baseGlow * 0.72;

  // 2. Surf / Vector-Ride slope tangent energy flare
  if (uSurfActive > 0.01) {
    vec2 tang = vec2(cos(uSlopeAngle), -sin(uSlopeAngle));
    vec2 normV = vec2(-tang.y, tang.x);
    float along = dot(dStick, tang);
    float perp = dot(dStick, normV);
    float ribbon = exp(-abs(perp) * 0.075) * exp(-abs(along) * 0.009);
    float shimmer = 0.75 + 0.25 * sin(along * 0.06 - uTime * 10.0);
    float surfIntensity = ribbon * shimmer * uSurfActive * (0.30 + 0.44 * uSpeedNorm) * themeMult;
    col += mix(vec3(0.15, 0.78, 1.0), uStyleColor, 0.55) * surfIntensity;
    alpha += surfIntensity * 0.74;
  }

  // 3. Dash / high-speed directional streaks
  if (uDashGlow > 0.01 || uSpeedNorm > 0.42) {
    float intensity = max(uDashGlow, smoothstep(0.42, 1.0, uSpeedNorm) * 0.55);
    vec2 dir = length(uVelNorm) > 0.01 ? normalize(uVelNorm) : vec2(1.0, 0.0);
    vec2 perpDir = vec2(-dir.y, dir.x);
    float pCoord = dot(dStick, perpDir);
    float aCoord = dot(dStick, dir);
    float streakBand = sin(pCoord * 0.14 + hash12(vec2(floor(pCoord * 0.05), 1.0)) * 6.28);
    float wake = exp(-abs(pCoord) * 0.012) * smoothstep(20.0, -240.0, aCoord) * exp(aCoord * 0.005);
    float sVal = max(0.0, streakBand) * wake * intensity * 0.44 * themeMult;
    col += mix(vec3(0.35, 0.85, 1.0), uStyleColor, 0.65) * sVal;
    alpha += sVal * 0.82;
  }

  // 4. Dance Mode 1: Hollow Purple spatial distortion & plasma orbs
  if (uDanceMode > 0.5 && uDanceMode < 1.5) {
    if (uOrbBlueAlpha > 0.01) {
      float db = length(px - uOrbBluePx);
      float gb = exp(-db * 0.022) * uOrbBlueAlpha * 0.65 * themeMult;
      col += vec3(0.22, 0.55, 1.0) * gb;
      alpha += gb;
    }
    if (uOrbRedAlpha > 0.01) {
      float dr = length(px - uOrbRedPx);
      float gr = exp(-dr * 0.022) * uOrbRedAlpha * 0.65 * themeMult;
      col += vec3(1.0, 0.22, 0.36) * gr;
      alpha += gr;
    }
    if (uOrbPurpleAlpha > 0.01) {
      float dp = length(px - uOrbPurplePx);
      float rNorm = dp / max(18.0, uPurpleRadiusPx);
      float ring = exp(-pow((rNorm - 1.35) * 4.5, 2.0)) * uOrbPurpleAlpha;
      float ripple = (0.5 + 0.5 * sin(dp * 0.08 - uDanceTime * 11.0)) * exp(-dp * 0.0065) * uOrbPurpleAlpha;
      float gp = (exp(-dp * 0.014) * 0.72 + ring * 0.55 + ripple * 0.28) * themeMult;
      col += vec3(0.76, 0.42, 1.0) * gp;
      alpha += gp;
    }
  }

  // 5. Dance Mode 2: Honored One celestial shafts & golden-cyan aura
  if (uDanceMode > 1.5 && uDanceMode < 2.5) {
    float xOff = px.x - uStickPx.x;
    float rayCone = exp(-pow(xOff / max(60.0, 120.0 + px.y * 0.26), 2.0));
    float rayBands = 0.62 + 0.38 * sin(xOff * 0.045 - uDanceTime * 1.6);
    float vertFade = smoothstep(uRes.y, 0.0, px.y * 0.85);
    float shafts = rayCone * rayBands * vertFade * 0.24 * themeMult;

    float dAura = length(px - (uStickPx - vec2(0.0, 55.0)));
    float halo = exp(-pow((dAura - 88.0 - 6.0 * sin(uDanceTime * 2.1)) * 0.045, 2.0)) * 0.26 * themeMult;
    float coreAura = exp(-dAura * 0.0075) * 0.22 * themeMult;

    col += vec3(0.99, 0.88, 0.45) * (shafts + coreAura) + vec3(0.45, 0.85, 1.0) * halo;
    alpha += (shafts + coreAura + halo);
  }

  // 6. Dance Mode 3: Disco beat-synced prism beams
  if (uDanceMode > 2.5) {
    float ang = atan(dStick.y, dStick.x);
    float beat = pow(0.5 + 0.5 * sin(uDanceTime * 12.98), 2.0);
    float beams = pow(max(0.0, sin(ang * 6.0 + uDanceTime * 2.4)), 6.0);
    float dFade = exp(-distStick * 0.0042);
    float disco = beams * dFade * (0.14 + 0.18 * beat) * themeMult;
    vec3 prism = 0.55 + 0.45 * cos(ang + uDanceTime * 2.0 + vec3(0.0, 2.1, 4.2));
    col += prism * disco;
    alpha += disco * 0.85;
  }

  alpha = clamp(alpha, 0.0, 0.88);
  col = min(col, vec3(alpha));
  fragColor = vec4(col, alpha);
}
`;

  class WebGL2EffectsRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = null;
      this.program = null;
      this.vao = null;
      this.uniforms = {};
      this.available = false;
      this.enabled = true;
      this.width = 1;
      this.height = 1;
      this._wasCleared = false;
      this._init();
    }

    _compileShader(gl, type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    _init() {
      if (!this.canvas) return;
      let gl = null;
      try {
        gl = this.canvas.getContext('webgl2', {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: 'low-power',
          premultipliedAlpha: true,
        });
      } catch (_) {
        gl = null;
      }
      if (!gl) return;

      const vs = this._compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) return;

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog);
        return;
      }

      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      const uNames = [
        'uRes',
        'uTime',
        'uIsDark',
        'uStickPx',
        'uVelNorm',
        'uSpeedNorm',
        'uSurfActive',
        'uSlopeAngle',
        'uDashGlow',
        'uDanceMode',
        'uDanceTime',
        'uOrbBluePx',
        'uOrbBlueAlpha',
        'uOrbRedPx',
        'uOrbRedAlpha',
        'uOrbPurplePx',
        'uOrbPurpleAlpha',
        'uPurpleRadiusPx',
        'uStyleColor',
      ];
      for (const name of uNames) {
        this.uniforms[name] = gl.getUniformLocation(prog, name);
      }

      gl.disable(gl.BLEND);

      this.gl = gl;
      this.program = prog;
      this.vao = vao;
      this.available = true;
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.canvas) {
        this.canvas.style.opacity = this.enabled && this.available ? '1' : '0';
      }
      if (!this.enabled) {
        this.clear();
      }
    }

    resize(cssWidth, cssHeight) {
      this.width = Math.max(1, Math.floor(cssWidth));
      this.height = Math.max(1, Math.floor(cssHeight));
      if (!this.canvas) return;
      // Keep GL canvas at 1x CSS resolution so Intel HD / integrated GPUs stay locked at 60 FPS
      if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        if (this.gl) {
          this.gl.viewport(0, 0, this.width, this.height);
        }
        this._wasCleared = false;
      }
    }

    clear() {
      if (!this.available || !this.gl || this._wasCleared) return;
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this._wasCleared = true;
    }

    render(stickman, camera, gridRenderer, theme, timeSec) {
      if (!this.available || !this.enabled || !this.gl) return;
      const gl = this.gl;
      const u = this.uniforms;

      const sPos = gridRenderer.worldToScreen(stickman.x, stickman.y + 0.9, camera);
      const speed = Math.hypot(stickman.vx, stickman.vy);
      const speedNorm = utils.clamp(speed / 16.0, 0, 1);

      let danceMode = 0;
      let danceTime = 0;
      let bx = 0;
      let by = 0;
      let ba = 0;
      let rx = 0;
      let ry = 0;
      let ra = 0;
      let px = 0;
      let py = 0;
      let pa = 0;
      let pr = 30;

      if (stickman.dancing) {
        danceTime = stickman.danceLocalTime || stickman.danceTime || 0;
        if (stickman.danceStyle === 0) {
          danceMode = 1;
          const fx = stickman.danceFx;
          if (fx && fx.mode === 'purple') {
            if (fx.blue) {
              const pb = gridRenderer.worldToScreen(fx.blue.x, fx.blue.y, camera);
              bx = pb.x;
              by = pb.y;
              ba = fx.blue.alpha !== undefined ? fx.blue.alpha : 1;
            }
            if (fx.red) {
              const prd = gridRenderer.worldToScreen(fx.red.x, fx.red.y, camera);
              rx = prd.x;
              ry = prd.y;
              ra = fx.red.alpha !== undefined ? fx.red.alpha : 1;
            }
            if (fx.purple) {
              const pp = gridRenderer.worldToScreen(fx.purple.x, fx.purple.y, camera);
              px = pp.x;
              py = pp.y;
              pa = fx.purple.alpha !== undefined ? fx.purple.alpha : 1;
              pr = Math.max(14, (fx.purple.r || 0.35) * camera.ppu);
            }
          }
        } else if (stickman.danceStyle === 2) {
          danceMode = 2;
        } else {
          danceMode = 3;
        }
      }

      const dashGlowRaw = stickman.dashTimer > 0 ? utils.clamp(stickman.dashTimer / 0.16, 0, 1) : 0;
      const combatBurst = stickman.glFlashTimer > 0 ? utils.clamp(stickman.glFlashTimer / 0.25, 0, 1) : 0;
      const dashGlow = Math.max(dashGlowRaw, combatBurst * 0.85);
      const isDark = theme && theme.bg === '#000000' ? 1.0 : 0.0;
      const surfActive = stickman.surfingCurve || stickman.ridingVector ? 1.0 : 0.0;

      const styles = MathStickGame.CHARACTER_STYLES || {};
      const activeStyle = styles[stickman.characterStyle] || styles.gojo;
      const styleRgb = (activeStyle && activeStyle.glRgb) || [0.22, 0.78, 0.98];

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);

      gl.uniform2f(u.uRes, this.width, this.height);
      gl.uniform1f(u.uTime, timeSec);
      gl.uniform1f(u.uIsDark, isDark);
      gl.uniform2f(u.uStickPx, sPos.x, sPos.y);
      gl.uniform2f(u.uVelNorm, stickman.vx / Math.max(1, speed), -stickman.vy / Math.max(1, speed));
      gl.uniform1f(u.uSpeedNorm, speedNorm);
      gl.uniform1f(u.uSurfActive, surfActive);
      gl.uniform1f(u.uSlopeAngle, stickman.curveSlopeAngle || 0);
      gl.uniform1f(u.uDashGlow, dashGlow);
      gl.uniform1f(u.uDanceMode, danceMode);
      gl.uniform1f(u.uDanceTime, danceTime);
      gl.uniform2f(u.uOrbBluePx, bx, by);
      gl.uniform1f(u.uOrbBlueAlpha, ba);
      gl.uniform2f(u.uOrbRedPx, rx, ry);
      gl.uniform1f(u.uOrbRedAlpha, ra);
      gl.uniform2f(u.uOrbPurplePx, px, py);
      gl.uniform1f(u.uOrbPurpleAlpha, pa);
      gl.uniform1f(u.uPurpleRadiusPx, pr);
      if (u.uStyleColor) {
        gl.uniform3f(u.uStyleColor, styleRgb[0], styleRgb[1], styleRgb[2]);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
      this._wasCleared = false;
    }
  }

  MathStickGame.WebGL2EffectsRenderer = WebGL2EffectsRenderer;
})(window);
