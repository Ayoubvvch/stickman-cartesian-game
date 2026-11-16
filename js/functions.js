(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { utils, MathCAS } = MathStickGame;

  function compileExpression(rawExpr) {
    return MathCAS.compileExpression(rawExpr);
  }

  const PRESETS = [
    { id: 'sine', label: 'Sine Wave', expr: '1.6 * sin(0.7 * x) + 2.2' },
    { id: 'parabola', label: 'Parabola', expr: '0.12 * x^2 + 0.5' },
    { id: 'hill', label: 'Gaussian Hill', expr: '4.5 * exp(-0.18 * x^2)' },
    { id: 'abs', label: 'Half-Pipe', expr: 'abs(0.45 * x)' },
    { id: 'coaster', label: 'Roller Coaster', expr: '1.5 * sin(0.55 * x) + 0.7 * cos(1.3 * x) + 3.0' },
    { id: 'ramp', label: 'Ramp', expr: '0.35 * x + 1.5' },
    { id: 'damped', label: 'Damped Wave', expr: '2.4 * exp(-0.08 * x^2) * cos(1.35 * x) + 2.2' },
    { id: 'cubic', label: 'Cubic S-Curve', expr: '0.07 * x^3 - 0.65 * x + 2.2' },
    { id: 'sinc', label: 'Sinc Pulse', expr: '3.0 * sin(1.4 * x) / (1.4 * x) + 1.4' },
  ];

  class FunctionPlotter {
    constructor() {
      this.presets = PRESETS;
      // Functions start OFF by default on launch
      this.enabled = false;
      this.showDerivative = false;
      this.showIntegral = false;
      this.showCriticalMarkers = false;

      this.expression = PRESETS[0].expr;
      this.evalFn = null;
      this.deriv1Fn = null;
      this.deriv2Fn = null;
      this.deriv1Text = '';
      this.deriv2Text = '';
      this.symbolicOk = false;

      this.customSampler = null;
      this.customTag = '';
      this.error = '';

      this._cacheKey = '';
      this._cachedPaths = [];
      this._cachedDerivPaths = [];
      this._markersCacheKey = '';
      this._cachedMarkers = [];
      this._integralCacheKey = '';
      this._cachedIntegral = 0;

      this.setExpression(this.expression, false);
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      this._cacheKey = '';
      this._integralCacheKey = '';
    }

    setShowDerivative(enabled) {
      this.showDerivative = Boolean(enabled);
      this._cacheKey = '';
    }

    setShowIntegral(enabled) {
      this.showIntegral = Boolean(enabled);
      this._integralCacheKey = '';
    }

    setShowCriticalMarkers(enabled) {
      this.showCriticalMarkers = Boolean(enabled);
      this._markersCacheKey = '';
    }

    setCustomSampler(samplerFn, tag = '') {
      this.customSampler = typeof samplerFn === 'function' ? samplerFn : null;
      this.customTag = tag || '';
      this._cacheKey = '';
      this._markersCacheKey = '';
      this._integralCacheKey = '';
    }

    setExpression(rawExpr, autoEnable = true) {
      const compiled = compileExpression(rawExpr);
      if (!compiled.ok) {
        this.error = compiled.error;
        this.deriv1Fn = null;
        this.deriv2Fn = null;
        this.deriv1Text = '';
        this.deriv2Text = '';
        this.symbolicOk = false;
        return { ok: false, error: compiled.error };
      }

      this.expression = compiled.expression;
      this.evalFn = compiled.fn;
      this.deriv1Fn = compiled.deriv1Fn || null;
      this.deriv2Fn = compiled.deriv2Fn || null;
      this.deriv1Text = compiled.deriv1Text || '';
      this.deriv2Text = compiled.deriv2Text || '';
      this.symbolicOk = Boolean(compiled.symbolicOk);
      this.error = '';

      if (autoEnable) {
        this.enabled = true;
      }
      this._cacheKey = '';
      this._markersCacheKey = '';
      this._integralCacheKey = '';
      return { ok: true, expression: this.expression };
    }

    isActive() {
      return (
        this.enabled &&
        (typeof this.customSampler === 'function' ||
          (typeof this.evalFn === 'function' && !this.error))
      );
    }

    evaluateY(x) {
      if (!this.isActive()) return NaN;
      const y = this.customSampler
        ? this.customSampler(x, this.evalFn)
        : this.evalFn(x);
      if (!Number.isFinite(y) || Math.abs(y) > 400) return NaN;
      return y;
    }

    evaluateDeriv1(x) {
      if (!this.isActive()) return NaN;
      if (!this.customSampler && typeof this.deriv1Fn === 'function') {
        const d = this.deriv1Fn(x);
        if (Number.isFinite(d) && Math.abs(d) <= 40) return d;
      }
      const h = 0.004;
      const ym = this.evaluateY(x - h);
      const yp = this.evaluateY(x + h);
      if (Number.isFinite(ym) && Number.isFinite(yp)) {
        const d = (yp - ym) / (2 * h);
        return Number.isFinite(d) && Math.abs(d) <= 40 ? d : NaN;
      }
      const y0 = this.evaluateY(x);
      if (Number.isFinite(yp) && Number.isFinite(y0)) {
        const d = (yp - y0) / h;
        return Number.isFinite(d) && Math.abs(d) <= 40 ? d : NaN;
      }
      if (Number.isFinite(ym) && Number.isFinite(y0)) {
        const d = (y0 - ym) / h;
        return Number.isFinite(d) && Math.abs(d) <= 40 ? d : NaN;
      }
      return NaN;
    }

    evaluateDeriv2(x) {
      if (!this.isActive()) return NaN;
      if (!this.customSampler && typeof this.deriv2Fn === 'function') {
        const d2 = this.deriv2Fn(x);
        if (Number.isFinite(d2)) return utils.clamp(d2, -30, 30);
      }
      const h = 0.006;
      const ym = this.evaluateY(x - h);
      const y0 = this.evaluateY(x);
      const yp = this.evaluateY(x + h);
      if (Number.isFinite(ym) && Number.isFinite(y0) && Number.isFinite(yp)) {
        const d2 = (yp - 2 * y0 + ym) / (h * h);
        return Number.isFinite(d2) ? utils.clamp(d2, -30, 30) : 0;
      }
      return 0;
    }

    sample(x) {
      const y = this.evaluateY(x);
      if (!Number.isFinite(y)) {
        return { valid: false, y: NaN, dy: 0, d2y: 0, angle: 0 };
      }

      const dy = this.evaluateDeriv1(x);
      if (!Number.isFinite(dy) || Math.abs(dy) > 40) {
        return { valid: false, y: NaN, dy: 0, d2y: 0, angle: 0 };
      }
      const d2y = this.evaluateDeriv2(x);

      return {
        valid: true,
        y,
        dy,
        d2y: Number.isFinite(d2y) ? utils.clamp(d2y, -30, 30) : 0,
        angle: Math.atan2(dy, 1),
      };
    }

    computeIntegralTo(xEnd) {
      if (!this.isActive()) return NaN;
      const key = `${this.expression}|${this.customTag}|${xEnd.toFixed(2)}`;
      if (key === this._integralCacheKey) return this._cachedIntegral;
      this._integralCacheKey = key;
      const segs = Math.min(96, Math.max(24, Math.ceil(Math.abs(xEnd) * 10)));
      this._cachedIntegral = MathCAS.integrateSimpson((t) => this.evaluateY(t), 0, xEnd, segs);
      return this._cachedIntegral;
    }

    _buildSampledPaths(evalScalarFn, camera, gridRenderer) {
      const w = gridRenderer.width;
      const h = gridRenderer.height;
      const hw = w * 0.5;
      const hh = h * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const ppu = camera.ppu;

      const paths = [];
      let currentPath = null;
      let pointCount = 0;
      let prevY = NaN;
      const stepPx = 5;
      const maxJumpUnits = Math.max(4, (h / ppu) * 0.9);
      const hasPath2D = typeof Path2D === 'function';

      for (let sx = -stepPx; sx <= w + stepPx; sx += stepPx) {
        const wx = cx + (sx - hw) / ppu;
        const wy = evalScalarFn(wx);
        const valid = Number.isFinite(wy);

        if (!valid) {
          if (currentPath && pointCount >= 2) {
            paths.push(currentPath);
          }
          currentPath = null;
          pointCount = 0;
          prevY = NaN;
          continue;
        }

        const discontinuous = Number.isFinite(prevY) && Math.abs(wy - prevY) > maxJumpUnits;
        if (discontinuous) {
          if (currentPath && pointCount >= 2) {
            paths.push(currentPath);
          }
          currentPath = null;
          pointCount = 0;
        }

        const sy = hh - (wy - cy) * ppu;
        if (!currentPath) {
          if (hasPath2D) {
            currentPath = new Path2D();
            currentPath.moveTo(sx, sy);
          } else {
            currentPath = [sx, sy];
          }
          pointCount = 1;
        } else {
          if (hasPath2D) {
            currentPath.lineTo(sx, sy);
          } else {
            currentPath.push(sx, sy);
          }
          pointCount++;
        }
        prevY = wy;
      }

      if (currentPath && pointCount >= 2) {
        paths.push(currentPath);
      }
      return paths;
    }

    _ensureCachedPaths(camera, gridRenderer) {
      const key = `${this.expression}|${this.showDerivative ? 1 : 0}|${this.customTag}|${camera.x.toFixed(4)}|${camera.y.toFixed(4)}|${camera.ppu.toFixed(2)}|${gridRenderer.width}x${gridRenderer.height}`;
      if (key === this._cacheKey) return;
      this._cacheKey = key;

      this._cachedPaths = this._buildSampledPaths(
        (wx) => this.evaluateY(wx),
        camera,
        gridRenderer
      );

      if (this.showDerivative) {
        this._cachedDerivPaths = this._buildSampledPaths(
          (wx) => this.evaluateDeriv1(wx),
          camera,
          gridRenderer
        );
      } else {
        this._cachedDerivPaths = [];
      }
    }

    _ensureCriticalMarkers(camera, gridRenderer) {
      if (!this.showCriticalMarkers || this.customSampler) {
        this._cachedMarkers = [];
        return;
      }
      const key = `${this.expression}|${camera.x.toFixed(3)}|${camera.ppu.toFixed(2)}|${gridRenderer.width}`;
      if (key === this._markersCacheKey) return;
      this._markersCacheKey = key;

      const halfWorldW = (gridRenderer.width * 0.5) / camera.ppu;
      const xMin = camera.x - halfWorldW;
      const xMax = camera.x + halfWorldW;
      const step = Math.max(0.06, (xMax - xMin) / 140);

      const markers = [];
      let prevX = xMin;
      let prevY = this.evaluateY(prevX);
      let prevD1 = this.evaluateDeriv1(prevX);

      const refineBisect = (fn, a, b) => {
        let lo = a;
        let hi = b;
        let flo = fn(lo);
        const fhi = fn(hi);
        if (Number.isFinite(flo) && Math.abs(flo) <= 1e-9) return lo;
        if (Number.isFinite(fhi) && Math.abs(fhi) <= 1e-9) return hi;
        for (let iter = 0; iter < 12; iter++) {
          const mid = (lo + hi) * 0.5;
          const fmid = fn(mid);
          if (!Number.isFinite(fmid)) return mid;
          if (Math.abs(fmid) <= 1e-9) return mid;
          if (flo * fmid <= 0) {
            hi = mid;
          } else {
            lo = mid;
            flo = fmid;
          }
        }
        return (lo + hi) * 0.5;
      };

      const mergeTol = step * 1.25;

      for (let x = xMin + step; x <= xMax && markers.length < 24; x += step) {
        const y = this.evaluateY(x);
        const d1 = this.evaluateDeriv1(x);

        if (Number.isFinite(prevY) && Number.isFinite(y) && Math.abs(y - prevY) < 4) {
          if (prevY * y <= 0 && (Math.abs(prevY) > 1e-4 || Math.abs(y) > 1e-4)) {
            const rx = refineBisect((t) => this.evaluateY(t), prevX, x);
            const ry = this.evaluateY(rx);
            if (Number.isFinite(ry) && Math.abs(ry) < 0.15) {
              const dupRoot = markers.some(
                (m) =>
                  (m.kind === 'root' || m.kind === 'root-min' || m.kind === 'root-max') &&
                  Math.abs(m.x - rx) < mergeTol
              );
              if (!dupRoot) {
                markers.push({ kind: 'root', x: rx, y: 0 });
              }
            }
          }
        }

        if (Number.isFinite(prevD1) && Number.isFinite(d1) && Math.abs(d1 - prevD1) < 6) {
          if (prevD1 * d1 <= 0 && (Math.abs(prevD1) > 1e-4 || Math.abs(d1) > 1e-4)) {
            const cx = refineBisect((t) => this.evaluateDeriv1(t), prevX, x);
            const cy = this.evaluateY(cx);
            const d2 = this.evaluateDeriv2(cx);
            if (Number.isFinite(cy)) {
              const touchesAxis = Math.abs(cy) < 0.015;
              if (touchesAxis) {
                const tangentKind = d2 < -0.05 ? 'root-max' : d2 > 0.05 ? 'root-min' : 'root';
                const nearbyRootIdx = markers.findIndex(
                  (m) =>
                    (m.kind === 'root' || m.kind === 'root-min' || m.kind === 'root-max') &&
                    Math.abs(m.x - cx) < mergeTol
                );
                if (nearbyRootIdx >= 0) {
                  markers[nearbyRootIdx] = { kind: tangentKind, x: cx, y: 0 };
                } else {
                  markers.push({ kind: tangentKind, x: cx, y: 0 });
                }
              } else {
                const kind = d2 < -0.05 ? 'max' : d2 > 0.05 ? 'min' : 'crit';
                const dupCrit = markers.some(
                  (m) => m.kind === kind && Math.abs(m.x - cx) < mergeTol
                );
                if (!dupCrit) {
                  markers.push({ kind, x: cx, y: cy });
                }
              }
            }
          }
        }

        prevX = x;
        prevY = y;
        prevD1 = d1;
      }

      this._cachedMarkers = markers;
    }

    _renderIntegralArea(ctx, camera, gridRenderer, theme, stickman) {
      if (!this.showIntegral || !stickman || this.customSampler) return;
      const xEnd = stickman.x;
      if (Math.abs(xEnd) < 0.04) return;

      const isBlack = theme.bg === '#000000';
      const a = Math.min(0, xEnd);
      const b = Math.max(0, xEnd);
      const steps = Math.min(120, Math.max(18, Math.ceil((b - a) * camera.ppu / 6)));
      const dx = (b - a) / steps;
      const axisY = gridRenderer.worldToScreen(0, 0, camera).y;

      ctx.save();
      for (let i = 0; i < steps; i++) {
        const x0 = a + i * dx;
        const x1 = x0 + dx;
        const xm = (x0 + x1) * 0.5;
        const y0 = this.evaluateY(x0);
        const y1 = this.evaluateY(x1);
        const ym = this.evaluateY(xm);
        if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(ym)) continue;

        const p0 = gridRenderer.worldToScreen(x0, y0, camera);
        const p1 = gridRenderer.worldToScreen(x1, y1, camera);

        ctx.beginPath();
        ctx.moveTo(p0.x, axisY);
        ctx.lineTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p1.x, axisY);
        ctx.closePath();

        if (ym >= 0) {
          ctx.fillStyle = isBlack ? 'rgba(56, 189, 248, 0.16)' : 'rgba(37, 99, 235, 0.14)';
        } else {
          ctx.fillStyle = isBlack ? 'rgba(255, 77, 109, 0.18)' : 'rgba(220, 38, 38, 0.14)';
        }
        ctx.fill();

        if (i % 3 === 0) {
          ctx.strokeStyle = ym >= 0
            ? (isBlack ? 'rgba(56, 189, 248, 0.28)' : 'rgba(37, 99, 235, 0.25)')
            : (isBlack ? 'rgba(255, 77, 109, 0.28)' : 'rgba(220, 38, 38, 0.25)');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Vertical boundary line at current stickman x
      const yEdge = this.evaluateY(xEnd);
      if (Number.isFinite(yEdge)) {
        const pEdge = gridRenderer.worldToScreen(xEnd, yEdge, camera);
        ctx.strokeStyle = isBlack ? 'rgba(56, 189, 248, 0.72)' : 'rgba(37, 99, 235, 0.72)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pEdge.x, axisY);
        ctx.lineTo(pEdge.x, pEdge.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const areaVal = this.computeIntegralTo(xEnd);
      if (Number.isFinite(areaVal)) {
        const pLabel = gridRenderer.worldToScreen(xEnd * 0.5, 0, camera);
        const text = `∫₀^(${xEnd.toFixed(2)}) f(t)dt = ${areaVal.toFixed(3)}`;
        ctx.direction = 'ltr';
        ctx.font = "700 11.5px 'Cascadia Mono', 'Consolas', monospace";
        const tw = ctx.measureText(text).width;
        const bx = pLabel.x - tw * 0.5 - 8;
        const by = utils.clamp(axisY + 12, 54, gridRenderer.height - 40);
        ctx.fillStyle = theme.coordTagBg;
        ctx.strokeStyle = theme.coordTagBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, by, tw + 16, 22, 7);
        } else {
          ctx.rect(bx, by, tw + 16, 22);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = areaVal >= 0 ? theme.vecJ : theme.vecI;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, pLabel.x, by + 11);
      }

      ctx.restore();
    }

    _renderCriticalMarkers(ctx, camera, gridRenderer, theme) {
      this._ensureCriticalMarkers(camera, gridRenderer);
      if (this._cachedMarkers.length === 0) return;

      const isBlack = theme.bg === '#000000';
      ctx.save();
      ctx.direction = 'ltr';
      ctx.font = "600 10.5px 'Cascadia Mono', 'Consolas', monospace";

      for (const m of this._cachedMarkers) {
        const sp = gridRenderer.worldToScreen(m.x, m.y, camera);
        if (sp.x < -30 || sp.x > gridRenderer.width + 30 || sp.y < -30 || sp.y > gridRenderer.height + 30) {
          continue;
        }
        let col = '#facc15';
        let tag = 'crit';
        if (m.kind === 'root') {
          col = isBlack ? '#f472b6' : '#db2777';
          tag = 'root';
        } else if (m.kind === 'root-max') {
          col = isBlack ? '#f472b6' : '#db2777';
          tag = 'root·max';
        } else if (m.kind === 'root-min') {
          col = isBlack ? '#f472b6' : '#db2777';
          tag = 'root·min';
        } else if (m.kind === 'max') {
          col = isBlack ? '#4ade80' : '#059669';
          tag = 'max';
        } else if (m.kind === 'min') {
          col = isBlack ? '#fb923c' : '#ea580c';
          tag = 'min';
        }

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        const placeBelow = m.kind === 'min' || m.kind === 'root-max';
        ctx.textBaseline = placeBelow ? 'top' : 'bottom';
        const dyOff = placeBelow ? 8 : -8;
        ctx.fillText(`${tag}(${m.x.toFixed(2)}, ${m.y.toFixed(2)})`, sp.x, sp.y + dyOff);
      }
      ctx.restore();
    }

    _strokePaths(ctx, paths, lineWidth, strokeStyle, compositeOp = 'source-over', dash = []) {
      ctx.globalCompositeOperation = compositeOp;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      for (let p = 0; p < paths.length; p++) {
        const seg = paths[p];
        if (typeof Path2D === 'function' && seg instanceof Path2D) {
          ctx.stroke(seg);
        } else {
          const pts = seg;
          if (pts.length < 4) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) {
            ctx.lineTo(pts[i], pts[i + 1]);
          }
          ctx.stroke();
        }
      }
      if (dash.length) ctx.setLineDash([]);
    }

    render(ctx, camera, gridRenderer, theme, stickman) {
      if (!this.isActive()) return;

      this._renderIntegralArea(ctx, camera, gridRenderer, theme, stickman);

      this._ensureCachedPaths(camera, gridRenderer);
      const isBlack = theme.bg === '#000000';

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (this.showDerivative && this._cachedDerivPaths.length > 0) {
        const derivColor = isBlack ? '#22c55e' : '#059669';
        this._strokePaths(
          ctx,
          this._cachedDerivPaths,
          2.0,
          derivColor,
          'source-over',
          [7, 5]
        );
      }

      this._strokePaths(
        ctx,
        this._cachedPaths,
        7,
        theme.funcGlow,
        isBlack ? 'lighter' : 'source-over'
      );
      this._strokePaths(ctx, this._cachedPaths, 2.6, theme.funcStroke, 'source-over');

      this._renderCriticalMarkers(ctx, camera, gridRenderer, theme);

      if (stickman && stickman.surfingCurve) {
        const pt = gridRenderer.worldToScreen(stickman.x, stickman.y, camera);
        const angle = stickman.curveSlopeAngle;
        const tanDx = Math.cos(angle);
        const tanDy = -Math.sin(angle);
        const halfLen = 54;
        const curSample = this.sample(stickman.x);
        const dy = curSample.valid ? curSample.dy : Math.tan(angle);
        const d2y = curSample.valid ? curSample.d2y : 0;

        if (this.showDerivative && Number.isFinite(dy)) {
          const dPt = gridRenderer.worldToScreen(stickman.x, dy, camera);
          ctx.strokeStyle = isBlack ? 'rgba(34, 197, 94, 0.55)' : 'rgba(5, 150, 105, 0.55)';
          ctx.lineWidth = 1.3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(dPt.x, dPt.y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = isBlack ? '#4ade80' : '#059669';
          ctx.beginPath();
          ctx.arc(dPt.x, dPt.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.strokeStyle = theme.funcTangent;
        ctx.lineWidth = 1.7;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pt.x - tanDx * halfLen, pt.y - tanDy * halfLen);
        ctx.lineTo(pt.x + tanDx * halfLen, pt.y + tanDy * halfLen);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = theme.funcStroke;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();

        const isStationary = Math.abs(dy) < 0.08;
        const isInflection = Math.abs(d2y) < 0.12 && Math.abs(dy) > 0.1;
        const concMark = d2y > 0.08 ? '◡' : d2y < -0.08 ? '◠' : '·';
        const slopeStr = `f'(x) = ${dy.toFixed(2)}  |  f'' = ${d2y.toFixed(2)} ${concMark}`;
        ctx.direction = 'ltr';
        ctx.font = "600 11.5px 'Cascadia Mono', 'Consolas', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isStationary
          ? '#4ade80'
          : isInflection
            ? '#f472b6'
            : theme.funcTangent;
        ctx.fillText(slopeStr, pt.x, pt.y + 10);
      }

      ctx.restore();
    }
  }

  FunctionPlotter.compileExpression = compileExpression;
  MathStickGame.FunctionPlotter = FunctionPlotter;
})(window);
