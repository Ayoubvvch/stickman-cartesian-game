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
    Stickman,
  } = MathStickGame;

  function boot() {
    const gridCanvas = document.getElementById('gridCanvas');
    const gridCtx = gridCanvas ? gridCanvas.getContext('2d', { alpha: false }) : null;
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: true });

    const input = new InputManager();
    const particles = new ParticleSystem();
    const grid = new CoordinateGrid();
    const functions = new FunctionPlotter();
    const stickman = new Stickman(particles, functions);
    const challenges = new ChallengeManager(functions, stickman, particles);

    const state = {
      themeName: 'black',
      followCamera: true,
      showProjections: true,
      showVelocity: false,
      showHelp: true,
      showFuncPanel: true,
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
    const btnFreeFall = document.getElementById('btnFreeFall');
    const btnDance = document.getElementById('btnDance');
    const btnAudio = document.getElementById('btnAudio');
    const btnFunc = document.getElementById('btnFunc');
    const btnTrials = document.getElementById('btnTrials');
    const btnDerivOverlay = document.getElementById('btnDerivOverlay');
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
    const funcStatus = document.getElementById('funcStatus');

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
      stickman.reset();
      particles.clear();
      state.camera.x = 0;
      state.camera.y = CONFIG.DEFAULT_CAM_Y;
      setFollowCamera(true);
      wakeFrame();
    }

    // Toolbar events
    btnZoomIn.addEventListener('click', () => zoomBy(1.2));
    btnZoomOut.addEventListener('click', () => zoomBy(1 / 1.2));
    btnReset.addEventListener('click', resetAll);
    btnFollow.addEventListener('click', () => setFollowCamera(!state.followCamera));
    btnProjections.addEventListener('click', () => setProjections(!state.showProjections));
    btnVelocity.addEventListener('click', () => setVelocity(!state.showVelocity));
    btnFreeFall.addEventListener('click', () => {
      setFollowCamera(true);
      input.triggerFreeFall();
    });
    btnDance.addEventListener('click', () => {
      honoredAudio.unlockFromGesture(stickman.danceStyle === 2 && !stickman.dancing);
      wakeFrame();
      input.triggerDance();
    });
    btnAudio.addEventListener('click', () => {
      honoredAudio.unlockFromGesture(stickman.dancing && stickman.danceStyle === 2);
      honoredAudio.toggleMute();
      wakeFrame();
    });
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

    function syncDerivButton() {
      if (!btnDerivOverlay) return;
      btnDerivOverlay.classList.toggle('active', functions.showDerivative);
      btnDerivOverlay.setAttribute('aria-pressed', String(functions.showDerivative));
    }

    let restoreFuncOnExitTrials = true;
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
        restoreFuncOnExitTrials = state.showFuncPanel;
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
      if (funcStatus) {
        funcStatus.classList.remove('error', 'muted');
        if (functions.error) {
          funcStatus.textContent = `Error: ${functions.error}`;
          funcStatus.classList.add('error');
        } else if (!functions.enabled) {
          funcStatus.textContent = `Hidden: y = ${functions.expression}`;
          funcStatus.classList.add('muted');
        } else {
          funcStatus.textContent = `Active: y = ${functions.expression}`;
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
        syncDerivButton();
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

    if (btnTrialMark) {
      btnTrialMark.addEventListener('click', () => {
        challenges.markPoint();
        syncTrialUi();
        wakeFrame();
      });
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

    syncDerivButton();
    syncFuncControls();

    if (global.innerWidth <= 1000) {
      setHelp(false);
    }

    // Global UI keyboard shortcuts
    global.addEventListener('keydown', (e) => {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        challenges.active &&
        (e.code === 'KeyB' ||
          (e.code === 'Enter' && challenges.getCurrentTrial().mode === 'lock-points'))
      ) {
        e.preventDefault();
        challenges.markPoint();
        syncTrialUi();
        wakeFrame();
        return;
      }
      const isDirectDance3 =
        e.code === 'Digit3' ||
        (e.code === 'KeyZ' && !stickman.dancing && stickman.danceStyle === 2);
      honoredAudio.unlockFromGesture(isDirectDance3);
      if (e.code === 'KeyH') setHelp(!state.showHelp);
      else if (e.code === 'KeyT') toggleTheme();
      else if (e.code === 'KeyP') setProjections(!state.showProjections);
      else if (e.code === 'KeyV') setVelocity(!state.showVelocity);
      else if (e.code === 'KeyC') setFollowCamera(!state.followCamera);
      else if (e.code === 'KeyM') {
        honoredAudio.toggleMute();
        wakeFrame();
      }
      else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') zoomBy(1.18);
      else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') zoomBy(1 / 1.18);
    });

    // Canvas mouse drag pan & wheel zoom
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      state.dragging = true;
      state.dragLastX = e.clientX;
      state.dragLastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      wakeFrame();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!state.dragging) return;
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
    });

    function endDrag(e) {
      if (!state.dragging) return;
      state.dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Ignore if pointer already released
      }
      wakeFrame();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

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
        const nextText = audioSnap.muted ? '🔇 Muted' : '🔊 Audio';
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
      if (challenges.active && frameInput.resetPressed) {
        challenges.resetTrial();
        setFollowCamera(true);
        syncTrialUi(true);
        frameInput.resetPressed = false;
      }
      stickman.update(dt, frameInput);
      if (challenges.active) {
        challenges.update(dt);
        syncTrialUi();
      }
      particles.update(dt);
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
        const targetCamY =
          stickman.dancing && stickman.danceStyle === 2
            ? honoredCamY
            : Math.max(
                CONFIG.DEFAULT_CAM_Y,
                CONFIG.DEFAULT_CAM_Y + Math.max(0, stickman.y - 1.35) + fallOffset
              );
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
        !stickman.grounded ||
        Math.abs(stickman.vx) > 0.015 ||
        Math.abs(stickman.vy) > 0.015 ||
        (stickman.surfingCurve &&
          (Math.abs(stickman.curveSpeed) > 0.015 ||
            Math.abs(Math.sin(stickman.curveSlopeAngle)) > 0.02)) ||
        stickman.dashTimer > 0 ||
        stickman.flipTimer > 0 ||
        stickman.heavyLandTimer > 0 ||
        stickman.landSquash > 0.01 ||
        stickman.danceBlend > 0.02;

      const feedbackCountingDown =
        challenges.active && challenges.feedbackTimer > 0 && !challenges._lastEval.done;

      const keepLoopRunning =
        movingOrSurfingSlope ||
        particles.hasAny() ||
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

      // Render static Cartesian plane on #gridCanvas only when viewport/camera/theme changes,
      // and dynamic overlays/stickman on transparent #gameCanvas.
      const theme = THEMES[state.themeName];
      if (gridCtx) {
        grid.render(gridCtx, state.camera, theme);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      grid.renderAxisClimbCue(ctx, stickman, state.camera, theme);
      functions.render(ctx, state.camera, grid, theme, stickman);
      challenges.render(ctx, state.camera, grid, theme);
      particles.render(ctx, state.camera, grid, theme);
      stickman.render(ctx, state.camera, grid, theme);
      grid.renderStickmanOverlays(ctx, stickman, state.camera, theme, {
        showProjections: state.showProjections,
        showVelocity: state.showVelocity,
      });

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
