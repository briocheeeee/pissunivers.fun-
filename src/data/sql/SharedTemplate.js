import { DataTypes, Op } from 'sequelize';
import sequelize from './sequelize.js';
import { generateUUID } from '../../utils/hash.js';

const SharedTemplate = sequelize.define('SharedTemplate', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uuid: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: 'uuid',
  },

  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },

  canvasId: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  x: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  y: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  width: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  height: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  imageData: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },

  mimetype: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'image/png',
  },

  accessCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  lastAccessedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function createSharedTemplate({
  userId,
  title,
  canvasId,
  x,
  y,
  width,
  height,
  imageData,
  mimetype,
}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const uuidBuffer = generateUUID();
  const uuid = Buffer.from(uuidBuffer).toString('hex');

  const record = await SharedTemplate.create({
    uuid,
    userId,
    title,
    canvasId,
    x,
    y,
    width,
    height,
    imageData,
    mimetype,
    expiresAt,
  });

  return {
    id: record.id,
    uuid,
  };
}

export async function getSharedTemplateByUuid(uuid) {
  const record = await SharedTemplate.findOne({
    where: { uuid },
    raw: true,
  });

  if (!record) return null;

  if (new Date(record.expiresAt) < new Date()) {
    await SharedTemplate.destroy({ where: { id: record.id } });
    return null;
  }

  await SharedTemplate.update(
    {
      accessCount: record.accessCount + 1,
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    { where: { id: record.id } },
  );

  return {
    ...record,
    imageData: record.imageData,
  };
}

export async function getUserSharedTemplates(userId) {
  const records = await SharedTemplate.findAll({
    where: { userId },
    attributes: ['id', 'uuid', 'title', 'canvasId', 'x', 'y', 'width', 'height', 'accessCount', 'createdAt', 'expiresAt'],
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  return records;
}

export async function deleteSharedTemplate(uuid, userId) {
  const result = await SharedTemplate.destroy({
    where: { uuid, userId },
  });
  return result > 0;
}

export async function countUserSharedTemplates(userId) {
  return SharedTemplate.count({ where: { userId } });
}

export async function cleanupExpiredTemplates() {
  const result = await SharedTemplate.destroy({
    where: {
      expiresAt: { [Op.lt]: new Date() },
    },
  });
  return result;
}

export default SharedTemplate;
