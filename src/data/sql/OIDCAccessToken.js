/*
 * OIDC Access Tokens
 * those are tokens with which the relying party (client) can request actual
 * use data, they are short-lived
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateLargeToken } from '../../utils/hash.js';

const OIDCAccessToken = sequelize.define('OIDCAccessToken', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * OIDC Consent
   */
  cid: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  token: {
    type: DataTypes.CHAR(80),
    allowNull: false,
    unique: 'token',
    defaultValue: generateLargeToken,
  },

  scope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * short-lived (hours)
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * create new Access Token
 * @param consentId OIDCConsent id
 * @param scope array of scopes
 * @return token
 */
export async function createAccessToken(consentId, scope) {
  try {
    const token = generateLargeToken();
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCAccessTokens (cid, token, scope, expires, createdAt) VALUES (?, ?, ?, NOW() + INTERVAL 1 HOUR, NOW())', {
        replacements: [consentId, token, scope.sort().join(' ')],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return token;
  } catch (error) {
    console.error(`SQL Error on createAccessToken: ${error.message}`);
  }
  return null;
}


/**
 * get scope and uid of access token
 * @param cid client id
 * @param uid user id
 * @return {
 *   uid,
 *   scope,
 *   clientId,
 *   clientIntId,
 * }
 */
export async function getAccessToken(token) {
  if (!token) {
    return null;
  }
  try {
    const accessModel = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT t.scope, co.uid, co.cid AS clientIntId, BIN_TO_UUID(cl.uuid) AS clientId FROM OIDCAccessTokens t
  INNER JOIN OIDCConsents co ON co.id = t.cid
  INNER JOIN OIDCClients cl ON co.cid = cl.id
WHERE t.token = $1 AND t.expires > NOW()`, {
        bind: [token],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (accessModel) {
      accessModel.scope = accessModel.scope.split(' ');
      return accessModel;
    }
  } catch (error) {
    console.error(`SQL Error on consumeRefreshToken: ${error.message}`);
  }
  return null;
}

export default OIDCAccessToken;
