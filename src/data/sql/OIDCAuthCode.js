/*
 * OIDC Authorization Codes,
 * those are codes given to the user on the login page, that he transfers to the
 * replying party (client), which the client then uses to request tokens.
 * They are single-time use.
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateLargeToken } from '../../utils/hash.js';

const OIDCAuthCode = sequelize.define('OIDCAuthCode', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
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

  code: {
    type: DataTypes.CHAR(80),
    allowNull: false,
    unique: 'code',
    defaultValue: generateLargeToken,
  },

  /*
   * scope actually approved that user (subset of scope of client)
   */
  scope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  nonce: {
    type: DataTypes.STRING(255),
  },

  authAge: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  pkceChallenge: {
    type: DataTypes.STRING(255),
  },

  pkceMethod: {
    type: DataTypes.STRING(10),
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * short-lived (minutes)
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * create new Auth Code
 * @param consentId OIDCConsent id
 * @param scope array of scopes
 * @param pkceChallenge | null
 * @param pkceMethod | null
 * @param authAge age of session
 * @param nonce
 * @return code Authorization Code
 */
export async function createAuthCode(
  consentId, scope,
  pkceChallenge = null, pkceMethod = null, authAge = null, nonce = null,
) {
  try {
    const code = generateLargeToken();
    await sequelize.query(
      /*
       * minimum 10 minues expiration time is OIDC recommendation
       */
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCAuthCodes (cid, code, scope, pkceChallenge, pkceMethod, authAge, nonce, expires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL 12 MINUTE, NOW())', {
        replacements: [
          consentId, code, scope.sort().join(' '),
          pkceChallenge, pkceMethod, authAge, nonce,
        ],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return code;
  } catch (error) {
    console.error(`SQL Error on createAuthCode: ${error.message}`);
  }
  return null;
}

/**
 * consume auth code
 * @param cid client id
 * @param uid user id
 * @return {
 *   cid,
 *   uid,
 *   pkceChallenge,
 *   pkceMethod,
 *   scope,
 * }
 */
export async function consumeAuthCode(code) {
  if (!code) {
    return null;
  }
  try {
    const authCodeModel = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT ac.id, ac.scope, ac.pkceChallenge, ac.pkceMethod, ac.nonce, co.scope AS consentedScope, ac.authAge, co.uid, ac.cid, co.cid AS clientIntId FROM OIDCAuthCodes ac
  INNER JOIN OIDCConsents co ON co.id = ac.cid
WHERE ac.code = $1 AND ac.expires > NOW()`, {
        bind: [code],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (authCodeModel) {
      /*
       * code is single-use
       */
      await sequelize.query(
        'DELETE ac FROM OIDCAuthCodes ac WHERE id = $1', {
          bind: [authCodeModel.id],
          type: QueryTypes.DELETE,
          raw: true,
        },
      );
      delete authCodeModel.id;
      /*
       * make sure consent to scope is still given, afaik not required by spec
       */
      let { consentedScope } = authCodeModel;
      consentedScope = consentedScope.split(' ');
      authCodeModel.scope = authCodeModel.scope.split(' ').filter(
        (s) => consentedScope.includes(s),
      );
      delete authCodeModel.consentedScope;

      return authCodeModel;
    }
  } catch (error) {
    console.error(`SQL Error on consumeAuthCode: ${error.message}`);
  }
  return null;
}

export default OIDCAuthCode;
