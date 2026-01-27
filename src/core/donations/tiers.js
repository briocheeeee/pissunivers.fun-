import {
  DISCORD_VIP_ROLE_ID,
  DISCORD_PREMIUM_ROLE_ID,
  PATREON_VIP_PRODUCT_ID,
  PATREON_PREMIUM_PRODUCT_ID,
} from '../config.js';

export const DONATION_TIER = {
  USER: 'user',
  VIP: 'vip',
  PREMIUM: 'premium',
};

export const DONATION_TIERS = [
  {
    id: DONATION_TIER.VIP,
    name: 'VIP PXU',
    price: 3.00,
    currency: 'USD',
    perks: [
      'Increased to 150% of the original Max Pixel Stack',
      'Colorful nickname',
      'Global Alert (cooldown: 6h)',
      'Access to VIP Chat on Discord',
    ],
    sitePermissions: {
      maxPixelStackMultiplier: 1.5,
      colorfulNickname: true,
      profileCustomization: false,
      canUseGlobalAlert: true,
      globalAlertCooldown: 6 * 60 * 60 * 1000,
    },
    discordRoleId: DISCORD_VIP_ROLE_ID || null,
    patreonProductId: PATREON_VIP_PRODUCT_ID || null,
  },
  {
    id: DONATION_TIER.PREMIUM,
    name: 'Premium PXU',
    price: 7.00,
    currency: 'USD',
    perks: [
      'Increased to 200% of the original Max Pixel Stack',
      'Global Alert (cooldown: 3h)',
      'Profile and nickname customization',
      'Access to Premium Chat on Discord',
    ],
    sitePermissions: {
      maxPixelStackMultiplier: 2.0,
      colorfulNickname: true,
      profileCustomization: true,
      canUseGlobalAlert: true,
      globalAlertCooldown: 3 * 60 * 60 * 1000,
    },
    discordRoleId: DISCORD_PREMIUM_ROLE_ID || null,
    patreonProductId: PATREON_PREMIUM_PRODUCT_ID || null,
  },
];

export function getTierById(tierId) {
  return DONATION_TIERS.find((tier) => tier.id === tierId) || null;
}

export function getTierByProductId(productId) {
  return DONATION_TIERS.find(
    (tier) => tier.patreonProductId === productId,
  ) || null;
}

export function getHighestTier(tierIds) {
  if (!tierIds || tierIds.length === 0) return null;
  const tierOrder = [DONATION_TIER.USER, DONATION_TIER.VIP, DONATION_TIER.PREMIUM];
  let highestIndex = -1;
  for (const tierId of tierIds) {
    const index = tierOrder.indexOf(tierId);
    if (index > highestIndex) {
      highestIndex = index;
    }
  }
  return highestIndex > 0 ? tierOrder[highestIndex] : null;
}

export function isTierHigherOrEqual(tierA, tierB) {
  const tierOrder = [DONATION_TIER.USER, DONATION_TIER.VIP, DONATION_TIER.PREMIUM];
  return tierOrder.indexOf(tierA) >= tierOrder.indexOf(tierB);
}
