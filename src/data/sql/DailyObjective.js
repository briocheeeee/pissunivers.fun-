import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

const DailyObjective = sequelize.define('DailyObjective', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  objectiveType: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },

  targetValue: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  currentValue: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  rewardClaimed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

DailyObjective.addIndex = async () => {
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS idx_daily_objectives_uid_date ON DailyObjectives (uid, date)',
  );
};

export const OBJECTIVE_TYPES = {
  PLACE_PIXELS: 'place_pixels',
  SAY_HELLO_CHAT: 'say_hello_chat',
  SEND_CHAT_MESSAGES: 'send_chat_messages',
  PLACE_PIXELS_STREAK: 'place_pixels_streak',
  PLACE_PIXELS_SINGLE_CANVAS: 'place_pixels_single_canvas',
  PLACE_PIXELS_3D: 'place_pixels_3d',
  PLACE_PIXELS_FAST: 'place_pixels_fast',
  PLACE_PIXELS_COLORS: 'place_pixels_colors',
  VISIT_COORDINATES: 'visit_coordinates',
  CHANGE_CANVAS: 'change_canvas',
  USE_TEMPLATE: 'use_template',
  PLACE_PIXELS_WEEKLY: 'place_pixels_weekly',
  CHAT_MESSAGES_WEEKLY: 'chat_messages_weekly',
  PLACE_PIXELS_3D_WEEKLY: 'place_pixels_3d_weekly',
  ACTIVE_DAYS_WEEKLY: 'active_days_weekly',
  CANVASES_VISITED_WEEKLY: 'canvases_visited_weekly',
  TEMPLATES_USED_WEEKLY: 'templates_used_weekly',
  PIXELS_DIFFERENT_COLORS_WEEKLY: 'pixels_different_colors_weekly',
};

export const OBJECTIVE_DEFINITIONS = {
  [OBJECTIVE_TYPES.PLACE_PIXELS]: {
    name: 'Place 10,000 pixels',
    description: 'Place 10,000 pixels on any canvas',
    targetValue: 10000,
    rewardType: 'badge',
    rewardValue: 'pixelmaster',
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.SAY_HELLO_CHAT]: {
    name: 'Say hello in chat',
    description: 'Send a greeting message in any chat channel',
    targetValue: 1,
    rewardType: 'xp',
    rewardValue: 100,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.SEND_CHAT_MESSAGES]: {
    name: 'Send 20 chat messages',
    description: 'Send 20 messages in any chat channel',
    targetValue: 20,
    rewardType: 'xp',
    rewardValue: 200,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_STREAK]: {
    name: 'Place 500 pixels in a row',
    description: 'Place 500 pixels without stopping for more than 5 minutes',
    targetValue: 500,
    rewardType: 'xp',
    rewardValue: 300,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_SINGLE_CANVAS]: {
    name: 'Place 5,000 pixels on one canvas',
    description: 'Place 5,000 pixels on a single canvas today',
    targetValue: 5000,
    rewardType: 'xp',
    rewardValue: 250,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_3D]: {
    name: 'Place 1,000 voxels',
    description: 'Place 1,000 voxels on a 3D canvas',
    targetValue: 1000,
    rewardType: 'xp',
    rewardValue: 400,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_FAST]: {
    name: 'Speed painter',
    description: 'Place 100 pixels within 2 minutes',
    targetValue: 100,
    rewardType: 'xp',
    rewardValue: 150,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_COLORS]: {
    name: 'Colorful artist',
    description: 'Use 10 different colors today',
    targetValue: 10,
    rewardType: 'xp',
    rewardValue: 200,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.VISIT_COORDINATES]: {
    name: 'Explorer',
    description: 'Visit 5 different locations on the canvas',
    targetValue: 5,
    rewardType: 'xp',
    rewardValue: 100,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.CHANGE_CANVAS]: {
    name: 'Canvas hopper',
    description: 'Switch between 3 different canvases',
    targetValue: 3,
    rewardType: 'xp',
    rewardValue: 150,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.USE_TEMPLATE]: {
    name: 'Template user',
    description: 'Load and use a template',
    targetValue: 1,
    rewardType: 'xp',
    rewardValue: 100,
    isWeekly: false,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_WEEKLY]: {
    name: 'Place 50,000 pixels this week',
    description: 'Place 50,000 pixels on any canvas during the week',
    targetValue: 50000,
    rewardType: 'badge',
    rewardValue: 'weeklywarrior',
    isWeekly: true,
  },
  [OBJECTIVE_TYPES.CHAT_MESSAGES_WEEKLY]: {
    name: 'Chatty week',
    description: 'Send 100 chat messages this week',
    targetValue: 100,
    rewardType: 'xp',
    rewardValue: 500,
    isWeekly: true,
  },
  [OBJECTIVE_TYPES.PLACE_PIXELS_3D_WEEKLY]: {
    name: 'Voxel architect',
    description: 'Place 10,000 voxels on 3D canvases this week',
    targetValue: 10000,
    rewardType: 'badge',
    rewardValue: 'voxelmaster',
    isWeekly: true,
  },
  [OBJECTIVE_TYPES.ACTIVE_DAYS_WEEKLY]: {
    name: 'Dedicated player',
    description: 'Be active for 5 days this week',
    targetValue: 5,
    rewardType: 'xp',
    rewardValue: 750,
    isWeekly: true,
  },
  [OBJECTIVE_TYPES.CANVASES_VISITED_WEEKLY]: {
    name: 'World traveler',
    description: 'Place pixels on 5 different canvases this week',
    targetValue: 5,
    rewardType: 'xp',
    rewardValue: 400,
    isWeekly: true,
  },
  [OBJECTIVE_TYPES.TEMPLATES_USED_WEEKLY]: {
    name: 'Template master',
    description: 'Use 10 different templates this week',
    targetValue: 10,
    rewardType: 'xp',
    rewardValue: 600,
    isWeekly: true,
  },
  [OBJECTIVE_TYPES.PIXELS_DIFFERENT_COLORS_WEEKLY]: {
    name: 'Rainbow week',
    description: 'Use 20 different colors this week',
    targetValue: 20,
    rewardType: 'badge',
    rewardValue: 'rainbowartist',
    isWeekly: true,
  },
};

export async function getUserObjectives(uid) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();

  try {
    const dailyObjectives = await sequelize.query(
      'SELECT * FROM DailyObjectives WHERE uid = ? AND date = ? AND objectiveType NOT LIKE \'%_weekly\'',
      {
        replacements: [uid, today],
        type: QueryTypes.SELECT,
      },
    );

    const weeklyObjectives = await sequelize.query(
      'SELECT * FROM DailyObjectives WHERE uid = ? AND date >= ? AND objectiveType LIKE \'%_weekly\'',
      {
        replacements: [uid, weekStart],
        type: QueryTypes.SELECT,
      },
    );

    return {
      daily: dailyObjectives,
      weekly: weeklyObjectives,
    };
  } catch (error) {
    console.error(`SQL Error on getUserObjectives: ${error.message}`);
    return { daily: [], weekly: [] };
  }
}

export async function initializeDailyObjectives(uid) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();

  try {
    const existingDaily = await sequelize.query(
      'SELECT objectiveType FROM DailyObjectives WHERE uid = ? AND date = ?',
      {
        replacements: [uid, today],
        type: QueryTypes.SELECT,
      },
    );
    const existingDailyTypes = new Set(existingDaily.map((o) => o.objectiveType));

    const missingDaily = Object.entries(OBJECTIVE_DEFINITIONS)
      .filter(([type, def]) => !def.isWeekly && !existingDailyTypes.has(type))
      .map(([type, def]) => ({
        uid,
        objectiveType: type,
        targetValue: def.targetValue,
        currentValue: 0,
        completed: false,
        rewardClaimed: false,
        date: today,
      }));

    if (missingDaily.length > 0) {
      await DailyObjective.bulkCreate(missingDaily);
    }

    const existingWeekly = await sequelize.query(
      'SELECT objectiveType FROM DailyObjectives WHERE uid = ? AND date >= ? AND objectiveType LIKE \'%_weekly\'',
      {
        replacements: [uid, weekStart],
        type: QueryTypes.SELECT,
      },
    );
    const existingWeeklyTypes = new Set(existingWeekly.map((o) => o.objectiveType));

    const missingWeekly = Object.entries(OBJECTIVE_DEFINITIONS)
      .filter(([type, def]) => def.isWeekly && !existingWeeklyTypes.has(type))
      .map(([type, def]) => ({
        uid,
        objectiveType: type,
        targetValue: def.targetValue,
        currentValue: 0,
        completed: false,
        rewardClaimed: false,
        date: weekStart,
      }));

    if (missingWeekly.length > 0) {
      await DailyObjective.bulkCreate(missingWeekly);
    }

    return true;
  } catch (error) {
    console.error(`SQL Error on initializeDailyObjectives: ${error.message}`);
    return false;
  }
}

export async function updateObjectiveProgress(uid, objectiveType, incrementValue = 1) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const isWeekly = objectiveType.includes('_weekly');
  const dateToUse = isWeekly ? weekStart : today;

  try {
    const objective = await sequelize.query(
      `SELECT id, currentValue, targetValue, completed FROM DailyObjectives 
       WHERE uid = ? AND objectiveType = ? AND date >= ?
       ORDER BY date DESC LIMIT 1`,
      {
        replacements: [uid, objectiveType, dateToUse],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!objective) {
      return null;
    }

    if (objective.completed) {
      return objective;
    }

    const newValue = objective.currentValue + incrementValue;
    const isCompleted = newValue >= objective.targetValue;

    await sequelize.query(
      'UPDATE DailyObjectives SET currentValue = ?, completed = ? WHERE id = ?',
      {
        replacements: [newValue, isCompleted, objective.id],
        type: QueryTypes.UPDATE,
      },
    );

    return {
      ...objective,
      currentValue: newValue,
      completed: isCompleted,
    };
  } catch (error) {
    console.error(`SQL Error on updateObjectiveProgress: ${error.message}`);
    return null;
  }
}

export async function claimObjectiveReward(uid, objectiveId) {
  try {
    const objective = await sequelize.query(
      'SELECT * FROM DailyObjectives WHERE id = ? AND uid = ?',
      {
        replacements: [objectiveId, uid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!objective) {
      return { error: 'Objective not found' };
    }

    if (!objective.completed) {
      return { error: 'Objective not completed' };
    }

    if (objective.rewardClaimed) {
      return { error: 'Reward already claimed' };
    }

    await sequelize.query(
      'UPDATE DailyObjectives SET rewardClaimed = true WHERE id = ?',
      {
        replacements: [objectiveId],
        type: QueryTypes.UPDATE,
      },
    );

    const definition = OBJECTIVE_DEFINITIONS[objective.objectiveType];
    return {
      success: true,
      rewardType: definition?.rewardType || 'xp',
      rewardValue: definition?.rewardValue || 0,
    };
  } catch (error) {
    console.error(`SQL Error on claimObjectiveReward: ${error.message}`);
    return { error: 'Failed to claim reward' };
  }
}

export async function checkChatGreeting(uid, message) {
  const greetings = [
    'hello', 'hi', 'hey', 'bonjour', 'salut', 'coucou',
    'hola', 'hallo', 'ciao', 'ola', 'yo', 'sup',
    'good morning', 'good evening', 'good afternoon',
    'gm', 'gn', 'morning', 'evening',
  ];

  const lowerMessage = message.toLowerCase().trim();
  const isGreeting = greetings.some((g) => lowerMessage.startsWith(g) || lowerMessage === g);

  updateObjectiveProgress(uid, OBJECTIVE_TYPES.SEND_CHAT_MESSAGES, 1);
  updateObjectiveProgress(uid, OBJECTIVE_TYPES.CHAT_MESSAGES_WEEKLY, 1);

  if (isGreeting) {
    return updateObjectiveProgress(uid, OBJECTIVE_TYPES.SAY_HELLO_CHAT, 1);
  }
  return null;
}

export async function trackPixelPlacement(uid, canvasId, is3d, color, pxlCnt) {
  updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS, pxlCnt);
  updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_WEEKLY, pxlCnt);
  updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_SINGLE_CANVAS, pxlCnt);
  updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_FAST, pxlCnt);
  updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_STREAK, pxlCnt);

  if (is3d) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_3D, pxlCnt);
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_3D_WEEKLY, pxlCnt);
  }
}

export async function trackColorUsed(uid, color) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const dailyKey = `colors_${uid}_${today}`;
  const weeklyKey = `colors_${uid}_${weekStart}`;

  if (!colorTracking[dailyKey]) {
    colorTracking[dailyKey] = new Set();
  }
  if (!colorTracking[weeklyKey]) {
    colorTracking[weeklyKey] = new Set();
  }

  const dailyWasNew = !colorTracking[dailyKey].has(color);
  const weeklyWasNew = !colorTracking[weeklyKey].has(color);

  colorTracking[dailyKey].add(color);
  colorTracking[weeklyKey].add(color);

  if (dailyWasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.PLACE_PIXELS_COLORS, 1);
  }
  if (weeklyWasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.PIXELS_DIFFERENT_COLORS_WEEKLY, 1);
  }
}

export async function trackCanvasVisit(uid, canvasId) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const dailyKey = `canvas_${uid}_${today}`;
  const weeklyKey = `canvas_${uid}_${weekStart}`;

  if (!canvasTracking[dailyKey]) {
    canvasTracking[dailyKey] = new Set();
  }
  if (!canvasTracking[weeklyKey]) {
    canvasTracking[weeklyKey] = new Set();
  }

  const dailyWasNew = !canvasTracking[dailyKey].has(canvasId);
  const weeklyWasNew = !canvasTracking[weeklyKey].has(canvasId);

  canvasTracking[dailyKey].add(canvasId);
  canvasTracking[weeklyKey].add(canvasId);

  if (dailyWasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.CHANGE_CANVAS, 1);
  }
  if (weeklyWasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.CANVASES_VISITED_WEEKLY, 1);
  }
}

export async function trackTemplateUsed(uid, templateId) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const dailyKey = `template_${uid}_${today}`;
  const weeklyKey = `template_${uid}_${weekStart}`;

  if (!templateTracking[dailyKey]) {
    templateTracking[dailyKey] = new Set();
  }
  if (!templateTracking[weeklyKey]) {
    templateTracking[weeklyKey] = new Set();
  }

  const dailyWasNew = !templateTracking[dailyKey].has(templateId);
  const weeklyWasNew = !templateTracking[weeklyKey].has(templateId);

  templateTracking[dailyKey].add(templateId);
  templateTracking[weeklyKey].add(templateId);

  if (dailyWasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.USE_TEMPLATE, 1);
  }
  if (weeklyWasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.TEMPLATES_USED_WEEKLY, 1);
  }
}

export async function trackActiveDay(uid) {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const weeklyKey = `active_${uid}_${weekStart}`;

  if (!activeDayTracking[weeklyKey]) {
    activeDayTracking[weeklyKey] = new Set();
  }

  const wasNew = !activeDayTracking[weeklyKey].has(today);
  activeDayTracking[weeklyKey].add(today);

  if (wasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.ACTIVE_DAYS_WEEKLY, 1);
  }
}

export async function trackCoordinateVisit(uid, x, y) {
  const today = new Date().toISOString().split('T')[0];
  const key = `coords_${uid}_${today}`;
  const regionX = Math.floor(x / 1000);
  const regionY = Math.floor(y / 1000);
  const region = `${regionX}_${regionY}`;

  if (!coordinateTracking[key]) {
    coordinateTracking[key] = new Set();
  }

  const wasNew = !coordinateTracking[key].has(region);
  coordinateTracking[key].add(region);

  if (wasNew) {
    updateObjectiveProgress(uid, OBJECTIVE_TYPES.VISIT_COORDINATES, 1);
  }
}

const colorTracking = {};
const canvasTracking = {};
const templateTracking = {};
const activeDayTracking = {};
const coordinateTracking = {};

function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setUTCDate(diff));
  return monday.toISOString().split('T')[0];
}

export default DailyObjective;
