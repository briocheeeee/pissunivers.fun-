import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

/*
 * Information of whois hosts responsible for Ranges,
 * min and max are the upper and lower bound of IPs within the range,
 * stored in the same 64bit format as IP in IP.js
 *
 * Will be kept indefinitelly, updated regularly
 */
const WhoisReferral = sequelize.define('WhoisReferral', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  min: {
    type: 'VARBINARY(8)',
    unique: 'min',
    allowNull: false,
  },

  max: {
    type: 'VARBINARY(8)',
    unique: 'max',
    allowNull: false,
  },

  mask: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  host: {
    type: DataTypes.STRING(60),
    allowNull: false,
  },

  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * Get whois server for ip
 * @param ipString ip as string
 * @return null | host
 */
export async function getWhoisHostOfIP(ipString) {
  try {
    const range = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT host FROM WhoisReferrals, (SELECT IP_TO_BIN(?) AS ip) AS b
WHERE min <= b.ip AND max >= b.ip AND LENGTH(b.ip) = LENGTH(min) AND expires > NOW()`, {
        /* eslint-disable max-len */
        replacements: [ipString, ipString, ipString],
        raw: true,
        type: QueryTypes.SELECT,
      });
    if (range.length) {
      return range[0].host;
    }
  } catch (error) {
    console.error(`SQL Error on getWhoisHostOfIP: ${error.message}`);
  }
  return null;
}

export default WhoisReferral;
