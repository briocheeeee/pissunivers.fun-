import { QueryTypes, DataTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { getRandomShortId } from '../../core/utils.js';

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  hash: {
    type: 'BINARY(32)',
    unique: 'hash',
    allowNull: false,
  },

  /*
   * SELECT
   i d,  *
   filename,
   BIT_COUNT(phash ^ @target_hash) AS hamming_distance,
                               phash
                               FROM images
                               WHERE BIT_COUNT(phash ^ @target_hash) <= 5
                               ORDER BY hamming_distance
                               LIMIT 20;
  */

  /*
   * short identifier for file, will be 6 chars usually, but can be more
   */
  shortId: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },

  extension: {
    type: DataTypes.STRING(12),
    allowNull: false,
  },

  mimeType: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },

  /*
   * 'audio', 'video', etc.
   */
  type: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },

  size: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  /*
   * from lowest to highest bit:
   * 0: registeredUsersOnly (if only registered users can view it)
   * 1: allowCORS (if allowing cors)
   * 2: needsApproval
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  /*
   * count active references, may or may not be used
   */
  refCounter: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false,
  },

  /*
   * time to expire, NULL if infinite
   */
  expires: {
    type: DataTypes.DATE,
  },

  /*
   * time a file has been uploaded, may be updated on reupload or check
   */
  lastUpload: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    unique: true,
    name: 'filename',
    fields: ['shortId', 'mimeType'],
  }],
});

/**
 * get filename of media if exists, adds 'shortId' and 'extension' to hashes
 * objects where a corresponding hash exists
 * @param hashes [{
 *   hash,
 *   mimeType,
 * }, ...]
 * @return success boolean
 */
export async function hasMedia(hashes) {
  if (!hashes?.length) {
    return true;
  }
  if (!Array.isArray(hashes)) {
    hashes = [hashes];
  }
  console.log('check if media exists', hashes);

  try {
    const replacements = [];
    for (let i = 0; i < hashes.length; i += 1) {
      replacements.push(hashes[i].hash, hashes[i].mimeType);
    }

    const mediaModels = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT HEX(hash) AS hash, mimeType, extension, shortId FROM Media WHERE ${
        hashes.map(
          () => '( hash = UNHEX(?) AND mimeType = ? )',
        ).join(' OR ')
      }`, {
        replacements,
        type: QueryTypes.SELECT,
        raw: true,
      },
    );

    if (mediaModels.length) {
      console.log('media already exists');
      /*
       * upldate lastUpload timestamp, if we would be on MariaDB only, we could
       * use RETURNING and merge it together with the SELECT query
       */
      sequelize.query(
        'UPDATE Media SET lastUsed = NOW() WHERE id = ?', {
          replacements: mediaModels.map((model) => model.id),
          type: QueryTypes.UPDATE,
        },
      ).catch((error) => {
        console.error(`SQL Error on hasMedia: ${error.message}`);
      });

      for (let i = 0; i < mediaModels.length; i += 1) {
        const model = mediaModels[i];
        const hash = hashes.find(
          (h) => h.hash === model.hash && h.mimeType === model.mimeType,
        );
        if (hash) {
          hash.extension = model.extension;
          hash.shortId = model.shortId;
        }
      }
      return true;
    }
  } catch (error) {
    console.error(`SQL Error on hasMedia: ${error.message}`);
  }
  return false;
}

export async function deregisterMedia(hash, mimeType) {
  try {
    console.log(`MEDIA: deregister ${hash}`);
    await sequelize.query(
      'DELETE FROM Media WHERE hash = UNHEX(?) AND mimeType = ?', {
        replacements: [hash, mimeType],
        type: QueryTypes.DELETE,
        raw: true,
      });
  } catch (error) {
    console.error(`SQL Error on deregisterMedia: ${error.message}`);
  }
}

/**
 * register new media
 */
export async function registerMedia(
  hash, extension, mimeType, type, size, name, contentHash = null,
) {
  try {
    /*
     * shortId is a random 6 character string of a-z
     */
    let shortId;
    let exists;
    do {
      shortId = getRandomShortId();
      // eslint-disable-next-line no-await-in-loop
      exists = await sequelize.query(
        'SELECT 1 FROM Media WHERE shortId = ? AND mimeType = ?', {
          replacements: [shortId, mimeType],
          plain: true,
          type: QueryTypes.SELECT,
        },
      );
      console.log('roll', shortId);
    } while (exists);
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Media (hash, shortId, extension, mimeType, type, size, contentHash, lastUpload) VALUES (UNHEX(?), ?, ?, ?, ?, ?, UNHEX(?), NOW()) ON DUPLICATE KEY UPDATE lastUpload = VALUES(lastUpload)', {
        replacements: [
          hash, shortId, extension, mimeType, type, size, contentHash,
        ],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return {
      hash,
      name,
      mimeType,
      shortId,
      extension,
    };
  } catch (error) {
    console.error(`SQL Error on registerMedia: ${error.message}`);
  }
  return null;
}

export default Media;
