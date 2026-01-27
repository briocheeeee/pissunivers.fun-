/*
 * route providing captcha
 */
import logger from '../core/logger.js';
import { requestCaptcha } from '../core/captchaserver.js';
import { setCaptchaSolution, isTrusted } from '../data/redis/captcha.js';

async function captcha(req, res) {
  req.tickRateLimiter(3000);

  res.set({
    'Access-Control-Expose-Headers': 'captcha-id, challenge-needed',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

  if (req.csrfPossible) {
    res.status(403);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(
      // eslint-disable-next-line max-len
      '<html><body><h1>Captchaserver: 403 Server Error</h1>Cross-Site request rejected</body></html>',
    );
    return;
  }

  const { ipString } = req.ip;

  try {
    const [trusted, [err, text, data, id]] = await Promise.all([
      isTrusted(ipString, req.headers['user-agent']),
      new Promise((resolve) => {
        requestCaptcha((...args) => resolve(args));
      }),
    ]);

    if (err) {
      throw new Error(err);
    }
    setCaptchaSolution(text, id);
    logger.info(`CAPTCHA ${ipString} got captcha with text: ${text}`);

    res.set({
      'Content-Type': 'image/svg+xml',
      'Captcha-Id': id,
      'Challenge-Needed': trusted ? '0' : '1',
    });
    res.end(data);
  } catch (err) {
    if (!res.writableEnded) {
      res.status(503);
      res.set({ 'Content-Type': 'text/html; charset=utf-8' });
      res.send(
        // eslint-disable-next-line max-len
        '<html><body><h1>Captchaserver: 503 Server Error</h1>Maybe try it later again</body></html>',
      );
    }
    logger.warn(err.message);
  }
}

export default captcha;
