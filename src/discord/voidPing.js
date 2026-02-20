import logger from '../core/logger.js';
import { PORT } from '../core/config.js';

const CHANNEL_ID = '1436435821182844970';
const ROLE_ID = '1436435813217996903';

const POLL_INTERVAL_MS = 15 * 1000;

let lastSeenSuccess = null;
let pollTimer = null;
let getSuccessFn = null;

async function fetchSuccessState() {
  try {
    if (!getSuccessFn) {
      const mod = await import('../data/redis/Event.js');
      getSuccessFn = mod.getSuccess;
    }
    return await getSuccessFn();
  } catch (err) {
    logger.error(`VoidPing: failed to fetch success state: ${err.message}`);
    return null;
  }
}

async function sendVoidMessage(client, won) {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      logger.error('VoidPing: channel not found');
      return;
    }

    const siteUrl = `http://localhost:${PORT}`;
    const pixelroyalLink = `${siteUrl}/#d,0,0,30`;

    if (won) {
      await channel.send(
        `🏆 **Void won!** The cooldown is now halved sitewide!\n<@&${ROLE_ID}>\n${pixelroyalLink}`,
      );
    } else {
      await channel.send(
        `💀 **Void lost.** The area couldn't be defended.\n${pixelroyalLink}`,
      );
    }
  } catch (err) {
    logger.error(`VoidPing: failed to send message: ${err.message}`);
  }
}

async function runPoll(client) {
  try {
    const success = await fetchSuccessState();

    if (success === null) return;

    if (lastSeenSuccess === null) {
      lastSeenSuccess = success;
      return;
    }

    if (success === 0 && (lastSeenSuccess === 1 || lastSeenSuccess === 2)) {
      lastSeenSuccess = 0;
      return;
    }

    if (lastSeenSuccess !== 1 && success === 1) {
      await sendVoidMessage(client, true);
    } else if (lastSeenSuccess !== 2 && success === 2) {
      await sendVoidMessage(client, false);
    }

    lastSeenSuccess = success;
  } catch (err) {
    logger.error(`VoidPing: poll error: ${err.message}`);
  }
}

export function startVoidPing(client) {
  logger.info('VoidPing: starting void event monitor');
  runPoll(client);
  pollTimer = setInterval(() => runPoll(client), POLL_INTERVAL_MS);
}

export function stopVoidPing() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
