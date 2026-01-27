import assert from 'assert';

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

class ScriptedLineDetectorTest {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.userPixelHistory = new Map();
    this.stats = {
      totalPixelsProcessed: 0,
      totalAnalysesRun: 0,
      totalDetections: 0,
      linesDetected: 0,
    };
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
      this.stats.totalDetections += 1;
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

  getStats() {
    return {
      ...this.stats,
      activeUsers: this.userPixelHistory.size,
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return { ...this.config };
  }

  cleanup() {
    const now = Date.now();
    const maxAge = this.config.historyWindowMs;
    for (const [key, data] of this.userPixelHistory) {
      if (now - data.lastActivity > maxAge) {
        this.userPixelHistory.delete(key);
      }
    }
  }

  shutdown() {
    this.userPixelHistory.clear();
  }
}

const testConfig = {
  minPoints: 12,
  maxTimeWindowMs: 120000,
  collinearityTolerancePx: 0.35,
  spacingToleranceRel: 0.05,
  angleToleranceDeg: 2,
  minSpacingPx: 1,
  maxSpacingPx: 50,
  minLineLength: 10,
  maxUsersTracked: 100,
  maxPixelsPerUser: 200,
  historyWindowMs: 120000,
  cleanupIntervalMs: 300000,
  dbWriteCooldownMs: 0,
  maxActiveRecordings: 10,
  recordingDurationMs: 5000,
};

function createDetector() {
  return new ScriptedLineDetectorTest(testConfig);
}

function generateStraightLinePixels(startX, startY, dx, dy, count, spacing = 1) {
  const pixels = [];
  const baseTime = Date.now();
  for (let i = 0; i < count; i += 1) {
    pixels.push({
      x: startX + i * dx * spacing,
      y: startY + i * dy * spacing,
      color: 1,
      timestamp: baseTime + i * 100,
      canvasId: 0,
    });
  }
  return pixels;
}

function simulatePixelPlacements(detector, userId, ipString, pixels) {
  let lastResult = { detected: false };
  for (const p of pixels) {
    lastResult = detector.recordPixel(userId, ipString, p.canvasId, p.x, p.y, p.color, null);
  }
  return lastResult;
}

async function runTests() {
  console.log('Running ScriptedLineDetector tests...\n');
  let passed = 0;
  let failed = 0;

  const tests = [
    ['Horizontal line detection', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 1, 0, 15, 1);
      const result = simulatePixelPlacements(detector, 1, '127.0.0.1', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.direction, 'horizontal');
    }],
    ['Vertical line detection', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 0, 1, 15, 1);
      const result = simulatePixelPlacements(detector, 2, '127.0.0.2', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, true);
      assert.strictEqual(result.direction, 'vertical');
    }],
    ['Diagonal line detection', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 1, 1, 15, 1);
      const result = simulatePixelPlacements(detector, 3, '127.0.0.3', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, true);
    }],
    ['Unequal spacing rejection', () => {
      const detector = createDetector();
      const baseTime = Date.now();
      const pixels = [];
      let x = 100;
      for (let i = 0; i < 15; i += 1) {
        const spacing = i % 2 === 0 ? 1 : 3;
        x += spacing;
        pixels.push({ x, y: 100, color: 1, timestamp: baseTime + i * 100, canvasId: 0 });
      }
      const result = simulatePixelPlacements(detector, 4, '127.0.0.4', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, false);
    }],
    ['Off-line rejection', () => {
      const detector = createDetector();
      const baseTime = Date.now();
      const pixels = [];
      for (let i = 0; i < 15; i += 1) {
        pixels.push({ x: 100 + i, y: 100 + (i % 2 === 0 ? 0 : 2), color: 1, timestamp: baseTime + i * 100, canvasId: 0 });
      }
      const result = simulatePixelPlacements(detector, 5, '127.0.0.5', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, false);
    }],
    ['Two-segment line rejection', () => {
      const detector = createDetector();
      const baseTime = Date.now();
      const pixels = [];
      for (let i = 0; i < 8; i += 1) {
        pixels.push({ x: 100 + i, y: 100, color: 1, timestamp: baseTime + i * 100, canvasId: 0 });
      }
      for (let i = 0; i < 8; i += 1) {
        pixels.push({ x: 107, y: 100 + i + 1, color: 1, timestamp: baseTime + (8 + i) * 100, canvasId: 0 });
      }
      const result = simulatePixelPlacements(detector, 6, '127.0.0.6', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, false);
    }],
    ['Random placements rejection', () => {
      const detector = createDetector();
      const baseTime = Date.now();
      const pixels = [];
      const positions = [[234, 89], [12, 456], [378, 23], [145, 290], [67, 412], [289, 178], [423, 56], [98, 334], [256, 189], [34, 267], [189, 423], [312, 78], [45, 356], [278, 134], [156, 289]];
      for (let i = 0; i < positions.length; i += 1) {
        pixels.push({ x: positions[i][0], y: positions[i][1], color: 1, timestamp: baseTime + i * 100, canvasId: 0 });
      }
      const result = simulatePixelPlacements(detector, 7, '127.0.0.7', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, false);
    }],
    ['Too few points rejection', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 1, 0, 8, 1);
      const result = simulatePixelPlacements(detector, 8, '127.0.0.8', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, false);
    }],
    ['Line with spacing > 1', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 1, 0, 15, 3);
      const result = simulatePixelPlacements(detector, 9, '127.0.0.9', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, true);
      assert.ok(result.medianSpacing >= 2.9 && result.medianSpacing <= 3.1);
    }],
    ['Duplicate coordinates rejection', () => {
      const detector = createDetector();
      const baseTime = Date.now();
      const pixels = [];
      for (let i = 0; i < 15; i += 1) {
        pixels.push({ x: 100, y: 100, color: 1, timestamp: baseTime + i * 100, canvasId: 0 });
      }
      const result = simulatePixelPlacements(detector, 10, '127.0.0.10', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, false);
    }],
    ['IP-only detection', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 1, 0, 15, 1);
      const result = simulatePixelPlacements(detector, null, '127.0.0.11', pixels);
      detector.shutdown();
      assert.strictEqual(result.detected, true);
    }],
    ['Invalid input rejection', () => {
      const detector = createDetector();
      let result = detector.recordPixel(null, null, 0, 100, 100, 1, null);
      assert.strictEqual(result.detected, false);
      result = detector.recordPixel(1, '127.0.0.1', 0, NaN, 100, 1, null);
      assert.strictEqual(result.detected, false);
      detector.shutdown();
    }],
    ['Config update', () => {
      const detector = createDetector();
      detector.updateConfig({ minPoints: 20 });
      const config = detector.getConfig();
      assert.strictEqual(config.minPoints, 20);
      detector.shutdown();
    }],
    ['Stats tracking', () => {
      const detector = createDetector();
      const pixels = generateStraightLinePixels(100, 100, 1, 0, 15, 1);
      simulatePixelPlacements(detector, 14, '127.0.0.14', pixels);
      const stats = detector.getStats();
      assert.strictEqual(stats.totalPixelsProcessed, 15);
      assert.ok(stats.linesDetected >= 1);
      detector.shutdown();
    }],
  ];

  for (const [name, testFn] of tests) {
    try {
      testFn();
      console.log(`  ✓ ${name}`);
      passed += 1;
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error.message}`);
      failed += 1;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
