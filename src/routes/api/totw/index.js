import express from 'express';
import { ensureLoggedIn } from '../../../middleware/session.js';

import current from './current.js';
import nominees from './nominees.js';
import vote from './vote.js';
import hallOfFame from './hallOfFame.js';
import weekHistory from './weekHistory.js';
import factionHistory from './factionHistory.js';
import topFactions from './topFactions.js';
import myHistory from './myHistory.js';
import liveStandings from './liveStandings.js';

const router = express.Router();

router.get('/current', current);

router.get('/nominees', nominees);

router.get('/hall-of-fame', hallOfFame);

router.get('/history', weekHistory);

router.get('/top-factions', topFactions);

router.get('/live-standings', liveStandings);

router.get('/faction/:factionId/history', factionHistory);

router.use(ensureLoggedIn);

router.get('/my-history', myHistory);

router.post('/vote', vote);

export default router;
