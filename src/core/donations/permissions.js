import { DONATION_TIER, getTierById, getHighestTier } from './tiers.js';
import { HOUR } from '../constants.js';

const BASE_PERMISSIONS = {
  maxPixelStackMultiplier: 1.0,
  colorfulNickname: false,
  profileCustomization: false,
  canUseGlobalAlert: false,
  globalAlertCooldown: null,
};

export function getUserPermissions(donationTier) {
  if (!donationTier || donationTier === DONATION_TIER.USER) {
    return { ...BASE_PERMISSIONS };
  }

  const tier = getTierById(donationTier);
  if (!tier) {
    return { ...BASE_PERMISSIONS };
  }

  return {
    ...BASE_PERMISSIONS,
    ...tier.sitePermissions,
  };
}

export function hasPermission(donationTier, permissionKey) {
  const permissions = getUserPermissions(donationTier);
  return !!permissions[permissionKey];
}

export function getMaxPixelStackMultiplier(donationTier) {
  const permissions = getUserPermissions(donationTier);
  return permissions.maxPixelStackMultiplier;
}

export function canUseColorfulNickname(donationTier) {
  return hasPermission(donationTier, 'colorfulNickname');
}

export function canCustomizeProfile(donationTier) {
  return hasPermission(donationTier, 'profileCustomization');
}

export function canUseGlobalAlert(donationTier) {
  return hasPermission(donationTier, 'canUseGlobalAlert');
}

export function getGlobalAlertCooldown(donationTier) {
  const permissions = getUserPermissions(donationTier);
  return permissions.globalAlertCooldown;
}

export function isVipOrHigher(donationTier) {
  return donationTier === DONATION_TIER.VIP || donationTier === DONATION_TIER.PREMIUM;
}

export function isPremium(donationTier) {
  return donationTier === DONATION_TIER.PREMIUM;
}
