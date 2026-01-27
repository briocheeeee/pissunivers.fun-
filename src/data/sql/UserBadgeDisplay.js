import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';

const UserBadgeDisplay = sequelize.define('UserBadgeDisplay', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
  },

  displayedBadges: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
      const value = this.getDataValue('displayedBadges');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('displayedBadges', value ? JSON.stringify(value) : null);
    },
  },

  featuredBadge: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    defaultValue: null,
  },

  badgeOrder: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
      const value = this.getDataValue('badgeOrder');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('badgeOrder', value ? JSON.stringify(value) : null);
    },
  },
});

function safeParseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function getUserBadgeDisplay(uid) {
  try {
    const display = await UserBadgeDisplay.findOne({
      where: { uid },
      raw: true,
    });
    if (display) {
      return {
        displayedBadges: safeParseArray(display.displayedBadges),
        featuredBadge: display.featuredBadge,
        badgeOrder: safeParseArray(display.badgeOrder),
      };
    }
  } catch (error) {
    console.error(`SQL Error on getUserBadgeDisplay: ${error.message}`);
  }
  return { displayedBadges: [], featuredBadge: null, badgeOrder: [] };
}

export async function setUserBadgeDisplay(uid, displayedBadges, featuredBadge, badgeOrder) {
  try {
    const existing = await UserBadgeDisplay.findOne({ where: { uid } });
    if (existing) {
      await existing.update({
        displayedBadges: Array.isArray(displayedBadges) ? displayedBadges : [],
        featuredBadge: featuredBadge || null,
        badgeOrder: Array.isArray(badgeOrder) ? badgeOrder : [],
      });
    } else {
      await UserBadgeDisplay.create({
        uid,
        displayedBadges: Array.isArray(displayedBadges) ? displayedBadges : [],
        featuredBadge: featuredBadge || null,
        badgeOrder: Array.isArray(badgeOrder) ? badgeOrder : [],
      });
    }
    return true;
  } catch (error) {
    console.error(`SQL Error on setUserBadgeDisplay: ${error.message}`);
  }
  return false;
}

export async function getPublicProfileBadges(uid) {
  try {
    const result = await sequelize.query(
      `SELECT ub.id, b.name, b.description, ub.createdAt,
       ubd.featuredBadge, ubd.displayedBadges, ubd.badgeOrder
       FROM UserBadges ub
       INNER JOIN Badges b ON b.id = ub.bid
       LEFT JOIN UserBadgeDisplays ubd ON ubd.uid = ub.uid
       WHERE ub.uid = ?`,
      {
        replacements: [uid],
        type: QueryTypes.SELECT,
      },
    );

    if (!result.length) {
      return { badges: [], featuredBadge: null };
    }

    const displaySettings = result[0].displayedBadges
      ? JSON.parse(result[0].displayedBadges)
      : null;
    const badgeOrder = result[0].badgeOrder
      ? JSON.parse(result[0].badgeOrder)
      : [];
    const { featuredBadge } = result[0];

    let badges = result.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      ts: r.createdAt.getTime(),
    }));

    if (displaySettings && displaySettings.length > 0) {
      badges = badges.filter((b) => displaySettings.includes(b.id));
    }

    if (badgeOrder.length > 0) {
      badges.sort((a, b) => {
        const aIdx = badgeOrder.indexOf(a.id);
        const bIdx = badgeOrder.indexOf(b.id);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }

    return { badges, featuredBadge };
  } catch (error) {
    console.error(`SQL Error on getPublicProfileBadges: ${error.message}`);
  }
  return { badges: [], featuredBadge: null };
}

export default UserBadgeDisplay;
