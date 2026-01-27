import { canUseColorfulNickname, canCustomizeProfile, DONATION_TIER } from './index.js';
import { User } from '../../data/sql/index.js';

export const NICKNAME_COLORS = [
  { id: 'red', hex: '#ef4444', name: 'Red' },
  { id: 'orange', hex: '#f97316', name: 'Orange' },
  { id: 'amber', hex: '#f59e0b', name: 'Amber' },
  { id: 'yellow', hex: '#eab308', name: 'Yellow' },
  { id: 'lime', hex: '#84cc16', name: 'Lime' },
  { id: 'green', hex: '#22c55e', name: 'Green' },
  { id: 'emerald', hex: '#10b981', name: 'Emerald' },
  { id: 'teal', hex: '#14b8a6', name: 'Teal' },
  { id: 'cyan', hex: '#06b6d4', name: 'Cyan' },
  { id: 'sky', hex: '#0ea5e9', name: 'Sky' },
  { id: 'blue', hex: '#3b82f6', name: 'Blue' },
  { id: 'indigo', hex: '#6366f1', name: 'Indigo' },
  { id: 'violet', hex: '#8b5cf6', name: 'Violet' },
  { id: 'purple', hex: '#a855f7', name: 'Purple' },
  { id: 'fuchsia', hex: '#d946ef', name: 'Fuchsia' },
  { id: 'pink', hex: '#ec4899', name: 'Pink' },
  { id: 'rose', hex: '#f43f5e', name: 'Rose' },
];

export const GRADIENT_PRESETS = [
  { id: 'sunset', colors: ['#f97316', '#ec4899'], name: 'Sunset' },
  { id: 'ocean', colors: ['#06b6d4', '#3b82f6'], name: 'Ocean' },
  { id: 'forest', colors: ['#22c55e', '#14b8a6'], name: 'Forest' },
  { id: 'fire', colors: ['#ef4444', '#f59e0b'], name: 'Fire' },
  { id: 'galaxy', colors: ['#8b5cf6', '#ec4899'], name: 'Galaxy' },
  { id: 'aurora', colors: ['#22c55e', '#06b6d4', '#8b5cf6'], name: 'Aurora' },
  { id: 'rainbow', colors: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'], name: 'Rainbow' },
];

export function getAvailableColors() {
  return NICKNAME_COLORS;
}

export function getAvailableGradients() {
  return GRADIENT_PRESETS;
}

export function isValidColor(colorId) {
  return NICKNAME_COLORS.some((c) => c.id === colorId);
}

export function isValidGradient(gradientId) {
  return GRADIENT_PRESETS.some((g) => g.id === gradientId);
}

export function getColorHex(colorId) {
  const color = NICKNAME_COLORS.find((c) => c.id === colorId);
  return color ? color.hex : null;
}

export function getGradientColors(gradientId) {
  const gradient = GRADIENT_PRESETS.find((g) => g.id === gradientId);
  return gradient ? gradient.colors : null;
}

export function canSetNicknameStyle(donationTier) {
  return canUseColorfulNickname(donationTier);
}

export function canSetGradientStyle(donationTier) {
  return canCustomizeProfile(donationTier);
}

export async function getUserNicknameStyle(userId) {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['nicknameStyle'],
      raw: true,
    });

    if (!user || !user.nicknameStyle) {
      return { type: 'default', value: null };
    }

    const style = typeof user.nicknameStyle === 'string'
      ? JSON.parse(user.nicknameStyle)
      : user.nicknameStyle;

    return style;
  } catch (error) {
    console.error(`Error getting nickname style for user ${userId}:`, error.message);
    return { type: 'default', value: null };
  }
}

export async function setUserNicknameStyle(userId, donationTier, styleType, styleValue) {
  if (styleType === 'color') {
    if (!canSetNicknameStyle(donationTier)) {
      return { success: false, error: 'No permission for colorful nickname' };
    }
    if (!isValidColor(styleValue)) {
      return { success: false, error: 'Invalid color' };
    }
  } else if (styleType === 'gradient') {
    if (!canSetGradientStyle(donationTier)) {
      return { success: false, error: 'No permission for gradient nickname' };
    }
    if (!isValidGradient(styleValue)) {
      return { success: false, error: 'Invalid gradient' };
    }
  } else if (styleType === 'default') {
    styleValue = null;
  } else {
    return { success: false, error: 'Invalid style type' };
  }

  try {
    const style = { type: styleType, value: styleValue };
    await User.update(
      { nicknameStyle: JSON.stringify(style) },
      { where: { id: userId } },
    );
    return { success: true, style };
  } catch (error) {
    console.error(`Error setting nickname style for user ${userId}:`, error.message);
    return { success: false, error: 'Database error' };
  }
}

export function renderNicknameStyle(style) {
  if (!style || style.type === 'default' || !style.value) {
    return null;
  }

  if (style.type === 'color') {
    const hex = getColorHex(style.value);
    return hex ? { color: hex } : null;
  }

  if (style.type === 'gradient') {
    const colors = getGradientColors(style.value);
    if (!colors || colors.length < 2) return null;

    const gradientStops = colors.map((c, i) => {
      const percent = (i / (colors.length - 1)) * 100;
      return `${c} ${percent}%`;
    }).join(', ');

    return {
      background: `linear-gradient(90deg, ${gradientStops})`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    };
  }

  return null;
}
