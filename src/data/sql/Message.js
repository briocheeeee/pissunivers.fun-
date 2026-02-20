/*
 *
 * Database layout for Chat Messages
 *
 */

import Sequelize, { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import Channel from './Channel.js';

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  flag: {
    type: DataTypes.CHAR(2),
    defaultValue: 'xx',
    allowNull: false,
  },

  message: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('message', value.slice(0, 200));
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [
    {
      name: 'messages_cid_id_desc',
      fields: ['cid', 'id'],
      order: { id: 'DESC' },
    },
  ],
});

export async function storeMessage(
  flag, message, cid, uid,
) {
  try {
    const [, created] = await Promise.all([
      Channel.update({ lastMessage: Sequelize.fn('NOW') }, {
        where: { id: cid },
      }),
      Message.create({
        flag,
        message,
        cid,
        uid,
      }),
    ]);
    return created.id;
  } catch (error) {
    console.error(`SQL Error on storeMessage: ${error.message}`);
  }
  return null;
}

export async function getMessagesForChannel(cid, limit) {
  try {
    const models = await sequelize.query(
      `SELECT m.id, m.message, m.flag, m.uid, UNIX_TIMESTAMP(m.createdAt) AS 'ts',
        u.name, u.avatar, f.id AS factionId, f.tag AS factionTag, f.name AS factionName,
        (SELECT GROUP_CONCAT(LOWER(REPLACE(b.name, ' ', '')) SEPARATOR ',')
         FROM UserBadges ub
         INNER JOIN Badges b ON b.id = ub.bid
         WHERE ub.uid = m.uid) AS badges
      FROM Messages m
        INNER JOIN Users u ON u.id = m.uid
        LEFT JOIN FactionMembers fm ON fm.uid = m.uid
        LEFT JOIN Factions f ON f.id = fm.fid
      WHERE m.cid = ? ORDER BY m.createdAt DESC LIMIT ?`, {
        replacements: [cid, limit],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    const rows = [];
    let i = models.length;
    while (i > 0) {
      i -= 1;
      const { id, name, message, flag, uid, ts, factionId, factionTag, factionName, avatar, badges } = models[i];
      const faction = factionId ? { id: factionId, tag: factionTag, name: factionName } : null;
      const badgeList = badges ? badges.split(',') : [];
      rows.push([name, message, flag, uid, ts, faction, avatar, badgeList, id]);
    }
    return rows;
  } catch (error) {
    console.error(`SQL Error on getMessagesForChannel: ${error.message}`);
  }
  return [];
}

export default Message;
