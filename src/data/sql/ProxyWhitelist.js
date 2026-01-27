import Sequelize, { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';


const ProxyWhitelist = sequelize.define('ProxyWhitelist', {
  ip: {
    type: 'VARBINARY(8)',
    primaryKey: true,
  },

  reason: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    set(value) {
      this.setDataValue('reason', value.slice(0, 200));
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * check if ip is whitelisted
 * @param ipString ip as string
 * @return boolean
 */
export async function isWhitelisted(ipString) {
  const count = await ProxyWhitelist
    .count({
      where: { ip: Sequelize.fn('IP_TO_BIN', ipString) },
    });
  return count !== 0;
}

/**
 * whitelist ip
 * @param ipString ip as string
 * @return true if whitelisted,
 *         false if it was already whitelisted
 */
export async function whitelist(ipString) {
  const [, created] = await ProxyWhitelist.findOrCreate({
    where: { ip: Sequelize.fn('IP_TO_BIN', ipString) },
  });
  return created;
}

/**
 * remove ip from whitelist
 * @param ipString ip as string
 * @return true if unwhitelisted,
 *         false if ip wasn't whitelisted anyway
 */
export async function unwhitelist(ipString) {
  const count = await ProxyWhitelist.destroy({
    where: { ip: Sequelize.fn('IP_TO_BIN', ipString) },
  });
  return count !== 0;
}

export default ProxyWhitelist;
