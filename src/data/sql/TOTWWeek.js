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

export async function getCurrentWeek() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  const year = now.getFullYear();

  let week = await TOTWWeek.findOne({
    where: { weekNumber, year },
    raw: true,
  });

  if (!week) {
    const dayOfWeek = now.getDay();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

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
