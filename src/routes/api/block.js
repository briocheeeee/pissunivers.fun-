/*
 *
 * blocks and unblocks a user
 *
 */

import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { findUserByIdOrName } from '../../data/sql/User.js';
import { deleteDMChannel } from '../../data/sql/Channel.js';
import {
  blockUser, unblockUser,
} from '../../data/sql/association_models/UserBlock.js';

async function block(req, res) {
  let userId = parseInt(req.body.userId, 10);
  let { userName } = req.body;
  const { block: blocking } = req.body;
  const { user } = req;

  const errors = [];
  if (userId) {
    if (userId && Number.isNaN(userId)) {
      errors.push('Invalid userId');
    }
  }
  if (typeof blocking !== 'boolean') {
    errors.push('Not defined if blocking or unblocking');
  }
  if (!userName && !userId) {
    errors.push('No userId or userName defined');
  }
  if (user && userId && user.id === userId) {
    errors.push('You can not block yourself.');
  }
  if (errors.length) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const targetUser = await findUserByIdOrName(userId, userName);

  if (!targetUser) {
    res.status(401);
    res.json({
      errors: ['Target user does not exist'],
    });
    return;
  }
  userId = targetUser.id;
  userName = targetUser.name;

  let ret;
  if (blocking) {
    ret = await blockUser(user.id, userId);
    const dmChannelId = await deleteDMChannel(user.id, userId);
    if (dmChannelId) {
      socketEvents.broadcastRemoveChatChannel(user.id, dmChannelId);
      socketEvents.broadcastRemoveChatChannel(userId, dmChannelId);
    }
  } else {
    ret = await unblockUser(user.id, userId);
  }

  if (ret) {
    res.json({
      status: 'ok',
    });
  } else {
    res.status(502);
    res.json({
      errors: ['Could not (un)block user'],
    });
    logger.info(
      `User ${user.name} (un)blocked ${userName}`,
    );
  }
}

export default block;
