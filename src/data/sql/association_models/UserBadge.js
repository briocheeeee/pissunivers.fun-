/*
 * Badges owned by User
 */

import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

export default sequelize.define('UserBadge', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  note: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});
