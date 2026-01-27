/*
 * bans of mdia
 */
import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateUUID } from '../../utils/hash.js';

const MediaBan = sequelize.define('MediaBan', {
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

  muid: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  /*
   * according to MEDIA_BAN_REASONS
   * 1: gore,
   * 2: csam,
   * 3: scam,
   * 4: terrorism,
   */
  reason: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  pHash: {
    type: 'BINARY(8)',
    unique: 'phash',
  },

  hash: {
    type: 'BINARY(32)',
    unique: 'hash',
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function hasMediaBan(hash, pHash) {
  const where = [];
  const replacements = [];
  if (hash) {
    where.push('hash = UNHEX(?)');
    replacements.push(hash);
  }
  if (pHash) {
    where.push('pHash = UNHEX(?)');
    replacements.push(pHash);
  }
  if (where.length) {
    try {
      const model = await sequelize.query(
        `SELECT reason FROM MediaBans WHERE ${where.join(' OR ')}`, {
          replacements,
          type: QueryTypes.SELECT,
          plain: true,
        },
      );
      if (model) {
        return model.reason;
      }
    } catch (error) {
      console.error(`SQL Error on hasUserConsent: ${error.message}`);
    }
  }
  return 0;
}

export default MediaBan;
