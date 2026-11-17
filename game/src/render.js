// Everything the player sees, painted on one canvas: the maze, the wisp and its
// light, the lanterns, embers and shadows, the HUD, and the title, pause,
// level-clear, game-over and victory screens. The logical size is always
// 1280x720; the page scales the canvas to the window.

import { HUD_HEIGHT, LIGHT_MAX, PALETTE, VIEW } from './config.js';

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

  function drawLanterns(state, lay, time) {
    for (const lantern of state.level.lanterns) {
      const centre = cellCentre(lay, lantern.x, lantern.y);
      const post = lay.cell * 0.3;
      ctx.fillStyle = '#3a2f22';
      ctx.fillRect(centre.x - 2, centre.y - post, 4, post * 2);
      if (lantern.lit) {
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
    for (const shadow of state.shadows) {
      const centre = cellCentre(lay, shadow.x, shadow.y);
      const bob = Math.sin(time * 2 + shadow.fromX * 3 + shadow.fromY) * lay.cell * 0.05;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y + bob, lay.cell * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(centre.x - lay.cell * 0.12, centre.y + bob + lay.cell * 0.3, lay.cell * 0.16, 0, Math.PI);
      ctx.arc(centre.x + lay.cell * 0.12, centre.y + bob + lay.cell * 0.3, lay.cell * 0.16, 0, Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      const lookX = Math.sign(state.player.x - shadow.x) * lay.cell * 0.05;
      const lookY = Math.sign(state.player.y - shadow.y) * lay.cell * 0.04;
      ctx.fillStyle = PALETTE.shadowEye;
      ctx.beginPath();
      ctx.arc(centre.x - lay.cell * 0.12 + lookX, centre.y + bob - lay.cell * 0.06 + lookY, lay.cell * 0.055, 0, Math.PI * 2);
      ctx.arc(centre.x + lay.cell * 0.12 + lookX, centre.y + bob - lay.cell * 0.06 + lookY, lay.cell * 0.055, 0, Math.PI * 2);
      ctx.fill();
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
    // Lit lanterns shine through the dark.
    for (const lantern of state.level.lanterns) {
      if (!lantern.lit) continue;
      const at = cellCentre(lay, lantern.x, lantern.y);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(at.x, at.y - lay.cell * 0.3, lay.cell * 1.4, 'rgba(255,201,94,0.4)', 0.8);
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
    ctx.fillText(`LEVEL ${state.levelIndex + 1} / 5`, 640, 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(state.level.name, 640, 44);

    // Lanterns lit, as small lamps.
    const lit = state.lanternsLit;
    const total = state.level.lanterns.length;
    for (let index = 0; index < total; index += 1) {
      const x = 800 + index * 26;
      ctx.fillStyle = index < lit ? PALETTE.lanternLit : PALETTE.lanternUnlit;
      ctx.beginPath();
      ctx.arc(x, 32, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${lit}/${total}`, 800 + total * 26 + 6, 33);

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
    drawPlayer(state, lay, time);
    drawParticles(state, lay);
    drawDarkness(state, lay);
    drawPopups(state, lay);
    ctx.restore();

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
      ctx.fillText('Kindle every lantern, gather embers to feed your light,', 640, 380);
      ctx.fillText('and slip through the open gate — before the dark closes in.', 640, 408);
      ctx.fillText('Move: WASD / arrows, or click a cell to walk there. P pauses, M mutes.', 640, 448);
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
      const bonus = 250 + Math.round(state.light) * 5;
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
        `All five levels are lit. The night is yours.`,
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
