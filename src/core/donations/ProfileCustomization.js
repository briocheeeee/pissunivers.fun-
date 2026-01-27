import { canCustomizeProfile, DONATION_TIER } from './index.js';
import { User } from '../../data/sql/index.js';

export const PROFILE_BACKGROUNDS = [
  { id: 'default', name: 'Default', value: null },
  { id: 'gradient-sunset', name: 'Sunset', value: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' },
  { id: 'gradient-ocean', name: 'Ocean', value: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' },
  { id: 'gradient-forest', name: 'Forest', value: 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)' },
  { id: 'gradient-galaxy', name: 'Galaxy', value: 'linear-gradient(135deg, #1e1b4b 0%, #8b5cf6 50%, #ec4899 100%)' },
  { id: 'gradient-fire', name: 'Fire', value: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' },
  { id: 'gradient-aurora', name: 'Aurora', value: 'linear-gradient(135deg, #22c55e 0%, #06b6d4 50%, #8b5cf6 100%)' },
  { id: 'gradient-midnight', name: 'Midnight', value: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' },
  { id: 'gradient-rose', name: 'Rose Gold', value: 'linear-gradient(135deg, #f43f5e 0%, #fbbf24 100%)' },
];

export const PROFILE_FRAMES = [
  { id: 'none', name: 'None', borderStyle: 'none' },
  { id: 'gold', name: 'Gold', borderStyle: '3px solid #f59e0b' },
  { id: 'silver', name: 'Silver', borderStyle: '3px solid #94a3b8' },
  { id: 'bronze', name: 'Bronze', borderStyle: '3px solid #cd7f32' },
  { id: 'diamond', name: 'Diamond', borderStyle: '3px solid #06b6d4' },
  { id: 'ruby', name: 'Ruby', borderStyle: '3px solid #ef4444' },
  { id: 'emerald', name: 'Emerald', borderStyle: '3px solid #22c55e' },
  { id: 'amethyst', name: 'Amethyst', borderStyle: '3px solid #8b5cf6' },
];

export function getAvailableBackgrounds() {
  return PROFILE_BACKGROUNDS;
}

export function getAvailableFrames() {
  return PROFILE_FRAMES;
}

export function isValidBackground(backgroundId) {
  return PROFILE_BACKGROUNDS.some((b) => b.id === backgroundId);
}

export function isValidFrame(frameId) {
  return PROFILE_FRAMES.some((f) => f.id === frameId);
}

export function getBackgroundValue(backgroundId) {
  const bg = PROFILE_BACKGROUNDS.find((b) => b.id === backgroundId);
  return bg ? bg.value : null;
}

export function getFrameStyle(frameId) {
  const frame = PROFILE_FRAMES.find((f) => f.id === frameId);
  return frame ? frame.borderStyle : 'none';
}

export async function getUserProfileCustomization(userId) {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['profileCustomization'],
      raw: true,
    });

    if (!user || !user.profileCustomization) {
      return {
        background: 'default',
        frame: 'none',
        bio: '',
      };
    }

    const customization = typeof user.profileCustomization === 'string'
      ? JSON.parse(user.profileCustomization)
      : user.profileCustomization;

    return {
      background: customization.background || 'default',
      frame: customization.frame || 'none',
      bio: customization.bio || '',
    };
  } catch (error) {
    console.error(`Error getting profile customization for user ${userId}:`, error.message);
    return { background: 'default', frame: 'none', bio: '' };
  }
}

export async function setUserProfileCustomization(userId, donationTier, updates) {
  if (!canCustomizeProfile(donationTier)) {
    return { success: false, error: 'No permission for profile customization' };
  }

  const current = await getUserProfileCustomization(userId);
  const newCustomization = { ...current };

  if (updates.background !== undefined) {
    if (!isValidBackground(updates.background)) {
      return { success: false, error: 'Invalid background' };
    }
    newCustomization.background = updates.background;
  }

  if (updates.frame !== undefined) {
    if (!isValidFrame(updates.frame)) {
      return { success: false, error: 'Invalid frame' };
    }
    newCustomization.frame = updates.frame;
  }

  if (updates.bio !== undefined) {
    if (typeof updates.bio !== 'string') {
      return { success: false, error: 'Bio must be a string' };
    }
    if (updates.bio.length > 500) {
      return { success: false, error: 'Bio too long (max 500 characters)' };
    }
    newCustomization.bio = updates.bio.trim();
  }

  try {
    await User.update(
      { profileCustomization: JSON.stringify(newCustomization) },
      { where: { id: userId } },
    );
    return { success: true, customization: newCustomization };
  } catch (error) {
    console.error(`Error setting profile customization for user ${userId}:`, error.message);
    return { success: false, error: 'Database error' };
  }
}

export function renderProfileStyles(customization) {
  const styles = {};

  if (customization.background && customization.background !== 'default') {
    const bgValue = getBackgroundValue(customization.background);
    if (bgValue) {
      styles.background = bgValue;
    }
  }

  if (customization.frame && customization.frame !== 'none') {
    const frameStyle = getFrameStyle(customization.frame);
    if (frameStyle && frameStyle !== 'none') {
      styles.border = frameStyle;
    }
  }

  return styles;
}
