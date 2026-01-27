/*
 * Given User Consent,
 * remembered to silently approve of previously given allowances again
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';

const OIDCConsent = sequelize.define('OIDCConsent', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * User
   */
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  /*
   * OIDC Client
   */
  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  /*
   * scope actually requested for that user (subset of scope of client)
   * space seperated list
   */
  scope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  consentedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * user defined
   */
  expires: {
    type: DataTypes.DATE,
  },
}, {
  indexes: [{
    unique: true,
    name: 'uidcid',
    fields: ['uid', 'cid'],
  }],
});

/**
 * check if user consented
 * @param cid client id
 * @param uid user id
 * @return consentModel {
 *   id,
 *   cid,
 *   uid,
 *   scope: array of consented scopes, which could be more than client allows,
 *   consentedAt,
 *   expires,
 * }
 */
export async function hasUserConsent(uid, cid) {
  if (!cid || !uid) {
    return null;
  }
  try {
    const consentModel = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT * FROM OIDCConsents WHERE cid = $1 AND uid = $2 AND (expires > NOW() OR expires IS NULL)', {
        bind: [cid, uid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (consentModel) {
      consentModel.scope = consentModel.scope.split(' ');
      return consentModel;
    }
  } catch (error) {
    console.error(`SQL Error on hasUserConsent: ${error.message}`);
  }
  return null;
}

/**
 * get all consents a user has given
 * @param uid user id
 * @return [{
 *   id
 *   name,
 *   image | null,
 *   domain,
 *   expiresTs,
 * }, ...]
 */
export async function getAllConsentsOfUser(userId) {
  if (userId) {
    try {
      const consentModels = await sequelize.query(
        // eslint-disable-next-line max-len
        `SELECT co.id, c.name, c.image, c.redirectUris, co.expires FROM OIDCConsents co
    LEFT JOIN OIDCClients c ON c.id = co.cid
  WHERE co.uid = ? AND (co.expires > NOW() OR co.expires IS NULL)`,
        { replacements: [userId], type: QueryTypes.SELECT, raw: true },
      );
      if (consentModels) {
        for (let i = 0; i < consentModels.length; i += 1) {
          const model = consentModels[i];
          model.expiresTs = model.expires?.getTime();
          delete model.expires;

          let domain = model.redirectUris.split(' ')[0];
          const start = domain.indexOf('://') + 3;
          const end = domain.indexOf('/', start);
          if (end !== -1) {
            domain = domain.substring(start, end);
          } else {
            domain = domain.substring(start);
          }
          model.domain = domain;
          delete model.redirectUris;
        }
        return consentModels;
      }
    } catch (error) {
      console.error(`SQL Error on getAllConsentsOfUser: ${error.message}`);
    }
  }
  return [];
}

/**
 * remove consent by id
 * @param id consent id
 * @param uid user id
 * @return boolean success
 */
export async function removeConsentById(id, uid) {
  if (!id) {
    return false;
  }
  try {
    const count = await OIDCConsent.destroy({
      where: { id, uid },
    });
    return count !== 0;
  } catch (error) {
    console.error(`SQL Error on removeConsentById: ${error.message}`);
  }
  return false;
}

/**
 * user consents to oidc client
 * @param cid client id integer
 * @param uid user id
 * @param scope array of scopes
 * @param expiresTs | null timestampe when consent expires
 * @param existingConsent | null model of existing consent if we only add scope
 * @return id | null consent id
 */
export async function consentUser(
  cid, uid, scope, expiresTs, existingConsent = null,
) {
  try {
    const expires = expiresTs && new Date(Date.now() + expiresTs);

    /* if consent already exists, update existing consent */
    if (existingConsent
      && existingConsent.uid === uid && existingConsent.cid === cid
    ) {
      let modified = false;
      for (let i = 0; i < scope.length; i += 1) {
        if (!existingConsent.scope.has(scope[i])) {
          existingConsent.scope.push(scope[i]);
        }
        modified = true;
      }
      const { id } = existingConsent;
      if (modified) {
        const scopeString = scope.sort().join(' ');
        await sequelize.query(
          'UPDATE OIDCConsents SET scope = ?, expires = ? WHERE id = ?', {
            replacements: [scopeString, expires, id],
            raw: true,
            type: QueryTypes.UPDATE,
          },
        );
      }
      return id;
    }

    const scopeString = scope.sort().join(' ');
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCConsents (cid, uid, scope, expires, consentedAt) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE scope = VALUES(scope), expires = VALUES(expires), consentedAt = VALUES(consentedAt)', {
        replacements: [cid, uid, scopeString, expires],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    const consentModel = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT id FROM OIDCConsents WHERE cid = ? AND uid = ? AND (expires > NOW() OR expires IS NULL)', {
        replacements: [cid, uid, scopeString],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    return consentModel?.id;
  } catch (error) {
    console.error(`SQL Error on consent: ${error.message}`);
  }
  return null;
}

export default OIDCConsent;
