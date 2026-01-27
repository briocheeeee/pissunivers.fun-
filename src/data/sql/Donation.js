import { DataTypes, QueryTypes, Op } from 'sequelize';
import sequelize from './sequelize.js';

export const DONATION_STATUS = {
  INITIATED: 'initiated',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const Donation = sequelize.define('Donation', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  tierId: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },

  provider: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },

  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },

  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD',
  },

  paymentId: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },

  status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'pending',
  },

  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('metadata');
      return value ? JSON.parse(value) : {};
    },
    set(value) {
      this.setDataValue('metadata', value ? JSON.stringify(value) : null);
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export async function createDonation(uid, tierId, provider, amount, currency, paymentId = null) {
  try {
    const donation = await Donation.create({
      uid,
      tierId,
      provider,
      amount,
      currency,
      paymentId,
      status: 'pending',
    });
    return donation;
  } catch (error) {
    console.error(`SQL Error on createDonation: ${error.message}`);
    return null;
  }
}

export async function completeDonation(donationId) {
  try {
    await Donation.update(
      { status: 'completed', completedAt: new Date() },
      { where: { id: donationId } },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on completeDonation: ${error.message}`);
    return false;
  }
}

export async function failDonation(donationId) {
  try {
    await Donation.update(
      { status: 'failed' },
      { where: { id: donationId } },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on failDonation: ${error.message}`);
    return false;
  }
}

export async function refundDonation(donationId) {
  try {
    await Donation.update(
      { status: 'refunded' },
      { where: { id: donationId } },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on refundDonation: ${error.message}`);
    return false;
  }
}

export async function getDonationsByUser(uid) {
  try {
    return await Donation.findAll({
      where: { uid },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on getDonationsByUser: ${error.message}`);
    return [];
  }
}

export async function getDonationById(donationId) {
  try {
    return await Donation.findByPk(donationId, { raw: true });
  } catch (error) {
    console.error(`SQL Error on getDonationById: ${error.message}`);
    return null;
  }
}

export async function getDonationByPaymentId(paymentId, provider) {
  try {
    return await Donation.findOne({
      where: { paymentId, provider },
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on getDonationByPaymentId: ${error.message}`);
    return null;
  }
}

export async function getDonationStats() {
  try {
    const stats = await sequelize.query(
      `SELECT 
        COUNT(*) as totalDonations,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as totalAmount,
        COUNT(DISTINCT uid) as uniqueDonors
      FROM Donations
      WHERE status = 'completed'`,
      { type: QueryTypes.SELECT, plain: true },
    );
    return stats;
  } catch (error) {
    console.error(`SQL Error on getDonationStats: ${error.message}`);
    return { totalDonations: 0, totalAmount: 0, uniqueDonors: 0 };
  }
}

export async function findOrCreateDonationByPaymentId(paymentId, provider, donationData) {
  try {
    const existing = await Donation.findOne({
      where: { paymentId, provider },
    });

    if (existing) {
      return { donation: existing.get({ plain: true }), created: false };
    }

    const donation = await Donation.create({
      ...donationData,
      paymentId,
      provider,
    });

    return { donation: donation.get({ plain: true }), created: true };
  } catch (error) {
    console.error(`SQL Error on findOrCreateDonationByPaymentId: ${error.message}`);
    return { donation: null, created: false, error: error.message };
  }
}

export async function isDonationProcessed(paymentId, provider) {
  try {
    const donation = await Donation.findOne({
      where: {
        paymentId,
        provider,
        status: { [Op.in]: [DONATION_STATUS.COMPLETED, DONATION_STATUS.REFUNDED] },
      },
      raw: true,
    });
    return !!donation;
  } catch (error) {
    console.error(`SQL Error on isDonationProcessed: ${error.message}`);
    return false;
  }
}

export async function updateDonationStatus(donationId, status, metadata = null) {
  try {
    const updateData = { status };
    if (status === DONATION_STATUS.COMPLETED) {
      updateData.completedAt = new Date();
    }
    if (metadata) {
      const donation = await Donation.findByPk(donationId);
      if (donation) {
        const existingMetadata = donation.metadata || {};
        updateData.metadata = JSON.stringify({ ...existingMetadata, ...metadata });
      }
    }
    await Donation.update(updateData, { where: { id: donationId } });
    return true;
  } catch (error) {
    console.error(`SQL Error on updateDonationStatus: ${error.message}`);
    return false;
  }
}

export async function createInitiatedDonation(uid, tierId, provider, amount, currency, sessionId) {
  try {
    const donation = await Donation.create({
      uid,
      tierId,
      provider,
      amount,
      currency,
      paymentId: sessionId,
      status: DONATION_STATUS.INITIATED,
      metadata: JSON.stringify({ sessionId, initiatedAt: new Date().toISOString() }),
    });
    return donation.get({ plain: true });
  } catch (error) {
    console.error(`SQL Error on createInitiatedDonation: ${error.message}`);
    return null;
  }
}

export default Donation;
