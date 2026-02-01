import { QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import badgesConfig from '../../core/badges.json';

function getBadgeSlug(badgeName) {
  return badgeName.toLowerCase().replace(/\s+/g, '');
}

export async function awardBadge(uid, badgeName, note = null) {
  try {
    const badge = await sequelize.query(
      'SELECT id FROM Badges WHERE name = ?',
      {
        replacements: [badgeName],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!badge) {
      return { error: `Badge "${badgeName}" not found` };
    }

    const existing = await sequelize.query(
      'SELECT id FROM UserBadges WHERE uid = ? AND bid = ?',
      {
        replacements: [uid, badge.id],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (existing) {
      return { error: 'User already has this badge' };
    }

    await sequelize.query(
      'INSERT INTO UserBadges (uid, bid, note, createdAt) VALUES (?, ?, ?, NOW())',
      {
        replacements: [uid, badge.id, note],
        type: QueryTypes.INSERT,
      },
    );

    const badgeSlug = getBadgeSlug(badgeName);
    const user = await sequelize.query(
      'SELECT chatBadges FROM Users WHERE id = ?',
      { replacements: [uid], type: QueryTypes.SELECT, plain: true },
    );
    let chatBadges = [];
    if (user?.chatBadges) {
      try { chatBadges = JSON.parse(user.chatBadges); } catch (e) { chatBadges = []; }
    }
    if (!chatBadges.includes(badgeSlug)) {
      chatBadges.push(badgeSlug);
      await sequelize.query(
        'UPDATE Users SET chatBadges = ? WHERE id = ?',
        { replacements: [JSON.stringify(chatBadges), uid], type: QueryTypes.UPDATE },
      );
    }

    return { success: true, badgeId: badge.id };
  } catch (error) {
    console.error(`SQL Error on awardBadge: ${error.message}`);
    return { error: 'Failed to award badge' };
  }
}

export async function revokeBadge(uid, badgeName) {
  try {
    const badge = await sequelize.query(
      'SELECT id FROM Badges WHERE name = ?',
      {
        replacements: [badgeName],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!badge) {
      return { error: `Badge "${badgeName}" not found` };
    }

    await sequelize.query(
      'DELETE FROM UserBadges WHERE uid = ? AND bid = ?',
      {
        replacements: [uid, badge.id],
        type: QueryTypes.DELETE,
      },
    );

    const badgeSlug = getBadgeSlug(badgeName);
    const user = await sequelize.query(
      'SELECT chatBadges FROM Users WHERE id = ?',
      { replacements: [uid], type: QueryTypes.SELECT, plain: true },
    );
    if (user?.chatBadges) {
      let chatBadges = [];
      try { chatBadges = JSON.parse(user.chatBadges); } catch (e) { chatBadges = []; }
      const idx = chatBadges.indexOf(badgeSlug);
      if (idx > -1) {
        chatBadges.splice(idx, 1);
        await sequelize.query(
          'UPDATE Users SET chatBadges = ? WHERE id = ?',
          { replacements: [chatBadges.length > 0 ? JSON.stringify(chatBadges) : null, uid], type: QueryTypes.UPDATE },
        );
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`SQL Error on revokeBadge: ${error.message}`);
    return { error: 'Failed to revoke badge' };
  }
}

export async function getAllBadges() {
  return badgesConfig.badges.map((b, idx) => ({
    id: idx + 1,
    name: b.name,
    description: b.description,
    file: b.file,
    thumb: b.thumb,
  }));
}

export async function getUserBadges(uid) {
  try {
    const badges = await sequelize.query(
      `SELECT b.id, b.name, b.description, ub.note, ub.createdAt 
       FROM Badges b 
       INNER JOIN UserBadges ub ON ub.bid = b.id 
       WHERE ub.uid = ?`,
      {
        replacements: [uid],
        type: QueryTypes.SELECT,
      },
    );
    return badges;
  } catch (error) {
    console.error(`SQL Error on getUserBadges: ${error.message}`);
    return [];
  }
}

const firstPixelAwarded = new Set();

export async function awardFirstPixelBadge(uid) {
  if (firstPixelAwarded.has(uid)) {
    return null;
  }

  try {
    const existing = await sequelize.query(
      `SELECT ub.id FROM UserBadges ub
       INNER JOIN Badges b ON b.id = ub.bid
       WHERE ub.uid = ? AND b.name = 'First Pixel'`,
      {
        replacements: [uid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (existing) {
      firstPixelAwarded.add(uid);
      return null;
    }

    const result = await awardBadge(uid, 'First Pixel', 'Placed first pixel');
    if (result.success) {
      firstPixelAwarded.add(uid);
    }
    return result;
  } catch (error) {
    console.error(`SQL Error on awardFirstPixelBadge: ${error.message}`);
    return null;
  }
}

export async function awardBadgeBySlug(uid, badgeSlug, note = null) {
  const badgeConfig = badgesConfig.badges.find(
    (b) => b.name.toLowerCase().replace(/\s+/g, '') === badgeSlug,
  );
  if (!badgeConfig) {
    return { error: `Badge with slug "${badgeSlug}" not found in config` };
  }
  return awardBadge(uid, badgeConfig.name, note);
}

const veteranChecked = new Set();

export async function checkAndAwardVeteranBadge(uid) {
  if (veteranChecked.has(uid)) {
    return null;
  }

  try {
    const user = await sequelize.query(
      'SELECT createdAt FROM Users WHERE id = ?',
      {
        replacements: [uid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!user || !user.createdAt) {
      return null;
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (new Date(user.createdAt) <= oneYearAgo) {
      const existing = await sequelize.query(
        `SELECT ub.id FROM UserBadges ub
         INNER JOIN Badges b ON b.id = ub.bid
         WHERE ub.uid = ? AND b.name = 'Veteran'`,
        {
          replacements: [uid],
          type: QueryTypes.SELECT,
          plain: true,
        },
      );

      if (!existing) {
        const result = await awardBadge(uid, 'Veteran', 'Account older than 1 year');
        veteranChecked.add(uid);
        return result;
      }
    }

    veteranChecked.add(uid);
    return null;
  } catch (error) {
    console.error(`SQL Error on checkAndAwardVeteranBadge: ${error.message}`);
    return null;
  }
}

const socialButterflyTracking = new Map();

export async function trackChatMessageForBadge(uid) {
  const count = (socialButterflyTracking.get(uid) || 0) + 1;
  socialButterflyTracking.set(uid, count);

  if (count === 1000) {
    try {
      const existing = await sequelize.query(
        `SELECT ub.id FROM UserBadges ub
         INNER JOIN Badges b ON b.id = ub.bid
         WHERE ub.uid = ? AND b.name = 'Social Butterfly'`,
        {
          replacements: [uid],
          type: QueryTypes.SELECT,
          plain: true,
        },
      );

      if (!existing) {
        return awardBadge(uid, 'Social Butterfly', 'Sent 1000 chat messages');
      }
    } catch (error) {
      console.error(`SQL Error on trackChatMessageForBadge: ${error.message}`);
    }
  }
  return null;
}

export async function initializeChatMessageCounts() {
  try {
    const counts = await sequelize.query(
      `SELECT uid, COUNT(*) as cnt FROM Messages 
       WHERE uid IS NOT NULL 
       GROUP BY uid 
       HAVING cnt >= 500`,
      {
        type: QueryTypes.SELECT,
      },
    );

    for (const { uid, cnt } of counts) {
      socialButterflyTracking.set(uid, cnt);
    }
  } catch (error) {
    console.error(`SQL Error on initializeChatMessageCounts: ${error.message}`);
  }
}
