const SUSPICIOUS_THRESHOLD = 30;
const HIGH_RISK_THRESHOLD = 50;
const BLOCK_THRESHOLD = 75;

const RATE_LIMITS = {
  normal: { requests: 100, window: 60000 },
  suspicious: { requests: 20, window: 60000 },
  highRisk: { requests: 5, window: 60000 },
  blocked: { requests: 0, window: 60000 },
};

class ProxyRateLimiter {
  constructor(logger) {
    this.logger = logger || console;
    this.ipData = new Map();
    this.blockedIPs = new Set();
    this.suspiciousIPs = new Map();
    setInterval(() => this.cleanup(), 60000);
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 300000;
    for (const [ip, data] of this.ipData) {
      if (now - data.lastRequest > maxAge) {
        this.ipData.delete(ip);
      }
    }
    for (const [ip, ts] of this.suspiciousIPs) {
      if (now - ts > 3600000) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  getRateLimit(riskScore) {
    if (riskScore >= BLOCK_THRESHOLD) return RATE_LIMITS.blocked;
    if (riskScore >= HIGH_RISK_THRESHOLD) return RATE_LIMITS.highRisk;
    if (riskScore >= SUSPICIOUS_THRESHOLD) return RATE_LIMITS.suspicious;
    return RATE_LIMITS.normal;
  }

  recordRequest(ip, riskScore = 0) {
    const now = Date.now();
    let data = this.ipData.get(ip);

    if (!data) {
      data = {
        requests: [],
        riskScore,
        lastRequest: now,
        violations: 0,
      };
      this.ipData.set(ip, data);
    }

    data.riskScore = Math.max(data.riskScore, riskScore);
    data.lastRequest = now;

    const limit = this.getRateLimit(data.riskScore);
    const windowStart = now - limit.window;
    data.requests = data.requests.filter((ts) => ts > windowStart);
    data.requests.push(now);

    if (data.requests.length > limit.requests) {
      data.violations += 1;
      if (data.violations >= 3) {
        this.blockedIPs.add(ip);
        this.logger.warn(`IP ${ip} blocked due to rate limit violations (score: ${data.riskScore})`);
      }
      return false;
    }

    return true;
  }

  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }

  markSuspicious(ip, reason) {
    this.suspiciousIPs.set(ip, Date.now());
    const data = this.ipData.get(ip);
    if (data) {
      data.riskScore = Math.max(data.riskScore, SUSPICIOUS_THRESHOLD);
    }
    this.logger.info(`IP ${ip} marked suspicious: ${reason}`);
  }

  getRiskScore(ip) {
    const data = this.ipData.get(ip);
    return data?.riskScore || 0;
  }

  getStats(ip) {
    const data = this.ipData.get(ip);
    if (!data) return null;
    const limit = this.getRateLimit(data.riskScore);
    return {
      riskScore: data.riskScore,
      requestsInWindow: data.requests.length,
      maxRequests: limit.requests,
      violations: data.violations,
      isBlocked: this.blockedIPs.has(ip),
    };
  }

  unblock(ip) {
    this.blockedIPs.delete(ip);
    const data = this.ipData.get(ip);
    if (data) {
      data.violations = 0;
    }
  }
}

let instance = null;

export function getProxyRateLimiter(logger) {
  if (!instance) {
    instance = new ProxyRateLimiter(logger);
  }
  return instance;
}

export default ProxyRateLimiter;
