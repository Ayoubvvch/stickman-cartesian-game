(function (global) {
  'use strict';

  const MathStickGame = (global.MathStickGame = global.MathStickGame || {});

  function removeAt(arr, index) {
    const last = arr.length - 1;
    if (index !== last) {
      arr[index] = arr[last];
    }
    arr.pop();
  }

  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.ghosts = [];
      this.notes = [];
      this.windStreaks = [];
      this.sparks = [];
    }

    hasAny() {
      return (
        this.particles.length > 0 ||
        this.ghosts.length > 0 ||
        this.notes.length > 0 ||
        this.windStreaks.length > 0 ||
        this.sparks.length > 0
      );
    }

    spawnDust(wx, wy, vx, vy, radius = 0.055, life = 0.35) {
      if (this.particles.length >= 60) return;
      this.particles.push({
        x: wx,
        y: wy,
        vx,
        vy,
        radius,
        life,
        maxLife: life,
      });
    }

    spawnLandingBurst(wx, intensity = 1) {
      const count = Math.min(18, Math.max(4, Math.round(6 * intensity)));
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const speed = (0.65 + Math.random() * 1.55) * intensity;
        this.spawnDust(
          wx + (Math.random() - 0.5) * 0.16,
          0.02,
          dir * speed,
          0.35 + Math.random() * 0.55 * Math.min(1.8, intensity),
          (0.04 + Math.random() * 0.035) * Math.min(1.5, 0.8 + intensity * 0.3),
          0.26 + Math.random() * 0.22
        );
      }
    }

    spawnStepDust(wx, facing) {
      this.spawnDust(
        wx,
        0.02,
        -facing * (0.4 + Math.random() * 0.7),
        0.25 + Math.random() * 0.35,
        0.035 + Math.random() * 0.025,
        0.24 + Math.random() * 0.12
      );
    }

    spawnJumpBurst(wx, wy, isDoubleJump = false) {
      const count = isDoubleJump ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * i) / (count - 1);
        const speed = 0.9 + Math.random() * 0.7;
        this.spawnDust(
          wx + Math.cos(angle) * 0.12,
          wy + 0.03,
          Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
          0.15 + Math.random() * 0.35,
          isDoubleJump ? 0.045 : 0.038,
          0.25 + Math.random() * 0.14
        );
      }
    }

    spawnMusicNote(wx, wy) {
      const glyphs = ['♪', '♫', '♩'];
      this.notes.push({
        x: wx + (Math.random() - 0.5) * 0.65,
        y: wy,
        vx: (Math.random() - 0.5) * 0.55,
        vy: 1.0 + Math.random() * 0.45,
        glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
        life: 1.15,
        maxLife: 1.15,
        phase: Math.random() * Math.PI * 2,
      });
    }

    spawnWindStreak(wx, wy, fallSpeed) {
      this.windStreaks.push({
        x: wx + (Math.random() - 0.5) * 1.4,
        y: wy - 1.2 + Math.random() * 1.6,
        len: 0.45 + Math.min(1.4, fallSpeed * 0.05),
        vy: Math.max(8, fallSpeed * 0.85),
        life: 0.22,
        maxLife: 0.22,
      });
    }

    spawnSpark(wx, wy, vx, vy, color, radius = 0.04, life = 0.45) {
      if (this.sparks.length >= 75) return;
      this.sparks.push({
        x: wx,
        y: wy,
        vx,
        vy,
        color,
        radius,
        life,
        maxLife: life,
      });
    }

    addGhost(poseSnapshot) {
      if (this.ghosts.length >= 12) return;
      this.ghosts.push({
        pose: poseSnapshot,
        life: 0.18,
        maxLife: 0.18,
      });
    }

    clear() {
      this.particles.length = 0;
      this.ghosts.length = 0;
      this.notes.length = 0;
      this.windStreaks.length = 0;
      this.sparks.length = 0;
    }

    update(dt) {
      const dampDust = Math.exp(-5 * dt);
      const dampSpark = Math.exp(-3 * dt);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          removeAt(this.particles, i);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= dampDust;
        p.vy -= 1.2 * dt;
        if (p.y < 0.01) p.y = 0.01;
      }

      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        this.ghosts[i].life -= dt;
        if (this.ghosts[i].life <= 0) {
          removeAt(this.ghosts, i);
        }
      }

      for (let i = this.notes.length - 1; i >= 0; i--) {
        const n = this.notes[i];
        n.life -= dt;
        if (n.life <= 0) {
          removeAt(this.notes, i);
          continue;
        }
        n.phase += dt * 4.5;
        n.x += (n.vx + Math.sin(n.phase) * 0.35) * dt;
        n.y += n.vy * dt;
      }

      for (let i = this.windStreaks.length - 1; i >= 0; i--) {
        const s = this.windStreaks[i];
        s.life -= dt;
        if (s.life <= 0) {
          removeAt(this.windStreaks, i);
          continue;
        }
        s.y += s.vy * dt;
      }

      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const sp = this.sparks[i];
        sp.life -= dt;
        if (sp.life <= 0) {
          removeAt(this.sparks, i);
          continue;
        }
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vx *= dampSpark;
        sp.vy *= dampSpark;
      }
    }

    render(ctx, camera, gridRenderer, theme) {
      const halfW = gridRenderer.width * 0.5;
      const halfH = gridRenderer.height * 0.5;
      const camX = camera.x;
      const camY = camera.y;
      const ppu = camera.ppu;

      // Dust
      if (this.particles.length > 0) {
        ctx.save();
        ctx.fillStyle = theme.dust;
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          const alpha = Math.max(0, p.life / p.maxLife);
          const sx = halfW + (p.x - camX) * ppu;
          const sy = halfH - (p.y - camY) * ppu;
          const r = Math.max(1.5, p.radius * ppu * (0.65 + 0.5 * (1 - alpha)));
          ctx.globalAlpha = alpha * 0.85;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Colored energy & celestial sparks
      if (this.sparks.length > 0) {
        ctx.save();
        for (let i = 0; i < this.sparks.length; i++) {
          const sp = this.sparks[i];
          const alpha = Math.max(0, sp.life / sp.maxLife);
          const sx = halfW + (sp.x - camX) * ppu;
          const sy = halfH - (sp.y - camY) * ppu;
          const r = Math.max(1.3, sp.radius * ppu * alpha);
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = alpha * 0.28;
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.94;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Free-fall wind streaks
      if (this.windStreaks.length > 0) {
        ctx.save();
        ctx.strokeStyle = theme.windStreak;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (let i = 0; i < this.windStreaks.length; i++) {
          const s = this.windStreaks[i];
          const alpha = Math.max(0, s.life / s.maxLife);
          const sx = halfW + (s.x - camX) * ppu;
          const sy1 = halfH - (s.y - camY) * ppu;
          const sy2 = halfH - (s.y + s.len - camY) * ppu;
          ctx.globalAlpha = alpha * 0.75;
          ctx.beginPath();
          ctx.moveTo(sx, sy1);
          ctx.lineTo(sx, sy2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Dance music notes
      if (this.notes.length > 0) {
        ctx.save();
        ctx.fillStyle = theme.musicNote;
        ctx.font = "700 18px 'Segoe UI', system-ui, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < this.notes.length; i++) {
          const n = this.notes[i];
          const alpha = Math.max(0, n.life / n.maxLife);
          const sx = halfW + (n.x - camX) * ppu;
          const sy = halfH - (n.y - camY) * ppu;
          ctx.globalAlpha = alpha;
          ctx.fillText(n.glyph, sx, sy);
        }
        ctx.restore();
      }
    }
  }

  MathStickGame.ParticleSystem = ParticleSystem;
})(window);
