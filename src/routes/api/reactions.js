import {
  addReaction,
  removeReaction,
} from '../../data/sql/MessageReaction.js';

export async function addReactionHandler(req, res) {
  const { t } = req.ttag;
  const { user } = req;

  if (!user || !user.id) {
    return res.status(401).json({ errors: [t`You must be logged in`] });
  }

  const { messageId, emoji } = req.body;

  if (!messageId || !emoji) {
    return res.status(400).json({ errors: [t`Missing messageId or emoji`] });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(emoji)) {
    return res.status(400).json({ errors: [t`Invalid emoji name`] });
  }

  try {
    const result = await addReaction(messageId, user.id, emoji);
    if (result.error) {
      return res.status(400).json({ errors: [result.error] });
    }
    res.json({ success: true, messageId, emoji });
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

  const { messageId, emoji } = req.body;

  if (!messageId || !emoji) {
    return res.status(400).json({ errors: [t`Missing messageId or emoji`] });
  }

  try {
    const result = await removeReaction(messageId, user.id, emoji);
    res.json({ success: result.success, messageId, emoji });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ errors: [t`Failed to remove reaction`] });
  }
}
