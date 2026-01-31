<<<<<<< C:/Users/brioc/Documents/GitHub/pixuniverse/src/routes/api/objectives.js
import { Router } from 'express';

import {
  getUserObjectives,
  initializeDailyObjectives,
  claimObjectiveReward,
  OBJECTIVE_DEFINITIONS,
} from '../../data/sql/DailyObjective.js';

const router = Router();

router.get('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  await initializeDailyObjectives(req.user.id);
  const objectives = await getUserObjectives(req.user.id);

  const formattedDaily = objectives.daily.map((obj) => ({
    id: obj.id,
    type: obj.objectiveType,
    name: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.name || obj.objectiveType,
    description: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.description || '',
    targetValue: obj.targetValue,
    currentValue: obj.currentValue,
    completed: obj.completed,
    rewardClaimed: obj.rewardClaimed,
    progress: Math.min(100, Math.round((obj.currentValue / obj.targetValue) * 100)),
  }));

  const formattedWeekly = objectives.weekly.map((obj) => ({
    id: obj.id,
    type: obj.objectiveType,
    name: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.name || obj.objectiveType,
    description: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.description || '',
    targetValue: obj.targetValue,
    currentValue: obj.currentValue,
    completed: obj.completed,
    rewardClaimed: obj.rewardClaimed,
    progress: Math.min(100, Math.round((obj.currentValue / obj.targetValue) * 100)),
  }));

  return res.json({
    daily: formattedDaily,
    weekly: formattedWeekly,
  });
});

router.post('/claim', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const { objectiveId } = req.body;

  if (!objectiveId) {
    return res.status(400).json({ error: 'Missing objectiveId' });
  }

  const result = await claimObjectiveReward(req.user.id, objectiveId);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  return res.json(result);
});

export default router;
=======
import { Router } from 'express';

import {
  getUserObjectives,
  initializeDailyObjectives,
  claimObjectiveReward,
  OBJECTIVE_DEFINITIONS,
} from '../../data/sql/DailyObjective.js';
import { awardBadgeBySlug } from '../../data/sql/awardBadge.js';

const router = Router();

router.get('/', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  await initializeDailyObjectives(req.user.id);
  const objectives = await getUserObjectives(req.user.id);

  const formattedDaily = objectives.daily.map((obj) => ({
    id: obj.id,
    type: obj.objectiveType,
    name: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.name || obj.objectiveType,
    description: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.description || '',
    targetValue: obj.targetValue,
    currentValue: obj.currentValue,
    completed: obj.completed,
    rewardClaimed: obj.rewardClaimed,
    progress: Math.min(100, Math.round((obj.currentValue / obj.targetValue) * 100)),
  }));

  const formattedWeekly = objectives.weekly.map((obj) => ({
    id: obj.id,
    type: obj.objectiveType,
    name: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.name || obj.objectiveType,
    description: OBJECTIVE_DEFINITIONS[obj.objectiveType]?.description || '',
    targetValue: obj.targetValue,
    currentValue: obj.currentValue,
    completed: obj.completed,
    rewardClaimed: obj.rewardClaimed,
    progress: Math.min(100, Math.round((obj.currentValue / obj.targetValue) * 100)),
  }));

  return res.json({
    daily: formattedDaily,
    weekly: formattedWeekly,
  });
});

router.post('/claim', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const { objectiveId } = req.body;

  if (!objectiveId) {
    return res.status(400).json({ error: 'Missing objectiveId' });
  }

  const result = await claimObjectiveReward(req.user.id, objectiveId);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  if (result.rewardType === 'badge' && result.rewardValue) {
    const badgeResult = await awardBadgeBySlug(req.user.id, result.rewardValue, 'Objective reward');
    if (badgeResult.success) {
      result.badgeAwarded = result.rewardValue;
    }
  }

  return res.json(result);
});

export default router;
>>>>>>> C:/Users/brioc/.windsurf/worktrees/pixuniverse/pixuniverse-26cf27c6/src/routes/api/objectives.js
