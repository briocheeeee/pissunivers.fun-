import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

const DiscordTemplate = sequelize.define('DiscordTemplate', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  discordUserId: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },

  name: {
    type: DataTypes.STRING(64),
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
    type: DataTypes.BLOB('long'),
    allowNull: false,
  },

  mimetype: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'image/png',
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function getUserByDiscordId(discordUserId) {
  try {
    const user = await sequelize.query(
      'SELECT id, name, username FROM Users WHERE discordUserId = ?',
      {
        replacements: [discordUserId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return user;
  } catch (error) {
    console.error(`SQL Error on getUserByDiscordId: ${error.message}`);
    return null;
  }
}

export async function linkDiscordAccount(uid, discordUserId) {
  try {
    await sequelize.query(
      'UPDATE Users SET discordUserId = ? WHERE id = ?',
      {
        replacements: [discordUserId, uid],
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on linkDiscordAccount: ${error.message}`);
    return false;
  }
}

export async function addDiscordTemplate(uid, discordUserId, name, canvasId, x, y, width, height, imageData, mimetype) {
  try {
    const existing = await sequelize.query(
      'SELECT id FROM DiscordTemplates WHERE uid = ? AND name = ?',
      {
        replacements: [uid, name],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (existing) {
      return { error: 'Template with this name already exists' };
    }

    const template = await DiscordTemplate.create({
      uid,
      discordUserId,
      name,
      canvasId,
      x,
      y,
      width,
      height,
      imageData,
      mimetype,
    });

    return { success: true, id: template.id };
  } catch (error) {
    console.error(`SQL Error on addDiscordTemplate: ${error.message}`);
    return { error: 'Failed to add template' };
  }
}

export async function deleteDiscordTemplate(uid, name) {
  try {
    const result = await sequelize.query(
      'DELETE FROM DiscordTemplates WHERE uid = ? AND name = ?',
      {
        replacements: [uid, name],
        type: QueryTypes.DELETE,
      },
    );
    return { success: true };
  } catch (error) {
    console.error(`SQL Error on deleteDiscordTemplate: ${error.message}`);
    return { error: 'Failed to delete template' };
  }
}

export async function getDiscordTemplate(uid, name) {
  try {
    const template = await sequelize.query(
      'SELECT * FROM DiscordTemplates WHERE uid = ? AND name = ?',
      {
        replacements: [uid, name],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return template;
  } catch (error) {
    console.error(`SQL Error on getDiscordTemplate: ${error.message}`);
    return null;
  }
}

export async function getUserDiscordTemplates(uid) {
  try {
    const templates = await sequelize.query(
      'SELECT id, name, canvasId, x, y, width, height, createdAt FROM DiscordTemplates WHERE uid = ?',
      {
        replacements: [uid],
        type: QueryTypes.SELECT,
      },
    );
    return templates;
  } catch (error) {
    console.error(`SQL Error on getUserDiscordTemplates: ${error.message}`);
    return [];
  }
}

export default DiscordTemplate;
