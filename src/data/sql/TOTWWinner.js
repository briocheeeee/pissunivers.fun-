import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { TOTW_CATEGORY, TOTW_AWARD_TYPE } from './TOTWWeek.js';

const TOTWWinner = sequelize.define('TOTWWinner', {
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

  nomineeId: {
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

  compositeScore: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },

  pixelsCaptured: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  memberCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  rewardApplied: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  rewardExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['weekId', 'category', 'awardType'],
      unique: true,
    },
    {
      fields: ['factionId'],
    },
    {
      fields: ['rewardApplied', 'rewardExpiresAt'],
    },
  ],
});

export async function createWinner(data) {
  return TOTWWinner.create(data);
}

export async function getWinnersForWeek(weekId) {
  return TOTWWinner.findAll({
    where: { weekId },
    raw: true,
  });
}

export async function getHallOfFame(limit = 50, offset = 0) {
  const results = await sequelize.query(
    `SELECT tw.id as winnerId, tw.weekId, tw.factionId, tw.category, tw.awardType,
            tw.compositeScore, tw.pixelsCaptured, tw.memberCount, tw.createdAt,
            f.name as factionName, f.tag as factionTag, f.avatar as factionAvatar,
            wk.weekNumber, wk.year
     FROM TOTWWinners tw
     JOIN Factions f ON tw.factionId = f.id
     JOIN TOTWWeeks wk ON tw.weekId = wk.id
     ORDER BY wk.year DESC, wk.weekNumber DESC, tw.awardType ASC
     LIMIT ? OFFSET ?`,
    {
      replacements: [limit, offset],
      type: QueryTypes.SELECT,
    },
  );
  return results;
}

export async function getHallOfFameCount() {
  return TOTWWinner.count();
}

export async function getFactionWinCount(factionId) {
  return TOTWWinner.count({ where: { factionId } });
}

export async function getFactionWins(factionId, limit = 10) {
  const results = await sequelize.query(
    `SELECT tw.*, wk.weekNumber, wk.year
     FROM TOTWWinners tw
     JOIN TOTWWeeks wk ON tw.weekId = wk.id
     WHERE tw.factionId = ?
     ORDER BY wk.year DESC, wk.weekNumber DESC
     LIMIT ?`,
    {
      replacements: [factionId, limit],
      type: QueryTypes.SELECT,
    },
  );
  return results;
}

export async function getActiveRewards() {
  return TOTWWinner.findAll({
    where: {
      rewardApplied: true,
    },
    raw: true,
  });
}

export async function setRewardApplied(winnerId, expiresAt) {
  await TOTWWinner.update(
    { rewardApplied: true, rewardExpiresAt: expiresAt },
    { where: { id: winnerId } },
  );
}

export async function expireRewards() {
  const now = new Date();
  await TOTWWinner.update(
    { rewardApplied: false },
    {
      where: {
        rewardApplied: true,
        rewardExpiresAt: { [sequelize.Sequelize.Op.lt]: now },
      },
    },
  );
}

export async function getTopFactions(limit = 10) {
  const results = await sequelize.query(
    `SELECT factionId, COUNT(*) as winCount,
            f.name as factionName, f.tag as factionTag, f.avatar as factionAvatar
     FROM TOTWWinners tw
     JOIN Factions f ON tw.factionId = f.id
     GROUP BY factionId
     ORDER BY winCount DESC
     LIMIT ?`,
    {
      replacements: [limit],
      type: QueryTypes.SELECT,
    },
  );
  return results;
}

export default TOTWWinner;
