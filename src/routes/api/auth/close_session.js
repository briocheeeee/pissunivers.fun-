/*
 * close a session
 */
import { removeSessionById } from '../../../data/sql/Session.js';
import { comparePasswordToHash } from '../../../utils/hash.js';
import socketEvents from '../../../socket/socketEvents.js';

export default async (req, res) => {
  const { user, body: { id, password }, ttag: { t } } = req;

  const currentPassword = user.data.password;
  if (currentPassword) {
    const err = comparePasswordToHash(password, currentPassword, t);
    if (err !== null) {
      throw err;
    }
  }

  const success = await removeSessionById(id, user.id);

  if (!success) {
    throw new Error(t`Could not close this Session.`);
  }

  socketEvents.reloadUser(user.id);

  res.status(200).json({ success: true });
};
