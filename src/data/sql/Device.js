import { QueryTypes, DataTypes } from 'sequelize';

import sequelize from './sequelize.js';

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  hash: {
    type: `${DataTypes.CHAR(15)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'hash',
  },

  os: {
    type: DataTypes.STRING(20),
  },

  browser: {
    type: DataTypes.STRING(20),
  },

  device: {
    type: DataTypes.STRING(20),
  },

  headerSig: {
    type: `${DataTypes.CHAR(12)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * get device id to hash
 * @param hash
 * @return { id, lastSeen } | null
 */
export async function getDeviceIdByHash(hash) {
  try {
    const result = await sequelize.query(
      'SELECT id, lastSeen FROM Devices WHERE hash = $1',
      { bind: [hash], type: QueryTypes.SELECT, plain: true },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getDeviceIdByHash: ${error.message}`);
  }
  return null;
}

/**
 * get existing device id or create new one
 * @param device { hash, device, browser, os, headerSignature }
 * @return { id, lastSeen } | null
 */
export async function upsertDevice({
  hash, device, browser, os, headerSignature,
}) {
  try {
    let result = await getDeviceIdByHash(hash);
    if (result) {
      return result;
    }
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Devices (hash, os, browser, device, headerSig, lastSeen) VALUES (?, ?, ?, ?, ?, NOW())', {
        replacements: [hash, os, browser, device, headerSignature],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    result = await getDeviceIdByHash(hash);
    return result;
  } catch (error) {
    console.error(`SQL Error on getDeviceIdByHash: ${error.message}`);
  }
  return null;
}

/**
 * update lastSeen timestamps of Device
 * @param hash
 * @return sucess boolean
 */
export async function touchDevice(deviceId) {
  try {
    await sequelize.query(
      'UPDATE Devices SET lastSeen = NOW() WHERE id = $1', {
        bind: [deviceId],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on touchDeviceById: ${error.message}`);
  }
  return false;
}

export default Device;
