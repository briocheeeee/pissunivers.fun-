import logger from './logger.js';
import {
  createBotDetection,
  getPendingDetectionForUser,
  SUSPICION_LEVEL,
  DETECTION_TYPE,
} from '../data/sql/BotDetection.js';
import { getBotDetectionRecorder } from './BotDetectionRecorder.js';

const DEFAULT_CONFIG = {
  minPoints: 12,
  maxTimeWindowMs: 15000,
  collinearityTolerancePx: 0.35,
  spacingToleranceRel: 0.05,
  angleToleranceDeg: 2,
  minSpacingPx: 1,
  maxSpacingPx: 50,
  minLineLength: 10,
  maxUsersTracked: 5000,
  maxPixelsPerUser: 200,
  historyWindowMs: 60000,
  cleanupIntervalMs: 30000,
  dbWriteCooldownMs: 30000,
  maxActiveRecordings: 50,
  recordingDurationMs: 90000,
  recordingPreRollMs: 30000,
};

class CircularPixelBuffer {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.tail = 0;
    this.length = 0;
  }

  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;
    if (this.length < this.maxSize) {
      this.length += 1;
    } else {
      this.tail = (this.tail + 1) % this.maxSize;
    }
  }

  toArray() {
    const result = new Array(this.length);
    for (let i = 0; i < this.length; i += 1) {
      result[i] = this.buffer[(this.tail + i) % this.maxSize];
    }
    return result;
  }

  filterByTime(minTimestamp) {
    const arr = this.toArray().filter((p) => p && p.timestamp >= minTimestamp);
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.tail = 0;
    this.length = 0;
    for (const item of arr) {
      this.push(item);
    }
    return arr;
  }

  size() {
    return this.length;
  }
}

class ScriptedLineDetector {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.userPixelHistory = new Map();
    this.activeRecordings = new Map();
    this.dbWriteCooldown = new Map();
    this.stats = {
      totalPixelsProcessed: 0,
      totalAnalysesRun: 0,
      totalDetections: 0,
      linesDetected: 0,
    };
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.config.cleanupIntervalMs,
    );
  }

  cleanup() {
    const now = Date.now();
    const maxAge = this.config.historyWindowMs;
    let cleaned = 0;
    for (const [key, data] of this.userPixelHistory) {
      if (now - data.lastActivity > maxAge) {
        this.userPixelHistory.delete(key);
        this.dbWriteCooldown.delete(key);
        cleaned += 1;
      }
    }
    if (this.userPixelHistory.size > this.config.maxUsersTracked) {
      const entries = Array.from(this.userPixelHistory.entries());
      entries.sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      const toRemove = entries.slice(0, entries.length - this.config.maxUsersTracked);
      for (const [key] of toRemove) {
        this.userPixelHistory.delete(key);
        this.dbWriteCooldown.delete(key);
        cleaned += 1;
      }
    }
    if (cleaned > 0) {
      logger.info(`SCRIPTED_LINE: Cleanup removed ${cleaned} entries, active: ${this.userPixelHistory.size}`);
    }
  }

  getKey(userId, ipString) {
    if (userId) return `u:${userId}`;
    if (ipString) return `i:${ipString}`;
    return null;
  }

  recordPixel(userId, ipString, canvasId, x, y, color, iid = null) {
    if (!userId && !ipString) {
      return { detected: false };
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { detected: false };
    }

    const key = this.getKey(userId, ipString);
    if (!key) {
      return { detected: false };
    }

    const now = Date.now();
    this.stats.totalPixelsProcessed += 1;

    let history = this.userPixelHistory.get(key);
    if (!history) {
      if (this.userPixelHistory.size >= this.config.maxUsersTracked) {
        return { detected: false };
      }
      history = {
        pixels: new CircularPixelBuffer(this.config.maxPixelsPerUser),
        lastActivity: now,
        userId,
        ipString,
        iid,
        canvasId,
      };
      this.userPixelHistory.set(key, history);
    }

    history.pixels.push({
      x: Math.round(x),
      y: Math.round(y),
      color: color !== undefined ? color : -1,
      timestamp: now,
      canvasId,
    });
    history.lastActivity = now;
    history.canvasId = canvasId;
    if (iid) history.iid = iid;

    const windowStart = now - this.config.historyWindowMs;
    history.pixels.filterByTime(windowStart);

    return this.analyzeForScriptedLine(key, history);
  }

  analyzeForScriptedLine(key, history) {
    const pixels = history.pixels.toArray();
    if (pixels.length < this.config.minPoints) {
      return { detected: false };
    }

    this.stats.totalAnalysesRun += 1;

    const now = Date.now();
    const windowStart = now - this.config.maxTimeWindowMs;
    const recentPixels = pixels.filter((p) => p.timestamp >= windowStart);

    if (recentPixels.length < this.config.minPoints) {
      return { detected: false };
    }

    recentPixels.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    const result = this.detectScriptedLine(recentPixels);

    if (result.detected) {
      this.stats.linesDetected += 1;
      this.handleDetection(key, history, result);
    }

    return result;
  }

  detectScriptedLine(pixels) {
    if (pixels.length < this.config.minPoints) {
      return { detected: false };
    }

    for (let startIdx = 0; startIdx <= pixels.length - this.config.minPoints; startIdx += 1) {
      const candidatePixels = pixels.slice(startIdx);
      const result = this.checkLineSequence(candidatePixels);
      if (result.detected) {
        return result;
      }
    }

    return { detected: false };
  }

  checkLineSequence(pixels) {
    if (pixels.length < this.config.minPoints) {
      return { detected: false };
    }

    const first = pixels[0];
    const last = pixels[pixels.length - 1];

    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    if (lineLength < this.config.minLineLength) {
      return { detected: false };
    }

    const dirX = dx / lineLength;
    const dirY = dy / lineLength;

    const projections = [];
    const perpDistances = [];

    for (const p of pixels) {
      const relX = p.x - first.x;
      const relY = p.y - first.y;
      const proj = relX * dirX + relY * dirY;
      const perpX = relX - proj * dirX;
      const perpY = relY - proj * dirY;
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

      projections.push(proj);
      perpDistances.push(perpDist);
    }

    const maxPerpDist = Math.max(...perpDistances);
    if (maxPerpDist > this.config.collinearityTolerancePx) {
      return { detected: false };
    }

    for (let i = 1; i < projections.length; i += 1) {
      if (projections[i] <= projections[i - 1]) {
        return { detected: false };
      }
    }

    const spacings = [];
    for (let i = 1; i < pixels.length; i += 1) {
      const spaceDx = pixels[i].x - pixels[i - 1].x;
      const spaceDy = pixels[i].y - pixels[i - 1].y;
      const spacing = Math.sqrt(spaceDx * spaceDx + spaceDy * spaceDy);
      spacings.push(spacing);
    }

    if (spacings.length === 0) {
      return { detected: false };
    }

    const sortedSpacings = [...spacings].sort((a, b) => a - b);
    const medianSpacing = sortedSpacings[Math.floor(sortedSpacings.length / 2)];

    if (medianSpacing < this.config.minSpacingPx || medianSpacing > this.config.maxSpacingPx) {
      return { detected: false };
    }

    const tolerance = medianSpacing * this.config.spacingToleranceRel;
    for (const spacing of spacings) {
      if (Math.abs(spacing - medianSpacing) > tolerance) {
        return { detected: false };
      }
    }

    for (const spacing of spacings) {
      if (spacing < 0.5) {
        return { detected: false };
      }
    }

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    let direction = 'diagonal';
    if (Math.abs(angle) < this.config.angleToleranceDeg || Math.abs(angle - 180) < this.config.angleToleranceDeg || Math.abs(angle + 180) < this.config.angleToleranceDeg) {
      direction = 'horizontal';
    } else if (Math.abs(angle - 90) < this.config.angleToleranceDeg || Math.abs(angle + 90) < this.config.angleToleranceDeg) {
      direction = 'vertical';
    } else if (Math.abs(Math.abs(angle) - 45) < this.config.angleToleranceDeg || Math.abs(Math.abs(angle) - 135) < this.config.angleToleranceDeg) {
      direction = 'diagonal_45';
    }

    return {
      detected: true,
      pointCount: pixels.length,
      lineLength: Math.round(lineLength),
      direction,
      angle: Math.round(angle * 10) / 10,
      medianSpacing: Math.round(medianSpacing * 100) / 100,
      maxPerpDistance: Math.round(maxPerpDist * 100) / 100,
      startX: first.x,
      startY: first.y,
      endX: last.x,
      endY: last.y,
      startTime: pixels[0].timestamp,
      endTime: pixels[pixels.length - 1].timestamp,
      pixels,
    };
  }

  async handleDetection(key, history, result) {
    const now = Date.now();
    const lastWrite = this.dbWriteCooldown.get(key) || 0;
    if (now - lastWrite < this.config.dbWriteCooldownMs) {
      return;
    }

    const { userId, ipString, iid, canvasId } = history;

    try {
      const existing = await getPendingDetectionForUser(userId, ipString);
      if (existing) {
        return;
      }
    } catch (error) {
      logger.error(`SCRIPTED_LINE: DB check failed: ${error.message}`);
      return;
    }

    try {
      const record = await createBotDetection({
        uid: userId,
        ipString,
        iid,
        canvasId,
        score: 100,
        level: SUSPICION_LEVEL.HIGH,
        detectionType: DETECTION_TYPE.PERFECT_LINE,
        detectionDetails: {
          detector: 'scripted_line',
          pointCount: result.pointCount,
          lineLength: result.lineLength,
          direction: result.direction,
          angle: result.angle,
          medianSpacing: result.medianSpacing,
          maxPerpDistance: result.maxPerpDistance,
          startX: result.startX,
          startY: result.startY,
          endX: result.endX,
          endY: result.endY,
          durationMs: result.endTime - result.startTime,
        },
        locationX: result.endX,
        locationY: result.endY,
      });

      if (record) {
        this.stats.totalDetections += 1;
        this.dbWriteCooldown.set(key, now);

        logger.warn(
          `SCRIPTED_LINE: DETECTED | ${userId || 'anon'} | ${ipString} | ${result.pointCount}pts | ${result.lineLength}px ${result.direction} | spacing=${result.medianSpacing}px`,
        );

        this.triggerRecording(record.id, history, result);
      }
    } catch (error) {
      logger.error(`SCRIPTED_LINE: Create failed: ${error.message}`);
    }
  }

  triggerRecording(detectionId, history, result) {
    const key = this.getKey(history.userId, history.ipString);
    if (!key || this.activeRecordings.has(key)) {
      return;
    }
    if (this.activeRecordings.size >= this.config.maxActiveRecordings) {
      logger.warn('SCRIPTED_LINE: Max recordings reached');
      return;
    }

    const recorder = getBotDetectionRecorder();
    const centerX = Math.round((result.startX + result.endX) / 2);
    const centerY = Math.round((result.startY + result.endY) / 2);

    const recording = recorder.startRecording(
      detectionId,
      history.canvasId,
      centerX,
      centerY,
      8,
    );

    if (!recording) {
      logger.warn(`SCRIPTED_LINE: Failed to start recording ${detectionId}`);
      return;
    }

    recorder.addFrame(detectionId, {
      type: 'init',
      detectionType: 'scripted_line',
      lineData: {
        startX: result.startX,
        startY: result.startY,
        endX: result.endX,
        endY: result.endY,
        pointCount: result.pointCount,
        direction: result.direction,
      },
      pixels: result.pixels.map((p) => ({ x: p.x, y: p.y, color: p.color, ts: p.timestamp })),
    });

    this.activeRecordings.set(key, { detectionId, recorder });
    logger.info(`SCRIPTED_LINE: Recording ${detectionId} started at (${centerX}, ${centerY})`);

    setTimeout(() => {
      this.stopRecording(key);
    }, this.config.recordingDurationMs);
  }

  addRecordingFrame(userId, ipString, pixelData) {
    const key = this.getKey(userId, ipString);
    const recordingInfo = this.activeRecordings.get(key);
    if (!recordingInfo) return;

    const recorder = getBotDetectionRecorder();
    recorder.addFrame(recordingInfo.detectionId, {
      type: 'pixel',
      ...pixelData,
    });
  }

  async stopRecording(key) {
    const recordingInfo = this.activeRecordings.get(key);
    if (!recordingInfo) return;

    this.activeRecordings.delete(key);
    const recorder = getBotDetectionRecorder();

    try {
      const filepath = await recorder.stopRecording(recordingInfo.detectionId);
      if (filepath) {
        logger.info(`SCRIPTED_LINE: Recording ${recordingInfo.detectionId} saved to ${filepath}`);
      }
    } catch (error) {
      logger.error(`SCRIPTED_LINE: Recording stop failed: ${error.message}`);
    }
  }

  getStats() {
    return {
      ...this.stats,
      activeUsers: this.userPixelHistory.size,
      activeRecordings: this.activeRecordings.size,
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.userPixelHistory.clear();
    this.activeRecordings.clear();
    this.dbWriteCooldown.clear();
    logger.info('SCRIPTED_LINE: Shutdown complete');
  }
}

let instance = null;

export function getScriptedLineDetector(config) {
  if (!instance) {
    instance = new ScriptedLineDetector(config);
  }
  return instance;
}

export function resetScriptedLineDetector() {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

export default ScriptedLineDetector;
