(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});
  const { CONFIG, utils } = MathStickGame;

  class CoordinateGrid {
    constructor() {
      this.width = 1;
      this.height = 1;
      this.dpr = 1;

      this.cacheValid = false;
      this._cW = 0;
      this._cH = 0;
      this._cDpr = 0;
      this._cCamX = NaN;
      this._cCamY = NaN;
      this._cPpu = NaN;
      this._cThemeBg = '';

      this._tickWidthCache = new Map();
      this._lastCoordLabel = '';
      this._lastCoordW = 0;
    }

    setViewportSize(width, height, dpr = 1) {
      const nextW = Math.max(1, width);
      const nextH = Math.max(1, height);
      const nextDpr = Math.max(1, dpr);
      if (nextW !== this.width || nextH !== this.height || nextDpr !== this.dpr) {
        this.width = nextW;
        this.height = nextH;
        this.dpr = nextDpr;
        this.cacheValid = false;
      }
    }

    _measureTickCached(ctx, txt) {
      let w = this._tickWidthCache.get(txt);
      if (w === undefined) {
        w = ctx.measureText(txt).width;
        if (this._tickWidthCache.size > 400) {
          this._tickWidthCache.clear();
        }
        this._tickWidthCache.set(txt, w);
      }
      return w;
    }

    worldToScreen(wx, wy, camera) {
      return {
        x: this.width * 0.5 + (wx - camera.x) * camera.ppu,
        y: this.height * 0.5 - (wy - camera.y) * camera.ppu,
      };
    }

    screenToWorld(sx, sy, camera) {
      return {
        x: camera.x + (sx - this.width * 0.5) / camera.ppu,
        y: camera.y - (sy - this.height * 0.5) / camera.ppu,
      };
    }

    getGridSteps(ppu) {
      const targetPx = 72;
      const raw = targetPx / ppu;
      const exp = Math.floor(Math.log10(raw));
      const base = Math.pow(10, exp);
      const frac = raw / base;

      let mult = 1;
      let sub = 5;
      if (frac < 1.45) {
        mult = 1;
        sub = 5;
      } else if (frac < 3.2) {
        mult = 2;
        sub = 4;
      } else if (frac < 7.0) {
        mult = 5;
        sub = 5;
      } else {
        mult = 10;
        sub = 5;
      }

      const majorStep = mult * base;
      const minorStep = majorStep / sub;
      return { majorStep, minorStep };
    }

    formatNumber(value, step) {
      const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-6));
      const rounded = Number(value.toFixed(Math.min(decimals, 6)));
      const clean = Math.abs(rounded) < 1e-9 ? 0 : rounded;
      return clean.toString();
    }

    _drawArrowHead(ctx, x, y, angle, size, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size * 0.45);
      ctx.lineTo(-size * 0.78, 0);
      ctx.lineTo(-size, size * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    _drawVectorSymbol(ctx, letter, cx, cy, color, fontSize = 15) {
      ctx.save();
      ctx.font = `italic 700 ${fontSize}px 'Cambria Math', 'Times New Roman', Georgia, serif`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, cx, cy);

      // Draw crisp arrow directly above the letter
      const arrowY = cy - fontSize * 0.62;
      const halfW = fontSize * 0.34;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - halfW, arrowY);
      ctx.lineTo(cx + halfW, arrowY);
      ctx.lineTo(cx + halfW - 3.2, arrowY - 2.3);
      ctx.moveTo(cx + halfW, arrowY);
      ctx.lineTo(cx + halfW - 3.2, arrowY + 2.3);
      ctx.stroke();
      ctx.restore();
    }

    invalidate() {
      this.cacheValid = false;
    }

    render(gridCtx, camera, theme) {
      if (!gridCtx) return false;
      const w = this.width;
      const h = this.height;
      const dpr = this.dpr;
      const dirty =
        !this.cacheValid ||
        this._cW !== w ||
        this._cH !== h ||
        this._cDpr !== dpr ||
        this._cThemeBg !== theme.bg ||
        Math.abs(camera.x - this._cCamX) > 1e-4 ||
        Math.abs(camera.y - this._cCamY) > 1e-4 ||
        Math.abs(camera.ppu - this._cPpu) > 1e-4;

      if (!dirty) return false;

      // Render directly into the dedicated #gridCanvas layer only when viewport/camera/theme changes,
      // eliminating the per-frame full-viewport offscreen drawImage copy.
      gridCtx.save();
      gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._renderGridInternal(gridCtx, camera, theme);
      gridCtx.restore();

      this.cacheValid = true;
      this._cW = w;
      this._cH = h;
      this._cDpr = dpr;
      this._cThemeBg = theme.bg;
      this._cCamX = camera.x;
      this._cCamY = camera.y;
      this._cPpu = camera.ppu;
      return true;
    }

    _renderGridInternal(ctx, camera, theme) {
      const w = this.width;
      const h = this.height;
      const halfW = w * 0.5;
      const halfH = h * 0.5;
      const camX = camera.x;
      const camY = camera.y;
      const ppu = camera.ppu;
      ctx.direction = 'ltr';

      // 1. Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);

      const minX = camX - halfW / ppu;
      const maxX = camX + halfW / ppu;
      const minY = camY - halfH / ppu;
      const maxY = camY + halfH / ppu;

      const { majorStep, minorStep } = this.getGridSteps(ppu);

      // 2. Minor grid lines
      const minorSpacingPx = minorStep * ppu;
      if (minorSpacingPx >= 7) {
        ctx.save();
        ctx.strokeStyle = theme.minorGrid;
        ctx.lineWidth = 1;
        ctx.beginPath();

        const minMinorX = Math.floor(minX / minorStep);
        const maxMinorX = Math.ceil(maxX / minorStep);
        for (let i = minMinorX; i <= maxMinorX; i++) {
          const sx = Math.round(halfW + (i * minorStep - camX) * ppu) + 0.5;
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, h);
        }

        const minMinorY = Math.floor(minY / minorStep);
        const maxMinorY = Math.ceil(maxY / minorStep);
        for (let i = minMinorY; i <= maxMinorY; i++) {
          const sy = Math.round(halfH - (i * minorStep - camY) * ppu) + 0.5;
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
        }

        ctx.stroke();
        ctx.restore();
      }

      // 3. Major grid lines
      ctx.save();
      ctx.strokeStyle = theme.majorGrid;
      ctx.lineWidth = 1.1;
      ctx.beginPath();

      const minMajorX = Math.floor(minX / majorStep);
      const maxMajorX = Math.ceil(maxX / majorStep);
      for (let i = minMajorX; i <= maxMajorX; i++) {
        const sx = Math.round(halfW + (i * majorStep - camX) * ppu) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
      }

      const minMajorY = Math.floor(minY / majorStep);
      const maxMajorY = Math.ceil(maxY / majorStep);
      for (let i = minMajorY; i <= maxMajorY; i++) {
        const sy = Math.round(halfH - (i * majorStep - camY) * ppu) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
      }
      ctx.stroke();
      ctx.restore();

      const originX = halfW + (0 - camX) * ppu;
      const originY = halfH - (0 - camY) * ppu;
      const axisXVisible = originY >= -4 && originY <= h + 4;
      const axisYVisible = originX >= -4 && originX <= w + 4;

      // 4. Right-angle orthogonality square at O(0,0)
      if (originX >= -30 && originX <= w + 30 && originY >= -30 && originY <= h + 30) {
        const sqSize = utils.clamp(ppu * 0.22, 10, 18);
        ctx.save();
        ctx.fillStyle = theme.rightAngleFill;
        ctx.strokeStyle = theme.rightAngleStroke;
        ctx.lineWidth = 1.3;
        ctx.fillRect(originX, originY - sqSize, sqSize, sqSize);
        ctx.beginPath();
        ctx.moveTo(originX, originY - sqSize);
        ctx.lineTo(originX + sqSize, originY - sqSize);
        ctx.lineTo(originX + sqSize, originY);
        ctx.stroke();
        ctx.restore();
      }

      // 5. Coordinate Axes (Ox) and (Oy)
      ctx.save();
      ctx.strokeStyle = theme.axis;
      ctx.lineWidth = 2;

      if (axisXVisible) {
        const yPos = Math.round(originY) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(w - 6, yPos);
        ctx.stroke();
        this._drawArrowHead(ctx, w - 3, yPos, 0, 11, theme.axis);

        ctx.font = "italic 700 17px 'Cambria Math', 'Times New Roman', Georgia, serif";
        ctx.fillStyle = theme.axis;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const xLabelY = yPos > 34 ? yPos - 8 : yPos + 22;
        ctx.fillText('x', w - 12, xLabelY);
      }

      if (axisYVisible) {
        const xPos = Math.round(originX) + 0.5;
        ctx.beginPath();
        ctx.moveTo(xPos, h);
        ctx.lineTo(xPos, 6);
        ctx.stroke();
        this._drawArrowHead(ctx, xPos, 3, -Math.PI / 2, 11, theme.axis);

        ctx.font = "italic 700 17px 'Cambria Math', 'Times New Roman', Georgia, serif";
        ctx.fillStyle = theme.axis;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const yLabelX = xPos < w - 34 ? xPos + 10 : xPos - 22;
        ctx.fillText('y', yLabelX, 10);
      }
      ctx.restore();

      // 6. Tick marks and numeric labels
      const labelYForXAxis = utils.clamp(originY + 8, 8, h - 22);
      const tickOnScreenX = originY >= 0 && originY <= h;

      ctx.save();
      ctx.font = "600 11.5px 'Cascadia Mono', 'Consolas', monospace";
      ctx.strokeStyle = theme.axis;
      ctx.lineWidth = 1.4;

      // X ticks
      ctx.textAlign = 'center';
      ctx.textBaseline = originY > h - 26 ? 'bottom' : 'top';
      for (let i = minMajorX; i <= maxMajorX; i++) {
        if (i === 0) continue;
        const wx = i * majorStep;
        const sx = halfW + (wx - camX) * ppu;
        if (sx < 18 || sx > w - 18) continue;

        if (tickOnScreenX) {
          ctx.beginPath();
          ctx.moveTo(sx, originY - 4);
          ctx.lineTo(sx, originY + 4);
          ctx.stroke();
        }

        const txt = this.formatNumber(wx, majorStep);
        const labelY = originY > h - 26 ? h - 8 : labelYForXAxis;
        const tw = this._measureTickCached(ctx, txt);
        ctx.fillStyle = theme.originBadgeBg;
        ctx.fillRect(
          sx - tw * 0.5 - 3,
          originY > h - 26 ? labelY - 13 : labelY - 1,
          tw + 6,
          14
        );
        ctx.fillStyle = theme.axisTickText;
        ctx.fillText(txt, sx, labelY);
      }

      // Y ticks
      const yAxisClampedX = utils.clamp(originX, 26, w - 14);
      const yLabelsLeft = originX >= 32;
      const tickOnScreenY = originX >= 0 && originX <= w;
      ctx.textAlign = yLabelsLeft ? 'right' : 'left';
      ctx.textBaseline = 'middle';

      for (let i = minMajorY; i <= maxMajorY; i++) {
        if (i === 0) continue;
        const wy = i * majorStep;
        const sy = halfH - (wy - camY) * ppu;
        if (sy < 18 || sy > h - 18) continue;

        if (tickOnScreenY) {
          ctx.beginPath();
          ctx.moveTo(originX - 4, sy);
          ctx.lineTo(originX + 4, sy);
          ctx.stroke();
        }

        const txt = this.formatNumber(wy, majorStep);
        const tw = this._measureTickCached(ctx, txt);
        const labelX = yLabelsLeft ? yAxisClampedX - 8 : yAxisClampedX + 8;
        ctx.fillStyle = theme.originBadgeBg;
        ctx.fillRect(
          yLabelsLeft ? labelX - tw - 3 : labelX - 3,
          sy - 7,
          tw + 6,
          14
        );
        ctx.fillStyle = theme.axisTickText;
        ctx.fillText(txt, labelX, sy);
      }
      ctx.restore();

      // 7. Origin O and Orthonormal Basis Vectors (i, j) of length 1 unit each
      if (originX >= -ppu - 20 && originX <= w + 20 && originY >= -20 && originY <= h + ppu + 20) {
        if (ppu >= 20) {
          const iTipX = halfW + (1 - camX) * ppu;
          const jTipY = halfH - (1 - camY) * ppu;

          ctx.save();
          ctx.lineCap = 'round';

          ctx.strokeStyle = theme.vecI;
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(iTipX - 4, originY);
          ctx.stroke();
          this._drawArrowHead(ctx, iTipX, originY, 0, 10, theme.vecI);
          this._drawVectorSymbol(
            ctx,
            'i',
            (originX + iTipX) * 0.5,
            originY + 18,
            theme.vecI,
            15
          );

          ctx.strokeStyle = theme.vecJ;
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(originX, jTipY + 4);
          ctx.stroke();
          this._drawArrowHead(ctx, originX, jTipY, -Math.PI / 2, 10, theme.vecJ);
          this._drawVectorSymbol(
            ctx,
            'j',
            originX - 16,
            (originY + jTipY) * 0.5,
            theme.vecJ,
            15
          );
          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = theme.axis;
        ctx.beginPath();
        ctx.arc(originX, originY, 3.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "italic 700 16px 'Cambria Math', 'Times New Roman', Georgia, serif";
        ctx.fillStyle = theme.axis;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('O', originX - 8, originY + 6);
        ctx.restore();
      }
    }

    renderAxisClimbCue(ctx, stickman, camera, theme) {
      if (stickman.dancing) {
        return;
      }
      if (Math.abs(stickman.x) > CONFIG.CLIMB_GRAB_RADIUS + 0.15 && !stickman.climbing) {
        return;
      }

      const yMin = Math.max(0, stickman.y - 1.5);
      const yMax = Math.max(2.5, stickman.y + 3.2);
      const pBot = this.worldToScreen(0, yMin, camera);
      const pTop = this.worldToScreen(0, yMax, camera);

      ctx.save();
      ctx.strokeStyle = theme.climbGlow;
      ctx.lineWidth = stickman.climbing ? 4.5 : 3;
      ctx.lineCap = 'round';
      ctx.globalAlpha = stickman.climbing ? 0.78 : 0.42;
      ctx.beginPath();
      ctx.moveTo(pBot.x, pBot.y);
      ctx.lineTo(pTop.x, pTop.y);
      ctx.stroke();

      // Subtle grip rungs every 0.5 units along the climb segment
      const startRung = Math.ceil(yMin * 2) / 2;
      ctx.lineWidth = 1.6;
      for (let ry = startRung; ry <= yMax; ry += 0.5) {
        if (ry <= 0.01) continue;
        const rp = this.worldToScreen(0, ry, camera);
        ctx.beginPath();
        ctx.moveTo(rp.x - 4, rp.y);
        ctx.lineTo(rp.x + 4, rp.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    renderStickmanOverlays(ctx, stickman, camera, theme, options) {
      ctx.direction = 'ltr';
      const footScreen = this.worldToScreen(stickman.x, stickman.y, camera);

      if (options.showProjections) {
        const projX = this.worldToScreen(stickman.x, 0, camera);
        const projY = this.worldToScreen(0, stickman.y, camera);

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.4;

        // Vertical projection to x-axis
        if (Math.abs(stickman.y) > 0.03) {
          ctx.strokeStyle = theme.projectionY;
          ctx.beginPath();
          ctx.moveTo(footScreen.x, footScreen.y);
          ctx.lineTo(projX.x, projX.y);
          ctx.stroke();

          // Horizontal projection to y-axis (only segment visible within reasonable range)
          ctx.strokeStyle = theme.projectionX;
          ctx.beginPath();
          ctx.moveTo(footScreen.x, footScreen.y);
          ctx.lineTo(projY.x, projY.y);
          ctx.stroke();
        }
        ctx.restore();

        // Point marker at (x, 0) on x-axis and at (x, y)
        ctx.save();
        ctx.fillStyle = theme.projectionX;
        ctx.beginPath();
        ctx.arc(projX.x, projX.y, 3.6, 0, Math.PI * 2);
        ctx.fill();

        if (Math.abs(stickman.y) > 0.03) {
          ctx.fillStyle = theme.projectionY;
          ctx.beginPath();
          ctx.arc(footScreen.x, footScreen.y, 3.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Coordinate pill above stickman's head
        const headTop = this.worldToScreen(
          stickman.x,
          stickman.y + stickman.currentVisualHeight + 0.34,
          camera
        );
        const label = `(${stickman.x.toFixed(2)}, ${stickman.y.toFixed(2)})`;
        ctx.font = "600 12px 'Cascadia Mono', 'Consolas', monospace";
        if (label !== this._lastCoordLabel) {
          this._lastCoordLabel = label;
          this._lastCoordW = ctx.measureText(label).width;
        }
        const padX = 8;
        const boxW = this._lastCoordW + padX * 2;
        const boxH = 22;
        const bx = headTop.x - boxW * 0.5;
        const by = headTop.y - boxH;

        ctx.fillStyle = theme.coordTagBg;
        ctx.strokeStyle = theme.coordTagBorder;
        ctx.lineWidth = 1;
        this._roundRect(ctx, bx, by, boxW, boxH, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.coordTagText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, headTop.x, by + boxH * 0.5 + 0.5);
        ctx.restore();
      }

      if (options.showVelocity) {
        const speed = Math.hypot(stickman.vx, stickman.vy);
        if (speed > 0.08) {
          const com = this.worldToScreen(stickman.x, stickman.y + 0.9, camera);
          const vecScale = 0.22; // 0.22 math units per 1 u/s
          const tip = this.worldToScreen(
            stickman.x + stickman.vx * vecScale,
            stickman.y + 0.9 + stickman.vy * vecScale,
            camera
          );
          const angle = Math.atan2(tip.y - com.y, tip.x - com.x);

          ctx.save();
          ctx.strokeStyle = theme.vecV;
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(com.x, com.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
          this._drawArrowHead(ctx, tip.x, tip.y, angle, 9, theme.vecV);

          this._drawVectorSymbol(
            ctx,
            'v',
            tip.x + Math.cos(angle) * 14,
            tip.y + Math.sin(angle) * 14 - 4,
            theme.vecV,
            14
          );
          ctx.restore();
        }
      }
    }

    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  MathStickGame.CoordinateGrid = CoordinateGrid;
})(window);
