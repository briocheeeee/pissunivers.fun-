import { canUseGlobalAlert, getGlobalAlertCooldown, DONATION_TIER } from './index.js';
import { User } from '../../data/sql/index.js';

export const GLOBAL_ALERT_STATUS = {
  SUCCESS: 'success',
  NO_PERMISSION: 'no_permission',
  COOLDOWN_ACTIVE: 'cooldown_active',
  INVALID_MESSAGE: 'invalid_message',
  ERROR: 'error',
};

export async function getLastGlobalAlertTime(userId) {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['lastGlobalAlert'],
      raw: true,
    });
    return user?.lastGlobalAlert ? new Date(user.lastGlobalAlert).getTime() : null;
  } catch (error) {
    console.error(`Error getting lastGlobalAlert for user ${userId}:`, error.message);
    return null;
  }
}

export async function setLastGlobalAlertTime(userId) {
  try {
    await User.update(
      { lastGlobalAlert: new Date() },
      { where: { id: userId } },
    );
    return true;
  } catch (error) {
    console.error(`Error setting lastGlobalAlert for user ${userId}:`, error.message);
    return false;
  }
}

export function getRemainingCooldown(lastAlertTime, donationTier) {
  if (!lastAlertTime) return 0;

  const cooldownDuration = getGlobalAlertCooldown(donationTier);
  if (!cooldownDuration) return Infinity;

  const elapsed = Date.now() - lastAlertTime;
  const remaining = cooldownDuration - elapsed;

  return remaining > 0 ? remaining : 0;
}

export async function canSendGlobalAlert(userId, donationTier) {
  if (!canUseGlobalAlert(donationTier)) {
    return {
      allowed: false,
      reason: GLOBAL_ALERT_STATUS.NO_PERMISSION,
      remainingCooldown: null,
    };
  }

  const lastAlertTime = await getLastGlobalAlertTime(userId);
  const remainingCooldown = getRemainingCooldown(lastAlertTime, donationTier);

  if (remainingCooldown > 0) {
    return {
      allowed: false,
      reason: GLOBAL_ALERT_STATUS.COOLDOWN_ACTIVE,
      remainingCooldown,
    };
  }

  return {
    allowed: true,
    reason: null,
    remainingCooldown: 0,
  };
}

export async function sendGlobalAlert(userId, donationTier, message, broadcastFn) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      success: false,
      status: GLOBAL_ALERT_STATUS.INVALID_MESSAGE,
      error: 'Message cannot be empty',
    };
  }

  if (message.length > 500) {
    return {
      success: false,
      status: GLOBAL_ALERT_STATUS.INVALID_MESSAGE,
      error: 'Message too long (max 500 characters)',
    };
  }

  const canSend = await canSendGlobalAlert(userId, donationTier);
  if (!canSend.allowed) {
    return {
      success: false,
      status: canSend.reason,
      remainingCooldown: canSend.remainingCooldown,
    };
  }

  const updated = await setLastGlobalAlertTime(userId);
  if (!updated) {
    return {
      success: false,
      status: GLOBAL_ALERT_STATUS.ERROR,
      error: 'Failed to update cooldown',
    };
  }

  if (broadcastFn && typeof broadcastFn === 'function') {
    try {
      await broadcastFn(message.trim(), userId, donationTier);
    } catch (error) {
      console.error('Error broadcasting global alert:', error.message);
      return {
        success: false,
        status: GLOBAL_ALERT_STATUS.ERROR,
        error: 'Failed to broadcast alert',
      };
    }
  }

  const cooldownDuration = getGlobalAlertCooldown(donationTier);

  return {
    success: true,
    status: GLOBAL_ALERT_STATUS.SUCCESS,
    nextAvailableAt: Date.now() + cooldownDuration,
  };
}

export function formatCooldownRemaining(ms) {
  if (ms <= 0) return 'Available now';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(' ') || 'Available now';
}
