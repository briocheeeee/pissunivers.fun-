import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';

const MessageReaction = sequelize.define('MessageReaction', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  messageId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
  oderId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  emoji: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
  indexes: [
    {
      fields: ['messageId'],
    },
    {
      unique: true,
      fields: ['messageId', 'oderId', 'emoji'],
    },
  ],
});

export async function addReaction(messageId, oderId, emoji) {
  try {
    await MessageReaction.create({ messageId, oderId, emoji });
    return { success: true };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return { alreadyExists: true };
    }
    throw error;
  }
}

export async function removeReaction(messageId, oderId, emoji) {
  const deleted = await MessageReaction.destroy({
    where: { messageId, oderId, emoji },
  });
  return { success: deleted > 0 };
}

export async function getReactionsForMessage(messageId) {
  const reactions = await MessageReaction.findAll({
    where: { messageId },
    attributes: ['emoji', 'oderId'],
    raw: true,
  });

  const grouped = {};
  reactions.forEach((r) => {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = [];
    }
    grouped[r.emoji].push(r.oderId);
  });

  return grouped;
}

export async function getReactionsForMessages(messageIds) {
  if (!messageIds.length) return {};

  const reactions = await MessageReaction.findAll({
    where: { messageId: messageIds },
    attributes: ['messageId', 'emoji', 'oderId'],
    raw: true,
  });

  const grouped = {};
  reactions.forEach((r) => {
    if (!grouped[r.messageId]) {
      grouped[r.messageId] = {};
    }
    if (!grouped[r.messageId][r.emoji]) {
      grouped[r.messageId][r.emoji] = [];
    }
    grouped[r.messageId][r.emoji].push(r.oderId);
  });

  return grouped;
}

export default MessageReaction;
