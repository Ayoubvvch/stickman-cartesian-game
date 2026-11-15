(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { FunctionPlotter } = MathStickGame;

  function compileRef(expr) {
    const res = FunctionPlotter.compileExpression(expr);
    return res.ok ? res.fn : () => NaN;
  }

  function evalScalar(fn, x) {
    if (typeof fn !== 'function') return NaN;
    const y = fn(x);
    return Number.isFinite(y) && Math.abs(y) <= 400 ? y : NaN;
  }

  function derivAt(fn, x) {
    const h = 0.004;
    const ym = evalScalar(fn, x - h);
    const yp = evalScalar(fn, x + h);
    if (Number.isFinite(ym) && Number.isFinite(yp)) {
      return (yp - ym) / (2 * h);
    }
    const y0 = evalScalar(fn, x);
    if (Number.isFinite(yp) && Number.isFinite(y0)) {
      return (yp - y0) / h;
    }
    if (Number.isFinite(ym) && Number.isFinite(y0)) {
      return (y0 - ym) / h;
    }
    return NaN;
  }

  function d2At(fn, x) {
    const h = 0.01;
    const ym = evalScalar(fn, x - h);
    const y0 = evalScalar(fn, x);
    const yp = evalScalar(fn, x + h);
    if (!Number.isFinite(ym) || !Number.isFinite(y0) || !Number.isFinite(yp)) {
      return NaN;
    }
    return (yp - 2 * y0 + ym) / (h * h);
  }

  function buildTrialDefs() {
    const refT1 = compileRef('0.25 * x^2 + 0.6');
    const refT4 = compileRef('0.05 * x^3 + 0.7 * x + 2.0');
    const refT5 = compileRef('-x + 3');

    return [
      {
        id: 'tangent-bridge',
        shortLabel: '1',
        title: '1 · جسر المماس',
        concept: "الخطية المحلية: المشتقة \u2066f'(a)\u2069 هي الميل الدقيق للمماس عند النقطة",
        prompt:
          "اصنع مستقيمًا مماسًا \u2066f(x)\u2069 يلامس المنحنى \u2066h(x) = 0.25x² + 0.6\u2069 بنعومة عند \u2066(2,\u00A01.6)\u2069 — بتطابق الارتفاع والميل معًا — ثم تزلّج عليه نحو النجمة \u2066(5,\u00A04.6)\u2069.",
        hint: "احسب \u2066h'(x) = 0.5x\u2069 ← عند \u2066x = 2\u2069 يكون \u2066h'(2) = 1.0\u2069. معادلة المماس المار من \u2066(2,\u00A01.6)\u2069 بميل \u20661\u2069 هي \u2066y = 1(x - 2) + 1.6 = x - 0.4\u2069.",
        mode: 'craft',
        starterExpr: '0.5 * x + 0.6',
        spawn: { x: 0, y: 0 },
        refFn: refT1,
        refDomain: [-5, 6],
        refLabel: 'h(x) = 0.25x² + 0.6',
        anchors: [{ x: 2.0, y: 1.6, label: "(2, 1.6) h'=1" }],
        star: { x: 5.0, y: 4.6, r: 0.72 },
        evaluate(ctx) {
          const fn = ctx.userFn;
          const valOk = Math.abs(evalScalar(fn, 2.0) - 1.6) < 0.08;
          const slopeOk = Math.abs(derivAt(fn, 2.0) - 1.0) < 0.08;
          const lineOk =
            Math.abs(d2At(fn, 2.5)) < 0.06 && Math.abs(d2At(fn, 4.0)) < 0.06;
          const mathReady = valOk && slopeOk && lineOk;
          const done = mathReady && ctx.starCollected;
          return {
            mathReady,
            done,
            checks: [
              { label: "تطابق الارتفاع: \u2066f(2) = 1.60\u2069", ok: valOk },
              { label: "تطابق الميل: \u2066f'(2) = h'(2) = 1.00\u2069", ok: slopeOk },
              { label: "مستقيم تمامًا: \u2066f''(x) = 0\u2069", ok: lineOk },
              { label: "تزلّج على المماس نحو النجمة \u2066(5,\u00A04.6)\u2069", ok: done },
            ],
          };
        },
      },
      {
        id: 'stationary-points',
        shortLabel: '2',
        title: '2 · القمم والقيعان الحرجة',
        concept: "النقط الحرجة: \u2066f'(x) = 0\u2069 تحدد القمم والقيعان المحلية",
        prompt:
          "اركب المنحنى \u2066f(x) = 0.05x³ - 0.6x + 2.2\u2069. قف عند الموضعين الأفقيين حيث \u2066f'(x) = 0\u2069 (قمة محلية \u2066f'' < 0\u2069 وقاع محلي \u2066f'' > 0\u2069) واضغط \u2066B\u2069 على كل منهما!",
        hint: "حلّ \u2066f'(x) = 0.15x² - 0.6 = 0\u2069 ← \u2066x = -2\u2069 (قمة عند \u2066y = 3.00\u2069) و\u2066x = +2\u2069 (قاع عند \u2066y = 1.40\u2069).",
        mode: 'lock-points',
        lockedExpr: '0.05 * x^3 - 0.6 * x + 2.2',
        spawn: { x: 0.0, y: 2.2 },
        targets: [
          {
            id: 'max',
            label: "قمة محلية (\u2066f'=0, f''<0\u2069)",
            x: -2.0,
            y: 3.0,
            tolX: 0.36,
          },
          {
            id: 'min',
            label: "قاع محلي (\u2066f'=0, f''>0\u2069)",
            x: 2.0,
            y: 1.4,
            tolX: 0.36,
          },
        ],
        evaluate(ctx) {
          const maxOk = ctx.lockedTargets.has('max');
          const minOk = ctx.lockedTargets.has('min');
          return {
            mathReady: maxOk && minOk,
            done: maxOk && minOk,
            checks: [
              { label: "تثبيت القمة المحلية (\u2066f' = 0, f'' < 0\u2069)", ok: maxOk },
              { label: "تثبيت القاع المحلي (\u2066f' = 0, f'' > 0\u2069)", ok: minOk },
            ],
          };
        },
      },
      {
        id: 'inflection-flip',
        shortLabel: '3',
        title: '3 · نقط الانعطاف والتقعر',
        concept: "المشتقة الثانية: \u2066f''(x) = 0\u2069 تعكس جهة التقعر (\u2066◠ ↔ ◡\u2069)",
        prompt:
          "تزلّج على منحنى الجرس \u2066f(x) = 4.0·exp(-0.125x²)\u2069. اضغط \u2066B\u2069 عند نقطتي الانعطاف حيث تنعدم وتنعكس إشارة \u2066f''(x)\u2069!",
        hint: "للدالة \u20664·exp(-0.125x²)\u2069 تكون \u2066f''(x) = 4e^(-x²/8)·(x²/16 - 1/4) = 0\u2069 ← \u2066x² = 4\u2069 ← \u2066x = -2\u2069 و\u2066x = +2\u2069.",
        mode: 'lock-points',
        lockedExpr: '4.0 * exp(-0.125 * x^2)',
        spawn: { x: -4.8, y: 0 },
        targets: [
          {
            id: 'infL',
            label: "نقطة الانعطاف اليسرى (\u2066x < 0, f''=0\u2069)",
            x: -2.0,
            y: 2.426,
            tolX: 0.38,
          },
          {
            id: 'infR',
            label: "نقطة الانعطاف اليمنى (\u2066x > 0, f''=0\u2069)",
            x: 2.0,
            y: 2.426,
            tolX: 0.38,
          },
        ],
        evaluate(ctx) {
          const leftOk = ctx.lockedTargets.has('infL');
          const rightOk = ctx.lockedTargets.has('infR');
          return {
            mathReady: leftOk && rightOk,
            done: leftOk && rightOk,
            checks: [
              { label: "نقطة الانعطاف اليسرى (\u2066f'' = 0, x < 0\u2069)", ok: leftOk },
              { label: "نقطة الانعطاف اليمنى (\u2066f'' = 0, x > 0\u2069)", ok: rightOk },
            ],
          };
        },
      },
      {
        id: 'graph-derivative',
        shortLabel: '4',
        title: "4 · ركوب منحنى المشتقة \u2066h'(x)\u2069",
        concept: "ربط منحنى الدالة \u2066h(x)\u2069 بمنحنى ميلها \u2066y = h'(x)\u2069",
        prompt:
          "اقرأ تغيّر ميل المنحنى الذهبي \u2066h(x) = 0.05x³ + 0.7x + 2.0\u2069. اشتقّه وارسم \u2066y = h'(x)\u2069 لبناء مسار القطع المكافئ والتزلّج نحو النجمة \u2066(4,\u00A03.1)\u2069.",
        hint: "قاعدة القوى: \u2066d/dx(0.05x³ + 0.7x + 2.0) = 0.15x² + 0.7\u2069.",
        mode: 'craft',
        starterExpr: '0.7',
        spawn: { x: 0, y: 0 },
        refFn: refT4,
        refDomain: [-4.8, 4.8],
        refLabel: 'h(x) = 0.05x³ + 0.7x + 2.0',
        star: { x: 4.0, y: 3.1, r: 0.75 },
        evaluate(ctx) {
          const fn = ctx.userFn;
          let maxDiff = Infinity;
          if (typeof fn === 'function') {
            maxDiff = 0;
            for (let x = -4; x <= 4.001; x += 0.5) {
              const u = evalScalar(fn, x);
              const target = 0.15 * x * x + 0.7;
              if (!Number.isFinite(u)) {
                maxDiff = Infinity;
                break;
              }
              maxDiff = Math.max(maxDiff, Math.abs(u - target));
            }
          }
          const matchOk = maxDiff < 0.06;
          const done = matchOk && ctx.starCollected;
          return {
            mathReady: matchOk,
            done,
            checks: [
              { label: "الدالة تطابق \u2066y = h'(x)\u2069 على كامل المجال", ok: matchOk },
              { label: "اركب منحنى \u2066h'(x)\u2069 إلى النجمة \u2066(4,\u00A03.1)\u2069", ok: done },
            ],
          };
        },
      },
      {
        id: 'smooth-seam',
        shortLabel: '5',
        title: "5 · وصلة ناعمة قابلة للاشتقاق (\u2066C¹\u2069)",
        concept: 'الاشتقاقية تعني وصلة ملساء بلا أي زاوية أو انكسار',
        prompt:
          "تبدأ فوق المنزلق \u2066h(x) = -x + 3\u2069 (\u2066x ≤ 2\u2069). صمّم \u2066f(x)\u2069 للمجال \u2066x ≥ 2\u2069 بحيث تطابق \u2066f(2) = 1\u2069 والميل \u2066f'(2) = -1\u2069 نحو النجمة \u2066(6,\u00A01)\u2069. أي انكسار سيسقطك!",
        hint: "قطع مكافئ \u2066y = a(x - 4)² + c\u2069: من \u2066f(2) = 4a + c = 1\u2069 و\u2066f'(2) = -4a = -1\u2069 ← \u2066a = 0.25, c = 0\u2069. الصيغة: \u20660.25 * (x - 4)^2\u2069.",
        mode: 'craft',
        starterExpr: 'x - 1',
        spawn: { x: -1.0, y: 4.0 },
        refFn: refT5,
        refDomain: [-3, 2],
        refLabel: 'h(x) = -x + 3 (x ≤ 2)',
        customSampler(x, userFn) {
          if (x <= 2.0) return -x + 3;
          return typeof userFn === 'function' ? userFn(x) : NaN;
        },
        customTag: 'trial5-seam',
        anchors: [{ x: 2.0, y: 1.0, label: "Seam (2, 1) m=-1" }],
        star: { x: 6.0, y: 1.0, r: 0.76 },
        evaluate(ctx) {
          const fn = ctx.userFn;
          const c0Ok = Math.abs(evalScalar(fn, 2.0) - 1.0) < 0.08;
          const c1Ok = Math.abs(derivAt(fn, 2.0) - -1.0) < 0.1;
          const mathReady = c0Ok && c1Ok;
          const done = mathReady && ctx.starCollected;
          return {
            mathReady,
            done,
            checks: [
              { label: "الاتصال \u2066C⁰: f(2) = 1.00\u2069", ok: c0Ok },
              { label: "نعومة المشتقة \u2066C¹: f'(2) = -1.00\u2069", ok: c1Ok },
              { label: "اعبر الوصلة \u2066x = 2\u2069 نحو النجمة \u2066(6,\u00A01)\u2069", ok: done },
            ],
          };
        },
      },
      {
        id: 'launch-calculus',
        shortLabel: '6',
        title: '6 · حساب القفزة والميل',
        concept: "الارتفاع \u2066f(2)\u2069 والميل \u2066f'(2)\u2069 يحددان مسار الانطلاق المماسي",
        prompt:
          "ينقطع المسار عند حافة \u2066x = 2\u2069. صمّم \u2066f(x)\u2069 بحيث يكون الارتفاع \u2066f(2) ∈ [1.5,\u00A04.2]\u2069 وميل الانطلاق \u2066f'(2) ∈ [0.6,\u00A02.2]\u2069، ثم انطلق مسرعًا من الحافة نحو النجمة \u2066(4.8,\u00A03.4)\u2069.",
        hint: "جرّب \u20660.3 * x^2 + 1.4\u2069 (يعطي \u2066f(2)=2.6\u2069 و\u2066f'(2)=1.2\u2069 ← زاوية ≈ 50°) أو \u2066x + 1.2\u2069؛ اصعد على المنحنى وانطلق يمينًا من \u2066x = 2\u2069!",
        mode: 'craft',
        starterExpr: '0.15 * x^2 + 0.8',
        spawn: { x: -2.0, y: 0 },
        customSampler(x, userFn) {
          if (x > 2.0) return NaN;
          return typeof userFn === 'function' ? userFn(x) : NaN;
        },
        customTag: 'trial6-cliff',
        anchors: [
          {
            x: 2.0,
            getY(fn) {
              return evalScalar(fn, 2.0);
            },
            label: 'Takeoff Lip x = 2',
          },
        ],
        star: { x: 4.8, y: 3.4, r: 0.88 },
        evaluate(ctx) {
          const fn = ctx.userFn;
          const y2 = evalScalar(fn, 2.0);
          const m2 = derivAt(fn, 2.0);
          const hOk = Number.isFinite(y2) && y2 >= 1.5 && y2 <= 4.2;
          const mOk = Number.isFinite(m2) && m2 >= 0.6 && m2 <= 2.2;
          const mathReady = hOk && mOk;
          const done = mathReady && ctx.starCollected;
          return {
            mathReady,
            done,
            checks: [
              { label: "ارتفاع الحافة \u2066f(2) ∈ [1.5,\u00A04.2]\u2069", ok: hOk },
              { label: "ميل الانطلاق \u2066f'(2) ∈ [0.6,\u00A02.2]\u2069", ok: mOk },
              { label: "انطلق من الحافة نحو النجمة \u2066(4.8,\u00A03.4)\u2069", ok: done },
            ],
          };
        },
      },
    ];
  }

  class ChallengeManager {
    constructor(functionsPlotter, stickman, particles) {
      this.functions = functionsPlotter;
      this.stickman = stickman;
      this.particles = particles;
      this.trials = buildTrialDefs();

      this.active = false;
      this.currentIndex = 0;
      this.completed = new Set();

      this.lockedTargets = new Set();
      this.starCollected = false;
      this.showHint = false;
      this.feedback = null;
      this.feedbackTimer = 0;
      this._prevStickX = 0;
      this._pulseTime = 0;
      this._lastEval = { mathReady: false, done: false, checks: [] };
      this._evalCacheKey = '';
      this._refPathKey = '';
      this._refPath = null;
      this._refLabelWorld = null;

      this._savedFreeExpr = functionsPlotter.expression;
      this._savedFreeEnabled = functionsPlotter.enabled;
    }

    getCurrentTrial() {
      return this.trials[this.currentIndex];
    }

    enter() {
      if (!this.active) {
        this._savedFreeExpr = this.functions.expression;
        this._savedFreeEnabled = this.functions.enabled;
      }
      this.active = true;
      this.loadTrial(this.currentIndex);
    }

    exit() {
      if (!this.active) return;
      this.active = false;
      this.functions.setCustomSampler(null, '');
      this.functions.setExpression(this._savedFreeExpr, false);
      this.functions.setEnabled(this._savedFreeEnabled);
      this.stickman.reset();
      this.particles.clear();
    }

    loadTrial(idx) {
      this.currentIndex = ((idx % this.trials.length) + this.trials.length) % this.trials.length;
      const t = this.getCurrentTrial();

      this.lockedTargets.clear();
      this.starCollected = false;
      this.showHint = false;
      this.feedback = null;
      this.feedbackTimer = 0;

      const exprToPlot = t.mode === 'lock-points' ? t.lockedExpr : t.starterExpr;
      this.functions.setCustomSampler(t.customSampler || null, t.customTag || '');
      this.functions.setExpression(exprToPlot, true);

      const sp = t.spawn || { x: 0, y: 0 };
      this.stickman.resetTo(sp.x, sp.y);
      this._prevStickX = sp.x;
      if (sp.y > 0.1 && this.functions.isActive()) {
        const s = this.functions.sample(sp.x);
        if (s.valid && Math.abs(s.y - sp.y) < 0.25) {
          this.stickman._snapToCurve(s, false);
        }
      }

      this.particles.clear();
      this._evalCacheKey = '';
      this._refPathKey = '';
      this._refPath = null;
      this._refLabelWorld = null;
      this.evaluateNow(true);
    }

    resetTrial() {
      if (!this.active) return;
      this.loadTrial(this.currentIndex);
    }

    applyUserExpression(rawExpr) {
      if (!this.active) return { ok: false, error: 'التحديات غير مفعّلة' };
      const t = this.getCurrentTrial();
      if (t.mode === 'lock-points') {
        return { ok: true, expression: t.lockedExpr };
      }
      const res = this.functions.setExpression(rawExpr, true);
      if (res.ok) {
        this.starCollected = false;
        this.feedback = null;
      } else {
        this.feedback = { type: 'error', text: res.error };
        this.feedbackTimer = 3.2;
      }
      this.evaluateNow();
      return res;
    }

    markPoint() {
      if (!this.active) return;
      const t = this.getCurrentTrial();
      if (t.mode !== 'lock-points') return;

      const x = this.stickman.x;
      const s = this.functions.sample(x);
      const onCurve =
        this.stickman.surfingCurve ||
        (s.valid && Math.abs(this.stickman.y - s.y) < 0.55);

      if (!onCurve || !s.valid) {
        this.feedback = {
          type: 'error',
          text: 'اقفز أو اصعد على المنحنى f(x) قبل الضغط على [B]!',
        };
        this.feedbackTimer = 2.6;
        return;
      }

      for (const target of t.targets) {
        if (Math.abs(x - target.x) <= target.tolX) {
          if (this.lockedTargets.has(target.id)) {
            this.feedback = {
              type: 'ok',
              text: `تم تثبيت ${target.label} مسبقًا قرب \u2066x = ${target.x.toFixed(1)}\u2069!`,
            };
            this.feedbackTimer = 2.0;
            return;
          }
          this.lockedTargets.add(target.id);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const spd = 2.0 + Math.random() * 2.2;
            this.particles.spawnSpark(
              target.x,
              target.y,
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              '#4ade80',
              0.04,
              0.42
            );
          }
          const e = this.evaluateNow();
          if (e.done) {
            this.feedback = {
              type: 'ok',
              text: `أحسنت! اكتمل التحدي — تم التحقق من ${target.label}!`,
            };
          } else {
            this.feedback = {
              type: 'ok',
              text: `تم تثبيت ${target.label}! (${this.lockedTargets.size}/${t.targets.length})`,
            };
          }
          this.feedbackTimer = 3.5;
          return;
        }
      }

      if (t.id === 'stationary-points') {
        this.feedback = {
          type: 'error',
          text: `ليست نقطة حرجة عند \u2066x = ${x.toFixed(2)}\u2069: المشتقة \u2066f'(x) = ${s.dy.toFixed(2)} ≠ 0\u2069.`,
        };
      } else {
        const conc = s.d2y > 0 ? 'تقعر نحو الأعلى ◡' : 'تقعر نحو الأسفل ◠';
        this.feedback = {
          type: 'error',
          text: `ليست نقطة انعطاف عند \u2066x = ${x.toFixed(2)}\u2069: \u2066f''(x) = ${s.d2y.toFixed(2)}\u2069 (${conc}).`,
        };
      }
      this.feedbackTimer = 2.8;
    }

    evaluateNow(force = false) {
      const t = this.getCurrentTrial();
      const errFlag = this.functions.error ? 1 : 0;
      const cacheKey = `${t.id}|${this.functions.expression}|${this.functions.customTag}|${errFlag}|${this.starCollected ? 1 : 0}|${this.lockedTargets.size}`;
      if (!force && cacheKey === this._evalCacheKey) {
        return this._lastEval;
      }
      this._evalCacheKey = cacheKey;

      const userFn = this.functions.error ? null : this.functions.evalFn;
      const res = t.evaluate({
        userFn,
        stickman: this.stickman,
        starCollected: this.starCollected,
        lockedTargets: this.lockedTargets,
      });
      this._lastEval = res;
      if (res.done) {
        this.completed.add(t.id);
      }
      return res;
    }

    update(dt) {
      if (!this.active) return;
      this._pulseTime += dt;
      if (this.feedbackTimer > 0) {
        this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
        if (this.feedbackTimer === 0 && !this._lastEval.done) {
          this.feedback = null;
        }
      }

      const t = this.getCurrentTrial();

      // Seam C1 kink derailment check for Trial 5
      if (t.id === 'smooth-seam') {
        const crossed = this._prevStickX <= 2.0 && this.stickman.x > 2.0;
        if (crossed && this.stickman.surfingCurve) {
          const ev = this.evaluateNow();
          if (!ev.mathReady) {
            const slopeUser = derivAt(this.functions.evalFn, 2.0);
            this.stickman.surfingCurve = false;
            this.stickman.grounded = false;
            this.stickman.x = 2.16;
            this.stickman.y = Math.max(1.18, this.stickman.y + 0.16);
            this.stickman.vx = Math.max(this.stickman.vx * 0.4, 2.2);
            this.stickman.vy = 5.4;
            this.stickman.flipDuration = 0.45;
            this.stickman.flipTimer = 0.45;
            this.stickman.flipDir = 1;
            this.particles.spawnLandingBurst(2.0, 1.5);
            this.feedback = {
              type: 'error',
              text: Number.isFinite(slopeUser)
                ? `انكسار عند \u2066x = 2\u2069! ميل المنزلق = \u2066-1.00\u2069، وميلك \u2066f'(2) = ${slopeUser.toFixed(2)}\u2069.`
                : "انقطاع في الوصلة عند \u2066x = 2\u2069! طابِق \u2066f(2) = 1.00\u2069 والميل \u2066-1.00\u2069.",
            };
            this.feedbackTimer = 4.0;
          }
        }
      }

      this._prevStickX = this.stickman.x;

      const ev = this.evaluateNow();
      if (t.star && !this.starCollected) {
        const bodyY = this.stickman.y + 0.9;
        const dx = this.stickman.x - t.star.x;
        const dyFoot = this.stickman.y - t.star.y;
        const dyBody = bodyY - t.star.y;
        const d = Math.min(Math.hypot(dx, dyFoot), Math.hypot(dx, dyBody));
        if (d <= t.star.r) {
          if (ev.mathReady) {
            this.starCollected = true;
            this.evaluateNow();
            for (let i = 0; i < 16; i++) {
              const a = (i / 16) * Math.PI * 2;
              const spd = 2.2 + Math.random() * 2.8;
              this.particles.spawnSpark(
                t.star.x,
                t.star.y,
                Math.cos(a) * spd,
                Math.sin(a) * spd,
                i % 2 === 0 ? '#4ade80' : '#fde047',
                0.042,
                0.55
              );
            }
            this.feedback = {
              type: 'ok',
              text:
                this.completed.size === this.trials.length
                  ? `مذهل! أتممت ${t.title} وأكملت جميع التحديات الستة!`
                  : `${t.title} — تم الاجتياز! انتقل إلى التحدي التالي!`,
            };
            this.feedbackTimer = 5.0;
          } else {
            this.feedback = {
              type: 'error',
              text: 'النجمة مقفلة — حقّق شروط المشتقات في القائمة أولًا!',
            };
            this.feedbackTimer = 2.6;
          }
        }
      }
    }

    _drawStarShape(ctx, cx, cy, outerR, innerR, points = 5) {
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const ang = (i * Math.PI) / points - Math.PI * 0.5;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    render(ctx, camera, gridRenderer, theme) {
      if (!this.active) return;

      const t = this.getCurrentTrial();
      const ev = this._lastEval;
      const isBlack = theme.bg === '#000000';

      ctx.save();

      // 1. Optional reference curve h(x) in dashed gold/violet (cached Path2D)
      if (t.refFn) {
        const w = gridRenderer.width;
        const h = gridRenderer.height;
        const refKey = `${t.id}|${camera.x.toFixed(4)}|${camera.y.toFixed(4)}|${camera.ppu.toFixed(2)}|${w}x${h}`;
        const [dMin, dMax] = t.refDomain || [-8, 8];

        if (refKey !== this._refPathKey) {
          this._refPathKey = refKey;
          const hw = w * 0.5;
          const hh = h * 0.5;
          const stepPx = 6;
          let pathOpen = false;
          let count = 0;
          const path = typeof Path2D === 'function' ? new Path2D() : [];

          for (let sx = -stepPx; sx <= w + stepPx; sx += stepPx) {
            const wx = camera.x + (sx - hw) / camera.ppu;
            if (wx < dMin || wx > dMax) {
              pathOpen = false;
              continue;
            }
            const wy = evalScalar(t.refFn, wx);
            if (!Number.isFinite(wy)) {
              pathOpen = false;
              continue;
            }
            const sy = hh - (wy - camera.y) * camera.ppu;
            if (typeof Path2D === 'function') {
              if (!pathOpen) {
                path.moveTo(sx, sy);
                pathOpen = true;
              } else {
                path.lineTo(sx, sy);
              }
            } else {
              path.push(pathOpen ? 1 : 0, sx, sy);
              pathOpen = true;
            }
            count++;
          }
          this._refPath = count >= 2 ? path : null;

          if (t.refLabel) {
            const lxWorld = Math.min(dMax - 0.5, Math.max(dMin + 0.8, camera.x - 1.5));
            const lyWorld = evalScalar(t.refFn, lxWorld);
            this._refLabelWorld = Number.isFinite(lyWorld) ? { x: lxWorld, y: lyWorld } : null;
          } else {
            this._refLabelWorld = null;
          }
        }

        if (this._refPath) {
          ctx.strokeStyle = isBlack ? 'rgba(250, 204, 21, 0.72)' : 'rgba(217, 119, 6, 0.8)';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([7, 5]);
          if (typeof Path2D === 'function' && this._refPath instanceof Path2D) {
            ctx.stroke(this._refPath);
          } else {
            const arr = this._refPath;
            ctx.beginPath();
            for (let i = 0; i < arr.length; i += 3) {
              if (arr[i] === 0) ctx.moveTo(arr[i + 1], arr[i + 2]);
              else ctx.lineTo(arr[i + 1], arr[i + 2]);
            }
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        if (t.refLabel && this._refLabelWorld) {
          const lp = gridRenderer.worldToScreen(
            this._refLabelWorld.x,
            this._refLabelWorld.y,
            camera
          );
          ctx.fillStyle = isBlack ? '#fde047' : '#b45309';
          ctx.font = "600 11.5px 'Cascadia Mono', 'Consolas', monospace";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(t.refLabel, lp.x, lp.y - 8);
        }
      }

      // 2. Anchor rings (e.g., Tangent point (2, 1.6), Seam (2, 1), Takeoff lip x=2)
      if (t.anchors) {
        for (const anc of t.anchors) {
          const ay = typeof anc.getY === 'function' ? anc.getY(this.functions.evalFn) : anc.y;
          if (!Number.isFinite(ay)) continue;
          const sp = gridRenderer.worldToScreen(anc.x, ay, camera);
          ctx.strokeStyle = isBlack ? '#f472b6' : '#db2777';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = isBlack ? '#f472b6' : '#db2777';
          ctx.font = "600 11px 'Cascadia Mono', 'Consolas', monospace";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(anc.label, sp.x + 10, sp.y - 6);
        }
      }

      // 3. Takeoff cliff guide at x = 2 in Trial 6
      if (t.id === 'launch-calculus') {
        const sx2 = gridRenderer.worldToScreen(2, 0, camera).x;
        ctx.strokeStyle = isBlack ? 'rgba(244, 114, 182, 0.45)' : 'rgba(219, 39, 119, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(sx2, 0);
        ctx.lineTo(sx2, gridRenderer.height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Locked critical/inflection target beacons once found
      if (t.targets) {
        for (const target of t.targets) {
          if (!this.lockedTargets.has(target.id)) continue;
          const tp = gridRenderer.worldToScreen(target.x, target.y, camera);
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 11, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = "700 11px 'Cascadia Mono', 'Consolas', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`✓ (${target.x}, ${target.y.toFixed(2)})`, tp.x, tp.y - 14);
        }
      }

      // 5. Trophy Goal Star
      if (t.star) {
        const sp = gridRenderer.worldToScreen(t.star.x, t.star.y, camera);
        const pulse = 1 + 0.08 * Math.sin(this._pulseTime * 5.2);
        const unlocked = ev.mathReady;
        const done = this.starCollected && unlocked;

        const strokeCol = done ? '#4ade80' : unlocked ? '#fde047' : '#ff4d6d';
        const fillCol = done
          ? 'rgba(74, 222, 128, 0.35)'
          : unlocked
            ? 'rgba(250, 204, 21, 0.28)'
            : 'rgba(255, 77, 109, 0.14)';

        ctx.strokeStyle = unlocked ? 'rgba(250, 204, 21, 0.32)' : 'rgba(255, 77, 109, 0.24)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, t.star.r * camera.ppu * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        this._drawStarShape(ctx, sp.x, sp.y, 16 * pulse, 7 * pulse, 5);
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = strokeCol;
        ctx.font = "700 11px 'Cascadia Mono', 'Consolas', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          done
            ? `✓ STAR (${t.star.x}, ${t.star.y})`
            : unlocked
              ? `STAR (${t.star.x}, ${t.star.y})`
              : `🔒 (${t.star.x}, ${t.star.y})`,
          sp.x,
          sp.y - 20
        );
      }

      ctx.restore();
    }
  }

  MathStickGame.ChallengeManager = ChallengeManager;
})(window);
