import Sequelize, { DataTypes, Op, QueryTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import BanHistory from './BanHistory.js';
import { getIPsOfIIDs } from './IP.js';
import IPBan from './association_models/IPBan.js';
import UserBan from './association_models/UserBan.js';
import ThreePID from './ThreePID.js';
import ThreePIDBan from './association_models/ThreePIDBan.js';
import IPBanHistory from './association_models/IPBanHistory.js';
import UserBanHistory from './association_models/UserBanHistory.js';
import ThreePIDBanHistory from './association_models/ThreePIDBanHistory.js';
import { generateUUID } from '../../utils/hash.js';

const Ban = sequelize.define('Ban', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: generateUUID,
  },

  reason: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('reason', value.slice(0, 200));
    },
  },

  /*
   * from lowest to highest bit:
   * 0: banned from placing in game
   * 1: banned from chat
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  /*
   * NULL if infinite
   */
  expires: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * Given a list of bans, determine if we are banned or muted or both,
 * and what is the best time to re-check
 * @param bans [ { expires, flags,... },... ]
 * isBanned and isMuted are false or true if perma banned and timestamp
 * otherwise
 * @return [ isBanned, isMuted, banRecheckTs ]
 */
export function parseListOfBans(bans) {
  let isBanned = false;
  let isMuted = false;
  let banRecheckTs = null;

  if (bans.length) {
    let i = bans.length;
    while (i > 0) {
      i -= 1;
      const { expires, flags } = bans[i];
      if (flags & 0x01) {
        if (isBanned !== true) {
          if (expires === null) {
            isBanned = true;
          } else {
            const expiresTs = expires.getTime();
            if (isBanned === false || expiresTs > isBanned) {
              isBanned = expiresTs;
            }
          }
        }
      }
      if (flags & 0x02) {
        if (isMuted !== true) {
          if (expires === null) {
            isMuted = true;
          } else {
            const expiresTs = expires.getTime();
            if (isMuted === false || expiresTs > isMuted) {
              isMuted = expiresTs;
            }
          }
        }
      }
    }

    /* in case we have expired bans lingering */
    const currentTs = Date.now();
    if (isMuted && isMuted !== true && isMuted < currentTs) {
      isMuted = false;
    }
    if (isBanned && isBanned !== true && isBanned < currentTs) {
      isBanned = false;
    }

    const isBannedIsInteger = Number.isInteger(isBanned);
    const isMutedIsInteger = Number.isInteger(isMuted);
    if (isBannedIsInteger || isMutedIsInteger) {
      if (isBannedIsInteger && isMutedIsInteger) {
        banRecheckTs = Math.min(isBanned, isMuted);
      } else if (isBannedIsInteger) {
        banRecheckTs = isBanned;
      } else {
        banRecheckTs = isMuted;
      }
    }
  }
  return [isBanned, isMuted, banRecheckTs];
}

/**
 * Lift multiple Bans
 * @param bans Array of Ban model instances
 * @param [modUid] user id of mod that lifted the bans
 */
async function removeBans(bans, modUid) {
  if (!Array.isArray(bans)) bans = [bans];
  const banIds = bans.map((b) => b.id);

  const transaction = await sequelize.transaction();

  try {
    if (modUid) {
      await BanHistory.bulkCreate(bans.map((b) => ({
        id: b.id,
        uuid: b.uuid,
        reason: b.reason,
        flags: b.flags,
        started: b.createdAt,
        ended: b.expires || Date.now(),
        muid: b.muid,
        lmuid: modUid,
      })), {
        transaction,
      });
    } else {
      await BanHistory.bulkCreate(bans.map((b) => ({
        id: b.id,
        uuid: b.uuid,
        reason: b.reason,
        flags: b.flags,
        started: b.createdAt,
        ended: b.expires || Date.now(),
        muid: b.muid,
        liftedAt: null,
      })), {
        transaction,
      });
    }

    /* ips */
    let rows = await IPBan.findAll({
      attributes: ['bid', 'ip'],
      where: { bid: banIds },
      raw: true,
      transaction,
    });

    if (rows.length) {
      await IPBanHistory.bulkCreate(rows.map((row) => ({
        bid: row.bid, ip: row.ip,
      })), { transaction });
    }
    /* users */
    rows = await UserBan.findAll({
      attributes: ['bid', 'uid'],
      where: { bid: banIds },
      raw: true,
      transaction,
    });

    if (rows.length) {
      await UserBanHistory.bulkCreate(rows.map((row) => ({
        bid: row.bid, uid: row.uid,
      })), { transaction });
    }
    /* ThreePIDs */
    rows = await ThreePIDBan.findAll({
      attributes: ['bid', 'tid'],
      where: { bid: banIds },
      raw: true,
      transaction,
    });

    if (rows.length) {
      await ThreePIDBanHistory.bulkCreate(rows.map((row) => ({
        bid: row.bid, tid: row.tid,
      })), { transaction });
    }

    /* ban destruction will cascade to junction tables */
    await Ban.destroy({
      where: { id: banIds },
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/*
 * clean expired bans
 */
export async function cleanBans() {
  try {
    const expiredBans = await Ban.findAll({
      attributes: [
        'id', 'uuid', 'reason', 'flags', 'expires', 'createdAt', 'muid',
      ],
      where: {
        expires: { [Op.lte]: new Date() },
      },
      raw: true,
    });

    if (!expiredBans.length) {
      return 0;
    }
    await removeBans(expiredBans);
    return expiredBans.length;
  } catch (error) {
    console.error(`SQL Error on cleanBans: ${error.message}`);
  }
  return null;
}

/**
 * unban
 * @param buuid uuid of ban
 * @param [modUid] user id of mod that lifted the bans
 * @return boolean success
 */
export async function unbanByUuid(uuid, modUid) {
  try {
    const banModel = await Ban.findOne({
      attributes: [
        'id', 'uuid', 'reason', 'flags', 'expires', 'createdAt', 'muid',
      ],
      where: {
        uuid: Sequelize.fn('UUID_TO_BIN', uuid),
      },
      raw: true,
    });
    if (!banModel) {
      return false;
    }
    await removeBans(banModel, modUid);
    return true;
  } catch (error) {
    console.error(`SQL Error on unban: ${error.message}`);
  }
  return false;
}

/**
 * get all bans for ips or user ids
 * @param ipStrings Array of multiple or single ipStrings
 * @param userIds Array of multiple or single user ids
 * @param ipUuids Array of multiple or single ip uuids (IID)
 * @param banUuids Array of multiple or single ban uuids (UID)
 * @param mute boolean if muting
 * @param bans boolean if banning
 * @return [{
 *   id, uuid, buuid, reason, flags, expires, createdAt, muid, mname
 *   users: [{ id }, ...]
 *   ips: [{ ipString }, ...]
 * }, ...]
 */
export async function getBanInfos(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, ipUuids, banUuids, mute = true, ban = true,
) {
  if (!ban && !mute) {
    return [];
  }

  try {
    const unions = [];
    let replacements = [];

    /* eslint-disable max-len */
    if (userIds) {
      if (Array.isArray(userIds)) {
        if (userIds.length) {
          const placeholder = userIds.map(() => '?').join(', ');
          unions.push(
            `SELECT ub.bid AS id FROM UserBans ub WHERE ub.uid IN (${
              placeholder
            })`,
          );
          unions.push(
            `SELECT tb.bid AS id FROM ThreePIDBans tb INNER JOIN ThreePIDs t ON tb.tid = t.id WHERE t.uid IN (${
              placeholder
            })`,
          );
          replacements = replacements.concat(userIds, userIds);
        }
      } else {
        unions.push(
          'SELECT ub.bid AS id FROM UserBans ub WHERE ub.uid = ?',
        );
        unions.push(
          'SELECT tb.bid AS id FROM ThreePIDBans tb INNER JOIN ThreePIDs t ON tb.tid = t.id WHERE t.uid = ?',
        );
        replacements.push(userIds, userIds);
      }
    }

    if (ipUuids) {
      if (Array.isArray(ipUuids)) {
        if (ipUuids.length) {
          unions.push(
            `SELECT ib2.bid AS id FROM IPBans ib2 INNER JOIN IPs i ON ib2.ip = i.ip WHERE i.uuid IN (SELECT n.uuid FROM (${
              ipUuids.map(() => 'SELECT UUID_TO_BIN(?) AS \'uuid\'').join(' UNION ALL ')
            }) AS n)`,
          );
          replacements = replacements.concat(ipUuids);
        }
      } else {
        unions.push(
          'SELECT ib2.bid AS id FROM IPBans ib2 INNER JOIN IPs i ON ib2.ip = i.ip WHERE i.uuid = UUID_TO_BIN(?)',
        );
        replacements.push(ipUuids);
      }
    }

    if (ipStrings) {
      if (Array.isArray(ipStrings)) {
        if (ipStrings.length) {
          unions.push(
            `SELECT ib.bid AS id FROM IPBans ib WHERE ib.ip IN (SELECT m.ip FROM (${
              ipStrings.map(() => 'SELECT IP_TO_BIN(?) AS \'ip\'').join(' UNION ALL ')
            }) AS m)`,
          );
          replacements = replacements.concat(ipStrings);
        }
      } else {
        unions.push(
          'SELECT ib.bid AS id FROM IPBans ib WHERE ib.ip = IP_TO_BIN(?)',
        );
        replacements.push(ipStrings);
      }
    }

    if (banUuids) {
      if (Array.isArray(banUuids)) {
        if (banUuids.length) {
          unions.push(
            `SELECT bb.id FROM Bans bb WHERE bb.uuid IN (SELECT l.uuid FROM (${
              banUuids.map(() => 'SELECT UUID_TO_BIN(?) AS \'uuid\'').join(' UNION ALL ')
            }) AS l)`,
          );
          replacements = replacements.concat(banUuids);
        }
      } else {
        unions.push(
          'SELECT bb.id FROM Bans bb WHERE bb.uuid = UUID_TO_BIN(?)',
        );
        replacements.push(banUuids);
      }
    }

    if (!unions.length) {
      return [];
    }

    let query;
    if (unions.length > 1) {
      query = `SELECT DISTINCT b.id FROM (\n  ${unions.join('\n  UNION ALL\n  ')}\n) AS b`;
    } else {
      [query] = unions;
    }

    let affectedBanIds = await sequelize.query(query, {
      replacements,
      raw: true,
      type: QueryTypes.SELECT,
    });
    affectedBanIds = affectedBanIds.map((b) => b.id);

    if (!affectedBanIds.length) {
      return [];
    }

    let flagMask = 0;
    if (ban) {
      flagMask |= 0x01;
    }
    if (mute) {
      flagMask |= 0x02;
    }

    const promises = [];
    const bidFilterMask = (affectedBanIds.length === 1) ? '= ?' : 'IN (?)';
    replacements = [(affectedBanIds.length === 1)
      ? affectedBanIds[0] : affectedBanIds];
    promises.push(sequelize.query(
      `SELECT b.*, md.name as mname, BIN_TO_UUID(b.uuid) AS buuid, BIN_TO_IP(ib.ip) AS 'ips.ipString' FROM Bans b
  LEFT JOIN Users md ON md.id = b.muid
  LEFT JOIN IPBans ib ON ib.bid = b.id
WHERE (b.flags & ?) > 0 AND (b.expires > NOW() OR b.expires IS NULL) AND b.id ${bidFilterMask}`, {
        replacements: [flagMask].concat(replacements),
        raw: true,
        type: QueryTypes.SELECT,
      }));

    promises.push(sequelize.query(
      `SELECT DISTINCT u.id, u.uid AS 'users.id' FROM (
  SELECT ub.bid AS id, ub.uid FROM UserBans ub WHERE ub.bid ${bidFilterMask}
  UNION ALL
  SELECT tb.bid AS id, t.uid FROM ThreePIDBans tb INNER JOIN ThreePIDs t ON tb.tid = t.id WHERE t.uid IS NOT NULL AND tb.bid ${bidFilterMask}
) AS u;`, {
      /* eslint-enable max-len */
        replacements: replacements.concat(replacements),
        raw: true,
        type: QueryTypes.SELECT,
      }));

    /*
     * bans is populated with ips already
     * bannedUserIds is [{ id, users: [ { id }, ... ] , ...}]
     */
    let [bans, bannedUserIds] = await Promise.all(promises);

    bans = nestQuery(bans, 'id');

    bannedUserIds = nestQuery(bannedUserIds, 'id');
    bans.forEach((b) => {
      const usersOfBan = bannedUserIds.find((u) => b.id === u.id);
      b.users = (usersOfBan) ? usersOfBan.users : [];
    });

    return bans;
  } catch (error) {
    console.error(`SQL Error on getBanInfos: ${error.message}`);
  }
  return [];
}

/**
 * prolong existing ban of ipString / userId combo if exists
 * @param ipString
 * @param userId
 * @param duration duration in seconds to add to existing ban
 * @param reason reason to match
 * @return boolean if prolonged
 */
export async function prolongExistingBan(ipString, userId, duration, reason) {
  const bans = await getBanInfos(ipString, userId, null, null);
  if (!bans.length) {
    return false;
  }
  let banData;
  if (reason) {
    banData = bans.find((b) => b.reason === reason);
  } else {
    /* prefer ban over mute */
    banData = bans.find((b) => b.flags & 0x01);
    if (!banData) {
      [banData] = bans;
    }
  }
  if (!banData) {
    return false;
  }
  if (!banData.expires) {
    return true;
  }
  let newDuration = null;
  if (duration) {
    newDuration = new Date(banData.expires.getTime() + duration * 1000);
  }
  try {
    await sequelize.query(
      'UPDATE Bans SET expires = ? WHERE id = ?', {
        replacements: [newDuration, banData.id],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    if (!banData.ips.some(({ ipString: i }) => i === ipString)) {
      console.log(`BAN add ip ${ipString} to ban that doesn't have it yet`);
      await IPBan.create({
        bid: banData.id, ip: Sequelize.fn('IP_TO_BIN', ipString),
      }, { returning: false });
    }
    if (userId && !banData.users.some(({ id: u }) => u === userId)) {
      console.log(`BAN add user ${userId} to ban that doesn't have it yet`);
      await UserBan.create({
        bid: banData.id, uid: userId,
      }, { returning: false });
    }
    return true;
  } catch (error) {
    console.error(`SQL Error on prolongExistingBan: ${error.message}`);
  }
  return false;
}

/**
 * ban
 * @param ipStrings Array of multiple or single ipStrings
 * @param userIds Array of multiple or single user ids
 * @param ipUuids Array of multiple or single ip uuids (IID)
 * @param mute boolean if muting
 * @param ban boolean if banning
 * @param reason reasoning as string
 * @param duration duration in seconds
 * @param muid id of the mod that bans
 * @return boolean success
 */
export async function ban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, ipUuids, mute, ban, reason, duration, muid = null,
) {
  try {
    const transaction = await sequelize.transaction();

    try {
      let flags = 0;
      if (ban) {
        flags |= 0x01;
      }
      if (mute) {
        flags |= 0x02;
      }

      const banModel = await Ban.create({
        reason, muid, flags,
        expires: (duration) ? new Date(Date.now() + duration * 1000) : null,
      }, { transaction });
      const bid = banModel.id;

      const promises = [];
      if (userIds && userIds.length !== 0) {
        const threePIDs = await ThreePID.findAll({
          where: { uid: userIds },
          raw: true,
        });
        if (threePIDs.length) {
          promises.push(ThreePIDBan.bulkCreate(threePIDs.map(
            (tpid) => ({ bid, tid: tpid.id }),
          ), { returning: false, transaction }));
        }
        if (Array.isArray(userIds)) {
          promises.push(UserBan.bulkCreate(userIds.map(
            (uid) => ({ bid, uid }),
          ), { returning: false, transaction }));
        } else {
          promises.push(UserBan.create({ uid: userIds, bid },
            { returning: false, transaction }));
        }
      }

      if (ipUuids?.length) {
        /* returns a Map */
        let mappedIPStrings = await getIPsOfIIDs(ipUuids);
        mappedIPStrings = Array.from(mappedIPStrings.values());
        if (Array.isArray(ipStrings)) {
          ipStrings = ipStrings.concat(mappedIPStrings);
        } else if (ipStrings) {
          mappedIPStrings.push(ipStrings);
          ipStrings = mappedIPStrings;
        } else {
          ipStrings = mappedIPStrings;
        }
      }

      if (ipStrings) {
        if (Array.isArray(ipStrings)) {
          if (ipStrings.length) {
            promises.push(IPBan.bulkCreate(ipStrings.map(
              (ip) => ({ bid, ip: Sequelize.fn('IP_TO_BIN', ip) }),
            ), { returning: false, transaction }));
          }
        } else {
          promises.push(IPBan.create({
            bid, ip: Sequelize.fn('IP_TO_BIN', ipStrings),
          }, { returning: false, transaction }));
        }
      }

      await Promise.all(promises);
      await transaction.commit();
      return [ipStrings || [], userIds || []];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`SQL Error on ban: ${error.message}`);
  }
  return [[], []];
}

/**
 * unban by user and/or ip
 * @param ipStrings Array of multiple or single ipStrings
 * @param userIds Array of multiple or single user ids
 * @param ipUuids Array of multiple or single ip uuids (IID)
 * @param banUuids Array of multiple or single ban uuids (UID)
 * @param mute boolean if unmuting
 * @param ban boolean if unbanning
 * @param muid id of the mod that bans
 * @return [ ipStrings, userIds ] affected users / ips
 */
export async function unban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, ipUuids, banUuids, mute, ban, muid = null,
) {
  const unbannedUserIds = [];
  const unbannedIpStrings = [];

  try {
    const bans = await getBanInfos(
      ipStrings, userIds, ipUuids, banUuids, mute, ban,
    );
    if (!bans.length) {
      return [unbannedIpStrings, unbannedUserIds];
    }
    await removeBans(bans, muid);
    bans.forEach((b) => {
      b.users.forEach(({ id: uid }) => {
        if (!unbannedUserIds.includes(uid)) {
          unbannedUserIds.push(uid);
        }
      });
      b.ips.forEach(({ ipString }) => {
        if (!unbannedIpStrings.includes(ipString)) {
          unbannedIpStrings.push(ipString);
        }
      });
    });
    return [unbannedIpStrings, unbannedUserIds];
  } catch (error) {
    console.error(`SQL Error on unban: ${error.message}`);
  }
  return [unbannedIpStrings, unbannedUserIds];
}

export default Ban;
