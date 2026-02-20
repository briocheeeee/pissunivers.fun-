import {
  addReaction,
  removeReaction,
} from '../../data/sql/MessageReaction.js';
import socketEvents from '../../socket/socketEvents.js';

export async function addReactionHandler(req, res) {
  const { t } = req.ttag;
  const { user } = req;

  if (!user || !user.id) {
    return res.status(401).json({ errors: [t`You must be logged in`] });
  }

  const { messageId, emoji, channelId } = req.body;

  if (!messageId || !emoji || !channelId) {
    return res.status(400).json({ errors: [t`Missing messageId, emoji or channelId`] });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(emoji)) {
    return res.status(400).json({ errors: [t`Invalid emoji name`] });
  }

  const parsedMessageId = parseInt(messageId, 10);
  if (Number.isNaN(parsedMessageId)) {
    return res.status(400).json({ errors: [t`Invalid messageId`] });
  }

  try {
    const result = await addReaction(parsedMessageId, user.id, emoji);
    if (result.alreadyExists) {
      return res.json({ success: true, messageId: parsedMessageId, emoji });
    }
    socketEvents.broadcastReaction(channelId, parsedMessageId, user.id, emoji, 'add');
    res.json({ success: true, messageId: parsedMessageId, emoji });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ errors: [t`Failed to add reaction`] });
  }
}

export async function removeReactionHandler(req, res) {
  const { t } = req.ttag;
  const { user } = req;

  if (!user || !user.id) {
    return res.status(401).json({ errors: [t`You must be logged in`] });
  }

  const { messageId, emoji, channelId } = req.body;

  if (!messageId || !emoji || !channelId) {
    return res.status(400).json({ errors: [t`Missing messageId, emoji or channelId`] });
  }

  const parsedMessageId = parseInt(messageId, 10);
  if (Number.isNaN(parsedMessageId)) {
    return res.status(400).json({ errors: [t`Invalid messageId`] });
  }

  try {
    const result = await removeReaction(parsedMessageId, user.id, emoji);
    if (result.success) {
      socketEvents.broadcastReaction(channelId, parsedMessageId, user.id, emoji, 'remove');
    }
    res.json({ success: result.success, messageId: parsedMessageId, emoji });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ errors: [t`Failed to remove reaction`] });
  }
}
