/*
 * request password change
 */

import logger from '../../../core/logger.js';
import socketEvents from '../../../socket/socketEvents.js';
import { setUsername } from '../../../data/sql/User.js';
import { validateUsername } from '../../../utils/validation.js';

export default async (req, res) => {
  let { username } = req.body;
  const { t, gettext } = req.ttag;
  const { user } = req;

  let error;
  if (!user.data.username.startsWith('pp_')) {
    error = t`You already chose your username`;
  } else if (username.startsWith('pp_')) {
    error = t`Username can not start with pp_`;
  } else {
    username = username?.toLowerCase();
    error = gettext(validateUsername(username));
  }
  if (error) {
    res.status(400);
    res.json({
      errors: [error],
    });
    return;
  }

  const success = await setUsername(user.id, username);
  if (!success) {
    res.status(400);
    res.json({
      errors: [t`Name already in use.`],
    });
    return;
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed username for user ${user.name}(${user.id}) to ${username} by ${req.ip.ipString}`);

  socketEvents.reloadUser(user.id);

  res.json({
    success: true,
  });
};
