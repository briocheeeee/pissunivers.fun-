import logger from '../../../core/logger.js';
import {
  createNewUser, getUsersByNameOrEmail,
} from '../../../data/sql/User.js';
import {
  addOrReplaceTpid, THREEPID_PROVIDERS,
} from '../../../data/sql/ThreePID.js';
import mailProvider from '../../../core/MailProvider.js';
import getMe from '../../../core/me.js';
import { openSession } from '../../../middleware/session.js';
import { checkMailOverShards } from '../../../utils/intel/index.js';
import {
  validateEMail,
  validateName,
  validatePassword,
  validateUsername,
} from '../../../utils/validation.js';
import { checkCaptchaSolution } from '../../../data/redis/captcha.js';

async function validate(
  email, name, username, password, captcha, captchaid, t, gettext,
) {
  const errors = [];
  const nameerror = validateName(name);
  if (nameerror) errors.push(nameerror);
  const usernameerror = validateUsername(username);
  if (usernameerror) errors.push(usernameerror);
  const passworderror = gettext(validatePassword(password));
  if (passworderror) errors.push(passworderror);

  if (!captcha || !captchaid) {
    errors.push(t`No Captcha given`);
  }
  const emailerror = gettext(validateEMail(email));
  if (emailerror) errors.push(emailerror);

  return errors;
}

export default async (req, res) => {
  const {
    email, name, password, captcha, captchaid, cs: challengeSolution,
  } = req.body;
  const { t, gettext } = req.ttag;
  const username = req.body.username?.toLowerCase();
  const errors = await validate(
    email, name, username, password, captcha, captchaid, t, gettext,
  );

  const { ip } = req;
  const userAgent = req.headers['user-agent'];
  if (!errors.length) {
    const captchaPass = await checkCaptchaSolution(
      captcha, ip.ipString, userAgent, true, captchaid, challengeSolution,
    );
    switch (captchaPass) {
      case 0:
        break;
      case 1:
        errors.push(t`You took too long, try again`);
        break;
      case 2:
        errors.push(t`You failed your captcha`);
        break;
      case 5:
        errors.push(t`Please refresh the website`);
        break;
      case 6:
        errors.push(t`Your Browser looks shady`);
        break;
      default:
        errors.push(t`Unknown Captcha Error`);
        break;
    }
  }

  if (!errors.length) {
    const users = await getUsersByNameOrEmail(name, email, username);
    if (!users) {
      errors.push(t`Please try again.`);
    } else if (users.length) {
      if (users[0].byEMail) {
        errors.push(t`E-Mail already in use.`);
      } else {
        errors.push(t`Username already in use.`);
      }
    }
  }

  if (!errors.length && (await checkMailOverShards(email))) {
    errors.push(t`This email provider is not allowed`);
  }

  if (!errors.length) {
    const { isBanned, isProxy } = await ip.getAllowance();
    if (isProxy) {
      errors.push(t`You can not register an account with a proxy`);
    }
    if (isBanned) {
      errors.push(t`You can not register an account while you are banned`);
    }
  }

  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const user = await createNewUser(name, password, username);
  if (!user) {
    res.status(500);
    res.json({
      errors: [t`Failed to create a new user :(`],
    });
    return;
  }

  /*
   * we could allow registering without email if we change validation and
   * put this under an if
   */
  await addOrReplaceTpid(user.id, THREEPID_PROVIDERS.EMAIL, email);

  logger.info(`Created new user ${name} ${email} ${ip.ipString}`);

  /* session duration, null for permanent */
  let { durationsel: durationHours } = req.body;
  if (durationHours === 'forever') {
    durationHours = null;
  } else {
    durationHours = parseInt(durationHours, 10);
    if (Number.isNaN(durationHours)) {
      // default to 30 days if gibberish
      durationHours = 720;
    }
  }

  await openSession(req, res, user.id, durationHours);
  const me = await getMe(req.user, ip, req.lang);

  const host = req.ip.getHost();
  if (email) {
    mailProvider.sendVerifyMail(email, name, host, req.lang);
  }

  res.status(200);
  res.json({
    success: true,
    me,
  });
};
