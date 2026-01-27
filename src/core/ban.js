/*
 * wraper for ban and whitelist that notices websocket for updates
 */
import { ban as banQuery, unban as unbanQuery } from '../data/sql/Ban.js';
import {
  whitelist as whitelistQuery, unwhitelist as unwhitelistQuery,
} from '../data/sql/ProxyWhitelist.js';
import socketEvents from '../socket/socketEvents.js';

/**
 * notice sockets that users / ips changed
 * @param ipStrings Array of ipStrings
 * @param userIds Array of user ids
 */
export function notifyUserIpChanges(ipStrings, userIds) {
  if (userIds) {
    if (Array.isArray(userIds)) {
      userIds.forEach((id) => socketEvents.reloadUser(id, true));
    } else {
      socketEvents.reloadUser(userIds, true);
    }
  }
  if (ipStrings) {
    if (Array.isArray(ipStrings)) {
      ipStrings.forEach((ipString) => socketEvents.reloadIP(ipString, true));
    } else {
      socketEvents.reloadIP(ipStrings, true);
    }
  }
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
 */
export async function ban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, ipUuids, mute, ban, reason, ...args
) {
  if ((!mute && !ban) || !reason) {
    return false;
  }
  const result = await banQuery(
    ipStrings, userIds, ipUuids, mute, ban, reason, ...args,
  );
  notifyUserIpChanges(...result);
  return result;
}

/**
 * unban
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
  ipStrings, userIds, ipUuids, banUuids, mute, ban, ...args
) {
  if (!mute && !ban) {
    return [[], []];
  }
  const result = await unbanQuery(
    ipStrings, userIds, ipUuids, banUuids, mute, ban, ...args,
  );
  notifyUserIpChanges(...result);
  return result;
}

/**
 * whitelist
 * @param ipString ip as string
 * @return boolean
 */
export async function whitelist(ipString) {
  const ret = await whitelistQuery(ipString);
  notifyUserIpChanges(ipString);
  return ret;
}

/**
 * unwhitelist
 * @param ipString ip as string
 * @return boolean
 */
export async function unwhitelist(ipString) {
  const ret = await unwhitelistQuery(ipString);
  notifyUserIpChanges(ipString);
  return ret;
}
