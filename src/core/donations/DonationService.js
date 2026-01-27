import { DONATION_TIER, getTierById, getTierByProductId } from './tiers.js';
import { getUserPermissions } from './permissions.js';
import { getProvider, PAYMENT_STATUS } from './PaymentProvider.js';
import { assignDiscordRoleOnPayment, getDiscordIntegration } from './DiscordIntegration.js';

export class DonationService {
  constructor(userModel) {
    this.userModel = userModel;
  }

  async getUserDonationTier(userId) {
    const user = await this.userModel.findByPk(userId, {
      attributes: ['donationTier'],
      raw: true,
    });
    return user?.donationTier || DONATION_TIER.USER;
  }

  async setUserDonationTier(userId, tierId) {
    const tier = getTierById(tierId);
    if (!tier && tierId !== DONATION_TIER.USER) {
      return { success: false, error: 'Invalid tier' };
    }

    try {
      await this.userModel.update(
        { donationTier: tierId },
        { where: { id: userId } },
      );
      return { success: true };
    } catch (error) {
      console.error(`Failed to set donation tier for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async addDonationToHistory(userId, donationData) {
    try {
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const history = user.donationHistory || [];
      history.push({
        ...donationData,
        timestamp: new Date().toISOString(),
      });

      await this.userModel.update(
        { donationHistory: JSON.stringify(history) },
        { where: { id: userId } },
      );

      return { success: true };
    } catch (error) {
      console.error(`Failed to add donation to history for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async getUserDonationHistory(userId) {
    try {
      const user = await this.userModel.findByPk(userId, {
        attributes: ['donationHistory'],
        raw: true,
      });

      if (!user || !user.donationHistory) {
        return [];
      }

      return typeof user.donationHistory === 'string'
        ? JSON.parse(user.donationHistory)
        : user.donationHistory;
    } catch (error) {
      console.error(`Failed to get donation history for user ${userId}:`, error.message);
      return [];
    }
  }

  async setProviderCustomerId(userId, provider, customerId) {
    try {
      const user = await this.userModel.findByPk(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const customerIds = user.providerCustomerIds || {};
      customerIds[provider] = customerId;

      await this.userModel.update(
        { providerCustomerIds: JSON.stringify(customerIds) },
        { where: { id: userId } },
      );

      return { success: true };
    } catch (error) {
      console.error(`Failed to set provider customer ID for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async getProviderCustomerId(userId, provider) {
    try {
      const user = await this.userModel.findByPk(userId, {
        attributes: ['providerCustomerIds'],
        raw: true,
      });

      if (!user || !user.providerCustomerIds) {
        return null;
      }

      const customerIds = typeof user.providerCustomerIds === 'string'
        ? JSON.parse(user.providerCustomerIds)
        : user.providerCustomerIds;

      return customerIds[provider] || null;
    } catch (error) {
      console.error(`Failed to get provider customer ID for user ${userId}:`, error.message);
      return null;
    }
  }

  async initiatePayment(userId, tierId, providerName, metadata = {}) {
    const provider = getProvider(providerName);
    if (!provider) {
      return { success: false, error: 'Unknown payment provider' };
    }

    if (!provider.isConfigured()) {
      return { success: false, error: `${providerName} is not configured` };
    }

    const tier = getTierById(tierId);
    if (!tier) {
      return { success: false, error: 'Invalid tier' };
    }

    const session = await provider.createPaymentSession(userId, tierId, {
      ...metadata,
      amount: tier.price,
      currency: tier.currency,
      tierName: tier.name,
    });

    if (!session.success) {
      return session;
    }

    return {
      success: true,
      paymentUrl: provider.getPaymentUrl(session),
      sessionId: session.sessionId,
      provider: providerName,
      tier: {
        id: tier.id,
        name: tier.name,
        price: tier.price,
        currency: tier.currency,
      },
    };
  }

  async processPaymentCompletion(userId, tierId, providerName, paymentData) {
    const previousTier = await this.getUserDonationTier(userId);

    const tierResult = await this.setUserDonationTier(userId, tierId);
    if (!tierResult.success) {
      return tierResult;
    }

    const historyResult = await this.addDonationToHistory(userId, {
      tierId,
      provider: providerName,
      amount: paymentData.amount,
      currency: paymentData.currency,
      paymentId: paymentData.paymentId,
      status: PAYMENT_STATUS.COMPLETED,
    });

    if (paymentData.customerId) {
      await this.setProviderCustomerId(userId, providerName, paymentData.customerId);
    }

    let discordResult = { success: false, error: 'No Discord ID linked' };
    if (paymentData.discordUserId) {
      const discord = getDiscordIntegration();
      discordResult = await discord.syncUserRoles(
        paymentData.discordUserId,
        tierId,
        previousTier,
      );
    }

    return {
      success: true,
      tierUpdated: true,
      historyUpdated: historyResult.success,
      discordSynced: discordResult.success,
      newTier: tierId,
      previousTier,
    };
  }

  async handleWebhook(providerName, payload, signature) {
    const provider = getProvider(providerName);
    if (!provider) {
      return { success: false, error: 'Unknown payment provider' };
    }

    const result = await provider.handleWebhook(payload, signature);
    if (!result.success) {
      return result;
    }

    if (result.event === 'payment_completed' && result.userId && result.tierId) {
      const tier = getTierByProductId(providerName, result.tierId);
      if (tier) {
        return this.processPaymentCompletion(result.userId, tier.id, providerName, {
          amount: tier.price,
          currency: tier.currency,
          customerId: result.customerId,
          paymentId: result.paymentId,
        });
      }
    }

    return { success: true, event: result.event };
  }

  getUserPermissions(donationTier) {
    return getUserPermissions(donationTier);
  }
}

let donationService = null;

export function getDonationService(userModel) {
  if (!donationService && userModel) {
    donationService = new DonationService(userModel);
  }
  return donationService;
}

export function initDonationService(userModel) {
  donationService = new DonationService(userModel);
  return donationService;
}
