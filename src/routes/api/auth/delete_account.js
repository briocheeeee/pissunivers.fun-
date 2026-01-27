/*
 * request password change
 */

import logger from '../../../core/logger.js';
import socketEvents from '../../../socket/socketEvents.js';
import { validatePassword } from '../../../utils/validation.js';
import { comparePasswordToHash } from '../../../utils/hash.js';
import { deleteUser } from '../../../data/sql/User.js';
import { deleteUserFromRanks } from '../../../data/redis/cooldown.js';
import { clearCookie } from '../../../middleware/session.js';

function validate(password, gettext) {
  const errors = [];

  if (password) {
    const passworderror = gettext(validatePassword(password));
    if (passworderror) errors.push(passworderror);
  }

  return errors;
}

export default async (req, res) => {
  const { password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = await validate(password, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user } = req;

  const currentPassword = user.data.password;
  if (currentPassword) {
    const err = comparePasswordToHash(password, currentPassword, t);
    if (err !== null) {
      throw err;
    }
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Deleted user ${user.name}(${user.id}) by ${req.ip.ipString}`);

  const ret = await deleteUser(user.id);
  if (!ret) {
    res.status(500);
    res.json({
      errors: [t`Server error when deleting user.`],
    });
    return;
  }
  const { dmChannels } = ret;
  if (dmChannels.length) {
    dmChannels.forEach(({ cid, dmuid }) => {
      socketEvents.broadcastRemoveChatChannel(user.id, cid);
      socketEvents.broadcastRemoveChatChannel(dmuid, cid);
    });
  }
  clearCookie(req, res);

  socketEvents.reloadUser(user.id);

  deleteUserFromRanks(user.id);

  res.json({
    success: true,
  });
};
