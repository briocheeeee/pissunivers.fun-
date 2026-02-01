import crypto from 'crypto';
import sequelize from '../../../data/sql/sequelize.js';
import { getCurrentWeek } from '../../../data/sql/TOTWWeek.js';
import { getNomineeById } from '../../../data/sql/TOTWNominee.js';
import {
  hasUserVoted,
  hasIPVoted,
  createVote,
  getUserVoteForWeek,
} from '../../../data/sql/TOTWVote.js';

function hashIP(ip) {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'totw_salt').digest('hex');
}

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;

  if (!user || !user.id) {
    return res.status(401).json({ errors: [t`You must be logged in to vote`] });
  }

  const { nomineeId } = req.body;

  if (!nomineeId) {
    return res.status(400).json({ errors: [t`Nominee ID is required`] });
  }

  const transaction = await sequelize.transaction();

  try {
    const week = await getCurrentWeek();

    if (!week.votingOpen) {
      await transaction.rollback();
      return res.status(400).json({ errors: [t`Voting is not currently open`] });
    }

    if (week.finalized) {
      await transaction.rollback();
      return res.status(400).json({ errors: [t`This week has already been finalized`] });
    }

    const nominee = await getNomineeById(nomineeId);
    if (!nominee) {
      await transaction.rollback();
      return res.status(404).json({ errors: [t`Nominee not found`] });
    }

    if (nominee.weekId !== week.id) {
      await transaction.rollback();
      return res.status(400).json({ errors: [t`Cannot vote for nominees from other weeks`] });
    }

    const alreadyVoted = await hasUserVoted(week.id, user.id);
    if (alreadyVoted) {
      await transaction.rollback();
      return res.status(400).json({ errors: [t`You have already voted this week`] });
    }

    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.connection?.remoteAddress
      || req.ip
      || '127.0.0.1';

    const ipHash = hashIP(clientIP);

    const ipAlreadyVoted = await hasIPVoted(week.id, ipHash);
    if (ipAlreadyVoted) {
      await transaction.rollback();
      return res.status(400).json({ errors: [t`A vote has already been cast from this network`] });
    }

    const userAgent = req.headers['user-agent'] || null;

    await createVote(week.id, nomineeId, user.id, ipHash, userAgent, transaction);

    await transaction.commit();

    res.json({
      success: true,
      message: t`Vote recorded successfully`,
      votedFor: {
        nomineeId: nominee.id,
        factionId: nominee.factionId,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error recording vote:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ errors: [t`You have already voted this week`] });
    }

    res.status(500).json({ errors: [t`Failed to record vote`] });
  }
};
