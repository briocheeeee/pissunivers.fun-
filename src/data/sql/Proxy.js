
import { DataTypes } from 'sequelize';

import sequelize from './sequelize.js';

const ProxyData = sequelize.define('Proxy', {
  /*
   * store when an ip is a proxy, primary key is ip,
   * which is also the foreign key, defined in ./index.js
   */
  ip: {
    type: 'VARBINARY(8)',
    primaryKey: true,
  },

  isProxy: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },

  /*
   * type of proxy: VPN, SOCKS, etc.
   * or it not proxy: Residential, Wireless, Business
   */
  type: {
    type: DataTypes.STRING(20),
    set(value) {
      if (value) this.setDataValue('type', value.slice(0, 20));
    },
  },

  /*
   * operator of vpn if available
   */
  operator: {
    type: `${DataTypes.STRING(60)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },

  /*
   * city of ip
   */
  city: {
    type: `${DataTypes.STRING(60)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },

  /*
   * how many devices were seen using this ip, approximated by proxycheck.io
   */
  devices: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1,
    allowNull: false,
  },

  /*
   * how many devices were seen using this subnet, approximated by proxycheck.io
   */
  subnetDevices: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1,
    allowNull: false,
  },

  riskScore: {
    type: DataTypes.TINYINT.UNSIGNED,
    defaultValue: 0,
    allowNull: false,
  },

  flags: {
    type: DataTypes.STRING(500),
    set(value) {
      if (Array.isArray(value)) {
        this.setDataValue('flags', value.join(',').slice(0, 500));
      } else if (value) {
        this.setDataValue('flags', value.slice(0, 500));
      }
    },
    get() {
      const val = this.getDataValue('flags');
      return val ? val.split(',') : [];
    },
  },

  checkCount: {
    type: DataTypes.TINYINT.UNSIGNED,
    defaultValue: 1,
    allowNull: false,
  },

  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default ProxyData;
