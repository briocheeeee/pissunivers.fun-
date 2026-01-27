import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

const FactionRequest = sequelize.define('FactionRequest', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['fid', 'uid'],
      name: 'faction_request_unique',
    },
  ],
});

export async function createJoinRequest(factionId, userId) {
  try {
    await FactionRequest.create({
      fid: factionId,
      uid: userId,
    });
    return true;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return false;
    }
    console.error(`SQL Error on createJoinRequest: ${error.message}`);
    return false;
  }
}

export async function getJoinRequests(factionId, limit = 50, offset = 0) {
  try {
    const requests = await sequelize.query(
      `SELECT fr.id, fr.uid, u.name, fr.createdAt
       FROM FactionRequests fr
       INNER JOIN Users u ON u.id = fr.uid
       WHERE fr.fid = ?
       ORDER BY fr.createdAt ASC
       LIMIT ? OFFSET ?`,
      {
        replacements: [factionId, limit, offset],
        type: QueryTypes.SELECT,
      },
    );
    return requests;
  } catch (error) {
    console.error(`SQL Error on getJoinRequests: ${error.message}`);
    return [];
  }
}

export async function getJoinRequestCount(factionId) {
  try {
    const result = await sequelize.query(
      'SELECT COUNT(*) as count FROM FactionRequests WHERE fid = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return result ? result.count : 0;
  } catch (error) {
    console.error(`SQL Error on getJoinRequestCount: ${error.message}`);
    return 0;
  }
}

export async function hasJoinRequest(factionId, userId) {
  try {
    const result = await FactionRequest.findOne({
      where: { fid: factionId, uid: userId },
      raw: true,
    });
    return !!result;
  } catch (error) {
    console.error(`SQL Error on hasJoinRequest: ${error.message}`);
    return false;
  }
}

export async function deleteJoinRequest(factionId, userId) {
  try {
    const result = await FactionRequest.destroy({
      where: { fid: factionId, uid: userId },
    });
    return result > 0;
  } catch (error) {
    console.error(`SQL Error on deleteJoinRequest: ${error.message}`);
    return false;
  }
}

export async function deleteJoinRequestById(requestId) {
  try {
    const result = await FactionRequest.destroy({
      where: { id: requestId },
    });
    return result > 0;
  } catch (error) {
    console.error(`SQL Error on deleteJoinRequestById: ${error.message}`);
    return false;
  }
}

export async function getUserPendingRequest(userId) {
  try {
    const result = await sequelize.query(
      `SELECT fr.id, fr.fid, f.name, f.tag
       FROM FactionRequests fr
       INNER JOIN Factions f ON f.id = fr.fid
       WHERE fr.uid = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getUserPendingRequest: ${error.message}`);
    return null;
  }
}

export default FactionRequest;
