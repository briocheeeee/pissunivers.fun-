/*
 * stores perceptive hashes for images
 */
import { DataTypes } from 'sequelize';

import sequelize from './sequelize.js';

const ImageHash = sequelize.define('ImageHash', {
  /*
   * id of media table, primary key and foreign key
   */
  mid: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },

  /*
   * perceptive hash, 64bit integer, resolved via hamming distance
   */
  pHash: {
    type: 'BINARY(8)',
    allowNull: false,
  },
}, {
  indexes: [{
    unique: false,
    name: 'phash',
    fields: ['pHash'],
  }],
});

export default ImageHash;
