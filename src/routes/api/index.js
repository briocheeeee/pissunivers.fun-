import express from 'express';

import { verifySession, ensureLoggedIn } from '../../middleware/session.js';
import { parseDevice } from '../../middleware/device.js';
import errorJson from '../../middleware/errorJson.js';

import me from './me.js';
import auth from './auth/index.js';
import chatHistory from './chathistory.js';
import startDm from './startdm.js';
import leaveChan from './leavechan.js';
import block from './block.js';
import blockdm from './blockdm.js';
import privatize from './privatize.js';
import modtools from './modtools.js';
import baninfo from './baninfo.js';
import getiid from './getiid.js';
import shards from './shards.js';
import profile from './profile.js';
import canvases from './canvases.js';
import fish from './fish.js';
import badge from './badge.js';
import banme from './banme.js';
// import media from './media.js';
import factions from './factions/index.js';
import totw from './totw/index.js';
import avatar from './avatar.js';
import botdetection from './botdetection.js';
import templates from './templates.js';
import badgeDisplay from './badgeDisplay.js';
import templateProgress from './templateProgress.js';
import objectives from './objectives.js';
import adminBadges from './adminBadges.js';
import donations from './donations.js';
import donationsWebhook from './donations/webhook.js';
import { markMessageAsRead } from '../../data/sql/AdminMessage.js';

const router = express.Router();

router.use('/canvases', canvases);

router.use('/donations/webhook', donationsWebhook);

router.use(express.json({ limit: '2mb' }));

router.use('/donations', donations);

router.post('/fish', fish);

router.post('/badge', badge);

/*
 * set cache control and reject disallowed cors
 */
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });

  if (req.csrfPossible) {
    const error = new Error('Request from this origin denied.');
    error.status = 403;
    throw error;
  }

  next();
});

// routes that don't need a user
router.get('/shards', shards);

router.get('/getiid', getiid);

/*
 * get user session if available
 */
router.use(verifySession);

router.get('/chathistory', chatHistory);

router.get('/baninfo', baninfo);

router.use('/factions', factions);

router.use('/totw', totw);

router.post('/lanme', banme);

// router.use('/media', media);

router.use((req, res, next) => {
  req.tickRateLimiter(3000);
  next();
});

router.get('/me', me);

router.use(parseDevice);

router.use('/auth', auth);

router.use('/modtools', modtools);

router.use('/botdetection', botdetection);

router.use('/templates', templates);

router.use('/templates/progress', templateProgress);

/*
 * only with session
 */
router.use(ensureLoggedIn);

router.get('/profile', profile);

router.use('/profile/badge-display', badgeDisplay);

router.use('/objectives', objectives);

router.use('/admin/badges', adminBadges);

router.post('/startdm', startDm);

router.post('/leavechan', leaveChan);

router.post('/block', block);

router.post('/blockdm', blockdm);

router.post('/privatize', privatize);

router.post('/avatar', avatar);

router.post('/adminmsg/read', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) {
    res.status(400).json({ error: 'Missing messageId' });
    return;
  }
  await markMessageAsRead(parseInt(messageId, 10), req.user.id);
  res.json({ success: true });
});

router.use(errorJson);

export default router;
