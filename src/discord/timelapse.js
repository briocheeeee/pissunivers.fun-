import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { BACKUP_URL } from '../core/config.js';
import { TILE_SIZE } from '../core/constants.js';
import logger from '../core/logger.js';
import canvases from '../core/canvases.js';

const execFileAsync = promisify(execFile);

const CANVAS_ID = '0';

function getDateRange(startDate, endDate) {
  const dates = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}${m}${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function fetchPngBuffer(url) {
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function buildFrame(sharp, dateStr, x1, y1, x2, y2) {
  const canvas = canvases[CANVAS_ID];
  if (!canvas) throw new Error('Canvas 0 not found');

  const { size: canvasSize } = canvas;
  const halfSize = canvasSize / 2;

  const frameW = x2 - x1 + 1;
  const frameH = y2 - y1 + 1;

  const absX1 = x1 + halfSize;
  const absY1 = y1 + halfSize;
  const absX2 = x2 + halfSize;
  const absY2 = y2 + halfSize;

  const chunkX1 = Math.floor(absX1 / TILE_SIZE);
  const chunkY1 = Math.floor(absY1 / TILE_SIZE);
  const chunkX2 = Math.floor(absX2 / TILE_SIZE);
  const chunkY2 = Math.floor(absY2 / TILE_SIZE);

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const baseUrl = `${BACKUP_URL}/${year}/${month}/${day}/${CANVAS_ID}/tiles`;

  const chunkFetches = [];
  for (let cy = chunkY1; cy <= chunkY2; cy += 1) {
    for (let cx = chunkX1; cx <= chunkX2; cx += 1) {
      chunkFetches.push(
        fetchPngBuffer(`${baseUrl}/${cx}/${cy}.png`).then((buf) => ({ cx, cy, buf })),
      );
    }
  }
  const chunkResults = await Promise.all(chunkFetches);

  const rawChunkMap = new Map();
  await Promise.all(
    chunkResults
      .filter(({ buf }) => buf !== null)
      .map(async ({ cx, cy, buf }) => {
        try {
          const raw = await sharp(buf).raw().ensureAlpha().toBuffer();
          rawChunkMap.set(`${cx}:${cy}`, raw);
        } catch {
          // chunk decode failed, skip
        }
      }),
  );

  const framePixels = Buffer.alloc(frameW * frameH * 3);

  for (let py = 0; py < frameH; py += 1) {
    for (let px = 0; px < frameW; px += 1) {
      const worldX = x1 + px;
      const worldY = y1 + py;
      const absX = worldX + halfSize;
      const absY = worldY + halfSize;
      const cx = Math.floor(absX / TILE_SIZE);
      const cy = Math.floor(absY / TILE_SIZE);
      const rawBuf = rawChunkMap.get(`${cx}:${cy}`);
      const dstIdx = (py * frameW + px) * 3;

      if (!rawBuf) {
        continue;
      }

      const offX = absX % TILE_SIZE;
      const offY = absY % TILE_SIZE;
      const srcIdx = (offY * TILE_SIZE + offX) * 4;

      framePixels[dstIdx] = rawBuf[srcIdx];
      framePixels[dstIdx + 1] = rawBuf[srcIdx + 1];
      framePixels[dstIdx + 2] = rawBuf[srcIdx + 2];
    }
  }

  return sharp(framePixels, {
    raw: { width: frameW, height: frameH, channels: 3 },
  }).png().toBuffer();
}

export async function generateTimelapse(sharp, x1, y1, x2, y2, startDate, endDate) {
  if (!BACKUP_URL) {
    return { error: 'BACKUP_URL is not configured. Historical data is unavailable.' };
  }

  const dates = getDateRange(startDate, endDate);
  if (dates.length === 0) {
    return { error: 'No days in the specified range.' };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timelapse-'));

  try {
    const frameW = x2 - x1 + 1;
    const frameH = y2 - y1 + 1;

    for (let i = 0; i < dates.length; i += 1) {
      const dateStr = dates[i];
      let frameBuf;
      try {
        frameBuf = await buildFrame(sharp, dateStr, x1, y1, x2, y2);
      } catch (err) {
        logger.error(`Timelapse: failed to build frame for ${dateStr}: ${err.message}`);
        frameBuf = Buffer.alloc(frameW * frameH * 3);
        frameBuf = await sharp(frameBuf, {
          raw: { width: frameW, height: frameH, channels: 3 },
        }).png().toBuffer();
      }
      const framePath = path.join(tmpDir, `frame${String(i).padStart(6, '0')}.png`);
      fs.writeFileSync(framePath, frameBuf);
    }

    const outputPath = path.join(tmpDir, 'timelapse.mp4');

    await execFileAsync('ffmpeg', [
      '-y',
      '-framerate', '1',
      '-i', path.join(tmpDir, 'frame%06d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', `scale=${frameW % 2 === 0 ? frameW : frameW + 1}:${frameH % 2 === 0 ? frameH : frameH + 1}`,
      outputPath,
    ]);

    const mp4Buffer = fs.readFileSync(outputPath);
    return { mp4Buffer, frameCount: dates.length };
  } catch (err) {
    logger.error(`Timelapse generation failed: ${err.message}`);
    return { error: `Timelapse generation failed: ${err.message}` };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
