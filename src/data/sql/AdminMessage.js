import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

const AdminMessage = sequelize.define('AdminMessage', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  fromModId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  toUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function createAdminMessage(fromModId, toUserId, message) {
  const record = await AdminMessage.create({
    fromModId,
    toUserId,
    message,
  });
  return record;
}

export async function getUnreadMessagesForUser(userId) {
  const messages = await sequelize.query(
    `SELECT am.id, am.message, am.createdAt, u.name as fromName
     FROM AdminMessages am
     LEFT JOIN Users u ON u.id = am.fromModId
     WHERE am.toUserId = ? AND am.readAt IS NULL
     ORDER BY am.createdAt DESC
     LIMIT 10`,
    {
      replacements: [userId],
      type: QueryTypes.SELECT,
    },
  );
  return messages;
}

export async function markMessageAsRead(messageId, userId) {
  const result = await AdminMessage.update(
    { readAt: new Date() },
    { where: { id: messageId, toUserId: userId, readAt: null } },
  );
  return result[0] > 0;
}

export async function markAllMessagesAsRead(userId) {
  const result = await AdminMessage.update(
    { readAt: new Date() },
    { where: { toUserId: userId, readAt: null } },
  );
  return result[0];
}

export async function getMessagesSentByMod(modId, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const messages = await sequelize.query(
    `SELECT am.id, am.toUserId, am.message, am.readAt, am.createdAt, u.name as toName
     FROM AdminMessages am
     LEFT JOIN Users u ON u.id = am.toUserId
     WHERE am.fromModId = ?
     ORDER BY am.createdAt DESC
     LIMIT ? OFFSET ?`,
    {
      replacements: [modId, limit, offset],
      type: QueryTypes.SELECT,
    },
  );
  return messages;
}

export async function countMessagesSentToUserToday(modId, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result = await sequelize.query(
    `SELECT COUNT(*) as count FROM AdminMessages
     WHERE fromModId = ? AND toUserId = ? AND createdAt >= ?`,
    {
      replacements: [modId, userId, today],
      type: QueryTypes.SELECT,
      plain: true,
    },
  );
  return result?.count || 0;
}

export default AdminMessage;
