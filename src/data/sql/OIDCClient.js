/*
 * store OIDC Relying Parties aka Clients aka other websites wanting to use our login
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateUUID, generateToken, bufferToUUID } from '../../utils/hash.js';

const OIDCClient = sequelize.define('OIDCClient', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * user that created this client
   */
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: 'name',
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: generateUUID,
  },

  secret: {
    type: DataTypes.CHAR(40),
    allowNull: false,
    defaultValue: generateToken,
  },

  image: {
    type: DataTypes.STRING(255),
  },

  /*
   * space seperated list of uris
   */
  redirectUris: {
    type: `${DataTypes.TEXT} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  /*
   * max scopes that client is allowed, user then can choose a subset
   */
  scope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    defaultValue: 'openid profile email',
    allowNull: false,
  },

  /*
   * scopes used when no scope is given
   */
  defaultScope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
  },

  /*
   * whether we automatically grant every request, ONLY use this for own
   * services on same domain
   */
  autoGrant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },

  lastUsed: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * get OIDC client
 * @param uuid client uuid, named client_id in auth requests
 * @return clientModel {
 *   id,
 *   name,
 *   secret,
 *   scope: array of allowed scopes,
 *   defaultScope: array of default scopes,
 *   redirectUris: array of allowed redirect uris,
 *   autoGrant,
 * }
 */
export async function getOIDCClient(uuid) {
  if (!uuid) {
    return null;
  }
  try {
    const clientModel = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT id, name, secret, redirectUris, scope, defaultScope, autoGrant FROM OIDCClients WHERE uuid = UUID_TO_BIN($1)', {
        bind: [uuid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (clientModel) {
      clientModel.scope = clientModel.scope.split(' ');
      if (clientModel.defaultScope) {
        clientModel.defaultScope = clientModel.defaultScope.split(' ');
      }
      clientModel.redirectUris = clientModel.redirectUris.split(' ');
      return clientModel;
    }
  } catch (error) {
    console.error(`SQL Error on getOIDCClient: ${error.message}`);
  }
  return null;
}

/**
 * update the last used time of a client
 * @param id integer id of the client
 */
export async function touchOIDCClient(id) {
  try {
    await sequelize.query(
      'UPDATE OIDCClients SET lastUsed = NOW() WHERE id = $1', {
        bind: [id],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
  } catch (error) {
    console.error(`SQL Error on touchOIDCClient: ${error.message}`);
  }
}

/**
 * get all OIDC clients of user
 * @param userId user id
 */
export async function getAllClientsOfUser(userId) {
  try {
    const oidcClients = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT id, name, secret, redirectUris, scope, defaultScope, BIN_TO_UUID(uuid) AS uuid FROM OIDCClients WHERE uid = ?', {
        replacements: [userId],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    if (oidcClients) {
      return oidcClients;
    }
  } catch (error) {
    console.error(`SQL Error on getAllClientsOfUser: ${error.message}`);
  }
  return [];
}

/**
 * delete a client of a user
 * @param userId user id
 * @param uuid uuid of client
 */
export async function deleteClient(userId, uuid) {
  if (!userId || !uuid) {
    return false;
  }
  try {
    await sequelize.query(
      // eslint-disable-next-line max-len
      'DELETE FROM OIDCClients WHERE uid = ? AND uuid = UUID_TO_BIN(?)', {
        replacements: [userId, uuid],
        raw: true,
        type: QueryTypes.DELETE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on getAllClientsOfUser: ${error.message}`);
  }
  return false;
}

/**
 * create new OIDC client
 * @param uid userId of whoever registers the client
 * @param scope Array of wanted scopes
 * @param redirectUris Array of accepted redirect urls
 * @param rerollSecret whether or not we generate a new secret on client change
 * Throws an error if something is wrong
 * @return {
 *   clientSecret,
 *   clientId: the uuid for the client, not the integer id,
 * }
 */
export async function createOIDCClient(
  uid, name, scope, redirectUris, image = null, defaultScope = null,
  uuid = null, rerollSecret = false,
) {
  if (!uid) {
    throw new Error('You are not logged in');
  }
  scope = scope.sort().join(' ');
  if (defaultScope) {
    defaultScope = defaultScope.sort().join(' ');
  }
  redirectUris = redirectUris.join(' ');

  const existingClients = await sequelize.query(
    // eslint-disable-next-line max-len
    'SELECT name, id, secret, BIN_TO_UUID(uuid) AS uuid, secret FROM OIDCClients WHERE uid = ?', {
      replacements: [uid],
      raw: true,
      type: QueryTypes.SELECT,
    },
  );
  if (uuid) {
    for (let i = 0; i < existingClients.length; i += 1) {
      const client = existingClients[i];
      if (client.uuid === uuid) {
        if (client.name !== name) {
          // eslint-disable-next-line no-await-in-loop
          const nameCheck = await sequelize.query(
            // eslint-disable-next-line max-len
            'SELECT id FROM OIDCClients WHERE name = ?', {
              replacements: [name],
              plain: true,
              type: QueryTypes.SELECT,
            },
          );
          if (nameCheck) {
            throw new Error('This name is already taken');
          }
        }
        /* user already has this client registered */
        const secret = (rerollSecret) ? generateToken() : client.secret;
        // eslint-disable-next-line no-await-in-loop
        await sequelize.query(
          // eslint-disable-next-line max-len
          'UPDATE OIDCClients SET name = ?, image = ?, redirectUris = ?, scope = ?, defaultScope = ?, secret = ? WHERE id = ?', {
            replacements: [
              name, image, redirectUris, scope, defaultScope, secret,
              client.id,
            ],
            raw: true,
            type: QueryTypes.UPDATE,
          },
        );
        return {
          clientSecret: secret,
          clientId: client.uuid,
        };
      }
    }
    throw new Error('No such client exists or you do not have access to it');
  }
  if (existingClients.length >= 5) {
    throw new Error('You can only register 5 clients max');
  }

  const secret = generateToken();

  while (!uuid) {
    uuid = bufferToUUID(generateUUID());
    // eslint-disable-next-line no-await-in-loop
    const existingClient = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT name, BIN_TO_UUID(uuid) AS uuid FROM OIDCClients WHERE uuid = UUID_TO_BIN(?) OR name = ?', {
        replacements: [uuid, name],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (existingClient && existingClient.uuid === uuid) {
      uuid = null;
    }
    if (existingClient && existingClient.name === name) {
      throw new Error('This name is already taken');
    }
  }

  await sequelize.query(
    // eslint-disable-next-line max-len
    'INSERT INTO OIDCClients (uid, name, image, uuid, secret, redirectUris, scope, defaultScope, autoGrant, createdAt) VALUES (?, ?, ?, UUID_TO_BIN(?), ?, ?, ?, ?, ?, NOW())', {
      replacements: [
        uid, name, image, uuid, secret, redirectUris, scope, null, false,
      ],
      raw: true,
      type: QueryTypes.INSERT,
    },
  );
  return { clientSecret: secret, clientId: uuid };
}

export default OIDCClient;
