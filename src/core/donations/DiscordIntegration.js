import { getTierById, DONATION_TIER, DONATION_TIERS } from './tiers.js';
import {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
} from '../config.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

const RATE_LIMIT_RETRY_AFTER = 1000;
const MAX_RETRIES = 3;

export class DiscordIntegration {
  constructor() {
    this.botToken = DISCORD_BOT_TOKEN || null;
    this.guildId = DISCORD_GUILD_ID || null;
    this.rateLimitQueue = new Map();
  }

  isConfigured() {
    return !!(this.botToken && this.guildId);
  }

  async makeRequest(endpoint, method = 'GET', body = null, retryCount = 0) {
    if (!this.isConfigured()) {
      return { success: false, error: 'Discord integration not configured' };
    }

    const options = {
      method,
      headers: {
        Authorization: `Bot ${this.botToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, options);

      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_RETRY_AFTER;
        console.warn(`Discord rate limited, retrying after ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.makeRequest(endpoint, method, body, retryCount + 1);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}`,
          code: errorData.code,
          status: response.status,
        };
      }

      if (response.status === 204) {
        return { success: true, data: null };
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addRoleToUser(discordUserId, roleId) {
    if (!discordUserId || !roleId) {
      return { success: false, error: 'Missing discordUserId or roleId' };
    }

    return this.makeRequest(
      `/guilds/${this.guildId}/members/${discordUserId}/roles/${roleId}`,
      'PUT',
    );
  }

  async removeRoleFromUser(discordUserId, roleId) {
    if (!discordUserId || !roleId) {
      return { success: false, error: 'Missing discordUserId or roleId' };
    }

    return this.makeRequest(
      `/guilds/${this.guildId}/members/${discordUserId}/roles/${roleId}`,
      'DELETE',
    );
  }

  async assignDonationRole(discordUserId, tierId) {
    const tier = getTierById(tierId);
    if (!tier || !tier.discordRoleId) {
      return { success: false, error: 'Invalid tier or no Discord role configured' };
    }

    const result = await this.addRoleToUser(discordUserId, tier.discordRoleId);
    if (!result.success) {
      console.error(`Failed to assign Discord role for tier ${tierId}:`, result.error);
    }
    return result;
  }

  async removeDonationRole(discordUserId, tierId) {
    const tier = getTierById(tierId);
    if (!tier || !tier.discordRoleId) {
      return { success: false, error: 'Invalid tier or no Discord role configured' };
    }

    return this.removeRoleFromUser(discordUserId, tier.discordRoleId);
  }

  async syncUserRoles(discordUserId, currentTierId, previousTierId = null) {
    const results = { added: [], removed: [], errors: [] };

    if (previousTierId && previousTierId !== currentTierId) {
      const removeResult = await this.removeDonationRole(discordUserId, previousTierId);
      if (removeResult.success) {
        results.removed.push(previousTierId);
      } else {
        results.errors.push({ tier: previousTierId, action: 'remove', error: removeResult.error });
      }
    }

    if (currentTierId && currentTierId !== DONATION_TIER.USER) {
      const addResult = await this.assignDonationRole(discordUserId, currentTierId);
      if (addResult.success) {
        results.added.push(currentTierId);
      } else {
        results.errors.push({ tier: currentTierId, action: 'add', error: addResult.error });
      }
    }

    return {
      success: results.errors.length === 0,
      ...results,
    };
  }

  async getGuildMember(discordUserId) {
    return this.makeRequest(`/guilds/${this.guildId}/members/${discordUserId}`);
  }

  async isUserInGuild(discordUserId) {
    const result = await this.getGuildMember(discordUserId);
    return result.success;
  }
}

let discordIntegration = null;

export function getDiscordIntegration() {
  if (!discordIntegration) {
    discordIntegration = new DiscordIntegration();
  }
  return discordIntegration;
}

export async function assignDiscordRoleOnPayment(discordUserId, tierId, previousTierId = null) {
  const discord = getDiscordIntegration();
  if (!discord.isConfigured()) {
    console.warn('Discord integration not configured, skipping role assignment');
    return { success: false, error: 'Discord not configured' };
  }

  if (!discordUserId) {
    return { success: false, error: 'No Discord user ID linked' };
  }

  const isInGuild = await discord.isUserInGuild(discordUserId);
  if (!isInGuild) {
    console.warn(`User ${discordUserId} not in Discord guild, cannot assign role`);
    return { success: false, error: 'User not in Discord guild' };
  }

  return discord.syncUserRoles(discordUserId, tierId, previousTierId);
}

export async function removeAllDonationRoles(discordUserId) {
  const discord = getDiscordIntegration();
  if (!discord.isConfigured() || !discordUserId) {
    return { success: false, error: 'Discord not configured or no user ID' };
  }

  const results = { removed: [], errors: [] };

  for (const tier of DONATION_TIERS) {
    if (tier.id !== DONATION_TIER.USER && tier.discordRoleId) {
      const result = await discord.removeRoleFromUser(discordUserId, tier.discordRoleId);
      if (result.success) {
        results.removed.push(tier.id);
      } else if (result.code !== 10007) {
        results.errors.push({ tier: tier.id, error: result.error });
      }
    }
  }

  return { success: results.errors.length === 0, ...results };
}

export async function verifyDiscordLink(discordUserId) {
  const discord = getDiscordIntegration();
  if (!discord.isConfigured()) {
    return { valid: false, error: 'Discord not configured' };
  }

  if (!discordUserId) {
    return { valid: false, error: 'No Discord user ID' };
  }

  const memberResult = await discord.getGuildMember(discordUserId);
  if (!memberResult.success) {
    return { valid: false, error: 'User not in guild', inGuild: false };
  }

  return {
    valid: true,
    inGuild: true,
    username: memberResult.data?.user?.username,
    discriminator: memberResult.data?.user?.discriminator,
    roles: memberResult.data?.roles || [],
  };
}
