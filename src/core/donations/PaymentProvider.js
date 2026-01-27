import {
  PATREON_CLIENT_ID,
  PATREON_CLIENT_SECRET,
  PATREON_WEBHOOK_SECRET,
} from '../config.js';

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export class PaymentProvider {
  constructor(name) {
    this.name = name;
  }

  async createPaymentSession(userId, tierId, metadata = {}) {
    throw new Error(`createPaymentSession not implemented for ${this.name}`);
  }

  async verifyPayment(paymentId) {
    throw new Error(`verifyPayment not implemented for ${this.name}`);
  }

  async handleWebhook(payload, signature) {
    throw new Error(`handleWebhook not implemented for ${this.name}`);
  }

  async getCustomerId(userId) {
    throw new Error(`getCustomerId not implemented for ${this.name}`);
  }

  async linkCustomer(userId, customerId) {
    throw new Error(`linkCustomer not implemented for ${this.name}`);
  }

  getPaymentUrl(sessionData) {
    throw new Error(`getPaymentUrl not implemented for ${this.name}`);
  }
}

export class PatreonProvider extends PaymentProvider {
  constructor() {
    super('patreon');
    this.clientId = PATREON_CLIENT_ID || null;
    this.clientSecret = PATREON_CLIENT_SECRET || null;
    this.webhookSecret = PATREON_WEBHOOK_SECRET || null;
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  async createPaymentSession(userId, tierId, metadata = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: 'Patreon provider not configured' };
    }

    return {
      success: true,
      provider: this.name,
      redirectUrl: `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(metadata.redirectUri || '')}&scope=identity%20identity.memberships`,
      sessionId: `patreon_${userId}_${tierId}_${Date.now()}`,
    };
  }

  async verifyPayment(paymentId) {
    if (!this.isConfigured()) {
      return { success: false, error: 'Patreon provider not configured' };
    }

    return {
      success: true,
      status: PAYMENT_STATUS.PENDING,
      paymentId,
    };
  }

  async handleWebhook(payload, signature) {
    if (!this.webhookSecret) {
      return { success: false, error: 'Webhook secret not configured' };
    }

    const event = payload;
    const eventType = event?.data?.type;

    if (eventType === 'member' && event?.data?.attributes?.patron_status === 'active_patron') {
      return {
        success: true,
        event: 'payment_completed',
        userId: event?.data?.relationships?.user?.data?.id,
        tierId: event?.data?.relationships?.currently_entitled_tiers?.data?.[0]?.id,
        customerId: event?.data?.relationships?.user?.data?.id,
      };
    }

    return { success: true, event: 'ignored' };
  }

  getPaymentUrl(sessionData) {
    return sessionData.redirectUrl;
  }
}

const providers = new Map();

export function registerProvider(provider) {
  providers.set(provider.name, provider);
}

export function getProvider(name) {
  return providers.get(name) || null;
}

export function getAllProviders() {
  return Array.from(providers.values());
}

export function getConfiguredProviders() {
  return getAllProviders().filter((p) => p.isConfigured());
}

registerProvider(new PatreonProvider());
