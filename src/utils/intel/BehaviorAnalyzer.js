const PIXEL_RATE_THRESHOLD = 50;
const CONNECTION_SWITCH_THRESHOLD = 5;
const RAPID_RECONNECT_THRESHOLD = 10;
const ANALYSIS_WINDOW = 300000;

class BehaviorAnalyzer {
  constructor(logger) {
    this.logger = logger || console;
    this.ipBehavior = new Map();
    this.userBehavior = new Map();
    this.connectionPatterns = new Map();
    this.suspiciousIPs = new Set();
    setInterval(() => this.cleanup(), 60000);
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 600000;
    for (const [key, data] of this.ipBehavior) {
      if (now - data.lastActivity > maxAge) {
        this.ipBehavior.delete(key);
      }
    }
    for (const [key, data] of this.userBehavior) {
      if (now - data.lastActivity > maxAge) {
        this.userBehavior.delete(key);
      }
    }
    for (const [key, data] of this.connectionPatterns) {
      if (now - data.lastSeen > maxAge) {
        this.connectionPatterns.delete(key);
      }
    }
  }

  recordPixelPlacement(ip, userId, canvasId) {
    const now = Date.now();
    const key = `${ip}:${userId || 'anon'}`;

    let data = this.ipBehavior.get(key);
    if (!data) {
      data = {
        pixelPlacements: [],
        connections: [],
        canvases: new Set(),
        lastActivity: now,
        suspicionScore: 0,
      };
      this.ipBehavior.set(key, data);
    }

    data.pixelPlacements.push(now);
    data.canvases.add(canvasId);
    data.lastActivity = now;

    const windowStart = now - ANALYSIS_WINDOW;
    data.pixelPlacements = data.pixelPlacements.filter((ts) => ts > windowStart);

    return this.analyzePixelPattern(key, data);
  }

  analyzePixelPattern(key, data) {
    const flags = [];
    let score = 0;

    if (data.pixelPlacements.length >= PIXEL_RATE_THRESHOLD) {
      score += 30;
      flags.push(`high_pixel_rate:${data.pixelPlacements.length}`);
    }

    if (data.pixelPlacements.length >= 10) {
      const intervals = [];
      for (let i = 1; i < data.pixelPlacements.length; i += 1) {
        intervals.push(data.pixelPlacements[i] - data.pixelPlacements[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, i) => sum + (i - avgInterval) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev < 100 && avgInterval < 2000) {
        score += 50;
        flags.push('bot_like_timing');
      }

      if (avgInterval < 500) {
        score += 40;
        flags.push('inhuman_speed');
      }
    }

    if (data.canvases.size > 5) {
      score += 20;
      flags.push(`multi_canvas:${data.canvases.size}`);
    }

    data.suspicionScore = Math.max(data.suspicionScore, score);

    if (score >= 50) {
      const ip = key.split(':')[0];
      this.suspiciousIPs.add(ip);
      this.logger.warn(`Suspicious behavior detected: ${key} | Score: ${score} | Flags: ${flags.join(', ')}`);
    }

    return { score, flags };
  }

  recordConnection(ip, userId, userAgent) {
    const now = Date.now();

    let pattern = this.connectionPatterns.get(ip);
    if (!pattern) {
      pattern = {
        connections: [],
        userAgents: new Set(),
        userIds: new Set(),
        lastSeen: now,
        reconnects: 0,
      };
      this.connectionPatterns.set(ip, pattern);
    }

    pattern.connections.push(now);
    if (userAgent) pattern.userAgents.add(userAgent);
    if (userId) pattern.userIds.add(userId);
    pattern.lastSeen = now;

    const windowStart = now - ANALYSIS_WINDOW;
    pattern.connections = pattern.connections.filter((ts) => ts > windowStart);

    return this.analyzeConnectionPattern(ip, pattern);
  }

  analyzeConnectionPattern(ip, pattern) {
    const flags = [];
    let score = 0;

    if (pattern.connections.length >= RAPID_RECONNECT_THRESHOLD) {
      score += 30;
      flags.push(`rapid_reconnect:${pattern.connections.length}`);
    }

    if (pattern.userAgents.size >= 3) {
      score += 25;
      flags.push(`multiple_user_agents:${pattern.userAgents.size}`);
    }

    if (pattern.userIds.size >= CONNECTION_SWITCH_THRESHOLD) {
      score += 40;
      flags.push(`account_switching:${pattern.userIds.size}`);
    }

    if (pattern.connections.length >= 5) {
      const intervals = [];
      for (let i = 1; i < pattern.connections.length; i += 1) {
        intervals.push(pattern.connections[i] - pattern.connections[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 5000) {
        score += 35;
        flags.push('connection_cycling');
      }
    }

    if (score >= 40) {
      this.suspiciousIPs.add(ip);
      this.logger.warn(`Suspicious connection pattern: ${ip} | Score: ${score} | Flags: ${flags.join(', ')}`);
    }

    return { score, flags };
  }

  recordIPChange(userId, oldIP, newIP) {
    const now = Date.now();

    let userData = this.userBehavior.get(userId);
    if (!userData) {
      userData = {
        ipChanges: [],
        ips: new Set(),
        lastActivity: now,
      };
      this.userBehavior.set(userId, userData);
    }

    userData.ipChanges.push({ ts: now, from: oldIP, to: newIP });
    userData.ips.add(oldIP);
    userData.ips.add(newIP);
    userData.lastActivity = now;

    const windowStart = now - ANALYSIS_WINDOW;
    userData.ipChanges = userData.ipChanges.filter((c) => c.ts > windowStart);

    return this.analyzeIPChanges(userId, userData);
  }

  analyzeIPChanges(userId, userData) {
    const flags = [];
    let score = 0;

    if (userData.ipChanges.length >= 3) {
      score += 30;
      flags.push(`frequent_ip_changes:${userData.ipChanges.length}`);
    }

    if (userData.ips.size >= 5) {
      score += 40;
      flags.push(`many_ips:${userData.ips.size}`);
    }

    if (userData.ipChanges.length >= 2) {
      const intervals = [];
      for (let i = 1; i < userData.ipChanges.length; i += 1) {
        intervals.push(userData.ipChanges[i].ts - userData.ipChanges[i - 1].ts);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 60000) {
        score += 50;
        flags.push('rapid_ip_rotation');
      }
    }

    if (score >= 50) {
      for (const ip of userData.ips) {
        this.suspiciousIPs.add(ip);
      }
      this.logger.warn(`Suspicious IP rotation for user ${userId} | Score: ${score} | Flags: ${flags.join(', ')}`);
    }

    return { score, flags };
  }

  isSuspicious(ip) {
    return this.suspiciousIPs.has(ip);
  }

  getSuspicionScore(ip) {
    for (const [key, data] of this.ipBehavior) {
      if (key.startsWith(`${ip}:`)) {
        return data.suspicionScore;
      }
    }
    return 0;
  }

  getStats(ip) {
    const pattern = this.connectionPatterns.get(ip);
    const behaviors = [];
    for (const [key, data] of this.ipBehavior) {
      if (key.startsWith(`${ip}:`)) {
        behaviors.push(data);
      }
    }
    return {
      isSuspicious: this.suspiciousIPs.has(ip),
      connectionPattern: pattern || null,
      behaviors,
    };
  }
}

let instance = null;

export function getBehaviorAnalyzer(logger) {
  if (!instance) {
    instance = new BehaviorAnalyzer(logger);
  }
  return instance;
}

export default BehaviorAnalyzer;
