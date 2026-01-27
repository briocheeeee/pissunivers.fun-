/*
 * OIDC Refresh Tokens
 * tokens used to get new access tokens, they are single-use and grant a new
 * refresh token each time.
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateLargeToken } from '../../utils/hash.js';

const OIDCRefreshToken = sequelize.define('OIDCRefreshToken', {
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
   * a month or so, gets rerolled whenever a new refresh token gets requested
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * consume refresh token
 * @param cid client id
 * @param uid user id
 * @return {
 *   cid,
 *   uid,
 *   scope,
 * }
 */
export async function consumeRefreshToken(token) {
  if (!token) {
    return null;
  }
  try {
    const refreshModel = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT rt.id, rt.scope, co.scope AS consentedScope, co.uid, rt.cid, co.cid AS clientIntId FROM OIDCRefreshTokens rt
  INNER JOIN OIDCConsents co ON co.id = rt.cid
WHERE rt.token = $1 AND rt.expires > NOW()`, {
        bind: [token],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (refreshModel) {
      /*
       * token is single-use
       */
      await sequelize.query(
        'DELETE rt FROM OIDCRefreshTokens rt WHERE id = $1', {
          bind: [refreshModel.id],
          type: QueryTypes.DELETE,
          raw: true,
        },
      );
      delete refreshModel.id;
      /*
       * make sure consent to scope is still given, afaik not required by spec
       */
      let { consentedScope } = refreshModel;
      consentedScope = consentedScope.split(' ');
      refreshModel.scope = refreshModel.scope.split(' ').filter(
        (s) => consentedScope.includes(s),
      );
      delete refreshModel.consentedScope;

      return refreshModel;
    }
  } catch (error) {
    console.error(`SQL Error on consumeRefreshToken: ${error.message}`);
  }
  return null;
}

/**
 * create new Refresh Token
 * @param consentId OIDCConsent id
 * @param scope array of scopes
 * @return token
 */
export async function createRefreshToken(consentId, scope) {
  try {
    const token = generateLargeToken();
    await sequelize.query(
      /*
       * reminder that if you change epiration time, to change it in token.js
       * for payload.refresh_expires_in as well
       */
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCRefreshTokens (cid, token, scope, expires, createdAt) VALUES (?, ?, ?, NOW() + INTERVAL 90 DAY, NOW())', {
        replacements: [consentId, token, scope.sort().join(' ')],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return token;
  } catch (error) {
    console.error(`SQL Error on createRefreshToken: ${error.message}`);
  }
  return null;
}

export default OIDCRefreshToken;
