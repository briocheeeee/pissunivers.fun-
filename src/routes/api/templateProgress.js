import { Router } from 'express';

import canvases from '../../core/canvases.js';
import RedisCanvas from '../../data/redis/RedisCanvas.js';
import { TILE_SIZE } from '../../core/constants.js';

const router = Router();

function getColorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2,
  );
}

router.post('/', async (req, res) => {
  const { canvasId, x, y, width, height, totalPixels, sampleRate, sampledPixels } = req.body;

  if (!canvasId || x === undefined || y === undefined || !width || !height) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  if (!sampledPixels || !Array.isArray(sampledPixels)) {
    return res.status(400).json({ error: 'Missing sampled pixels' });
  }

  const canvasIdNum = parseInt(canvasId, 10);
  const startX = parseInt(x, 10);
  const startY = parseInt(y, 10);
  const templateWidth = parseInt(width, 10);
  const templateHeight = parseInt(height, 10);
  const totalPixelsNum = parseInt(totalPixels, 10) || 0;
  const sampleRateNum = parseInt(sampleRate, 10) || 1;

  try {
    const canvas = canvases[canvasIdNum];

    if (!canvas) {
      return res.status(400).json({ error: 'Invalid canvas' });
    }

    const { colors, size: canvasSize } = canvas;
    const halfSize = canvasSize / 2;

    const neededChunks = new Set();
    for (const pixel of sampledPixels) {
      const canvasX = startX + pixel.px;
      const canvasY = startY + pixel.py;
      const absX = canvasX + halfSize;
      const absY = canvasY + halfSize;
      const chunkX = Math.floor(absX / TILE_SIZE);
      const chunkY = Math.floor(absY / TILE_SIZE);
      neededChunks.add(`${chunkX}:${chunkY}`);
    }

    const chunks = new Map();
    for (const chunkKey of neededChunks) {
      const [cx, cy] = chunkKey.split(':').map(Number);
      const chunk = await RedisCanvas.getChunk(canvasIdNum, cx, cy);
      chunks.set(chunkKey, chunk);
    }

    let sampledPlaced = 0;
    for (const pixel of sampledPixels) {
      const { px, py, r: templateR, g: templateG, b: templateB } = pixel;

      const canvasX = startX + px;
      const canvasY = startY + py;

      if (canvasX < -halfSize || canvasX >= halfSize || canvasY < -halfSize || canvasY >= halfSize) {
        continue;
      }

      const absX = canvasX + halfSize;
      const absY = canvasY + halfSize;
      const chunkX = Math.floor(absX / TILE_SIZE);
      const chunkY = Math.floor(absY / TILE_SIZE);
      const chunkKey = `${chunkX}:${chunkY}`;
      const chunk = chunks.get(chunkKey);

      if (!chunk) {
        continue;
      }

      const offsetX = absX % TILE_SIZE;
      const offsetY = absY % TILE_SIZE;
      const chunkIdx = offsetY * TILE_SIZE + offsetX;

      const colorIndex = chunk[chunkIdx];
      if (colorIndex === undefined || colorIndex >= colors.length) {
        continue;
      }

      const canvasColor = colors[colorIndex];
      if (!canvasColor) {
        continue;
      }

      const [canvasR, canvasG, canvasB] = canvasColor;
      const distance = getColorDistance(
        templateR, templateG, templateB,
        canvasR, canvasG, canvasB,
      );

      if (distance < 30) {
        sampledPlaced += 1;
      }
    }

    const placedPixels = Math.round(sampledPlaced * sampleRateNum);
    const progressPercent = totalPixelsNum > 0 ? Math.round((placedPixels / totalPixelsNum) * 100) : 0;

    return res.json({
      placedPixels,
      totalPixels: totalPixelsNum,
      remainingPixels: totalPixelsNum - placedPixels,
      progressPercent,
    });
  } catch (err) {
    console.error('Error calculating template progress:', err);
    return res.status(500).json({ error: 'Failed to calculate progress' });
  }
});

export default router;
