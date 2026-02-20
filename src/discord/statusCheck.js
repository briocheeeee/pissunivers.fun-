import logger from '../core/logger.js';
import { STATUS_CHECK_URL, STATUS_CHECK_INTERVAL_MINUTES } from '../core/config.js';

const CHANNEL_ID = '1436435820910350550';

let lastStatus = null;
let checkInterval = null;

async function checkSiteStatus() {
  if (!STATUS_CHECK_URL) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(STATUS_CHECK_URL, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function sendStatusMessage(client, isOnline) {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      logger.error('StatusCheck: channel not found');
      return;
    }
    const message = isOnline
      ? `✅ **${STATUS_CHECK_URL}** is back **ONLINE**`
      : `🔴 **${STATUS_CHECK_URL}** is **OFFLINE**`;
    await channel.send(message);
  } catch (err) {
    logger.error(`StatusCheck: failed to send message: ${err.message}`);
  }
}

async function runCheck(client) {
  const currentStatus = await checkSiteStatus();
  if (currentStatus === null) return;

  if (lastStatus === null) {
    lastStatus = currentStatus;
    return;
  }

  if (lastStatus === true && currentStatus === false) {
    await sendStatusMessage(client, false);
  } else if (lastStatus === false && currentStatus === true) {
    await sendStatusMessage(client, true);
  }

  lastStatus = currentStatus;
}

export function startStatusCheck(client) {
  if (!STATUS_CHECK_URL) {
    logger.info('StatusCheck: STATUS_CHECK_URL not configured, skipping');
    return;
  }

  const intervalMs = (STATUS_CHECK_INTERVAL_MINUTES || 10) * 60 * 1000;
  logger.info(`StatusCheck: monitoring ${STATUS_CHECK_URL} every ${STATUS_CHECK_INTERVAL_MINUTES} minutes`);

  runCheck(client);
  checkInterval = setInterval(() => runCheck(client), intervalMs);
}

export function stopStatusCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
