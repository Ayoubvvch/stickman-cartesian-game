(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { utils } = MathStickGame;

  const MATH_FUNCS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    abs: Math.abs,
    sqrt: Math.sqrt,
    ln: Math.log,
    log: Math.log10 ? Math.log10 : (v) => Math.log(v) / Math.LN10,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sign: Math.sign,
  };

  const MATH_CONSTS = {
    pi: Math.PI,
    e: Math.E,
  };

  function tokenize(expr) {
    const tokens = [];
    const s = expr.trim();
    let i = 0;

    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || ch === '\n') {
        i++;
        continue;
      }

      if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9')) {
        let end = i;
        let seenDot = false;
        while (end < s.length) {
          const c = s[end];
          if (c >= '0' && c <= '9') {
            end++;
          } else if (c === '.' && !seenDot) {
            seenDot = true;
            end++;
          } else {
            break;
          }
        }
        if (
          end < s.length &&
          (s[end] === 'e' || s[end] === 'E') &&
          (s[end + 1] === '+' || s[end + 1] === '-' || (s[end + 1] >= '0' && s[end + 1] <= '9'))
        ) {
          let expEnd = end + 1;
          if (s[expEnd] === '+' || s[expEnd] === '-') expEnd++;
          let hasDigit = false;
          while (expEnd < s.length && s[expEnd] >= '0' && s[expEnd] <= '9') {
            expEnd++;
            hasDigit = true;
          }
          if (hasDigit) end = expEnd;
        }
        const num = Number(s.slice(i, end));
        if (!Number.isFinite(num)) {
          throw new Error('Invalid number');
        }
        tokens.push({ type: 'num', value: num });
        i = end;
        continue;
      }

      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === 'π') {
        if (ch === 'π') {
          tokens.push({ type: 'var', value: 'pi' });
          i++;
          continue;
        }
        let end = i + 1;
        while (
          end < s.length &&
          ((s[end] >= 'a' && s[end] <= 'z') || (s[end] >= 'A' && s[end] <= 'Z'))
        ) {
          end++;
        }
        const word = s.slice(i, end).toLowerCase();
        if (word === 'x') {
          tokens.push({ type: 'var', value: 'x' });
        } else if (Object.prototype.hasOwnProperty.call(MATH_CONSTS, word)) {
          tokens.push({ type: 'var', value: word });
        } else if (Object.prototype.hasOwnProperty.call(MATH_FUNCS, word)) {
          tokens.push({ type: 'func', value: word });
        } else {
          throw new Error(`Unknown identifier: ${word}`);
        }
        i = end;
        continue;
      }

      if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }
      if (ch === '×') {
        tokens.push({ type: 'op', value: '*' });
        i++;
        continue;
      }
      if (ch === '÷') {
        tokens.push({ type: 'op', value: '/' });
        i++;
        continue;
      }
      if (ch === '−') {
        tokens.push({ type: 'op', value: '-' });
        i++;
        continue;
      }
      if (ch === '(' || ch === ')') {
        tokens.push({ type: ch, value: ch });
        i++;
        continue;
      }

      throw new Error(`Unexpected symbol "${ch}"`);
    }

    // Insert implicit multiplication tokens (e.g., 2x, 3sin(x), (x+1)(x-1), x pi)
    const out = [];
    for (let t = 0; t < tokens.length; t++) {
      const curr = tokens[t];
      if (t > 0) {
        const prev = tokens[t - 1];
        const prevIsValue = prev.type === 'num' || prev.type === 'var' || prev.type === ')';
        const currStartsFactor =
          curr.type === 'num' || curr.type === 'var' || curr.type === 'func' || curr.type === '(';
        if (prevIsValue && currStartsFactor) {
          out.push({ type: 'op', value: '*' });
        }
      }
      out.push(curr);
    }

    return out;
  }

  function compileExpression(rawExpr) {
    let cleaned = String(rawExpr || '').trim();
    cleaned = cleaned.replace(/^y\s*=\s*/i, '').replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '');
    if (!cleaned) {
      return { ok: false, error: 'Enter a formula in x' };
    }

    let tokens;
    try {
      tokens = tokenize(cleaned);
    } catch (err) {
      return { ok: false, error: err.message };
    }
    if (tokens.length === 0) {
      return { ok: false, error: 'Empty formula' };
    }

    let pos = 0;
    const peek = () => tokens[pos] || null;
    const consume = () => tokens[pos++];

    function parseExpr() {
      let node = parseTerm();
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseTerm();
        const left = node;
        node = op === '+' ? (x) => left(x) + right(x) : (x) => left(x) - right(x);
      }
      return node;
    }

    function parseTerm() {
      let node = parseUnary();
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        const op = consume().value;
        const right = parseUnary();
        const left = node;
        node = op === '*' ? (x) => left(x) * right(x) : (x) => left(x) / right(x);
      }
      return node;
    }

    function parseUnary() {
      if (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const operand = parseUnary();
        return op === '-' ? (x) => -operand(x) : operand;
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().type === 'op' && peek().value === '^') {
        consume();
        const exponent = parseUnary();
        return (x) => Math.pow(base(x), exponent(x));
      }
      return base;
    }

    function parsePrimary() {
      const tok = peek();
      if (!tok) {
        throw new Error('Unexpected end of formula');
      }
      if (tok.type === 'num') {
        consume();
        const val = tok.value;
        return () => val;
      }
      if (tok.type === 'var') {
        consume();
        if (tok.value === 'x') return (x) => x;
        const c = MATH_CONSTS[tok.value];
        return () => c;
      }
      if (tok.type === 'func') {
        consume();
        const fn = MATH_FUNCS[tok.value];
        if (!peek() || peek().type !== '(') {
          throw new Error(`Expected "(" after ${tok.value}`);
        }
        consume();
        const arg = parseExpr();
        if (!peek() || peek().type !== ')') {
          throw new Error(`Missing ")" after ${tok.value}(...)`);
        }
        consume();
        return (x) => fn(arg(x));
      }
      if (tok.type === '(') {
        consume();
        const inner = parseExpr();
        if (!peek() || peek().type !== ')') {
          throw new Error('Missing closing ")"');
        }
        consume();
        return inner;
      }
      throw new Error(`Unexpected token "${tok.value}"`);
    }

    try {
      const fn = parseExpr();
      if (pos < tokens.length) {
        return { ok: false, error: `Unexpected "${tokens[pos].value}"` };
      }
      // Verify callable without runtime throws on sample probe
      fn(0);
      return { ok: true, fn, expression: cleaned };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const PRESETS = [
    { id: 'sine', label: 'Sine Wave', expr: '1.6 * sin(0.7 * x) + 2.2' },
    { id: 'parabola', label: 'Parabola', expr: '0.12 * x^2 + 0.5' },
    { id: 'hill', label: 'Gaussian Hill', expr: '4.5 * exp(-0.18 * x^2)' },
    { id: 'abs', label: 'Half-Pipe', expr: 'abs(0.45 * x)' },
    { id: 'coaster', label: 'Roller Coaster', expr: '1.5 * sin(0.55 * x) + 0.7 * cos(1.3 * x) + 3.0' },
    { id: 'ramp', label: 'Ramp', expr: '0.35 * x + 1.5' },
  ];

  class FunctionPlotter {
    constructor() {
      this.presets = PRESETS;
      this.enabled = true;
      this.showDerivative = false;
      this.expression = PRESETS[0].expr;
      this.evalFn = null;
      this.customSampler = null;
      this.customTag = '';
      this.error = '';

      this._cacheKey = '';
      this._cachedPaths = [];
      this._cachedDerivPaths = [];

      this.setExpression(this.expression, true);
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      this._cacheKey = '';
    }

    setShowDerivative(enabled) {
      this.showDerivative = Boolean(enabled);
      this._cacheKey = '';
    }

    setCustomSampler(samplerFn, tag = '') {
      this.customSampler = typeof samplerFn === 'function' ? samplerFn : null;
      this.customTag = tag || '';
      this._cacheKey = '';
    }

    setExpression(rawExpr, autoEnable = true) {
      const compiled = compileExpression(rawExpr);
      if (!compiled.ok) {
        this.error = compiled.error;
        return { ok: false, error: compiled.error };
      }
      this.expression = compiled.expression;
      this.evalFn = compiled.fn;
      this.error = '';
      if (autoEnable) {
        this.enabled = true;
      }
      this._cacheKey = '';
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

    sample(x) {
      const y = this.evaluateY(x);
      if (!Number.isFinite(y)) {
        return { valid: false, y: NaN, dy: 0, d2y: 0, angle: 0 };
      }
      const h = 0.004;
      const ym = this.evaluateY(x - h);
      const yp = this.evaluateY(x + h);

      let dy = 0;
      let d2y = 0;
      if (Number.isFinite(ym) && Number.isFinite(yp)) {
        dy = (yp - ym) / (2 * h);
        d2y = (yp - 2 * y + ym) / (h * h);
      } else if (Number.isFinite(yp)) {
        dy = (yp - y) / h;
      } else if (Number.isFinite(ym)) {
        dy = (y - ym) / h;
      }

      if (!Number.isFinite(dy) || Math.abs(dy) > 40) {
        return { valid: false, y: NaN, dy: 0, d2y: 0, angle: 0 };
      }
      if (!Number.isFinite(d2y)) d2y = 0;

      return {
        valid: true,
        y,
        dy,
        d2y: utils.clamp(d2y, -30, 30),
        angle: Math.atan2(dy, 1),
      };
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
      const stepPx = 6;
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
        const hDeriv = 0.005;
        this._cachedDerivPaths = this._buildSampledPaths(
          (wx) => {
            const ym = this.evaluateY(wx - hDeriv);
            const yp = this.evaluateY(wx + hDeriv);
            if (!Number.isFinite(ym) || !Number.isFinite(yp)) return NaN;
            const d = (yp - ym) / (2 * hDeriv);
            return Number.isFinite(d) && Math.abs(d) <= 40 ? d : NaN;
          },
          camera,
          gridRenderer
        );
      } else {
        this._cachedDerivPaths = [];
      }
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

      this._ensureCachedPaths(camera, gridRenderer);
      const isBlack = theme.bg === '#000000';

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Optional y = f'(x) live derivative curve overlay
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

      // Soft aura outer glow + crisp core curve (zero shadowBlur!)
      this._strokePaths(
        ctx,
        this._cachedPaths,
        7,
        theme.funcGlow,
        isBlack ? 'lighter' : 'source-over'
      );
      this._strokePaths(ctx, this._cachedPaths, 2.6, theme.funcStroke, 'source-over');

      // Live tangent vector, slope f'(x), & curvature f''(x) when surfing the curve
      if (stickman && stickman.surfingCurve) {
        const pt = gridRenderer.worldToScreen(stickman.x, stickman.y, camera);
        const angle = stickman.curveSlopeAngle;
        const tanDx = Math.cos(angle);
        const tanDy = -Math.sin(angle); // screen y is inverted
        const halfLen = 54;
        const curSample = this.sample(stickman.x);
        const dy = curSample.valid ? curSample.dy : Math.tan(angle);
        const d2y = curSample.valid ? curSample.d2y : 0;

        // Vertical connector to the live derivative curve point (x, f'(x))
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
