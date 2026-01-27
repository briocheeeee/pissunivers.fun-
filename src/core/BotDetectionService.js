import logger from './logger.js';
import {
  createBotDetection,
  updateBotDetectionVideo,
  getPendingDetectionForUser,
  SUSPICION_LEVEL,
  DETECTION_TYPE,
} from '../data/sql/BotDetection.js';
import { getBotDetectionRecorder } from './BotDetectionRecorder.js';

const DEFAULT_CONFIG = {
  timing: {
    minSequenceSize: 60,
    varianceThresholdLow: 100,
    varianceThresholdMedium: 50,
    varianceThresholdHigh: 20,
    minIntervalMs: 20,
    burstDetectionWindow: 2000,
    burstPixelThreshold: 30,
    entropyThresholdLow: 1.5,
    entropyThresholdHigh: 0.8,
    accelerationThreshold: 0.05,
  },
  geometric: {
    minLineLength: 50,
    perfectLineThreshold: 100,
    maxDeviationPixels: 0,
    circleMinPoints: 25,
    circleMaxRadiusError: 1.0,
    rectangleMinSize: 30,
    gridDetectionMinSize: 20,
    clusterMinDensity: 0.90,
  },
  color: {
    singleColorThreshold: 0.99,
    lowEntropyThreshold: 0.9,
    sequentialPatternLength: 25,
  },
  scoring: {
    lowThreshold: 60,
    mediumThreshold: 75,
    highThreshold: 90,
    timingAnomalyBase: 8,
    perfectLineBase: 25,
    perfectCircleBase: 30,
    rectangleBase: 22,
    gridBase: 28,
    burstBase: 5,
    entropyBase: 6,
    accelerationBase: 5,
    colorPatternBase: 4,
    spatialClusterBase: 6,
    combinedMultiplier: 1.15,
    repetitionBonus: 3,
    humanLikePenalty: -50,
    minSignalsRequired: 4,
    geometricRequired: true,
  },
  recording: {
    triggerThreshold: 70,
    maxDurationMs: 120000,
    zoomLevel: 8,
  },
  limits: {
    maxUsersTracked: 10000,
    maxPixelsPerUser: 400,
    analysisThrottleMs: 400,
    maxAnalysisPerSecond: 150,
    historyWindowMs: 480000,
    cleanupIntervalMs: 45000,
    dbWriteCooldownMs: 25000,
    maxActiveRecordings: 100,
  },
  humanBehavior: {
    minNaturalVariance: 1500,
    naturalPauseThreshold: 2000,
    minPauseRatio: 0.03,
    expectedCVRange: [12, 90],
    directionChangeThreshold: 0.2,
  },
};

class RateLimiter {
  constructor(maxPerSecond) {
    this.maxPerSecond = maxPerSecond;
    this.tokens = maxPerSecond;
    this.lastRefill = Date.now();
  }

  tryAcquire() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxPerSecond, this.tokens + (elapsed / 1000) * this.maxPerSecond);
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

class CircularBuffer {
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

  last() {
    if (this.length === 0) return null;
    return this.buffer[(this.head - 1 + this.maxSize) % this.maxSize];
  }

  slice(start, end) {
    const arr = this.toArray();
    return arr.slice(start, end);
  }
}

class BotDetectionService {
  constructor(config = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    this.userPixelHistory = new Map();
    this.activeRecordings = new Map();
    this.analysisThrottle = new Map();
    this.dbWriteCooldown = new Map();
    this.detectionCache = new Map();
    this.sessionFingerprints = new Map();
    this.rateLimiter = new RateLimiter(this.config.limits.maxAnalysisPerSecond);
    this.stats = {
      totalPixelsProcessed: 0,
      totalAnalysesRun: 0,
      totalDetections: 0,
      falsePositivesAvoided: 0,
      droppedDueToRateLimit: 0,
      droppedDueToThrottle: 0,
    };
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.config.limits.cleanupIntervalMs,
    );
  }

  mergeConfig(defaults, overrides) {
    const result = {};
    for (const key of Object.keys(defaults)) {
      if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        result[key] = { ...defaults[key], ...(overrides[key] || {}) };
      } else {
        result[key] = overrides[key] !== undefined ? overrides[key] : defaults[key];
      }
    }
    return result;
  }

  cleanup() {
    const now = Date.now();
    const maxAge = this.config.limits.historyWindowMs;
    let cleaned = 0;
    for (const [key, data] of this.userPixelHistory) {
      if (now - data.lastActivity > maxAge) {
        this.userPixelHistory.delete(key);
        this.analysisThrottle.delete(key);
        this.dbWriteCooldown.delete(key);
        this.detectionCache.delete(key);
        this.sessionFingerprints.delete(key);
        cleaned += 1;
      }
    }
    if (this.userPixelHistory.size > this.config.limits.maxUsersTracked) {
      const entries = Array.from(this.userPixelHistory.entries());
      entries.sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      const toRemove = entries.slice(0, entries.length - this.config.limits.maxUsersTracked);
      for (const [key] of toRemove) {
        this.userPixelHistory.delete(key);
        this.analysisThrottle.delete(key);
        this.dbWriteCooldown.delete(key);
        this.detectionCache.delete(key);
        this.sessionFingerprints.delete(key);
        cleaned += 1;
      }
    }
    const throttleMaxAge = this.config.limits.analysisThrottleMs * 10;
    for (const [key, time] of this.analysisThrottle) {
      if (now - time > throttleMaxAge) {
        this.analysisThrottle.delete(key);
      }
    }
    const cooldownMaxAge = this.config.limits.dbWriteCooldownMs * 2;
    for (const [key, time] of this.dbWriteCooldown) {
      if (now - time > cooldownMaxAge) {
        this.dbWriteCooldown.delete(key);
      }
    }
    if (cleaned > 0) {
      logger.info(`BOT_DETECTION: Cleanup removed ${cleaned} entries, active: ${this.userPixelHistory.size}`);
    }
  }

  getKey(userId, ipString) {
    if (userId) return `u:${userId}`;
    if (ipString) return `i:${ipString}`;
    return null;
  }

  validateInput(userId, ipString, canvasId, x, y, color) {
    if (!userId && !ipString) return false;
    if (typeof canvasId !== 'string' && typeof canvasId !== 'number') return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < -100000 || x > 100000 || y < -100000 || y > 100000) return false;
    if (color !== undefined && color !== null) {
      if (!Number.isInteger(color) || color < 0 || color > 255) return false;
    }
    return true;
  }

  recordPixel(userId, ipString, canvasId, x, y, color, iid = null) {
    if (!this.validateInput(userId, ipString, canvasId, x, y, color)) {
      return { score: 0, level: null, flags: [], shouldRecord: false };
    }
    const key = this.getKey(userId, ipString);
    if (!key) {
      return { score: 0, level: null, flags: [], shouldRecord: false };
    }
    const now = Date.now();
    this.stats.totalPixelsProcessed += 1;
    let history = this.userPixelHistory.get(key);
    if (!history) {
      if (this.userPixelHistory.size >= this.config.limits.maxUsersTracked) {
        return { score: 0, level: null, flags: [], shouldRecord: false };
      }
      history = {
        pixels: new CircularBuffer(this.config.limits.maxPixelsPerUser),
        lastActivity: now,
        lastAnalysis: 0,
        userId,
        ipString,
        iid,
        canvasId,
        currentScore: 0,
        peakScore: 0,
        detectionFlags: [],
        analysisCount: 0,
        suspiciousStreak: 0,
        humanIndicators: 0,
        sessionStart: now,
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
    const windowStart = now - this.config.limits.historyWindowMs;
    history.pixels.filterByTime(windowStart);
    return this.throttledAnalysis(key, history, now);
  }

  throttledAnalysis(key, history, now) {
    const lastAnalysis = this.analysisThrottle.get(key) || 0;
    const timeSinceLastAnalysis = now - lastAnalysis;
    const pixelCount = history.pixels.size();
    const minPixels = this.config.timing.minSequenceSize;
    if (pixelCount < minPixels) {
      return { score: history.currentScore, level: null, flags: [], shouldRecord: false };
    }
    let throttleTime = this.config.limits.analysisThrottleMs;
    if (history.currentScore >= this.config.scoring.highThreshold) {
      throttleTime = Math.floor(throttleTime / 4);
    } else if (history.currentScore >= this.config.scoring.mediumThreshold) {
      throttleTime = Math.floor(throttleTime / 2);
    }
    if (timeSinceLastAnalysis < throttleTime) {
      this.stats.droppedDueToThrottle += 1;
      return {
        score: history.currentScore,
        level: this.getLevel(history.currentScore),
        flags: history.detectionFlags,
        shouldRecord: history.currentScore >= this.config.recording.triggerThreshold,
        cached: true,
      };
    }
    if (!this.rateLimiter.tryAcquire()) {
      this.stats.droppedDueToRateLimit += 1;
      return {
        score: history.currentScore,
        level: this.getLevel(history.currentScore),
        flags: history.detectionFlags,
        shouldRecord: history.currentScore >= this.config.recording.triggerThreshold,
        rateLimited: true,
      };
    }
    this.analysisThrottle.set(key, now);
    return this.analyzeUser(key, history);
  }

  analyzeUser(key, history) {
    this.stats.totalAnalysesRun += 1;
    history.analysisCount += 1;
    const pixels = history.pixels.toArray();
    if (pixels.length < this.config.timing.minSequenceSize) {
      return { score: 0, level: null, flags: [], shouldRecord: false };
    }
    const timingResult = this.analyzeTimingPatterns(pixels);
    const entropyResult = this.analyzeTimingEntropy(pixels);
    const accelerationResult = this.analyzeAcceleration(pixels);
    const burstResult = this.detectBurstActivity(pixels);
    const humanResult = this.detectHumanBehavior(pixels);
    let geometricResult = { suspicious: false, score: 0, flags: [], hasLine: false, hasCircle: false, hasRectangle: false, hasGrid: false };
    let spatialResult = { suspicious: false, score: 0, flags: [] };
    let colorResult = { suspicious: false, score: 0, flags: [] };
    const preliminaryScore = timingResult.score + entropyResult.score + burstResult.score + accelerationResult.score;
    if (preliminaryScore >= 15 || timingResult.suspicious || burstResult.suspicious) {
      geometricResult = this.analyzeGeometricPatterns(pixels);
      spatialResult = this.analyzeSpatialClustering(pixels);
      colorResult = this.analyzeColorPatterns(pixels);
    }
    let totalScore = 0;
    const flags = [];
    const detectionTypes = [];
    if (timingResult.suspicious) {
      totalScore += timingResult.score;
      flags.push(...timingResult.flags);
      detectionTypes.push(DETECTION_TYPE.TIMING_ANOMALY);
    }
    if (entropyResult.suspicious) {
      totalScore += entropyResult.score;
      flags.push(...entropyResult.flags);
    }
    if (accelerationResult.suspicious) {
      totalScore += accelerationResult.score;
      flags.push(...accelerationResult.flags);
    }
    if (burstResult.suspicious) {
      totalScore += burstResult.score;
      flags.push(...burstResult.flags);
    }
    if (geometricResult.suspicious) {
      totalScore += geometricResult.score;
      flags.push(...geometricResult.flags);
      if (geometricResult.hasLine) detectionTypes.push(DETECTION_TYPE.PERFECT_LINE);
      if (geometricResult.hasCircle) detectionTypes.push(DETECTION_TYPE.PERFECT_CIRCLE);
    }
    if (spatialResult.suspicious) {
      totalScore += spatialResult.score;
      flags.push(...spatialResult.flags);
    }
    if (colorResult.suspicious) {
      totalScore += colorResult.score;
      flags.push(...colorResult.flags);
    }
    const suspiciousSignals = [
      timingResult.suspicious,
      entropyResult.suspicious,
      accelerationResult.suspicious,
      burstResult.suspicious,
      geometricResult.suspicious,
      spatialResult.suspicious,
      colorResult.suspicious,
    ].filter(Boolean).length;
    const minSignals = this.config.scoring.minSignalsRequired || 4;
    const hasGeometric = geometricResult.suspicious && (geometricResult.hasLine || geometricResult.hasCircle || geometricResult.hasRectangle || geometricResult.hasGrid);
    if (!hasGeometric && this.config.scoring.geometricRequired) {
      totalScore = Math.floor(totalScore * 0.3);
      flags.push('no_geometric_pattern');
    } else if (suspiciousSignals < minSignals) {
      totalScore = Math.floor(totalScore * 0.4);
      flags.push(`insufficient_signals:${suspiciousSignals}/${minSignals}`);
    } else if (suspiciousSignals >= 5 && hasGeometric) {
      totalScore = Math.floor(totalScore * this.config.scoring.combinedMultiplier);
      if (!detectionTypes.includes(DETECTION_TYPE.COMBINED)) {
        detectionTypes.push(DETECTION_TYPE.COMBINED);
      }
      flags.push(`multi_signal:count=${suspiciousSignals}`);
    }
    if (humanResult.isHuman) {
      const humanPenalty = this.config.scoring.humanLikePenalty * (1 + humanResult.confidence / 100);
      totalScore += Math.floor(humanPenalty);
      history.humanIndicators += 1;
      this.stats.falsePositivesAvoided += 1;
      flags.push(`human_detected:conf=${humanResult.confidence}`);
    }
    if (history.suspiciousStreak > 3 && suspiciousSignals >= minSignals) {
      const streakBonus = Math.min(history.suspiciousStreak * this.config.scoring.repetitionBonus, 15);
      totalScore += streakBonus;
      flags.push(`suspicious_streak:${history.suspiciousStreak}`);
    }
    totalScore = Math.max(0, Math.min(totalScore, 100));
    const previousScore = history.currentScore;
    history.currentScore = totalScore;
    history.peakScore = Math.max(history.peakScore, totalScore);
    history.detectionFlags = flags;
    if (totalScore >= this.config.scoring.lowThreshold) {
      history.suspiciousStreak += 1;
    } else if (totalScore < this.config.scoring.lowThreshold / 2) {
      history.suspiciousStreak = Math.max(0, history.suspiciousStreak - 1);
    }
    const level = this.getLevel(totalScore);
    const shouldRecord = totalScore >= this.config.recording.triggerThreshold;
    const scoreIncreased = totalScore > previousScore;
    const significantChange = Math.abs(totalScore - previousScore) >= 8;
    if (level && totalScore >= this.config.scoring.lowThreshold && (scoreIncreased || significantChange)) {
      this.handleDetection(key, history, totalScore, level, detectionTypes, {
        timing: timingResult,
        entropy: entropyResult,
        acceleration: accelerationResult,
        burst: burstResult,
        geometric: geometricResult,
        spatial: spatialResult,
        color: colorResult,
        human: humanResult,
      });
    }
    return {
      score: totalScore,
      level,
      flags,
      shouldRecord,
      details: {
        timing: timingResult,
        entropy: entropyResult,
        acceleration: accelerationResult,
        burst: burstResult,
        geometric: geometricResult,
        spatial: spatialResult,
        color: colorResult,
        human: humanResult,
      },
    };
  }

  analyzeTimingPatterns(pixels) {
    const minSize = this.config.timing.minSequenceSize;
    if (pixels.length < minSize) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const recentPixels = pixels.slice(-Math.min(pixels.length, 80));
    const intervals = [];
    for (let i = 1; i < recentPixels.length; i += 1) {
      const interval = recentPixels[i].timestamp - recentPixels[i - 1].timestamp;
      if (interval > 0 && interval < 60000) {
        intervals.push(interval);
      }
    }
    if (intervals.length < minSize - 1) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const trimPercent = 0.1;
    const trimCount = Math.floor(intervals.length * trimPercent);
    const trimmedIntervals = sortedIntervals.slice(trimCount, sortedIntervals.length - trimCount || undefined);
    if (trimmedIntervals.length < 5) {
      return { suspicious: false, score: 0, flags: [] };
    }
    let sum = 0;
    for (let i = 0; i < trimmedIntervals.length; i += 1) {
      sum += trimmedIntervals[i];
    }
    const avgInterval = sum / trimmedIntervals.length;
    let varianceSum = 0;
    for (let i = 0; i < trimmedIntervals.length; i += 1) {
      varianceSum += (trimmedIntervals[i] - avgInterval) ** 2;
    }
    const variance = varianceSum / trimmedIntervals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgInterval > 0 ? (stdDev / avgInterval) * 100 : 100;
    const medianIdx = Math.floor(trimmedIntervals.length / 2);
    const medianInterval = trimmedIntervals[medianIdx];
    const q1 = trimmedIntervals[Math.floor(trimmedIntervals.length * 0.25)];
    const q3 = trimmedIntervals[Math.floor(trimmedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    const flags = [];
    let score = 0;
    let suspicious = false;
    const n = trimmedIntervals.length;
    if (variance <= this.config.timing.varianceThresholdHigh && n >= 25) {
      score += this.config.scoring.timingAnomalyBase * 2;
      flags.push(`extreme_consistency:var=${variance.toFixed(0)},n=${n}`);
      suspicious = true;
    } else if (variance <= this.config.timing.varianceThresholdMedium && n >= 18) {
      score += this.config.scoring.timingAnomalyBase * 1.5;
      flags.push(`high_consistency:var=${variance.toFixed(0)},n=${n}`);
      suspicious = true;
    } else if (variance <= this.config.timing.varianceThresholdLow && n >= 12) {
      score += this.config.scoring.timingAnomalyBase;
      flags.push(`consistent_timing:var=${variance.toFixed(0)}`);
      suspicious = true;
    }
    if (avgInterval < this.config.timing.minIntervalMs && n >= 15) {
      score += 12;
      flags.push(`inhuman_speed:avg=${avgInterval.toFixed(0)}ms`);
      suspicious = true;
    }
    if (coefficientOfVariation < 10 && n >= 30) {
      score += 10;
      flags.push(`machine_cv:${coefficientOfVariation.toFixed(1)}%`);
      suspicious = true;
    }
    if (iqr < 50 && n >= 20) {
      score += 8;
      flags.push(`tight_iqr:${iqr.toFixed(0)}ms`);
      suspicious = true;
    }
    const medianDeviation = Math.abs(medianInterval - avgInterval);
    if (medianDeviation < 15 && n >= 25) {
      score += 6;
      flags.push(`symmetric:dev=${medianDeviation.toFixed(0)}ms`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      avgInterval,
      variance,
      stdDev,
      coefficientOfVariation,
      medianInterval,
      iqr,
      sampleSize: n,
    };
  }

  analyzeTimingEntropy(pixels) {
    if (pixels.length < 20) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const intervals = [];
    for (let i = 1; i < pixels.length; i += 1) {
      const interval = pixels[i].timestamp - pixels[i - 1].timestamp;
      if (interval > 0 && interval < 60000) {
        intervals.push(interval);
      }
    }
    if (intervals.length < 15) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const bucketSize = 50;
    const buckets = new Map();
    for (const interval of intervals) {
      const bucket = Math.floor(interval / bucketSize);
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    let entropy = 0;
    const total = intervals.length;
    for (const count of buckets.values()) {
      const p = count / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    const maxEntropy = Math.log2(buckets.size);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
    const flags = [];
    let score = 0;
    let suspicious = false;
    if (entropy < this.config.timing.entropyThresholdHigh && intervals.length >= 30) {
      score += this.config.scoring.entropyBase * 1.5;
      flags.push(`very_low_entropy:${entropy.toFixed(2)}`);
      suspicious = true;
    } else if (entropy < this.config.timing.entropyThresholdLow && intervals.length >= 20) {
      score += this.config.scoring.entropyBase;
      flags.push(`low_entropy:${entropy.toFixed(2)}`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      entropy,
      normalizedEntropy,
      bucketCount: buckets.size,
    };
  }

  analyzeAcceleration(pixels) {
    if (pixels.length < 25) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const intervals = [];
    for (let i = 1; i < pixels.length; i += 1) {
      const interval = pixels[i].timestamp - pixels[i - 1].timestamp;
      if (interval > 0 && interval < 60000) {
        intervals.push(interval);
      }
    }
    if (intervals.length < 20) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const accelerations = [];
    for (let i = 1; i < intervals.length; i += 1) {
      if (intervals[i - 1] > 0) {
        const accel = (intervals[i] - intervals[i - 1]) / intervals[i - 1];
        accelerations.push(accel);
      }
    }
    if (accelerations.length < 15) {
      return { suspicious: false, score: 0, flags: [] };
    }
    let accelSum = 0;
    for (const a of accelerations) {
      accelSum += Math.abs(a);
    }
    const avgAbsAccel = accelSum / accelerations.length;
    let accelVarSum = 0;
    for (const a of accelerations) {
      accelVarSum += (Math.abs(a) - avgAbsAccel) ** 2;
    }
    const accelVariance = accelVarSum / accelerations.length;
    const flags = [];
    let score = 0;
    let suspicious = false;
    if (avgAbsAccel < this.config.timing.accelerationThreshold && accelerations.length >= 25) {
      score += this.config.scoring.accelerationBase;
      flags.push(`constant_rate:accel=${avgAbsAccel.toFixed(3)}`);
      suspicious = true;
    }
    if (accelVariance < 0.01 && accelerations.length >= 30) {
      score += 8;
      flags.push(`stable_acceleration:var=${accelVariance.toFixed(4)}`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      avgAbsAccel,
      accelVariance,
      sampleSize: accelerations.length,
    };
  }

  detectBurstActivity(pixels) {
    const windowMs = this.config.timing.burstDetectionWindow;
    const threshold = this.config.timing.burstPixelThreshold;
    if (pixels.length < threshold) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const now = pixels[pixels.length - 1].timestamp;
    const windowStart = now - windowMs;
    let recentCount = 0;
    for (let i = pixels.length - 1; i >= 0; i -= 1) {
      if (pixels[i].timestamp >= windowStart) {
        recentCount += 1;
      } else {
        break;
      }
    }
    const flags = [];
    let score = 0;
    let suspicious = false;
    if (recentCount >= threshold * 2) {
      score += this.config.scoring.burstBase * 2;
      flags.push(`extreme_burst:${recentCount}/${windowMs}ms`);
      suspicious = true;
    } else if (recentCount >= threshold) {
      score += this.config.scoring.burstBase;
      flags.push(`burst:${recentCount}/${windowMs}ms`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      recentCount,
    };
  }

  detectHumanBehavior(pixels) {
    if (pixels.length < 15) {
      return { isHuman: false, confidence: 0, indicators: [] };
    }
    const intervals = [];
    for (let i = 1; i < pixels.length; i += 1) {
      const interval = pixels[i].timestamp - pixels[i - 1].timestamp;
      if (interval > 0) {
        intervals.push(interval);
      }
    }
    if (intervals.length < 10) {
      return { isHuman: false, confidence: 0, indicators: [] };
    }
    const indicators = [];
    let humanScore = 0;
    let sum = 0;
    for (const i of intervals) sum += i;
    const avgInterval = sum / intervals.length;
    let varSum = 0;
    for (const i of intervals) varSum += (i - avgInterval) ** 2;
    const variance = varSum / intervals.length;
    if (variance >= this.config.humanBehavior.minNaturalVariance) {
      humanScore += 25;
      indicators.push('natural_variance');
    }
    let pauseCount = 0;
    for (const interval of intervals) {
      if (interval >= this.config.humanBehavior.naturalPauseThreshold) {
        pauseCount += 1;
      }
    }
    const pauseRatio = pauseCount / intervals.length;
    if (pauseRatio >= this.config.humanBehavior.minPauseRatio) {
      humanScore += 20;
      indicators.push('natural_pauses');
    }
    const stdDev = Math.sqrt(variance);
    const cv = avgInterval > 0 ? (stdDev / avgInterval) * 100 : 0;
    const [minCV, maxCV] = this.config.humanBehavior.expectedCVRange;
    if (cv >= minCV && cv <= maxCV) {
      humanScore += 20;
      indicators.push('human_cv_range');
    }
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
    const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    if (iqr > 200) {
      humanScore += 15;
      indicators.push('wide_iqr');
    }
    let directionChanges = 0;
    for (let i = 2; i < pixels.length; i += 1) {
      const dx1 = pixels[i - 1].x - pixels[i - 2].x;
      const dy1 = pixels[i - 1].y - pixels[i - 2].y;
      const dx2 = pixels[i].x - pixels[i - 1].x;
      const dy2 = pixels[i].y - pixels[i - 1].y;
      if ((dx1 * dx2 < 0) || (dy1 * dy2 < 0)) {
        directionChanges += 1;
      }
    }
    const changeRatio = directionChanges / (pixels.length - 2);
    if (changeRatio > 0.3) {
      humanScore += 20;
      indicators.push('direction_changes');
    }
    const isHuman = humanScore >= 50;
    const confidence = Math.min(humanScore, 100);
    return {
      isHuman,
      confidence,
      indicators,
      variance,
      pauseRatio,
      cv,
      iqr,
      directionChangeRatio: changeRatio,
    };
  }

  analyzeGeometricPatterns(pixels) {
    const minLength = this.config.geometric.minLineLength;
    if (pixels.length < minLength) {
      return { suspicious: false, score: 0, flags: [], hasLine: false, hasCircle: false, hasRectangle: false, hasGrid: false };
    }
    const recentPixels = pixels.slice(-Math.min(pixels.length, 150));
    const lineResult = this.detectPerfectLines(recentPixels);
    const rectangleResult = this.detectRectangles(recentPixels);
    const gridResult = this.detectGridPattern(recentPixels);
    let circleResult = { found: false };
    if (!lineResult.found && !rectangleResult.found && !gridResult.found) {
      circleResult = this.detectPerfectCircles(recentPixels);
    }
    const flags = [];
    let score = 0;
    let suspicious = false;
    if (lineResult.found) {
      score += this.config.scoring.perfectLineBase;
      if (lineResult.length >= this.config.geometric.perfectLineThreshold) {
        score += 12;
        flags.push(`perfect_line:${lineResult.length}px,${lineResult.direction}`);
      } else {
        flags.push(`line:${lineResult.length}px,${lineResult.direction}`);
      }
      suspicious = true;
    }
    if (rectangleResult.found) {
      score += this.config.scoring.rectangleBase;
      flags.push(`rectangle:${rectangleResult.width}x${rectangleResult.height}`);
      suspicious = true;
    }
    if (gridResult.found) {
      score += this.config.scoring.gridBase;
      flags.push(`grid:${gridResult.cols}x${gridResult.rows}`);
      suspicious = true;
    }
    if (circleResult.found) {
      score += this.config.scoring.perfectCircleBase;
      flags.push(`circle:r=${circleResult.radius},n=${circleResult.pointCount}`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      hasLine: lineResult.found,
      hasCircle: circleResult.found,
      hasRectangle: rectangleResult.found,
      hasGrid: gridResult.found,
      lineDetails: lineResult,
      circleDetails: circleResult,
      rectangleDetails: rectangleResult,
      gridDetails: gridResult,
    };
  }

  detectPerfectLines(pixels) {
    const minLength = this.config.geometric.minLineLength;
    const maxDeviation = this.config.geometric.maxDeviationPixels;
    let longestLine = { found: false, length: 0, direction: null, startX: 0, startY: 0 };
    const directions = [
      { dx: 1, dy: 0, name: 'horizontal' },
      { dx: -1, dy: 0, name: 'horizontal' },
      { dx: 0, dy: 1, name: 'vertical' },
      { dx: 0, dy: -1, name: 'vertical' },
      { dx: 1, dy: 1, name: 'diagonal' },
      { dx: -1, dy: -1, name: 'diagonal' },
      { dx: 1, dy: -1, name: 'antidiag' },
      { dx: -1, dy: 1, name: 'antidiag' },
    ];
    for (const dir of directions) {
      let currentLength = 1;
      let startIdx = 0;
      for (let i = 1; i < pixels.length; i += 1) {
        const prev = pixels[i - 1];
        const curr = pixels[i];
        const expectedX = prev.x + dir.dx;
        const expectedY = prev.y + dir.dy;
        const deviationX = Math.abs(curr.x - expectedX);
        const deviationY = Math.abs(curr.y - expectedY);
        if (deviationX <= maxDeviation && deviationY <= maxDeviation) {
          currentLength += 1;
        } else {
          if (currentLength >= minLength && currentLength > longestLine.length) {
            longestLine = {
              found: true,
              length: currentLength,
              direction: dir.name,
              startX: pixels[startIdx].x,
              startY: pixels[startIdx].y,
            };
          }
          currentLength = 1;
          startIdx = i;
        }
      }
      if (currentLength >= minLength && currentLength > longestLine.length) {
        longestLine = {
          found: true,
          length: currentLength,
          direction: dir.name,
          startX: pixels[startIdx].x,
          startY: pixels[startIdx].y,
        };
      }
    }
    return longestLine;
  }

  detectRectangles(pixels) {
    const minSize = this.config.geometric.rectangleMinSize;
    if (pixels.length < minSize * 2) {
      return { found: false };
    }
    const recentPixels = pixels.slice(-80);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of recentPixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (width < minSize || height < minSize) {
      return { found: false };
    }
    let edgePixels = 0;
    for (const p of recentPixels) {
      const onEdge = p.x === minX || p.x === maxX || p.y === minY || p.y === maxY;
      if (onEdge) edgePixels += 1;
    }
    const expectedEdgePixels = 2 * (width + height) - 4;
    const edgeRatio = edgePixels / recentPixels.length;
    if (edgeRatio > 0.65 && edgePixels >= expectedEdgePixels * 0.4) {
      return {
        found: true,
        width,
        height,
        edgePixels,
        edgeRatio,
      };
    }
    return { found: false };
  }

  detectGridPattern(pixels) {
    const minSize = this.config.geometric.gridDetectionMinSize;
    if (pixels.length < minSize) {
      return { found: false };
    }
    const recentPixels = pixels.slice(-60);
    const xCoords = new Map();
    const yCoords = new Map();
    for (const p of recentPixels) {
      xCoords.set(p.x, (xCoords.get(p.x) || 0) + 1);
      yCoords.set(p.y, (yCoords.get(p.y) || 0) + 1);
    }
    const xValues = Array.from(xCoords.keys()).sort((a, b) => a - b);
    const yValues = Array.from(yCoords.keys()).sort((a, b) => a - b);
    if (xValues.length < 3 || yValues.length < 3) {
      return { found: false };
    }
    const xSpacings = [];
    for (let i = 1; i < xValues.length; i += 1) {
      xSpacings.push(xValues[i] - xValues[i - 1]);
    }
    const ySpacings = [];
    for (let i = 1; i < yValues.length; i += 1) {
      ySpacings.push(yValues[i] - yValues[i - 1]);
    }
    const isUniformSpacing = (spacings) => {
      if (spacings.length < 2) return false;
      const first = spacings[0];
      if (first === 0) return false;
      let uniform = true;
      for (const s of spacings) {
        if (Math.abs(s - first) > 1) {
          uniform = false;
          break;
        }
      }
      return uniform;
    };
    if (isUniformSpacing(xSpacings) && isUniformSpacing(ySpacings)) {
      return {
        found: true,
        cols: xValues.length,
        rows: yValues.length,
        xSpacing: xSpacings[0],
        ySpacing: ySpacings[0],
      };
    }
    return { found: false };
  }

  detectPerfectCircles(pixels) {
    const minPoints = this.config.geometric.circleMinPoints;
    const maxRadiusError = this.config.geometric.circleMaxRadiusError;
    if (pixels.length < minPoints) {
      return { found: false };
    }
    const step = Math.max(1, Math.floor(pixels.length / 4));
    for (let windowStart = 0; windowStart <= pixels.length - minPoints; windowStart += step) {
      const windowEnd = Math.min(windowStart + minPoints * 2, pixels.length);
      const windowPixels = pixels.slice(windowStart, windowEnd);
      if (windowPixels.length < minPoints) continue;
      let centerX = 0;
      let centerY = 0;
      for (const p of windowPixels) {
        centerX += p.x;
        centerY += p.y;
      }
      centerX /= windowPixels.length;
      centerY /= windowPixels.length;
      let totalDist = 0;
      for (const p of windowPixels) {
        totalDist += Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2);
      }
      const avgRadius = totalDist / windowPixels.length;
      if (avgRadius < 4) continue;
      let varianceSum = 0;
      for (const p of windowPixels) {
        const dist = Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2);
        varianceSum += (dist - avgRadius) ** 2;
      }
      const radiusStdDev = Math.sqrt(varianceSum / windowPixels.length);
      if (radiusStdDev <= maxRadiusError) {
        return {
          found: true,
          centerX: Math.round(centerX),
          centerY: Math.round(centerY),
          radius: Math.round(avgRadius),
          pointCount: windowPixels.length,
          radiusStdDev,
        };
      }
    }
    return { found: false };
  }

  analyzeSpatialClustering(pixels) {
    if (pixels.length < 20) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const recentPixels = pixels.slice(-60);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of recentPixels) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const area = width * height;
    if (area === 0) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const density = recentPixels.length / area;
    const flags = [];
    let score = 0;
    let suspicious = false;
    if (density >= this.config.geometric.clusterMinDensity && area >= 25) {
      score += this.config.scoring.spatialClusterBase;
      flags.push(`dense_cluster:${(density * 100).toFixed(0)}%,area=${area}`);
      suspicious = true;
    }
    const uniquePositions = new Set();
    for (const p of recentPixels) {
      uniquePositions.add(`${p.x},${p.y}`);
    }
    const overlapRatio = 1 - (uniquePositions.size / recentPixels.length);
    if (overlapRatio > 0.3 && recentPixels.length >= 30) {
      score += 8;
      flags.push(`position_overlap:${(overlapRatio * 100).toFixed(0)}%`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      density,
      area,
      overlapRatio,
    };
  }

  analyzeColorPatterns(pixels) {
    if (pixels.length < 15) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const recentPixels = pixels.slice(-50).filter((p) => p.color >= 0);
    if (recentPixels.length < 10) {
      return { suspicious: false, score: 0, flags: [] };
    }
    const colorCounts = new Map();
    for (const p of recentPixels) {
      colorCounts.set(p.color, (colorCounts.get(p.color) || 0) + 1);
    }
    let maxCount = 0;
    for (const count of colorCounts.values()) {
      if (count > maxCount) maxCount = count;
    }
    const dominantRatio = maxCount / recentPixels.length;
    let colorEntropy = 0;
    for (const count of colorCounts.values()) {
      const p = count / recentPixels.length;
      if (p > 0) {
        colorEntropy -= p * Math.log2(p);
      }
    }
    const flags = [];
    let score = 0;
    let suspicious = false;
    if (dominantRatio >= this.config.color.singleColorThreshold && recentPixels.length >= 20) {
      score += this.config.scoring.colorPatternBase;
      flags.push(`single_color:${(dominantRatio * 100).toFixed(0)}%`);
      suspicious = true;
    }
    if (colorEntropy < this.config.color.lowEntropyThreshold && recentPixels.length >= 25) {
      score += 6;
      flags.push(`low_color_entropy:${colorEntropy.toFixed(2)}`);
      suspicious = true;
    }
    let sequentialCount = 1;
    let maxSequential = 1;
    for (let i = 1; i < recentPixels.length; i += 1) {
      if (recentPixels[i].color === recentPixels[i - 1].color) {
        sequentialCount += 1;
        if (sequentialCount > maxSequential) {
          maxSequential = sequentialCount;
        }
      } else {
        sequentialCount = 1;
      }
    }
    if (maxSequential >= this.config.color.sequentialPatternLength) {
      score += 5;
      flags.push(`sequential_color:${maxSequential}`);
      suspicious = true;
    }
    return {
      suspicious,
      score: Math.floor(score),
      flags,
      dominantRatio,
      colorEntropy,
      uniqueColors: colorCounts.size,
      maxSequential,
    };
  }

  getLevel(score) {
    if (score >= this.config.scoring.highThreshold) return SUSPICION_LEVEL.HIGH;
    if (score >= this.config.scoring.mediumThreshold) return SUSPICION_LEVEL.MEDIUM;
    if (score >= this.config.scoring.lowThreshold) return SUSPICION_LEVEL.LOW;
    return null;
  }

  async handleDetection(key, history, score, level, detectionTypes, details) {
    const now = Date.now();
    const lastWrite = this.dbWriteCooldown.get(key) || 0;
    if (now - lastWrite < this.config.limits.dbWriteCooldownMs) {
      const cached = this.detectionCache.get(key);
      if (cached && cached.score >= score) {
        return;
      }
      this.detectionCache.set(key, { score, level, timestamp: now });
      return;
    }
    const { userId, ipString, iid, canvasId } = history;
    const pixels = history.pixels.toArray();
    try {
      const existing = await getPendingDetectionForUser(userId, ipString);
      if (existing && existing.score >= score) {
        return;
      }
    } catch (error) {
      logger.error(`BOT_DETECTION: DB check failed: ${error.message}`);
      return;
    }
    const lastPixel = pixels[pixels.length - 1];
    const detectionType = detectionTypes.length > 1
      ? DETECTION_TYPE.COMBINED
      : (detectionTypes[0] || DETECTION_TYPE.TIMING_ANOMALY);
    try {
      const record = await createBotDetection({
        uid: userId,
        ipString,
        iid,
        canvasId,
        score,
        level,
        detectionType,
        detectionDetails: {
          flags: history.detectionFlags,
          timing: details.timing.suspicious ? {
            avgInterval: details.timing.avgInterval,
            variance: details.timing.variance,
            cv: details.timing.coefficientOfVariation,
            iqr: details.timing.iqr,
            sampleSize: details.timing.sampleSize,
          } : null,
          entropy: details.entropy.suspicious ? {
            value: details.entropy.entropy,
            normalized: details.entropy.normalizedEntropy,
          } : null,
          acceleration: details.acceleration.suspicious ? {
            avgAbsAccel: details.acceleration.avgAbsAccel,
          } : null,
          burst: details.burst.suspicious ? {
            count: details.burst.recentCount,
          } : null,
          geometric: {
            hasLine: details.geometric.hasLine,
            hasCircle: details.geometric.hasCircle,
            hasRectangle: details.geometric.hasRectangle,
            hasGrid: details.geometric.hasGrid,
            lineDetails: details.geometric.lineDetails?.found ? {
              length: details.geometric.lineDetails.length,
              direction: details.geometric.lineDetails.direction,
            } : null,
            gridDetails: details.geometric.gridDetails?.found ? {
              cols: details.geometric.gridDetails.cols,
              rows: details.geometric.gridDetails.rows,
            } : null,
          },
          spatial: details.spatial.suspicious ? {
            density: details.spatial.density,
            area: details.spatial.area,
          } : null,
          color: details.color.suspicious ? {
            dominantRatio: details.color.dominantRatio,
            entropy: details.color.colorEntropy,
          } : null,
          human: {
            isHuman: details.human.isHuman,
            confidence: details.human.confidence,
            indicators: details.human.indicators,
          },
          pixelCount: pixels.length,
          peakScore: history.peakScore,
          analysisCount: history.analysisCount,
          sessionDuration: now - history.sessionStart,
        },
        locationX: lastPixel?.x,
        locationY: lastPixel?.y,
      });
      if (record) {
        this.stats.totalDetections += 1;
        this.dbWriteCooldown.set(key, now);
        this.detectionCache.delete(key);
        logger.warn(
          `BOT_DETECTION: ${level.toUpperCase()} | ${userId || 'anon'} | ${ipString} | Score: ${score} | Type: ${detectionType} | Flags: ${history.detectionFlags.length}`,
        );
        if (score >= this.config.recording.triggerThreshold) {
          this.triggerRecording(record.id, history);
        }
      }
    } catch (error) {
      logger.error(`BOT_DETECTION: Create failed: ${error.message}`);
    }
  }

  triggerRecording(detectionId, history) {
    const key = this.getKey(history.userId, history.ipString);
    if (!key || this.activeRecordings.has(key)) {
      return;
    }
    if (this.activeRecordings.size >= this.config.limits.maxActiveRecordings) {
      logger.warn('BOT_DETECTION: Max recordings reached');
      return;
    }
    const pixels = history.pixels.toArray();
    const lastPixel = pixels[pixels.length - 1];
    const recorder = getBotDetectionRecorder();
    const recording = recorder.startRecording(
      detectionId,
      history.canvasId,
      lastPixel?.x || 0,
      lastPixel?.y || 0,
      this.config.recording.zoomLevel,
    );
    if (!recording) {
      logger.warn(`BOT_DETECTION: Failed to start recording ${detectionId}`);
      return;
    }
    recorder.addFrame(detectionId, {
      type: 'init',
      pixels: pixels.slice(-50).map((p) => ({ x: p.x, y: p.y, color: p.color, ts: p.timestamp })),
      score: history.currentScore,
      flags: history.detectionFlags,
    });
    this.activeRecordings.set(key, { detectionId, recorder });
    logger.info(`BOT_DETECTION: Recording ${detectionId} started at (${lastPixel?.x}, ${lastPixel?.y})`);
    setTimeout(() => {
      this.stopRecording(key);
    }, this.config.recording.maxDurationMs);
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
        logger.info(`BOT_DETECTION: Recording ${recordingInfo.detectionId} saved to ${filepath}`);
      }
    } catch (error) {
      logger.error(`BOT_DETECTION: Recording stop failed: ${error.message}`);
    }
  }

  getRecordingInfo(userId, ipString) {
    const key = this.getKey(userId, ipString);
    return key ? this.activeRecordings.get(key) || null : null;
  }

  getUserAnalysis(userId, ipString) {
    const key = this.getKey(userId, ipString);
    if (!key) return null;
    const history = this.userPixelHistory.get(key);
    if (!history) return null;
    return {
      pixelCount: history.pixels.size(),
      currentScore: history.currentScore,
      peakScore: history.peakScore,
      flags: history.detectionFlags,
      lastActivity: history.lastActivity,
      analysisCount: history.analysisCount,
      suspiciousStreak: history.suspiciousStreak,
      humanIndicators: history.humanIndicators,
      sessionDuration: Date.now() - history.sessionStart,
    };
  }

  getStats() {
    return {
      ...this.stats,
      activeUsers: this.userPixelHistory.size,
      activeRecordings: this.activeRecordings.size,
      throttledUsers: this.analysisThrottle.size,
      cachedDetections: this.detectionCache.size,
    };
  }

  updateConfig(newConfig) {
    this.config = this.mergeConfig(this.config, newConfig);
    this.rateLimiter = new RateLimiter(this.config.limits.maxAnalysisPerSecond);
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.userPixelHistory.clear();
    this.activeRecordings.clear();
    this.analysisThrottle.clear();
    this.dbWriteCooldown.clear();
    this.detectionCache.clear();
    this.sessionFingerprints.clear();
    logger.info('BOT_DETECTION: Shutdown complete');
  }
}

let instance = null;

export function getBotDetectionService(config) {
  if (!instance) {
    instance = new BotDetectionService(config);
  }
  return instance;
}

export function resetBotDetectionService() {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}

export default BotDetectionService;
