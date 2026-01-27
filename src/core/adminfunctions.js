/*
 * functions for admintools
 *
 */

/* eslint-disable no-await-in-loop */

import sharp from 'sharp';

import { validateCoorRange, validateUsername } from '../utils/validation.js';
import CanvasCleaner from './CanvasCleaner.js';
import socketEvents from '../socket/socketEvents.js';
import { USERLVL } from '../data/sql/index.js';
import { giveEveryoneAFish } from './Fishing.js';
import { forceCaptcha, resetAllCaptchas } from '../data/redis/captcha.js';
import { rollCaptchaFonts } from './captchaserver.js';
import { getBanInfos } from '../data/sql/Ban.js';
import { getTPIDsOfUser, getTPIDHistoryOfUser } from '../data/sql/ThreePID.js';
import { ban, unban, whitelist, unwhitelist } from './ban.js';
import { setState } from './SharedState.js';
import { censorIdentifier } from './utils.js';
import {
  getIPInfos,
  getIPofIID,
  getIIDsOfIPs,
  getIPsOfIIDs,
  getIIDofUserId,
  findAlts,
} from '../data/sql/IP.js';
import {
  setUserLvl,
  setUsername,
  findUserByIdOrName,
  markUserAccountsAsHacked,
} from '../data/sql/User.js';
import {
  getIIDSummary,
  getIIDPixels,
  getIIDFlags,
  getSummaryFromArea,
  getPixelsFromArea,
  populateTable,
} from './parsePixelLog.js';
import canvases from './canvases.js';
import {
  imageABGR2Canvas,
  protectCanvasArea,
} from './Image.js';
import rollbackCanvasArea from './rollback.js';

/**
 * Execute admin text actions, text can be a list of ips or iids or anything
 * @param action what to do with the ips
 * @param ip already sanitized ip
 * @return text of success
 */
export async function executeTextAction(action, text, logger = null) {
  if (action === 'announce' && text?.length > 6) {
    socketEvents.broadcastAnnouncement(text);
    return 'Sent announcement';
  }

  const inputValues = text.split('\n').map((l) => l.trim()).filter((l) => l);

  if (action === 'markusersashacked') {
    let out = '';
    const [emailSet, mailExists] = await markUserAccountsAsHacked(inputValues);
    emailSet.forEach((e) => {
      out += `${e} setmail\n`;
      socketEvents.reloadUser(e);
    });
    mailExists.forEach((e) => {
      out += `${e} set\n`;
      socketEvents.reloadUser(e);
    });
    return out;
  }

  let valueMap;
  if (action === 'iidtoip') {
    valueMap = await getIPsOfIIDs(inputValues);
  } else if (action === 'iptoiid') {
    valueMap = await getIIDsOfIPs(inputValues);
  } else {
    return `Failed to ${action}`;
  }

  let out = '';
  for (let i = 0; i < inputValues.length; i += 1) {
    const value = inputValues[i];
    const map = valueMap.get(value);
    if (map) {
      out += map;
    } else {
      out += value;
    }
    out += '\n';

    if (logger) logger(`${action} ${value}`);
  }
  return out;
}

export async function executeQuickAction(action, logger = null) {
  if (logger) logger(action);

  switch (action) {
    case 'rollcaptchafonts': {
      const fonts = await rollCaptchaFonts();
      return `Rolled captcha fonts: ${fonts.join(',')}`;
    }
    case 'resetcaptchas': {
      const amount = await resetAllCaptchas();
      return `Reset ${amount} Captchas and JS Challenges!`;
    }
    case 'enableverify': {
      setState({ needVerification: true });
      return 'Enabled Verification Requirement';
    }
    case 'disableverify': {
      setState({ needVerification: false });
      return 'Disabled Verification Requirement';
    }
    case 'enablemalware': {
      setState({ malwareCheck: true });
      return 'Enabled Verification Requirement';
    }
    case 'disablemalware': {
      setState({ malwareCheck: false });
      return 'Disabled Verification Requirement';
    }
    case 'givefishes': {
      giveEveryoneAFish();
      return 'Gave Fishes to everyone';
    }
    default:
      throw new Error('Unknown quick action!');
  }
}

/**
 * print informations of ban
 * @param ban Array of ban models
 * @return string with informations
 */
async function printBans(bans) {
  let out = '';

  let i = bans.length;
  while (i > 0) {
    i -= 1;
    const {
      buuid, reason, flags, expires, createdAt, muid, mname, users, tpids, ips,
    } = bans[i];
    let type = '';
    if (flags & 0x01) type = 'Ban';
    else if (flags & 0x02) {
      if (type) {
        type += ' & ';
      }
      type += 'Mute';
    }
    out += `${type}: ${buuid}\nReason: ${reason}\n`;
    if (expires) out += `Expires: ${expires.toLocaleString()}\n`;
    out += `Created: ${createdAt.toLocaleString()}\n`;
    if (muid) {
      out += `by: @[${mname}](${muid})\n`;
    }
    out += 'Affects: ';
    if (users?.length) out += `\nUsers: \n${users.map((u) => u.id).join('\n')}`;
    if (tpids?.length) out += `\n${tpids.length} TPIDS `;
    if (ips?.length) {
      const iids = await getIIDsOfIPs(ips.map((ib) => ib.ipString));
      out += `\nIIDs: \n${Array.from(iids.values()).join('\n')}`;
    }
    out += '\n';
    if (i > 0) {
      out += '\n';
    }
  }
  return out;
}

/**
 * Execute IID based actions
 * @param action what to do with the iid
 * @param iid already sanitized iid
 * @return text of success
 */
export async function executeIIDAction(
  action,
  iid,
  bid,
  iidOrUserIdOrName,
  /* list of either iid, bid or userid */
  identifiers,
  reason,
  /* duration in ms */
  time,
  username,
  muid,
  logger = null,
) {
  if (logger) {
    logger(`${action} ${iid} ${bid} ${iidOrUserIdOrName} ${identifiers}`);
  }

  let duration;
  const identifierUuidList = [];
  const identifierUserIdList = [];

  switch (action) {
    case 'givecaptcha':
    case 'whitelist':
    case 'unwhitelist': {
      if (!iid) {
        return 'You must enter an IID';
      }
      break;
    }
    case 'baninfo': {
      if (!bid) {
        return 'You must enter an BID';
      }
      break;
    }
    case 'searchalts':
    case 'status': {
      if (!iidOrUserIdOrName) {
        return 'You must enter an IID or UserId or Name';
      }
      break;
    }
    case 'changeusername': {
      if (!iidOrUserIdOrName) {
        return 'You must enter a UserId';
      }
      username = username?.trim();
      const err = validateUsername(username);
      if (err) {
        return err;
      }
      break;
    }
    case 'ban': {
      duration = Math.ceil(parseInt(time, 10) / 1000);
      if (Number.isNaN(duration) || (duration < 0)) {
        return 'No valid expiration time';
      }
      if (!reason?.trim()) {
        return 'You must enter a reason';
      }
      // fall through
    }
    case 'unban': {
      if (!identifiers) {
        return 'You must enter at least one IID, User Id or BID';
      }
      identifiers.split('\n').forEach((i) => {
        i = i.trim();
        if (i.indexOf('-') !== -1) {
          identifierUuidList.push(i);
        } else {
          const userId = parseInt(i, 10);
          if (userId) {
            identifierUserIdList.push(userId);
          }
        }
      });
      break;
    }
    default:
      // nothing
  }

  let ipString;
  if (iid) {
    ipString = await getIPofIID(iid);
    if (!ipString) {
      return `Could not resolve ${iid}`;
    }
  }

  switch (action) {
    case 'status': {
      let ipInfo;
      let banInfos;
      let out;
      if (iidOrUserIdOrName.indexOf('-') !== -1) {
        /* IID */
        ipInfo = await getIPInfos(null, iidOrUserIdOrName);
      } else if (iidOrUserIdOrName.indexOf('.') !== -1) {
        /* IP */
        ipInfo = await getIPInfos(iidOrUserIdOrName, null);
      }

      /* getIPInfos always returns Array */
      if (ipInfo) {
        if (!ipInfo.size) {
          return 'No such IID found';
        }
        /* there is only one value, get it */
        ipInfo = ipInfo.values().next().value;

        const {
          country, cidr, org,
          descr, asn, type, isProxy, isWhitelisted,
        } = ipInfo;
        // eslint-disable-next-line max-len
        out = `IP: ${iidOrUserIdOrName}\nCountry: ${country}\nCIDR: ${cidr}\norg: ${org}\ndesc: ${descr}\nasn: ${asn}\nType: ${type}\nisProxy: ${isProxy}\nisWhitelisted: ${isWhitelisted}\n`;
        banInfos = await getBanInfos(ipInfo.ipString, null, null, null);
      } else {
        /* UserID */
        const user = await findUserByIdOrName(iidOrUserIdOrName);
        if (!user) {
          return 'No such user found';
        }
        // eslint-disable-next-line max-len
        out = `ID: ${user.id}\nName: ${user.name}\nUsername: ${user.username}\nUserlvl: ${user.userlvl}\nFlags: ${user.flags}\n`;
        banInfos = await getBanInfos(null, user.id, null, null);

        let tpids = await getTPIDsOfUser(user.id);
        if (tpids.length) {
          out += '\nTPIDs:\n';
        }
        tpids.forEach(({ provider, tpid, verified }) => {
          // eslint-disable-next-line max-len
          out += `\nProvider: ${provider}\nTPID: ${censorIdentifier(tpid)}\nVerified: ${!!verified}\n`;
        });

        tpids = await getTPIDHistoryOfUser(user.id);
        if (tpids.length) {
          out += '\nTPID History:\n';
        }
        tpids.forEach(({ provider, tpid, verified, lastSeen }) => {
          // eslint-disable-next-line max-len
          out += `\nProvider: ${provider}\nTPID: ${censorIdentifier(tpid)}\nVerified: ${!!verified}\nDeleted at: ${lastSeen.toLocaleString()}\n`;
        });
      }
      if (banInfos?.length) {
        out += '\n';
        out += await printBans(banInfos);
      }
      return out;
    }
    case 'searchalts': {
      let userId;
      if (iidOrUserIdOrName.indexOf('-') !== -1) {
        /* IID */
        ipString = await getIPofIID(iidOrUserIdOrName);
      } else {
        /* user id or name */
        userId = parseInt(iidOrUserIdOrName, 10);
        if (Number.isNaN(userId)) {
          const user = await findUserByIdOrName(iidOrUserIdOrName);
          if (user) {
            userId = user.id;
          } else {
            userId = null;
          }
        }
      }
      const [iids, userIds] = await findAlts(userId, ipString);
      return `UserIds:\n${userIds.join('\n')}\n\nIIDs:\n${iids.join('\n')}\n`;
    }
    case 'baninfo': {
      const banInfos = await getBanInfos(null, null, null, bid);
      if (!banInfos?.length) {
        return 'No such ban found';
      }
      return printBans(banInfos);
    }
    case 'givecaptcha': {
      const succ = await forceCaptcha(ipString);
      if (succ === null) {
        return 'Captchas are deactivated on this server.';
      }
      if (succ) {
        return `Forced captcha on ${iid}`;
      }
      return `${iid} would have gotten captcha anyway`;
    }
    case 'changeusername': {
      const [curUser, targetUser] = await Promise.all([
        findUserByIdOrName(username), findUserByIdOrName(iidOrUserIdOrName),
      ]);
      if (!targetUser) {
        return `No user ${iidOrUserIdOrName} found`;
      }
      let out = '';
      if (curUser?.username === username) {
        await setUsername(curUser.id, `pp_${curUser.id}`);
        socketEvents.reloadUser(curUser.id);
        out += `Changed ${curUser.username} to pp_${curUser.id} and `;
      }
      const succ = await setUsername(targetUser.id, username);
      if (!succ) {
        // eslint-disable-next-line max-len
        return `${out}Couldn't change ${targetUser.username}, ${username} probably already exists.`;
      }
      socketEvents.reloadUser(targetUser.id);
      return `${out}Changed username of ${targetUser.username} to ${username}`;
    }
    case 'ban': {
      const [bannedIpStrings, bannedUserIds] = await ban(
        null, identifierUserIdList, identifierUuidList,
        false, true, reason, duration || null, muid,
      );
      if (bannedIpStrings.length || bannedUserIds.length) {
        // eslint-disable-next-line max-len
        return `Successfully banned ${bannedUserIds.length} users and ${bannedIpStrings.length} IPs`;
      }
      return 'Could not ban user';
    }
    case 'unban': {
      const [unbannedIpStrings, unbannedUserIds] = await unban(
        null, identifierUserIdList, identifierUuidList, identifierUuidList,
        true, true, muid,
      );
      let ret = '';
      if (unbannedIpStrings.length) {
        const iids = await getIIDsOfIPs(unbannedIpStrings);
        ret += `Unbanned IIDs: \n${Array.from(iids.values()).join('\n')}`;
      }
      if (unbannedUserIds.length) {
        if (ret) ret += '\n';
        ret += `Unbanned UserIds: \n${unbannedUserIds.join('\n')}`;
      }
      if (ret) {
        return ret;
      }
      return 'No applying Ban found';
    }
    case 'whitelist': {
      const ret = await whitelist(ipString);
      if (ret) {
        return 'Successfully whitelisted user';
      }
      return 'User is already whitelisted';
    }
    case 'unwhitelist': {
      const ret = await unwhitelist(ipString);
      if (ret) {
        return 'Successfully removed user from whitelist';
      }
      return 'User is not on whitelist';
    }
    default:
      return `Failed to ${action}`;
  }
}


/*
 * Execute Image based actions (upload, protect, etc.)
 * @param action what to do with the image
 * @param file imagefile
 * @param coords coord sin X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeImageAction(
  action,
  buffer,
  coords,
  canvasid,
  logger = null,
) {
  if (!coords) {
    return [403, 'Coordinates not defined'];
  }
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  if (!buffer) {
    return [403, 'No file given'];
  }

  const splitCoords = coords.trim().split('_');
  if (splitCoords.length !== 2) {
    return [403, 'Invalid Coordinate Format'];
  }
  const [x, y] = splitCoords.map((z) => Math.floor(Number(z)));

  const canvas = canvases[canvasid];

  let error = null;
  if (Number.isNaN(x)) {
    error = 'x is not a valid number';
  } else if (Number.isNaN(y)) {
    error = 'y is not a valid number';
  } else if (!action) {
    error = 'No imageaction given';
  } else if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (canvas.v) {
    error = 'Can not upload Image to 3D canvas';
  }
  if (error !== null) {
    return [403, error];
  }

  const canvasMaxXY = canvas.size / 2;
  const canvasMinXY = -canvasMaxXY;
  if (x < canvasMinXY || y < canvasMinXY
      || x >= canvasMaxXY || y >= canvasMaxXY) {
    return [403, 'Coordinates are outside of canvas'];
  }

  const protect = (action === 'protect');
  const wipe = (action === 'wipe');

  try {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pxlCount = await imageABGR2Canvas(
      canvasid,
      x, y,
      data,
      info.width, info.height,
      wipe, protect,
    );

    // eslint-disable-next-line max-len
    if (logger) logger(`loaded image wth *${pxlCount}*pxls to #${canvas.ident},${x},${y} (+*${x}*+\\_+*${y}*+ - +*${x + info.width - 1}*+\\_+*${y + info.height - 1}*+)`);
    return [
      200,
      `Successfully loaded image wth ${pxlCount}pxls to ${x}/${y}`,
    ];
  } catch {
    return [400, 'Can not read image file'];
  }
}

/*
 * register responses on socket for Watch Actions
 */
socketEvents.onReq('watch', (action, ...args) => {
  try {
    if (action === 'getIIDSummary') {
      return getIIDSummary(...args);
    } if (action === 'getIIDPixels') {
      return getIIDPixels(...args);
    } if (action === 'getIIDFlags') {
      return getIIDFlags(...args);
    } if (action === 'getSummaryFromArea') {
      return getSummaryFromArea(...args);
    } if (action === 'getPixelsFromArea') {
      return getPixelsFromArea(...args);
    }
  } catch {
    // silently fail when file couldn't be parsed
  }
  return null;
});

/*
 * Check who placed on a canvas area
 * @param action if every pixel or summary should be returned
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return Object with {info, cols, rows}
 */
export async function executeWatchAction(
  action,
  ulcoor,
  brcoor,
  time,
  iid,
  iidoruser,
  canvasid,
  clr,
  maxrows,
  maxentities,
) {
  if (!canvasid) {
    return { info: 'canvasid not defined' };
  }

  maxentities = parseInt(maxentities, 10);
  if (!maxentities || maxentities < 1) {
    maxentities = 25;
  } else if (maxentities > 200) {
    maxentities = 200;
  }

  maxrows = parseInt(maxrows, 10);
  if (!maxrows || maxrows < 1) {
    maxrows = 300;
  } else if (maxrows > 10000) {
    maxrows = 10000;
  }

  clr = parseInt(clr, 10);
  if (Number.isNaN(clr)) {
    clr = null;
  }

  const ts = parseInt(time, 10);
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!action) {
    error = 'No cleanaction given';
  } else if (Number.isNaN(ts)) {
    error = 'Invalid time given';
  }
  if (error) {
    return { info: error };
  }

  let ret;
  if (!ulcoor && !brcoor && iid) {
    if (action === 'summary') {
      ret = await socketEvents.reqAll(
        'watch',
        'getIIDSummary',
        iid,
        time,
      );
    }
    if (action === 'all') {
      ret = await socketEvents.reqAll(
        'watch',
        'getIIDPixels',
        iid,
        time,
        maxrows,
      );
    }
    if (typeof ret === 'string') {
      return { info: ret };
    }
    if (typeof ret !== 'undefined') {
      return ret;
    }
  }

  if (action === 'flagbyID' && iidoruser) {
    let resolvedIid = null;
    if (iidoruser.indexOf('-') !== -1) {
      resolvedIid = iidoruser;
    } else {
      const userId = parseInt(iidoruser, 10);
      if (!Number.isNaN(userId)) {
        resolvedIid = await getIIDofUserId(userId);
      } else {
        const user = await findUserByIdOrName(iidoruser);
        if (user) {
          resolvedIid = await getIIDofUserId(user.id);
        }
      }
    }
    if (!resolvedIid) {
      return { info: 'Could not resolve identifier to IID' };
    }
    ret = await socketEvents.reqAll(
      'watch',
      'getIIDFlags',
      resolvedIid,
      time,
    );
    if (typeof ret === 'string') {
      return { info: ret };
    }
    if (typeof ret !== 'undefined') {
      return ret;
    }
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return { info: parseCoords };
  }
  const [x, y, u, v] = parseCoords;

  if (action === 'summary') {
    ret = await socketEvents.reqAll(
      'watch',
      'getSummaryFromArea',
      canvasid,
      clr,
      x, y, u, v,
      time,
      iid,
      maxentities,
    );
  }
  if (action === 'all') {
    ret = await socketEvents.reqAll(
      'watch',
      'getPixelsFromArea',
      canvasid,
      clr,
      x, y, u, v,
      time,
      iid,
      maxrows,
      maxentities,
    );
  }
  if (typeof ret === 'string') {
    return { info: ret };
  }
  if (typeof ret !== 'undefined') {
    await populateTable(ret);
    return ret;
  }
  return { info: 'Invalid action given' };
}

/*
 * Execute actions for cleaning/filtering canvas
 * @param action what to do
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeCleanerAction(
  action,
  ulcoor,
  brcoor,
  canvasid,
  logger = null,
) {
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!action) {
    error = 'No cleanaction given';
  }
  if (error) {
    return [403, error];
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return [403, parseCoords];
  }
  const [x, y, u, v] = parseCoords;

  error = CanvasCleaner.set(canvasid, x, y, u, v, action);
  if (error) {
    return [403, error];
  }
  // eslint-disable-next-line max-len
  const report = `set Canvas Cleaner to *"${action}"* from #${canvas.ident},${x},${y} to #${canvas.ident},${u},${v}`;
  if (logger) logger(report);
  return [200, report];
}

/*
 * Execute actions for protecting areas
 * @param action what to do
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeProtAction(
  action,
  ulcoor,
  brcoor,
  canvasid,
  logger = null,
) {
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!action) {
    error = 'No imageaction given';
  } else if (action !== 'protect' && action !== 'unprotect') {
    error = 'Invalid action (must be protect or unprotect)';
  }
  if (error !== null) {
    return [403, error];
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return [403, parseCoords];
  }
  const [x, y, u, v] = parseCoords;

  const width = u - x + 1;
  const height = v - y + 1;
  if (width * height > 10000000) {
    return [403, 'Can not set protection to more than 10m pixels at once'];
  }
  const protect = action === 'protect';
  const pxlCount = await protectCanvasArea(
    canvasid,
    x,
    y,
    width,
    height,
    protect,
  );
  if (logger) {
    logger(
      (protect)
      // eslint-disable-next-line max-len
        ? `protected *${width}*x*${height}* area at #${canvas.ident},${x},${y} with *${pxlCount}*pxls (+*${x}*+\\_+*${y}*+ - +*${u}*+\\_+*${v}*+)`
      // eslint-disable-next-line max-len
        : `unprotect *${width}*x*${height}* area at #${canvas.ident},${x},${y} with *${pxlCount}*pxls (+*${x}*+\\_+*${y}*+ - +*${u}*+\\_+*${v}*+)`,
    );
  }
  return [
    200,
    (protect)
    // eslint-disable-next-line max-len
      ? `Successfully protected ${width}x${height} area at #${canvas.ident},${x},${y} with ${pxlCount}pxls (${ulcoor} - ${brcoor})`
    // eslint-disable-next-line max-len
      : `Successfully unprotected ${width}x${height} area at #${canvas.ident},${x},${y} with ${pxlCount}pxls (${ulcoor} - ${brcoor})`,
  ];
}

/*
 * Execute rollback
 * @param date in format YYYYMMdd
 * @param time in format hhmm
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeRollback(
  date,
  time,
  ulcoor,
  brcoor,
  canvasid,
  logger = null,
  isAdmin = false,
) {
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!date) {
    error = 'No date given';
  } else if (!time) {
    error = 'No time given';
  } else if (Number.isNaN(Number(date)) || date.length !== 8) {
    error = 'Invalid date';
  } else if (Number.isNaN(Number(time)) || time.length !== 4) {
    error = 'Invalid time';
  }
  if (error !== null) {
    return [403, error];
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return [403, parseCoords];
  }
  const [x, y, u, v] = parseCoords;

  const width = u - x + 1;
  const height = v - y + 1;
  if (!isAdmin && width * height > 1000000) {
    return [403, 'Can not rollback more than 1m pixels at once'];
  }

  const pxlCount = await rollbackCanvasArea(
    canvasid,
    x,
    y,
    width,
    height,
    date,
    time,
  );
  if (logger) {
    logger(
    // eslint-disable-next-line max-len
      `rolled back to *${date}* for *${width}*x*${height}* area at #${canvas.ident},${x},${y} with *${pxlCount}*pxls (+*${x}*+\\_+*${y}*+ - +*${u}*+\\_+*${v}*+)`,
    );
  }
  return [
    200,
    // eslint-disable-next-line max-len
    `Successfully rolled back to ${date} for ${width}x${height} area at #${canvas.ident},${x},${y} with ${pxlCount}pxls (${ulcoor} - ${brcoor})`,
  ];
}

/**
 * demoe a user of a certain userlvl
 * @param userId
 */
export async function demoteUser(userId) {
  userId = parseInt(userId, 10);
  if (Number.isNaN(userId)) {
    throw new Error('Invalid userId');
  }
  const success = await setUserLvl(userId, USERLVL.VERIFIED);
  if (success) {
    socketEvents.reloadUser(userId);
    return `All moderation rights removed from user with the id ${userId}`;
  }
  throw new Error('Couldn\'t remove moderation rights from user');
}

/**
 * promote a user to a certain userlvl
 * @param name name or id of user
 * @param userlvl wanted level
 */
export async function promoteUser(name, userlvl) {
  if (!name) {
    throw new Error('No username given');
  }
  if (!userlvl) {
    throw new Error('No userlvl given');
  }
  const user = await findUserByIdOrName(name);
  if (!user?.id) {
    throw new Error(`User ${name} not found`);
  }
  const { id } = user;
  const success = await setUserLvl(id, userlvl);
  if (success) {
    socketEvents.reloadUser(id);
    return [id, user.name];
  }
  throw new Error('Couldn\'t make user Mod');
}
