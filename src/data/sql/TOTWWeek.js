import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

export const TOTW_CATEGORY = {
  SMALL: 0,
  MEDIUM: 1,
  LARGE: 2,
};

export const TOTW_AWARD_TYPE = {
  MAIN: 0,
  MOST_IMPROVED: 1,
  UNDERDOG: 2,
  COMMUNITY_CHOICE: 3,
};

export const FACTION_SIZE_THRESHOLDS = {
  SMALL_MAX: 10,
  MEDIUM_MAX: 30,
};

const TOTWWeek = sequelize.define('TOTWWeek', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  weekNumber: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  year: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  status: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  votingOpen: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  finalized: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['weekNumber', 'year'],
    },
  ],
});

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return { weekNumber, year };
}

function getISOWeekBounds(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  const startDate = new Date(d);
  startDate.setUTCDate(d.getUTCDate() - dayOfWeek + 1);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export async function getCurrentWeek() {
  const now = new Date();
  const { weekNumber, year } = getISOWeekNumber(now);

  let week = await TOTWWeek.findOne({
    where: { weekNumber, year },
    raw: true,
  });

  if (!week) {
    const { startDate, endDate } = getISOWeekBounds(now);

    week = await TOTWWeek.create({
      weekNumber,
      year,
      startDate,
      endDate,
      status: 0,
      votingOpen: false,
      finalized: false,
    });
    week = week.get({ plain: true });
  }

  return week;
}

export { getISOWeekNumber, getISOWeekBounds };

export async function getWeekById(weekId) {
  return TOTWWeek.findByPk(weekId, { raw: true });
}

export async function getPastWeeks(limit = 10, offset = 0) {
  return TOTWWeek.findAll({
    where: { finalized: true },
    order: [['year', 'DESC'], ['weekNumber', 'DESC']],
    limit,
    offset,
    raw: true,
  });
}

export async function getPastWeeksCount() {
  return TOTWWeek.count({ where: { finalized: true } });
}

export async function updateWeekStatus(weekId, updates) {
  await TOTWWeek.update(updates, { where: { id: weekId } });
}

export async function getWeekByNumber(weekNumber, year) {
  return TOTWWeek.findOne({
    where: { weekNumber, year },
    raw: true,
  });
}

export default TOTWWeek;
