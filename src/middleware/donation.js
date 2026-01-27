import { getUserPermissions, isVipOrHigher, isPremium, DONATION_TIER } from '../core/donations/index.js';

export function requireDonationTier(minTier) {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('You are not logged in');
      error.status = 401;
      return next(error);
    }

    const userTier = req.user.data?.donationTier || DONATION_TIER.USER;
    const tierOrder = [DONATION_TIER.USER, DONATION_TIER.VIP, DONATION_TIER.PREMIUM];
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(minTier);

    if (userTierIndex < requiredTierIndex) {
      const error = new Error('Insufficient donation tier');
      error.status = 403;
      return next(error);
    }

    return next();
  };
}

export function requireVip(req, res, next) {
  return requireDonationTier(DONATION_TIER.VIP)(req, res, next);
}

export function requirePremium(req, res, next) {
  return requireDonationTier(DONATION_TIER.PREMIUM)(req, res, next);
}

export function attachDonationPermissions(req, res, next) {
  if (req.user) {
    const userTier = req.user.data?.donationTier || DONATION_TIER.USER;
    req.donationTier = userTier;
    req.donationPermissions = getUserPermissions(userTier);
    req.isVip = isVipOrHigher(userTier);
    req.isPremium = isPremium(userTier);
  } else {
    req.donationTier = DONATION_TIER.USER;
    req.donationPermissions = getUserPermissions(DONATION_TIER.USER);
    req.isVip = false;
    req.isPremium = false;
  }
  next();
}

export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('You are not logged in');
      error.status = 401;
      return next(error);
    }

    const userTier = req.user.data?.donationTier || DONATION_TIER.USER;
    const permissions = getUserPermissions(userTier);

    if (!permissions[permissionKey]) {
      const error = new Error(`Permission denied: ${permissionKey}`);
      error.status = 403;
      return next(error);
    }

    return next();
  };
}
