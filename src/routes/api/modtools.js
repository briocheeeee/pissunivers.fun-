/**
 * basic mod api
 * is used by ../components/Modtools
 *
 */

import express from 'express';
import fileUpload from 'express-fileupload';

import { QueryTypes } from 'sequelize';
import urlEncoded from '../../middleware/formData.js';
import { requireOidc } from '../../middleware/oidc.js';
import CanvasCleaner from '../../core/CanvasCleaner.js';
import chatProvider from '../../core/ChatProvider.js';
import { escapeMd } from '../../core/utils.js';
import logger, { modtoolsLogger } from '../../core/logger.js';
import {
  executeTextAction,
  executeIIDAction,
  executeImageAction,
  executeProtAction,
  executeRollback,
  executeCleanerAction,
  executeWatchAction,
  demoteUser,
  promoteUser,
  executeQuickAction,
} from '../../core/adminfunctions.js';
import { getState } from '../../core/SharedState.js';
import { getHighUserLvlUsers, findUserById } from '../../data/sql/User.js';
import { logModAction, getModActions, getDistinctActions, getDistinctModerators } from '../../data/sql/ModAction.js';
import { USERLVL } from '../../data/sql/index.js';
import {
  getFactionById,
  deleteFaction,
  updateFaction,
  FACTION_ROLE,
} from '../../data/sql/Faction.js';
import {
  getFactionMembers,
  getFactionMemberCount,
  transferOwnership,
} from '../../data/sql/FactionMember.js';
import sequelize from '../../data/sql/sequelize.js';
import {
  createAdminMessage,
  countMessagesSentToUserToday,
  getMessagesSentByMod,
} from '../../data/sql/AdminMessage.js';
import socketEvents from '../../socket/socketEvents.js';


const router = express.Router();

/*
 * parse multipart/form-data
 * ordinary fields will be under req.body[name]
 * files will be under req.files[name]
 */
router.use(urlEncoded, fileUpload({
  limits: {
    fileSize: 5 * 1024 * 1024,
    fields: 50,
    files: 1,
  },
}));

router.use(requireOidc('modtools', true));

/*
 * make sure User is logged in and at least Mod
 */
router.use(async (req, res, next) => {
  /*
   * special case for oauth, this user object has only a subset of values
   */
  if (!req.user && req.oidcUserId) {
    req.user = await findUserById(req.oidcUserId);
  }

  if (!req.user) {
    logger.warn(
      `MODTOOLS> ${req.ip.ipString} tried to access modtools without login`,
    );
    const { t } = req.ttag;
    next(new Error(t`You are not logged in`));
    return;
  }
  const { userlvl } = req.user;
  if (!userlvl || userlvl < USERLVL.JANNY) {
    logger.warn(
      `MODTOOLS: ${req.ip.ipString} / ${req.user.id} tried to access modtools`,
    );
    const { t } = req.ttag;
    next(new Error(t`You are not allowed to access this page`));
    return;
  }

  if (!req.body?.cleanerstat) {
    logger.info(
      `MODTOOLS> access ${req.user.name}[${req.user.id}] -  ${req.ip.ipString}`,
    );
  }
  next();
});


/*
 * Post for janny + mod + admin
 */
router.post('/', async (req, res, next) => {
  const aLogger = (text) => {
    const timeString = new Date().toLocaleTimeString();
    // eslint-disable-next-line max-len
    const logText = `@[${escapeMd(req.user.name)}](${req.user.id}) ${text}`;
    modtoolsLogger.info(
      `${timeString} | MODTOOLS> ${logText}`,
    );
    chatProvider.broadcastChatMessage(
      'info',
      logText,
      chatProvider.enChannelId,
      chatProvider.infoUserId,
    );
  };

  try {
    if (req.body.protaction) {
      const {
        protaction, ulcoor, brcoor, canvasid,
      } = req.body;
      const [ret, msg] = await executeProtAction(
        protaction,
        ulcoor,
        brcoor,
        canvasid,
        aLogger,
      );
      if (ret === 200) {
        logModAction(req.user.id, protaction, `canvas:${canvasid}`, `${ulcoor} to ${brcoor}`);
      }
      res.status(ret).send(msg);
      return;
    }
    if (req.body.rollbackdate) {
      // rollbackdate is date as YYYYMMdd
      // rollbacktime is time as hhmm
      const {
        rollbackdate, rollbacktime, ulcoor, brcoor, canvasid,
      } = req.body;
      if (req.user.userlvl < USERLVL.MOD) {
        /*
         * jannies can only rollback to yesterday max
         */
        let yesterday = new Date(Date.now() - 24 * 3600 * 1000);
        let yesterdayDay = yesterday.getUTCDate();
        let yesterdayMonth = yesterday.getUTCMonth() + 1;
        if (yesterdayDay < 10) yesterdayDay = `0${String(yesterdayDay)}`;
        if (yesterdayMonth < 10) yesterdayMonth = `0${String(yesterdayMonth)}`;
        // eslint-disable-next-line max-len
        yesterday = `${yesterday.getUTCFullYear()}${yesterdayMonth}${yesterdayDay}`;
        if (parseInt(rollbackdate, 10) < parseInt(yesterday, 10)) {
          res.status(403).send('You can not rollback further than yesterday');
          return;
        }
        let today = new Date();
        let todayDay = today.getUTCDate();
        let todayMonth = today.getUTCMonth() + 1;
        if (todayDay < 10) todayDay = `0${String(todayDay)}`;
        if (todayMonth < 10) todayMonth = `0${String(todayMonth)}`;
        today = `${today.getUTCFullYear()}${todayMonth}${todayDay}`;
        if (parseInt(rollbackdate, 10) > parseInt(today, 10)
          || (rollbackdate === today && today.getUTCHours() < 1)
        ) {
          res.status(403).send('You can not rollback to this time');
          return;
        }
      }
      const [ret, msg] = await executeRollback(
        rollbackdate,
        rollbacktime,
        ulcoor,
        brcoor,
        canvasid,
        aLogger,
        (req.user.userlvl >= USERLVL.ADMIN),
      );
      if (ret === 200) {
        logModAction(req.user.id, 'rollback', `canvas:${canvasid}`, `${ulcoor} to ${brcoor} @ ${rollbackdate}:${rollbacktime}`);
      }
      res.status(ret).send(msg);
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
});

/*
 * just mods + admins past here, no Jannies
 */
router.use(async (req, res, next) => {
  if (req.user.userlvl < USERLVL.MOD) {
    const { t } = req.ttag;
    res.status(403).send(t`Just admins can do that`);
    return;
  }
  next();
});

/*
 * post just for admin + mod
 */
router.post('/', async (req, res, next) => {
  const aLogger = (text) => {
    const timeString = new Date().toLocaleTimeString();
    // eslint-disable-next-line max-len
    const logText = `@[${escapeMd(req.user.name)}](${req.user.id}) ${text}`;
    modtoolsLogger.info(
      `${timeString} | MODTOOLS> ${logText}`,
    );
    chatProvider.broadcastChatMessage(
      'info',
      logText,
      chatProvider.enChannelId,
      chatProvider.infoUserId,
    );
  };

  const bLogger = (text) => {
    logger.info(
      `MODTOOLS>IID>${req.user.name}[${req.user.id}]> ${text}`,
    );
  };

  try {
    if (req.body.cleanerstat) {
      const ret = CanvasCleaner.reportStatus();
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.cleanercancel) {
      const ret = CanvasCleaner.stop();
      res.status(200).send(ret);
      return;
    }
    if (req.body.watchaction) {
      const {
        watchaction, ulcoor, brcoor, time, iid, iidoruser, canvasid, clr,
        maxrows, maxentities,
      } = req.body;
      // eslint-disable-next-line max-len
      logger.info(`MODTOOLS>WATCH>${req.user.name}[${req.user.id}]> ${watchaction} ${ulcoor} ${brcoor} ${time} ${iid || iidoruser}`);
      const ret = await executeWatchAction(
        watchaction,
        ulcoor,
        brcoor,
        /* time is interval in ms */
        time,
        iid,
        iidoruser,
        canvasid,
        clr,
        maxrows,
        maxentities,
      );
      res.status(200).json(ret);
      return;
    }
    if (req.body.iidaction) {
      const {
        iidaction, iid, bid, iidoruser,
        identifiers, reason, time, username,
      } = req.body;
      const ret = await executeIIDAction(
        iidaction,
        iid,
        bid,
        iidoruser,
        identifiers,
        reason,
        time,
        username,
        req.user.id,
        bLogger,
      );
      logModAction(req.user.id, iidaction, iid || bid || iidoruser || identifiers?.split('\n')[0], reason || null);
      res.status(200).send(ret);
      return;
    }
    if (req.body.cleaneraction) {
      const {
        cleaneraction, ulcoor, brcoor, canvasid,
      } = req.body;
      const [ret, msg] = await executeCleanerAction(
        cleaneraction,
        ulcoor,
        brcoor,
        canvasid,
        aLogger,
      );
      if (ret === 200) {
        logModAction(req.user.id, cleaneraction, `canvas:${canvasid}`, `${ulcoor} to ${brcoor}`);
      }
      res.status(ret).send(msg);
      return;
    }
    if (req.body.imageaction) {
      const { imageaction, coords, canvasid } = req.body;
      const [ret, msg] = await executeImageAction(
        imageaction,
        req.files?.image?.data,
        coords,
        canvasid,
        aLogger,
      );
      if (ret === 200) {
        logModAction(req.user.id, `image_${imageaction}`, `canvas:${canvasid}`, coords);
      }
      res.status(ret).send(msg);
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
});


/*
 * just admins past here, no Mods
 */
router.use(async (req, res, next) => {
  if (req.user.userlvl < USERLVL.ADMIN) {
    const { t } = req.ttag;
    res.status(403).send(t`Just admins can do that`);
    return;
  }
  next();
});

/*
 * Post just for admin
 */
router.post('/', async (req, res, next) => {
  const aLogger = (text) => {
    logger.info(`ADMIN> ${req.user.name}[${req.user.id}]> ${text}`);
  };

  try {
    if (req.body.textaction) {
      /*
       * it can also be used for resetting users that got hacked, the naming
       * is old
       */
      const ret = await executeTextAction(
        req.body.textaction,
        req.body.text,
        aLogger,
      );
      logModAction(req.user.id, req.body.textaction, null, req.body.text?.split('\n')[0]);
      res.status(200).send(ret);
      return;
    }
    if (req.body.modlist) {
      const ret = await getHighUserLvlUsers();
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.gamestate) {
      const ret = getState();
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.remmod) {
      const ret = await demoteUser(req.body.remmod);
      logModAction(req.user.id, 'demote_mod', `user:${req.body.remmod}`, null);
      res.status(200).send(ret);
      return;
    }
    if (req.body.makemod) {
      const ret = await promoteUser(
        req.body.makemod, parseInt(req.body.userlvl, 10),
      );
      logModAction(req.user.id, 'promote_mod', `user:${req.body.makemod}`, `level:${req.body.userlvl}`);
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.quickaction) {
      const ret = await executeQuickAction(req.body.quickaction, aLogger);
      logModAction(req.user.id, req.body.quickaction, null, null);
      res.status(200).send(ret);
      return;
    }
    if (req.body.gethistory) {
      const { action, muid, fromDate, toDate, search, page } = req.body;
      const ret = await getModActions({
        action: action || null,
        muid: muid ? parseInt(muid, 10) : null,
        fromDate: fromDate || null,
        toDate: toDate || null,
        search: search || null,
        page: page ? parseInt(page, 10) : 1,
      });
      res.status(200).json(ret);
      return;
    }
    if (req.body.gethistoryfilters) {
      const [actions, moderators] = await Promise.all([
        getDistinctActions(),
        getDistinctModerators(),
      ]);
      res.status(200).json({ actions, moderators });
      return;
    }

    if (req.body.listfactions) {
      if (req.user.userlvl < USERLVL.ADMIN) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const { search, page = 1, limit = 50 } = req.body;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      let whereClause = '';
      const replacements = [];
      if (search) {
        const escapedSearch = search
          .replace(/\\/g, '\\\\')
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_');
        whereClause = 'WHERE f.name LIKE ? OR f.tag LIKE ?';
        replacements.push(`%${escapedSearch}%`, `%${escapedSearch}%`);
      }
      const [factions, countResult] = await Promise.all([
        sequelize.query(
          `SELECT f.*, u.name as ownerName,
            (SELECT COUNT(*) FROM FactionMembers fm WHERE fm.fid = f.id) as memberCount
           FROM Factions f
           LEFT JOIN Users u ON u.id = f.ownerId
           ${whereClause}
           ORDER BY f.createdAt DESC
           LIMIT ? OFFSET ?`,
          {
            replacements: [...replacements, parseInt(limit, 10), offset],
            type: QueryTypes.SELECT,
          },
        ),
        sequelize.query(
          `SELECT COUNT(*) as total FROM Factions f ${whereClause}`,
          { replacements, type: QueryTypes.SELECT, plain: true },
        ),
      ]);
      res.status(200).json({
        factions,
        total: countResult?.total || 0,
        page: parseInt(page, 10),
        totalPages: Math.ceil((countResult?.total || 0) / parseInt(limit, 10)),
      });
      return;
    }

    if (req.body.getfactiondetail) {
      if (req.user.userlvl < USERLVL.ADMIN) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const { factionId } = req.body;
      const faction = await getFactionById(parseInt(factionId, 10));
      if (!faction) {
        res.status(404).json({ error: 'Faction not found' });
        return;
      }
      const members = await getFactionMembers(faction.id, 100, 0);
      const memberCount = await getFactionMemberCount(faction.id);
      res.status(200).json({ faction, members, memberCount });
      return;
    }

    if (req.body.dissolvefaction) {
      if (req.user.userlvl < USERLVL.ADMIN) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const { factionId, reason } = req.body;
      const faction = await getFactionById(parseInt(factionId, 10));
      if (!faction) {
        res.status(404).json({ error: 'Faction not found' });
        return;
      }
      const success = await deleteFaction(faction.id);
      if (!success) {
        res.status(500).json({ error: 'Failed to dissolve faction' });
        return;
      }
      logModAction(
        req.user.id,
        'faction_dissolve',
        `faction:${faction.id}`,
        `name:${faction.name} | tag:${faction.tag} | reason:${reason || 'N/A'}`,
      );
      logger.info(`MODTOOLS: Faction ${faction.name} dissolved by ${req.user.name}`);
      res.status(200).json({ success: true });
      return;
    }

    if (req.body.transferfactionowner) {
      if (req.user.userlvl < USERLVL.ADMIN) {
        res.status(403).json({ error: 'Admin only' });
        return;
      }
      const { factionId, newOwnerId } = req.body;
      const faction = await getFactionById(parseInt(factionId, 10));
      if (!faction) {
        res.status(404).json({ error: 'Faction not found' });
        return;
      }
      const success = await transferOwnership(
        faction.id,
        faction.ownerId,
        parseInt(newOwnerId, 10),
      );
      if (!success) {
        res.status(500).json({ error: 'Failed to transfer ownership' });
        return;
      }
      logModAction(
        req.user.id,
        'faction_transfer',
        `faction:${faction.id}`,
        `from:${faction.ownerId} | to:${newOwnerId}`,
      );
      logger.info(`MODTOOLS: Faction ${faction.name} ownership transferred by ${req.user.name}`);
      res.status(200).json({ success: true });
      return;
    }

    if (req.body.sendadminmessage) {
      const { toUserId, message } = req.body;
      if (!toUserId || !message) {
        res.status(400).json({ error: 'Missing userId or message' });
        return;
      }
      const targetUser = await findUserById(parseInt(toUserId, 10));
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      const dailyCount = await countMessagesSentToUserToday(req.user.id, parseInt(toUserId, 10));
      if (dailyCount >= 5) {
        res.status(429).json({ error: 'Daily limit reached (5 messages per user per day)' });
        return;
      }
      const record = await createAdminMessage(
        req.user.id,
        parseInt(toUserId, 10),
        message.substring(0, 2000),
      );
      socketEvents.sendAdminMessage(
        parseInt(toUserId, 10),
        message.substring(0, 2000),
        req.user.name,
      );
      logModAction(
        req.user.id,
        'admin_message',
        `user:${toUserId}`,
        `msg:${message.substring(0, 100)}...`,
      );
      logger.info(`MODTOOLS: Admin message sent to user ${toUserId} by ${req.user.name}`);
      res.status(200).json({ success: true, messageId: record.id });
      return;
    }

    if (req.body.getmymessages) {
      const { page = 1 } = req.body;
      const messages = await getMessagesSentByMod(req.user.id, parseInt(page, 10), 50);
      res.status(200).json({ messages });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
});

router.use(async (req, res, next) => {
  next(new Error('Invalid request'));
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(400).send(err.message);
  logger.error(
    // eslint-disable-next-line max-len
    `MODTOOLS> ${req.ip.ipString} / ${req.user.id} encountered error on using modtools: ${err.message}`,
  );
});

export default router;
