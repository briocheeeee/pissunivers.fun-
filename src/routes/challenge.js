/*
 * route providing javascript challenge
 */
import logger from '../core/logger.js';
import requestChallenge from '../core/challengeserver.js';
import { setChallengeSolution } from '../data/redis/captcha.js';

async function challenge(req, res) {
  req.tickRateLimiter(3000);

  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Content-Type': 'application/javascript; charset=UTF-8',
  });

  if (req.csrfPossible) {
    res.status(403);
    res.send(
      // eslint-disable-next-line max-len
      'console.log(\'JS Challenge experienced an server error 403\');',
    );
    return;
  }

  const { ipString } = req.ip;

  requestChallenge(async (error, solution, data) => {
    try {
      if (error) {
        throw new Error(error);
      }

      setChallengeSolution(solution, ipString, req.headers['user-agent']);
      // eslint-disable-next-line max-len
      logger.info(`CHALLENGE ${ipString} got challenge with solution: ${solution}`);
      res.end(data);
    } catch (err) {
      if (!res.writableEnded) {
        res.status(503);
        res.send(
          // eslint-disable-next-line max-len
          'console.log(\'JS Challenge experienced an server error 503\');',
        );
      }
      logger.warn(err.message);
    }
  });
}

export default challenge;
