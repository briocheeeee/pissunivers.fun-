import { setDescription } from '../../data/sql/User.js';

const MAX_DESCRIPTION_LENGTH = 200;

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { description } = req.body;

  if (!user) {
    res.status(401).json({ errors: [t`You are not logged in`] });
    return;
  }

  if (description !== null && description !== undefined) {
    if (typeof description !== 'string') {
      res.status(400).json({ errors: [t`Invalid description`] });
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      res.status(400).json({ errors: [t`Description is too long (max 200 characters)`] });
      return;
    }
  }

  const trimmed = description ? description.trim() : null;
  const success = await setDescription(user.id, trimmed || null);

  if (!success) {
    res.status(500).json({ errors: [t`Failed to save description`] });
    return;
  }

  res.json({ success: true, description: trimmed || null });
};
