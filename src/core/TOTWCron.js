import { DailyCron } from '../utils/cron.js';
import logger from './logger.js';
import socketEvents from '../socket/socketEvents.js';
import {
  getCurrentWeek,
  updateWeekStatus,
} from '../data/sql/TOTWWeek.js';
import {
  generateNominees,
  closeVotingAndDetermineWinners,
} from './TOTWService.js';

const VOTING_OPEN_DAY = 5;
const VOTING_CLOSE_DAY = 0;

async function processTOTWWeekly() {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hour = now.getUTCHours();

    const week = await getCurrentWeek();

    if (week.finalized) {
      return;
    }

    if (dayOfWeek === VOTING_OPEN_DAY && hour >= 12 && !week.votingOpen) {
      logger.info('TOTW: Generating nominees and opening voting');
      await generateNominees();
      await updateWeekStatus(week.id, { votingOpen: true });
      socketEvents.broadcastAnnouncement(
        '🏆 **Team of the Week voting is now open!** Vote for your favorite faction before Sunday 23:00 UTC.',
      );
      logger.info('TOTW: Voting is now open');
    }

    if (dayOfWeek === VOTING_CLOSE_DAY && hour >= 23 && week.votingOpen && !week.finalized) {
      logger.info('TOTW: Closing voting and determining winners');
      const result = await closeVotingAndDetermineWinners(week.id);
      if (result.error) {
        logger.error(`TOTW: Error finalizing week: ${result.error}`);
      } else {
        const winnerNames = result.winners.map((w) => w.factionName).slice(0, 3).join(', ');
        socketEvents.broadcastAnnouncement(
          `🎉 **Team of the Week winners announced!** Congratulations to ${winnerNames}${result.winners.length > 3 ? ' and more' : ''}!`,
        );
        logger.info(`TOTW: Week finalized with ${result.winners.length} winners`);
      }
    }
  } catch (error) {
    logger.error(`TOTW Cron Error: ${error.message}`);
  }
}

DailyCron.hook(processTOTWWeekly);

export default processTOTWWeekly;
