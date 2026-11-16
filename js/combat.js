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
      nameAr: 'سيف الاشتقاق',
      colorBlack: '#38bdf8',
      colorLight: '#2563eb',
      reach: 2.55,
      arcHalf: 1.35,
      swingDuration: 0.2,
      cooldown: 0.16,
      projSpeed: 16.5,
      projLife: 0.72,
      descAr: 'كاتانا سريعة تخفض درجة كثيرات الحدود (x³→3x²→6x→6→0) بضربات متتالية + موجة قاطعة',
    },
    {
      id: 'integ',
      key: '2',
      symbol: '∫ dx',
      nameAr: 'نصل التكامل',
      colorBlack: '#a855f7',
      colorLight: '#7c3aed',
      reach: 2.95,
      arcHalf: 1.55,
      swingDuration: 0.29,
      cooldown: 0.25,
      projSpeed: 14.0,
      projLife: 0.78,
      descAr: 'سيف ثقيل يسد فجوات المساحة السالبة وينعّم زوايا |x| (S+هجوم بالهواء = سحق أرضي!)',
    },
    {
      id: 'negate',
      key: '3',
      symbol: '-f(x)',
      nameAr: 'نصال النظير',
      colorBlack: '#f472b6',
      colorLight: '#db2777',
      reach: 2.35,
      arcHalf: 1.45,
      swingDuration: 0.16,
      cooldown: 0.12,
      projSpeed: 17.5,
      projLife: 0.74,
      descAr: 'نصلان مزدوجان سريعا الإيقاع لتداخل هدّام يُلغي الدوال الصامدة eˣ و sin و cos',
    },
    {
      id: 'vector',
      key: '4',
      symbol: '-v⃗ / ⊥',
      nameAr: 'رمح المتجهة',
      colorBlack: '#f59e0b',
      colorLight: '#d97706',
      reach: 3.35,
      arcHalf: 0.65,
      swingDuration: 0.22,
      cooldown: 0.18,
      projSpeed: 19.5,
      projLife: 0.85,
      descAr: 'رمح طعن بعيد المدى يعادل أعداء القوة المتجهية (عكس السهم F⃗ + (-F⃗) = 0 أو متعامد F⃗·u⃗ = 0)',
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
    const out = [1];
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

  function solveIK2(ax, ay, tx, ty, len1, len2, bendSign) {
    const dx = tx - ax;
    const dy = ty - ay;
    const rawDist = Math.hypot(dx, dy);
    if (rawDist < 1e-5) {
      return {
        jx: ax + bendSign * len1 * 0.5,
        jy: ay - len1 * 0.86,
        ex: tx,
        ey: ty,
      };
    }
    const maxReach = len1 + len2 - 0.002;
    const minReach = Math.abs(len1 - len2) + 0.002;
    const d = utils.clamp(rawDist, minReach, maxReach);
    const cosA = utils.clamp((len1 * len1 + d * d - len2 * len2) / (2 * len1 * d), -1, 1);
    const alpha = Math.acos(cosA);
    const baseAng = Math.atan2(dy, dx);
    const ang1 = baseAng + bendSign * alpha;
    const scaleEnd = rawDist > maxReach ? maxReach / rawDist : 1;
    return {
      jx: ax + Math.cos(ang1) * len1,
      jy: ay + Math.sin(ang1) * len1,
      ex: ax + dx * scaleEnd,
      ey: ay + dy * scaleEnd,
    };
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
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
      this.parryCount = 0;
      this.hp = 100;
      this.maxHp = 100;
      this.gameOver = false;
      this.waveTransitionTimer = 0;
      this.playerInvulnTimer = 0;
      this.fireCooldown = 0;
      this.fireAnimTimer = 0;

      // Dead Cells tactile feel & combat pose state
      this.hitstopTimer = 0;
      this.shakeTimer = 0;
      this.shakeMag = 0;
      this.slamDiveActive = false;
      this.parryTimer = 0;
      this.parryCooldown = 0;
      this.parrySuccessTimer = 0;
      this.comboStep = 0;
      this.comboResetTimer = 0;
      this.attackState = {
        active: false,
        timer: 0,
        duration: 0.2,
        comboStep: 0,
        weaponIdx: 0,
        isSlam: false,
        aimAngle: 0,
      };

      this.enemies = [];
      this.projectiles = [];
      this.slashes = []; // curved melee ribbons & shockwave rings
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

    triggerShake(mag = 6, duration = 0.14) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeTimer = Math.max(this.shakeTimer, duration);
    }

    getScreenShakeOffset() {
      if (!this.active || this.shakeTimer <= 0 || this.shakeMag <= 0.1) {
        return { x: 0, y: 0 };
      }
      const p = utils.clamp(this.shakeTimer / 0.16, 0, 1);
      const amp = this.shakeMag * p;
      return {
        x: (Math.random() - 0.5) * 2 * amp,
        y: (Math.random() - 0.5) * 2 * amp,
      };
    }

    enter() {
      this.active = true;
      this.resetRun();
    }

    exit() {
      this.active = false;
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.slashes.length = 0;
      this.popups.length = 0;
      this.hitstopTimer = 0;
      this.shakeTimer = 0;
      this.shakeMag = 0;
      this.slamDiveActive = false;
      this.parryTimer = 0;
      this.attackState.active = false;
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
      this.parryCount = 0;
      this.hp = this.maxHp;
      this.gameOver = false;
      this.waveTransitionTimer = 0;
      this.playerInvulnTimer = 0;
      this.fireCooldown = 0;
      this.hitstopTimer = 0;
      this.shakeTimer = 0;
      this.shakeMag = 0;
      this.slamDiveActive = false;
      this.parryTimer = 0;
      this.parryCooldown = 0;
      this.parrySuccessTimer = 0;
      this.comboStep = 0;
      this.comboResetTimer = 0;
      this.attackState.active = false;
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.slashes.length = 0;
      this.popups.length = 0;
      this.stickman.reset();
      if (this.vectorSystem) this.vectorSystem.clear();
      this.particles.clear();
      this.spawnWave(1);
    }

    _spawnPopup(wx, wy, text, color = '#38bdf8', life = 1.35) {
      if (this.popups.length > 30) this.popups.shift();
      this.popups.push({
        x: wx,
        y: wy,
        vy: 1.08,
        text,
        color,
        life,
        maxLife: life,
      });
    }

    _makeEnemy(type, x, y, waveScale = 1) {
      const id = nextEnemyId++;
      const faceDir = x >= this.stickman.x ? -1 : 1;
      const base = {
        id,
        type,
        x,
        y,
        baseY: y,
        vx: 0,
        vy: 0,
        facing: faceDir,
        stunTimer: 0,
        hitFlash: 0,
        animTime: Math.random() * 6,
        aiState: 'chase',
        windupTimer: 0,
        strikeTimer: 0,
        attackCooldown: 0.7 + Math.random() * 0.5,
        attackDidHit: false,
      };

      if (type === 'poly') {
        const deg = waveScale >= 4 ? 3 : waveScale >= 2 ? 2 : 1;
        let coeffs;
        if (deg === 1) coeffs = [2, 3];
        else if (deg === 2) coeffs = [1, -2, 1];
        else coeffs = [0, -2, 0.5, 0.5];
        return {
          ...base,
          y: Math.max(0.88, y),
          baseGroundY: 0.88,
          r: 0.62 + deg * 0.08,
          coeffs,
          speed: 1.7 + deg * 0.28,
          damage: 13,
          rightWeapon: 'diff',
        };
      }

      if (type === 'deficit') {
        const areaTarget = -(3 + Math.min(3, Math.floor(waveScale / 2)) * 1.5);
        return {
          ...base,
          y: Math.max(0.95, y),
          baseGroundY: 0.95,
          r: 0.7,
          area: areaTarget,
          maxDeficit: Math.abs(areaTarget),
          speed: 1.45 + waveScale * 0.08,
          damage: 14,
          rightWeapon: 'integ',
        };
      }

      if (type === 'harmonic') {
        const modes = ['exp', 'sin', 'cos'];
        const hKind = modes[(id + waveScale) % modes.length];
        const amp = hKind === 'exp' ? 1 : 2 + (waveScale >= 3 ? 1 : 0);
        return {
          ...base,
          y: Math.max(2.15, y),
          baseY: Math.max(2.15, y),
          baseGroundY: 1.2,
          r: 0.68,
          hKind,
          amp,
          layers: waveScale >= 4 ? 2 : 1,
          speed: 1.75 + waveScale * 0.1,
          damage: 14,
          rightWeapon: 'negate',
        };
      }

      if (type === 'vector_charger') {
        const dirSign = x > this.stickman.x ? -1 : 1;
        const fx = dirSign * (3 + (waveScale % 3));
        const fy = (id % 2 === 0 ? 1 : -1) * (1 + (waveScale % 2));
        return {
          ...base,
          y: Math.max(1.25, y),
          baseGroundY: 0.92,
          r: 0.7,
          fx,
          fy,
          norm: Math.hypot(fx, fy),
          chargeTimer: 1.35 + Math.random() * 1.2,
          dashActive: 0,
          damage: 17,
          rightWeapon: 'vector',
        };
      }

      if (type === 'kink') {
        return {
          ...base,
          y: 0.92,
          baseGroundY: 0.92,
          r: 0.72,
          smoothed: false,
          coeffs: [1, -2, 1],
          speed: 1.85,
          damage: 16,
          rightWeapon: 'integ',
        };
      }

      // Boss: multi-phase Composite Sovereign Stickman
      return {
        ...base,
        y: 1.65,
        baseY: 1.65,
        baseGroundY: 1.45,
        r: 1.1,
        phase: 0, // 0: Poly Armor (d/dx), 1: Harmonic Core (-f), 2: Vector Force (-v⃗), 3: Integral Void (∫dx)
        coeffs: [0, -3, 1.5, 0.5],
        hKind: 'exp',
        amp: 3,
        hHitsLeft: 2,
        fx: -5,
        fy: 2,
        area: -4.5,
        maxDeficit: 4.5,
        chargeTimer: 2.3,
        dashActive: 0,
        damage: 20,
      };
    }

    spawnWave(waveNum) {
      this.wave = waveNum;
      this.enemies.length = 0;
      const sx = this.stickman.x;

      if (waveNum % 5 === 0) {
        const boss = this._makeEnemy('boss', sx + 7.5, 1.65, waveNum);
        const sideDeficit = this._makeEnemy('deficit', sx - 6.5, 1.1, waveNum);
        this.enemies.push(boss, sideDeficit);
        this.lastLog = `موجة الزعيم ${waveNum}: فكّك طبقات المقاتل الأساسي [1 d/dx ← 3 -f(x) ← 4 -v⃗ ← 2 ∫dx] (صَدّ: K / كليك يمين!)`;
        return;
      }

      let pool;
      if (waveNum === 1) {
        pool = [
          { t: 'poly', dx: 6.4, y: 0.88 },
          { t: 'harmonic', dx: -6.2, y: 2.25 },
        ];
        this.lastLog = 'الموجة 1: [1] كاتانا d/dx لكثير الحدود، و[3] نصال -f(x) للمقاتل الموجي! (صد بـ K أو كليك يمين)';
      } else if (waveNum === 2) {
        pool = [
          { t: 'poly', dx: 6.8, y: 0.88 },
          { t: 'deficit', dx: -6.2, y: 0.98 },
          { t: 'vector_charger', dx: 8.4, y: 2.0 },
        ];
        this.lastLog = 'الموجة 2: [2] ∫dx لشبح النقص السالب، و[4] -v⃗ لطعن رمّاح المتجهة F⃗ (أو صدّ هجومه!)';
      } else if (waveNum === 3) {
        pool = [
          { t: 'kink', dx: 6.6, y: 0.92 },
          { t: 'harmonic', dx: -7.4, y: 2.5 },
          { t: 'poly', dx: -5.0, y: 0.88 },
          { t: 'vector_charger', dx: 8.4, y: 1.75 },
        ];
        this.lastLog = 'الموجة 3: الساموراي |x| يتطلب [2] ∫dx لتنعيم الزاوية ثم [1] d/dx · جرب S+هجوم بالهواء للسحق!';
      } else {
        const types = ['poly', 'deficit', 'harmonic', 'vector_charger', 'kink'];
        const count = Math.min(6, 3 + Math.floor(waveNum / 2));
        pool = [];
        for (let i = 0; i < count; i++) {
          const t = types[(i + waveNum) % types.length];
          const side = i % 2 === 0 ? 1 : -1;
          const dist = 5.2 + i * 1.5;
          pool.push({
            t,
            dx: side * dist,
            y: t === 'harmonic' || t === 'vector_charger' ? 2.0 + (i % 3) * 0.65 : 0.9,
          });
        }
        this.lastLog = `الموجة ${waveNum}: ${pool.length} مقاتلي رياضيات — كومبو السيوف [1–4] + صد [K] + رمي متجهات [U]!`;
      }

      pool.forEach((spec) => {
        this.enemies.push(this._makeEnemy(spec.t, sx + spec.dx, spec.y, waveNum));
      });
    }

    triggerParry() {
      if (!this.active || this.gameOver || this.parryCooldown > 0) return false;
      this.parryTimer = 0.25;
      this.parryCooldown = 0.52;
      this.stickman.glFlashTimer = 0.16;

      // Immediate active-frame parry check against nearby telegraphing/striking enemies & projectiles
      const hitCenterX = this.stickman.x;
      const hitCenterY = this.stickman.y + 0.9;
      let parriedAny = false;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dist = Math.hypot(e.x - hitCenterX, e.y - hitCenterY);
        const threatening =
          e.aiState === 'windup' ||
          e.aiState === 'strike' ||
          e.dashActive > 0;
        if (threatening && dist <= e.r + 1.95) {
          this._executeSuccessfulParry(i);
          parriedAny = true;
        }
      }

      if (!parriedAny) {
        // Subtle crisp guard spark even on whiff so timing feels responsive
        const gx = this.stickman.x + this.stickman.facing * 0.45;
        const gy = this.stickman.y + 0.95;
        if (this.particles) {
          for (let i = 0; i < 6; i++) {
            const a = -0.6 + (i / 5) * 1.2 + (this.stickman.facing < 0 ? Math.PI : 0);
            this.particles.spawnSpark(gx, gy, Math.cos(a) * 1.8, Math.sin(a) * 1.8, '#38bdf8', 0.032, 0.2);
          }
        }
      }
      return true;
    }

    _executeSuccessfulParry(enemyIdx) {
      const e = this.enemies[enemyIdx];
      if (!e) return;

      this.parrySuccessTimer = 0.3;
      this.parryCount++;
      this.parryTimer = 0; // consumed cleanly
      this.playerInvulnTimer = Math.max(this.playerInvulnTimer, 0.45);
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.082);
      this.triggerShake(9.5, 0.18);
      this.stickman.glFlashTimer = 0.26;
      this.hp = Math.min(this.maxHp, this.hp + 4);

      const sparkX = (this.stickman.x + e.x) * 0.5;
      const sparkY = (this.stickman.y + 0.95 + e.y) * 0.5;
      this.slashes.push({
        type: 'ring',
        x: sparkX,
        y: sparkY,
        radius: 1.55,
        color: '#fde047',
        life: 0.26,
        maxLife: 0.26,
      });

      if (this.particles) {
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          const spd = 2.6 + Math.random() * 3.0;
          this.particles.spawnSpark(
            sparkX,
            sparkY,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            k % 2 === 0 ? '#fde047' : '#38bdf8',
            0.044,
            0.35
          );
        }
      }

      if (this.audioFx && typeof this.audioFx.playParryClang === 'function') {
        this.audioFx.playParryClang();
      }

      const pushDir = e.x >= this.stickman.x ? 1 : -1;
      e.aiState = 'stun';
      e.windupTimer = 0;
      e.strikeTimer = 0;
      e.dashActive = 0;
      e.stunTimer = 1.85;
      e.vx = pushDir * 5.2;
      e.vy = 2.6;
      e.hitFlash = 0.3;

      this.score += 75;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);

      // Deflecting a Vector Charger or active Boss Vector force orthogonalizes its attack cleanly!
      if (e.type === 'vector_charger') {
        this._defeatEnemy(enemyIdx, 'صَدّ مثالي! عُكست F⃗ = 0!');
        return;
      }

      // Apply an empowered counter-strike using active weapon (with free parry crit bonus!)
      const activeId = this.getActiveWeapon().id;
      const targetWeapon = e.rightWeapon || activeId;
      this._spawnPopup(sparkX, sparkY + 0.55, 'صَدّ مثالي! PARRY CRIT', '#fde047', 1.15);
      // Apply active weapon if matching OR counter with parry break
      if (activeId === targetWeapon || e.type === 'boss') {
        this._applyWeaponHit(enemyIdx, activeId, pushDir, 0.25, true);
      } else {
        this.lastLog = 'صَدّ مثالي! الخصم مشلول — وجّه السلاح المناسب بسرعة!';
      }
    }

    fireWeapon(aimUx, aimUy, crouchHeld = false) {
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

      // Air Ground-Slam when pressing Down/S + Attack while airborne!
      if (
        !this.stickman.grounded &&
        !this.stickman.ridingVector &&
        !this.stickman.climbing &&
        crouchHeld &&
        !this.slamDiveActive
      ) {
        if (this.stickman.surfingCurve) this.stickman.surfingCurve = false;
        this.slamDiveActive = true;
        this.stickman.vx *= 0.25;
        this.stickman.vy = -21.5;
        this.fireCooldown = 0.28;
        this.attackState = {
          active: true,
          timer: 0,
          duration: 0.45,
          comboStep: 2,
          weaponIdx: this.weaponIndex,
          isSlam: true,
          aimAngle: -Math.PI * 0.5,
        };
        if (this.audioFx && typeof this.audioFx.playSwordSwing === 'function') {
          this.audioFx.playSwordSwing(1, 2);
        }
        return true;
      }

      // Update Dead Cells 3-hit melee combo cycle
      if (this.comboResetTimer > 0) {
        this.comboStep = (this.comboStep + 1) % 3;
      } else {
        this.comboStep = 0;
      }
      this.comboResetTimer = 0.65;

      const aimAngle = Math.atan2(dy, dx);
      if (Math.abs(dx) > 0.12) {
        this.stickman.facing = Math.sign(dx);
      }

      // Slight forward combat step on ground slashes
      if (this.stickman.grounded && !this.stickman.surfingCurve && !this.stickman.ridingVector) {
        this.stickman.vx += Math.sign(dx || this.stickman.facing) * (this.comboStep === 2 ? 3.2 : 1.7);
      }

      this.fireCooldown = w.cooldown;
      this.fireAnimTimer = w.swingDuration;
      this.stickman.glFlashTimer = 0.14;
      this.attackState = {
        active: true,
        timer: 0,
        duration: w.swingDuration,
        comboStep: this.comboStep,
        weaponIdx: this.weaponIndex,
        isSlam: false,
        aimAngle,
      };

      const isBlack = true; // tint resolved dynamically in render too
      const swordCol = w.colorBlack;
      const slashOriginX = this.stickman.x + dx * 0.35;
      const slashOriginY = this.stickman.y + 0.94 + dy * 0.2;

      // Add dramatic curved slash arc / thrust lance VFX
      this.slashes.push({
        type: w.id === 'vector' ? 'thrust' : 'arc',
        x: slashOriginX,
        y: slashOriginY,
        angle: aimAngle,
        sweep: w.id === 'integ' ? 2.6 : 2.15,
        radius: w.reach * 0.85,
        comboStep: this.comboStep,
        facing: this.stickman.facing,
        weaponIdx: this.weaponIndex,
        color: swordCol,
        life: w.swingDuration + 0.06,
        maxLife: w.swingDuration + 0.06,
      });

      // Immediate melee arc hit detection (Dead Cells close-mid punch!)
      const hitIds = new Set();
      let hitCount = 0;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const ex = e.x - this.stickman.x;
        const ey = e.y - (this.stickman.y + 0.92);
        const dist = Math.hypot(ex, ey);
        if (dist > w.reach + e.r) continue;
        const angToEnemy = Math.atan2(ey, ex);
        const angDiff = Math.abs(wrapAngle(angToEnemy - aimAngle));
        if (dist <= e.r + 0.65 || angDiff <= w.arcHalf) {
          hitIds.add(e.id);
          hitCount++;
          const nLen = Math.max(1e-4, dist);
          this._applyWeaponHit(j, w.id, ex / nLen, ey / nLen, false);
        }
      }

      if (hitCount > 0) {
        this.hitstopTimer = Math.max(this.hitstopTimer, this.comboStep === 2 ? 0.055 : 0.036);
        this.triggerShake(this.comboStep === 2 ? 6.5 : 4.2, 0.11);
      }

      // Emit a swift forward sword-wave projectile along aim so distant/airborne targets can also be cleaved
      this.projectiles.push({
        x: this.stickman.x + dx * 0.55,
        y: this.stickman.y + 0.94 + dy * 0.28,
        vx: dx * w.projSpeed,
        vy: dy * w.projSpeed,
        dirX: dx,
        dirY: dy,
        angle: aimAngle,
        weaponIdx: this.weaponIndex,
        weaponId: w.id,
        symbol: w.symbol,
        life: w.projLife,
        maxLife: w.projLife,
        r: w.id === 'integ' ? 0.42 : 0.34,
        ignoredIds: hitIds,
      });

      if (this.audioFx) {
        if (typeof this.audioFx.playSwordSwing === 'function') {
          this.audioFx.playSwordSwing(this.weaponIndex, this.comboStep);
        } else {
          this.audioFx.playWeaponFire(this.weaponIndex);
        }
      }
      return true;
    }

    _triggerGroundSlamImpact() {
      this.slamDiveActive = false;
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.072);
      this.triggerShake(10.5, 0.2);
      this.stickman.glFlashTimer = 0.26;
      const sx = this.stickman.x;
      const sy = this.stickman.y;
      const w = this.getActiveWeapon();

      this.slashes.push({
        type: 'slam',
        x: sx,
        y: sy + 0.15,
        radius: 3.4,
        color: w.colorBlack,
        life: 0.32,
        maxLife: 0.32,
      });

      if (this.particles) {
        this.particles.spawnLandingBurst(sx, 2.2, sy + 0.02);
        for (let k = 0; k < 14; k++) {
          const vx = (Math.random() - 0.5) * 6.4;
          const vy = 1.6 + Math.random() * 3.8;
          this.particles.spawnSpark(sx, sy + 0.1, vx, vy, w.colorBlack, 0.042, 0.38);
        }
      }

      if (this.audioFx && typeof this.audioFx.playGroundSlam === 'function') {
        this.audioFx.playGroundSlam();
      }

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dist = Math.hypot(e.x - sx, e.y - (sy + 0.6));
        if (dist <= 3.35 + e.r) {
          const pushDir = e.x >= sx ? 1 : -1;
          e.vy = Math.max(e.vy, 4.8);
          e.vx = pushDir * 3.5;
          e.stunTimer = Math.max(e.stunTimer, 0.7);
          this._applyWeaponHit(j, w.id, pushDir, 0.45, true);
        }
      }
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

    _registerRightHit(e, msg, color = '#4ade80', bonus = 45, dirX = 1) {
      this.rightHits++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += bonus * Math.min(4, 1 + Math.floor(this.combo / 4));
      e.stunTimer = Math.max(e.stunTimer, 0.48);
      e.aiState = 'stun';
      e.windupTimer = 0;
      e.strikeTimer = 0;
      e.hitFlash = 0.24;
      e.vx = (dirX || 1) * 2.8;
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.04);
      this.triggerShake(4.8, 0.12);
      if (this.particles) {
        for (let i = 0; i < 6; i++) {
          const ang = Math.atan2(0.3, dirX || 1) + (Math.random() - 0.5) * 1.1;
          this.particles.spawnSpark(
            e.x,
            e.y,
            Math.cos(ang) * (2.5 + Math.random() * 2.5),
            Math.sin(ang) * (2.5 + Math.random() * 2.5),
            color,
            0.036,
            0.28
          );
        }
      }
      this._spawnPopup(e.x, e.y + e.r + 0.55, msg, color, 1.35);
      this.lastLog = msg;
      if (this.audioFx) this.audioFx.playMathHitRight();
    }

    _registerWrongHit(e, msg) {
      this.wrongHits++;
      this.combo = 0;
      e.hitFlash = 0.18;
      this._spawnPopup(e.x, e.y + e.r + 0.55, msg, '#ff4d6d', 1.6);
      this.lastLog = msg;
      if (this.audioFx) this.audioFx.playMathHitWrong();
    }

    _defeatEnemy(index, msg) {
      const e = this.enemies[index];
      this.rightHits++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const pts = e.type === 'boss' ? 450 : 125;
      this.score += pts * Math.min(4, 1 + Math.floor(this.combo / 4));
      this.hitstopTimer = Math.max(this.hitstopTimer, e.type === 'boss' ? 0.12 : 0.068);
      this.triggerShake(e.type === 'boss' ? 12 : 7.5, 0.18);
      this.stickman.glFlashTimer = 0.22;
      this._spawnPopup(e.x, e.y + e.r + 0.65, msg, '#4ade80', 1.6);
      this.lastLog = msg;

      this.slashes.push({
        type: 'ring',
        x: e.x,
        y: e.y,
        radius: e.r * 2.1,
        color: '#4ade80',
        life: 0.28,
        maxLife: 0.28,
      });

      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const spd = 2.4 + Math.random() * 3.4;
        this.particles.spawnSpark(
          e.x,
          e.y,
          Math.cos(a) * spd,
          Math.sin(a) * spd,
          i % 2 === 0 ? '#4ade80' : '#38bdf8',
          0.042,
          0.52
        );
      }
      if (this.audioFx) this.audioFx.playEnemyDefeat();
      this.enemies.splice(index, 1);
    }

    _applyWeaponHit(enemyIdx, weaponId, dirX, dirY, isCrit = false) {
      const e = this.enemies[enemyIdx];
      if (!e) return;
      const knockDir = dirX || (e.x >= this.stickman.x ? 1 : -1);

      if (e.type === 'poly') {
        if (weaponId === 'diff') {
          const degBefore = polyDegree(e.coeffs);
          if (degBefore === 0) {
            this._defeatEnemy(enemyIdx, 'd/dx(c) = 0 · تلاشت الدالة!');
            return;
          }
          e.coeffs = diffPoly(e.coeffs);
          if (isZeroPoly(e.coeffs) || (isCrit && polyDegree(e.coeffs) === 0)) {
            this._defeatEnemy(enemyIdx, 'd/dx → 0 · ضربة قاضية!');
            return;
          }
          const degAfter = polyDegree(e.coeffs);
          e.r = 0.56 + degAfter * 0.08;
          e.x += knockDir * 0.42;
          this._registerRightHit(e, `d/dx → ${formatPoly(e.coeffs)}`, '#38bdf8', 45, knockDir);
          return;
        }
        if (weaponId === 'integ') {
          const next = integPoly(e.coeffs);
          const degAfter = polyDegree(next);
          e.coeffs = next;
          e.r = Math.min(1.18, 0.56 + degAfter * 0.1);
          e.speed = Math.min(3.2, e.speed + 0.18);
          this._registerWrongHit(e, `∫ P(x)dx → ${formatPoly(next)} (ارتفعت الدرجة!)`);
          return;
        }
        if (weaponId === 'negate') {
          e.x += knockDir * 0.2;
          this._registerWrongHit(e, 'يتجدد أمام -f(x) · اخفض درجته بـ [1] كاتانا d/dx');
          return;
        }
        this._registerWrongHit(e, 'استعمل [1] كاتانا d/dx لكثيرات الحدود');
        return;
      }

      if (e.type === 'deficit') {
        if (weaponId === 'integ') {
          e.area = Math.min(0, e.area + (isCrit ? 2.5 : 1.5));
          if (e.area >= -0.05) {
            this._defeatEnemy(enemyIdx, '∫ΔA = 0.0 · أُغلقت الفجوة!');
            return;
          }
          e.x += knockDir * 0.32;
          this._registerRightHit(e, `∫+1.5 → المتبقي ${e.area.toFixed(1)}`, '#c084fc', 45, knockDir);
          return;
        }
        if (weaponId === 'diff') {
          e.area = Math.max(-9.0, e.area - 1.5);
          e.r = Math.min(1.1, e.r + 0.06);
          this._registerWrongHit(e, `d/dx عمّق النقص (${e.area.toFixed(1)})! استعمل [2] نصل ∫dx`);
          return;
        }
        this._registerWrongHit(e, 'فجوة مساحة سالبة — سدّها بـ [2] نصل ∫dx');
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
          this._registerRightHit(e, 'تداخل هدّام (-f)! أعد الضربة', '#f472b6', 45, knockDir);
          return;
        }
        if (weaponId === 'diff' || weaponId === 'integ') {
          if (e.hKind === 'exp') {
            this._registerWrongHit(
              e,
              `${weaponId === 'diff' ? 'd/dx' : '∫'}(eˣ) = eˣ صامد! استعمل [3] نصال -f(x)`
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
        this._registerWrongHit(e, 'ألغِ الموجة بنصل [3] -f(x)');
        return;
      }

      if (e.type === 'vector_charger') {
        if (weaponId === 'vector') {
          const fn = Math.max(1e-4, Math.hypot(e.fx, e.fy));
          const dot = (dirX * e.fx + dirY * e.fy) / fn;
          if (dot < -0.38) {
            this._defeatEnemy(enemyIdx, 'F⃗ + (-F⃗) = 0⃗ · توازن صفري!');
            return;
          }
          if (Math.abs(dot) <= 0.42) {
            this._defeatEnemy(enemyIdx, 'F⃗ · u⃗ = 0 · انحراف متعامد!');
            return;
          }
          e.fx = utils.clamp(e.fx + dirX * 1.4, -7.5, 7.5);
          e.fy = utils.clamp(e.fy + dirY * 1.4, -4.5, 4.5);
          e.norm = Math.hypot(e.fx, e.fy);
          this._registerWrongHit(e, 'نفس الاتجاه: F⃗ + u⃗! اطعن عكس السهم أو عموديًا عليه');
          return;
        }
        this._registerWrongHit(e, 'قوة متجهية — عادِلها برمح [4] -v⃗ (معاكس أو عمودي)');
        return;
      }

      if (e.type === 'kink') {
        if (!e.smoothed) {
          if (weaponId === 'integ') {
            e.smoothed = true;
            e.coeffs = [1, -2, 1];
            e.rightWeapon = 'diff';
            this._registerRightHit(e, '∫|x| → (x-1)² نُعّمت الزاوية! اقطعه الآن بـ [1] d/dx', '#c084fc', 50, knockDir);
            return;
          }
          this._registerWrongHit(
            e,
            weaponId === 'diff'
              ? 'الزاوية |x| غير قابلة للاشتقاق! نعّمها أولًا بـ [2] نصل ∫dx'
              : 'نعّم الزاوية الحادة أولًا بـ [2] نصل ∫dx'
          );
          return;
        }
        if (weaponId === 'diff') {
          const degBefore = polyDegree(e.coeffs);
          if (degBefore === 0) {
            this._defeatEnemy(enemyIdx, 'd/dx(c) = 0 · تفكك المحارب!');
            return;
          }
          e.coeffs = diffPoly(e.coeffs);
          if (isZeroPoly(e.coeffs)) {
            this._defeatEnemy(enemyIdx, 'd/dx → 0 · تفكك!');
            return;
          }
          this._registerRightHit(e, `d/dx → ${formatPoly(e.coeffs)}`, '#38bdf8', 45, knockDir);
          return;
        }
        if (weaponId === 'integ') {
          e.coeffs = integPoly(e.coeffs);
          this._registerWrongHit(e, 'أصبح كثير حدود! استعمل [1] كاتانا d/dx الآن');
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
              e.rightWeapon = 'negate';
              this._registerRightHit(e, 'المرحلة 1 أُزيلت! الآن نواة eˣ بـ [3] -f(x)', '#38bdf8', 70, knockDir);
              return;
            }
            e.coeffs = diffPoly(e.coeffs);
            if (isZeroPoly(e.coeffs)) {
              e.phase = 1;
              e.rightWeapon = 'negate';
              this._registerRightHit(e, 'انكسر الدرع! الآن نواة eˣ بـ [3] -f(x)', '#38bdf8', 70, knockDir);
              return;
            }
            this._registerRightHit(e, `d/dx(Boss₁) → ${formatPoly(e.coeffs)}`, '#38bdf8', 50, knockDir);
            return;
          }
          if (weaponId === 'integ') {
            e.coeffs = integPoly(e.coeffs);
            this._registerWrongHit(e, 'تكامل الدرع رفع درجته! استعمل [1] d/dx');
            return;
          }
          this._registerWrongHit(e, 'المرحلة 1 كثير حدود — استعمل [1] كاتانا d/dx');
          return;
        }

        if (e.phase === 1) {
          if (weaponId === 'negate') {
            e.hHitsLeft -= 1;
            if (e.hHitsLeft <= 0) {
              e.phase = 2;
              e.rightWeapon = 'vector';
              this._registerRightHit(e, 'eˣ + (-eˣ) = 0! المرحلة 3: رمح [4] -v⃗', '#f472b6', 80, knockDir);
              return;
            }
            this._registerRightHit(e, 'تداخل هدّام (-eˣ)! ضربة أخرى', '#f472b6', 50, knockDir);
            return;
          }
          this._registerWrongHit(e, 'eˣ صامد أمام التفاضل/التكامل! استعمل [3] نصال -f(x)');
          return;
        }

        if (e.phase === 2) {
          if (weaponId === 'vector') {
            const fn = Math.max(1e-4, Math.hypot(e.fx, e.fy));
            const dot = (dirX * e.fx + dirY * e.fy) / fn;
            if (dot < -0.35 || Math.abs(dot) <= 0.45) {
              e.phase = 3;
              e.rightWeapon = 'integ';
              this._registerRightHit(e, 'توازنت القوة! المرحلة الأخيرة: [2] نصل ∫dx', '#f59e0b', 80, knockDir);
              return;
            }
            this._registerWrongHit(e, 'اطعن عكس F⃗ أو عموديًا عليها بـ [4] -v⃗');
            return;
          }
          this._registerWrongHit(e, 'المرحلة 3 متجهة قوة — عادِلها برمح [4] -v⃗');
          return;
        }

        if (e.phase === 3) {
          if (weaponId === 'integ') {
            e.area = Math.min(0, e.area + (isCrit ? 2.5 : 1.5));
            if (e.area >= -0.05) {
              this._defeatEnemy(enemyIdx, '∫ = 0! سقط السيّد التفاضلي!');
              return;
            }
            this._registerRightHit(e, `∫+1.5 → المتبقي ${e.area.toFixed(1)}`, '#c084fc', 55, knockDir);
            return;
          }
          this._registerWrongHit(e, 'أغلق الفجوة النهائية بالسيف الثقيل [2] ∫dx');
        }
      }
    }

    update(dt) {
      if (!this.active) return;

      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.fireAnimTimer = Math.max(0, this.fireAnimTimer - dt);
      this.playerInvulnTimer = Math.max(0, this.playerInvulnTimer - dt);
      this.parryTimer = Math.max(0, this.parryTimer - dt);
      this.parryCooldown = Math.max(0, this.parryCooldown - dt);
      this.parrySuccessTimer = Math.max(0, this.parrySuccessTimer - dt);
      this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer <= 0) this.shakeMag = 0;

      if (this.attackState.active) {
        this.attackState.timer += dt;
        if (this.attackState.timer >= this.attackState.duration) {
          this.attackState.active = false;
        }
      }

      // Trigger Ground Slam Impact as soon as Stickman touches down after slam dive
      if (this.slamDiveActive && (this.stickman.grounded || this.stickman.y <= 0.05)) {
        this._triggerGroundSlamImpact();
      }

      // Tick floating slash VFX & popups even during hitstop for crisp visual decay
      for (let i = this.slashes.length - 1; i >= 0; i--) {
        this.slashes[i].life -= dt;
        if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.life -= dt;
        p.y += p.vy * dt;
        if (p.life <= 0) this.popups.splice(i, 1);
      }

      if (this.gameOver) return;

      // Hitstop freeze frames pause combat physics briefly on meaty blade/parry hits!
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        return;
      }

      // Update sword-wave projectiles
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
          if (pr.ignoredIds && pr.ignoredIds.has(e.id)) continue;
          const d = Math.hypot(pr.x - e.x, pr.y - e.y);
          if (d <= e.r + pr.r) {
            this._applyWeaponHit(j, pr.weaponId, pr.dirX, pr.dirY, false);
            consumed = true;
            break;
          }
        }
        if (consumed) {
          this.projectiles.splice(i, 1);
        }
      }

      // Check thrown/ridden vectors hitting enemies cleanly as counter-vectors!
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
            if (dSeg <= e.r + 0.38) {
              vec.hitEnemyIds.add(e.id);
              this._applyWeaponHit(j, 'vector', uxDir, uyDir, true);
              break;
            }
          }
        }
      }

      // Update IK Stickman Enemies AI, telegraph windups, and parry/damage collision
      const targetX = this.stickman.x;
      const targetY = this.stickman.y + 0.88;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.animTime += dt;
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        e.hitFlash = Math.max(0, e.hitFlash - dt);
        e.attackCooldown = Math.max(0, e.attackCooldown - dt);

        // Apply knockback & gravity recovery
        if (e.stunTimer > 0) {
          e.aiState = 'stun';
          e.vx = utils.damp(e.vx, 0, 7, dt);
          e.x += e.vx * dt;
          if (e.y > e.baseGroundY || e.vy > 0) {
            e.vy -= 22 * dt;
            e.y = Math.max(e.baseGroundY, e.y + e.vy * dt);
            if (e.y <= e.baseGroundY) e.vy = 0;
          }
          continue;
        }

        const dx = targetX - e.x;
        const dy = targetY - e.y;
        const dist = Math.max(1e-4, Math.hypot(dx, dy));
        if (Math.abs(dx) > 0.12 && e.aiState !== 'strike' && e.dashActive <= 0) {
          e.facing = Math.sign(dx);
        }

        if (e.type === 'vector_charger') {
          e.chargeTimer -= dt;
          if (e.dashActive > 0) {
            e.aiState = 'strike';
            e.dashActive -= dt;
            const fn = Math.max(1e-4, Math.hypot(e.fx, e.fy));
            e.x += (e.fx / fn) * 6.4 * dt;
            e.y = utils.clamp(e.y + (e.fy / fn) * 4.2 * dt, 0.85, 6.2);
            e.facing = e.fx >= 0 ? 1 : -1;
            if (e.dashActive <= 0) e.aiState = 'chase';
          } else if (e.chargeTimer <= 0.42 && e.chargeTimer > 0) {
            // Telegraph lance aim before dashing!
            e.aiState = 'windup';
            e.windupTimer = e.chargeTimer;
            e.fx = utils.clamp((dx / dist) * 5.2, -6, 6);
            e.fy = utils.clamp((dy / dist) * 3.8, -3.5, 3.5);
            e.norm = Math.hypot(e.fx, e.fy);
            e.vx *= 0.8;
          } else if (e.chargeTimer <= 0) {
            e.aiState = 'strike';
            e.dashActive = 0.65;
            e.chargeTimer = 2.35;
          } else {
            e.aiState = 'chase';
            e.x += Math.sign(dx) * 1.15 * dt;
            e.y = utils.damp(e.y, Math.max(1.15, targetY + 0.35), 2.8, dt);
          }
        } else if (e.type === 'boss') {
          e.chargeTimer -= dt;
          if (e.dashActive > 0) {
            e.aiState = 'strike';
            e.dashActive -= dt;
            e.x += Math.sign(e.fx || dx) * 5.2 * dt;
            e.y = utils.clamp(e.y + Math.sign(e.fy) * 1.6 * dt, 1.45, 4.8);
            if (e.dashActive <= 0) e.aiState = 'chase';
          } else if (e.chargeTimer <= 0.48 && e.chargeTimer > 0) {
            e.aiState = 'windup';
            e.windupTimer = e.chargeTimer;
            e.fx = utils.clamp((dx / dist) * 5.5, -6, 6);
            e.fy = utils.clamp((dy / dist) * 3.2, -3, 3);
          } else if (e.chargeTimer <= 0) {
            e.aiState = 'strike';
            e.dashActive = 0.72;
            e.chargeTimer = 2.7;
          } else {
            e.aiState = 'chase';
            e.x += Math.sign(dx) * 1.35 * dt;
            e.y = e.baseY + Math.sin(e.animTime * 1.6) * 0.65;
          }
        } else {
          // Poly, Kink, Deficit, Harmonic stickmen melee state machine
          if (e.aiState === 'windup') {
            e.vx = utils.damp(e.vx, 0, 12, dt);
            e.windupTimer -= dt;
            if (e.windupTimer <= 0) {
              e.aiState = 'strike';
              e.strikeTimer = 0.2;
              e.attackDidHit = false;
              e.vx = e.facing * (e.type === 'kink' ? 5.6 : 4.2);
            }
          } else if (e.aiState === 'strike') {
            e.strikeTimer -= dt;
            e.x += e.vx * dt;
            if (e.strikeTimer <= 0) {
              e.aiState = 'chase';
              e.attackCooldown = 1.05;
              e.vx = 0;
            }
          } else {
            e.aiState = 'chase';
            const attackRange = e.r + 1.05;
            if (dist <= attackRange && e.attackCooldown <= 0) {
              e.aiState = 'windup';
              e.windupTimer = 0.44;
              e.vx = 0;
            } else if (e.type === 'harmonic') {
              e.vx = utils.damp(e.vx, Math.sign(dx) * e.speed, 3.8, dt);
              e.x += e.vx * dt;
              e.y = e.baseY + Math.sin(e.animTime * 2.4) * 0.88;
            } else if (e.type === 'deficit') {
              e.vx = utils.damp(e.vx, (dx / dist) * e.speed, 3.8, dt);
              e.vy = utils.damp(e.vy, (dy / dist) * e.speed * 0.72, 3.8, dt);
              e.x += e.vx * dt;
              e.y = Math.max(0.88, e.y + e.vy * dt);
            } else {
              e.vx = utils.damp(e.vx, Math.sign(dx) * e.speed, 6.5, dt);
              e.x += e.vx * dt;
              if (e.y > e.baseGroundY || e.vy > 0) {
                e.vy -= 22 * dt;
                e.y = Math.max(e.baseGroundY, e.y + e.vy * dt);
                if (e.y <= e.baseGroundY) e.vy = 0;
              } else {
                e.y = e.baseGroundY;
              }
            }
          }
        }

        // Player contact / parry / hurt check
        const pDist = Math.hypot(targetX - e.x, targetY - e.y);
        const strikeThreat = e.aiState === 'strike' || e.dashActive > 0;
        const canTouchHurt = strikeThreat || (e.aiState === 'chase' && pDist < e.r + 0.34);

        if (canTouchHurt && pDist <= e.r + 0.85) {
          // If player has active Parry window open: trigger Dead Cells Perfect Parry!
          if (this.parryTimer > 0) {
            this._executeSuccessfulParry(i);
            continue;
          }

          // Otherwise check dash i-frames & invulnerability
          if (
            this.playerInvulnTimer <= 0 &&
            this.stickman.dashTimer <= 0 &&
            !this.slamDiveActive
          ) {
            if (pDist < e.r + (strikeThreat ? 0.62 : 0.36)) {
              this.hp = Math.max(0, this.hp - e.damage);
              this.combo = 0;
              this.playerInvulnTimer = 0.95;
              this.stickman.damageFlashTimer = 0.32;
              this.hitstopTimer = Math.max(this.hitstopTimer, 0.055);
              this.triggerShake(8.5, 0.18);
              const knockDir = targetX >= e.x ? 1 : -1;
              if (this.stickman.ridingVector) this.stickman.dismountVector(false);
              this.stickman.surfingCurve = false;
              this.stickman.vx = knockDir * 6.0;
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
      ctx.moveTo(size * 0.3, 0);
      ctx.lineTo(-size, -size * 0.44);
      ctx.lineTo(-size * 0.65, 0);
      ctx.lineTo(-size, size * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    _drawSegWorld(ctx, x1, y1, x2, y2, widthPx, color, hw, hh, cx, cy, ppu) {
      const sx1 = hw + (x1 - cx) * ppu;
      const sy1 = hh - (y1 - cy) * ppu;
      const sx2 = hw + (x2 - cx) * ppu;
      const sy2 = hh - (y2 - cy) * ppu;
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }

    _renderEnemyStickman(ctx, e, camera, gridRenderer, theme, mainCol, strokeCol) {
      const ppu = camera.ppu;
      const hw = gridRenderer.width * 0.5;
      const hh = gridRenderer.height * 0.5;
      const cx = camera.x;
      const cy = camera.y;
      const isBlack = theme.bg === '#000000';
      const scale = e.type === 'boss' ? 1.62 : 0.98;
      const f = e.facing || -1;

      const stunned = e.stunTimer > 0;
      const windingUp = e.aiState === 'windup';
      const striking = e.aiState === 'strike';

      // Procedural IK Rival Stickman Warrior Coordinates around e.x, e.y
      const walkBob =
        e.type === 'harmonic' || e.type === 'deficit'
          ? Math.sin(e.animTime * 4) * 0.04
          : Math.abs(Math.sin(e.animTime * 6)) * (Math.abs(e.vx) > 0.2 ? 0.04 : 0.01);
      const hipX = e.x;
      const hipY = e.y - 0.14 * scale + walkBob;
      const crouchTilt = stunned
        ? -0.32
        : windingUp
          ? -0.24
          : striking
            ? 0.48
            : Math.abs(e.vx) > 0.3
              ? 0.22
              : 0.06;
      const torsoLen = 0.5 * scale;
      const shX = hipX + f * Math.sin(crouchTilt) * torsoLen;
      const shY = hipY + Math.cos(crouchTilt) * torsoLen;
      const headR = 0.155 * scale;
      const headX = shX + f * Math.sin(crouchTilt * 0.7) * (headR + 0.06 * scale);
      const headY = shY + Math.cos(crouchTilt * 0.7) * (headR + 0.06 * scale);

      const thigh = 0.4 * scale;
      const shin = 0.4 * scale;
      const stride =
        e.type === 'harmonic'
          ? 0.12
          : Math.sin(e.animTime * (Math.abs(e.vx) > 0.2 ? 9.5 : 3)) *
            (Math.abs(e.vx) > 0.2 ? 0.26 * scale : 0.04 * scale);

      const footY = e.type === 'harmonic' || e.type === 'deficit' ? hipY - 0.72 * scale : 0;
      const leg1 = solveIK2(hipX, hipY, hipX + f * (0.12 * scale + stride), footY, thigh, shin, f);
      const leg2 = solveIK2(hipX, hipY, hipX - f * (0.14 * scale + stride * 0.8), footY, thigh, shin, f);

      const armU = 0.26 * scale;
      const armF = 0.25 * scale;
      let arm1Target;
      let arm2Target;
      if (stunned) {
        arm1Target = { x: shX - f * 0.22 * scale, y: shY + 0.15 * scale };
        arm2Target = { x: shX + f * 0.24 * scale, y: shY - 0.18 * scale };
      } else if (windingUp) {
        arm1Target = { x: shX - f * 0.34 * scale, y: shY + 0.34 * scale };
        arm2Target = { x: shX + f * 0.24 * scale, y: shY + 0.1 * scale };
      } else if (striking) {
        arm1Target = { x: shX + f * 0.48 * scale, y: shY - 0.08 * scale };
        arm2Target = { x: shX - f * 0.2 * scale, y: shY - 0.16 * scale };
      } else {
        const readySway = Math.sin(e.animTime * 4.2) * 0.05 * scale;
        arm1Target = { x: shX + f * 0.32 * scale, y: shY - 0.06 * scale + readySway };
        arm2Target = { x: shX - f * 0.16 * scale, y: shY - 0.22 * scale - readySway };
      }

      const arm1 = solveIK2(shX, shY, arm1Target.x, arm1Target.y, armU, armF, -f);
      const arm2 = solveIK2(shX, shY, arm2Target.x, arm2Target.y, armU, armF, -f);

      const limbW = Math.max(2.0, ppu * 0.062 * scale);
      const torsoW = Math.max(2.6, ppu * 0.084 * scale);
      const bodyCol = e.hitFlash > 0 ? '#ffffff' : isBlack ? '#f1f5f9' : '#0f172a';
      const backLimbCol = e.hitFlash > 0 ? '#ffffff' : mainCol;

      // Ground shadow under stickman
      if (e.type !== 'harmonic' && e.type !== 'deficit') {
        const sFoot = gridRenderer.worldToScreen(e.x, 0, camera);
        ctx.fillStyle = theme.shadow;
        ctx.beginPath();
        ctx.ellipse(sFoot.x, sFoot.y, Math.max(7, ppu * 0.32 * scale), Math.max(2, ppu * 0.06 * scale), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Aura glow ring behind Boss or Charging Lancer
      if (e.type === 'boss' || e.dashActive > 0) {
        const spTorso = gridRenderer.worldToScreen(shX, shY, camera);
        ctx.strokeStyle = mainCol;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = Math.max(3, 4 * scale);
        ctx.beginPath();
        ctx.arc(spTorso.x, spTorso.y, ppu * 0.58 * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Back arm & back leg
      this._drawSegWorld(ctx, shX, shY, arm2.jx, arm2.jy, limbW * 0.9, backLimbCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, arm2.jx, arm2.jy, arm2.ex, arm2.ey, limbW * 0.82, backLimbCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, hipX, hipY, leg2.jx, leg2.jy, limbW * 0.95, backLimbCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, leg2.jx, leg2.jy, leg2.ex, leg2.ey, limbW * 0.88, backLimbCol, hw, hh, cx, cy, ppu);

      // Torso + colored armor rim
      this._drawSegWorld(ctx, hipX, hipY, shX, shY, torsoW, bodyCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, hipX, hipY, shX, shY, torsoW * 0.42, strokeCol, hw, hh, cx, cy, ppu);

      // Front leg & arm
      this._drawSegWorld(ctx, hipX, hipY, leg1.jx, leg1.jy, limbW, bodyCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, leg1.jx, leg1.jy, leg1.ex, leg1.ey, limbW * 0.92, bodyCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, shX, shY, arm1.jx, arm1.jy, limbW, bodyCol, hw, hh, cx, cy, ppu);
      this._drawSegWorld(ctx, arm1.jx, arm1.jy, arm1.ex, arm1.ey, limbW * 0.92, bodyCol, hw, hh, cx, cy, ppu);

      // Sculpted warrior head + fierce glowing visor eye + signature silhouette gear!
      const spH = { x: hw + (headX - cx) * ppu, y: hh - (headY - cy) * ppu };
      const headPx = Math.max(4.5, headR * ppu);
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.arc(spH.x, spH.y, headPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = Math.max(1.5, headPx * 0.14);
      ctx.stroke();

      // Glowing warrior headband / eye slit
      const eyeX = spH.x + f * headPx * 0.42;
      const eyeY = spH.y - headPx * 0.08;
      ctx.fillStyle = windingUp ? '#fde047' : mainCol;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, Math.max(2, headPx * 0.22), Math.max(1.2, headPx * 0.11), f * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Headband / Crown spikes per math warrior type
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = Math.max(1.8, ppu * 0.032 * scale);
      if (e.type === 'boss') {
        // Composite Sovereign 3-spike crown
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(spH.x + k * headPx * 0.55, spH.y - headPx * 0.85);
          ctx.lineTo(spH.x + k * headPx * 0.72, spH.y - headPx * 1.55);
          ctx.stroke();
        }
      } else if (e.type === 'kink') {
        // Sharp |x| Samurai horns
        ctx.beginPath();
        ctx.moveTo(spH.x - f * headPx * 0.1, spH.y - headPx * 0.85);
        ctx.lineTo(spH.x - f * headPx * 0.55, spH.y - headPx * 1.48);
        ctx.moveTo(spH.x + f * headPx * 0.25, spH.y - headPx * 0.85);
        ctx.lineTo(spH.x + f * headPx * 0.65, spH.y - headPx * 1.48);
        ctx.stroke();
      } else {
        // Flowing fighter headband tails
        const wv = Math.sin(e.animTime * 8) * headPx * 0.25;
        ctx.beginPath();
        ctx.moveTo(spH.x - f * headPx * 0.7, spH.y - headPx * 0.2);
        ctx.lineTo(spH.x - f * headPx * 1.55, spH.y - headPx * 0.4 + wv);
        ctx.moveTo(spH.x - f * headPx * 0.7, spH.y - headPx * 0.1);
        ctx.lineTo(spH.x - f * headPx * 1.35, spH.y + headPx * 0.15 - wv);
        ctx.stroke();
      }

      // Enemy held math weapon in frontHand (arm1.ex, arm1.ey)
      const spHand = { x: hw + (arm1.ex - cx) * ppu, y: hh - (arm1.ey - cy) * ppu };
      let weaponAng = f > 0 ? -0.45 : Math.PI + 0.45;
      if (windingUp) weaponAng = f > 0 ? -2.1 : -1.0;
      else if (striking) weaponAng = f > 0 ? 0.15 : Math.PI - 0.15;

      if (e.type === 'vector_charger' || (e.type === 'boss' && e.phase === 2)) {
        const tipW = gridRenderer.worldToScreen(e.x + e.fx * 0.46, e.y + e.fy * 0.46, camera);
        const vAng = Math.atan2(tipW.y - spHand.y, tipW.x - spHand.x);
        ctx.strokeStyle = theme.vecLaunched || '#f59e0b';
        ctx.lineWidth = Math.max(2.8, ppu * 0.045);
        ctx.beginPath();
        ctx.moveTo(spHand.x - Math.cos(vAng) * ppu * 0.35, spHand.y - Math.sin(vAng) * ppu * 0.35);
        ctx.lineTo(tipW.x, tipW.y);
        ctx.stroke();
        this._drawArrowHead(ctx, tipW.x, tipW.y, vAng, Math.max(10, ppu * 0.16), theme.vecLaunched || '#f59e0b');
      } else {
        const bladeLen = ppu * 0.72 * scale;
        ctx.save();
        ctx.translate(spHand.x, spHand.y);
        ctx.rotate(weaponAng);
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = Math.max(2.6, ppu * 0.042 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (e.type === 'kink' && !e.smoothed) {
          // Sharp V-halberd blade |x|
          ctx.moveTo(0, 0);
          ctx.lineTo(bladeLen * 0.55, -bladeLen * 0.25);
          ctx.lineTo(bladeLen, 0);
        } else if (e.type === 'harmonic') {
          // Oscillating wave staff
          ctx.moveTo(0, 0);
          for (let s = 1; s <= 6; s++) {
            const p = s / 6;
            ctx.lineTo(p * bladeLen, Math.sin(p * Math.PI * 2 + e.animTime * 8) * bladeLen * 0.16);
          }
        } else {
          // Sleek curved polynomial/integral katana
          ctx.moveTo(-bladeLen * 0.16, 0);
          ctx.quadraticCurveTo(bladeLen * 0.5, -bladeLen * 0.1, bladeLen, 0);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Dead Cells "! PARRY NOW" exclamation telegraph overhead when enemy winds up strike!
      if (windingUp) {
        const pulse = 1 + Math.sin(e.animTime * 35) * 0.14;
        ctx.save();
        ctx.fillStyle = '#fde047';
        ctx.font = `900 ${Math.round(Math.max(16, ppu * 0.28 * scale) * pulse)}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', spH.x, spH.y - headPx * 2.1);
        ctx.restore();
      } else if (stunned) {
        ctx.save();
        ctx.fillStyle = '#38bdf8';
        ctx.font = "800 12px 'Segoe UI', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('★ STUN', spH.x, spH.y - headPx * 1.9);
        ctx.restore();
      }

      return { headYWorld: headY + headR };
    }

    render(ctx, camera, gridRenderer, theme) {
      if (!this.active) return;

      const isBlack = theme.bg === '#000000';
      const ppu = camera.ppu;

      ctx.save();
      ctx.direction = 'ltr';

      // 1. Render Full Articulated IK Stickman Enemies
      for (const e of this.enemies) {
        const sp = gridRenderer.worldToScreen(e.x, e.y, camera);
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
        const metrics = this._renderEnemyStickman(ctx, e, camera, gridRenderer, theme, mainCol, strokeCol);
        const topWorldY = metrics ? metrics.headYWorld : e.y + e.r;
        const spTop = gridRenderer.worldToScreen(e.x, topWorldY, camera);

        // Deficit progress mini bar
        if (e.type === 'deficit' || (e.type === 'boss' && e.phase === 3)) {
          const ratioFilled = utils.clamp(1 - Math.abs(e.area) / Math.max(1, e.maxDeficit), 0, 1);
          const barW = 46;
          ctx.fillStyle = 'rgba(255, 77, 109, 0.38)';
          ctx.fillRect(spTop.x - barW * 0.5, spTop.y - 10, barW, 4);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(spTop.x - barW * 0.5, spTop.y - 10, barW * ratioFilled, 4);
        }

        // Equation tag + recommended sword/operator badge above enemy head
        const eqText = this._getEnemyFormula(e);
        ctx.font = "700 11px 'Cascadia Mono', 'Consolas', monospace";
        const tw = ctx.measureText(eqText).width;
        const bx = spTop.x - tw * 0.5 - 7;
        const by = spTop.y - 36;
        ctx.fillStyle = theme.coordTagBg;
        ctx.strokeStyle = mainCol;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, tw + 14, 20, 6);
        else ctx.rect(bx, by, tw + 14, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.coordTagText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(eqText, spTop.x, by + 10);

        ctx.font = "700 10px 'Cascadia Mono', 'Consolas', monospace";
        ctx.fillStyle = mainCol;
        ctx.fillText(hintOp, spTop.x, by - 8);
        ctx.restore();
      }

      // 2. Render Dead Cells Curved Melee Slash Arcs, Spear Thrusts, Parry Rings & Slam Shockwaves
      for (const s of this.slashes) {
        const sp = gridRenderer.worldToScreen(s.x, s.y, camera);
        const tNorm = utils.clamp(s.life / s.maxLife, 0, 1);
        const prog = 1 - tNorm;
        ctx.save();
        if (isBlack) ctx.globalCompositeOperation = 'lighter';

        if (s.type === 'ring' || s.type === 'slam') {
          const rad = Math.max(8, s.radius * ppu * (0.28 + 0.85 * prog));
          ctx.globalAlpha = tNorm * 0.85;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.type === 'slam' ? 5.5 * tNorm + 1.5 : 3.2 * tNorm + 1;
          ctx.beginPath();
          if (s.type === 'slam') {
            ctx.ellipse(sp.x, sp.y, rad, rad * 0.34, 0, 0, Math.PI * 2);
          } else {
            ctx.arc(sp.x, sp.y, rad, 0, Math.PI * 2);
          }
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.globalAlpha = tNorm * 0.65;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        } else if (s.type === 'thrust') {
          const len = Math.max(24, s.radius * ppu);
          ctx.translate(sp.x, sp.y);
          ctx.rotate(-s.angle);
          ctx.globalAlpha = tNorm * 0.88;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.moveTo(len * (0.3 + 0.75 * prog), 0);
          ctx.lineTo(0, -10 * tNorm);
          ctx.lineTo(0, 10 * tNorm);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(len * (0.35 + 0.75 * prog), 0);
          ctx.lineTo(len * 0.15, -4 * tNorm);
          ctx.lineTo(len * 0.15, 4 * tNorm);
          ctx.closePath();
          ctx.fill();
        } else {
          // Curved Crescent Sword Arc!
          const rad = Math.max(20, s.radius * ppu);
          const midAng = -s.angle;
          const flipSweep = s.comboStep === 1 ? -1 : 1;
          const startA = midAng - s.sweep * 0.52 * flipSweep;
          const endA = midAng + s.sweep * 0.52 * flipSweep;

          ctx.globalAlpha = tNorm * 0.42;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = Math.max(7, ppu * 0.16 * tNorm);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, rad, startA, endA, flipSweep < 0);
          ctx.stroke();

          ctx.globalAlpha = tNorm * 0.92;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(2.2, ppu * 0.048 * tNorm);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, rad * 1.03, startA, endA, flipSweep < 0);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Render Forward Sword-Wave Blade Projectiles
      for (const pr of this.projectiles) {
        const w = WEAPONS[pr.weaponIdx] || WEAPONS[0];
        const col = isBlack ? w.colorBlack : w.colorLight;
        const sp = gridRenderer.worldToScreen(pr.x, pr.y, camera);
        const rad = Math.max(10, pr.r * ppu * 0.95);
        const ang = -pr.angle;

        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(ang);
        ctx.strokeStyle = col;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-rad * 0.35, 0, rad * 1.1, -1.05, 1.05);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.rotate(-ang);
        ctx.font = "700 9.5px 'Cascadia Mono', 'Consolas', monospace";
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(pr.symbol, 0, -rad - 3);
        ctx.restore();
      }

      // 4. Floating math feedback popups
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
