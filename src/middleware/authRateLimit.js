import MassRateLimiter from '../utils/MassRateLimiter.js';
import logger from '../core/logger.js';

const FIVE_MINUTES = 5 * 60 * 1000;
const authRateLimiter = new MassRateLimiter(FIVE_MINUTES);

function onAuthTrigger(ipString, blockTime, reason) {
  logger.warn(`AUTH_RATELIMIT: ${ipString} blocked for ${blockTime}ms - ${reason}`);
}

export default function authRateLimit(req, res, next) {
  const { ipString } = req.ip;

  if (authRateLimiter.isTriggered(ipString)) {
    logger.info(`AUTH_RATELIMIT: Blocked request from ${ipString}`);
    res.status(429).json({
      errors: ['Too many authentication attempts. Please wait a few minutes.'],
    });
    return;
  }

  const isTriggered = authRateLimiter.tick(
    ipString,
    12000,
    'auth attempt',
    onAuthTrigger,
  );

  if (isTriggered) {
    res.status(429).json({
      errors: ['Too many authentication attempts. Please wait a few minutes.'],
    });
    return;
  }

  next();
}
