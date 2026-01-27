import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { generateUUID } from '../../utils/hash.js';

export const SUSPICION_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

export const DETECTION_TYPE = {
  TIMING_ANOMALY: 'timing_anomaly',
  GEOMETRIC_PATTERN: 'geometric_pattern',
  PERFECT_LINE: 'perfect_line',
  PERFECT_CIRCLE: 'perfect_circle',
  COMBINED: 'combined',
};

export const DECISION_STATUS = {
  PENDING: 'pending',
  DISMISSED: 'dismissed',
  BANNED: 'banned',
};

const BotDetection = sequelize.define('BotDetection', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: generateUUID,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },

  ipString: {
    type: DataTypes.STRING(45),
    allowNull: false,
  },

  iid: {
    type: 'BINARY(16)',
    allowNull: true,
  },

  canvasId: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  score: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  level: {
    type: DataTypes.ENUM(SUSPICION_LEVEL.LOW, SUSPICION_LEVEL.MEDIUM, SUSPICION_LEVEL.HIGH),
    allowNull: false,
    defaultValue: SUSPICION_LEVEL.LOW,
  },

  detectionType: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },

  detectionDetails: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  locationX: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  locationY: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  videoPath: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },

  videoStartTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  videoEndTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  status: {
    type: DataTypes.ENUM(DECISION_STATUS.PENDING, DECISION_STATUS.DISMISSED, DECISION_STATUS.BANNED),
    allowNull: false,
    defaultValue: DECISION_STATUS.PENDING,
  },

  decidedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },

  decidedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function createBotDetection({
  uid,
  ipString,
  iid,
  canvasId,
  score,
  level,
  detectionType,
  detectionDetails,
  locationX,
  locationY,
}) {
  try {
    const record = await BotDetection.create({
      uid,
      ipString,
      iid,
      canvasId,
      score,
      level,
      detectionType,
      detectionDetails,
      locationX,
      locationY,
    });
    return record;
  } catch (error) {
    console.error(`SQL Error on createBotDetection: ${error.message}`);
    return null;
  }
}

export async function getBotDetections({
  status = null,
  level = null,
  page = 1,
  limit = 50,
  sortBy = 'createdAt',
  sortOrder = 'DESC',
}) {
  try {
    const where = {};
    if (status) where.status = status;
    if (level) where.level = level;

    const offset = (page - 1) * limit;

    const { count, rows } = await BotDetection.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit,
      offset,
      raw: true,
    });

    const uids = rows.filter((r) => r.uid).map((r) => r.uid);
    const userNames = {};
    if (uids.length) {
      const users = await sequelize.query(
        'SELECT id, name, username FROM Users WHERE id IN (?)',
        { replacements: [uids], type: QueryTypes.SELECT },
      );
      users.forEach((u) => {
        userNames[u.id] = { name: u.name, username: u.username };
      });
    }

    const enrichedRows = rows.map((row) => ({
      ...row,
      uuid: row.uuid ? Buffer.from(row.uuid).toString('hex') : null,
      iid: row.iid ? Buffer.from(row.iid).toString('hex') : null,
      userName: row.uid ? userNames[row.uid]?.name : null,
      userUsername: row.uid ? userNames[row.uid]?.username : null,
    }));

    return {
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      records: enrichedRows,
    };
  } catch (error) {
    console.error(`SQL Error on getBotDetections: ${error.message}`);
    return { total: 0, page: 1, totalPages: 0, records: [] };
  }
}

export async function getBotDetectionById(id) {
  try {
    const record = await BotDetection.findByPk(id, { raw: true });
    if (!record) return null;

    let userName = null;
    let userUsername = null;
    if (record.uid) {
      const user = await sequelize.query(
        'SELECT name, username FROM Users WHERE id = ?',
        { replacements: [record.uid], type: QueryTypes.SELECT, plain: true },
      );
      if (user) {
        userName = user.name;
        userUsername = user.username;
      }
    }

    return {
      ...record,
      uuid: record.uuid ? Buffer.from(record.uuid).toString('hex') : null,
      iid: record.iid ? Buffer.from(record.iid).toString('hex') : null,
      userName,
      userUsername,
    };
  } catch (error) {
    console.error(`SQL Error on getBotDetectionById: ${error.message}`);
    return null;
  }
}

export async function updateBotDetectionStatus(id, status, decidedBy) {
  try {
    await BotDetection.update(
      {
        status,
        decidedBy,
        decidedAt: new Date(),
      },
      { where: { id } },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on updateBotDetectionStatus: ${error.message}`);
    return false;
  }
}

export async function updateBotDetectionVideo(id, videoPath, videoStartTime, videoEndTime) {
  try {
    await BotDetection.update(
      { videoPath, videoStartTime, videoEndTime },
      { where: { id } },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on updateBotDetectionVideo: ${error.message}`);
    return false;
  }
}

export async function deleteBotDetectionVideo(id) {
  try {
    await BotDetection.update(
      { videoPath: null, videoStartTime: null, videoEndTime: null },
      { where: { id } },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on deleteBotDetectionVideo: ${error.message}`);
    return false;
  }
}

export async function getPendingDetectionForUser(uid, ipString) {
  try {
    const record = await BotDetection.findOne({
      where: {
        status: DECISION_STATUS.PENDING,
        ...(uid ? { uid } : { ipString }),
      },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    return record;
  } catch (error) {
    console.error(`SQL Error on getPendingDetectionForUser: ${error.message}`);
    return null;
  }
}

export async function getDetectionStats() {
  try {
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
        SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) as banned,
        SUM(CASE WHEN level = 'low' THEN 1 ELSE 0 END) as lowLevel,
        SUM(CASE WHEN level = 'medium' THEN 1 ELSE 0 END) as mediumLevel,
        SUM(CASE WHEN level = 'high' THEN 1 ELSE 0 END) as highLevel
      FROM BotDetections
    `, { type: QueryTypes.SELECT, plain: true });
    return stats;
  } catch (error) {
    console.error(`SQL Error on getDetectionStats: ${error.message}`);
    return null;
  }
}

export default BotDetection;
