/*
 * express middleware to set CORS Headers
 */
import { CORS_HOSTS } from '../core/config.js';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  if (!CORS_HOSTS || CORS_HOSTS.length === 0) {
    console.error('\n=== CORS CONFIGURATION ERROR ===');
    console.error('CORS_HOSTS must be configured in production mode.');
    console.error('Set CORS_HOSTS in config.ini to your allowed domains (e.g., .example.com)');
    console.error('');
    process.exit(1);
  }
  const hasWildcard = CORS_HOSTS.some((h) => h === '*' || h === '.*');
  if (hasWildcard) {
    console.error('\n=== CORS CONFIGURATION ERROR ===');
    console.error('Wildcard CORS_HOSTS (*) is not allowed in production mode.');
    console.error('');
    process.exit(1);
  }
}

/**
 * check if it is a cors request and if allowed return its host, return false if
 * it is cors and not allowed, nullif it isn't or cant be determined
 * @param req expressjs request
 * @return host | false | null
 */
export function corsHost(req) {
  const { origin } = req.headers;
  if (!origin || origin === 'null') {
    return null;
  }
  const originHost = `.${origin.slice(origin.indexOf('//') + 2)}`;
  if (originHost === req.ip.getHost(false, true)) {
    /* no CORS */
    return null;
  }
  /*
   * form .domain.tld will accept both domain.tld and x.domain.tld,
   * all CORS_HOSTS entries shall start with a dot or be an IP
   */
  const isAllowed = CORS_HOSTS.some((c) => originHost.endsWith(c));
  if (!isAllowed) {
    return false;
  }
  return origin;
}

/**
 * @param req expressjs request
 * @return boolean if this is a CORS request and if it is, if it's allowed,
 */
export function isCORSAllowed(req) {
  const { origin } = req.headers;
  if (!origin) {
    return false;
  }
  const originHost = `.${origin.slice(origin.indexOf('//') + 2)}`;
  const host = req.ip.getHost(false, true);
  /*
   * In some websocket requests from localhost, the origin is the loopback IP
   * and the host is localhost, it is super silly
   */
  if (originHost.endsWith(host) || origin === '127.0.0.1') {
    return true;
  }
  return CORS_HOSTS.some((c) => originHost.endsWith(c));
}

export default (req, res, next) => {
  const origin = corsHost(req);

  if (!origin) {
    if (origin === false) {
      /*
       * mark a disallowed cors request, to let possible CSRF vulnerable APIs
       * choose how to handle
       */
      req.csrfPossible = true;
    }
    next();
    return;
  }

  /* different origin produces different response */
  res.set({
    Vary: 'Origin',
  });

  /*
   * The recommended way of dealing with multiple origin is to return whatever
   * origin requested, according to MDN.
   */
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  });

  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Max-Age': '86400',
    });
    res.sendStatus(200);
    return;
  }
  next();
};
