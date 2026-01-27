import { Router } from 'express';

import {
  getUserBadgeDisplay,
  setUserBadgeDisplay,
} from '../../data/sql/UserBadgeDisplay.js';
import { getBadgesOfUser } from '../../data/sql/Badge.js';

const router = Router();

router.get('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const display = await getUserBadgeDisplay(req.user.id);
  return res.json(display);
});

router.post('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const { displayedBadges, featuredBadge, badgeOrder } = req.body;

  if (displayedBadges && !Array.isArray(displayedBadges)) {
    return res.status(400).json({ error: 'Invalid displayedBadges format' });
  }

  if (badgeOrder && !Array.isArray(badgeOrder)) {
    return res.status(400).json({ error: 'Invalid badgeOrder format' });
  }

  const userBadges = await getBadgesOfUser(req.user.id);
  const userBadgeIds = userBadges.map((b) => b.id);

  if (displayedBadges) {
    const invalidBadges = displayedBadges.filter((id) => !userBadgeIds.includes(id));
    if (invalidBadges.length > 0) {
      return res.status(400).json({ error: 'Invalid badge IDs' });
    }
  }

  if (featuredBadge && !userBadgeIds.includes(featuredBadge)) {
    return res.status(400).json({ error: 'Invalid featured badge ID' });
  }

  const success = await setUserBadgeDisplay(
    req.user.id,
    displayedBadges || [],
    featuredBadge || null,
    badgeOrder || [],
  );

  if (success) {
    return res.json({ success: true });
  }
  return res.status(500).json({ error: 'Failed to save settings' });
});

export default router;
