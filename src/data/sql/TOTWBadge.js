import { QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

export const TOTW_BADGE_NAMES = {
  NOMINEE: 'totw-nominee',
  WINNER: 'totw-winner',
};

export async function addTOTWBadgeToUser(userId, badgeName) {
  try {
    const user = await sequelize.query(
      'SELECT chatBadges FROM Users WHERE id = ?',
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!user) return false;

    let badges = [];
    if (user.chatBadges) {
      try {
        badges = JSON.parse(user.chatBadges);
      } catch (e) {
        badges = [];
      }
    }

    if (!badges.includes(badgeName)) {
      badges.push(badgeName);
      await sequelize.query(
        'UPDATE Users SET chatBadges = ? WHERE id = ?',
        {
          replacements: [JSON.stringify(badges), userId],
          type: QueryTypes.UPDATE,
        },
      );
    }

    return true;
  } catch (error) {
    console.error(`Error adding TOTW badge to user ${userId}: ${error.message}`);
    return false;
  }
}

export async function removeTOTWBadgeFromUser(userId, badgeName) {
  try {
    const user = await sequelize.query(
      'SELECT chatBadges FROM Users WHERE id = ?',
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!user || !user.chatBadges) return false;

    let badges = [];
    try {
      badges = JSON.parse(user.chatBadges);
    } catch (e) {
      return false;
    }

    const index = badges.indexOf(badgeName);
    if (index > -1) {
      badges.splice(index, 1);
      await sequelize.query(
        'UPDATE Users SET chatBadges = ? WHERE id = ?',
        {
          replacements: [badges.length > 0 ? JSON.stringify(badges) : null, userId],
          type: QueryTypes.UPDATE,
        },
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error removing TOTW badge from user ${userId}: ${error.message}`);
    return false;
  }
}

export async function addTOTWBadgeToFactionMembers(factionId, badgeName) {
  try {
    const members = await sequelize.query(
      'SELECT uid FROM FactionMembers WHERE fid = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
      },
    );

    for (const member of members) {
      await addTOTWBadgeToUser(member.uid, badgeName);
    }

    return members.length;
  } catch (error) {
    console.error(`Error adding TOTW badge to faction ${factionId}: ${error.message}`);
    return 0;
  }
}

export async function removeTOTWBadgeFromFactionMembers(factionId, badgeName) {
  try {
    const members = await sequelize.query(
      'SELECT uid FROM FactionMembers WHERE fid = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
      },
    );

    for (const member of members) {
      await removeTOTWBadgeFromUser(member.uid, badgeName);
    }

    return members.length;
  } catch (error) {
    console.error(`Error removing TOTW badge from faction ${factionId}: ${error.message}`);
    return 0;
  }
}

export async function clearAllTOTWNomineeBadges() {
  try {
    const users = await sequelize.query(
      `SELECT id, chatBadges FROM Users WHERE chatBadges LIKE '%${TOTW_BADGE_NAMES.NOMINEE}%'`,
      { type: QueryTypes.SELECT },
    );

    for (const user of users) {
      await removeTOTWBadgeFromUser(user.id, TOTW_BADGE_NAMES.NOMINEE);
    }

    return users.length;
  } catch (error) {
    console.error(`Error clearing TOTW nominee badges: ${error.message}`);
    return 0;
  }
}
