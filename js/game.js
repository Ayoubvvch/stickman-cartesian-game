(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const {
    CONFIG,
    THEMES,
    utils,
    InputManager,
    ParticleSystem,
    CoordinateGrid,
    FunctionPlotter,
    ChallengeManager,
    WebGL2EffectsRenderer,
    MathAudioSynth,
    VectorSystem,
    MathCombatArena,
    Stickman,
  } = MathStickGame;

  function boot() {
    const gridCanvas = document.getElementById('gridCanvas');
    const gridCtx = gridCanvas ? gridCanvas.getContext('2d', { alpha: false }) : null;
    const glCanvas = document.getElementById('glCanvas');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: true });

    const input = new InputManager();
    const particles = new ParticleSystem();
    const grid = new CoordinateGrid();
    const glfx = new WebGL2EffectsRenderer(glCanvas);
    const audioFx = new MathAudioSynth();
    const functions = new FunctionPlotter();
    const vectorSystem = new VectorSystem(particles);
    const stickman = new Stickman(particles, functions, vectorSystem);
    const challenges = new ChallengeManager(functions, stickman, particles);
    const combat = new MathCombatArena(stickman, particles, vectorSystem, audioFx);
    stickman.setCombatArena(combat);

    const state = {
      themeName: 'black',
      followCamera: true,
      showProjections: true,
      showVelocity: false,
      showHelp: true,
      showFuncPanel: false,
      showVectorPanel: false,
      vecAimMode: true,
      vecPanelEdited: false,
      showTouchPad: false,
      camera: {
        x: 0,
        y: CONFIG.DEFAULT_CAM_Y,
        ppu: CONFIG.DEFAULT_PPU,
        targetPpu: CONFIG.DEFAULT_PPU,
      },
      dragging: false,
      dragLastX: 0,
      dragLastY: 0,
    };

    const pointer = {
      screenX: null,
      screenY: null,
      worldX: 0,
      worldY: 0,
      overCanvas: false,
    };

    // DOM Elements
    const elCoordX = document.getElementById('coordX');
    const elCoordY = document.getElementById('coordY');
    const elVelX = document.getElementById('velX');
    const elVelY = document.getElementById('velY');
    const elScaleInfo = document.getElementById('scaleInfo');
    const elStateBadge = document.getElementById('stateBadge');

    const elKeyboardPill = document.getElementById('keyboardPill');
    const elGamepadPill = document.getElementById('gamepadPill');
    const elKbDot = document.getElementById('kbDot');
    const elGpDot = document.getElementById('gpDot');
    const elGpLabel = document.getElementById('gpLabel');
    const elGpMonitor = document.getElementById('gpMonitor');
    const elGpStickDot = document.getElementById('gpStickDot');
    const elGpBtnA = document.getElementById('gpBtnA');
    const elGpBtnB = document.getElementById('gpBtnB');
    const elGpBtnX = document.getElementById('gpBtnX');
    const elGpBtnY = document.getElementById('gpBtnY');
    const elGpBtnRun = document.getElementById('gpBtnRun');

    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnReset = document.getElementById('btnReset');
    const btnFollow = document.getElementById('btnFollow');
    const btnProjections = document.getElementById('btnProjections');
    const btnVelocity = document.getElementById('btnVelocity');
    const btnVectors = document.getElementById('btnVectors');
    const btnFreeFall = document.getElementById('btnFreeFall');
    const btnStyle = document.getElementById('btnStyle');
    const styleLabel = document.getElementById('styleLabel');
    const btnDance = document.getElementById('btnDance');
    const btnAudio = document.getElementById('btnAudio');
    const btnFunc = document.getElementById('btnFunc');
    const funcActiveDot = document.getElementById('funcActiveDot');
    const btnTrials = document.getElementById('btnTrials');
    const btnArena = document.getElementById('btnArena');
    const btnDerivOverlay = document.getElementById('btnDerivOverlay');
    const btnIntegralOverlay = document.getElementById('btnIntegralOverlay');
    const btnMarkersOverlay = document.getElementById('btnMarkersOverlay');
    const btnFx = document.getElementById('btnFx');
    const btnTouchPad = document.getElementById('btnTouchPad');
    const btnTheme = document.getElementById('btnTheme');
    const btnHelp = document.getElementById('btnHelp');
    const btnCloseHelp = document.getElementById('btnCloseHelp');
    const helpPanel = document.getElementById('helpPanel');
    const virtualPad = document.getElementById('virtualPad');
    const funcPanel = document.getElementById('funcPanel');
    const btnCloseFunc = document.getElementById('btnCloseFunc');
    const btnToggleFunc = document.getElementById('btnToggleFunc');
    const funcForm = document.getElementById('funcForm');
    const funcInput = document.getElementById('funcInput');
    const funcPresetsEl = document.getElementById('funcPresets');
    const funcSymbolicBox = document.getElementById('funcSymbolicBox');
    const symDeriv1 = document.getElementById('symDeriv1');
    const symDeriv2 = document.getElementById('symDeriv2');
    const symIntegralRow = document.getElementById('symIntegralRow');
    const symIntegralVal = document.getElementById('symIntegralVal');
    const funcStatus = document.getElementById('funcStatus');

    const vectorPanel = document.getElementById('vectorPanel');
    const btnCloseVector = document.getElementById('btnCloseVector');
    const btnVecAim = document.getElementById('btnVecAim');
    const btnClearVectors = document.getElementById('btnClearVectors');
    const vectorForm = document.getElementById('vectorForm');
    const vecUxInput = document.getElementById('vecUxInput');
    const vecUyInput = document.getElementById('vecUyInput');
    const vectorMeta = document.getElementById('vectorMeta');
    const vectorStatus = document.getElementById('vectorStatus');
    const vectorPresetsEl = document.getElementById('vectorPresets');

    const arenaPanel = document.getElementById('arenaPanel');
    const btnCloseArena = document.getElementById('btnCloseArena');
    const btnArenaReset = document.getElementById('btnArenaReset');
    const btnArenaRestart = document.getElementById('btnArenaRestart');
    const arenaWave = document.getElementById('arenaWave');
    const arenaHpText = document.getElementById('arenaHpText');
    const arenaHpFill = document.getElementById('arenaHpFill');
    const arenaScore = document.getElementById('arenaScore');
    const arenaCombo = document.getElementById('arenaCombo');
    const arenaAccuracy = document.getElementById('arenaAccuracy');
    const arenaLog = document.getElementById('arenaLog');
    const arenaGameOverBanner = document.getElementById('arenaGameOverBanner');
    const arenaGameOverText = document.getElementById('arenaGameOverText');
    const weaponBar = document.getElementById('weaponBar');
    const weaponDesc = document.getElementById('weaponDesc');
    const btnArenaParry = document.getElementById('btnArenaParry');
    const btnArenaLaunchVec = document.getElementById('btnArenaLaunchVec');

    const trialPanel = document.getElementById('trialPanel');
    const btnCloseTrial = document.getElementById('btnCloseTrial');
    const trialProgress = document.getElementById('trialProgress');
    const trialTabs = document.getElementById('trialTabs');
    const trialTitle = document.getElementById('trialTitle');
    const trialConcept = document.getElementById('trialConcept');
    const trialPrompt = document.getElementById('trialPrompt');
    const trialForm = document.getElementById('trialForm');
    const trialExprInput = document.getElementById('trialExprInput');
    const trialMarkRow = document.getElementById('trialMarkRow');
    const btnTrialMark = document.getElementById('btnTrialMark');
    const trialChecks = document.getElementById('trialChecks');
    const trialFeedback = document.getElementById('trialFeedback');
    const trialHintBox = document.getElementById('trialHintBox');
    const btnTrialHint = document.getElementById('btnTrialHint');
    const btnTrialPrev = document.getElementById('btnTrialPrev');
    const btnTrialReset = document.getElementById('btnTrialReset');
    const btnTrialNext = document.getElementById('btnTrialNext');

    let dpr = Math.min(global.devicePixelRatio || 1, 1.5);
    let rafId = 0;
    let gpIdleTimer = 0;
    let lastTimestamp = performance.now();
    let lastRenderTimestamp = lastTimestamp - 100;
    let forceWakeFrame = true;
    let idleSettleFrames = 6;
    let latestCrouchHeld = false;

    function computeDpr(w, h) {
      const raw = global.devicePixelRatio || 1;
      return w * h > 1300000 ? Math.min(raw, 1.25) : Math.min(raw, 1.5);
    }

    function stopGamepadIdlePoll() {
      if (gpIdleTimer) {
        clearTimeout(gpIdleTimer);
        gpIdleTimer = 0;
      }
    }

    function scheduleGamepadIdlePoll() {
      stopGamepadIdlePoll();
      if (!input.hasConnectedGamepad || document.hidden || rafId) return;
      gpIdleTimer = setTimeout(() => {
        gpIdleTimer = 0;
        if (document.hidden || rafId) return;
        if (input.isGamepadInputActive()) {
          wakeFrame();
        } else if (input.hasConnectedGamepad) {
          scheduleGamepadIdlePoll();
        }
      }, 150);
    }

    function wakeFrame() {
      forceWakeFrame = true;
      idleSettleFrames = Math.max(idleSettleFrames, 4);
      stopGamepadIdlePoll();
      if (!document.hidden && !rafId) {
        lastTimestamp = performance.now();
        lastRenderTimestamp = lastTimestamp - 100;
        rafId = global.requestAnimationFrame(frame);
      }
    }

    input.setWakeCallback(wakeFrame);

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      dpr = computeDpr(w, h);
      const targetW = Math.floor(w * dpr);
      const targetH = Math.floor(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      if (gridCanvas && (gridCanvas.width !== targetW || gridCanvas.height !== targetH)) {
        gridCanvas.width = targetW;
        gridCanvas.height = targetH;
        grid.invalidate();
      }
      grid.setViewportSize(w, h, dpr);
      glfx.resize(w, h);
      wakeFrame();
    }

    global.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Auto-detect coarse touch device to surface touch pad nicely if desired
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) {
      setTouchPad(true);
    }

    function setFollowCamera(enabled) {
      state.followCamera = enabled;
      btnFollow.classList.toggle('active', enabled);
      btnFollow.setAttribute('aria-pressed', String(enabled));
      wakeFrame();
    }

    function setProjections(enabled) {
      state.showProjections = enabled;
      btnProjections.classList.toggle('active', enabled);
      btnProjections.setAttribute('aria-pressed', String(enabled));
      wakeFrame();
    }

    function setVelocity(enabled) {
      state.showVelocity = enabled;
      btnVelocity.classList.toggle('active', enabled);
      btnVelocity.setAttribute('aria-pressed', String(enabled));
      wakeFrame();
    }

    function syncCanvasCursor() {
      if (combat.active || (state.showVectorPanel && state.vecAimMode)) {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = '';
      }
    }

    function syncStyleButton() {
      if (!btnStyle) return;
      const spec = stickman.getCharacterStyleSpec();
      btnStyle.dataset.style = spec.id;
      if (styleLabel) styleLabel.textContent = spec.label;
      btnStyle.title = `Warrior Style: ${spec.nameAr || spec.label} (N)`;
    }

    function launchVectorWithSfx(ux, uy) {
      audioFx.unlock();
      if (typeof audioFx.playThrowWhoosh === 'function') {
        audioFx.playThrowWhoosh();
      }
      stickman.startVectorThrow(ux, uy, (hx, hy) => {
        const opts = stickman.ridingVector ? {} : { originX: hx, originY: hy };
        const res = vectorSystem.launchVector(ux, uy, stickman, opts);
        if (res && res.kind === 'chasles') {
          audioFx.playChaslesAdd();
        } else if (res && res.kind === 'launch') {
          audioFx.playVectorLaunch();
        }
        syncVectorUi(true);
        wakeFrame();
      });
      wakeFrame();
    }

    function getQuickVectorComponents() {
      if (state.vecPanelEdited) {
        return { ux: vectorSystem.presetUx, uy: vectorSystem.presetUy };
      }
      if (combat.active && pointer.overCanvas) {
        const ux = pointer.worldX - stickman.x;
        const uy = pointer.worldY - (stickman.y + 1.05);
        if (Math.hypot(ux, uy) >= 0.45) {
          return { ux, uy };
        }
      }
      return {
        ux: (stickman.facing || 1) * Math.abs(vectorSystem.presetUx),
        uy: vectorSystem.presetUy,
      };
    }

    function setHelp(enabled) {
      if (enabled && global.innerWidth <= 1000) {
        if (challenges.active) setTrialsMode(false);
        if (state.showFuncPanel) setFuncPanel(false);
        if (state.showTouchPad) setTouchPad(false);
      }
      state.showHelp = enabled;
      helpPanel.classList.toggle('hidden', !enabled);
      btnHelp.classList.toggle('active', enabled);
      btnHelp.setAttribute('aria-pressed', String(enabled));
      wakeFrame();
    }

    function setTouchPad(enabled) {
      if (enabled && global.innerWidth <= 1000) {
        if (challenges.active) setTrialsMode(false);
        if (state.showHelp) setHelp(false);
        if (state.showFuncPanel) setFuncPanel(false);
      }
      state.showTouchPad = enabled;
      virtualPad.classList.toggle('hidden', !enabled);
      if (weaponBar) weaponBar.classList.toggle('with-touchpad', enabled);
      btnTouchPad.classList.toggle('active', enabled);
      btnTouchPad.setAttribute('aria-pressed', String(enabled));
      wakeFrame();
    }

    function toggleTheme() {
      state.themeName = state.themeName === 'black' ? 'light' : 'black';
      document.body.classList.toggle('theme-black', state.themeName === 'black');
      document.body.classList.toggle('theme-light', state.themeName === 'light');
      btnTheme.textContent = state.themeName === 'black' ? '☀️' : '🌙';
      wakeFrame();
    }

    function zoomBy(factor, anchorScreenX, anchorScreenY) {
      const prevTarget = state.camera.targetPpu;
      const nextTarget = utils.clamp(prevTarget * factor, CONFIG.MIN_PPU, CONFIG.MAX_PPU);
      if (!state.followCamera && anchorScreenX !== undefined && anchorScreenY !== undefined) {
        const worldBefore = grid.screenToWorld(anchorScreenX, anchorScreenY, state.camera);
        state.camera.targetPpu = nextTarget;
        state.camera.ppu = nextTarget;
        const worldAfter = grid.screenToWorld(anchorScreenX, anchorScreenY, state.camera);
        state.camera.x += worldBefore.x - worldAfter.x;
        state.camera.y += worldBefore.y - worldAfter.y;
      } else {
        state.camera.targetPpu = nextTarget;
      }
      wakeFrame();
    }

    function resetAll() {
      if (challenges.active) {
        challenges.resetTrial();
        setFollowCamera(true);
        syncTrialUi(true);
        wakeFrame();
        return;
      }
      if (combat.active) {
        combat.resetRun();
        state.camera.x = 0;
        state.camera.y = CONFIG.DEFAULT_CAM_Y;
        setFollowCamera(true);
        syncArenaUi(true);
        syncVectorUi(true);
        wakeFrame();
        return;
      }
      stickman.reset();
      particles.clear();
      vectorSystem.clear();
      state.camera.x = 0;
      state.camera.y = CONFIG.DEFAULT_CAM_Y;
      setFollowCamera(true);
      syncVectorUi(true);
      wakeFrame();
    }

    // Toolbar events
    btnZoomIn.addEventListener('click', () => zoomBy(1.2));
    btnZoomOut.addEventListener('click', () => zoomBy(1 / 1.2));
    btnReset.addEventListener('click', resetAll);
    btnFollow.addEventListener('click', () => setFollowCamera(!state.followCamera));
    btnProjections.addEventListener('click', () => setProjections(!state.showProjections));
    btnVelocity.addEventListener('click', () => setVelocity(!state.showVelocity));
    if (btnVectors) {
      btnVectors.addEventListener('click', () => setVectorPanel(!state.showVectorPanel));
    }
    if (btnArena) {
      btnArena.addEventListener('click', () => setArenaMode(!combat.active));
    }
    btnFreeFall.addEventListener('click', () => {
      setFollowCamera(true);
      input.triggerFreeFall();
    });
    btnDance.addEventListener('click', () => {
      audioFx.unlock();
      honoredAudio.unlockFromGesture(stickman.danceStyle === 2 && !stickman.dancing);
      wakeFrame();
      input.triggerDance();
    });
    btnAudio.addEventListener('click', () => {
      honoredAudio.unlockFromGesture(stickman.dancing && stickman.danceStyle === 2);
      honoredAudio.toggleMute();
      audioFx.unlock();
      wakeFrame();
    });
    if (btnStyle) {
      btnStyle.addEventListener('click', () => {
        audioFx.unlock();
        stickman.cycleCharacterStyle();
        syncStyleButton();
        wakeFrame();
      });
    }
    if (btnFx) {
      btnFx.addEventListener('click', () => {
        glfx.setEnabled(!glfx.enabled);
        syncFxButton();
        wakeFrame();
      });
    }
    document.addEventListener('pointerdown', () => audioFx.unlock(), { passive: true });
    btnTouchPad.addEventListener('click', () => setTouchPad(!state.showTouchPad));
    btnTheme.addEventListener('click', toggleTheme);
    btnHelp.addEventListener('click', () => setHelp(!state.showHelp));
    btnCloseHelp.addEventListener('click', () => setHelp(false));

    function isEditableTarget(target) {
      if (!target) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      );
    }

    function setFuncPanel(visible) {
      if (visible && challenges.active) {
        setTrialsMode(false);
      }
      if (visible && global.innerWidth <= 1000) {
        if (state.showHelp) setHelp(false);
        if (state.showTouchPad) setTouchPad(false);
      }
      state.showFuncPanel = visible;
      if (funcPanel) funcPanel.classList.toggle('hidden', !visible);
      if (btnFunc) {
        btnFunc.classList.toggle('active', visible);
        btnFunc.setAttribute('aria-pressed', String(visible));
      }
      wakeFrame();
    }

    function setVectorPanel(visible) {
      if (visible && global.innerWidth <= 1000) {
        if (state.showHelp) setHelp(false);
        if (state.showTouchPad) setTouchPad(false);
      }
      state.showVectorPanel = visible;
      if (vectorPanel) vectorPanel.classList.toggle('hidden', !visible);
      if (btnVectors) {
        btnVectors.classList.toggle('active', visible);
        btnVectors.setAttribute('aria-pressed', String(visible));
      }
      if (!visible) {
        vectorSystem.clearAimPreview();
      }
      syncCanvasCursor();
      syncVectorUi(true);
      wakeFrame();
    }

    let lastArenaSig = '';

    function syncArenaUi(force = false) {
      if (!arenaPanel || !combat.active) {
        lastArenaSig = '';
        return;
      }
      const totalHits = combat.rightHits + combat.wrongHits;
      const accPct = totalHits > 0 ? Math.round((combat.rightHits / totalHits) * 100) : 100;
      const isParrying = combat.parryTimer > 0 || combat.parrySuccessTimer > 0;
      const sig = `${combat.wave}|${Math.round(combat.hp)}|${combat.score}|${combat.combo}|${accPct}|${combat.weaponIndex}|${combat.gameOver ? 1 : 0}|${isParrying ? 1 : 0}|${combat.parryCount}|${combat.lastLog}`;
      if (!force && sig === lastArenaSig) return;
      lastArenaSig = sig;

      if (arenaWave) arenaWave.textContent = `الموجة ${combat.wave}`;
      const hpPct = utils.clamp(Math.round((combat.hp / combat.maxHp) * 100), 0, 100);
      if (arenaHpText) arenaHpText.textContent = `${hpPct}%`;
      if (arenaHpFill) {
        arenaHpFill.style.width = `${hpPct}%`;
        arenaHpFill.classList.toggle('is-warn', hpPct > 30 && hpPct <= 55);
        arenaHpFill.classList.toggle('is-low', hpPct <= 30);
      }
      if (arenaScore) arenaScore.textContent = String(combat.score);
      if (arenaCombo) arenaCombo.textContent = `×${combat.combo}`;
      if (arenaAccuracy) arenaAccuracy.textContent = `${accPct}%`;
      if (arenaLog && combat.lastLog) arenaLog.textContent = combat.lastLog;

      if (arenaGameOverBanner) {
        arenaGameOverBanner.classList.toggle('hidden', !combat.gameOver);
      }
      if (combat.gameOver && arenaGameOverText) {
        arenaGameOverText.textContent = `انتهى التوازن عند الموجة ${combat.wave} · نقاط ${combat.score} · أقصى سلسلة ×${combat.bestCombo}`;
      }

      if (btnArenaParry) {
        btnArenaParry.classList.toggle('is-parrying', isParrying);
        btnArenaParry.setAttribute('aria-pressed', String(combat.parryTimer > 0));
      }

      if (weaponBar) {
        const wBtns = weaponBar.querySelectorAll('.weapon-btn[data-weapon]');
        wBtns.forEach((btn) => {
          const idx = Number(btn.dataset.weapon);
          const isAct = idx === combat.weaponIndex;
          btn.classList.toggle('active', isAct);
          btn.setAttribute('aria-pressed', String(isAct));
        });
        const w = combat.getActiveWeapon();
        if (weaponDesc && w) {
          weaponDesc.textContent = `${w.descAr} · صَدّ: K/يمين · سحق: S+هجوم`;
        }
      }
    }

    function setArenaMode(enabled) {
      if (enabled === combat.active) return;
      if (enabled) {
        if (challenges.active) setTrialsMode(false);
        if (state.showHelp) setHelp(false);
        if (state.showTouchPad && global.innerWidth <= 1000) setTouchPad(false);
        if (state.showFuncPanel && global.innerWidth <= 1000) setFuncPanel(false);
        combat.enter();
        input.setWeaponKeysEnabled(true);
        setFollowCamera(true);
        if (arenaPanel) arenaPanel.classList.remove('hidden');
        if (weaponBar) {
          weaponBar.classList.remove('hidden');
          weaponBar.classList.toggle('with-touchpad', state.showTouchPad);
        }
        if (btnArena) {
          btnArena.classList.add('active');
          btnArena.setAttribute('aria-pressed', 'true');
        }
        syncArenaUi(true);
      } else {
        combat.exit();
        input.setWeaponKeysEnabled(false);
        if (arenaPanel) arenaPanel.classList.add('hidden');
        if (weaponBar) weaponBar.classList.add('hidden');
        if (btnArena) {
          btnArena.classList.remove('active');
          btnArena.setAttribute('aria-pressed', 'false');
        }
      }
      syncCanvasCursor();
      syncVectorUi(true);
      wakeFrame();
    }

    let lastVectorSig = '';

    function syncVectorUi(force = false) {
      if (!vectorPanel) return;
      const ux = vectorSystem.presetUx;
      const uy = vectorSystem.presetUy;
      const norm = Math.hypot(ux, uy);
      const deg = (Math.atan2(uy, ux) * 180) / Math.PI;
      const sig = `${ux.toFixed(2)}|${uy.toFixed(2)}|${state.vecAimMode ? 1 : 0}|${vectorSystem.vectors.length}|${vectorSystem.lastFormulaText}|${stickman.ridingVector ? 1 : 0}`;
      if (!force && sig === lastVectorSig) return;
      lastVectorSig = sig;

      if (vectorMeta) {
        vectorMeta.textContent = `‖u⃗‖ = ${norm.toFixed(2)} · θ = ${deg.toFixed(0)}° · Active: ${vectorSystem.vectors.length}`;
      }
      if (btnVecAim) {
        btnVecAim.classList.toggle('active', state.vecAimMode);
        btnVecAim.setAttribute('aria-pressed', String(state.vecAimMode));
      }
      if (vectorPresetsEl) {
        vectorPresetsEl.querySelectorAll('.vec-preset-chip').forEach((chip) => {
          const cx = Number(chip.dataset.ux);
          const cy = Number(chip.dataset.uy);
          chip.classList.toggle('active', Math.abs(cx - ux) < 0.05 && Math.abs(cy - uy) < 0.05);
        });
      }
      if (vectorStatus) {
        if (vectorSystem.lastFormulaText) {
          vectorStatus.textContent = vectorSystem.lastFormulaText;
        } else {
          vectorStatus.textContent = state.vecAimMode && !combat.active
            ? 'وضع التصويب مفعّل: انقر لإطلاق المتجهة، اركض [Shift] للركوب، وجّه بـ [WASD] + تسريع [Shift]، واقفز بـ [Space]!'
            : 'أطلق u⃗ بـ [U] ثم اركض [Shift] للركوب، وجّه بسلاسة بـ [WASD] + سرّع بـ [Shift]، أو [U] أثناء الركوب لعلاقة شال!';
        }
      }
    }

    function syncOverlayToggleBtn(btn, isOn) {
      if (!btn) return;
      btn.classList.toggle('active', isOn);
      btn.setAttribute('aria-pressed', String(isOn));
    }

    function syncFuncOverlayButtons() {
      syncOverlayToggleBtn(btnDerivOverlay, functions.showDerivative);
      syncOverlayToggleBtn(btnIntegralOverlay, functions.showIntegral);
      syncOverlayToggleBtn(btnMarkersOverlay, functions.showCriticalMarkers);
      if (symIntegralRow) {
        symIntegralRow.classList.toggle('hidden', !functions.showIntegral);
      }
    }

    function syncFxButton() {
      if (!btnFx) return;
      if (!glfx.available) {
        btnFx.disabled = true;
        btnFx.classList.remove('active');
        btnFx.setAttribute('aria-pressed', 'false');
        btnFx.textContent = 'FX N/A';
        btnFx.title = 'WebGL 2 unavailable on this device';
        return;
      }
      btnFx.disabled = false;
      btnFx.classList.toggle('active', glfx.enabled);
      btnFx.setAttribute('aria-pressed', String(glfx.enabled));
      btnFx.textContent = 'FX';
    }

    let restoreFuncOnExitTrials = false;
    let restoreMarkersOnExitTrials = false;
    let lastTrialSig = '';

    function syncTrialUi(updateInput = false) {
      if (!trialPanel) return;
      if (!challenges.active) {
        lastTrialSig = '';
        return;
      }

      const t = challenges.getCurrentTrial();
      const ev = challenges._lastEval || challenges.evaluateNow();
      const checksSig = ev.checks.map((c) => (c.ok ? '1' : '0')).join('');
      const doneSig = Array.from(challenges.completed).sort().join(',');
      const fbSig = challenges.feedback
        ? `${challenges.feedback.type}:${challenges.feedback.text}`
        : '';
      const sig = `${challenges.currentIndex}|${doneSig}|${checksSig}|${challenges.starCollected ? 1 : 0}|${challenges.showHint ? 1 : 0}|${fbSig}`;

      if (!updateInput && sig === lastTrialSig) return;
      lastTrialSig = sig;

      if (trialProgress) {
        trialProgress.textContent = `${challenges.completed.size}/${challenges.trials.length} مكتمل`;
      }

      if (trialTabs) {
        if (trialTabs.childElementCount !== challenges.trials.length) {
          trialTabs.innerHTML = '';
          challenges.trials.forEach((trial, idx) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'trial-tab';
            tab.setAttribute('role', 'tab');
            tab.dataset.idx = String(idx);
            tab.addEventListener('click', () => {
              challenges.loadTrial(idx);
              setFollowCamera(true);
              syncTrialUi(true);
              wakeFrame();
            });
            trialTabs.appendChild(tab);
          });
        }
        Array.from(trialTabs.children).forEach((tab, idx) => {
          const trial = challenges.trials[idx];
          const isCurrent = idx === challenges.currentIndex;
          const isDone = challenges.completed.has(trial.id);
          tab.textContent = isDone ? `${trial.shortLabel}✓` : trial.shortLabel;
          tab.classList.toggle('active', isCurrent);
          tab.classList.toggle('done', isDone);
          tab.setAttribute('aria-selected', String(isCurrent));
          tab.title = trial.title;
        });
      }

      if (trialTitle) trialTitle.textContent = t.title;
      if (trialConcept) trialConcept.textContent = t.concept;
      if (trialPrompt) trialPrompt.textContent = t.prompt;

      const isCraft = t.mode === 'craft';
      if (trialForm) trialForm.classList.toggle('hidden', !isCraft);
      if (trialMarkRow) trialMarkRow.classList.toggle('hidden', isCraft);
      if (isCraft && updateInput && trialExprInput) {
        trialExprInput.value = functions.expression;
      }

      if (trialChecks) {
        trialChecks.innerHTML = '';
        ev.checks.forEach((chk) => {
          const li = document.createElement('li');
          if (chk.ok) li.className = 'ok';
          li.textContent = chk.label;
          trialChecks.appendChild(li);
        });
      }

      if (trialFeedback) {
        if (challenges.feedback && challenges.feedback.text) {
          trialFeedback.textContent = challenges.feedback.text;
          trialFeedback.className = `trial-feedback ${challenges.feedback.type}`;
        } else {
          trialFeedback.textContent = '';
          trialFeedback.className = 'trial-feedback hidden';
        }
      }

      if (trialHintBox) {
        trialHintBox.classList.toggle('hidden', !challenges.showHint);
        trialHintBox.textContent = challenges.showHint ? `تلميح: ${t.hint}` : '';
      }
      if (btnTrialHint) {
        btnTrialHint.classList.toggle('active', challenges.showHint);
        btnTrialHint.setAttribute('aria-pressed', String(challenges.showHint));
      }
      if (btnTrialNext) {
        btnTrialNext.classList.toggle('ready', Boolean(ev.done));
      }
    }

    function setTrialsMode(enabled) {
      if (enabled === challenges.active) return;
      if (enabled) {
        if (combat.active) setArenaMode(false);
        restoreFuncOnExitTrials = state.showFuncPanel;
        restoreMarkersOnExitTrials = functions.showCriticalMarkers;
        if (restoreMarkersOnExitTrials) {
          functions.setShowCriticalMarkers(false);
        }
        if (state.showHelp) setHelp(false);
        if (state.showTouchPad && global.innerWidth <= 1000) setTouchPad(false);
        if (state.showFuncPanel) {
          state.showFuncPanel = false;
          if (funcPanel) funcPanel.classList.add('hidden');
          if (btnFunc) {
            btnFunc.classList.remove('active');
            btnFunc.setAttribute('aria-pressed', 'false');
          }
        }
        challenges.enter();
        setFollowCamera(true);
        if (trialPanel) trialPanel.classList.remove('hidden');
        if (btnTrials) {
          btnTrials.classList.add('active');
          btnTrials.setAttribute('aria-pressed', 'true');
        }
        syncTrialUi(true);
      } else {
        challenges.exit();
        if (restoreMarkersOnExitTrials) {
          functions.setShowCriticalMarkers(true);
          restoreMarkersOnExitTrials = false;
        }
        if (trialPanel) trialPanel.classList.add('hidden');
        if (btnTrials) {
          btnTrials.classList.remove('active');
          btnTrials.setAttribute('aria-pressed', 'false');
        }
        if (funcInput) funcInput.value = functions.expression;
        syncFuncControls();
        if (restoreFuncOnExitTrials) {
          setFuncPanel(true);
        }
        setFollowCamera(true);
      }
      wakeFrame();
    }

    function syncFuncControls() {
      if (btnToggleFunc) {
        btnToggleFunc.classList.toggle('active', functions.enabled);
        btnToggleFunc.setAttribute('aria-pressed', String(functions.enabled));
        btnToggleFunc.textContent = functions.enabled ? 'ON' : 'OFF';
      }
      if (funcActiveDot) {
        funcActiveDot.classList.toggle('is-on', functions.enabled);
      }
      if (btnFunc) {
        btnFunc.dataset.funcEnabled = String(functions.enabled);
        btnFunc.dataset.funcExpr = functions.expression;
      }
      if (funcPresetsEl) {
        const chips = funcPresetsEl.querySelectorAll('.func-chip');
        chips.forEach((chip) => {
          const isMatch = functions.enabled && chip.dataset.expr === functions.expression;
          chip.classList.toggle('active', isMatch);
        });
      }
      if (funcSymbolicBox) {
        const hasFormula = Boolean(!functions.error && (functions.deriv1Text || functions.deriv2Text));
        funcSymbolicBox.classList.toggle('hidden', !hasFormula && !functions.showIntegral);
      }
      if (symDeriv1) {
        symDeriv1.textContent = functions.error
          ? '—'
          : functions.deriv1Text || (functions.symbolicOk ? '0' : 'numeric finite diff');
        symDeriv1.title = symDeriv1.textContent;
      }
      if (symDeriv2) {
        symDeriv2.textContent = functions.error
          ? '—'
          : functions.deriv2Text || (functions.symbolicOk ? '0' : 'numeric h²');
        symDeriv2.title = symDeriv2.textContent;
      }
      syncFuncOverlayButtons();
      if (funcStatus) {
        funcStatus.classList.remove('error', 'muted');
        if (functions.error) {
          funcStatus.textContent = `Error: ${functions.error}`;
          funcStatus.classList.add('error');
        } else if (!functions.enabled) {
          funcStatus.textContent = `OFF · y = ${functions.expression}`;
          funcStatus.classList.add('muted');
        } else {
          funcStatus.textContent = `ON · y = ${functions.expression}`;
        }
      }
    }

    if (funcPresetsEl) {
      functions.presets.forEach((preset) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'func-chip';
        chip.textContent = preset.label;
        chip.dataset.presetId = preset.id;
        chip.dataset.expr = preset.expr;
        chip.addEventListener('click', () => {
          if (funcInput) funcInput.value = preset.expr;
          functions.setExpression(preset.expr, true);
          syncFuncControls();
          wakeFrame();
        });
        funcPresetsEl.appendChild(chip);
      });
    }

    if (funcForm) {
      funcForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = funcInput ? funcInput.value : '';
        const res = functions.setExpression(raw, true);
        if (res.ok && funcInput) {
          funcInput.blur();
        }
        syncFuncControls();
        wakeFrame();
      });
    }

    if (funcInput) {
      funcInput.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          funcInput.blur();
        }
      });
    }

    if (btnToggleFunc) {
      btnToggleFunc.addEventListener('click', () => {
        functions.setEnabled(!functions.enabled);
        syncFuncControls();
        wakeFrame();
      });
    }

    if (btnFunc) {
      btnFunc.addEventListener('click', () => setFuncPanel(!state.showFuncPanel));
    }

    if (btnCloseFunc) {
      btnCloseFunc.addEventListener('click', () => setFuncPanel(false));
    }

    if (btnDerivOverlay) {
      btnDerivOverlay.addEventListener('click', () => {
        functions.setShowDerivative(!functions.showDerivative);
        syncFuncOverlayButtons();
        wakeFrame();
      });
    }

    if (btnIntegralOverlay) {
      btnIntegralOverlay.addEventListener('click', () => {
        functions.setShowIntegral(!functions.showIntegral);
        syncFuncControls();
        wakeFrame();
      });
    }

    if (btnMarkersOverlay) {
      btnMarkersOverlay.addEventListener('click', () => {
        functions.setShowCriticalMarkers(!functions.showCriticalMarkers);
        syncFuncOverlayButtons();
        wakeFrame();
      });
    }

    if (btnTrials) {
      btnTrials.addEventListener('click', () => setTrialsMode(!challenges.active));
    }

    if (btnCloseTrial) {
      btnCloseTrial.addEventListener('click', () => setTrialsMode(false));
    }

    if (trialForm) {
      trialForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = trialExprInput ? trialExprInput.value : '';
        const res = challenges.applyUserExpression(raw);
        if (res.ok && trialExprInput) {
          trialExprInput.blur();
        }
        syncTrialUi();
        wakeFrame();
      });
    }

    if (trialExprInput) {
      trialExprInput.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          trialExprInput.blur();
        }
      });
    }

    function runChallengeMarkPoint() {
      const before = challenges.lockedTargets.size;
      audioFx.unlock();
      challenges.markPoint();
      if (challenges.lockedTargets.size > before) {
        audioFx.playLockPoint();
      }
      syncTrialUi();
      wakeFrame();
    }

    if (btnTrialMark) {
      btnTrialMark.addEventListener('click', runChallengeMarkPoint);
    }

    if (btnTrialHint) {
      btnTrialHint.addEventListener('click', () => {
        challenges.showHint = !challenges.showHint;
        syncTrialUi();
        wakeFrame();
      });
    }

    if (btnTrialPrev) {
      btnTrialPrev.addEventListener('click', () => {
        challenges.loadTrial(challenges.currentIndex - 1);
        setFollowCamera(true);
        syncTrialUi(true);
        wakeFrame();
      });
    }

    if (btnTrialNext) {
      btnTrialNext.addEventListener('click', () => {
        challenges.loadTrial(challenges.currentIndex + 1);
        setFollowCamera(true);
        syncTrialUi(true);
        wakeFrame();
      });
    }

    if (btnTrialReset) {
      btnTrialReset.addEventListener('click', () => {
        challenges.resetTrial();
        setFollowCamera(true);
        syncTrialUi(true);
        wakeFrame();
      });
    }

    // Vector Panel & Presets wiring
    if (btnCloseVector) {
      btnCloseVector.addEventListener('click', () => setVectorPanel(false));
    }
    if (btnVecAim) {
      btnVecAim.addEventListener('click', () => {
        state.vecAimMode = !state.vecAimMode;
        if (!state.vecAimMode) vectorSystem.clearAimPreview();
        syncCanvasCursor();
        syncVectorUi(true);
        wakeFrame();
      });
    }
    if (btnClearVectors) {
      btnClearVectors.addEventListener('click', () => {
        if (stickman.ridingVector) stickman.dismountVector(false);
        vectorSystem.clear();
        syncVectorUi(true);
        wakeFrame();
      });
    }

    function readVectorInputs() {
      const rawX = vecUxInput ? parseFloat(vecUxInput.value) : vectorSystem.presetUx;
      const rawY = vecUyInput ? parseFloat(vecUyInput.value) : vectorSystem.presetUy;
      if (Number.isFinite(rawX) || Number.isFinite(rawY)) {
        vectorSystem.setPresetComponents(
          Number.isFinite(rawX) ? rawX : vectorSystem.presetUx,
          Number.isFinite(rawY) ? rawY : vectorSystem.presetUy
        );
      }
    }

    if (vecUxInput) {
      vecUxInput.addEventListener('input', () => {
        state.vecPanelEdited = true;
        readVectorInputs();
        syncVectorUi(true);
      });
      vecUxInput.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') vecUxInput.blur();
      });
    }
    if (vecUyInput) {
      vecUyInput.addEventListener('input', () => {
        state.vecPanelEdited = true;
        readVectorInputs();
        syncVectorUi(true);
      });
      vecUyInput.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') vecUyInput.blur();
      });
    }
    if (vectorForm) {
      vectorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.vecPanelEdited = true;
        readVectorInputs();
        if (vecUxInput) vecUxInput.blur();
        if (vecUyInput) vecUyInput.blur();
        launchVectorWithSfx(vectorSystem.presetUx, vectorSystem.presetUy);
      });
    }
    if (vectorPresetsEl) {
      vectorPresetsEl.querySelectorAll('.vec-preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const ux = parseFloat(chip.dataset.ux);
          const uy = parseFloat(chip.dataset.uy);
          state.vecPanelEdited = true;
          vectorSystem.setPresetComponents(ux, uy);
          if (vecUxInput) vecUxInput.value = String(vectorSystem.presetUx);
          if (vecUyInput) vecUyInput.value = String(vectorSystem.presetUy);
          launchVectorWithSfx(vectorSystem.presetUx, vectorSystem.presetUy);
        });
      });
    }

    // Arena Panel & Weapon Bar wiring
    if (btnCloseArena) {
      btnCloseArena.addEventListener('click', () => setArenaMode(false));
    }
    if (btnArenaReset) {
      btnArenaReset.addEventListener('click', resetAll);
    }
    if (btnArenaRestart) {
      btnArenaRestart.addEventListener('click', resetAll);
    }
    if (weaponBar) {
      weaponBar.querySelectorAll('.weapon-btn[data-weapon]').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioFx.unlock();
          combat.setWeaponIndex(Number(btn.dataset.weapon));
          syncArenaUi(true);
          wakeFrame();
        });
      });
    }
    if (btnArenaParry) {
      btnArenaParry.addEventListener('click', () => {
        if (!combat.active || combat.gameOver) return;
        audioFx.unlock();
        combat.triggerParry();
        syncArenaUi(true);
        wakeFrame();
      });
    }
    if (btnArenaLaunchVec) {
      btnArenaLaunchVec.addEventListener('click', () => {
        const comp = getQuickVectorComponents();
        launchVectorWithSfx(comp.ux, comp.uy);
      });
    }

    syncFxButton();
    syncStyleButton();
    syncFuncControls();
    syncVectorUi(true);
    syncCanvasCursor();

    if (global.innerWidth <= 1000) {
      setHelp(false);
    }

    // Global UI keyboard shortcuts
    global.addEventListener('keydown', (e) => {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      audioFx.unlock();
      if (
        challenges.active &&
        (e.code === 'KeyB' ||
          (e.code === 'Enter' && challenges.getCurrentTrial().mode === 'lock-points'))
      ) {
        e.preventDefault();
        runChallengeMarkPoint();
        return;
      }
      const isDirectDance3 =
        (!combat.active && e.code === 'Digit3') ||
        (e.code === 'KeyZ' && !stickman.dancing && stickman.danceStyle === 2);
      honoredAudio.unlockFromGesture(isDirectDance3);
      if (e.code === 'KeyH') setHelp(!state.showHelp);
      else if (e.code === 'KeyT') toggleTheme();
      else if (e.code === 'KeyP') setProjections(!state.showProjections);
      else if (e.code === 'KeyV') setVelocity(!state.showVelocity);
      else if (e.code === 'KeyC') setFollowCamera(!state.followCamera);
      else if (e.code === 'KeyN') {
        stickman.cycleCharacterStyle();
        syncStyleButton();
        wakeFrame();
      }
      else if (e.code === 'KeyM') {
        honoredAudio.toggleMute();
        wakeFrame();
      }
      else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') zoomBy(1.18);
      else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') zoomBy(1 / 1.18);
    });

    function updatePointerFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      pointer.screenX = sx;
      pointer.screenY = sy;
      pointer.overCanvas = sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height;
      const w = grid.screenToWorld(sx, sy, state.camera);
      pointer.worldX = w.x;
      pointer.worldY = w.y;
    }

    function updateVectorAimPreviewFromPointer() {
      if (combat.active || !state.showVectorPanel || !state.vecAimMode || !pointer.overCanvas) {
        if (vectorSystem.preview) {
          vectorSystem.clearAimPreview();
        }
        return;
      }
      const ox = stickman.x;
      const oy = stickman.y + 1.05;
      vectorSystem.setAimPreview(ox, oy, pointer.worldX - ox, pointer.worldY - oy);
    }

    function fireActiveWeaponAtPointer() {
      if (!combat.active || combat.gameOver) return;
      audioFx.unlock();
      const aimX = pointer.overCanvas
        ? pointer.worldX - stickman.x
        : stickman.facing || 1;
      const aimY = pointer.overCanvas
        ? pointer.worldY - (stickman.y + 0.92)
        : 0;
      const crouchNow =
        latestCrouchHeld ||
        input.keysDown.has('KeyS') ||
        input.keysDown.has('ArrowDown') ||
        Boolean(input.virtualState && input.virtualState.down);
      combat.fireWeapon(aimX, aimY, crouchNow);
      syncArenaUi(true);
      wakeFrame();
    }

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    let vecAimPressed = false;

    // Canvas mouse aim/fire/parry/vector-launch, drag pan & wheel zoom
    canvas.addEventListener('pointerdown', (e) => {
      updatePointerFromEvent(e);
      if (e.button === 2 && combat.active) {
        audioFx.unlock();
        if (!combat.gameOver) {
          combat.triggerParry();
          syncArenaUi(true);
        }
        wakeFrame();
        return;
      }
      if (e.button === 1 || e.button === 2) {
        state.dragging = true;
        state.dragLastX = e.clientX;
        state.dragLastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        wakeFrame();
        return;
      }
      if (e.button !== 0) return;

      if (combat.active) {
        fireActiveWeaponAtPointer();
        return;
      }

      if (state.showVectorPanel && state.vecAimMode) {
        vecAimPressed = true;
        updateVectorAimPreviewFromPointer();
        canvas.setPointerCapture(e.pointerId);
        wakeFrame();
        return;
      }

      state.dragging = true;
      state.dragLastX = e.clientX;
      state.dragLastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      wakeFrame();
    });

    canvas.addEventListener('pointermove', (e) => {
      updatePointerFromEvent(e);
      if (state.dragging) {
        const dx = e.clientX - state.dragLastX;
        const dy = e.clientY - state.dragLastY;
        state.dragLastX = e.clientX;
        state.dragLastY = e.clientY;

        if (Math.hypot(dx, dy) > 1) {
          setFollowCamera(false);
          state.camera.x -= dx / state.camera.ppu;
          state.camera.y += dy / state.camera.ppu;
          wakeFrame();
        }
        return;
      }
      if (combat.active || (state.showVectorPanel && state.vecAimMode)) {
        updateVectorAimPreviewFromPointer();
        wakeFrame();
      }
    });

    function endDrag(e) {
      updatePointerFromEvent(e);
      if (vecAimPressed && e.type === 'pointerup') {
        vecAimPressed = false;
        const ox = stickman.x;
        const oy = stickman.y + 1.05;
        const ux = pointer.worldX - ox;
        const uy = pointer.worldY - oy;
        vectorSystem.clearAimPreview();
        launchVectorWithSfx(ux, uy);
      } else {
        vecAimPressed = false;
      }
      if (state.dragging) {
        state.dragging = false;
      }
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Ignore if pointer already released
      }
      wakeFrame();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', (e) => {
      vecAimPressed = false;
      vectorSystem.clearAimPreview();
      endDrag(e);
    });
    canvas.addEventListener('pointerleave', () => {
      pointer.overCanvas = false;
      if (!vecAimPressed) {
        vectorSystem.clearAimPreview();
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const rect = canvas.getBoundingClientRect();
        zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
      },
      { passive: false }
    );

    // Virtual Touch Pad wiring
    const vButtons = virtualPad.querySelectorAll('.vbtn[data-action]');
    vButtons.forEach((btn) => {
      const action = btn.getAttribute('data-action');
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        input.setVirtualButton(action, true);
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {
          // Ignore
        }
      };
      const release = (e) => {
        e.preventDefault();
        btn.classList.remove('active');
        input.setVirtualButton(action, false);
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    });

    // Cached HUD strings to minimize DOM writes
    const hudCache = {
      x: '',
      y: '',
      vx: '',
      vy: '',
      scale: '',
      stateLabel: '',
      integral: '',
      dancing: null,
      audioUiKey: '',
      audioTime: '',
      gpConnected: null,
      gpLabel: '',
      activeSource: '',
    };

    function updateHud(frameInput) {
      const xStr = stickman.x.toFixed(2);
      const yStr = stickman.y.toFixed(2);
      const vxStr = stickman.vx.toFixed(2);
      const vyStr = stickman.vy.toFixed(2);
      const scaleStr = `1 u = ${Math.round(state.camera.ppu)} px`;
      const stateStr = stickman.getStateLabel();

      if (hudCache.x !== xStr) {
        elCoordX.textContent = xStr;
        hudCache.x = xStr;
      }
      if (hudCache.y !== yStr) {
        elCoordY.textContent = yStr;
        hudCache.y = yStr;
      }
      if (hudCache.vx !== vxStr) {
        elVelX.textContent = vxStr;
        hudCache.vx = vxStr;
      }
      if (hudCache.vy !== vyStr) {
        elVelY.textContent = vyStr;
        hudCache.vy = vyStr;
      }
      if (hudCache.scale !== scaleStr) {
        elScaleInfo.textContent = scaleStr;
        hudCache.scale = scaleStr;
      }
      if (hudCache.stateLabel !== stateStr) {
        elStateBadge.textContent = stateStr;
        hudCache.stateLabel = stateStr;
      }
      if (symIntegralVal && state.showFuncPanel && functions.showIntegral) {
        let areaStr = 'curve OFF';
        if (functions.isActive()) {
          const area = functions.computeIntegralTo(stickman.x);
          areaStr = Number.isFinite(area)
            ? `${area >= 0 ? '+' : ''}${area.toFixed(3)}  [0 → ${stickman.x.toFixed(2)}]`
            : '—';
        }
        if (hudCache.integral !== areaStr) {
          hudCache.integral = areaStr;
          symIntegralVal.textContent = areaStr;
        }
      }

      if (hudCache.dancing !== stickman.dancing) {
        hudCache.dancing = stickman.dancing;
        btnDance.classList.toggle('active', stickman.dancing);
        btnDance.setAttribute('aria-pressed', String(stickman.dancing));
      }

      const audioSnap = honoredAudio.getSnapshot();
      const audioUiKey = `${audioSnap.state}|${audioSnap.muted}|${audioSnap.loop}|${audioSnap.paused}|${audioSnap.readyState}|${audioSnap.tag}`;
      if (hudCache.audioUiKey !== audioUiKey) {
        hudCache.audioUiKey = audioUiKey;
        const isPlayingUnmuted = audioSnap.state === 'playing';
        btnAudio.classList.toggle('active', isPlayingUnmuted);
        btnAudio.classList.toggle('is-muted', audioSnap.muted);
        btnAudio.setAttribute('aria-pressed', String(audioSnap.muted));
        const nextText = audioSnap.muted ? '🔇' : '🔊';
        if (btnAudio.textContent !== nextText) {
          btnAudio.textContent = nextText;
        }
        btnAudio.setAttribute('data-audio-state', audioSnap.state);
        btnAudio.setAttribute('data-audio-loop', String(audioSnap.loop));
        btnAudio.setAttribute('data-audio-paused', String(audioSnap.paused));
        btnAudio.setAttribute('data-audio-muted', String(audioSnap.muted));
        btnAudio.setAttribute('data-audio-ready', String(audioSnap.readyState));
        btnAudio.setAttribute('data-audio-tag', audioSnap.tag);
      }
      if (hudCache.audioTime !== audioSnap.time) {
        hudCache.audioTime = audioSnap.time;
        btnAudio.setAttribute('data-audio-time', audioSnap.time);
      }

      const gp = frameInput.gamepad;
      if (hudCache.activeSource !== frameInput.activeSource) {
        hudCache.activeSource = frameInput.activeSource;
        const isGp = frameInput.activeSource === 'gamepad';
        elKeyboardPill.classList.toggle('is-active', !isGp);
        elKbDot.classList.toggle('active', !isGp);
        elGamepadPill.classList.toggle('is-active', isGp);
      }

      if (hudCache.gpConnected !== gp.connected) {
        hudCache.gpConnected = gp.connected;
        elGpDot.classList.toggle('active', gp.connected);
        elGpMonitor.classList.toggle('hidden', !gp.connected);
      }

      const shortId = gp.connected
        ? `Controller: ${gp.id.replace(/\(.*?\)/g, '').trim().slice(0, 22) || 'Connected'}`
        : 'Controller: Disconnected';
      if (hudCache.gpLabel !== shortId) {
        elGpLabel.textContent = shortId;
        hudCache.gpLabel = shortId;
      }

      if (gp.connected) {
        const sx = utils.clamp(gp.stickX, -1, 1) * 7;
        const sy = utils.clamp(gp.stickY, -1, 1) * 7;
        elGpStickDot.style.transform = `translate(calc(-50% + ${sx.toFixed(1)}px), calc(-50% + ${sy.toFixed(1)}px))`;
        elGpBtnA.classList.toggle('pressed', gp.a);
        elGpBtnB.classList.toggle('pressed', gp.b);
        elGpBtnX.classList.toggle('pressed', gp.x);
        elGpBtnY.classList.toggle('pressed', gp.y);
        elGpBtnRun.classList.toggle('pressed', gp.run);
      }
    }

    const HONORED_AUDIO_LOCAL = 'assets/honored-one.mp3';
    const HONORED_AUDIO_URL =
      'https://ia903103.us.archive.org/20/items/gomen-amanai-crib-idkbruh7620-alightmotion-edit-ma-20261114142933-a4df/Gomen%20amanai%F0%9F%A5%80%20%20-%20Cr%26ib_%40idkbruh7620%20%23alightmotion_edit%20%23manipulationedit%20%23l2d%20%23gojo%20%23zoldycknewera%20%23its_nameless_%20%23fyp%20%23100k.mp4';

    const honoredAudio = {
      el: null,
      usingRemoteFallback: false,
      usingVideoFallback: false,
      unlocked: false,
      muted: false,
      hasError: false,
      desiredPlaying: false,
      gesturePlayPending: false,

      _rewind(media) {
        if (!media) return;
        try {
          if (media.readyState > 0 && media.currentTime > 0) {
            media.currentTime = 0;
          }
        } catch (_) {
          // Ignore if seekable range is unavailable yet
        }
      },

      _createMedia(useVideo, srcUrl = HONORED_AUDIO_LOCAL) {
        const prev = document.getElementById('honoredAudio');
        if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

        const media = document.createElement(useVideo ? 'video' : 'audio');
        media.id = 'honoredAudio';
        media.src = srcUrl;
        media.loop = true;
        media.preload = 'auto';
        media.volume = 0.9;
        if (useVideo) {
          media.playsInline = true;
          media.setAttribute('playsinline', '');
          media.style.cssText =
            'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
        }

        media.addEventListener('playing', () => {
          this.hasError = false;
        });
        media.addEventListener('ended', () => {
          if (this.desiredPlaying && !document.hidden) {
            this._rewind(media);
            const p = media.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        });
        media.addEventListener(
          'error',
          () => {
            if (!this.usingRemoteFallback && srcUrl === HONORED_AUDIO_LOCAL) {
              this.usingRemoteFallback = true;
              this.el = this._createMedia(false, HONORED_AUDIO_URL);
              if ((this.desiredPlaying || this.gesturePlayPending) && !document.hidden) {
                this.el.muted = this.muted;
                const p = this.el.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
              }
            } else if (!useVideo && !this.usingVideoFallback) {
              this.usingVideoFallback = true;
              this.el = this._createMedia(true, HONORED_AUDIO_URL);
              if ((this.desiredPlaying || this.gesturePlayPending) && !document.hidden) {
                this.el.muted = this.muted;
                const p = this.el.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
              }
            } else {
              this.hasError = true;
            }
          },
          { once: true }
        );

        document.body.appendChild(media);
        return media;
      },

      ensureElement() {
        if (!this.el) {
          this.el = this._createMedia(false);
        }
        return this.el;
      },

      unlockFromGesture(isDirectTrigger = false) {
        if (this.unlocked) return;
        const media = this.ensureElement();
        if (isDirectTrigger) {
          this.gesturePlayPending = true;
          media.muted = this.muted;
        } else if (!this.gesturePlayPending) {
          media.muted = true;
        }
        const p = media.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this.unlocked = true;
            this.hasError = false;
            media.muted = this.muted;
            if (!this.desiredPlaying && !this.gesturePlayPending) {
              media.pause();
              this._rewind(media);
            }
          }).catch(() => {
            this.gesturePlayPending = false;
            media.muted = this.muted;
          });
        } else {
          this.unlocked = true;
        }
      },

      toggleMute() {
        this.muted = !this.muted;
        if (this.el) {
          this.el.muted = this.muted;
        }
        audioFx.setMuted(this.muted);
      },

      getSnapshot() {
        const media = this.el;
        const paused = media ? media.paused : true;
        const loop = media ? media.loop : true;
        const readyState = media ? media.readyState : 0;
        const currentTime = media ? media.currentTime : 0;
        const tag = media ? media.tagName : 'NONE';
        let state = 'idle';
        if (this.hasError) state = 'error';
        else if (this.desiredPlaying && !paused) state = this.muted ? 'muted' : 'playing';
        else if (this.desiredPlaying) state = this.muted ? 'muted' : 'loading';
        else if (this.muted) state = 'muted';
        return {
          state,
          tag,
          loop,
          paused,
          muted: this.muted,
          readyState,
          time: currentTime.toFixed(1),
        };
      },

      sync(active) {
        this.gesturePlayPending = false;
        const shouldPlay = Boolean(active) && !document.hidden;
        if (
          shouldPlay === this.desiredPlaying &&
          (!shouldPlay || (this.el && !this.el.paused))
        ) {
          return;
        }
        const prev = this.desiredPlaying;
        this.desiredPlaying = shouldPlay;

        if (shouldPlay) {
          const media = this.ensureElement();
          media.loop = true;
          media.muted = this.muted;
          if (!prev) {
            this._rewind(media);
          }
          if (media.paused) {
            const p = media.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          }
        } else if (this.el) {
          if (!this.el.paused) {
            this.el.pause();
          }
          if (!active) {
            this._rewind(this.el);
          }
        }
      },
    };

    global.addEventListener('keydown', wakeFrame, { passive: true });
    global.addEventListener(
      'pointerdown',
      () => {
        wakeFrame();
        honoredAudio.unlockFromGesture(false);
      },
      { passive: true }
    );
    global.addEventListener('wheel', wakeFrame, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        honoredAudio.sync(false);
        stopGamepadIdlePoll();
        if (rafId) {
          global.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else {
        wakeFrame();
      }
    });

    function renderCombatReticleAndIndicators(ctx, camera, gridRenderer, theme) {
      if (!combat.active) return;

      const isBlack = theme.bg === '#000000';
      const activeWeapon = combat.getActiveWeapon();
      const weaponCol = activeWeapon
        ? isBlack
          ? activeWeapon.colorBlack
          : activeWeapon.colorLight
        : '#38bdf8';

      // Sightline reticle toward mouse pointer
      if (!combat.gameOver && pointer.overCanvas && pointer.screenX !== null) {
        const pOrigin = gridRenderer.worldToScreen(stickman.x, stickman.y + 0.92, camera);
        const sx = pointer.screenX;
        const sy = pointer.screenY;
        ctx.save();
        ctx.strokeStyle = weaponCol;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pOrigin.x, pOrigin.y);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.moveTo(sx - 14, sy);
        ctx.lineTo(sx - 5, sy);
        ctx.moveTo(sx + 5, sy);
        ctx.lineTo(sx + 14, sy);
        ctx.moveTo(sx, sy - 14);
        ctx.lineTo(sx, sy - 5);
        ctx.moveTo(sx, sy + 5);
        ctx.lineTo(sx, sy + 14);
        ctx.stroke();
        ctx.restore();
      }

      // Off-screen enemy edge indicators
      for (const e of combat.enemies) {
        const sp = gridRenderer.worldToScreen(e.x, e.y, camera);
        if (sp.x >= 10 && sp.x <= gridRenderer.width - 10) continue;
        const onLeft = sp.x < 10;
        const edgeX = onLeft ? 20 : gridRenderer.width - 20;
        const edgeY = utils.clamp(sp.y, 120, Math.max(140, gridRenderer.height - 110));
        const col =
          e.type === 'deficit'
            ? '#c084fc'
            : e.type === 'harmonic'
              ? '#f472b6'
              : e.type === 'vector_charger'
                ? '#f59e0b'
                : '#38bdf8';

        ctx.save();
        ctx.fillStyle = col;
        ctx.strokeStyle = theme.coordTagBg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (onLeft) {
          ctx.moveTo(edgeX - 8, edgeY);
          ctx.lineTo(edgeX + 5, edgeY - 7);
          ctx.lineTo(edgeX + 5, edgeY + 7);
        } else {
          ctx.moveTo(edgeX + 8, edgeY);
          ctx.lineTo(edgeX - 5, edgeY - 7);
          ctx.lineTo(edgeX - 5, edgeY + 7);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    function frame(now) {
      rafId = 0;
      if (document.hidden) {
        honoredAudio.sync(false);
        stopGamepadIdlePoll();
        return;
      }

      const elapsedSinceRender = now - lastRenderTimestamp;
      const minIntervalMs = 11.5;
      if (!forceWakeFrame && elapsedSinceRender < minIntervalMs) {
        rafId = global.requestAnimationFrame(frame);
        return;
      }

      forceWakeFrame = false;
      lastRenderTimestamp = now;

      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const frameInput = input.sampleFrame();
      latestCrouchHeld = Boolean(frameInput.crouchHeld);
      if (frameInput.resetPressed) {
        if (challenges.active) {
          challenges.resetTrial();
          setFollowCamera(true);
          syncTrialUi(true);
          frameInput.resetPressed = false;
        } else if (combat.active) {
          combat.resetRun();
          state.camera.x = 0;
          state.camera.y = CONFIG.DEFAULT_CAM_Y;
          setFollowCamera(true);
          syncArenaUi(true);
          syncVectorUi(true);
          frameInput.resetPressed = false;
        } else {
          vectorSystem.clear();
          syncVectorUi(true);
        }
      }

      if (combat.active && frameInput.weaponSelectIndex !== null) {
        combat.setWeaponIndex(frameInput.weaponSelectIndex);
        syncArenaUi(true);
      }

      if (frameInput.vectorLaunchPressed) {
        const comp = getQuickVectorComponents();
        launchVectorWithSfx(comp.ux, comp.uy);
      }

      if (combat.active && frameInput.parryPressed && !combat.gameOver) {
        combat.triggerParry();
        syncArenaUi(true);
      }

      if (combat.active && frameInput.firePressed && !combat.gameOver) {
        fireActiveWeaponAtPointer();
      }

      vectorSystem.update(dt, stickman);
      const wasRidingVector = Boolean(stickman.ridingVector);
      const prevLocked = challenges.active ? challenges.lockedTargets.size : 0;
      const prevStar = challenges.active ? challenges.starCollected : false;

      stickman.update(dt, frameInput);
      if (!wasRidingVector && stickman.ridingVector) {
        audioFx.playVectorMount();
      }

      if (combat.active) {
        combat.update(dt);
        syncArenaUi();
      }

      if (state.showVectorPanel) {
        syncVectorUi();
      }

      if (challenges.active) {
        challenges.update(dt);
        if (challenges.lockedTargets.size > prevLocked) {
          audioFx.playLockPoint();
        }
        if (!prevStar && challenges.starCollected) {
          audioFx.playStarClear();
        }
        syncTrialUi();
      }
      particles.update(dt);
      audioFx.update(stickman, dt);
      honoredAudio.sync(stickman.dancing && stickman.danceStyle === 2);

      // Camera smooth zoom & tracking
      const prevCamX = state.camera.x;
      const prevCamY = state.camera.y;
      const prevCamPpu = state.camera.ppu;
      state.camera.ppu = utils.damp(state.camera.ppu, state.camera.targetPpu, 12, dt);

      if (state.followCamera && !state.dragging) {
        const targetCamX = stickman.x + stickman.vx * CONFIG.CAMERA_LOOKAHEAD_FACTOR;
        const fallOffset = stickman.vy < -6 ? stickman.vy * 0.09 : 0;
        const honoredCamY = CONFIG.DEFAULT_CAM_Y + 0.45;
        const baseCamY =
          stickman.y < 0
            ? stickman.y + CONFIG.DEFAULT_CAM_Y * 0.65
            : Math.max(
                CONFIG.DEFAULT_CAM_Y,
                CONFIG.DEFAULT_CAM_Y + Math.max(0, stickman.y - 1.35)
              );
        const targetCamY =
          stickman.dancing && stickman.danceStyle === 2
            ? honoredCamY
            : baseCamY + fallOffset;
        const followYSpeed =
          Math.abs(stickman.vy) > 10 ? 12 : CONFIG.CAMERA_FOLLOW_Y_SPEED;

        state.camera.x = utils.damp(
          state.camera.x,
          targetCamX,
          CONFIG.CAMERA_FOLLOW_X_SPEED,
          dt
        );
        state.camera.y = utils.damp(state.camera.y, targetCamY, followYSpeed, dt);
      }

      const camSettling =
        Math.abs(state.camera.x - prevCamX) > 1e-4 ||
        Math.abs(state.camera.y - prevCamY) > 1e-4 ||
        Math.abs(state.camera.ppu - prevCamPpu) > 1e-3 ||
        Math.abs(state.camera.ppu - state.camera.targetPpu) > 0.04;

      const movingOrSurfingSlope =
        stickman.dancing ||
        stickman.climbing ||
        stickman.ridingVector ||
        !stickman.grounded ||
        Math.abs(stickman.vx) > 0.015 ||
        Math.abs(stickman.vy) > 0.015 ||
        (stickman.surfingCurve &&
          (Math.abs(stickman.curveSpeed) > 0.015 ||
            Math.abs(Math.sin(stickman.curveSlopeAngle)) > 0.02)) ||
        stickman.dashTimer > 0 ||
        stickman.flipTimer > 0 ||
        stickman.heavyLandTimer > 0 ||
        stickman.damageFlashTimer > 0 ||
        stickman.landSquash > 0.01 ||
        stickman.danceBlend > 0.02;

      const feedbackCountingDown =
        challenges.active && challenges.feedbackTimer > 0 && !challenges._lastEval.done;

      const keepLoopRunning =
        movingOrSurfingSlope ||
        stickman.throwState.active ||
        stickman.glFlashTimer > 0 ||
        particles.hasAny() ||
        vectorSystem.hasAny() ||
        combat.active ||
        combat.hitstopTimer > 0 ||
        combat.shakeTimer > 0 ||
        state.dragging ||
        camSettling ||
        input.hasActiveInput() ||
        input.isGamepadInputActive() ||
        feedbackCountingDown;

      if (keepLoopRunning) {
        idleSettleFrames = 6;
      } else if (idleSettleFrames > 0) {
        idleSettleFrames--;
      }

      // Render static Cartesian plane on #gridCanvas when viewport/camera/theme changes,
      // optional GPU glow/shaders on #glCanvas, and dynamic overlays/stickman on #gameCanvas.
      const theme = THEMES[state.themeName];
      if (gridCtx) {
        grid.render(gridCtx, state.camera, theme);
      }
      glfx.render(stickman, state.camera, grid, theme, now * 0.001);

      const shake = combat.getScreenShakeOffset();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, shake.x * dpr, shake.y * dpr);

      grid.renderAxisClimbCue(ctx, stickman, state.camera, theme);
      functions.render(ctx, state.camera, grid, theme, stickman);
      challenges.render(ctx, state.camera, grid, theme);
      vectorSystem.render(ctx, state.camera, grid, theme, {
        showProjections: state.showProjections,
      });
      combat.render(ctx, state.camera, grid, theme);
      particles.render(ctx, state.camera, grid, theme);
      stickman.render(ctx, state.camera, grid, theme);
      grid.renderStickmanOverlays(ctx, stickman, state.camera, theme, {
        showProjections: state.showProjections,
        showVelocity: state.showVelocity,
      });
      renderCombatReticleAndIndicators(ctx, state.camera, grid, theme);

      ctx.restore();

      updateHud(frameInput);

      if (keepLoopRunning || idleSettleFrames > 0) {
        rafId = global.requestAnimationFrame(frame);
      } else if (input.hasConnectedGamepad) {
        scheduleGamepadIdlePoll();
      }
    }

    wakeFrame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
