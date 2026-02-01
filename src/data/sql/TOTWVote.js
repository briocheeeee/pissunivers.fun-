import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

const TOTWVote = sequelize.define('TOTWVote', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  weekId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  nomineeId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  oderId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },

  ipHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },

  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },

  votedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['weekId', 'oderId'],
      unique: true,
    },
    {
      fields: ['weekId', 'ipHash'],
      unique: true,
    },
    {
      fields: ['nomineeId'],
    },
  ],
});

export async function hasUserVoted(weekId, oderId) {
  const vote = await TOTWVote.findOne({
    where: { weekId, oderId },
    raw: true,
  });
  return !!vote;
}

export async function hasIPVoted(weekId, ipHash) {
  const vote = await TOTWVote.findOne({
    where: { weekId, ipHash },
    raw: true,
  });
  return !!vote;
}

export async function createVote(weekId, nomineeId, oderId, ipHash, userAgent, transaction = null) {
  const options = { transaction };
  return TOTWVote.create({
    weekId,
    nomineeId,
    oderId,
    ipHash,
    userAgent,
    votedAt: new Date(),
  }, options);
}

export async function getVoteCountForNominee(nomineeId) {
  return TOTWVote.count({ where: { nomineeId } });
}

export async function getVotesForWeek(weekId) {
  const results = await sequelize.query(
    `SELECT nomineeId, COUNT(*) as voteCount
     FROM TOTWVotes
     WHERE weekId = ?
     GROUP BY nomineeId
     ORDER BY voteCount DESC`,
    {
      replacements: [weekId],
      type: QueryTypes.SELECT,
    },
  );
  return results;
}

export async function getUserVoteForWeek(weekId, oderId) {
  return TOTWVote.findOne({
    where: { weekId, oderId },
    raw: true,
  });
}

export async function getTotalVotesForWeek(weekId) {
  return TOTWVote.count({ where: { weekId } });
}

export default TOTWVote;
