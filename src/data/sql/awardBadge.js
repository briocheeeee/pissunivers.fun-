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
