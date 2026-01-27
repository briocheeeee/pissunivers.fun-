import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { FACTION_ROLE } from './Faction.js';

const FactionMember = sequelize.define('FactionMember', {
  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
  },

  role: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: FACTION_ROLE.MEMBER,
  },

  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  timestamps: false,
});

export async function getUserFaction(userId) {
  try {
    const result = await sequelize.query(
      `SELECT f.*, fm.role, fm.joinedAt
       FROM FactionMembers fm
       INNER JOIN Factions f ON f.id = fm.fid
       WHERE fm.uid = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getUserFaction: ${error.message}`);
    return null;
  }
}

export async function getUserFactionInfo(userId) {
  try {
    const result = await sequelize.query(
      `SELECT f.id, f.tag, f.name
       FROM FactionMembers fm
       INNER JOIN Factions f ON f.id = fm.fid
       WHERE fm.uid = ?`,
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getUserFactionInfo: ${error.message}`);
    return null;
  }
}

export async function getFactionMembers(factionId, limit = 100, offset = 0) {
  try {
    const members = await sequelize.query(
      `SELECT u.id, u.name, fm.role, fm.joinedAt
       FROM FactionMembers fm
       INNER JOIN Users u ON u.id = fm.uid
       WHERE fm.fid = ?
       ORDER BY fm.role DESC, fm.joinedAt ASC
       LIMIT ? OFFSET ?`,
      {
        replacements: [factionId, limit, offset],
        type: QueryTypes.SELECT,
      },
    );
    return members;
  } catch (error) {
    console.error(`SQL Error on getFactionMembers: ${error.message}`);
    return [];
  }
}

export async function getFactionMemberCount(factionId) {
  try {
    const result = await sequelize.query(
      'SELECT COUNT(*) as count FROM FactionMembers WHERE fid = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return result ? result.count : 0;
  } catch (error) {
    console.error(`SQL Error on getFactionMemberCount: ${error.message}`);
    return 0;
  }
}

export async function addFactionMember(factionId, userId, role = FACTION_ROLE.MEMBER) {
  try {
    await FactionMember.create({
      fid: factionId,
      uid: userId,
      role,
    });
    return true;
  } catch (error) {
    console.error(`SQL Error on addFactionMember: ${error.message}`);
    return false;
  }
}

export async function removeFactionMember(factionId, userId) {
  try {
    const result = await FactionMember.destroy({
      where: { fid: factionId, uid: userId },
    });
    return result > 0;
  } catch (error) {
    console.error(`SQL Error on removeFactionMember: ${error.message}`);
    return false;
  }
}

export async function isFactionMember(factionId, userId) {
  try {
    const result = await FactionMember.findOne({
      where: { fid: factionId, uid: userId },
      raw: true,
    });
    return !!result;
  } catch (error) {
    console.error(`SQL Error on isFactionMember: ${error.message}`);
    return false;
  }
}

export async function getFactionMemberRole(factionId, userId) {
  try {
    const result = await FactionMember.findOne({
      where: { fid: factionId, uid: userId },
      attributes: ['role'],
      raw: true,
    });
    return result ? result.role : null;
  } catch (error) {
    console.error(`SQL Error on getFactionMemberRole: ${error.message}`);
    return null;
  }
}

export async function transferOwnership(factionId, currentOwnerId, newOwnerId) {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      'UPDATE FactionMembers SET role = ? WHERE fid = ? AND uid = ?',
      {
        replacements: [FACTION_ROLE.MEMBER, factionId, currentOwnerId],
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
    await sequelize.query(
      'UPDATE FactionMembers SET role = ? WHERE fid = ? AND uid = ?',
      {
        replacements: [FACTION_ROLE.OWNER, factionId, newOwnerId],
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
    await sequelize.query(
      'UPDATE Factions SET ownerId = ? WHERE id = ?',
      {
        replacements: [newOwnerId, factionId],
        type: QueryTypes.UPDATE,
        transaction,
      },
    );
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    console.error(`SQL Error on transferOwnership: ${error.message}`);
    return false;
  }
}

export default FactionMember;
