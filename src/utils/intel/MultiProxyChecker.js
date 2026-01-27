import https from 'https';
import http from 'http';
import dns from 'dns';
import { promisify } from 'util';

import {
  isDatacenterASN, isVPNProviderASN, isTorExitASN, isProxyProviderASN,
  getASNRiskScore,
} from './ASNBlacklist.js';
import { getTorExitNodeUpdater } from './TorExitNodeUpdater.js';

const dnsReverse = promisify(dns.reverse);

const DATACENTER_ASNS = new Set([
  14061, 16276, 20473, 24940, 36352, 46664, 63949, 14618, 16509, 15169,
  8075, 13335, 32934, 19551, 22612, 30633, 36351, 53667, 54825, 55286,
  62041, 63018, 197540, 202425, 206264, 209, 396982, 45102, 9009, 51167,
  60781, 51396, 62563, 50304, 44901, 47583, 49981, 51852, 60068, 60404,
  61317, 62217, 132203, 133752, 135377, 136787, 138915, 139190, 141995,
  142111, 147049, 200019, 201011, 202053, 203020, 204957, 206092, 206898,
  208323, 209588, 210558, 212238, 212815, 213230, 213371, 394380, 395954,
  396356, 397423, 398101, 398465, 399077, 399629, 400328,
]);

const VPN_KEYWORDS = [
  'vpn', 'proxy', 'hosting', 'server', 'cloud', 'vps', 'dedicated',
  'colocation', 'datacenter', 'data center', 'hetzner', 'ovh', 'digitalocean',
  'linode', 'vultr', 'amazon', 'google', 'microsoft', 'azure', 'aws',
  'cloudflare', 'akamai', 'fastly', 'leaseweb', 'choopa', 'contabo',
  'scaleway', 'upcloud', 'kamatera', 'hostinger', 'ionos', 'aruba',
  'nord', 'express', 'surfshark', 'cyberghost', 'private internet',
  'mullvad', 'proton', 'windscribe', 'tunnelbear', 'hotspot shield',
  'hide.me', 'ipvanish', 'purevpn', 'torguard', 'astrill', 'vypr',
];

const TOR_EXIT_PORTS = [9001, 9030, 9050, 9051, 9150];

const PROXY_PORTS = [1080, 3128, 8080, 8118, 8888, 9050, 9051, 9150, 1081, 1082, 1083, 1084, 1085];

const SUSPICIOUS_PTR_KEYWORDS = [
  'vpn', 'proxy', 'tor', 'exit', 'node', 'relay', 'guard', 'bridge',
  'server', 'vps', 'cloud', 'dedicated', 'colo', 'hosting', 'host',
  'datacenter', 'data-center', 'dc-', '-dc', 'srv', 'node-', '-node',
  'static', 'dynamic', 'pool', 'dhcp', 'ppp', 'dsl', 'cable', 'fiber',
  'residential', 'business', 'enterprise', 'corporate',
  'amazon', 'aws', 'ec2', 'google', 'gcp', 'azure', 'microsoft',
  'digitalocean', 'linode', 'vultr', 'ovh', 'hetzner', 'contabo',
  'scaleway', 'upcloud', 'kamatera', 'choopa', 'leaseweb',
  'mullvad', 'nordvpn', 'expressvpn', 'surfshark', 'cyberghost',
  'protonvpn', 'windscribe', 'ipvanish', 'purevpn', 'torguard',
];

const RESIDENTIAL_ISP_KEYWORDS = [
  'comcast', 'verizon', 'at&t', 'att.net', 'spectrum', 'cox', 'charter',
  'centurylink', 'frontier', 'windstream', 'mediacom', 'suddenlink',
  'orange', 'sfr', 'free', 'bouygues', 'vodafone', 'telefonica', 'movistar',
  'deutsche telekom', 'telekom', 'bt.com', 'virgin media', 'sky broadband',
  'rogers', 'bell', 'telus', 'shaw', 'videotron', 'cogeco',
  'optus', 'telstra', 'tpg', 'iinet', 'internode',
];

const SUSPICIOUS_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255', reason: 'private_range' },
  { start: '172.16.0.0', end: '172.31.255.255', reason: 'private_range' },
  { start: '192.168.0.0', end: '192.168.255.255', reason: 'private_range' },
  { start: '100.64.0.0', end: '100.127.255.255', reason: 'cgnat_range' },
];

const BLOCKED_SUBNETS = new Set([
  '185.220.100', '185.220.101', '185.220.102', '185.220.103',
  '185.56.80', '185.107.47', '185.129.61', '185.130.44',
  '193.218.118', '198.98.48', '198.98.49', '198.98.50',
  '199.249.230', '204.8.156', '209.127.17', '209.141.32',
  '209.141.33', '209.141.34', '209.141.35', '209.141.36',
  '23.128.248', '23.129.64', '45.33.32', '45.33.33',
  '45.79.0', '45.79.1', '51.15.0', '51.15.1',
  '62.102.148', '62.210.0', '62.210.1', '66.70.228',
  '77.247.181', '78.142.19', '81.17.18', '85.93.20',
  '89.234.157', '91.121.0', '91.121.1', '91.219.236',
  '94.23.0', '94.23.1', '95.128.43', '95.211.0',
  '104.244.72', '104.244.73', '104.244.74', '104.244.75',
  '104.244.76', '104.244.77', '104.244.78', '104.244.79',
  '107.189.0', '107.189.1', '107.189.2', '107.189.3',
  '109.70.100', '109.201.133', '128.31.0', '131.188.40',
  '162.247.72', '162.247.73', '162.247.74', '171.25.193',
  '176.10.99', '176.10.104', '178.17.170', '178.17.171',
  '178.20.55', '179.43.128', '185.100.84', '185.100.85',
  '185.100.86', '185.100.87', '185.117.82', '185.129.62',
  '185.165.168', '185.165.169', '185.220.0', '185.220.1',
]);

class MultiProxyChecker {
  constructor(proxyCheckKey, logger) {
    this.proxyCheckKey = proxyCheckKey;
    this.logger = logger || console;
    this.checkIp = this.checkIp.bind(this);
    this.pendingChecks = new Map();
    this.recentIPs = new Map();
    this.suspiciousPatterns = new Map();
    this.torUpdater = getTorExitNodeUpdater(this.logger);
    setInterval(() => this.cleanupCache(), 3600000);
  }

  cleanupCache() {
    const now = Date.now();
    const maxAge = 24 * 3600 * 1000;
    for (const [ip, ts] of this.recentIPs) {
      if (now - ts > maxAge) this.recentIPs.delete(ip);
    }
    for (const [ip, data] of this.suspiciousPatterns) {
      if (now - data.ts > maxAge) this.suspiciousPatterns.delete(ip);
    }
  }

  async httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const protocol = options.protocol === 'http:' ? http : https;
      const req = protocol.request(options, (res) => {
        const data = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
          try {
            const body = data.join('');
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.setTimeout(10000, () => req.destroy(new Error('Timeout')));
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  async checkProxyCheckIO(ip) {
    if (!this.proxyCheckKey) return null;
    try {
      const result = await this.httpRequest({
        hostname: 'proxycheck.io',
        path: `/v2/${ip}?key=${this.proxyCheckKey}&vpn=3&asn=1&risk=1&port=1&seen=1&days=7&tag=pixuniverse`,
        method: 'GET',
      });
      if (result.status === 'ok' && result[ip]) {
        const data = result[ip];
        return {
          source: 'proxycheck.io',
          isProxy: data.proxy === 'yes',
          risk: parseInt(data.risk, 10) || 0,
          type: data.type || null,
          operator: data.operator?.name || null,
          asn: parseInt(data.asn, 10) || null,
          isocode: data.isocode || null,
          port: data.port || null,
          seen: data.seen || null,
          lastSeen: data['last seen human'] || null,
        };
      }
    } catch (err) {
      this.logger.warn(`proxycheck.io error for ${ip}: ${err.message}`);
    }
    return null;
  }

  async checkIPAPI(ip) {
    try {
      const result = await this.httpRequest({
        hostname: 'ip-api.com',
        path: `/json/${ip}?fields=status,proxy,hosting,mobile,isp,org,as,asname`,
        method: 'GET',
        protocol: 'http:',
      });
      if (result.status === 'success') {
        const asnMatch = result.as?.match(/^AS(\d+)/);
        return {
          source: 'ip-api.com',
          isProxy: result.proxy === true,
          isHosting: result.hosting === true,
          isMobile: result.mobile === true,
          isp: result.isp || null,
          org: result.org || null,
          asn: asnMatch ? parseInt(asnMatch[1], 10) : null,
          asname: result.asname || null,
        };
      }
    } catch (err) {
      this.logger.warn(`ip-api.com error for ${ip}: ${err.message}`);
    }
    return null;
  }

  async checkIPHubIO(ip) {
    try {
      const result = await this.httpRequest({
        hostname: 'v2.api.iphub.info',
        path: `/ip/${ip}`,
        method: 'GET',
        headers: {
          'X-Key': 'free',
        },
      });
      if (result.block !== undefined) {
        return {
          source: 'iphub.info',
          isProxy: result.block === 1,
          isp: result.isp || null,
          asn: result.asn || null,
          countryCode: result.countryCode || null,
        };
      }
    } catch (err) {
      this.logger.warn(`iphub.info error for ${ip}: ${err.message}`);
    }
    return null;
  }

  async checkGetIPIntel(ip) {
    try {
      const result = await this.httpRequest({
        hostname: 'check.getipintel.net',
        path: `/check.php?ip=${ip}&contact=admin@pixuniverse.net&format=json&flags=f`,
        method: 'GET',
      });
      if (result.status === 'success') {
        const probability = parseFloat(result.result);
        return {
          source: 'getipintel.net',
          probability,
          isProxy: probability >= 0.95,
          isLikelyProxy: probability >= 0.80,
        };
      }
    } catch (err) {
      this.logger.warn(`getipintel.net error for ${ip}: ${err.message}`);
    }
    return null;
  }

  async checkIPQualityScore(ip) {
    try {
      const result = await this.httpRequest({
        hostname: 'www.ipqualityscore.com',
        path: `/api/json/ip/free/${ip}`,
        method: 'GET',
      });
      if (result.success) {
        return {
          source: 'ipqualityscore.com',
          isProxy: result.proxy === true,
          isVpn: result.vpn === true,
          isTor: result.tor === true,
          isBot: result.bot_status === true,
          fraudScore: result.fraud_score || 0,
          isp: result.ISP || null,
          asn: result.ASN || null,
          isHosting: result.is_crawler === true,
          recentAbuse: result.recent_abuse === true,
        };
      }
    } catch (err) {
      this.logger.warn(`ipqualityscore.com error for ${ip}: ${err.message}`);
    }
    return null;
  }

  async checkAbuseIPDB(ip) {
    try {
      const result = await this.httpRequest({
        hostname: 'api.abuseipdb.com',
        path: `/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
        method: 'GET',
        headers: {
          Key: 'free',
          Accept: 'application/json',
        },
      });
      if (result.data) {
        return {
          source: 'abuseipdb.com',
          abuseScore: result.data.abuseConfidenceScore || 0,
          isProxy: result.data.abuseConfidenceScore >= 50,
          totalReports: result.data.totalReports || 0,
          isTor: result.data.isTor === true,
          usageType: result.data.usageType || null,
          isp: result.data.isp || null,
          domain: result.data.domain || null,
        };
      }
    } catch (err) {
      this.logger.warn(`abuseipdb.com error for ${ip}: ${err.message}`);
    }
    return null;
  }

  async checkReverseDNS(ip) {
    try {
      const hostnames = await dnsReverse(ip);
      if (hostnames && hostnames.length > 0) {
        const hostname = hostnames[0].toLowerCase();
        let suspiciousScore = 0;
        const flags = [];

        for (const keyword of SUSPICIOUS_PTR_KEYWORDS) {
          if (hostname.includes(keyword)) {
            suspiciousScore += 15;
            flags.push(`ptr:${keyword}`);
          }
        }

        let isResidential = false;
        for (const isp of RESIDENTIAL_ISP_KEYWORDS) {
          if (hostname.includes(isp)) {
            isResidential = true;
            break;
          }
        }

        if (!hostname.includes('.') || hostname.match(/^\d+[.-]\d+[.-]\d+[.-]\d+/)) {
          suspiciousScore += 20;
          flags.push('ptr:numeric');
        }

        if (hostname.includes('static') && !isResidential) {
          suspiciousScore += 10;
          flags.push('ptr:static_non_residential');
        }

        return {
          source: 'reverse_dns',
          hostname,
          isResidential,
          suspiciousScore,
          flags,
          hasPTR: true,
        };
      }
    } catch (err) {
      return {
        source: 'reverse_dns',
        hostname: null,
        isResidential: false,
        suspiciousScore: 25,
        flags: ['no_ptr'],
        hasPTR: false,
      };
    }
    return null;
  }

  async checkOpenPorts(ip) {
    const openPorts = [];
    const checkPort = (port) => new Promise((resolve) => {
      const socket = new (require('net')).Socket();
      socket.setTimeout(2000);
      socket.on('connect', () => {
        openPorts.push(port);
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, ip);
    });

    try {
      await Promise.all(PROXY_PORTS.slice(0, 5).map(checkPort));
    } catch (err) {
      this.logger.warn(`Port check error for ${ip}: ${err.message}`);
    }

    let score = 0;
    const flags = [];
    if (openPorts.length > 0) {
      score = openPorts.length * 20;
      flags.push(...openPorts.map((p) => `open_port:${p}`));
    }

    return {
      source: 'port_scan',
      openPorts,
      score,
      flags,
      isProxy: openPorts.some((p) => PROXY_PORTS.includes(p)),
    };
  }

  async checkSpur(ip) {
    try {
      const result = await this.httpRequest({
        hostname: 'api.spur.us',
        path: `/v2/context/${ip}`,
        method: 'GET',
      });
      if (result) {
        const isAnonymous = result.anonymous === true
          || result.tunnels?.some((t) => ['VPN', 'PROXY', 'TOR'].includes(t.type));
        return {
          source: 'spur.us',
          isProxy: isAnonymous,
          isVpn: result.tunnels?.some((t) => t.type === 'VPN'),
          isTor: result.tunnels?.some((t) => t.type === 'TOR'),
          isResidential: result.client?.type === 'RESIDENTIAL',
          isDatacenter: result.client?.type === 'DATACENTER',
          riskLevel: result.risk?.level || 'unknown',
        };
      }
    } catch (err) {
      this.logger.warn(`spur.us error for ${ip}: ${err.message}`);
    }
    return null;
  }

  analyzeHeuristics(results) {
    let score = 0;
    const flags = [];
    let detectedAsn = null;
    let detectedOrg = null;
    let detectedType = null;

    for (const result of results) {
      if (!result) continue;

      if (result.asn) {
        detectedAsn = result.asn;
        const asnRisk = getASNRiskScore(result.asn);
        if (asnRisk > 0) {
          score += asnRisk;
          if (isTorExitASN(result.asn)) {
            flags.push('tor_exit_asn');
            detectedType = 'TOR';
          } else if (isVPNProviderASN(result.asn)) {
            flags.push('vpn_provider_asn');
            if (!detectedType) detectedType = 'VPN';
          } else if (isProxyProviderASN(result.asn)) {
            flags.push('proxy_provider_asn');
            if (!detectedType) detectedType = 'Proxy';
          } else if (isDatacenterASN(result.asn)) {
            flags.push('datacenter_asn');
            if (!detectedType) detectedType = 'Datacenter';
          }
        }
      }

      if (result.org || result.isp || result.asname) {
        const orgLower = (result.org || result.isp || result.asname || '').toLowerCase();
        detectedOrg = result.org || result.isp || result.asname;
        for (const keyword of VPN_KEYWORDS) {
          if (orgLower.includes(keyword)) {
            score += 25;
            flags.push(`org_keyword:${keyword}`);
            break;
          }
        }
      }

      if (result.isProxy) {
        score += 40;
        flags.push(`proxy:${result.source}`);
      }

      if (result.isVpn) {
        score += 50;
        flags.push(`vpn:${result.source}`);
        detectedType = 'VPN';
      }

      if (result.isTor) {
        score += 100;
        flags.push('tor');
        detectedType = 'TOR';
      }

      if (result.isHosting) {
        score += 35;
        flags.push(`hosting:${result.source}`);
        if (!detectedType) detectedType = 'Hosting';
      }

      if (result.risk && result.risk >= 66) {
        score += Math.min(result.risk - 50, 50);
        flags.push(`high_risk:${result.risk}`);
      }

      if (result.fraudScore && result.fraudScore >= 75) {
        score += Math.min(result.fraudScore - 50, 50);
        flags.push(`fraud_score:${result.fraudScore}`);
      }

      if (result.probability && result.probability >= 0.80) {
        score += Math.floor(result.probability * 40);
        flags.push(`intel_prob:${Math.floor(result.probability * 100)}`);
      }

      if (result.recentAbuse) {
        score += 30;
        flags.push('recent_abuse');
      }

      if (result.type) {
        const typeLower = result.type.toLowerCase();
        if (typeLower.includes('vpn') || typeLower.includes('proxy')
          || typeLower.includes('tor') || typeLower.includes('socks')) {
          score += 40;
          flags.push(`type:${result.type}`);
          detectedType = result.type;
        }
      }

      if (result.port) {
        if (TOR_EXIT_PORTS.includes(result.port)) {
          score += 50;
          flags.push(`tor_port:${result.port}`);
        }
      }

      if (result.operator) {
        score += 20;
        flags.push(`operator:${result.operator}`);
      }

      if (result.abuseScore && result.abuseScore >= 25) {
        score += Math.min(result.abuseScore, 50);
        flags.push(`abuse_score:${result.abuseScore}`);
      }

      if (result.totalReports && result.totalReports >= 5) {
        score += Math.min(result.totalReports * 2, 30);
        flags.push(`abuse_reports:${result.totalReports}`);
      }

      if (result.suspiciousScore) {
        score += result.suspiciousScore;
        if (result.flags) flags.push(...result.flags);
      }

      if (result.openPorts && result.openPorts.length > 0) {
        score += result.score || (result.openPorts.length * 20);
        if (result.flags) flags.push(...result.flags);
        if (!detectedType) detectedType = 'Open Proxy';
      }

      if (result.hasPTR === false) {
        score += 15;
        flags.push('no_reverse_dns');
      }

      if (result.isDatacenter) {
        score += 40;
        flags.push('datacenter_client');
        if (!detectedType) detectedType = 'Datacenter';
      }

      if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
        score += 40;
        flags.push(`risk_level:${result.riskLevel}`);
      }
    }

    return {
      score: Math.min(score, 100),
      flags: [...new Set(flags)],
      asn: detectedAsn,
      org: detectedOrg,
      type: detectedType,
    };
  }

  async checkIp(ip) {
    if (this.pendingChecks.has(ip)) {
      return this.pendingChecks.get(ip);
    }

    const checkPromise = this.performCheck(ip);
    this.pendingChecks.set(ip, checkPromise);

    try {
      const result = await checkPromise;
      return result;
    } finally {
      this.pendingChecks.delete(ip);
    }
  }

  async performCheck(ip) {
    const startTime = Date.now();

    const [apiChecks, dnsCheck] = await Promise.all([
      Promise.allSettled([
        this.checkProxyCheckIO(ip),
        this.checkIPAPI(ip),
        this.checkGetIPIntel(ip),
        this.checkIPQualityScore(ip),
        this.checkAbuseIPDB(ip),
        this.checkSpur(ip),
      ]),
      this.checkReverseDNS(ip),
    ]);

    const results = apiChecks
      .filter((c) => c.status === 'fulfilled' && c.value)
      .map((c) => c.value);

    if (dnsCheck) results.push(dnsCheck);

    const preliminaryAnalysis = this.analyzeHeuristics(results);

    if (preliminaryAnalysis.score >= 30 && preliminaryAnalysis.score < 50) {
      try {
        const portCheck = await this.checkOpenPorts(ip);
        if (portCheck) results.push(portCheck);
      } catch (err) {
        this.logger.warn(`Port check failed for ${ip}: ${err.message}`);
      }
    }

    const analysis = this.analyzeHeuristics(results);

    const isProxy = analysis.score >= 50;
    const isHighRisk = analysis.score >= 75;

    const duration = Date.now() - startTime;
    if (duration > 5000) {
      this.logger.warn(`Slow proxy check for ${ip}: ${duration}ms`);
    }

    const subnetBlocked = this.isSubnetBlocked(ip);
    if (subnetBlocked) {
      analysis.score = 100;
      analysis.flags.push('blocked_subnet');
    }

    const torScore = this.torUpdater.getScore(ip);
    if (torScore > 0) {
      analysis.score = Math.max(analysis.score, torScore);
      if (this.torUpdater.isExitNode(ip)) {
        analysis.flags.push('tor_exit_node_live');
        analysis.type = 'TOR';
      } else {
        analysis.flags.push('tor_exit_subnet');
      }
    }

    const finalIsProxy = analysis.score >= 50 || subnetBlocked;
    const finalIsHighRisk = analysis.score >= 75;

    if (finalIsProxy) {
      this.logger.info(
        `PROXY DETECTED: ${ip} | Score: ${analysis.score} | Flags: ${analysis.flags.join(', ')}`,
      );
    }

    this.recentIPs.set(ip, Date.now());

    return {
      isProxy: finalIsProxy,
      isHighRisk: finalIsHighRisk,
      score: analysis.score,
      type: analysis.type || (finalIsProxy ? 'Suspicious' : 'Residential'),
      operator: analysis.org || null,
      city: results.find((r) => r.city)?.city || null,
      devices: 1,
      subnetDevices: 1,
      flags: analysis.flags,
      asn: analysis.asn,
      checkCount: results.length,
    };
  }

  isSubnetBlocked(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    const subnet24 = `${parts[0]}.${parts[1]}.${parts[2]}`;
    const subnet16 = `${parts[0]}.${parts[1]}`;
    return BLOCKED_SUBNETS.has(subnet24) || BLOCKED_SUBNETS.has(subnet16);
  }

  isPrivateIP(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 127) return true;
    return false;
  }
}

export default MultiProxyChecker;
