import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { TOTW_CATEGORY, TOTW_AWARD_TYPE, FACTION_SIZE_THRESHOLDS } from './TOTWWeek.js';

const TOTWNominee = sequelize.define('TOTWNominee', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  weekId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  factionId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  category: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  awardType: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: TOTW_AWARD_TYPE.MAIN,
  },

  pixelsCaptured: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  winRatio: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  growthPercent: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  compositeScore: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  memberCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  voteCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  isWinner: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  previousWeekPixels: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  defeatedLargerFaction: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['weekId', 'factionId'],
      unique: true,
    },
    {
      fields: ['weekId', 'category', 'awardType'],
    },
    {
      fields: ['weekId', 'isWinner'],
    },
  ],
});

export function getFactionCategory(memberCount) {
  if (memberCount <= FACTION_SIZE_THRESHOLDS.SMALL_MAX) {
    return TOTW_CATEGORY.SMALL;
  }
  if (memberCount <= FACTION_SIZE_THRESHOLDS.MEDIUM_MAX) {
    return TOTW_CATEGORY.MEDIUM;
  }
  return TOTW_CATEGORY.LARGE;
}

export function calculateCompositeScore(pixelsCaptured, memberCount = 1, growthPercent = 0) {
  const safeMembers = Math.max(memberCount, 1);
  const pixelsPerMember = pixelsCaptured / safeMembers;
  const normalizedPixels = pixelsCaptured > 0 ? Math.log10(pixelsCaptured + 1) * 100 : 0;
  const efficiencyBonus = Math.log10(pixelsPerMember + 1) * 20;
  const cappedGrowth = Math.min(Math.max(growthPercent, 0), 200);
  const growthBonus = cappedGrowth * 0.3;
  return Math.round((normalizedPixels + efficiencyBonus + growthBonus) * 100) / 100;
}

export async function getNomineesForWeek(weekId, category = null, awardType = null) {
  const whereClause = { weekId };
  if (category !== null) {
    whereClause.category = category;
  }
  if (awardType !== null) {
    whereClause.awardType = awardType;
  }

  return TOTWNominee.findAll({
    where: whereClause,
    order: [['compositeScore', 'DESC']],
    raw: true,
  });
}

export async function getWinnersForWeek(weekId) {
  return TOTWNominee.findAll({
    where: { weekId, isWinner: true },
    raw: true,
  });
}

export async function createNominee(data) {
  return TOTWNominee.create(data);
}

export async function updateNomineeVotes(nomineeId, voteCount) {
  await TOTWNominee.update({ voteCount }, { where: { id: nomineeId } });
}

export async function setWinner(nomineeId) {
  await TOTWNominee.update({ isWinner: true }, { where: { id: nomineeId } });
}

export async function getNomineeById(nomineeId) {
  return TOTWNominee.findByPk(nomineeId, { raw: true });
}

export async function getNomineeByFactionAndWeek(factionId, weekId) {
  return TOTWNominee.findOne({
    where: { factionId, weekId },
    raw: true,
  });
}

export async function getFactionWinHistory(factionId, weeksBack = 4) {
  const results = await sequelize.query(
    `SELECT tw.weekNumber, tw.year, tn.isWinner, tn.awardType
     FROM TOTWNominees tn
     JOIN TOTWWeeks tw ON tn.weekId = tw.id
     WHERE tn.factionId = ? AND tw.finalized = 1
     ORDER BY tw.year DESC, tw.weekNumber DESC
     LIMIT ?`,
    {
      replacements: [factionId, weeksBack],
      type: QueryTypes.SELECT,
    },
  );
  return results;
}

export async function getRecentWinners(weeksBack = 3) {
  const results = await sequelize.query(
    `SELECT DISTINCT tn.factionId, tw.weekNumber, tw.year
     FROM TOTWNominees tn
     JOIN TOTWWeeks tw ON tn.weekId = tw.id
     WHERE tn.isWinner = 1 AND tw.finalized = 1
     ORDER BY tw.year DESC, tw.weekNumber DESC
     LIMIT 100`,
    {
      type: QueryTypes.SELECT,
    },
  );

  const recentWinnerIds = new Set();
  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);

  for (const r of results) {
    const weekDiff = (currentYear - r.year) * 52 + (currentWeek - r.weekNumber);
    if (weekDiff <= weeksBack) {
      recentWinnerIds.add(r.factionId);
    }
  }

  return recentWinnerIds;
}

export default TOTWNominee;
