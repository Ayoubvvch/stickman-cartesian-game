(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { utils } = MathStickGame;

  let nextEnemyId = 1;

  const WEAPONS = [
    {
      id: 'diff',
      key: '1',
      symbol: 'd/dx',
      nameAr: 'الاشتقاق',
      colorBlack: '#38bdf8',
      colorLight: '#2563eb',
      descAr: 'يخفض درجة كثيرات الحدود (x³ → 3x² → 6x → 6 → 0)',
    },
    {
      id: 'integ',
      key: '2',
      symbol: '∫ dx',
      nameAr: 'التكامل',
      colorBlack: '#a855f7',
      colorLight: '#7c3aed',
      descAr: 'يسد فجوات المساحة السالبة وينعّم زوايا |x| (ويقوّي كثيرات الحدود بالخطأ!)',
    },
    {
      id: 'negate',
      key: '3',
      symbol: '-f(x)',
      nameAr: 'النظير الجمعي',
      colorBlack: '#f472b6',
      colorLight: '#db2777',
      descAr: 'تداخل هدّام يُلغي الدوال الصامدة eˣ و sin(x) و cos(x)',
    },
    {
      id: 'vector',
      key: '4',
      symbol: '-v⃗ / ⊥',
      nameAr: 'المتجهة المضادة',
      colorBlack: '#f59e0b',
      colorLight: '#d97706',
      descAr: 'تُلغي أعداء القوة المتجهية (F⃗ + (-F⃗) = 0 أو تعامد F⃗·u⃗ = 0)',
    },
  ];

  // Polynomial helpers: coeffs[i] * x^i
  function polyDegree(coeffs) {
    for (let i = coeffs.length - 1; i >= 1; i--) {
      if (Math.abs(coeffs[i]) > 1e-4) return i;
    }
    return 0;
  }

  function isZeroPoly(coeffs) {
    return coeffs.every((c) => Math.abs(c) <= 1e-4);
  }

  function diffPoly(coeffs) {
    if (coeffs.length <= 1) return [0];
    const out = [];
    for (let i = 1; i < coeffs.length; i++) {
      out.push(coeffs[i] * i);
    }
    return out.length ? out : [0];
  }

  function integPoly(coeffs) {
    const out = [1]; // constant +1 so zero constant becomes degree 1 cleanly too
    const cap = Math.min(coeffs.length, 5);
    for (let i = 0; i < cap; i++) {
      out.push(coeffs[i] / (i + 1));
    }
    return out;
  }

  function formatNumClean(val) {
    const rounded = Math.round(val * 100) / 100;
    if (Math.abs(rounded - Math.round(rounded)) < 0.02) {
      return String(Math.round(rounded));
    }
    return rounded.toFixed(1);
  }

  function formatPoly(coeffs) {
    const parts = [];
    for (let p = coeffs.length - 1; p >= 0; p--) {
      const c = coeffs[p];
      if (Math.abs(c) < 0.04) continue;
      const sign = c < 0 ? '-' : '+';
      const absC = Math.abs(c);
      const coefStr = p > 0 && Math.abs(absC - 1) < 0.05 ? '' : formatNumClean(absC);
      const varStr =
        p === 0
          ? ''
          : p === 1
            ? 'x'
            : `x${p === 2 ? '²' : p === 3 ? '³' : p === 4 ? '⁴' : '⁵'}`;
      const term = `${coefStr}${varStr}` || '1';
      if (parts.length === 0) {
        parts.push(c < 0 ? `-${term}` : term);
      } else {
        parts.push(`${sign} ${term}`);
      }
    }
    return parts.length ? parts.join(' ') : '0';
  }

  function evalPoly(coeffs, x) {
    let sum = 0;
    let xp = 1;
    for (let i = 0; i < coeffs.length; i++) {
      sum += coeffs[i] * xp;
      xp *= x;
    }
    return sum;
  }

  function nextHarmonicDeriv(state) {
    // fn: 'sin' | 'cos' | '-sin' | '-cos' | 'exp'
    const map = { sin: 'cos', cos: '-sin', '-sin': '-cos', '-cos': 'sin', exp: 'exp' };
    return map[state] || 'exp';
  }

  function formatHarmonicLabel(kind, coeff = 2) {
    const cStr = Math.abs(coeff - 1) < 0.05 ? '' : `${formatNumClean(coeff)}·`;
    if (kind === 'exp') return `${cStr}eˣ`;
    if (kind === 'sin') return `${cStr}sin(x)`;
    if (kind === 'cos') return `${cStr}cos(x)`;
    if (kind === '-sin') return `-${cStr}sin(x)`;
    if (kind === '-cos') return `-${cStr}cos(x)`;
    return `${cStr}f(x)`;
  }

  class MathCombatArena {
    constructor(stickman, particles, vectorSystem, audioFx) {
      this.stickman = stickman;
      this.particles = particles;
      this.vectorSystem = vectorSystem;
      this.audioFx = audioFx;

      this.active = false;
      this.weaponIndex = 0; // 0: d/dx, 1: ∫dx, 2: -f(x), 3: -v⃗
      this.wave = 1;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.rightHits = 0;
      this.wrongHits = 0;
      this.hp = 100;
      this.maxHp = 100;
      this.gameOver = false;
      this.waveTransitionTimer = 0;
      this.playerInvulnTimer = 0;
      this.fireCooldown = 0;
      this.fireAnimTimer = 0;

      this.enemies = [];
      this.projectiles = [];
      this.popups = []; // floating math equations/feedback in world coordinates
      this.lastLog = '';
    }

    getWeapons() {
      return WEAPONS;
    }

    getActiveWeapon() {
      return WEAPONS[this.weaponIndex] || WEAPONS[0];
    }

    setWeaponIndex(idx) {
      const clamped = utils.clamp(Math.floor(idx), 0, WEAPONS.length - 1);
      this.weaponIndex = clamped;
    }

    enter() {
      this.active = true;
      this.resetRun();
    }

    exit() {
      this.active = false;
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.popups.length = 0;
      this.stickman.damageFlashTimer = 0;
    }

    resetRun() {
      this.weaponIndex = 0;
      this.wave = 1;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.rightHits = 0;
      this.wrongHits = 0;
      this.hp = this.maxHp;
      this.gameOver = false;
      this.waveTransitionTimer = 0;
      this.playerInvulnTimer = 0;
      this.fireCooldown = 0;
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.popups.length = 0;
      this.stickman.reset();
      if (this.vectorSystem) this.vectorSystem.clear();
      this.particles.clear();
      this.spawnWave(1);
    }

    _spawnPopup(wx, wy, text, color = '#38bdf8', life = 1.35) {
      if (this.popups.length > 28) this.popups.shift();
      this.popups.push({
        x: wx,
        y: wy,
        vy: 1.05,
        text,
        color,
        life,
        maxLife: life,
      });
    }

    _makeEnemy(type, x, y, waveScale = 1) {
      const id = nextEnemyId++;
      if (type === 'poly') {
        const deg = waveScale >= 4 ? 3 : waveScale >= 2 ? 2 : 1;
        let coeffs;
        if (deg === 1) coeffs = [2, 3];
        else if (deg === 2) coeffs = [1, -2, 1];
        else coeffs = [0, -2, 0.5, 0.5];
        return {
          id,
          type: 'poly',
          x,
          y: Math.max(0.75, y),
          vx: 0,
          vy: 0,
          r: 0.62 + deg * 0.08,
          coeffs,
          speed: 1.45 + deg * 0.28,
          hpPhase: 0,
          stunTimer: 0,
          hitFlash: 0,
          animTime: Math.random() * 6,
          damage: 14,
          rightWeapon: 'diff',
        };
      }

      if (type === 'deficit') {
        const areaTarget = -(3 + Math.min(3, Math.floor(waveScale / 2)) * 1.5);
        return {
          id,
          type: 'deficit',
          x,
          y: Math.max(0.85, y),
          vx: 0,
          vy: 0,
          r: 0.7,
          area: areaTarget,
          maxDeficit: Math.abs(areaTarget),
          speed: 1.25 + waveScale * 0.08,
          stunTimer: 0,
          hitFlash: 0,
          animTime: Math.random() * 6,
          damage: 14,
          rightWeapon: 'integ',
        };
      }

      if (type === 'harmonic') {
        const modes = ['exp', 'sin', 'cos'];
        const hKind = modes[(id + waveScale) % modes.length];
        const amp = hKind === 'exp' ? 1 : 2 + (waveScale >= 3 ? 1 : 0);
        return {
          id,
          type: 'harmonic',
          x,
          y: Math.max(2.1, y),
          baseY: Math.max(2.1, y),
          vx: 0,
          vy: 0,
          r: 0.66,
          hKind,
          amp,
          layers: waveScale >= 4 ? 2 : 1,
          speed: 1.65 + waveScale * 0.1,
          stunTimer: 0,
          hitFlash: 0,
          animTime: Math.random() * 6,
          damage: 15,
          rightWeapon: 'negate',
        };
      }

      if (type === 'vector_charger') {
        const dirSign = x > this.stickman.x ? -1 : 1;
        const fx = dirSign * (3 + (waveScale % 3));
        const fy = (id % 2 === 0 ? 1 : -1) * (1 + (waveScale % 2));
        return {
          id,
          type: 'vector_charger',
          x,
          y: Math.max(1.25, y),
          vx: 0,
          vy: 0,
          r: 0.68,
          fx,
          fy,
          norm: Math.hypot(fx, fy),
          chargeTimer: 1.2 + Math.random() * 1.4,
          dashActive: 0,
          stunTimer: 0,
          hitFlash: 0,
          animTime: Math.random() * 6,
          damage: 18,
          rightWeapon: 'vector',
        };
      }

      if (type === 'kink') {
        return {
          id,
          type: 'kink',
          x,
          y: 0.9,
          vx: 0,
          vy: 0,
          r: 0.72,
          smoothed: false, // requires ∫dx first to smooth C⁰ -> C¹, then d/dx kills (x-a)²
          coeffs: [1, -2, 1],
          speed: 1.55,
          stunTimer: 0,
          hitFlash: 0,
          animTime: Math.random() * 6,
          damage: 16,
          rightWeapon: 'integ',
        };
      }

      // Boss: multi-phase Composite Calculus Construct
      return {
        id,
        type: 'boss',
        x,
        y: 2.3,
        baseY: 2.3,
        vx: 0,
        vy: 0,
        r: 1.05,
        phase: 0, // 0: Poly Armor (d/dx), 1: Harmonic Core (-f), 2: Vector Force (-v⃗), 3: Final Integral Void (∫dx)
        coeffs: [0, -3, 1.5, 0.5], // degree 3
        hKind: 'exp',
        amp: 3,
        hHitsLeft: 2,
        fx: -5,
        fy: 2,
        area: -4.5,
        maxDeficit: 4.5,
        chargeTimer: 2.2,
        dashActive: 0,
        stunTimer: 0,
        hitFlash: 0,
        animTime: 0,
        damage: 22,
      };
    }

    spawnWave(waveNum) {
      this.wave = waveNum;
      this.enemies.length = 0;
      const sx = this.stickman.x;

      if (waveNum % 5 === 0) {
        const boss = this._makeEnemy('boss', sx + 7.5, 2.3, waveNum);
        const sideDeficit = this._makeEnemy('deficit', sx - 6.5, 1.1, waveNum);
        this.enemies.push(boss, sideDeficit);
        this.lastLog = `موجة الزعيم ${waveNum}: فكّك الطبقات بالترتيب (d/dx ← -f(x) ← -v⃗ ← ∫dx)`;
        return;
      }

      let pool;
      if (waveNum === 1) {
        pool = [
          { t: 'poly', dx: 6.8, y: 0.85 },
          { t: 'harmonic', dx: -6.5, y: 2.3 },
        ];
        this.lastLog = 'الموجة 1: استعمل [1] d/dx لكثير الحدود، و[3] -f(x) للدالة الموجية/الأسّية!';
      } else if (waveNum === 2) {
        pool = [
          { t: 'poly', dx: 7.2, y: 0.9 },
          { t: 'deficit', dx: -6.4, y: 1.0 },
          { t: 'vector_charger', dx: 8.8, y: 2.2 },
        ];
        this.lastLog = 'الموجة 2: [2] ∫dx لسد الفجوة السالبة، و[4] -v⃗ لمعادلة القوة المتجهية!';
      } else if (waveNum === 3) {
        pool = [
          { t: 'kink', dx: 6.8, y: 0.9 },
          { t: 'harmonic', dx: -7.5, y: 2.6 },
          { t: 'poly', dx: -5.2, y: 0.9 },
          { t: 'vector_charger', dx: 8.6, y: 1.8 },
        ];
        this.lastLog = 'الموجة 3: الحاجز |x| يتطلب [2] ∫dx لتنعيم الزاوية أولًا ثم [1] d/dx!';
      } else {
        const types = ['poly', 'deficit', 'harmonic', 'vector_charger', 'kink'];
        const count = Math.min(6, 3 + Math.floor(waveNum / 2));
        pool = [];
        for (let i = 0; i < count; i++) {
          const t = types[(i + waveNum) % types.length];
          const side = i % 2 === 0 ? 1 : -1;
          const dist = 5.5 + i * 1.6;
          pool.push({
            t,
            dx: side * dist,
            y: t === 'harmonic' || t === 'vector_charger' ? 2.1 + (i % 3) * 0.7 : 0.9,
          });
        }
        this.lastLog = `الموجة ${waveNum}: ${pool.length} خصوم رياضيات — بدّل السلاح [1–4] واركب المتجهات [U]!`;
      }

      pool.forEach((spec) => {
        this.enemies.push(this._makeEnemy(spec.t, sx + spec.dx, spec.y, waveNum));
      });
    }

    fireWeapon(aimUx, aimUy) {
      if (!this.active || this.gameOver || this.fireCooldown > 0) return false;
      const len = Math.hypot(aimUx, aimUy);
      let dx = aimUx;
      let dy = aimUy;
      if (len < 1e-4) {
        dx = this.stickman.facing || 1;
        dy = 0;
      } else {
        dx /= len;
        dy /= len;
      }

      const w = this.getActiveWeapon();
      const speed = 15.5;
      const originX = this.stickman.x + dx * 0.45;
      const originY = this.stickman.y + 0.92 + dy * 0.25;

      this.projectiles.push({
        x: originX,
        y: originY,
        vx: dx * speed,
        vy: dy * speed,
        dirX: dx,
        dirY: dy,
        weaponIdx: this.weaponIndex,
        weaponId: w.id,
        symbol: w.symbol,
        life: 1.5,
        r: 0.34,
      });

      this.fireCooldown = 0.22;
      this.fireAnimTimer = 0.16;
      if (Math.abs(dx) > 0.12) {
        this.stickman.facing = Math.sign(dx);
      }

      if (this.audioFx) {
        this.audioFx.playWeaponFire(this.weaponIndex);
      }
      return true;
    }

    _getEnemyFormula(e) {
      if (e.type === 'poly') return `P(x) = ${formatPoly(e.coeffs)}`;
      if (e.type === 'deficit') return `∫ ΔA = ${e.area.toFixed(1)} u²`;
      if (e.type === 'harmonic') return `f(x) = ${formatHarmonicLabel(e.hKind, e.amp)}`;
      if (e.type === 'vector_charger') return `F⃗ = (${e.fx.toFixed(1)}, ${e.fy.toFixed(1)})`;
      if (e.type === 'kink') {
        return e.smoothed ? `C¹: ${formatPoly(e.coeffs)}` : '|x - a| (زاوية حادة!)';
      }
      if (e.type === 'boss') {
        if (e.phase === 0) return `Boss₁ [Armor]: ${formatPoly(e.coeffs)}`;
        if (e.phase === 1) return `Boss₂ [Core]: ${formatHarmonicLabel(e.hKind, e.amp)}`;
        if (e.phase === 2) return `Boss₃ [Force]: F⃗ = (${e.fx.toFixed(1)}, ${e.fy.toFixed(1)})`;
        return `Boss₄ [Void]: ∫ΔA = ${e.area.toFixed(1)}`;
      }
      return '';
    }

    _registerRightHit(e, msg, color = '#4ade80', bonus = 40) {
      this.rightHits++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += bonus * Math.min(4, 1 + Math.floor(this.combo / 4));
      e.stunTimer = Math.max(e.stunTimer, 0.36);
      e.hitFlash = 0.25;
      this._spawnPopup(e.x, e.y + e.r + 0.45, msg, color, 1.35);
      this.lastLog = msg;
      if (this.audioFx) this.audioFx.playMathHitRight();
    }

    _registerWrongHit(e, msg) {
      this.wrongHits++;
      this.combo = 0;
      e.hitFlash = 0.18;
      this._spawnPopup(e.x, e.y + e.r + 0.45, msg, '#ff4d6d', 1.6);
      this.lastLog = msg;
      if (this.audioFx) this.audioFx.playMathHitWrong();
    }

    _defeatEnemy(index, msg) {
      const e = this.enemies[index];
      this.rightHits++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const pts = e.type === 'boss' ? 400 : 120;
      this.score += pts * Math.min(4, 1 + Math.floor(this.combo / 4));
      this._spawnPopup(e.x, e.y + e.r + 0.55, msg, '#4ade80', 1.6);
      this.lastLog = msg;

      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const spd = 2.0 + Math.random() * 2.8;
        this.particles.spawnSpark(
          e.x,
          e.y,
          Math.cos(a) * spd,
          Math.sin(a) * spd,
          i % 2 === 0 ? '#4ade80' : '#38bdf8',
          0.04,
          0.48
        );
      }
      if (this.audioFx) this.audioFx.playEnemyDefeat();
      this.enemies.splice(index, 1);
    }

    _applyWeaponHit(enemyIdx, weaponId, dirX, dirY) {
      const e = this.enemies[enemyIdx];
      if (!e) return;

      if (e.type === 'poly') {
        if (weaponId === 'diff') {
          const degBefore = polyDegree(e.coeffs);
          if (degBefore === 0) {
            this._defeatEnemy(enemyIdx, 'd/dx(c) = 0 · تلاشت الدالة!');
            return;
          }
          e.coeffs = diffPoly(e.coeffs);
          if (isZeroPoly(e.coeffs)) {
            this._defeatEnemy(enemyIdx, 'd/dx → 0 · تلاشت!');
            return;
          }
          const degAfter = polyDegree(e.coeffs);
          e.r = 0.56 + degAfter * 0.08;
          e.x += dirX * 0.35;
          this._registerRightHit(e, `d/dx → ${formatPoly(e.coeffs)}`);
          return;
        }
        if (weaponId === 'integ') {
          const next = integPoly(e.coeffs);
          const degAfter = polyDegree(next);
          e.coeffs = next;
          e.r = Math.min(1.18, 0.56 + degAfter * 0.1);
          e.speed = Math.min(3.1, e.speed + 0.18);
          this._registerWrongHit(e, `∫ P(x)dx → ${formatPoly(next)} (ارتفعت الدرجة!)`);
          return;
        }
        if (weaponId === 'negate') {
          e.x += dirX * 0.2;
          this._registerWrongHit(e, 'يتجدد أمام -f(x) · اخفض درجته بـ [1] d/dx');
          return;
        }
        this._registerWrongHit(e, 'استعمل [1] d/dx لكثيرات الحدود');
        return;
      }

      if (e.type === 'deficit') {
        if (weaponId === 'integ') {
          e.area = Math.min(0, e.area + 1.5);
          if (e.area >= -0.05) {
            this._defeatEnemy(enemyIdx, '∫ΔA = 0.0 · أُغلقت الفجوة!');
            return;
          }
          e.x += dirX * 0.25;
          this._registerRightHit(e, `∫+1.5 → المتبقي ${e.area.toFixed(1)}`, '#c084fc');
          return;
        }
        if (weaponId === 'diff') {
          e.area = Math.max(-9.0, e.area - 1.5);
          e.r = Math.min(1.1, e.r + 0.06);
          this._registerWrongHit(e, `d/dx عمّق النقص (${e.area.toFixed(1)})! استعمل [2] ∫dx`);
          return;
        }
        this._registerWrongHit(e, 'فجوة مساحة سالبة — سدّها بـ [2] ∫dx');
        return;
      }

      if (e.type === 'harmonic') {
        if (weaponId === 'negate') {
          e.layers -= 1;
          if (e.layers <= 0) {
            const lbl = formatHarmonicLabel(e.hKind, e.amp);
            this._defeatEnemy(enemyIdx, `${lbl} + (-${lbl}) = 0!`);
            return;
          }
          e.amp = Math.max(1, e.amp - 1);
          this._registerRightHit(e, 'تداخل هدّام (-f)! أعد الضربة', '#f472b6');
          return;
        }
        if (weaponId === 'diff' || weaponId === 'integ') {
          if (e.hKind === 'exp') {
            this._registerWrongHit(
              e,
              `${weaponId === 'diff' ? "d/dx" : "∫"}(eˣ) = eˣ صامد! استعمل [3] -f(x)`
            );
          } else {
            e.hKind = nextHarmonicDeriv(e.hKind);
            this._registerWrongHit(
              e,
              `تحوّلت إلى ${formatHarmonicLabel(e.hKind, e.amp)} ولم تنعدم! استعمل [3] -f(x)`
            );
          }
          return;
        }
        this._registerWrongHit(e, 'ألغِ الموجة بنظيرها [3] -f(x)');
        return;
      }

      if (e.type === 'vector_charger') {
        if (weaponId === 'vector') {
          const fn = Math.max(1e-4, Math.hypot(e.fx, e.fy));
          const dot = (dirX * e.fx + dirY * e.fy) / fn;
          if (dot < -0.4) {
            this._defeatEnemy(enemyIdx, 'F⃗ + (-F⃗) = 0⃗ · توازن صفري!');
            return;
          }
          if (Math.abs(dot) <= 0.4) {
            this._defeatEnemy(enemyIdx, 'F⃗ · u⃗ = 0 · انحراف متعامد!');
            return;
          }
          // Same direction: adds vector energy!
          e.fx = utils.clamp(e.fx + dirX * 1.4, -7.5, 7.5);
          e.fy = utils.clamp(e.fy + dirY * 1.4, -4.5, 4.5);
          e.norm = Math.hypot(e.fx, e.fy);
          this._registerWrongHit(e, 'نفس الاتجاه: F⃗ + u⃗! أطلق عكس السهم أو عموديًا عليه');
          return;
        }
        this._registerWrongHit(e, 'قوة متجهية — عادِلها بالسلاح [4] -v⃗ (معاكس أو عمودي)');
        return;
      }

      if (e.type === 'kink') {
        if (!e.smoothed) {
          if (weaponId === 'integ') {
            e.smoothed = true;
            e.coeffs = [1, -2, 1];
            this._registerRightHit(e, '∫|x| → (x-1)² نُعّمت الزاوية! اشتقّها الآن بـ [1]', '#c084fc');
            return;
          }
          this._registerWrongHit(
            e,
            weaponId === 'diff'
              ? 'الزاوية |x| غير قابلة للاشتقاق! نعّمها أولًا بـ [2] ∫dx'
              : 'نعّم الزاوية الحادة أولًا بـ [2] ∫dx'
          );
          return;
        }
        // Now smoothed polynomial
        if (weaponId === 'diff') {
          const degBefore = polyDegree(e.coeffs);
          if (degBefore === 0) {
            this._defeatEnemy(enemyIdx, 'd/dx(c) = 0 · تفكك المنشور!');
            return;
          }
          e.coeffs = diffPoly(e.coeffs);
          if (isZeroPoly(e.coeffs)) {
            this._defeatEnemy(enemyIdx, 'd/dx → 0 · تفكك!');
            return;
          }
          this._registerRightHit(e, `d/dx → ${formatPoly(e.coeffs)}`);
          return;
        }
        if (weaponId === 'integ') {
          e.coeffs = integPoly(e.coeffs);
          this._registerWrongHit(e, 'أصبح كثير حدود! استعمل [1] d/dx الآن');
          return;
        }
        this._registerWrongHit(e, 'المنحنى ناعم الآن — اخفضه بـ [1] d/dx');
        return;
      }

      if (e.type === 'boss') {
        if (e.phase === 0) {
          if (weaponId === 'diff') {
            if (polyDegree(e.coeffs) === 0) {
              e.phase = 1;
              this._registerRightHit(e, 'المرحلة 1 أُزيلت! الآن نواة eˣ بـ [3] -f(x)');
              return;
            }
            e.coeffs = diffPoly(e.coeffs);
            if (isZeroPoly(e.coeffs)) {
              e.phase = 1;
              this._registerRightHit(e, 'انكسر الدرع! الآن نواة eˣ بـ [3] -f(x)');
              return;
            }
            this._registerRightHit(e, `d/dx(Boss₁) → ${formatPoly(e.coeffs)}`);
            return;
          }
          if (weaponId === 'integ') {
            e.coeffs = integPoly(e.coeffs);
            this._registerWrongHit(e, 'تكامل الدرع رفع درجته! استعمل [1] d/dx');
            return;
          }
          this._registerWrongHit(e, 'المرحلة 1 كثير حدود — استعمل [1] d/dx');
          return;
        }

        if (e.phase === 1) {
          if (weaponId === 'negate') {
            e.hHitsLeft -= 1;
            if (e.hHitsLeft <= 0) {
              e.phase = 2;
              this._registerRightHit(e, 'eˣ + (-eˣ) = 0! المرحلة 3: قوة متجهية [4] -v⃗', '#f472b6');
              return;
            }
            this._registerRightHit(e, 'تداخل هدّام على النواة (-eˣ)! ضربة أخرى', '#f472b6');
            return;
          }
          this._registerWrongHit(e, 'eˣ صامد أمام التفاضل/التكامل! استعمل [3] -f(x)');
          return;
        }

        if (e.phase === 2) {
          if (weaponId === 'vector') {
            const fn = Math.max(1e-4, Math.hypot(e.fx, e.fy));
            const dot = (dirX * e.fx + dirY * e.fy) / fn;
            if (dot < -0.35 || Math.abs(dot) <= 0.45) {
              e.phase = 3;
              this._registerRightHit(e, 'توازنت القوة! المرحلة الأخيرة: سد الفجوة بـ [2] ∫dx', '#f59e0b');
              return;
            }
            this._registerWrongHit(e, 'أطلق متجهة عكس F⃗ أو عمودية عليها بـ [4]');
            return;
          }
          this._registerWrongHit(e, 'المرحلة 3 متجهة قوة — عادِلها بـ [4] -v⃗');
          return;
        }

        if (e.phase === 3) {
          if (weaponId === 'integ') {
            e.area = Math.min(0, e.area + 1.5);
            if (e.area >= -0.05) {
              this._defeatEnemy(enemyIdx, '∫ = 0! سقط الزعيم التفاضلي!');
              return;
            }
            this._registerRightHit(e, `∫+1.5 → المتبقي ${e.area.toFixed(1)}`, '#c084fc');
            return;
          }
          this._registerWrongHit(e, 'أغلق الفجوة النهائية بالسلاح [2] ∫dx');
        }
      }
    }

    update(dt) {
      if (!this.active) return;

      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.fireAnimTimer = Math.max(0, this.fireAnimTimer - dt);
      this.playerInvulnTimer = Math.max(0, this.playerInvulnTimer - dt);

      // Update floating math popups
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.life -= dt;
        p.y += p.vy * dt;
        if (p.life <= 0) this.popups.splice(i, 1);
      }

      if (this.gameOver) return;

      // Update weapon projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.life -= dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.life <= 0) {
          this.projectiles.splice(i, 1);
          continue;
        }

        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const d = Math.hypot(pr.x - e.x, pr.y - e.y);
          if (d <= e.r + pr.r) {
            this._applyWeaponHit(j, pr.weaponId, pr.dirX, pr.dirY);
            consumed = true;
            break;
          }
        }
        if (consumed) {
          this.projectiles.splice(i, 1);
        }
      }

      // Check launched vectors (VectorSystem) hitting enemies cleanly as counter-vectors!
      if (this.vectorSystem && this.vectorSystem.vectors.length > 0) {
        for (const vec of this.vectorSystem.vectors) {
          if (!vec.combative) continue;
          const vNorm = Math.max(1e-4, vec.norm || Math.hypot(vec.ux, vec.uy));
          const uxDir = vec.ux / vNorm;
          const uyDir = vec.uy / vNorm;
          const segLenSq = vec.ux * vec.ux + vec.uy * vec.uy;

          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            if (vec.hitEnemyIds.has(e.id)) continue;
            const s =
              segLenSq > 1e-8
                ? utils.clamp(((e.x - vec.ax) * vec.ux + (e.y - vec.ay) * vec.uy) / segLenSq, 0, 1)
                : 0;
            const qx = vec.ax + vec.ux * s;
            const qy = vec.ay + vec.uy * s;
            const dSeg = Math.hypot(e.x - qx, e.y - qy);
            if (dSeg <= e.r + 0.35) {
              vec.hitEnemyIds.add(e.id);
              this._applyWeaponHit(j, 'vector', uxDir, uyDir);
              break;
            }
          }
        }
      }

      // Update enemy movement & player collision
      const targetX = this.stickman.x;
      const targetY = this.stickman.y + 0.85;

      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        e.animTime += dt;
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        e.hitFlash = Math.max(0, e.hitFlash - dt);

        if (e.stunTimer <= 0) {
          const dx = targetX - e.x;
          const dy = targetY - e.y;
          const dist = Math.max(1e-4, Math.hypot(dx, dy));

          if (e.type === 'poly' || e.type === 'kink') {
            e.vx = utils.damp(e.vx, Math.sign(dx) * e.speed, 5, dt);
            e.x += e.vx * dt;
            e.y = e.r + 0.14 + Math.abs(Math.sin(e.animTime * 3.2)) * 0.16;
          } else if (e.type === 'deficit') {
            e.vx = utils.damp(e.vx, (dx / dist) * e.speed, 3.5, dt);
            e.vy = utils.damp(e.vy, (dy / dist) * e.speed * 0.65, 3.5, dt);
            e.x += e.vx * dt;
            e.y = Math.max(0.75, e.y + e.vy * dt);
          } else if (e.type === 'harmonic') {
            e.vx = utils.damp(e.vx, Math.sign(dx) * e.speed, 3.5, dt);
            e.x += e.vx * dt;
            e.y = e.baseY + Math.sin(e.animTime * 2.4) * 0.95;
          } else if (e.type === 'vector_charger') {
            e.chargeTimer -= dt;
            if (e.chargeTimer <= 0) {
              // Dash cleanly along force vector F⃗ or realign F⃗ gently toward arena
              if (e.dashActive <= 0) {
                if (dist > 6.5) {
                  e.fx = utils.clamp((dx / dist) * 5.2, -6, 6);
                  e.fy = utils.clamp((dy / dist) * 3.8, -3.5, 3.5);
                  e.norm = Math.hypot(e.fx, e.fy);
                }
                e.dashActive = 0.65;
                e.chargeTimer = 2.1;
              }
            }
            if (e.dashActive > 0) {
              e.dashActive -= dt;
              const fn = Math.max(1e-4, Math.hypot(e.fx, e.fy));
              e.x += (e.fx / fn) * 5.4 * dt;
              e.y = utils.clamp(e.y + (e.fy / fn) * 3.6 * dt, 0.75, 6.2);
            } else {
              e.x += Math.sign(dx) * 0.85 * dt;
              e.y = utils.damp(e.y, Math.max(1.2, targetY + 0.4), 2.5, dt);
            }
          } else if (e.type === 'boss') {
            e.chargeTimer -= dt;
            if (e.chargeTimer <= 0) {
              e.fx = utils.clamp((dx / dist) * 5.5, -6, 6);
              e.fy = utils.clamp((dy / dist) * 3.2, -3, 3);
              e.dashActive = 0.75;
              e.chargeTimer = 2.8;
            }
            if (e.dashActive > 0) {
              e.dashActive -= dt;
              e.x += Math.sign(e.fx || dx) * 4.4 * dt;
              e.y = utils.clamp(e.y + Math.sign(e.fy) * 1.4 * dt, 1.3, 4.8);
            } else {
              e.x += Math.sign(dx) * 1.15 * dt;
              e.y = e.baseY + Math.sin(e.animTime * 1.6) * 0.75;
            }
          }
        }

        // Player contact hurt check (unless invincible / dashing past cleanly)
        if (this.playerInvulnTimer <= 0 && this.stickman.dashTimer <= 0) {
          const pDist = Math.hypot(targetX - e.x, targetY - e.y);
          if (pDist < e.r + 0.36) {
            this.hp = Math.max(0, this.hp - e.damage);
            this.combo = 0;
            this.playerInvulnTimer = 0.95;
            this.stickman.damageFlashTimer = 0.32;
            const knockDir = targetX >= e.x ? 1 : -1;
            if (this.stickman.ridingVector) this.stickman.dismountVector(false);
            this.stickman.surfingCurve = false;
            this.stickman.vx = knockDir * 5.8;
            this.stickman.vy = Math.max(this.stickman.vy, 4.6);
            this.stickman.grounded = false;
            this._spawnPopup(this.stickman.x, this.stickman.y + 2.1, `-${e.damage}% توازن`, '#ff4d6d', 0.9);
            if (this.audioFx) this.audioFx.playMathHitWrong();

            if (this.hp <= 0) {
              this.gameOver = true;
              this.lastLog = 'انكسر التوازن الرياضي (0%)! اضغط إعادة أو R لمحاولة جديدة.';
              return;
            }
          }
        }
      }

      // Wave progression
      if (this.enemies.length === 0) {
        if (this.waveTransitionTimer <= 0) {
          this.waveTransitionTimer = 1.45;
          this.hp = Math.min(this.maxHp, this.hp + 15);
          this.lastLog = `اكتملت الموجة ${this.wave}! +15% توازن · جارٍ تحضير الموجة التالية...`;
          if (this.audioFx) this.audioFx.playStarClear();
        } else {
          this.waveTransitionTimer -= dt;
          if (this.waveTransitionTimer <= 0) {
            this.spawnWave(this.wave + 1);
          }
        }
      }
    }

    _drawArrowHead(ctx, x, y, angle, size, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size * 0.45);
      ctx.lineTo(-size * 0.72, 0);
      ctx.lineTo(-size, size * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    render(ctx, camera, gridRenderer, theme) {
      if (!this.active) return;

      const isBlack = theme.bg === '#000000';
      const ppu = camera.ppu;

      ctx.save();
      ctx.direction = 'ltr';

      // 1. Render Enemies
      for (const e of this.enemies) {
        const sp = gridRenderer.worldToScreen(e.x, e.y, camera);
        const radPx = Math.max(16, e.r * ppu);
        const flash = e.hitFlash > 0;

        let mainCol = '#38bdf8';
        let hintOp = '[1] d/dx';
        if (e.type === 'poly') {
          mainCol = isBlack ? '#38bdf8' : '#2563eb';
          hintOp = '[1] d/dx';
        } else if (e.type === 'deficit') {
          mainCol = isBlack ? '#c084fc' : '#7c3aed';
          hintOp = '[2] ∫dx';
        } else if (e.type === 'harmonic') {
          mainCol = isBlack ? '#f472b6' : '#db2777';
          hintOp = '[3] -f(x)';
        } else if (e.type === 'vector_charger') {
          mainCol = isBlack ? '#f59e0b' : '#d97706';
          hintOp = '[4] -v⃗ / ⊥';
        } else if (e.type === 'kink') {
          mainCol = e.smoothed ? (isBlack ? '#38bdf8' : '#2563eb') : (isBlack ? '#c084fc' : '#7c3aed');
          hintOp = e.smoothed ? '[1] d/dx' : '[2] ∫dx';
        } else if (e.type === 'boss') {
          mainCol = e.phase === 0 ? '#38bdf8' : e.phase === 1 ? '#f472b6' : e.phase === 2 ? '#f59e0b' : '#c084fc';
          hintOp = e.phase === 0 ? '[1] d/dx' : e.phase === 1 ? '[3] -f' : e.phase === 2 ? '[4] -v⃗' : '[2] ∫dx';
        }

        const strokeCol = flash ? '#ffffff' : mainCol;

        ctx.save();
        // Shape per math concept
        if (e.type === 'poly' || e.type === 'boss') {
          ctx.fillStyle = isBlack ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = e.type === 'boss' ? 3.2 : 2.3;
          ctx.beginPath();
          const sides = e.type === 'boss' ? 8 : 6;
          for (let k = 0; k < sides; k++) {
            const ang = (k / sides) * Math.PI * 2 + e.animTime * 0.35;
            const px = sp.x + Math.cos(ang) * radPx;
            const py = sp.y + Math.sin(ang) * radPx;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Mini curve preview inside hull
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = -8; i <= 8; i++) {
            const lx = i / 6;
            const ly = utils.clamp(evalPoly(e.coeffs, lx) * 0.25, -0.7, 0.7);
            const px = sp.x + (i / 8) * (radPx * 0.62);
            const py = sp.y - ly * (radPx * 0.55);
            if (i === -8) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        } else if (e.type === 'deficit') {
          // Diamond with negative red bars rising to zero
          ctx.fillStyle = isBlack ? 'rgba(30, 10, 28, 0.88)' : 'rgba(255, 241, 242, 0.92)';
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y - radPx);
          ctx.lineTo(sp.x + radPx, sp.y);
          ctx.lineTo(sp.x, sp.y + radPx);
          ctx.lineTo(sp.x - radPx, sp.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          const ratioFilled = utils.clamp(1 - Math.abs(e.area) / Math.max(1, e.maxDeficit), 0, 1);
          const barCount = 5;
          for (let b = 0; b < barCount; b++) {
            const bx = sp.x - radPx * 0.45 + b * (radPx * 0.21);
            const fullH = radPx * 0.48;
            const filled = (b + 1) / barCount <= ratioFilled;
            ctx.fillStyle = filled ? '#38bdf8' : '#ff4d6d';
            ctx.fillRect(bx, sp.y - fullH * 0.5, radPx * 0.14, fullH);
          }
        } else if (e.type === 'harmonic') {
          ctx.fillStyle = isBlack ? 'rgba(24, 10, 28, 0.85)' : 'rgba(255, 255, 255, 0.92)';
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 2.3;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, radPx, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          for (let i = -8; i <= 8; i++) {
            const t = i / 4;
            let wy = 0;
            if (e.hKind === 'exp') wy = (Math.exp(t * 0.45) - 1) * 0.45;
            else if (e.hKind === 'sin') wy = Math.sin(t * 1.4 + e.animTime * 4) * 0.45;
            else if (e.hKind === 'cos') wy = Math.cos(t * 1.4 + e.animTime * 4) * 0.45;
            else if (e.hKind === '-sin') wy = -Math.sin(t * 1.4 + e.animTime * 4) * 0.45;
            else wy = -Math.cos(t * 1.4 + e.animTime * 4) * 0.45;
            const px = sp.x + (i / 8) * (radPx * 0.65);
            const py = sp.y - utils.clamp(wy, -0.65, 0.65) * radPx;
            if (i === -8) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        } else if (e.type === 'kink') {
          ctx.fillStyle = isBlack ? 'rgba(15, 18, 28, 0.88)' : 'rgba(248, 250, 252, 0.92)';
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y - radPx);
          ctx.lineTo(sp.x + radPx * 0.95, sp.y + radPx * 0.72);
          ctx.lineTo(sp.x - radPx * 0.95, sp.y + radPx * 0.72);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          if (!e.smoothed) {
            ctx.moveTo(sp.x - radPx * 0.45, sp.y - radPx * 0.15);
            ctx.lineTo(sp.x, sp.y + radPx * 0.38);
            ctx.lineTo(sp.x + radPx * 0.45, sp.y - radPx * 0.15);
          } else {
            ctx.arc(sp.x, sp.y + radPx * 0.05, radPx * 0.34, 0, Math.PI, false);
          }
          ctx.stroke();
        } else if (e.type === 'vector_charger') {
          ctx.fillStyle = isBlack ? 'rgba(28, 18, 8, 0.88)' : 'rgba(255, 251, 235, 0.92)';
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, radPx * 0.78, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Draw Vector Arrow attached to Vector Charger or Boss Vector Phase
        if (e.type === 'vector_charger' || (e.type === 'boss' && e.phase === 2)) {
          const tipW = gridRenderer.worldToScreen(e.x + e.fx * 0.45, e.y + e.fy * 0.45, camera);
          const vAng = Math.atan2(tipW.y - sp.y, tipW.x - sp.x);
          ctx.strokeStyle = theme.vecLaunched || '#f59e0b';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(tipW.x, tipW.y);
          ctx.stroke();
          this._drawArrowHead(ctx, tipW.x, tipW.y, vAng, 11, theme.vecLaunched || '#f59e0b');
        }

        // Equation tag + recommended operator hint badge above enemy
        const eqText = this._getEnemyFormula(e);
        ctx.font = "700 11.5px 'Cascadia Mono', 'Consolas', monospace";
        const tw = ctx.measureText(eqText).width;
        const bx = sp.x - tw * 0.5 - 7;
        const by = sp.y - radPx - 28;
        ctx.fillStyle = theme.coordTagBg;
        ctx.strokeStyle = mainCol;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, tw + 14, 21, 6);
        else ctx.rect(bx, by, tw + 14, 21);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.coordTagText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(eqText, sp.x, by + 10.5);

        ctx.font = "600 10px 'Cascadia Mono', 'Consolas', monospace";
        ctx.fillStyle = mainCol;
        ctx.fillText(hintOp, sp.x, by - 7);
        ctx.restore();
      }

      // 2. Render Weapon Projectiles
      for (const pr of this.projectiles) {
        const w = WEAPONS[pr.weaponIdx] || WEAPONS[0];
        const col = isBlack ? w.colorBlack : w.colorLight;
        const sp = gridRenderer.worldToScreen(pr.x, pr.y, camera);
        const rad = Math.max(9, pr.r * ppu * 0.8);

        ctx.save();
        ctx.fillStyle = isBlack ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.88)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "700 10.5px 'Cascadia Mono', 'Consolas', monospace";
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pr.symbol, sp.x, sp.y);
        ctx.restore();
      }

      // 3. Floating math feedback popups
      for (const p of this.popups) {
        const sp = gridRenderer.worldToScreen(p.x, p.y, camera);
        const alpha = utils.clamp(p.life / p.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = "700 12px 'Segoe UI', 'Cascadia Mono', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = theme.coordTagBg;
        const tw = ctx.measureText(p.text).width;
        ctx.fillRect(sp.x - tw * 0.5 - 6, sp.y - 10, tw + 12, 20);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, sp.x, sp.y);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  MathStickGame.MathCombatArena = MathCombatArena;
})(window);
