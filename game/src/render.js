// Everything the player sees, painted on one canvas: the maze, the wisp and its
// light, the lanterns, embers and shadows, the HUD, and the title, pause,
// level-clear, game-over and victory screens. The logical size is always
// 1280x720; the page scales the canvas to the window.

import {
  CLEAR_BASE_POINTS,
  CLEAR_LIGHT_POINTS,
  DASH_COOLDOWN,
  HUD_HEIGHT,
  LIGHT_MAX,
  PALETTE,
  VIEW,
  WRAITH_CYCLE,
  WRAITH_SOLID,
} from './config.js';
import { LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const MARGIN = 24;
const MAX_CELL = 56;

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function hashCell(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');

  /** Where the maze sits on the canvas, for this level's size. */
  function layout(level) {
    const cell = Math.max(
      16,
      Math.min(
        MAX_CELL,
        Math.floor((VIEW.width - MARGIN * 2) / level.width),
        Math.floor((VIEW.height - HUD_HEIGHT - MARGIN * 2) / level.height),
      ),
    );
    return {
      cell,
      originX: Math.floor((VIEW.width - cell * level.width) / 2),
      originY: HUD_HEIGHT + Math.floor((VIEW.height - HUD_HEIGHT - cell * level.height) / 2),
    };
  }

  function cellCentre(lay, x, y) {
    return { x: lay.originX + (x + 0.5) * lay.cell, y: lay.originY + (y + 0.5) * lay.cell };
  }

  function drawGlow(x, y, radius, colour, alpha) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawMaze(state, lay) {
    const level = state.level;
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const px = lay.originX + x * lay.cell;
        const py = lay.originY + y * lay.cell;
        if (level.solid[y][x]) {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(px + 1, py + 1, lay.cell - 2, lay.cell - 2);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(px + 1, py + 1, lay.cell - 2, Math.max(3, lay.cell * 0.14));
          ctx.fillStyle = PALETTE.wallEdge;
          ctx.fillRect(px + 1, py + lay.cell - 4, lay.cell - 2, 3);
        } else {
          ctx.fillStyle = hashCell(x, y) > 0.5 ? PALETTE.floor : PALETTE.floorAlt;
          ctx.fillRect(px, py, lay.cell, lay.cell);
          if (hashCell(x + 40, y + 9) > 0.86) {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.beginPath();
            ctx.arc(px + lay.cell * 0.3, py + lay.cell * 0.35, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function drawExit(state, lay, time) {
    const exit = state.level.exit;
    const centre = cellCentre(lay, exit.x, exit.y);
    const radius = lay.cell * 0.42;
    if (state.gateOpen) {
      const pulse = 0.75 + Math.sin(time * 3) * 0.15;
      drawGlow(centre.x, centre.y, lay.cell * 1.1, 'rgba(125,255,176,0.55)', pulse);
      ctx.fillStyle = PALETTE.exitOpen;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#062b16';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,255,176,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, radius * 0.78, time, time + Math.PI * 1.2);
      ctx.stroke();
    } else {
      ctx.fillStyle = PALETTE.exitClosed;
      roundRect(ctx, centre.x - radius, centre.y - radius, radius * 2, radius * 2, 6);
      ctx.fill();
      ctx.strokeStyle = '#565e86';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centre.x - radius * 0.5, centre.y - radius * 0.6);
      ctx.lineTo(centre.x - radius * 0.5, centre.y + radius * 0.6);
      ctx.moveTo(centre.x + radius * 0.5, centre.y - radius * 0.6);
      ctx.lineTo(centre.x + radius * 0.5, centre.y + radius * 0.6);
      ctx.stroke();
    }
  }

  /** A four-point star, the flare lantern's mark. */
  function drawStar(x, y, radius) {
    ctx.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
      const reach = index % 2 === 0 ? radius : radius * 0.3;
      const px = x + Math.cos(angle) * reach;
      const py = y + Math.sin(angle) * reach;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawLanterns(state, lay, time) {
    for (const lantern of state.level.lanterns) {
      const centre = cellCentre(lay, lantern.x, lantern.y);
      const post = lay.cell * 0.3;
      ctx.fillStyle = lantern.flare ? '#22384a' : '#3a2f22';
      ctx.fillRect(centre.x - 2, centre.y - post, 4, post * 2);
      if (lantern.lit && lantern.flare) {
        const flicker = 0.85 + Math.sin(time * 7 + lantern.x * 3 + lantern.y) * 0.1;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(centre.x, centre.y - post, lay.cell * 1.6, 'rgba(174,233,255,0.55)', flicker);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = PALETTE.flare;
        drawStar(centre.x, centre.y - post, lay.cell * 0.2);
        ctx.fill();
        ctx.fillStyle = PALETTE.flareCore;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y - post, lay.cell * 0.07, 0, Math.PI * 2);
        ctx.fill();
      } else if (lantern.lit) {
        const flicker = 0.8 + Math.sin(time * 5 + lantern.x * 2 + lantern.y) * 0.12;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(centre.x, centre.y - post, lay.cell * 1.5, 'rgba(255,201,94,0.5)', flicker);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = PALETTE.lanternLit;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y - post, lay.cell * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath();
        ctx.arc(centre.x, centre.y - post, lay.cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      } else if (lantern.flare) {
        ctx.strokeStyle = PALETTE.flare;
        ctx.lineWidth = 2;
        drawStar(centre.x, centre.y - post, lay.cell * 0.17);
        ctx.stroke();
        ctx.fillStyle = PALETTE.flare;
        ctx.font = `bold ${Math.round(lay.cell * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', centre.x, centre.y + post * 0.7);
      } else {
        ctx.strokeStyle = PALETTE.lanternUnlit;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y - post, lay.cell * 0.14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = PALETTE.lanternUnlit;
        ctx.font = `bold ${Math.round(lay.cell * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', centre.x, centre.y + post * 0.7);
      }
    }
  }

  function drawEmbers(state, lay, time) {
    for (const ember of state.level.embers) {
      if (ember.taken) continue;
      const centre = cellCentre(lay, ember.x, ember.y);
      const pulse = 0.7 + Math.sin(time * 4 + ember.x + ember.y * 3) * 0.3;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(centre.x, centre.y, lay.cell * 0.55, 'rgba(255,179,71,0.6)', pulse);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, lay.cell * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, lay.cell * 0.18, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawShadows(state, lay, time) {
    const frozen = state.freezeTimer > 0;
    for (const shadow of state.shadows) {
      const centre = cellCentre(lay, shadow.x, shadow.y);
      const bob = frozen ? 0 : Math.sin(time * 2 + shadow.fromX * 3 + shadow.fromY) * lay.cell * 0.05;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = frozen ? '#33506e' : PALETTE.shadow;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y + bob, lay.cell * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = frozen ? '#24405c' : '#1a1030';
      ctx.beginPath();
      ctx.arc(centre.x - lay.cell * 0.12, centre.y + bob + lay.cell * 0.3, lay.cell * 0.16, 0, Math.PI);
      ctx.arc(centre.x + lay.cell * 0.12, centre.y + bob + lay.cell * 0.3, lay.cell * 0.16, 0, Math.PI);
      ctx.fill();
      if (frozen) {
        // A crust of flare-ice over the frozen shadow.
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = PALETTE.shadowFrozen;
        ctx.beginPath();
        ctx.arc(centre.x - lay.cell * 0.1, centre.y + bob - lay.cell * 0.12, lay.cell * 0.1, 0, Math.PI * 2);
        ctx.arc(centre.x + lay.cell * 0.14, centre.y + bob + lay.cell * 0.05, lay.cell * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const lookX = Math.sign(state.player.x - shadow.x) * lay.cell * 0.05;
      const lookY = Math.sign(state.player.y - shadow.y) * lay.cell * 0.04;
      ctx.fillStyle = frozen ? '#dff6ff' : PALETTE.shadowEye;
      ctx.beginPath();
      ctx.arc(centre.x - lay.cell * 0.12 + lookX, centre.y + bob - lay.cell * 0.06 + lookY, lay.cell * 0.055, 0, Math.PI * 2);
      ctx.arc(centre.x + lay.cell * 0.12 + lookX, centre.y + bob - lay.cell * 0.06 + lookY, lay.cell * 0.055, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * A wraith: a pale ghost with a torn skirt, near-invisible while faded and
   * unmistakable while solid. It pays the walls no mind at all.
   */
  function drawWraiths(state, lay, time) {
    const frozen = state.freezeTimer > 0;
    for (const wraith of state.wraiths) {
      const centre = cellCentre(lay, wraith.x, wraith.y);
      const phase = wraith.cycle % WRAITH_CYCLE;
      const solid = phase < WRAITH_SOLID;
      // The last blink of each phase is a fade, not a pop.
      let alpha = solid ? 0.92 : 0.25;
      if (solid && phase > WRAITH_SOLID - 0.3) alpha = 0.25 + 0.67 * ((WRAITH_SOLID - phase) / 0.3);
      if (!solid && phase > WRAITH_CYCLE - 0.3) alpha = 0.25 + 0.67 * ((phase - (WRAITH_CYCLE - 0.3)) / 0.3);
      if (frozen) alpha = Math.max(alpha, 0.55);
      const drift = Math.sin(time * 1.6 + wraith.x * 2 + wraith.y) * lay.cell * 0.06;
      const r = lay.cell * 0.32;
      if (solid && !frozen) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(centre.x, centre.y + drift, lay.cell * 0.95, 'rgba(174,191,255,0.35)', alpha * 0.7);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = frozen ? '#7fb8d9' : PALETTE.wraith;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y + drift - r * 0.15, r, Math.PI, 0);
      // The torn skirt: three hanging points that sway as it drifts.
      const sway = Math.sin(time * 3 + wraith.y * 2) * r * 0.16;
      ctx.lineTo(centre.x + r, centre.y + drift + r * 0.75);
      ctx.lineTo(centre.x + r * 0.4, centre.y + drift + r * 0.4 + sway);
      ctx.lineTo(centre.x, centre.y + drift + r * 0.85);
      ctx.lineTo(centre.x - r * 0.4, centre.y + drift + r * 0.4 - sway);
      ctx.lineTo(centre.x - r, centre.y + drift + r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = Math.min(1, alpha + 0.1);
      ctx.fillStyle = frozen ? '#eafcff' : PALETTE.wraithEye;
      ctx.beginPath();
      ctx.arc(centre.x - r * 0.34, centre.y + drift - r * 0.2, r * 0.14, 0, Math.PI * 2);
      ctx.arc(centre.x + r * 0.34, centre.y + drift - r * 0.2, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = frozen ? '#eafcff' : '#5f74c9';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y + drift + r * 0.28, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(state, lay, time) {
    const player = state.player;
    const centre = cellCentre(lay, player.x, player.y);
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    const radius = lay.cell * 0.3;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(centre.x, centre.y, lay.cell * 1.6, 'rgba(255,214,120,0.55)', 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.fillStyle = PALETTE.wisp;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(centre.x + player.dirX * radius * 0.25, centre.y + player.dirY * radius * 0.25, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawParticles(state, lay) {
    for (const particle of state.particles) {
      const centre = cellCentre(lay, particle.x - 0.5, particle.y - 0.5);
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.colour;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, Math.max(1.5, particle.size * lay.cell), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups(state, lay) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of state.popups) {
      const centre = cellCentre(lay, item.x - 0.5, item.y - 0.5);
      const rise = (1 - item.life / 1.1) * lay.cell * 0.8;
      ctx.globalAlpha = Math.min(1, item.life);
      ctx.font = `bold ${Math.round(lay.cell * 0.34)}px system-ui, sans-serif`;
      ctx.fillStyle = item.colour;
      ctx.fillText(item.text, centre.x, centre.y - rise);
    }
    ctx.globalAlpha = 1;
  }

  /** The dark itself: a veil over the maze with a hole of light around the wisp. */
  function drawDarkness(state, lay) {
    const player = state.player;
    const centre = cellCentre(lay, player.x, player.y);
    const radius = lay.cell * (4.2 + state.light / LIGHT_MAX * 2.2);
    const gradient = ctx.createRadialGradient(centre.x, centre.y, radius * 0.35, centre.x, centre.y, radius);
    gradient.addColorStop(0, 'rgba(4,6,16,0)');
    gradient.addColorStop(1, 'rgba(4,6,16,0.86)');
    ctx.fillStyle = gradient;
    ctx.fillRect(lay.originX - 4, lay.originY - 4, lay.cell * state.level.width + 8, lay.cell * state.level.height + 8);
    // Lit lanterns shine through the dark: warm gold, cold blue for a flare.
    for (const lantern of state.level.lanterns) {
      if (!lantern.lit) continue;
      const at = cellCentre(lay, lantern.x, lantern.y);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(
        at.x,
        at.y - lay.cell * 0.3,
        lay.cell * (lantern.flare ? 1.7 : 1.4),
        lantern.flare ? 'rgba(174,233,255,0.45)' : 'rgba(255,201,94,0.4)',
        0.8,
      );
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawHud(state, ui) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, HUD_HEIGHT - 2, VIEW.width, 2);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('SCORE', 24, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(String(state.score), 24, 44);

    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('BEST', 150, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(String(Math.max(ui.best, state.score)), 150, 44);

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`LEVEL ${state.levelIndex + 1} / ${LEVELS.length}`, 640, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(state.level.name, 640, 44);

    // Lanterns lit, as small lamps; a flare lantern shows as a blue star.
    const lit = state.lanternsLit;
    const total = state.level.lanterns.length;
    for (let index = 0; index < total; index += 1) {
      const x = 800 + index * 26;
      const lantern = state.level.lanterns[index];
      if (lantern.flare) {
        ctx.fillStyle = lantern.lit ? PALETTE.flare : PALETTE.lanternUnlit;
        drawStar(x, 32, 10);
        ctx.fill();
      } else {
        ctx.fillStyle = lantern.lit ? PALETTE.lanternLit : PALETTE.lanternUnlit;
        ctx.beginPath();
        ctx.arc(x, 32, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    // Right-aligned to a fixed edge left of the light meter: with seven
    // lanterns (the last level) a left-aligned count after the icons
    // would run under the meter.
    ctx.textAlign = 'right';
    ctx.fillText(`${lit}/${total}`, 990, 33);
    ctx.textAlign = 'left';

    // The light meter.
    const meterX = 1000;
    const meterWidth = 200;
    const low = state.light < 25;
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('LIGHT', meterX, 20);
    ctx.fillStyle = '#232a4d';
    roundRect(ctx, meterX, 30, meterWidth, 16, 8);
    ctx.fill();
    const fill = Math.max(0, state.light / LIGHT_MAX) * meterWidth;
    const gradient = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
    gradient.addColorStop(0, low ? '#ff5d6c' : '#ff9a3d');
    gradient.addColorStop(1, low ? '#ff8a7a' : '#ffe9a8');
    ctx.fillStyle = gradient;
    if (fill > 4) {
      roundRect(ctx, meterX, 30, fill, 16, 8);
      ctx.fill();
    }
    if (low && Math.floor(state.time * 3) % 2 === 0) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('LOW', meterX + meterWidth + 10, 38);
    }

    // The dash meter, under the light meter: full and amber means ready.
    const dashX = 1000;
    const dashWidth = 200;
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('DASH', dashX, 57);
    ctx.fillStyle = '#232a4d';
    roundRect(ctx, dashX + 42, 52, dashWidth - 42, 8, 4);
    ctx.fill();
    const dashFill = state.dashTime > 0 ? 1 : 1 - Math.max(0, state.dashCooldown) / DASH_COOLDOWN;
    ctx.fillStyle = state.dashTime > 0 ? '#ffffff' : '#ffb347';
    if (dashFill > 0.03) {
      roundRect(ctx, dashX + 42, 52, (dashWidth - 42) * dashFill, 8, 4);
      ctx.fill();
    }
    if (state.dashTime <= 0 && state.dashCooldown <= 0) {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('SHIFT', dashX + dashWidth + 10, 57);
    }

    // While the flare's freeze lasts, say so under the level name.
    if (state.freezeTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.flare;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`THE DARK IS FROZEN · ${state.freezeTimer.toFixed(1)}`, 640, 59);
      ctx.textAlign = 'left';
    }

    if (state.combo > 1) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(`COMBO x${(1 + (state.combo - 1) * 0.25).toFixed(2).replace(/\.?0+$/, '')}`, 1256, 32);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px system-ui, sans-serif';
    // Below the maze, clear of the score: the mute hint lives on the floor.
    ctx.fillText(ui.muted ? 'M unmute' : 'M mute', 24, VIEW.height - 12);
  }

  function drawButton(button, hover) {
    ctx.fillStyle = hover ? '#ffc95e' : '#e8b64c';
    roundRect(ctx, button.x, button.y, button.width, button.height, 10);
    ctx.fill();
    ctx.fillStyle = '#241a05';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2 + 1);
  }

  function overlayPanel(title, lines, buttons, mouse) {
    ctx.fillStyle = 'rgba(4,6,16,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText(title, 640, 210);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    lines.forEach((line, index) => {
      ctx.fillText(line, 640, 280 + index * 32);
    });
    for (const button of buttons) {
      const hover = mouse.inside
        && mouse.x >= button.x && mouse.x <= button.x + button.width
        && mouse.y >= button.y && mouse.y <= button.y + button.height;
      drawButton(button, hover);
    }
    return buttons;
  }

  function draw(state, screen, ui) {
    const time = state.time;
    const lay = layout(state.level);
    ctx.save();
    if (state.shake > 0) {
      const amount = state.shake * 8;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
    const background = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    background.addColorStop(0, PALETTE.nightEdge);
    background.addColorStop(1, PALETTE.night);
    ctx.fillStyle = background;
    ctx.fillRect(-12, -12, VIEW.width + 24, VIEW.height + 24);

    drawMaze(state, lay);
    drawExit(state, lay, time);
    drawLanterns(state, lay, time);
    drawEmbers(state, lay, time);
    drawShadows(state, lay, time);
    drawWraiths(state, lay, time);
    drawPlayer(state, lay, time);
    drawParticles(state, lay);
    drawDarkness(state, lay);
    drawPopups(state, lay);
    ctx.restore();

    // When the light runs low the dark presses in at the edges, pulsing red.
    if (screen === SCREEN_PLAY && state.light < 25 && state.light > 0) {
      const pulse = 0.1 + Math.sin(time * 4) * 0.05;
      const vignette = ctx.createRadialGradient(640, 390, 300, 640, 390, 720);
      vignette.addColorStop(0, 'rgba(255,93,108,0)');
      vignette.addColorStop(1, `rgba(255,93,108,${pulse.toFixed(3)})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    drawHud(state, ui);

    let buttons = [];
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(4,6,16,0.62)';
      ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 84px Georgia, serif';
      ctx.fillText('EMBERKEEPER', 640, 250);
      ctx.fillStyle = '#ffc95e';
      ctx.font = 'italic 26px Georgia, serif';
      ctx.fillText('Keep the light alive.', 640, 310);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText('Kindle every lantern, gather embers to feed your light,', 640, 372);
      ctx.fillText('and slip through the open gate — before the dark closes in.', 640, 400);
      ctx.fillText('Blue flare lanterns freeze the dark. Pale wraiths drift through walls.', 640, 428);
      ctx.fillText('Move: WASD / arrows, or click a cell. Shift dashes, P pauses, M mutes.', 640, 456);
      if (ui.best > 0) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(`Best score: ${ui.best}`, 640, 492);
      }
      buttons = [{
        id: 'begin', label: 'Begin the first light', x: 490, y: 530, width: 300, height: 56,
      }];
      const hover = ui.mouse.inside
        && ui.mouse.x >= 490 && ui.mouse.x <= 790 && ui.mouse.y >= 530 && ui.mouse.y <= 586;
      drawButton(buttons[0], hover);
    } else if (screen === SCREEN_PAUSED) {
      buttons = overlayPanel('Paused', ['The dark waits for no one — but it waits for you.', 'Press P or click Resume to carry on.'], [{
        id: 'resume', label: 'Resume', x: 540, y: 380, width: 200, height: 56,
      }], ui.mouse);
    } else if (screen === SCREEN_CLEAR) {
      const bonus = CLEAR_BASE_POINTS + Math.round(state.light) * CLEAR_LIGHT_POINTS;
      buttons = overlayPanel(`Level ${state.levelIndex + 1} clear!`, [
        `The ${state.level.name} lanterns all burn.`,
        `Clear bonus +${bonus}  ·  Score ${state.score}`,
        'Press Enter or click to walk into the next dark.',
      ], [{
        id: 'next', label: 'Next level', x: 540, y: 400, width: 200, height: 56,
      }], ui.mouse);
    } else if (screen === SCREEN_OVER) {
      buttons = overlayPanel('The dark took the light', [
        `Score ${state.score}  ·  Best ${Math.max(ui.best, state.score)}  ·  Reached level ${state.levelIndex + 1}`,
        'The lanterns are still out there, waiting.',
        'Press R or click to try again.',
      ], [{
        id: 'retry', label: 'Try again', x: 540, y: 400, width: 200, height: 56,
      }], ui.mouse);
    } else if (screen === SCREEN_WIN) {
      buttons = overlayPanel('Every lantern burns bright', [
        `All ${LEVELS.length} levels are lit. The night is yours.`,
        `Final score ${state.score}  ·  Best ${Math.max(ui.best, state.score)}`,
        'Press R or click to keep the light again.',
      ], [{
        id: 'again', label: 'Play again', x: 540, y: 400, width: 200, height: 56,
      }], ui.mouse);
    }
    return { buttons, layout: lay };
  }

  return {
    draw,
    /** The maze cell under a logical canvas point, or null. */
    cellAt(state, x, y) {
      const lay = layout(state.level);
      const cellX = Math.floor((x - lay.originX) / lay.cell);
      const cellY = Math.floor((y - lay.originY) / lay.cell);
      if (cellX < 0 || cellY < 0 || cellX >= state.level.width || cellY >= state.level.height) return null;
      return { x: cellX, y: cellY };
    },
  };
}
