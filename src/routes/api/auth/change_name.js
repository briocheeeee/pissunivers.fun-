/*
 * request password change
 */

import logger from '../../../core/logger.js';
import socketEvents from '../../../socket/socketEvents.js';
import { setName } from '../../../data/sql/User.js';
import { validateName } from '../../../utils/validation.js';

async function validate(oldname, name, t, gettext) {
  if (oldname === name) return t`You already have that name.`;

  const nameerror = gettext(validateName(name));
  if (nameerror) return nameerror;

  return null;
}

export default async (req, res) => {
  let { name } = req.body;
  name = name?.trim();
  const { t, gettext } = req.ttag;
  const { user } = req;

  const oldname = user.name;
  const error = await validate(oldname, name, t, gettext);
  if (error) {
    res.status(400);
    res.json({
      errors: [error],
    });
    return;
  }

  const success = await setName(user.id, name);
  if (!success) {
    res.status(400);
    res.json({
      errors: [t`Name already in use.`],
    });
    return;
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed name for user ${user.name}(${user.id}) to ${name} by ${req.ip.ipString}`);

  socketEvents.reloadUser(user.id);

  res.json({
    success: true,
  });
};
