/*
 * request resend of verification mail
 */

import mailProvider from '../../../core/MailProvider.js';
import { USERLVL } from '../../../data/sql/index.js';
import { getEmailOfUser } from '../../../data/sql/ThreePID.js';

export default async (req, res) => {
  const { user, lang, ttag: { t } } = req;

  const { name, userlvl } = user.data;
  if (userlvl >= USERLVL.VERIFIED) {
    throw new Error(t`You are already verified.`);
  }

  const email = await getEmailOfUser(user.id);
  if (email === false) {
    throw new Error(
      // eslint-disable-next-line max-len
      t`You do not have any email adress set. Please add one under "Login Methods".`,
    );
  }
  if (!email) {
    throw new Error(t`An error occured. Please try again later.`);
  }

  const host = req.ip.getHost();
  const error = await mailProvider.sendVerifyMail(email, name, host, lang);
  if (error) {
    throw new Error(error);
  }
  res.json({
    success: true,
  });
};
