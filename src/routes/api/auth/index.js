import express from 'express';

import { ensureLoggedIn } from '../../../middleware/session.js';
import authRateLimit from '../../../middleware/authRateLimit.js';

import register from './register.js';
import verify from './verify.js';
import local from './local.js';
import logout from './logout.js';
// eslint-disable-next-line camelcase
import get_tpids from './get_tpids.js';
// eslint-disable-next-line camelcase
import remove_tpid from './remove_tpid.js';
// eslint-disable-next-line camelcase
import close_session from './close_session.js';
// eslint-disable-next-line camelcase
import revoke_consent from './revoke_consent.js';
// eslint-disable-next-line camelcase
import resend_verify from './resend_verify.js';
// eslint-disable-next-line camelcase
import change_passwd from './change_passwd.js';
// eslint-disable-next-line camelcase
import delete_account from './delete_account.js';
// eslint-disable-next-line camelcase
import change_name from './change_name.js';
// eslint-disable-next-line camelcase
import change_username from './change_username.js';
// eslint-disable-next-line camelcase
import change_mail from './change_mail.js';
// eslint-disable-next-line camelcase
import restore_password from './restore_password.js';

const router = express.Router();

/*
 * JSON APIs
 */

router.get('/verify', verify);

router.post('/restore_password', authRateLimit, restore_password);

router.post('/register', authRateLimit, register);

router.post('/local', authRateLimit, local);

router.use(ensureLoggedIn);

/*
 * require registered user after this point
 */

router.get('/logout', logout);

router.get('/get_tpids', get_tpids);

router.get('/resend_verify', resend_verify);

router.post('/remove_tpid', remove_tpid);

router.post('/close_session', close_session);

router.post('/revoke_consent', revoke_consent);

router.post('/change_passwd', change_passwd);

router.post('/change_name', change_name);

router.post('/change_username', change_username);

router.post('/change_mail', change_mail);

router.post('/delete_account', delete_account);



export default router;
