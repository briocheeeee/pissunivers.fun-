import express from 'express';
import { verifySession, ensureLoggedIn } from '../../middleware/session.js';
import { attachDonationPermissions } from '../../middleware/donation.js';
import {
  DONATION_TIERS,
  DONATION_TIER,
  getTierById,
  getConfiguredProviders,
  getProvider,
  canSendGlobalAlert,
  sendGlobalAlert,
  getLastGlobalAlertTime,
  getRemainingCooldown,
  formatCooldownRemaining,
  getAvailableColors,
  getAvailableGradients,
  getUserNicknameStyle,
  setUserNicknameStyle,
  getAvailableBackgrounds,
  getAvailableFrames,
  getUserProfileCustomization,
  setUserProfileCustomization,
  verifyDiscordLink,
  assignDiscordRoleOnPayment,
} from '../../core/donations/index.js';
import { initDonationService, getDonationService } from '../../core/donations/DonationService.js';
import { User } from '../../data/sql/index.js';

const router = express.Router();

initDonationService(User);

router.get('/tiers', (req, res) => {
  const tiers = DONATION_TIERS.map((tier) => ({
    id: tier.id,
    name: tier.name,
    price: tier.price,
    currency: tier.currency,
    perks: tier.perks,
  }));

  res.json({ tiers });
});

router.get('/providers', (req, res) => {
  const providers = getConfiguredProviders().map((p) => ({
    name: p.name,
    configured: true,
  }));

  res.json({ providers });
});

router.use(verifySession);

router.get('/me', ensureLoggedIn, attachDonationPermissions, async (req, res) => {
  const donationService = getDonationService();
  const history = await donationService.getUserDonationHistory(req.user.id);

  res.json({
    tier: req.donationTier,
    permissions: req.donationPermissions,
    isVip: req.isVip,
    isPremium: req.isPremium,
    history,
  });
});

router.post('/initiate', ensureLoggedIn, async (req, res) => {
  const { tierId, provider, redirectUri } = req.body;

  if (!tierId || !provider) {
    return res.status(400).json({ error: 'Missing tierId or provider' });
  }

  const tier = getTierById(tierId);
  if (!tier) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const paymentProvider = getProvider(provider);
  if (!paymentProvider || !paymentProvider.isConfigured()) {
    return res.status(400).json({ error: 'Payment provider not available' });
  }

  const donationService = getDonationService();
  const result = await donationService.initiatePayment(
    req.user.id,
    tierId,
    provider,
    { redirectUri: redirectUri || `${req.protocol}://${req.get('host')}/donations/callback` },
  );

  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }

  return res.json(result);
});

router.get('/history', ensureLoggedIn, async (req, res) => {
  const donationService = getDonationService();
  const history = await donationService.getUserDonationHistory(req.user.id);
  res.json({ history });
});

router.get('/permissions', ensureLoggedIn, attachDonationPermissions, (req, res) => {
  res.json({
    tier: req.donationTier,
    permissions: req.donationPermissions,
  });
});

router.get('/global-alert/status', ensureLoggedIn, attachDonationPermissions, async (req, res) => {
  const canSend = await canSendGlobalAlert(req.user.id, req.donationTier);
  res.json({
    canSend: canSend.allowed,
    reason: canSend.reason,
    remainingCooldown: canSend.remainingCooldown,
    remainingFormatted: canSend.remainingCooldown
      ? formatCooldownRemaining(canSend.remainingCooldown)
      : null,
  });
});

router.post('/global-alert/send', ensureLoggedIn, attachDonationPermissions, async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const broadcastFn = async (msg, userId, tier) => {
    const socketEvents = (await import('../../socket/socketEvents.js')).default;
    socketEvents.emit('globalAlert', { message: msg, userId, tier });
  };

  const result = await sendGlobalAlert(req.user.id, req.donationTier, message, broadcastFn);

  if (!result.success) {
    return res.status(400).json({
      error: result.error || result.status,
      remainingCooldown: result.remainingCooldown,
      remainingFormatted: result.remainingCooldown
        ? formatCooldownRemaining(result.remainingCooldown)
        : null,
    });
  }

  return res.json({
    success: true,
    nextAvailableAt: result.nextAvailableAt,
  });
});

router.get('/nickname/options', ensureLoggedIn, attachDonationPermissions, (req, res) => {
  res.json({
    colors: getAvailableColors(),
    gradients: req.isPremium ? getAvailableGradients() : [],
    canUseColors: req.isVip || req.isPremium,
    canUseGradients: req.isPremium,
  });
});

router.get('/nickname/current', ensureLoggedIn, async (req, res) => {
  const style = await getUserNicknameStyle(req.user.id);
  res.json({ style });
});

router.post('/nickname/set', ensureLoggedIn, attachDonationPermissions, async (req, res) => {
  const { type, value } = req.body;

  if (!type) {
    return res.status(400).json({ error: 'Style type is required' });
  }

  const result = await setUserNicknameStyle(req.user.id, req.donationTier, type, value);

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, style: result.style });
});

router.get('/profile/options', ensureLoggedIn, attachDonationPermissions, (req, res) => {
  if (!req.isPremium) {
    return res.status(403).json({ error: 'Premium required for profile customization' });
  }

  res.json({
    backgrounds: getAvailableBackgrounds(),
    frames: getAvailableFrames(),
  });
});

router.get('/profile/current', ensureLoggedIn, async (req, res) => {
  const customization = await getUserProfileCustomization(req.user.id);
  res.json({ customization });
});

router.post('/profile/set', ensureLoggedIn, attachDonationPermissions, async (req, res) => {
  const { background, frame, bio } = req.body;

  const result = await setUserProfileCustomization(req.user.id, req.donationTier, {
    background,
    frame,
    bio,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, customization: result.customization });
});

router.get('/discord/status', ensureLoggedIn, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['discordUserId'],
    raw: true,
  });

  if (!user?.discordUserId) {
    return res.json({ linked: false });
  }

  const verification = await verifyDiscordLink(user.discordUserId);
  return res.json({
    linked: true,
    discordUserId: user.discordUserId,
    ...verification,
  });
});

router.post('/discord/link', ensureLoggedIn, async (req, res) => {
  const { discordUserId } = req.body;

  if (!discordUserId) {
    return res.status(400).json({ error: 'Discord user ID is required' });
  }

  const verification = await verifyDiscordLink(discordUserId);
  if (!verification.valid) {
    return res.status(400).json({ error: verification.error || 'Invalid Discord user' });
  }

  try {
    await User.update(
      { discordUserId },
      { where: { id: req.user.id } },
    );

    const user = await User.findByPk(req.user.id, {
      attributes: ['donationTier'],
      raw: true,
    });

    if (user?.donationTier && user.donationTier !== 'user') {
      await assignDiscordRoleOnPayment(discordUserId, user.donationTier);
    }

    return res.json({
      success: true,
      discordUserId,
      username: verification.username,
    });
  } catch (error) {
    console.error('Error linking Discord:', error.message);
    return res.status(500).json({ error: 'Failed to link Discord account' });
  }
});

router.post('/discord/unlink', ensureLoggedIn, async (req, res) => {
  try {
    await User.update(
      { discordUserId: null },
      { where: { id: req.user.id } },
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking Discord:', error.message);
    return res.status(500).json({ error: 'Failed to unlink Discord account' });
  }
});

router.get('/badges/current', ensureLoggedIn, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['chatBadges'],
    raw: true,
  });

  const badges = user?.chatBadges ? JSON.parse(user.chatBadges) : [];
  return res.json({ badges });
});

router.post('/badges/set', ensureLoggedIn, attachDonationPermissions, async (req, res) => {
  const { badges } = req.body;

  if (!Array.isArray(badges)) {
    return res.status(400).json({ error: 'Badges must be an array' });
  }

  const allowedBadges = [];
  if (req.isVip) allowedBadges.push('vip');
  if (req.isPremium) allowedBadges.push('premium');

  const validBadges = badges.filter((b) => allowedBadges.includes(b));

  try {
    await User.update(
      { chatBadges: JSON.stringify(validBadges) },
      { where: { id: req.user.id } },
    );

    return res.json({ success: true, badges: validBadges });
  } catch (error) {
    console.error('Error setting badges:', error.message);
    return res.status(500).json({ error: 'Failed to set badges' });
  }
});

export default router;
