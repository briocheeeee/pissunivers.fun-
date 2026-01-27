/*
 * rate limiter,
 * must have req.ip available
 */
import { spawn } from 'child_process';

import MassRateLimiter from '../utils/MassRateLimiter.js';
import { HOUR } from '../core/constants.js';
import { RATE_LIMIT_CMD } from '../core/config.js';
import logger from '../core/logger.js';

const rateLimiter = new MassRateLimiter(HOUR);

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}:[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:)?[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}::$/;

function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

function onTrigger(ipString) {
  logger.warn(`User ${ipString} triggered Request RateLimit.`);
  if (RATE_LIMIT_CMD) {
    if (!isValidIP(ipString)) {
      logger.error(`RateLimit: Invalid IP format rejected: ${ipString}`);
      return;
    }
    const args = RATE_LIMIT_CMD.split(' ');
    const cmd = args.shift();
    args.push(ipString);
    const proc = spawn(cmd, args);
    proc.stdout.on('data', (data) => {
      logger.info(`RateLimit Trigger: ${data}`);
    });
    proc.stderr.on('data', (data) => {
      logger.error(`RateLimit Trigger Error: ${data}`);
    });
  }
}

export default (req, res, next) => {
  if (rateLimiter.isTriggered(req.ip.ipString)) {
    res.status(429).send(`<!DOCTYPE html>
<html>
  <head><title>Too fast</title></head>
  <body>Calm Down a bit.</body>
</html>`);
    return;
  }
  req.tickRateLimiter = (deltaTime) => {
    /*
     * the ticking request will be answered, if the limiter triggers, the next
     * request is the first to be caught
     */
    rateLimiter.tick(req.ip.ipString, deltaTime, null, onTrigger);
  };
  next();
};
