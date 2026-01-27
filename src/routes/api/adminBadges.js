import { Router } from 'express';

import { USERLVL, findIdByNameOrId } from '../../data/sql/User.js';

import {
  awardBadge,
  revokeBadge,
  getAllBadges,
  getUserBadges,
} from '../../data/sql/awardBadge.js';

const router = Router();

router.use((req, res, next) => {
  if (!req.user || req.user.userlvl < USERLVL.ADMIN) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
});

router.get('/list', async (req, res) => {
  const badges = await getAllBadges();
  return res.json({ badges });
});

router.get('/user/:identifier', async (req, res) => {
  const { identifier } = req.params;

  const user = await findIdByNameOrId(identifier);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const badges = await getUserBadges(user.id);
  return res.json({
    user: { id: user.id, name: user.name },
    badges,
  });
});

router.post('/award', async (req, res) => {
  const { userId, username, badgeName, note } = req.body;

  if (!badgeName) {
    return res.status(400).json({ error: 'Badge name required' });
  }

  let targetUserId = userId;

  if (!targetUserId && username) {
    const user = await findIdByNameOrId(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    targetUserId = user.id;
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'User ID or username required' });
  }

  const result = await awardBadge(targetUserId, badgeName, note || null);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: `Badge "${badgeName}" awarded successfully` });
});

router.post('/revoke', async (req, res) => {
  const { userId, username, badgeName } = req.body;

  if (!badgeName) {
    return res.status(400).json({ error: 'Badge name required' });
  }

  let targetUserId = userId;

  if (!targetUserId && username) {
    const user = await findIdByNameOrId(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    targetUserId = user.id;
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'User ID or username required' });
  }

  const result = await revokeBadge(targetUserId, badgeName);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: `Badge "${badgeName}" revoked successfully` });
});

export default router;
