/*
 * request password change
 */

import logger from '../../../core/logger.js';
import socketEvents from '../../../socket/socketEvents.js';
import { validatePassword } from '../../../utils/validation.js';
import { comparePasswordToHash } from '../../../utils/hash.js';
import { setPassword } from '../../../data/sql/User.js';

function validate(newPassword, gettext) {
  const errors = [];

  const newpassworderror = gettext(validatePassword(newPassword));
  if (newpassworderror) errors.push(newpassworderror);

  return errors;
}

export default async (req, res) => {
  const { newPassword, password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = validate(newPassword, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user } = req;
  /* remember that we do allow users to not have a password set */
  const currentPassword = user.data.password;
  if (currentPassword) {
    const err = comparePasswordToHash(password, currentPassword, t);
    if (err !== null) {
      throw err;
    }
  }

  await setPassword(user.id, newPassword);

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed password for user ${user.name}(${user.id}) by ${req.ip.ipString}`);

  if (!currentPassword) {
    socketEvents.reloadUser(user.id);
  }

  res.json({
    success: true,
  });
};
