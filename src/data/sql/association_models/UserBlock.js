/*
 * Junction table for User -> Blocked User
 */

import sequelize from '../sequelize.js';

const UserBlock = sequelize.define('UserBlock', {});

/**
 * check if user blocks another
 * @param uid user to check
 * @param buid user to know whether he is blocks
 * @return boolean
 */
export async function isUserBlockedBy(uid, buid) {
  const exists = await UserBlock.findOne({
    where: { uid, buid },
    raw: true,
    attributes: ['uid'],
  });
  return !!exists;
}

/**
 * block user
 * @param uid id of the user that is blocking someone else
 * @param buid id of user who gets blocked
 * @return boolnea if successful
 */
export async function blockUser(uid, buid) {
  try {
    const [, created] = await UserBlock.findOrCreate({
      where: { uid, buid },
      raw: true,
    });
    return created;
  } catch (error) {
    console.error(`SQL Error on blockUser: ${error.message}`);
  }
  return false;
}

/**
 * unblock user
 * @param uid id of the user that is blocking someone else
 * @param buid id of user who is blocked
 * @return boolnea if successful
 */
export async function unblockUser(uid, buid) {
  try {
    const rows = await UserBlock.destroy({ where: { uid, buid } });
    return rows > 0;
  } catch (error) {
    console.error(`SQL Error on blockUser: ${error.message}`);
  }
  return false;
}

export default UserBlock;
