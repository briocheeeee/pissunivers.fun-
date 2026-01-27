import https from 'https';
import fs from 'fs';
import path from 'path';

const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist';
const TOR_EXIT_LIST_BACKUP = 'https://www.dan.me.uk/torlist/?exit';
const UPDATE_INTERVAL = 6 * 3600 * 1000;

class TorExitNodeUpdater {
  constructor(logger) {
    this.logger = logger || console;
    this.exitNodes = new Set();
    this.exitSubnets = new Set();
    this.lastUpdate = 0;
    this.updating = false;
    this.cacheFile = path.join(process.cwd(), 'tor_exit_nodes.json');
    this.loadFromCache();
    this.scheduleUpdate();
  }

  loadFromCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        if (data.nodes && Array.isArray(data.nodes)) {
          this.exitNodes = new Set(data.nodes);
          this.buildSubnets();
          this.lastUpdate = data.lastUpdate || 0;
          this.logger.info(`Loaded ${this.exitNodes.size} TOR exit nodes from cache`);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to load TOR cache: ${err.message}`);
    }
  }

  saveToCache() {
    try {
      const data = {
        nodes: [...this.exitNodes],
        lastUpdate: this.lastUpdate,
      };
      fs.writeFileSync(this.cacheFile, JSON.stringify(data), 'utf8');
    } catch (err) {
      this.logger.warn(`Failed to save TOR cache: ${err.message}`);
    }
  }

  buildSubnets() {
    this.exitSubnets.clear();
    for (const ip of this.exitNodes) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        this.exitSubnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }

  scheduleUpdate() {
    this.update();
    setInterval(() => this.update(), UPDATE_INTERVAL);
  }

  async fetchList(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const data = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(data).toString('utf8');
          const ips = text.split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && /^\d+\.\d+\.\d+\.\d+$/.test(line));
          resolve(ips);
        });
      });
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.on('error', reject);
    });
  }

  async update() {
    if (this.updating) return;
    this.updating = true;

    try {
      let ips = [];
      try {
        ips = await this.fetchList(TOR_EXIT_LIST_URL);
      } catch (err) {
        this.logger.warn(`Primary TOR list failed: ${err.message}, trying backup`);
        ips = await this.fetchList(TOR_EXIT_LIST_BACKUP);
      }

      if (ips.length > 100) {
        this.exitNodes = new Set(ips);
        this.buildSubnets();
        this.lastUpdate = Date.now();
        this.saveToCache();
        this.logger.info(`Updated TOR exit nodes: ${this.exitNodes.size} nodes, ${this.exitSubnets.size} subnets`);
      }
    } catch (err) {
      this.logger.error(`Failed to update TOR exit nodes: ${err.message}`);
    } finally {
      this.updating = false;
    }
  }

  isExitNode(ip) {
    return this.exitNodes.has(ip);
  }

  isExitSubnet(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return this.exitSubnets.has(`${parts[0]}.${parts[1]}.${parts[2]}`);
  }

  getScore(ip) {
    if (this.isExitNode(ip)) return 100;
    if (this.isExitSubnet(ip)) return 60;
    return 0;
  }
}

let instance = null;

export function getTorExitNodeUpdater(logger) {
  if (!instance) {
    instance = new TorExitNodeUpdater(logger);
  }
  return instance;
}

export default TorExitNodeUpdater;
