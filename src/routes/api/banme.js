/*
 * report that user should be banned
 */

import logger from '../../core/logger.js';
import { ban } from '../../core/ban.js';
import { prolongExistingBan } from '../../data/sql/Ban.js';

async function banme(req, res) {
  req.tickRateLimiter(3000);

  const { body: { code }, ip: { ipString } } = req;
  const uid = req.user?.id;

  // eslint-disable-next-line max-len
  logger.info(`AUTOBAN ${code} - ${ipString} of user ${uid} with ua "${req.headers['user-agent']}"`);

  let reason = 'AUTOBAN';
  let duration = 0;
  if (code === 1) {
    reason = 'Userscript Bot';
    duration = 3600 * 24 * 5;
  /*
   * ignore it for now to collect data manually
   *
  } else if (code === 2) {
    const ua = req.headers['user-agent'];
    if (ua && (ua.includes('Android') || ua.includes('iPhone'))) {
      res.json({
        status: 'nope',
      });
      return;
    }
    reason = 'Captcha Solving Script';
    expires = Date.now() + 1000 * 3600 * 24 * 3;
  */
  } else if (code === 3) {
    reason = 'Proxy Malware detected';
    duration = 3600 * 24 * 5;
  } else if (code === 4) {
    reason = 'Userscript Autoclicker';
    duration = 3600 * 24 * 6;
  } else {
    res.json({
      status: 'nope',
    });
    return;
  }
  const didProlong = await prolongExistingBan(ipString, uid, duration, reason);
  if (!didProlong) {
    await ban(ipString, uid, null, false, true, reason, duration);
  }
  res.json({
    status: 'ok',
  });
}

export default banme;
