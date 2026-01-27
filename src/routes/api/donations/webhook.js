import crypto from 'crypto';
import express from 'express';
import { getProvider } from '../../../core/donations/index.js';
import { getDonationService, initDonationService } from '../../../core/donations/DonationService.js';
import { User } from '../../../data/sql/index.js';
import { isDonationProcessed } from '../../../data/sql/Donation.js';

const router = express.Router();

initDonationService(User);

function verifyPatreonSignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('md5', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

router.post('/patreon', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-patreon-signature'];
  const rawBody = req.body;
  let payload;

  try {
    payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    if (Buffer.isBuffer(rawBody)) {
      payload = JSON.parse(rawBody.toString());
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const provider = getProvider('patreon');
  if (provider?.webhookSecret && signature) {
    const isValid = verifyPatreonSignature(rawBody, signature, provider.webhookSecret);
    if (!isValid) {
      console.error('Patreon webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const paymentId = payload?.data?.id;
  if (paymentId) {
    const alreadyProcessed = await isDonationProcessed(paymentId, 'patreon');
    if (alreadyProcessed) {
      console.log(`Patreon webhook: Payment ${paymentId} already processed (idempotent)`);
      return res.status(200).json({ received: true, status: 'already_processed' });
    }
  }

  const donationService = getDonationService();
  const result = await donationService.handleWebhook('patreon', payload, signature);

  if (!result.success) {
    console.error('Patreon webhook error:', result.error);
    return res.status(400).json({ error: result.error });
  }

  return res.status(200).json({ received: true });
});

export default router;
