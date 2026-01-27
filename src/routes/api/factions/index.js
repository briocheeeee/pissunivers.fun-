import express from 'express';
import { ensureLoggedIn } from '../../../middleware/session.js';

import create from './create.js';
import get from './get.js';
import update from './update.js';
import remove from './delete.js';
import join from './join.js';
import leave from './leave.js';
import members from './members.js';
import requests from './requests.js';
import rankings from './rankings.js';
import myFaction from './myFaction.js';
import transfer from './transfer.js';
import kick from './kick.js';
import avatar from './avatar.js';
import stats from './stats.js';

const router = express.Router();

router.get('/rankings', rankings);

router.get('/:id', get);

router.use(ensureLoggedIn);

router.get('/my/faction', myFaction);

router.post('/create', create);

router.put('/:id', update);

router.delete('/:id', remove);

router.post('/:id/join', join);

router.post('/:id/leave', leave);

router.get('/:id/members', members);

router.get('/:id/requests', requests);

router.post('/:id/requests/:requestId/accept', requests);

router.post('/:id/requests/:requestId/reject', requests);

router.post('/:id/transfer', transfer);

router.post('/:id/kick', kick);

router.post('/:id/avatar', avatar);

router.get('/:id/stats', stats);

export default router;
