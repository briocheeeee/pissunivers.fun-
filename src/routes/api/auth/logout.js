/*
 * logout
 */

import logger from '../../../core/logger.js';
import socketEvents from '../../../socket/socketEvents.js';
import { closeSession } from '../../../middleware/session.js';

export default async (req, res) => {
  const { user } = req;

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Logged out user ${user.name}(${user.id}) by ${req.ip.ipString}`);

  await closeSession(req, res);

  socketEvents.reloadUser(user.id);

  res.status(200);
  res.json({
    success: true,
  });
};
