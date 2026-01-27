/*
 * local login with mail / name and password
 */
import logger from '../../../core/logger.js';
import { getUsersByNameOrEmail, setPassword } from '../../../data/sql/User.js';
import { compareToHash, needsRehash, rehashPassword } from '../../../utils/hash.js';

import socketEvents from '../../../socket/socketEvents.js';

import getMe from '../../../core/me.js';
import { openSession } from '../../../middleware/session.js';

export default async (req, res) => {
  const { ttag: { t }, body: { nameoremail, password }, ip } = req;

  const users = await getUsersByNameOrEmail(nameoremail, null);

  try {
    if (!users || !users.length) {
      throw new Error(t`Name or Email does not exist!`);
    }
    const user = users.find((u) => compareToHash(password, u.password));
    if (user && needsRehash(user.password)) {
      try {
        const newHash = await rehashPassword(password);
        await setPassword(user.id, newHash);
        logger.info(`AUTH: Rehashed password for user ${user.id} with updated cost factor`);
      } catch (rehashErr) {
        logger.error(`AUTH: Failed to rehash password for user ${user.id}: ${rehashErr.message}`);
      }
    }
    if (!user) {
      if (users.find((u) => u.password === 'hacked')) {
        throw new Error(
          // eslint-disable-next-line max-len
          t`This email / password combination got hacked and leaked. To protect this account, the password has been reset. Please use the "Forgot my password" function below to set a new password. In the future, consider not installing malware, Thank You.`,
        );
      }
      // eslint-disable-next-line max-len
      logger.info(`AUTH: Incorrect login attempt for ${nameoremail} by ${ip.ipString}`);
      throw new Error('Incorrect password!');
    }

    /*
     * durationsel: session duration, null for permanent
     * returnToken: if set, we do not set cookie and return the token instead,
     *   this is used for reauthentification
     *
     */
    const { returnToken } = req.body;
    let { durationsel: durationHours } = req.body;
    if (returnToken) {
      /* only allow 15min for returned tokens */
      durationHours = 0.25;
    } else if (durationHours === 'forever') {
      durationHours = null;
    } else {
      durationHours = parseInt(durationHours, 10);
      if (Number.isNaN(durationHours)) {
        // default to 30 days if gibberish
        durationHours = 720;
      }
    }

    const token = await openSession(
      req, res, user.id, durationHours, returnToken,
    );
    logger.info(
      `AUTH: Logged in user ${user.name}(${user.id}) by ${ip.ipString}`,
    );

    const responseData = {
      success: true,
      me: await getMe(req.user, ip, req.lang),
    };
    if (returnToken) {
      responseData.token = token;
    } else {
      /* tell all clients of this ip to reload */
      res.on('finish', () => socketEvents.reloadIP(ip.ipString));
    }
    res.json(responseData);
  } catch (error) {
    res.status(401).json({
      errors: [error.message],
    });
  }
};
